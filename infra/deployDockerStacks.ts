import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import { Server } from "@pulumi/hcloud";

export function deployDockerStacks(server: pulumi.Output<Server>, publicIp: pulumi.Output<string>) {

  const config = new pulumi.Config();
  const sshPrivateKey = config.requireSecret("sshPrivateKey");

// SSH command to deploy docker stacks
const deployDockerStacks = new command.remote.Command("deployDockerStacks", {
  connection: {
    host: publicIp,
    user: 'codigo',
    privateKey: sshPrivateKey,
  },
  create: `
        docker stack deploy -c docker-compose.mau_app.yaml mau-app &&
        docker stack deploy -c docker-compose.tooling.yaml tooling
    `,
  });

}
