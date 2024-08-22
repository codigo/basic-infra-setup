import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import { Server } from "@pulumi/hcloud";


export function configureServer(server: pulumi.Output<Server>, publicIp: pulumi.Output<string>) {
  const config = new pulumi.Config();
  const mauAppTypeSenseKey = config.requireSecret("mauAppTypeSenseKey");
  const mauAppPBEncryptionKey = config.requireSecret("mauAppPBEncryptionKey");
  const sshPrivateKey = config.requireSecret("sshPrivateKey");

// Install Docker
  const installDocker = new command.remote.Command("installDocker", {
    connection: {
      host: publicIp,
      user: "root",
      privateKey: sshPrivateKey,
    },
    create: `
              apt-get update
              apt-get install -y apt-transport-https ca-certificates curl software-properties-common
              curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
              add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
              apt-get update
              apt-get install -y docker-ce
              usermod -aG docker codigo
          `,
  });

  // Initialize Docker Swarm
  const initDockerSwarm = new command.remote.Command("initDockerSwarm", {
    connection: {
      host: publicIp,
      user: "codigo",
      privateKey: sshPrivateKey,
    },
    create: "docker swarm init",
  }, { dependsOn: installDocker });

  // Create Docker networks
  const createNetworks = new command.remote.Command("createNetworks", {
    connection: {
      host: publicIp,
      user: "codigo",
      privateKey: sshPrivateKey,
    },
    create: `
      docker network create --driver overlay internal_net
      docker network create --driver overlay caddy_net
      docker network create --driver overlay dozzle
    `,
  }, { dependsOn: initDockerSwarm });

  // Set up Docker Swarm secrets
  const setupSecrets = new command.remote.Command("setupSecrets", {
    connection: {
      host: publicIp,
      user: "codigo",
      privateKey: sshPrivateKey,
    },
    create: `
      echo "${mauAppTypeSenseKey}" | docker secret create mau-app_typesense_api_key -
      echo "${mauAppPBEncryptionKey}" | docker secret create mau-app_pb_encryption_key -
    `,
  }, { dependsOn: createNetworks });

}
