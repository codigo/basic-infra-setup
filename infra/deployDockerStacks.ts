import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import { Server } from "@pulumi/hcloud";

export const deployDockerStacks = (server: Server) => {
  const config = new pulumi.Config();

  const encodedSshPrivateKey = config.requireSecret("sshPrivateKey");

  const MAUAPPDOCKERCOMPOSE = 'docker-compose.mau-app.yaml';
  const TOOLINGDOCKERCOMPOSE = 'docker-compose.tooling.yaml';

  const sshPrivateKey = pulumi
    .all([encodedSshPrivateKey])
    .apply(([encoded]) => Buffer.from(encoded, "base64").toString("utf-8"));

  // SSH command to deploy docker stacks
  const deployDockerStacks = new command.remote.Command("deployDockerStacks", {
    connection: {
      host: server.ipv4Address,
      user: "codigo",
      privateKey: sshPrivateKey,
    },
    create: `
      docker stack deploy -c ${MAUAPPDOCKERCOMPOSE} mau-app
      docker stack deploy -c ${TOOLINGDOCKERCOMPOSE} tooling
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
