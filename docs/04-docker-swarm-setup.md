# Understanding the Mau App Infrastructure Project: Part 4 - Docker and Docker Swarm Setup

In this part, we'll dive into how we set up Docker and Docker Swarm on our Hetzner Cloud server. Docker allows us to containerize our applications, while Docker Swarm provides orchestration for managing these containers across multiple nodes (although in our case, we're using a single node).

## Server Configuration

Before we can set up Docker, we need to configure our server. This is done in `infra/serverConfig.ts`:

```typescript
export const configureServer = (server: Server) => {
  // ... SSH key setup ...

  // Create 'codigo' user and set up SSH
  const createUser = new command.remote.Command("createUser", {
    connection: commonSshOptions,
    create: pulumi.interpolate`
      # ... user creation and SSH setup commands ...
    `,
  });

  // Disable root SSH access
  const disableRootSSH = new command.remote.Command(
    "disableRootSSH",
    {
      connection: commonSshOptions,
      create: `
        # ... SSH configuration commands ...
      `,
    },
    { dependsOn: createUser },
  );

  // Install NVM and Node.js
  const installNode = new command.remote.Command(
    "install Node",
    {
      connection: commonSshOptions.apply((options) => ({
        ...options,
        user: "codigo",
      })),
      create: `
        # ... Node.js installation commands ...
      `,
    },
    {
      dependsOn: disableRootSSH,
    },
  );

  // ... firewall setup ...

  return {
    installNode,
    disableRootSSH,
    createUser,
    setupFirewall,
    server,
  };
};
```

This function sets up a new user, configures SSH access, installs Node.js, and sets up a firewall.

## Docker Installation and Swarm Setup

The Docker and Docker Swarm setup is handled in `infra/setupDockerInServer.ts`:

```typescript
export const setupDockerInServer = (server: Server) => {
  // ... configuration and connection setup ...

  // Install Docker
  const installDocker = new command.remote.Command("installDocker", {
    connection,
    create: `
      # ... Docker installation commands ...
    `,
  });

  // Initialize Docker Swarm
  const initDockerSwarm = new command.remote.Command(
    "initDockerSwarm",
    {
      connection,
      create: `
        # ... Docker Swarm initialization commands ...
      `,
    },
    { dependsOn: installDocker },
  );

  // Create Docker networks
  const createDockerNetworks = new command.remote.Command(
    "createDockerNetworks",
    {
      connection,
      create: `
        # ... Docker network creation commands ...
      `,
    },
    { dependsOn: getWorkerToken },
  );

  // Set up Docker Swarm secrets
  const setupSecrets = new command.remote.Command(
    "setupSecrets",
    {
      connection,
      create: pulumi
        .all([mauAppTypeSenseKey, mauAppPBEncryptionKey])
        .apply(([typeSenseKey, pbEncryptionKey]) => `
          # ... Docker secret creation commands ...
        `),
    },
    { dependsOn: createDockerNetworks },
  );

  return {
    installDocker,
    initDockerSwarm,
    createDockerNetworks,
    setupSecrets,
    workerJoinToken: pulumi.secret(getWorkerToken.stdout),
  };
};
```

This function installs Docker, initializes Docker Swarm, creates necessary Docker networks, and sets up Docker secrets.

## Docker Compose Files

We use Docker Compose files to define our services. Here's a snippet from `docker-compose.mau-app.yaml`:

```yaml
services:
  mau-app-codigo:
    image: "{{ CONTAINER_REGISTRY_URL }}/codigo/mau-app:latest"
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
    environment:
      DEBUG: "true"
      PUBLIC_LOG_LEVEL: "debug"
    ports:
      - "3000"
    networks:
      - internal_net
      - caddy_net

  # ... other services ...

networks:
  internal_net:
    driver: overlay
  caddy_net:
    external: true
```

This file defines our main application service and its configuration.

## Deploying Docker Stacks

Finally, we deploy our Docker stacks in `infra/deployDockerStacks.ts`:

```typescript
export const deployDockerStacks = (server: Server) => {
  // ... configuration setup ...

  const deployDockerStacks = new command.remote.Command("deployDockerStacks", {
    connection: {
      host: server.ipv4Address,
      user: "codigo",
      privateKey: sshPrivateKey,
    },
    create: pulumi.interpolate`
      # ... Docker login and stack deployment commands ...
    `,
  });

  return {
    deployDockerStacksResult: deployDockerStacks,
  };
};
```

This function logs into our Docker registry and deploys our Docker stacks.

## Next Steps

In the next part, we'll explore how we set up Caddy as a reverse proxy and handle SSL termination. We'll also look at how we integrate Cloudflare for additional security and performance benefits.

Understanding Docker and Docker Swarm is crucial for modern application deployment. It allows us to package our applications consistently and deploy them easily across different environments. The use of Docker Swarm provides simple orchestration capabilities, making it easier to manage our containerized applications.
