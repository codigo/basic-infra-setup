# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the **shared platform layer** — a Pulumi + Ansible Infrastructure-as-Code (IaC) repository that provisions and manages the underlying infrastructure for all applications. It does NOT deploy application code; applications deploy themselves via their own CI/CD pipelines.

**Tech Stack:**

- **IaC:** Pulumi (TypeScript) for cloud provisioning, Ansible for server configuration
- **Cloud Providers:** AWS (S3, IAM), Hetzner Cloud, Cloudflare
- **Orchestration:** Docker Swarm
- **Monitoring:** Grafana, Prometheus, Loki, cAdvisor, node-exporter
- **CI/CD:** GitHub Actions
- **Runtime:** Node.js 24

## Platform/Application Separation

This repository follows a clear **platform/application separation** pattern:

```
┌─────────────────────────────────────────────────────────────────┐
│                    services/ (this repo)                        │
│                  (Shared Platform Layer)                        │
├─────────────────────────────────────────────────────────────────┤
│  • VPS provisioning + private network (Hetzner via Pulumi)     │
│  • Server configuration (Ansible roles)                        │
│  • Docker Swarm initialization + overlay networks              │
│  • Cloudflare Tunnels (cloudflared containers)                 │
│  • Caddy reverse proxy (routing)                               │
│  • Dozzle (log viewer)                                         │
│  • Infisical (secrets management)                              │
│  • Monitoring stack (Grafana, Prometheus, Loki)                │
│  • S3 backup infrastructure                                    │
└─────────────────────────────────────────────────────────────────┘
                    ↓ caddy_net / tooling_net (overlay networks)
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

| Concern              | Owner    | Notes                                                        |
| -------------------- | -------- | ------------------------------------------------------------ |
| VPS provisioning     | Pulumi   | Hetzner server, SSH key, private network, Cloudflare tunnels |
| Server configuration | Ansible  | User, SSH hardening, Docker, file copies                     |
| Docker Swarm setup   | Ansible  | Install, init swarm, create networks                         |
| Cloudflare Tunnels   | Pulumi   | DNS records, tunnel configs                                  |
| Caddy reverse proxy  | Ansible  | Routes configured via Caddyfile.j2 template                  |
| Monitoring           | Ansible  | Grafana, Prometheus, Loki, cAdvisor, node-exporter           |
| Backups              | Ansible  | S3 backup scripts and cron jobs                              |
| App containers       | App repo | Each app deploys its own containers                          |
| App deployment       | App repo | GitHub Actions → docker stack deploy                         |

## Commands

### Development

```bash
npm install                    # Install dependencies
npm run format                 # Format code with Prettier
```

### Pulumi Operations

```bash
pulumi preview                 # Preview infrastructure changes
pulumi up                      # Apply infrastructure changes
pulumi stack select codigo/mau-app/codigo-services
pulumi config                  # View configuration
```

### Ansible Operations

```bash
# Install Ansible + required collections
pip install ansible pyyaml
ansible-galaxy collection install -r ansible/requirements.yml

# Full server configuration (dry-run first)
ansible-playbook \
  -i ansible/inventory/production/hosts.yml \
  --private-key <(op read "op://Codigo/Hetzner VPS SSH Key (mau@codigo.sh)/ssh_private_key") \
  --check --diff \
  ansible/playbooks/site.yml

# Redeploy tooling stack only
ansible-playbook ... ansible/playbooks/deploy-tooling.yml

