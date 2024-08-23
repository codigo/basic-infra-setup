import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import { Server } from "@pulumi/hcloud";

export function copyToolingDataFilesToServer(server: pulumi.Output<Server>, publicIp: pulumi.Output<string>) {

  // Define the server details and credentials
  const config = new pulumi.Config();
  const sshPrivateKey = config.requireSecret("sshPrivateKey");
  const dozzleUsers = config.require("users");
  const shepherdConfig = config.require("shepherd_config");
  const caddyFile = config.require("Caddyfile");

  const backupDataScript = config.require("backupDataScript");
  const uploadToS3Script = config.require("uploadToS3Script");
  const restoreBackupScript = config.require("restoreBackupScript");

  const connection = {
    host: publicIp,
    user: "codigo",
    privateKey: sshPrivateKey,
  }

  // SCP commands to copy docker compose app string to the server
  const createToolingFolders = new command.remote.Command("create tooling data folders", {
    connection,
    create: pulumi.interpolate`
      mkdir -p /home/codigo/bin &&
      mkdir -p /home/codigo/tooling/data/caddy &&
      mkdir -p /home/codigo/tooling/data/dozzle &&
      mkdir -p /home/codigo/tooling/data/shepherd
    `,
  });

  // SCP commands to copy docker compose tooling string to the server
  const scpDockerComposeTooling = new command.remote.CopyToRemote("scp docker compose tooling", {
    connection,
    source: new pulumi.asset.StringAsset(`docker_compose_tooling`),
    remotePath: "~/docker-compose.tooling.yaml",
  }, { dependsOn: createToolingFolders });

  // SCP commands to copy necessary tooling data files to the server
  const scpToolingDataDozzle = new command.remote.CopyToRemote("scp tooling data dozzle", {
    connection,
    source: new pulumi.asset.StringAsset(dozzleUsers),
    remotePath: "~/tooling/data/dozzle/users.yaml",
  }, { dependsOn: createToolingFolders });

  const scpToolingDataShepherd = new command.remote.CopyToRemote("copy tooling data shepherd", {
    connection,
    source: new pulumi.asset.StringAsset(shepherdConfig),
    remotePath: "~/tooling/data/shepherd/shepherd-config.yaml",
  }, { dependsOn: createToolingFolders });

  const scpCaddyFile = new command.remote.CopyToRemote("copy caddyfile", {
    connection,
    source: new pulumi.asset.StringAsset(caddyFile),
    remotePath: "~/tooling/data/caddy/Caddyfile",
  }, { dependsOn: createToolingFolders });

  const scpBinRestoreBackups = new command.remote.CopyToRemote("copy restoreBackup", {
    connection,
    source: new pulumi.asset.StringAsset(restoreBackupScript),
    remotePath: "~/bin/restoreBackup.js",
  }, { dependsOn: createToolingFolders });

  const scpBinBackupData = new command.remote.CopyToRemote("copy backupData", {
    connection,
    source: new pulumi.asset.StringAsset(backupDataScript),
    remotePath: "~/bin/backupData.js",
  }, { dependsOn: createToolingFolders });

  const scpBinUploadToS3 = new command.remote.CopyToRemote("copy uploadToS3", {
    connection,
    source: new pulumi.asset.StringAsset(uploadToS3Script),
    remotePath: "~/bin/uploadToS3.js",
  }, { dependsOn: createToolingFolders });

  const setPermissionsAndCronJob = new command.remote.Command("set permissions and cron job", {
    connection,
    create: `
      chown codigo:codigo /home/codigo/bin/*
      chmod +x /home/codigo/bin/*

      # Set up cron jobs
      (crontab -u codigo -l 2>/dev/null; echo "0 */12 * * * /home/codigo/.nvm/versions/node/$(su - codigo -c 'nvm current')/bin/node /home/codigo/bin/backupData.js") | crontab -u codigo -
      (crontab -u codigo -l 2>/dev/null; echo "30 */12 * * * /home/codigo/.nvm/versions/node/$(su - codigo -c 'nvm current')/bin/node /home/codigo/bin/uploadToS3.js") | crontab -u codigo -
    `,
  }, { dependsOn: [scpBinRestoreBackups, scpBinBackupData, scpBinUploadToS3] });

}
