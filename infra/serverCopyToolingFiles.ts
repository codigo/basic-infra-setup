import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import { Server } from "@pulumi/hcloud";

export const copyToolingDataFilesToServer = (
  server: Server,
  maumercadoTunnelToken: pulumi.Output<string>,
  codigoTunnelToken: pulumi.Output<string>,
) => {
  // Define the server details and credentials
  const config = new pulumi.Config();

  const docker_compose_tooling = config.require("docker_compose_tooling");

  // Inject the tunnel tokens into the docker_compose_tooling
  const injectedDockerComposeTooling = pulumi
    .all([docker_compose_tooling, maumercadoTunnelToken, codigoTunnelToken])
    .apply(([compose, maumercadoToken, codigoToken]) =>
      compose
        .replace('"{{ MAUMERCADO_TUNNEL_TOKEN }}"', maumercadoToken)
        .replace('"{{ CODIGO_TUNNEL_TOKEN }}"', codigoToken),
    );

  const dozzleUsers = config.requireSecret("users");
  const caddyFile = config.requireSecret("Caddyfile");

  const backupDataScript = config.require("backupDataScript");
  const uploadToS3Script = config.require("uploadToS3Script");
  const restoreAndCopyBackupScript = config.require(
    "restoreAndCopyBackupScript",
  );

  const encodedSshPrivateKey = config.requireSecret("sshPrivateKey");

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
      mkdir -p /home/codigo/tooling/bin/cloudflared &&
      mkdir -p /home/codigo/tooling/data/infisical/postgres &&
      mkdir -p /home/codigo/tooling/data/infisical/redis
    `,
    },
  );

  // SCP commands to copy docker compose tooling string to the server
  const scpDockerComposeTooling = new command.remote.Command(
    "copy docker compose tooling",
    {
      connection,
      create: pulumi.interpolate`cat << EOF > /home/codigo/docker-compose.tooling.yaml
${injectedDockerComposeTooling}
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

      # Install aws-sdk
      cd /home/codigo/bin && nvm use default && npm install aws-sdk

      # Set up cron jobs with logging
      (crontab -l 2>/dev/null; echo "0 */12 * * * sudo -u codigo BACKUP_DIR=/home/codigo/DATA_BACKUP node /home/codigo/bin/backupData.js >> /home/codigo/logs/backupData.log 2>&1") | crontab -
      (crontab -l 2>/dev/null; echo "30 */12 * * * sudo -u codigo BACKUP_DIR=/home/codigo/DATA_BACKUP node /home/codigo/bin/uploadToS3.js >> /home/codigo/logs/uploadToS3.log 2>&1") | crontab -

      # Create log directory if it doesn't exist
      mkdir -p /home/codigo/logs

      # Set appropriate permissions for the log directory
      chown codigo:codigo /home/codigo/logs
      chmod 755 /home/codigo/logs
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
    scpCaddyFile,
    setPermissionsAndCronJob,
  };
};
