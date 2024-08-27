import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import { Server } from "@pulumi/hcloud";

export const configureServer = (server: Server) => {
  const config = new pulumi.Config();
  const mauAppTypeSenseKey = config.requireSecret("mauAppTypeSenseKey");
  const mauAppPBEncryptionKey = config.requireSecret("mauAppPBEncryptionKey");

  const encodedSshPrivateKey = config.requireSecret("sshPrivateKey");

  const sshPrivateKey = pulumi
    .all([encodedSshPrivateKey])
    .apply(([encoded]) => Buffer.from(encoded, "base64").toString("utf-8"));

  const connection = pulumi
    .all([server.ipv4Address, sshPrivateKey])
    .apply(([ip, key]) => ({
      host: ip,
      user: "codigo",
      privateKey: key,
    }));

  // Install Docker
  const installDocker = new command.remote.Command("installDocker", {
    connection,
    create: `
      sudo apt-get update
      sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
      curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
      sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
      sudo apt-get update
      sudo apt-get install -y docker-ce
      sudo usermod -aG docker codigo
    `,
  });

  // Initialize Docker Swarm
  const initDockerSwarm = new command.remote.Command(
    "initDockerSwarm",
    {
      connection,
      create: "docker swarm init",
    },
    { dependsOn: installDocker },
  );

  // Create Docker networks
  const createNetworks = new command.remote.Command(
    "createNetworks",
    {
      connection,
      create: `
        docker network create --driver overlay internal_net
        docker network create --driver overlay caddy_net
        docker network create --driver overlay dozzle
    `,
    },
    { dependsOn: initDockerSwarm },
  );

  // Set up Docker Swarm secrets
  const setupSecrets = new command.remote.Command(
    "setupSecrets",
    {
      connection,
      create: `
        echo "${mauAppTypeSenseKey}" | docker secret create mau-app_typesense_api_key -
        echo "${mauAppPBEncryptionKey}" | docker secret create mau-app_pb_encryption_key -
    `,
    },
    { dependsOn: createNetworks },
  );
};
