# Infisical Self-Hosted — Migration Plan

Status: **Planned**

## Goal

Add self-hosted Infisical as a secret management layer. Primary win: single source of truth for secrets with visibility, audit trail, and versioning. GitHub Actions secrets are write-only with no history — Infisical fixes that.

## Architecture

Infisical runs as 3 containers added to the tooling stack on the existing Hetzner VPS:

| Container | Image | Purpose |
|-----------|-------|---------|
| `infisical` | `infisical/infisical:<pin-version>` | Web UI + API (port 8080 internal) |
| `infisical-db` | `postgres:14-alpine` | Stores encrypted secrets, users, projects |
| `infisical-redis` | `redis` | Caching and job queue |

Minimum resources: ~2 GB RAM, 2 CPU cores for all three containers.

### Network Integration

```text
Cloudflare Tunnel → Caddy → infisical:8080
                          (on caddy_net overlay network)
```

- Add `secrets.codigo.sh` (or similar) subdomain
- Add Caddy route in `tooling/data/caddy/Caddyfile`
- Add DNS record + tunnel ingress rule in `infra/cloudflare.ts`
- Postgres and Redis go on a private `infisical_internal` overlay network (NOT on `caddy_net`)

## Setup Steps

### 1. Add containers to `docker-compose.tooling.yaml`

Add `infisical`, `infisical-db`, and `infisical-redis` services. Key config:

- `ENCRYPTION_KEY` — `openssl rand -hex 16` (CRITICAL: if lost, all secrets are unrecoverable)
- `AUTH_SECRET` — `openssl rand -base64 32`
- `INFISICAL_DB_PASSWORD` — `openssl rand -base64 24`
- `SITE_URL` — `https://secrets.codigo.sh`
- `TELEMETRY_ENABLED` — `false`
- DB connection: `postgres://infisical:<password>@infisical-db:5432/infisical`
- Redis connection: `redis://infisical-redis:6379`

These three bootstrap secrets use the existing `{{ VAR }}` template replacement pattern in CI/CD, stored as GitHub Actions secrets.

### 2. Add Caddy route

In `tooling/data/caddy/Caddyfile`:

```caddyfile
@infisical host secrets.codigo.sh
handle @infisical {
    reverse_proxy infisical:8080 {
        header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}
        header_up X-Forwarded-Proto {http.request.header.X-Forwarded-Proto}
        header_up X-Forwarded-Host {http.request.host}
    }
}
```

### 3. Add Cloudflare tunnel ingress

In `infra/cloudflare.ts`, add `secrets.codigo.sh` to the codigo tunnel config and create a DNS CNAME record pointing to the tunnel.

### 4. Create server directories

Add to `serverCopyToolingFiles.ts` folder creation:

```bash
mkdir -p /home/codigo/tooling/data/infisical/postgres
mkdir -p /home/codigo/tooling/data/infisical/redis
```

### 5. Add to backup system

Add `/home/codigo/tooling/data/infisical/postgres` to `bin/backupData.js`. This is critical — losing this database means losing all stored secrets.

## Updating Infisical

1. Pin a specific version tag in the compose file (never use `latest`)
2. Check release notes at https://github.com/Infisical/infisical/releases
3. **Back up the Postgres volume first**
4. Update the image tag in `docker-compose.tooling.yaml`
5. Deploy via `pulumi up` — or on the server directly: `docker service update --image infisical/infisical:vX.Y.Z tooling_infisical`
6. Migrations run automatically on startup against Postgres

## Migration Strategy: GitHub Sync

Use Infisical's native GitHub Actions integration to sync secrets **into** GitHub Actions. This means:

- The existing CI/CD workflow (`deploy-infrastructure.yaml`) doesn't change at all — it still reads `${{ secrets.X }}`
- Infisical is the source of truth; GitHub is a read-only mirror
- If Infisical is temporarily down, deploys still work (secrets are already synced in GitHub)
- You manage secrets in the Infisical UI instead of the GitHub UI

### Secrets to migrate into Infisical

Currently set manually in GitHub repo settings:

| GitHub Secret | Purpose |
|---------------|---------|
| `AWS_ACCESS_KEY_ID` | S3 backup & Pulumi AWS access |
| `AWS_SECRET_ACCESS_KEY` | S3 backup & Pulumi AWS access |
| `HETZNER_CLOUD_KEY` | Hetzner Cloud API token |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| `CLOUDFLARE_CODIGO_ZONE_ID` | Cloudflare zone |
| `CLOUDFLARE_MAUMERCADO_ZONE_ID` | Cloudflare zone |
| `SSH_PRIVATE_KEY` | VPS SSH access (base64 encoded) |
| `SSH_PUBLIC_KEY` | VPS SSH access (base64 encoded) |
| `CONTAINER_REGISTRY_USERNAME` | Docker registry pull auth |
| `CONTAINER_REGISTRY_PASSWORD` | Docker registry pull auth |
| `DOCKER_REGISTRY_USERNAME` | Docker registry (template var) |
| `DOCKER_REGISTRY_PASSWORD` | Docker registry (template var) |
| `DOZZLE_PASSWORD` | Dozzle web UI auth |
| `DISCORD_WEBHOOK` | Notifications |
| `PULUMI_ACCESS_TOKEN` | Pulumi Cloud API |
| `PULUMI_CONFIG_PASSPHRASE` | Pulumi state encryption |
| `CLOUDFLARE_TUNNEL_SECRET` | Tunnel auth |

### Secrets that must stay in GitHub (bootstrap)

| Secret | Reason |
|--------|--------|
| `INFISICAL_ENCRYPTION_KEY` | Needed to start Infisical itself |
| `INFISICAL_AUTH_SECRET` | Needed to start Infisical itself |
| `INFISICAL_DB_PASSWORD` | Needed to start Infisical itself |

These create a circular dependency — Infisical can't serve its own bootstrap secrets.

## What does NOT change

These runtime secrets are consumed at deploy time via Pulumi SSH or template replacement. The GitHub sync approach means no code changes are needed:

| Item | Current mechanism | Why unchanged |
|------|-------------------|---------------|
| Cloudflared tunnel tokens | `{{ VAR }}` in compose → replaced at CI time | GitHub sync covers this |
| AWS creds in `.bashrc` | Written by `setupEnvs.ts` via Pulumi SSH | GitHub sync covers this |
| Dozzle `users.yaml` | `{{ VAR }}` replaced at CI time | GitHub sync covers this |
| Docker registry login | `deployDockerStacks.ts` via Pulumi SSH | GitHub sync covers this |

## Future Improvements (optional, not part of initial setup)

- **Backup scripts via `infisical run`**: Change cron jobs to `infisical run -- node /home/codigo/bin/uploadToS3.js` so AWS creds are fetched at runtime instead of persisted in `.bashrc`. Requires Infisical CLI on host + machine identity.
- **Application-level secrets**: `mau-app` could use the Infisical SDK to fetch secrets at runtime instead of passing them via Docker env vars.
- **Secret rotation**: Automatic rotation for AWS keys and registry credentials via Infisical workflows.