# Redeploy monitoring stack only
ansible-playbook ... ansible/playbooks/deploy-monitoring.yml
```

For local Ansible runs, export Category B secrets from Infisical or 1Password first:

```bash
eval $(infisical secrets export --projectId=8491de15-c5c4-4d67-aaf3-c4083161d824 \
  --env=prod --domain=https://locker.codigo.sh --format=dotenv)
```

### Local Development

Ensure you have:

- Node.js 24+ installed (version specified in `.nvmrc`)
- Pulumi CLI installed
- Ansible installed (`pip install ansible`)
- AWS credentials configured
- Hetzner Cloud API token
- Cloudflare API token
- 1Password CLI (`op`) for local SSH key access

## Architecture

### Deployment Flow (index.ts)

The main infrastructure deployment follows this flow:

1. **Parallel Cloud Provisioning** (Steps 1-4):
   - S3 bucket creation (`infra/s3.ts`)
   - IAM resources (`infra/iam.ts`)
   - Server provisioning + Hetzner private network (`infra/serverProvider.ts`, `infra/hetznerProvider.ts`)
   - Cloudflare Tunnels setup (`infra/cloudflare.ts`)

2. **Bootstrap** (Step 5 — `command.local.Command`):
   - Runs `ansible/playbooks/bootstrap.yml` as root (first-time only)
   - Creates `codigo` user, deploys SSH key

3. **Server Configuration** (Step 6 — `command.local.Command`):
   - Runs `ansible/playbooks/site.yml` as codigo
   - Applies all Ansible roles: base-server → docker → tooling-files → tooling-deploy → monitoring-config → monitoring-deploy

4. **Worker Token** (Step 7):
   - Reads Docker Swarm worker join token via SSH

### Ansible Roles

| Role                | Purpose                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| `base-server`       | User creation, SSH hardening, UFW firewall, fnm + Node.js, env vars                                        |
| `docker`            | Docker CE install, Swarm init, overlay networks (caddy_net, tooling_net, monitoring_net)                   |
| `tooling-files`     | Directories, Jinja2 templates (docker-compose.tooling.yaml, Caddyfile, dozzle users), backup scripts, cron |
| `tooling-deploy`    | Docker registry login + `docker stack deploy` tooling stack                                                |
| `monitoring-config` | Monitoring directories, Loki/Prometheus/Grafana config templates, monitoring compose template              |
| `monitoring-deploy` | `docker stack deploy` monitoring stack                                                                     |

### Docker Services

**Tooling Stack** (`docker-compose.tooling.yaml`) — managed by Ansible `tooling-files` + `tooling-deploy` roles:

- `caddy`: Reverse proxy
- `dozzle`: Web-based Docker log viewer
- `cloudflared-maumercado`, `cloudflared-codigo`: Cloudflare tunnel clients
- `infisical`: Self-hosted secrets management
- `infisical-db`: PostgreSQL for Infisical
- `infisical-redis`: Redis for Infisical

**Monitoring Stack** (`docker-compose.monitoring.yaml`) — managed by Ansible `monitoring-config` + `monitoring-deploy` roles:

- `loki`: Log aggregation (30-day retention)
- `prometheus`: Metrics collection (30-day TSDB retention)
- `grafana`: Dashboards and alerting (`grafana.codigo.sh`)
- `cadvisor`: Container resource metrics (global mode)
- `node-exporter`: Host-level metrics (global mode)

**Application Stacks** — managed by their own repos:

- `mau-app` stack: mau-app (SvelteKit) + PocketBase

### Docker Networks

Three overlay networks span the Docker Swarm:

| Network              | Purpose                                | Services                                                               |
| -------------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| `caddy_net`          | HTTP routing (Caddy → services)        | caddy, dozzle, cloudflared-\*, infisical, grafana, mau-app, pocketbase |
| `tooling_net`        | Internal tooling access (apps → tools) | infisical (+ any app needing direct tooling access)                    |
| `monitoring_net`     | Monitoring internal communication      | loki, prometheus, grafana, cadvisor, node-exporter                     |
| `infisical_internal` | DB isolation                           | infisical, infisical-db, infisical-redis                               |

### Caddy Routing

Routes are configured in `ansible/roles/tooling-files/templates/Caddyfile.j2`:

- `mau-app-codigo:3000` → codigo.sh, maumercado.com
- `pocketbase:8090` → pocketbase.codigo.sh
- `dozzle:8080` → dozzle.codigo.sh
- `infisical:8080` → locker.codigo.sh
- `grafana:3000` → grafana.codigo.sh

### Backup System

**Convention:** Any application that stores persistent data in `~/appname/data/` is automatically discovered and backed up.

**How it works:**

1. `backupData.js` finds all directories under `$HOME` with a `data/` subdirectory
2. For `tooling/`, it dumps Infisical Postgres and Redis before tarring
3. `uploadToS3.js` uploads new `.tar.gz` files to S3 (skips already uploaded)
4. S3 bucket has a 90-day lifecycle rule for automatic cleanup
5. Local backups older than 7 days are cleaned up

**Scripts** (in `bin/`, copied to server by Ansible `tooling-files` role):

- `backupData.js`, `uploadToS3.js`, `restoreAndCopyBackup.js`

**Cron schedule** (managed by Ansible `tooling-files` role):

- Backups: every 12 hours (0:00, 12:00)
- S3 uploads: every 12 hours at :30 (0:30, 12:30)

### CI/CD

**Deploy** (`.github/workflows/deploy-infrastructure.yaml`):

- Triggered on push to `main` (ignores docs/markdown)
- Installs Ansible + collections
- Sets Category A secrets in Pulumi config (cloud provider credentials)
- Passes Category B secrets as env vars (Ansible reads directly)
- Runs `pulumi up` → Pulumi provisions cloud → triggers Ansible

**Preview** (`.github/workflows/preview-infrastructure.yaml`):

- Triggered on pull requests
- Same setup as deploy but runs `pulumi preview`
- Posts results as PR comment

## Key Files

- `index.ts`: Main Pulumi program — cloud provisioning + Ansible trigger
- `infra/hetznerProvider.ts`: Hetzner VPS + SSH key + private network provisioning
- `infra/cloudflare.ts`: DNS records, tunnels, tunnel configs
- `infra/s3.ts`: S3 backup bucket with lifecycle rules
- `infra/iam.ts`: IAM user and access key for S3
- `ansible/`: All server configuration (roles, playbooks, inventory)
- `bin/*.js`: Backup and maintenance scripts (copied to server by Ansible)
- `Pulumi.yaml`: Pulumi project configuration
- `tsconfig.json`: TypeScript configuration

## Configuration & Secrets Management

### Two-Category Secrets Architecture

**Category A — Pulumi config (cloud provider credentials):**
Set via `pulumi config set` in CI/CD. Used by Pulumi providers to provision cloud resources.

- AWS credentials, Hetzner token, Cloudflare tokens/zone IDs, SSH public key

**Pulumi outputs handed off to Reporter via Infisical:**

- `hetznerPrivateNetworkId` → Reporter Infisical `production/infrastructure/HETZNER_PRIVATE_NETWORK_ID`
- `toolingPrivateIpOut` → Reporter Infisical `production/infrastructure/TOOLING_VPS_PRIVATE_IP`

**Category B — Direct env vars (Ansible-only secrets):**
Passed as environment variables on the `pulumi/actions` CI/CD step. Ansible reads them via `lookup('env', ...)` in `ansible/inventory/production/group_vars/all.yml`.

- Infisical bootstrap secrets (`INFISICAL_ENCRYPTION_KEY`, etc. — GitHub-only, circular dependency)
- Dozzle credentials (`DOZZLE_USERNAME`, `DOZZLE_PASSWORD`)
- Docker registry credentials (`DOCKER_REGISTRY`, `DOCKER_USERNAME`, `DOCKER_PASSWORD`)
- Grafana admin password (`GRAFANA_ADMIN_PASSWORD`)
- Backup directory (`BACKUP_DIR`)

### Infisical (locker.codigo.sh)

Secrets source of truth. Auto-syncs to GitHub repos via GitHub Sync:

**`codigo` project** (Production env → `basic-infra-setup` repo):

- AWS credentials, Hetzner/Cloudflare tokens, SSH keys
- Container registry credentials, Dozzle credentials
- Grafana admin password, Pulumi tokens

**`Reporter` project** (Production env → Reporter repo):

- ~44 secrets across `infrastructure/`, `auth/`, `services/`, `app/` folders
- CI/CD + runtime machine identities
- Pulumi handoff values from this repo (`HETZNER_PRIVATE_NETWORK_ID`, `TOOLING_VPS_PRIVATE_IP`)
- GitHub Sync enabled (infrastructure/ folder)

### GitHub-only Secrets (not in Infisical)

Bootstrap secrets for Infisical itself (circular dependency):

- `INFISICAL_ENCRYPTION_KEY`, `INFISICAL_AUTH_SECRET`, `INFISICAL_DB_PASSWORD`, `INFISICAL_SMTP_PASSWORD`

### GitHub Variables

- `CONTAINER_REGISTRY_URL` (`sjc.vultrcr.com`)
- `AWS_REGION` (`us-west-2`)
- `BACKUP_DIR` (`/home/codigo/DATA_BACKUP`)

### GitHub Secrets for Reporter Infisical Sync

- `REPORTER_INFISICAL_PROJECT_ID` (Reporter project ID for cross-repo handoff)
- `INFISICAL_SYNC_CLIENT_ID`
- `INFISICAL_SYNC_CLIENT_SECRET`

### 1Password Backup

All critical secrets are backed up in 1Password (`Codigo` vault):

- Hetzner VPS SSH Key
- Grafana Admin Password
- Dozzle credentials
- Infisical login credentials

## Important Implementation Details

### Pulumi → Ansible Trigger

`index.ts` uses `command.local.Command` to run `ansible-playbook`. Secrets are passed via `ANSIBLE_VAR_*` environment variables (Category A — Pulumi outputs) and direct env vars (Category B — CI/CD env). A Python script converts env vars to a YAML vars file that Ansible reads.

### Pulumi → Reporter Infisical Handoff

After `pulumi up`, the deploy workflow reads stack outputs and writes `HETZNER_PRIVATE_NETWORK_ID` and `TOOLING_VPS_PRIVATE_IP` into the Reporter Infisical project's `production/infrastructure` path using an Infisical machine identity. Reporter Pulumi and Ansible consume those values to attach the Reporter VPS to the same Hetzner network and point Loki log shipping at the tooling VPS private IP.

### Server Environment

- Ansible `base-server` role writes env vars to `.bashrc` via `blockinfile` (atomic replace)
- Server uses `fnm` (not `nvm`) for Node.js version management
- Cron jobs use `fnm exec --using=24 node` for Node.js path resolution

### Docker Setup

- Ansible `docker` role uses `community.docker.docker_swarm` (idempotent, no `ignoreChanges` needed)
- Overlay networks created via `community.docker.docker_network`
- Swarm worker join token read via SSH after configuration

### SSH Key

- Stored in: local machine (`~/code/codigo-projects/ssh-keys/id_rsa`), 1Password, Infisical
- Fingerprint: `SHA256:DYyfnWBzX6h1GSZu4a7Yv6Bx74ZhNuIWjEZupUDjyuw`
- CI/CD: written to `~/.ssh/id_rsa` by the "Setup SSH keys" workflow step
- Local: Ansible uses `op read` to pull from 1Password at runtime

## Security Notes

- Root SSH is disabled on servers
- Only `codigo` user can SSH (key-based authentication only)
- All services behind Cloudflare Tunnels (no direct port exposure)
- UFW firewall: deny 80/443 (traffic via tunnels only), allow 22/tcp
- Secrets in Infisical (source of truth) + 1Password (backup) + GitHub (synced)
- Infisical bootstrap secrets in GitHub only (circular dependency)
