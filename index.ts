import * as pulumi from "@pulumi/pulumi";
import { createS3Bucket } from "./infra/s3";
import { createIAMResources } from "./infra/iam";
import { createHetznerServer } from "./infra/hetznerServer";
import { configureServer } from "./infra/serverConfig";
import { setupDockerInServer } from "./infra/setupDockerInServer";
import { copyToolingDataFilesToServer } from "./infra/serverCopyToolingFiles";
import { copyMauAppDataFilesToServer } from "./infra/serverCopyMauAppFiles";
import { configureServerEnv } from "./infra/setupEnvs";
import { deployDockerStacks } from "./infra/deployDockerStacks";
import { createCloudflareTunnels } from "./infra/cloudflare";

// Step 1-3: Create S3 bucket, IAM resources, and Hetzner server in parallel
const s3Resources = createS3Bucket();
const iamResources = createIAMResources();
const hetznerResources = createHetznerServer();

// Wait for all parallel operations to complete
const initialSetup = pulumi
  .all([s3Resources, iamResources, hetznerResources])
  .apply(([s3, iam, hetzner]) => ({
    appBucket: s3.appBucket,
    bucketUrl: s3.bucketUrl,
    iamUser: iam.iamUser,
    accessKey: iam.accessKey,
    server: hetzner.server,
    sshKey: hetzner.sshKey,
  }));

// Step 4: Configure server (depends on Hetzner server creation)
const serverConfig = initialSetup.apply((resources) => {
  const { createUser, installNode, disableRootSSH } = configureServer(
    resources.server,
  );
  return pulumi.all([createUser.id, installNode.id, disableRootSSH.id]);
});

const setupDocker = pulumi
  .all([initialSetup, serverConfig])
  .apply(([resources, _]) => {
    const { installDocker, initDockerSwarmAndNetworks, setupSecrets } =
      setupDockerInServer(resources.server);
    return pulumi.all([
      installDocker.id,
      initDockerSwarmAndNetworks.id,
      setupSecrets.id,
    ]);
  });

// Step 5: Configure server environment (depends on server configuration)
const serverEnv = pulumi
  .all([initialSetup, serverConfig])
  .apply(([resources, _]) => {
    const { createEnvVars } = configureServerEnv(
      resources.server,
      resources.appBucket,
    );
    return createEnvVars.id;
  });

// Step 6: Copy Mau App files and tooling files in parallel (depends on server environment setup)
const filesCopied = pulumi
  .all([initialSetup, serverEnv, setupDocker])
  .apply(([resources, _, __]) => {
    const server = resources.server;
    const mauAppFiles = copyMauAppDataFilesToServer(server);
    const toolingFiles = copyToolingDataFilesToServer(server);

    return pulumi.all([
      mauAppFiles.createMauAppFolders.id,
      mauAppFiles.scpDockerComposeMauApp.id,
      toolingFiles.scpDockerComposeTooling.id,
      toolingFiles.scpToolingDataDozzle.id,
      toolingFiles.scpToolingDataShepherd.id,
      toolingFiles.scpCaddyFile.id,
      toolingFiles.setPermissionsAndCronJob.id,
    ]);
  });

// Step 7: Deploy Docker stacks (depends on file copying)
const dockerStacksDeployed = pulumi
  .all([initialSetup, filesCopied, serverEnv])
  .apply(([resources, _]) => {
    const server = resources.server;
    const { deployDockerStacksResult } = deployDockerStacks(server);
    return deployDockerStacksResult.id;
  });

// Step 8: Set up DNS and Cloudflare tunnels (depends on Docker stacks deployment)
const cloudflareSetup = pulumi
  .all([initialSetup, dockerStacksDeployed])
  .apply(([resources, _]) => {
    const serverIp = resources.server.ipv4Address;
    const {
      maumercadoTunnel,
      maumercadoDns,
      wwwMaumercadoDns,
      maumercadoPocketbaseDns,
      maumercadoTypesenseDns,
      codigoTunnel,
      codigoDns,
      wwwCodigoDns,
      codigoPocketbaseDns,
      codigoTypesenseDns,
      dozzleDns,
      maumercadoConfig,
      codigoConfig,
    } = createCloudflareTunnels(serverIp);

    return pulumi.all([
      maumercadoTunnel.id,
      maumercadoDns.id,
      wwwMaumercadoDns.id,
      maumercadoPocketbaseDns.id,
      maumercadoTypesenseDns.id,
      codigoTunnel.id,
      codigoDns.id,
      wwwCodigoDns.id,
      codigoPocketbaseDns.id,
      codigoTypesenseDns.id,
      dozzleDns.id,
      maumercadoConfig.id,
      codigoConfig.id,
    ]);
  });

// Exports
export const serverIp = initialSetup.apply(
  (resources) => resources.server.ipv4Address,
);
export const bucketName = initialSetup.apply(
  (resources) => resources.appBucket.id,
);
export const iamUserName = initialSetup.apply(
  (resources) => resources.iamUser.name,
);
export const accessKeyId = initialSetup.apply(
  (resources) => resources.accessKey.id,
);
export const sshKeyId = initialSetup.apply((resources) => resources.sshKey.id);
export const initialSetupComplete = initialSetup.apply(
  () => "Parallel setup completed",
);
export const serverConfigOutput = serverConfig;
export const serverEnvOutput = serverEnv;
export const filesCopiedOutput = filesCopied;
export const dockerStacksDeployedOutput = dockerStacksDeployed;
export const cloudflareSetupOutput = cloudflareSetup;
