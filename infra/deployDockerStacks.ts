import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import { Server } from "@pulumi/hcloud";

export const deployDockerStacks = (server: Server) => {
  const config = new pulumi.Config();

  const encodedSshPrivateKey = config.requireSecret("sshPrivateKey");
  const dockerUsername = config.requireSecret("dockerUsername");
  const dockerPassword = config.requireSecret("dockerPassword");
  const dockerRegistry = config.require("dockerRegistry");

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
    create: pulumi.interpolate`
      # Deploy Docker stacks
      cd /home/codigo
      echo ${dockerPassword} | docker login https://${dockerRegistry} -u ${dockerUsername} --password-stdin
      docker stack deploy --with-registry-auth -d --compose-file ${TOOLINGDOCKERCOMPOSE} tooling
      sleep 10  # Add a 10-second delay
      docker stack deploy --with-registry-auth -d --compose-file ${MAUAPPDOCKERCOMPOSE} mau-app
    `,
  });
  return {
    deployDockerStacksResult: deployDockerStacks,
  };
};
