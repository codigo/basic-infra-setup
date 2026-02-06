# Platform/Application Separation — Completed

## Summary

The blog application (mau-app) has been fully separated from the infrastructure services. Each layer has clear ownership:

- **services/** (this repo): Shared platform — VPS, Docker Swarm, Caddy, Cloudflare tunnels, Dozzle, backups
- **mau-app/app/**: Application layer — deploys its own containers via GitHub Actions

## What Changed

### Removed from services/

- `docker-compose.mau-app.yaml` — mau-app now has its own `docker-compose.yml`
- `mau-app/` directory (PocketBase entrypoint, data gitkeeps) — mau-app manages its own PocketBase config
- `infra/serverCopyMauAppFiles.ts` — mau-app creates its own directories during deployment
- mau-app stack deployment from `infra/deployDockerStacks.ts` — only tooling stack is deployed
- container-updater route from Caddyfile — no longer needed

### mau-app now handles

- Creating PocketBase data directories on VPS (`mkdir -p` in GitHub Actions)
- Copying PocketBase migrations to VPS (`scp` in GitHub Actions)
- Deploying its own Docker stack (`docker stack deploy` via Docker context)
- Connecting to the existing `caddy_net` overlay network

## How It Works

```
services/ (pulumi up — runs rarely)
    → Provisions VPS
    → Sets up Docker Swarm + caddy_net
    → Deploys Caddy, Cloudflare tunnels, Dozzle

mau-app/ (push to main — runs on every merge)
    → Builds Docker image
    → SSHs to VPS, creates data dirs, copies migrations
    → docker stack deploy (connects to existing caddy_net)
```

## Adding a New Application

1. In the app repo: Create `docker-compose.yml` connecting to `caddy_net`
2. In services/: Add Caddy routes to `tooling/data/caddy/Caddyfile`
3. Run `pulumi up` to update Caddyfile on VPS
