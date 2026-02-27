import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import { Server } from "@pulumi/hcloud";

export const setupDockerInServer = (server: Server) => {
  const config = new pulumi.Config();
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
  const installDocker = new command.remote.Command(
    "installDocker",
    {
      connection,
      create: `
      sudo apt-get update
      sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
      curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
      echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
      sudo apt-get update
      sudo apt-get install -y docker-ce
      sudo groupadd docker || true
      sudo usermod -aG docker codigo
      sudo systemctl enable docker
      sudo systemctl start docker
    `,
    },
    { ignoreChanges: ["connection", "create"] },
  );

  // Initialize Docker Swarm
  const initDockerSwarm = new command.remote.Command(
    "initDockerSwarm",
    {
      connection,
      create: `
        # Check if node is already part of a swarm and if it's a manager
        SWARM_STATUS=$(docker info --format '{{.Swarm.LocalNodeState}}')
        IS_MANAGER=$(docker info --format '{{.Swarm.ControlAvailable}}')

        if [ "$SWARM_STATUS" != "active" ]; then
          echo "Initializing Docker Swarm..."
          docker swarm init
        elif [ "$IS_MANAGER" != "true" ]; then
          echo "Node is part of a swarm but not a manager. Leaving swarm and reinitializing..."
          docker swarm leave -f
          docker swarm init
        else
          echo "Node is already a swarm manager."
        fi
      `,
    },
    { dependsOn: installDocker },
  );

  const getWorkerToken = new command.remote.Command(
    "getWorkerToken",
    {
      connection,
      create: `
        # Capture join token for workers without echoing
        docker swarm join-token -q worker > /tmp/worker_token
        cat /tmp/worker_token
        rm /tmp/worker_token
      `,
    },
    { dependsOn: initDockerSwarm },
  );

  // Create Docker networks
  const createDockerNetworks = new command.remote.Command(
    "createDockerNetworks",
    {
      connection,
      create: `
        # Create networks if they don't exist
        if ! docker network ls | grep -q "internal_net"; then
          docker network create --driver overlay internal_net
        fi
        if ! docker network ls | grep -q "caddy_net"; then
          docker network create --driver overlay caddy_net
        fi
      `,
    },
    { dependsOn: getWorkerToken },
  );

  return {
    installDocker,
    initDockerSwarm,
    createDockerNetworks,
    workerJoinToken: pulumi.secret(getWorkerToken.stdout),
  };
};
