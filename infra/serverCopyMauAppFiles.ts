import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import { Server } from "@pulumi/hcloud";

export function copyMauAppDataFilesToServer(
  server: pulumi.Output<Server>,
  publicIp: pulumi.Output<string>,
) {
  // Define the server details and credentials
  const config = new pulumi.Config();
  const encodedSshPrivateKey = config.requireSecret("sshPrivateKey");
  const docker_compose_mau_app = config.require("docker_compose_mau_app");

  const sshPrivateKey = pulumi
    .all([encodedSshPrivateKey])
    .apply(([encoded]) => Buffer.from(encoded, "base64").toString("utf-8"));

  const commonSshOptions = pulumi
    .all([publicIp, sshPrivateKey])
    .apply(([ip, key]) => ({
      host: ip,
      user: "codigo", // Corrected property
      privateKey: key,
    }));

  // SCP commands to copy docker compose app string to the server
  const createMauAppFolders = new command.remote.Command(
    "create mau app data folders",
    {
      connection: commonSshOptions,
      create: pulumi.interpolate`
      mkdir -p /home/codigo/mau-app/data/pocketbase`,
    },
  );

  // SCP commands to copy docker compose tooling string to the server
  const scpDockerComposeTooling = new command.remote.Command(
    "scp docker compose tooling",
    {
      connection: commonSshOptions,
      create: pulumi.interpolate`echo '${docker_compose_mau_app}' > ~/docker-compose.mau-app.yaml`,
    },
    { dependsOn: createMauAppFolders },
  );
}
