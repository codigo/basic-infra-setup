# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the **shared platform layer** — a Pulumi-based Infrastructure-as-Code (IaC) repository that provisions and manages the underlying infrastructure for all applications. It does NOT deploy application code; applications deploy themselves via their own CI/CD pipelines.

**Tech Stack:**

- **IaC:** Pulumi (TypeScript)
- **Cloud Providers:** AWS (S3, IAM), Hetzner Cloud, Cloudflare
- **Orchestration:** Docker Swarm
- **CI/CD:** GitHub Actions
- **Runtime:** Node.js 22

## Platform/Application Separation

This repository follows a clear **platform/application separation** pattern:

```
┌─────────────────────────────────────────────────────────────────┐
│                    services/ (this repo)                        │
│                  (Shared Platform Layer)                        │
├─────────────────────────────────────────────────────────────────┤
│  • VPS provisioning (Hetzner via Pulumi)                       │
│  • Docker Swarm initialization + caddy_net network             │
│  • Cloudflare Tunnels (cloudflared containers)                 │
│  • Caddy reverse proxy (routing + SSL)                         │
│  • Dozzle (log monitoring)                                     │
│  • S3 backup infrastructure                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    caddy_net (overlay network)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                Application Repos (deploy themselves)           │
├─────────────────────────────────────────────────────────────────┤
│  mau-app/:                                                     │
│    • mau-app container (SvelteKit)                             │
│    • PocketBase container (backend/CMS)                        │
│    • Deploys via GitHub Actions → docker stack deploy           │
│    • Connects to existing caddy_net                            │
└─────────────────────────────────────────────────────────────────┘
```

### Responsibility Boundaries

| Concern             | Owner       | Notes                                 |
| ------------------- | ----------- | ------------------------------------- |
| VPS provisioning    | `services/` | Pulumi creates Hetzner server         |
| Docker Swarm setup  | `services/` | Initializes swarm, creates networks   |
| Cloudflare Tunnels  | `services/` | Routes traffic without exposing ports |
| Caddy reverse proxy | `services/` | SSL termination, routing rules        |
| Caddy route config  | `services/` | Add routes when deploying new apps    |
| Log monitoring      | `services/` | Dozzle for all containers             |
| Backups             | `services/` | S3 backup scripts and cron            |
| App containers      | App repo    | Each app deploys its own containers   |
| App deployment      | App repo    | GitHub Actions → docker stack deploy  |
| DB migrations       | App repo    | Handled by app's deployment pipeline  |

### Adding a New Application

