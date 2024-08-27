import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import { Server } from "@pulumi/hcloud";

export const deployDockerStacks = (server: Server) => {
  const config = new pulumi.Config();

  const encodedSshPrivateKey = config.requireSecret("sshPrivateKey");
  const dockerUsername = config.requireSecret("dockerUsername");
  const dockerPassword = config.requireSecret("dockerPassword");

  const MAUAPPDOCKERCOMPOSE = "docker-compose.mau-app.yaml";
  const TOOLINGDOCKERCOMPOSE = "docker-compose.tooling.yaml";

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
      docker login -u ${dockerUsername} -p ${dockerPassword}
      docker stack deploy --with-registry-auth -d --compose-file ${MAUAPPDOCKERCOMPOSE} mau-app
      docker stack deploy --with-registry-auth -d --compose-file ${TOOLINGDOCKERCOMPOSE} tooling
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
