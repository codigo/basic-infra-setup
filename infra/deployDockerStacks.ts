import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import { Server } from "@pulumi/hcloud";

export const deployDockerStacks = (server: Server) => {
  const config = new pulumi.Config();

  const encodedSshPrivateKey = config.requireSecret("sshPrivateKey");
  const dockerUsername = config.requireSecret("dockerUsername");
  const dockerPassword = config.requireSecret("dockerPassword");
  const dockerRegistry = config.require("dockerRegistry");

  const TOOLINGDOCKERCOMPOSE = "docker-compose.tooling.yaml";

  const sshPrivateKey = pulumi
    .all([encodedSshPrivateKey])
    .apply(([encoded]) => Buffer.from(encoded, "base64").toString("utf-8"));

  // Deploy only the tooling stack (platform services).
  // Application stacks (e.g., mau-app) deploy themselves via their own CI/CD pipelines.
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

      # Function to deploy and debug a stack
      deploy_and_debug_stack() {
        local stack_name=$1
        local compose_file=$2

        echo "Deploying $stack_name stack..."
        docker stack deploy --with-registry-auth -d --compose-file $compose_file $stack_name

        echo "Waiting for $stack_name services to start..."
        sleep 30  # Allow time for services to start

        echo "Listing $stack_name stack services:"
        docker stack services $stack_name

        failed_services=$(docker stack services $stack_name --format "{{.Name}}: {{.Replicas}}" | grep "0/")
        if [ -n "$failed_services" ]; then
          echo "Warning: Some $stack_name services failed to start:"
          echo "$failed_services"
          echo "Checking service logs for errors:"
          echo "$failed_services" | cut -d':' -f1 | xargs -I {} docker service logs --tail 50 {}
        else
          echo "All $stack_name services started successfully."
        fi

        echo "Waiting before next operation..."
        sleep 10
      }

      # Deploy tooling stack (Caddy, Cloudflare tunnels, Dozzle)
      deploy_and_debug_stack "tooling" "${TOOLINGDOCKERCOMPOSE}"
    `,
  });
  return {
    deployDockerStacksResult: deployDockerStacks,
  };
};
