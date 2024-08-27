import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import { Server } from "@pulumi/hcloud";

export const deployDockerStacks = (server: Server) => {
  const config = new pulumi.Config();

  const encodedSshPrivateKey = config.requireSecret("sshPrivateKey");

  const MAUAPPDOCKERCOMPOSE = "/home/codigo/docker-compose.mau-app.yaml";
  const TOOLINGDOCKERCOMPOSE = "/home/codigo/docker-compose.tooling.yaml";

  const sshPrivateKey = pulumi
    .all([encodedSshPrivateKey])
    .apply(([encoded]) => Buffer.from(encoded, "base64").toString("utf-8"));

  // SSH command to initialize Docker swarm and deploy docker stacks
  const deployDockerStacks = new command.remote.Command("deployDockerStacks", {
    connection: {
      host: server.ipv4Address,
      user: "codigo",
      privateKey: sshPrivateKey,
    },
    create: `
      # Deploy Docker stacks
      docker stack deploy -c /home/codigo/${MAUAPPDOCKERCOMPOSE} mau-app
      docker stack deploy -c /home/codigo/${TOOLINGDOCKERCOMPOSE} tooling
    `,
  });

  deployDockerStacks.stdout.apply((stdout) => {
    if (stdout) console.log("deployDockerStacks stdout:", stdout);
  });
  deployDockerStacks.stderr.apply((stderr) => {
    if (stderr) console.error("deployDockerStacks stderr:", stderr);
  });

  return {
    deployDockerStacksResult: deployDockerStacks,
  };
};
