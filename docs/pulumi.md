# Pulumi Setup in This Project

This project leverages Pulumi, an infrastructure as code (IaC) tool, to manage and deploy cloud resources. Pulumi allows you to define your infrastructure using familiar programming languages, in this case, TypeScript. This README will guide you through the setup, functionality, and workflow of Pulumi in this project.

## Overview

Pulumi is used in this project to automate the deployment and management of cloud infrastructure across multiple providers, including AWS, Hetzner Cloud, and Cloudflare. The setup involves creating and configuring servers, setting up Docker environments, managing cloud resources like S3 buckets and IAM roles, and configuring DNS and tunnels with Cloudflare.

## Key Components

### 1. **S3 Bucket Creation**

- **File:** `infra/s3.ts`
- **Purpose:** Creates an S3 bucket on AWS to store backups.
- **Configuration:** The bucket is named `codigo-backups` and is configured with private access and force destruction enabled.

### 2. **IAM Resources**

- **File:** `infra/iam.ts`
- **Purpose:** Sets up IAM resources, including a user and access keys, to manage permissions for accessing AWS services.
- **Configuration:** An IAM user is created with a policy that allows actions like `s3:PutObject`, `s3:GetObject`, etc., on specific S3 buckets.

### 3. **Hetzner Server Setup**

- **File:** `infra/hetznerProvider.ts`
- **Purpose:** Implements the `ServerProvider` interface to provision a server on Hetzner Cloud.
- **Configuration:** A server is created with a specific type and image, and SSH keys are configured for secure access.

### 4. **Server Configuration**

- **File:** `infra/serverConfig.ts`
- **Purpose:** Configures the server by setting up users, SSH access, and installing necessary software like Node.js.
- **Configuration:** A user named `codigo` is created, SSH access is configured, and Node.js is installed using NVM.

### 5. **Docker Setup**

- **File:** `infra/setupDockerInServer.ts`
- **Purpose:** Installs Docker and sets up Docker Swarm on the server.
- **Configuration:** Docker is installed, Docker Swarm is initialized, and necessary Docker networks and secrets are created.

### 6. **File Copying**

- **Files:** `infra/serverCopyToolingFiles.ts`, `infra/serverCopyMauAppFiles.ts`
- **Purpose:** Copies necessary configuration and data files to the server.
- **Configuration:** Docker Compose files and other necessary scripts are copied to the server for both the Mau App and tooling.

### 7. **Docker Stack Deployment**

- **File:** `infra/deployDockerStacks.ts`
- **Purpose:** Deploys Docker stacks using the copied Docker Compose files.
- **Configuration:** Docker stacks for the Mau App and tooling are deployed, and services are monitored for successful startup.

### 8. **Cloudflare Tunnels and DNS**

- **File:** `infra/cloudflare.ts`
- **Purpose:** Sets up Cloudflare tunnels and DNS records for secure and efficient routing.
- **Configuration:** Tunnels are created for domains, and DNS records are configured to route traffic through these tunnels.

## Workflow

1. **Initialization:** Pulumi initializes the project and reads configuration from `Pulumi.yaml` and environment variables.

2. **Resource Creation:** Resources are created in parallel, including S3 buckets, IAM resources, Hetzner servers, and Cloudflare tunnels.

3. **Server Configuration:** The server is configured with necessary users, SSH keys, and software installations.

4. **Docker Setup:** Docker is installed, and Docker Swarm is initialized on the server.

5. **File Copying:** Configuration and data files are copied to the server to prepare for application deployment.

6. **Docker Stack Deployment:** Docker stacks are deployed, and services are monitored for successful startup.

7. **Cloudflare Configuration:** Cloudflare tunnels and DNS records are set up to ensure secure and efficient routing.

## How It Works

- **Pulumi Program:** The Pulumi program is written in TypeScript and defines the infrastructure using Pulumi's SDKs for AWS, Hetzner, and Cloudflare.
- **Configuration Management:** Pulumi uses configuration files and environment variables to manage secrets and other configuration details securely.
- **Deployment:** Pulumi CLI is used to deploy the infrastructure. It translates the TypeScript code into API calls to the respective cloud providers, creating and managing resources as defined in the code.

## Conclusion

This Pulumi setup automates the deployment and management of a complex cloud infrastructure, ensuring consistency, repeatability, and scalability. By using Pulumi, the project benefits from the power of modern programming languages to define infrastructure, making it easier to manage and extend over time.
