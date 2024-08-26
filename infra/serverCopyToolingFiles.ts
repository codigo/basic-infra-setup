import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import { Server } from "@pulumi/hcloud";

export function copyToolingDataFilesToServer(
  server: pulumi.Output<Server>,
  publicIp: pulumi.Output<string>,
) {
  // Define the server details and credentials
  const config = new pulumi.Config();

  const docker_compose_tooling = config.require("docker_compose_tooling");

  const dozzleUsers = config.require("users");
  const shepherdConfig = config.require("shepherd_config");
  const caddyFile = config.require("Caddyfile");

  const backupDataScript = config.require("backupDataScript");
  const uploadToS3Script = config.require("uploadToS3Script");
  const restoreBackupScript = config.require("restoreBackupScript");

  const encodedSshPrivateKey = config.requireSecret("sshPrivateKey");

  const sshPrivateKey = pulumi
    .all([encodedSshPrivateKey])
    .apply(([encoded]) => Buffer.from(encoded, "base64").toString("utf-8"));

  const connection = {
    host: publicIp,
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
      mkdir -p /home/codigo/tooling/data/caddy &&
      mkdir -p /home/codigo/tooling/data/dozzle &&
      mkdir -p /home/codigo/tooling/data/shepherd &&
      mkdir -p /home/codigo/tooling/data/typesense
    `,
    },
  );

  // SCP commands to copy docker compose tooling string to the server

  const scpDockerComposeTooling = new command.remote.Command(
    "copy docker compose tooling",
    {
      connection,
      create: pulumi.interpolate`echo '${docker_compose_tooling}' > ~/docker-compose.tooling.yaml`,
    },
    { dependsOn: createToolingFolders },
  );

  // SCP commands to copy necessary tooling data files to the server
  const scpToolingDataDozzle = new command.remote.Command(
    "copy dozzle users file",
    {
      connection,
      create: pulumi.interpolate`echo '${dozzleUsers}' > ~/tooling/data/dozzle/users.yaml`,
    },
    { dependsOn: createToolingFolders },
  );

  const scpToolingDataShepherd = new command.remote.Command(
    "copy shepherd config",
    {
      connection,
      create: pulumi.interpolate`echo '${shepherdConfig}' > ~/tooling/data/shepherd/shepherd-config.yaml`,
    },
    { dependsOn: createToolingFolders },
  );

  const scpCaddyFile = new command.remote.Command(
    "copy caddy file",
    {
      connection,
      create: pulumi.interpolate`echo '${caddyFile}' > ~/tooling/data/caddy/Caddyfile`,
    },
    { dependsOn: createToolingFolders },
  );

  const scpBinRestoreBackups = new command.remote.Command(
    "copy restore backup script",
    {
      connection,
      create: pulumi.interpolate`echo '${restoreBackupScript}' > ~/bin/restoreBackup.js`,
    },
    { dependsOn: createToolingFolders },
  );

  const scpBinBackupData = new command.remote.Command(
    "copy backup data script",
    {
      connection,
      create: pulumi.interpolate`echo '${backupDataScript}' > ~/bin/backupData.js`,
    },
    { dependsOn: createToolingFolders },
  );

  const scpBinUploadToS3 = new command.remote.Command(
    "copy upload to S3 script",
    {
      connection,
      create: pulumi.interpolate`echo '${uploadToS3Script}' > ~/bin/uploadToS3.js`,
    },
    { dependsOn: createToolingFolders },
  );

  const setPermissionsAndCronJob = new command.remote.Command(
    "set permissions and cron job",
    {
      connection,
      create: `
      chown codigo:codigo /home/codigo/bin/*
      chmod +x /home/codigo/bin/*

      # Set up cron jobs
      (crontab -u codigo -l 2>/dev/null; echo "0 */12 * * * /home/codigo/.nvm/versions/node/$(su - codigo -c 'nvm current')/bin/node /home/codigo/bin/backupData.js") | crontab -u codigo -
      (crontab -u codigo -l 2>/dev/null; echo "30 */12 * * * /home/codigo/.nvm/versions/node/$(su - codigo -c 'nvm current')/bin/node /home/codigo/bin/uploadToS3.js") | crontab -u codigo -
    `,
    },
    { dependsOn: [scpBinRestoreBackups, scpBinBackupData, scpBinUploadToS3] },
  );
}
