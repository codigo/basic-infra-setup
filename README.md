# Mau App Infrastructure

This repository contains the infrastructure-as-code and deployment configuration for Mau's application using Pulumi and GitHub Actions.

## Overview

- **Infrastructure**: AWS (S3, IAM) and Hetzner Cloud
- **Deployment**: Docker Swarm
- **CI/CD**: GitHub Actions
- **IaC Tool**: Pulumi (TypeScript)

## Key Components

- S3 buckets for application data and tooling
- IAM resources for S3 access
- Hetzner Cloud server
- Docker Swarm setup
- Automated backups to S3
- Monitoring and logging tools (Dozzle, Shepherd)
- Reverse proxy (Caddy)

## Project Structure

- `.github/workflows/`: Contains GitHub Actions workflow files for CI/CD
- `bin/`: Utility scripts for the project
- `infra/`: Pulumi infrastructure-as-code files
- `mau-app/`: Main application code and configuration
- `tooling/`: Additional tools and utilities for the project
- `docker-compose.mau-app.yaml`: Docker Compose file for the main application
- `docker-compose.tooling.yaml`: Docker Compose file for tooling services
- `index.ts`: Main entry point for Pulumi infrastructure code
- `Pulumi.yaml`: Pulumi project configuration

## Setup

1. Fork this repository
2. Set up required secrets in GitHub repository settings
3. Push to main branch or manually trigger GitHub Actions workflow

## Usage

- Push to `main` branch to trigger deployment
- Infrastructure and application deployment are fully automated

## Customization

- Modify Pulumi scripts (`*.ts` files) to change infrastructure
- Update Docker Compose files and configurations in GitHub secrets for application changes

## Maintenance

- Automated backups run every 12 hours
- Docker images are automatically updated (managed by Shepherd)

## Security

- Root SSH access is disabled
- Only `codigo` user can SSH into the server
- Sensitive data stored in GitHub secrets and Pulumi config

## Development

To work on this project locally:

1. Ensure you have Node.js and npm installed
2. Install Pulumi CLI
3. Run `npm install` to install dependencies
4. Use `pulumi preview` to check infrastructure changes before applying

For detailed setup instructions and troubleshooting, please refer to the project documentation.

## License

[MIT License](LICENSE)
