import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import { Server } from "@pulumi/hcloud";

export function deployDockerStacks(
  server: pulumi.Output<Server>,
  publicIp: pulumi.Output<string>,
) {
  const config = new pulumi.Config();

  const encodedSshPrivateKey = config.requireSecret("sshPrivateKey");

  const sshPrivateKey = pulumi
    .all([encodedSshPrivateKey])
    .apply(([encoded]) => Buffer.from(encoded, "base64").toString("utf-8"));

  // SSH command to deploy docker stacks
  const deployDockerStacks = new command.remote.Command("deployDockerStacks", {
    connection: {
      host: publicIp,
      user: "codigo",
      privateKey: sshPrivateKey,
    },
    create: `
        docker stack deploy -c docker-compose.mau_app.yaml mau-app &&
        docker stack deploy -c docker-compose.tooling.yaml tooling
    `,
  });
}
