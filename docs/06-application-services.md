# Understanding the Mau App Infrastructure Project: Part 6 - Application Services

In this part, we'll explore how we set up and configure our main application services: PocketBase for database management and Typesense for search functionality.

## PocketBase Setup

PocketBase is an open-source backend for your next SaaS and Mobile app in 1 file. Here's how we set it up:

1. **Docker Compose Configuration**: PocketBase is defined as a service in `docker-compose.mau-app.yaml`:

   ```yaml
   services:
     pocketbase:
       image: ghcr.io/muchobien/pocketbase:latest
       deploy:
         replicas: 1
         restart_policy:
           condition: on-failure
       entrypoint: ["/bin/sh", "/run/entrypoint.sh"]
       volumes:
         - /home/codigo/mau-app/data/pocketbase/pb_data:/pb_data
         - /home/codigo/mau-app/data/pocketbase/pb_public:/pb_public
         - /home/codigo/mau-app/data/pocketbase/pb_migrations:/pb_migrations
       networks:
         - internal_net
         - caddy_net
       secrets:
         - mau-app_pb_encryption_key
       configs:
         - source: mau-app_pocketbase_entrypoint
           target: /run/entrypoint.sh
           mode: 0755
   ```

2. **Entrypoint Script**: We use a custom entrypoint script for PocketBase (`mau-app/bin/pocketbase/entrypoint.sh`):

   ```shell
   #!/bin/sh
   ENCRYPTION_KEY=$(cat /run/secrets/mau-app_pb_encryption_key)
   exec pocketbase serve --dir /pb_data --publicDir /pb_public --migrationsDir /pb_migrations --encryptionEnv ${ENCRYPTION_KEY} --http=0.0.0.0:8090 --hooksDir=/pb_hooks
   ```

   This script reads the encryption key from a Docker secret and starts PocketBase with the appropriate configuration.

## Typesense Setup

Typesense is a fast, typo-tolerant search engine. Here's how we set it up:

1. **Docker Compose Configuration**: Typesense is also defined in `docker-compose.mau-app.yaml`:

   ```yaml
   services:
     typesense:
       image: typesense/typesense:27.0
       deploy:
         replicas: 1
         restart_policy:
           condition: on-failure
       entrypoint: ["/bin/sh", "/run/entrypoint.sh"]
       volumes:
         - /home/codigo/mau-app/data/typesense:/data
       networks:
         - internal_net
         - caddy_net
       secrets:
         - mau-app_typesense_api_key
       configs:
         - source: mau-app_typesense_entrypoint
           target: /run/entrypoint.sh
           mode: 0755
   ```

2. **Entrypoint Script**: We use a custom entrypoint script for Typesense (`mau-app/bin/typesense/entrypoint.sh`):

   ```shell
   #!/bin/sh
   TOKEN=$(cat /run/secrets/mau-app_typesense_api_key)
   exec /opt/typesense-server --data-dir /data --api-key "$TOKEN"
   ```

   This script reads the API key from a Docker secret and starts Typesense with the appropriate configuration.

## Secrets Management

We use Docker secrets to manage sensitive information:

```typescript
const setupSecrets = new command.remote.Command(
  "setupSecrets",
  {
    connection,
    create: pulumi
      .all([mauAppTypeSenseKey, mauAppPBEncryptionKey])
      .apply(([typeSenseKey, pbEncryptionKey]) => `
        # Create new secrets
        echo "${typeSenseKey}" | docker secret create mau-app_typesense_api_key -
        echo "${pbEncryptionKey}" | docker secret create mau-app_pb_encryption_key -
      `),
  },
  { dependsOn: createDockerNetworks },
);
```

This command creates Docker secrets for the Typesense API key and PocketBase encryption key.

## Networking

Both services are connected to two Docker networks:

- `internal_net`: An overlay network for internal communication between services.
- `caddy_net`: An external network that allows these services to communicate with Caddy.

## Benefits of This Setup

1. **Isolation**: Each service runs in its own container, providing isolation and making it easier to manage dependencies.
2. **Scalability**: Docker Swarm allows us to easily scale these services if needed.
3. **Security**: Sensitive information is managed using Docker secrets, enhancing security.
4. **Persistence**: Data is persisted using Docker volumes, ensuring data survives container restarts.

## Next Steps

In the next and final part, we'll tie everything together and discuss how all these components work in concert to create a robust, scalable, and secure infrastructure for our application. We'll also touch on some advanced topics like backup strategies and continuous deployment.

Understanding how to set up and configure application services like PocketBase and Typesense is crucial for building modern web applications. This setup provides a solid foundation for data management and search functionality, while leveraging the benefits of containerization and orchestration.
