import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import { Server } from "@pulumi/hcloud";

export const copyToolingDataFilesToServer = (server: Server) => {
  // Define the server details and credentials
  const config = new pulumi.Config();

  const docker_compose_tooling = config.require("docker_compose_tooling");

  const dozzleUsers = config.requireSecret("users");
  const shepherdConfig = config.requireSecret("shepherd_config");
  const caddyFile = config.requireSecret("Caddyfile");

  const backupDataScript = config.require("backupDataScript");
  const uploadToS3Script = config.require("uploadToS3Script");
  const restoreAndCopyBackupScript = config.require(
    "restoreAndCopyBackupScript",
  );

  const encodedSshPrivateKey = config.requireSecret("sshPrivateKey");

  const cloudflaredMaumercadoEntrypoint = config.require("cloudflaredMaumercadoEntrypoint");
  const cloudflaredCodigoEntrypoint = config.require("cloudflaredCodigoEntrypoint");

  const sshPrivateKey = pulumi
    .all([encodedSshPrivateKey])
    .apply(([encoded]) => Buffer.from(encoded, "base64").toString("utf-8"));

  const connection = {
    host: server.ipv4Address,
    user: "codigo",
    privateKey: sshPrivateKey,
  };

  // SCP commands to copy docker compose app string to the server
  const createToolingFolders = new command.remote.Command(
    "create tooling data folders",
    {
      connection,
      create: pulumi.interpolate`
      mkdir -p /home/codigo/bin &&
      mkdir -p /home/codigo/tooling/data/caddy/config &&
      mkdir -p /home/codigo/tooling/data/caddy/data &&
      mkdir -p /home/codigo/tooling/data/dozzle &&
      mkdir -p /home/codigo/tooling/data/shepherd &&
      mkdir -p /home/codigo/tooling/data/typesense &&
      mkdir -p /home/codigo/tooling/bin/cloudflared
    `,
    },
  );

  const scpCloudflaredMaumercadoEntrypoint = new command.remote.Command(
    "copy cloudflared maumercado entrypoint",
    {
      connection,
      create: pulumi.interpolate`echo '${cloudflaredMaumercadoEntrypoint}' > /home/codigo/tooling/bin/cloudflared/maumercado_entrypoint.sh && chmod +x /home/codigo/tooling/bin/cloudflared/maumercado_entrypoint.sh`,
    },
    { dependsOn: createToolingFolders },
  );

  const scpCloudflaredCodigoEntrypoint = new command.remote.Command(
    "copy cloudflared codigo entrypoint",
    {
      connection,
      create: pulumi.interpolate`echo '${cloudflaredCodigoEntrypoint}' > /home/codigo/tooling/bin/cloudflared/codigo_entrypoint.sh && chmod +x /home/codigo/tooling/bin/cloudflared/codigo_entrypoint.sh`,
    },
    { dependsOn: createToolingFolders },
  );

  // SCP commands to copy docker compose tooling string to the server

  const scpDockerComposeTooling = new command.remote.Command(
    "copy docker compose tooling",
    {
      connection,
      create: pulumi.interpolate`cat << EOF > /home/codigo/docker-compose.tooling.yaml
${docker_compose_tooling}
EOF
`,
    },
    { dependsOn: createToolingFolders },
  );

  // SCP commands to copy necessary tooling data files to the server
  const scpToolingDataDozzle = new command.remote.Command(
    "copy dozzle users file",
    {
      connection,
      create: pulumi.interpolate`echo '${dozzleUsers}' > /home/codigo/tooling/data/dozzle/users.yaml`,
    },
    { dependsOn: createToolingFolders },
  );

  const scpToolingDataShepherd = new command.remote.Command(
    "copy shepherd config",
    {
      connection,
      create: pulumi.interpolate`echo '${shepherdConfig}' > /home/codigo/tooling/data/shepherd/shepherd-config.yaml`,
    },
    { dependsOn: createToolingFolders },
  );

  const scpCaddyFile = new command.remote.Command(
    "copy caddy file",
    {
      connection,
      create: pulumi.interpolate`echo '${caddyFile}' > /home/codigo/tooling/data/caddy/Caddyfile`,
    },
    { dependsOn: createToolingFolders },
  );

  const scpBinRestoreAndCopyBackup = new command.remote.Command(
    "copy restore backup script",
    {
      connection,
      create: pulumi.interpolate`echo '${restoreAndCopyBackupScript}' > /home/codigo/bin/restoreBackup.js`,
    },
    { dependsOn: createToolingFolders },
  );

  const scpBinBackupData = new command.remote.Command(
    "copy backup data script",
    {
      connection,
      create: pulumi.interpolate`echo '${backupDataScript}' > /home/codigo/bin/backupData.js`,
    },
    { dependsOn: createToolingFolders },
  );

  const scpBinUploadToS3 = new command.remote.Command(
    "copy upload to S3 script",
    {
      connection,
      create: pulumi.interpolate`echo '${uploadToS3Script}' > /home/codigo/bin/uploadToS3.js`,
    },
    { dependsOn: createToolingFolders },
  );

  const setPermissionsAndCronJob = new command.remote.Command(
    "set permissions and cron job",
    {
      connection,
      create: `
      # Set correct permissions
      chmod +x /home/codigo/bin/*

      # Set up cron jobs
      (crontab -l 2>/dev/null; echo "0 */12 * * * \$(nvm run default) /home/codigo/bin/backupData.js") | crontab -
      (crontab -l 2>/dev/null; echo "30 */12 * * * \$(nvm run default) /home/codigo/bin/uploadToS3.js") | crontab -
    `,
    },
    {
      dependsOn: [
        scpBinRestoreAndCopyBackup,
        scpBinBackupData,
        scpBinUploadToS3,
      ],
    },
  );

  return {
    scpDockerComposeTooling,
    scpToolingDataDozzle,
    scpToolingDataShepherd,
    scpCaddyFile,
    setPermissionsAndCronJob,
    scpCloudflaredMaumercadoEntrypoint,
    scpCloudflaredCodigoEntrypoint,
  };
};
