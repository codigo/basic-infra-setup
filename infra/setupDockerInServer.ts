import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import { Server } from "@pulumi/hcloud";

export const setupDockerInServer = (server: Server) => {
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
      curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
      echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
      sudo apt-get update
      sudo apt-get install -y docker-ce
      sudo usermod -aG docker codigo
      sudo systemctl enable docker
      sudo systemctl start docker
    `,
  });

  // Initialize Docker Swarm and create networks
  const initDockerSwarmAndNetworks = new command.remote.Command(
    "initDockerSwarmAndNetworks",
    {
      connection,
      create: `
        # Check if node is already part of a swarm
        if ! docker info --format '{{.Swarm.LocalNodeState}}' | grep -q "active"; then
          echo "Initializing Docker Swarm..."
          docker swarm init
        else
          echo "Node is already part of a swarm."
        fi

        # Create networks if they don't exist
        if ! docker network ls | grep -q "internal_net"; then
          docker network create --driver overlay internal_net
        fi
        if ! docker network ls | grep -q "caddy_net"; then
          docker network create --driver overlay caddy_net
        fi
        if ! docker network ls | grep -q "dozzle"; then
          docker network create --driver overlay dozzle
        fi
      `,
    },
    { dependsOn: installDocker },
  );

  // Set up Docker Swarm secrets
  const setupSecrets = new command.remote.Command(
    "setupSecrets",
    {
      connection,
      create: `
        # Ensure we're in a swarm before creating secrets
        if docker info --format '{{.Swarm.LocalNodeState}}' | grep -q "active"; then
          # Remove existing secrets if they exist
          docker secret rm mau-app_typesense_api_key 2>/dev/null || true
          docker secret rm mau-app_pb_encryption_key 2>/dev/null || true

          # Create new secrets
          echo "${mauAppTypeSenseKey}" | docker secret create mau-app_typesense_api_key -
          echo "${mauAppPBEncryptionKey}" | docker secret create mau-app_pb_encryption_key -
          echo "Docker secrets created successfully."
        else
          echo "Error: Docker Swarm is not active. Cannot create secrets."
          exit 1
        fi
      `,
    },
    { dependsOn: initDockerSwarmAndNetworks },
  );

  return {
    installDocker,
    initDockerSwarmAndNetworks,
    setupSecrets,
  };
};
