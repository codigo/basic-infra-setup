import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import { Server } from "@pulumi/hcloud";

export function copyMauAppDataFilesToServer(
  server: pulumi.Output<Server>,
  publicIp: pulumi.Output<string>,
) {
  // Define the server details and credentials
  const config = new pulumi.Config();
  const sshPrivateKey = config.requireSecret("sshPrivateKey");

  const connection = {
    host: publicIp,
    user: "codigo",
    privateKey: sshPrivateKey,
  };

  // SCP commands to copy docker compose app string to the server
  const createMauAppFolders = new command.remote.Command(
    "create mau app data folders",
    {
      connection,
      create: pulumi.interpolate`
      mkdir -p /home/codigo/mau-app/data/pocketbase &&
      mkdir -p /home/codigo/tooling/data/typesense
    `,
    },
  );

  // SCP commands to copy docker compose tooling string to the server
  const scpDockerComposeTooling = new command.remote.CopyToRemote(
    "scp docker compose tooling",
    {
      connection,
      source: new pulumi.asset.StringAsset(`docker_compose_mau_app`),
      remotePath: "~/docker-compose.mau-app.yaml",
    },
    { dependsOn: createMauAppFolders },
  );

  // Restore the pocketbase data
  const restoreMauAppData = new command.remote.Command(
    "restore pocketbase data",
    {
      connection,
      create: pulumi.interpolate`
      ~/bin/restoreBackup.js mau-app
    `,
    },
    { dependsOn: scpDockerComposeTooling },
  );
}
