import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import { createS3Bucket } from "./infra/s3";
import { createIAMResources } from "./infra/iam";
import { createCloudflareTunnels } from "./infra/cloudflare";
import { ServerProvider } from "./infra/serverProvider";
import { HetznerProvider } from "./infra/hetznerProvider";

const config = new pulumi.Config();
const awsConfig = new pulumi.Config("aws");

// Instantiate the desired server provider
const serverProvider: ServerProvider = new HetznerProvider();

// ── Step 1-4: Cloud resources (parallel) ─────────────────────────────────────
const s3Resources = createS3Bucket();
const iamResources = createIAMResources();

const encodedSshPublicKey = config.requireSecret("sshPublicKey");
const sshPublicKey = encodedSshPublicKey.apply((encoded) =>
  Buffer.from(encoded, "base64").toString("utf-8").trim(),
);

// SSH key file path — CI/CD writes the key to ~/.ssh/id_rsa in the "Setup SSH keys" step.
// For local runs, override with: pulumi config set sshKeyFile /path/to/key
const sshKeyFile = config.get("sshKeyFile") ?? "~/.ssh/id_rsa";

const APP_NAME = "mau-app";
const serverResources = serverProvider.createServer(APP_NAME, sshPublicKey);
const cloudflareResources = createCloudflareTunnels();

// Flatten nested Pulumi Outputs needed for Ansible.
// serverResources IS an Output (HetznerProvider wraps with pulumi.output()).
// s3Resources and cloudflareResources are plain objects whose properties are Outputs.
const serverIp = serverResources.apply((r: any) => r.server.ipv4Address);
const toolingPrivateIpOutput = serverResources.apply((r: any) => r.privateIp);
const privateNetworkIdOutput = serverResources.apply(
  (r: any) => r.privateNetwork.id,
);
const appBucketName = s3Resources.appBucket.bucket; // Output<string>
const maumercadoTunnelToken = cloudflareResources.maumercadoTunnel.tunnelToken; // Output<string>
const codigoTunnelToken = cloudflareResources.codigoTunnel.tunnelToken; // Output<string>

// Wait for all parallel cloud resources to complete
const initialSetup = pulumi
  .all([s3Resources, iamResources, serverResources, cloudflareResources])
  .apply(([s3, iam, server, cloudflare]: [any, any, any, any]) => ({
    appBucket: s3.appBucket,
    bucketUrl: s3.bucketUrl,
    iamUser: iam.iamUser,
    accessKey: iam.accessKey,
    server: server.server,
    sshKey: server.sshKey,
    cloudflare: cloudflare,
  }));

// ── Step 5: Bootstrap — first-time VPS setup (runs as root) ──────────────────
// Creates the codigo user and deploys the SSH key so subsequent runs can
// connect as codigo. Idempotent — safe to re-run if bootstrap already completed.
const bootstrap = new command.local.Command(
  "bootstrap",
  {
    create: pulumi.interpolate`
      VARS_FILE=$(mktemp /tmp/ansible-bootstrap-XXXXXX.yml)
      python3 -c "
import os, sys, yaml
yaml.dump({'ssh_public_key': os.environ['ANSIBLE_SSH_PUBLIC_KEY']}, open(sys.argv[1], 'w'))
" "$VARS_FILE"
      ANSIBLE_HOST_KEY_CHECKING=False ansible-playbook \
        -i '${serverIp},' \
        -u root \
        --private-key ${sshKeyFile} \
        --extra-vars "@$VARS_FILE" \
        ansible/playbooks/bootstrap.yml
      rm -f "$VARS_FILE"
    `,
    environment: {
      ANSIBLE_SSH_PUBLIC_KEY: sshPublicKey,
    },
  },
  { dependsOn: [serverResources.apply((r: any) => r.server)] },
);

// ── Step 6: Configure server + deploy tooling stack ──────────────────────────
// Ansible handles: base-server, docker, tooling-files, tooling-deploy roles.
// Idempotent — safe to run on every deploy.
//
// Category A (Pulumi-derived outputs — not available from env):
//   server_ip, ssh_public_key, app_bucket, tunnel tokens
//
// Category B (Ansible-only secrets) are read by Ansible directly from the
// CI/CD process environment via lookup('env', ...) in group_vars/all.yml.
// They are passed as env vars on the pulumi/actions step in the workflow,
// not routed through pulumi config.
const configure = new command.local.Command(
  "configure-server",
  {
    create: pulumi.interpolate`
      VARS_FILE=$(mktemp /tmp/ansible-vars-XXXXXX.yml)
      python3 -c "
import os, sys, yaml
# Only Pulumi-derived values that aren't available from env
raw = {k: v for k, v in os.environ.items() if k.startswith('ANSIBLE_VAR_')}
vars = {k[12:].lower(): v for k, v in raw.items()}
yaml.dump(vars, open(sys.argv[1], 'w'))
" "$VARS_FILE"
      ANSIBLE_HOST_KEY_CHECKING=False ansible-playbook \
        -i '${serverIp},' \
        --private-key ${sshKeyFile} \
        --extra-vars "@$VARS_FILE" \
        ansible/playbooks/site.yml
      rm -f "$VARS_FILE"
    `,
    environment: {
      // Category A only — Pulumi outputs not available from CI/CD env
      ANSIBLE_VAR_SERVER_IP: serverIp,
      ANSIBLE_VAR_SSH_PUBLIC_KEY: sshPublicKey,
      ANSIBLE_VAR_AWS_ACCESS_KEY_ID: config.requireSecret("awsAccessKeyId"),
      ANSIBLE_VAR_AWS_SECRET_ACCESS_KEY:
        config.requireSecret("awsSecretAccessKey"),
      ANSIBLE_VAR_AWS_REGION: awsConfig.require("region"),
      ANSIBLE_VAR_APP_BUCKET: appBucketName,
      ANSIBLE_VAR_TUNNEL_TOKEN_MAUMERCADO: maumercadoTunnelToken,
      ANSIBLE_VAR_TUNNEL_TOKEN_CODIGO: codigoTunnelToken,
    },
    // Re-run when any Pulumi-derived trigger value changes
    triggers: [serverIp, appBucketName],
  },
  { dependsOn: [bootstrap] },
);

// ── Step 7: Read worker join token (read-only SSH after configure) ────────────
const workerTokenCmd = new command.local.Command(
  "get-worker-token",
  {
    create: pulumi.interpolate`
      ssh -o StrictHostKeyChecking=no \
          -i ${sshKeyFile} \
          codigo@${serverIp} \
          'docker swarm join-token -q worker'
    `,
  },
  { dependsOn: [configure] },
);

// ── Exports ───────────────────────────────────────────────────────────────────
export const serverIpOut = serverIp;
export const bucketName = s3Resources.appBucket.id;
export const iamUserName = initialSetup.apply((r) => r.iamUser.name);
export const accessKeyId = initialSetup.apply((r) => r.accessKey.id);
export const sshKeyId = initialSetup.apply((r) => r.sshKey.id);
export const cloudflareSetupOutput = cloudflareResources;
export const toolingPrivateIpOut = toolingPrivateIpOutput;
export const hetznerPrivateNetworkId = privateNetworkIdOutput;
export const workerJoinToken = pulumi.secret(workerTokenCmd.stdout);
