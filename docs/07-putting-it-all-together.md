# Understanding the Mau App Infrastructure Project: Part 7 - Putting It All Together

In this final part, we'll tie together all the components we've discussed in the previous parts and see how they work in concert to create a robust, scalable, and secure infrastructure for our application.

## The Big Picture

Our infrastructure consists of several key components:

1. **Pulumi**: Manages our infrastructure as code.
2. **AWS S3**: Provides storage for backups.
3. **Hetzner Cloud**: Hosts our main server.
4. **Docker and Docker Swarm**: Containerizes and orchestrates our applications.
5. **Caddy**: Acts as a reverse proxy and handles SSL termination.
6. **Cloudflare**: Provides DNS management, DDoS protection, and acts as a global CDN.
7. **PocketBase**: Serves as our database and backend service.

Here's how these components interact:

1. Pulumi deploys and manages all our cloud resources, including the Hetzner server, AWS S3 bucket, and Cloudflare configuration.
2. On the Hetzner server, Docker Swarm orchestrates our containerized services.
3. Caddy runs as a Docker service and acts as the entry point for all HTTP/HTTPS traffic.
4. Cloudflare tunnels securely route internet traffic to our Caddy service.
5. Caddy then routes requests to the appropriate service (PocketBase).
6. PocketBase provides backend functionality to our main application.
7. AWS S3 is used for storing backups of our application data.

## Deployment Workflow

When we want to deploy or update our infrastructure:

1. We make changes to our Pulumi code.
2. We run `pulumi up`, which:
   - Creates/updates cloud resources as necessary.
   - Configures the Hetzner server.
   - Sets up Docker and Docker Swarm.
   - Deploys our Docker services.
3. Cloudflare automatically routes traffic to our new or updated infrastructure.

## Continuous Deployment

We use GitHub Actions for continuous deployment. The workflow is defined in `.github/workflows/deploy-infrastructure.yaml`. Here's a simplified overview:

1. When infrastructure changes are pushed to the main branch, the workflow is triggered (docs and markdown changes are ignored).
2. The workflow sets up Pulumi and configures necessary secrets and environment variables.
3. It then runs `pulumi up` to deploy infrastructure changes to the `codigo/services/prod` stack.

## Backup Strategy

We have a robust backup strategy in place:

1. Regular backups are created using the script in `bin/backupData.js`.
2. These backups are then uploaded to AWS S3 using the script in `bin/uploadToS3.js`.
3. We can restore backups using the script in `bin/restoreAndCopyBackup.js`.

These scripts are scheduled to run regularly using cron jobs.

## Security Considerations

Security is a top priority in our infrastructure:

1. **Cloudflare**: Provides DDoS protection and acts as a WAF (Web Application Firewall).
2. **Caddy**: Handles SSL/TLS termination, ensuring encrypted communication.
3. **Docker Secrets**: Sensitive information is managed securely using Docker secrets.
4. **Firewall**: The server's firewall is configured to only allow necessary incoming traffic.
5. **SSH**: Root SSH access is disabled, and we use key-based authentication.

## Scalability

Our infrastructure is designed with scalability in mind:

1. **Docker Swarm**: Allows us to easily scale our services by adjusting the number of replicas.
2. **Cloudflare**: Acts as a global CDN, improving performance and handling increased traffic.
3. **S3**: Provides virtually unlimited storage for our backups.

## Monitoring and Logging

We use Dozzle for log management, allowing us to easily view and analyze logs from all our Docker services.

## Conclusion

The Mau App Infrastructure project demonstrates a modern, scalable, and secure approach to deploying web applications. By leveraging infrastructure as code, containerization, and cloud services, we've created a robust platform that can be easily managed and scaled.

Key takeaways:

1. Infrastructure as Code (Pulumi) allows for version-controlled, reproducible infrastructure.
2. Containerization (Docker) provides consistency across development and production environments.
3. Reverse proxies (Caddy) simplify SSL management and request routing.
4. Cloud services (Cloudflare, AWS) enhance security, performance, and reliability.
5. Automated deployment (GitHub Actions) streamlines the development process.

By understanding and implementing these concepts, you can create powerful, scalable, and secure infrastructures for your own web applications.