See the [README](./README.md#adding-a-new-application) for the full step-by-step guide covering app repo setup, Caddy routing, Cloudflare tunnel/DNS, and deployment.

## Commands

### Development

```bash
npm install                    # Install dependencies
npm run format                 # Format code with Prettier
```

### Pulumi Operations

```bash
pulumi preview                 # Preview infrastructure changes before applying
pulumi up                      # Apply infrastructure changes
pulumi stack select codigo/<app-name>/prod  # Switch stacks
pulumi config                  # View current configuration
pulumi config set <key> <value>             # Set config value
pulumi config set --secret <key> <value>    # Set secret config value
```

### Local Development

Ensure you have:

- Node.js 22+ installed (version specified in `.nvmrc`)
- Pulumi CLI installed
- AWS credentials configured
- Hetzner Cloud API token (if using Hetzner provider)
- Cloudflare API token (if working with tunnels)

## Architecture

### Deployment Flow (index.ts)

The main infrastructure deployment follows a dependency-ordered flow orchestrated in `index.ts`:

1. **Parallel Initial Setup** (Steps 1-4):
   - S3 bucket creation (`infra/s3.ts`)
   - IAM resources (`infra/iam.ts`)
   - Server provisioning via provider abstraction (`infra/serverProvider.ts`, `infra/hetznerProvider.ts`)
   - Cloudflare Tunnels setup (`infra/cloudflare.ts`)

2. **Server Configuration** (Step 5):
   - User creation, Node.js installation, SSH hardening (`infra/serverConfig.ts`)

3. **Environment Setup** (Step 6):
   - Configure environment variables and S3 access (`infra/setupEnvs.ts`)

4. **Docker Setup** (Step 7):
   - Install Docker, initialize Swarm, create networks, setup secrets (`infra/setupDockerInServer.ts`)

5. **File Transfer** (Step 8):
   - Copy tooling configurations to server (`infra/serverCopyToolingFiles.ts`)
   - Caddy, Dozzle, Cloudflared configs

6. **Stack Deployment** (Step 9):
   - Deploy tooling Docker stack via Swarm (`infra/deployDockerStacks.ts`)

All steps use `pulumi.all()` and `.apply()` to manage dependencies between resources.

### Server Provider Abstraction

The codebase uses a provider abstraction pattern allowing seamless switching between cloud providers:

- **Interface:** `infra/serverProvider.ts` defines the `ServerProvider` interface
- **Implementation:** `infra/hetznerProvider.ts` implements Hetzner Cloud provisioning
- **Usage:** Change provider by swapping the instantiation in `index.ts:15`

To add a new provider (e.g., DigitalOcean), implement the `ServerProvider` interface with a new class.

### Docker Services

**Tooling Stack** (`docker-compose.tooling.yaml`) — managed by this repo:

- `caddy`: Reverse proxy and automatic SSL
- `dozzle`: Web-based Docker log viewer
- `cloudflared-maumercado`, `cloudflared-codigo`: Cloudflare tunnel clients

**Application Stacks** — managed by their own repos:

- `mau-app` stack: mau-app (SvelteKit) + PocketBase — deployed by `mau-app/app/` repo

All services run on Docker Swarm with `caddy_net` overlay network for inter-service communication.

### Caddy Routing

Routes are configured in `tooling/data/caddy/Caddyfile`:

- `mau-app-codigo:3000` → codigo.sh, maumercado.com
- `pocketbase:8090` → pocketbase.codigo.sh (admin UI)
- `dozzle:8080` → dozzle.codigo.sh (monitoring)

When adding a new application, add its route here and deploy via `pulumi up`.

### Backup System

Three backup scripts in `bin/`:

- `backupData.js`: Create backups of application data
- `uploadToS3.js`: Upload backups to S3 bucket
- `restoreAndCopyBackup.js`: Restore backups from S3

These are configured as cron jobs on the server via `infra/serverCopyToolingFiles.ts`.

### CI/CD

**GitHub Actions** (`.github/workflows/deploy-infrastructure.yaml`):

- Triggered via `repository_dispatch` event with type `deploy-application`
- Processes configuration file templates (replaces `{{ VAR }}` placeholders with secrets)
- Configures Pulumi with all required secrets and configurations
- Executes `pulumi up` to deploy infrastructure

**Configuration Management:**
Secrets and configs are stored in GitHub and loaded into Pulumi config during deployment. The workflow processes template variables in Docker Compose and config files before deployment.

## Key Files

- `index.ts`: Main Pulumi program, orchestrates all infrastructure
- `infra/*.ts`: Modular infrastructure components
- `docker-compose.tooling.yaml`: Platform services definition (template)
- `tooling/data/caddy/Caddyfile`: Caddy routing configuration
- `Pulumi.yaml`: Pulumi project configuration
- `tsconfig.json`: TypeScript configuration with strict mode
- `bin/*.js`: Backup and maintenance scripts

## Configuration

All configuration is managed through Pulumi config and GitHub secrets. Configuration values are set during GitHub Actions deployment and include:

- AWS credentials and region
- Docker registry credentials
- SSH keys (base64 encoded)
- Cloudflare API tokens and tunnel configurations
- Docker Compose file contents
- Backup scripts

Use `pulumi config` to view/modify configuration locally.

## Security Notes

- Root SSH is disabled on servers
- Only `codigo` user can SSH (key-based authentication)
- All services behind Cloudflare Tunnels (no direct port exposure)
- Secrets stored in GitHub and Pulumi config (encrypted)
