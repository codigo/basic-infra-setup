# Simplify Secrets Flow Plan

Status: **Planned**

## Goal

Remove Pulumi as the middleman for secrets that only Ansible needs. Instead of routing
Ansible-only secrets through `pulumi config set` → `index.ts` environment vars, the CI/CD
workflow passes them directly to Ansible. Pulumi config shrinks to cloud-provider-only
credentials.

---

## Current Flow (4 hops)

```
Infisical (codigo-infra project, prod env)
    ↓  GitHub Sync
GitHub Actions secrets (${{ secrets.X }})
    ↓  pulumi config set --secret (20+ commands)
Pulumi config (encrypted in Pulumi Cloud)
    ↓  ANSIBLE_VAR_* environment vars on command.local.Command
Ansible (reads via Python → YAML vars file)
```

## Target Flow

```
Infisical (codigo-infra project, prod env)
    ↓  GitHub Sync
GitHub Actions secrets (${{ secrets.X }})
    ↓  env: block on pulumi/actions step (direct)
Ansible (reads env vars, no Pulumi intermediary)
```

For Pulumi cloud-provider secrets (Category A), the flow stays the same.

---

## Secret Categories

### Category A — Pulumi keeps (cloud provider credentials)

These are read by Pulumi providers and **must** stay in `pulumi config`:

| Secret | Used by |
|--------|--------|
| `AWS_ACCESS_KEY_ID` | Pulumi AWS provider |
| `AWS_SECRET_ACCESS_KEY` | Pulumi AWS provider |
| `HETZNER_CLOUD_KEY` | Pulumi Hetzner provider (`hcloud:token`) |
| `CLOUDFLARE_API_TOKEN` | Pulumi Cloudflare provider |
| `CLOUDFLARE_ACCOUNT_ID` | `infra/cloudflare.ts` |
| `CLOUDFLARE_CODIGO_ZONE_ID` | `infra/cloudflare.ts` |
| `CLOUDFLARE_MAUMERCADO_ZONE_ID` | `infra/cloudflare.ts` |
| `SSH_PUBLIC_KEY` | Hetzner VPS provisioning + Ansible bootstrap |

### Category B — Ansible-only (remove from Pulumi config)

These are only used to configure the server and **do not need to go through Pulumi**:

| Secret | Ansible role | Template |
|--------|-------------|---------|
| `INFISICAL_ENCRYPTION_KEY` | tooling-files | `docker-compose.tooling.yaml.j2` |
| `INFISICAL_AUTH_SECRET` | tooling-files | `docker-compose.tooling.yaml.j2` |
| `INFISICAL_DB_PASSWORD` | tooling-files | `docker-compose.tooling.yaml.j2` |
| `INFISICAL_SMTP_PASSWORD` | tooling-files | `docker-compose.tooling.yaml.j2` |
| `DOZZLE_USERNAME` | tooling-files | `dozzle-users.yaml.j2` |
| `DOZZLE_PASSWORD` | tooling-files | `dozzle-users.yaml.j2` |
| `DOCKER_REGISTRY` | tooling-deploy | registry login |
| `DOCKER_USERNAME` | tooling-deploy | registry login |
| `DOCKER_PASSWORD` | tooling-deploy | registry login |
| `BACKUP_DIR` | base-server | `.bashrc` block |

### Special Case — Pulumi outputs (not GitHub secrets)

These come from Pulumi cloud-provider outputs, not Infisical. They must still flow through
Pulumi → Ansible since they don't exist until Pulumi runs:

| Value | Source |
|-------|--------|
| `TUNNEL_TOKEN_MAUMERCADO` | Cloudflare tunnel created by Pulumi |
| `TUNNEL_TOKEN_CODIGO` | Cloudflare tunnel created by Pulumi |
| `SERVER_IP` | Hetzner VPS created by Pulumi |
| `APP_BUCKET` | S3 bucket created by Pulumi |

---

## Pre-flight: Verify Infisical → GitHub Sync

Before implementing, confirm all Category B secrets are in Infisical `codigo` project
(`prod` env) and are syncing to GitHub Actions secrets. Run this check manually:

```bash
# List all secrets in the codigo-infra Infisical project
infisical secrets \
  --projectId=8491de15-c5c4-4d67-aaf3-c4083161d824 \
  --env=prod \
  --domain=https://locker.codigo.sh

# Cross-check: confirm these appear in GitHub Actions secrets
gh secret list --repo codigo/basic-infra-setup
```

Expected secrets in GitHub Actions after sync:
- `INFISICAL_ENCRYPTION_KEY`, `INFISICAL_AUTH_SECRET`, `INFISICAL_DB_PASSWORD`, `INFISICAL_SMTP_PASSWORD`
- `DOZZLE_USERNAME`, `DOZZLE_PASSWORD`
- `CONTAINER_REGISTRY_USERNAME`, `CONTAINER_REGISTRY_PASSWORD`
- (plus all existing: `AWS_*`, `HETZNER_*`, `CLOUDFLARE_*`, `SSH_*`, `PULUMI_*`)

---

## Changes Required

### 1. `index.ts` — Remove Category B env vars from `configure-server`

```typescript
// BEFORE: 20 ANSIBLE_VAR_* env vars
environment: {
  ANSIBLE_VAR_SERVER_IP:                serverIp,
  ANSIBLE_VAR_SSH_PUBLIC_KEY:           sshPublicKey,
  ANSIBLE_VAR_AWS_ACCESS_KEY_ID:        config.requireSecret("awsAccessKeyId"),
  ANSIBLE_VAR_INFISICAL_ENCRYPTION_KEY: config.requireSecret("infisicalEncryptionKey"),
  // ... 16 more
}

// AFTER: Only Pulumi-derived values (not available from env)
environment: {
  ANSIBLE_VAR_SERVER_IP:              serverIp,
  ANSIBLE_VAR_SSH_PUBLIC_KEY:         sshPublicKey,
  ANSIBLE_VAR_APP_BUCKET:             appBucketName,
  ANSIBLE_VAR_TUNNEL_TOKEN_MAUMERCADO: maumercadoTunnelToken,
  ANSIBLE_VAR_TUNNEL_TOKEN_CODIGO:    codigoTunnelToken,
}
```

Ansible reads Category B secrets directly from the process environment (set by CI/CD).

### 2. `ansible/roles/*/tasks/main.yml` — Read env vars where needed

For secrets that CI/CD passes as env vars (not `ANSIBLE_VAR_*`), Ansible reads them
using `lookup('env', ...)` in the role or via a separate `group_vars` file that sources
them:

```yaml
# ansible/inventory/production/group_vars/all.yml (additions)
infisical_encryption_key: "{{ lookup('env', 'INFISICAL_ENCRYPTION_KEY') }}"
infisical_auth_secret: "{{ lookup('env', 'INFISICAL_AUTH_SECRET') }}"
infisical_db_password: "{{ lookup('env', 'INFISICAL_DB_PASSWORD') }}"
infisical_smtp_password: "{{ lookup('env', 'INFISICAL_SMTP_PASSWORD') }}"
dozzle_username: "{{ lookup('env', 'DOZZLE_USERNAME') }}"
dozzle_password_hash: "{{ lookup('env', 'DOZZLE_PASSWORD') }}"
docker_registry: "{{ lookup('env', 'DOCKER_REGISTRY') }}"
docker_username: "{{ lookup('env', 'DOCKER_USERNAME') }}"
docker_password: "{{ lookup('env', 'DOCKER_PASSWORD') }}"
backup_dir: "{{ lookup('env', 'BACKUP_DIR') }}"
```

This keeps the roles clean — they reference variables by name, not by where they come from.

### 3. `deploy-infrastructure.yaml` + `preview-infrastructure.yaml` — Restructure

Remove Category B from `Configure Pulumi` step, add them as env vars on the deploy/preview step:

```yaml
- name: Configure Pulumi
  run: |
    pulumi stack select codigo/mau-app/codigo-services
    # Category A only — cloud provider credentials
    pulumi config set aws:region ${{ vars.AWS_REGION }}
    pulumi config set --secret awsAccessKeyId "${{ secrets.AWS_ACCESS_KEY_ID }}"
    pulumi config set --secret awsSecretAccessKey "${{ secrets.AWS_SECRET_ACCESS_KEY }}"
    pulumi config set --secret hcloud:token ${{ secrets.HETZNER_CLOUD_KEY }}
    cat ~/.ssh/id_rsa.pub | openssl base64 | tr -d '\n' | pulumi config set sshPublicKey --secret
    pulumi config set --secret cloudflareAccountId "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}"
    pulumi config set --secret cloudflareCodigoZoneId "${{ secrets.CLOUDFLARE_CODIGO_ZONE_ID }}"
    pulumi config set --secret cloudflareMaumercadoZoneId "${{ secrets.CLOUDFLARE_MAUMERCADO_ZONE_ID }}"
    pulumi config set --secret cloudflare:apiToken "${{ secrets.CLOUDFLARE_API_TOKEN }}"

- name: Deploy infrastructure
  uses: pulumi/actions@v5
  with:
    command: up
    stack-name: codigo/mau-app/codigo-services
  env:
    PULUMI_ACCESS_TOKEN: ${{ secrets.PULUMI_ACCESS_TOKEN }}
    PULUMI_CONFIG_PASSPHRASE: ${{ secrets.PULUMI_CONFIG_PASSPHRASE }}
    # Category B — Ansible reads these directly from env
    INFISICAL_ENCRYPTION_KEY: ${{ secrets.INFISICAL_ENCRYPTION_KEY }}
    INFISICAL_AUTH_SECRET: ${{ secrets.INFISICAL_AUTH_SECRET }}
    INFISICAL_DB_PASSWORD: ${{ secrets.INFISICAL_DB_PASSWORD }}
    INFISICAL_SMTP_PASSWORD: ${{ secrets.INFISICAL_SMTP_PASSWORD }}
    DOZZLE_USERNAME: ${{ secrets.DOZZLE_USERNAME }}
    DOZZLE_PASSWORD: ${{ secrets.DOZZLE_PASSWORD }}
    DOCKER_REGISTRY: ${{ vars.CONTAINER_REGISTRY_URL }}
    DOCKER_USERNAME: ${{ secrets.CONTAINER_REGISTRY_USERNAME }}
    DOCKER_PASSWORD: ${{ secrets.CONTAINER_REGISTRY_PASSWORD }}
    BACKUP_DIR: ${{ vars.BACKUP_DIR }}
```

### 4. Local runs

For running Ansible locally without CI/CD, source secrets from 1Password or Infisical:

```bash
# Option A: export from Infisical CLI
eval $(infisical secrets export \
  --projectId=8491de15-c5c4-4d67-aaf3-c4083161d824 \
  --env=prod \
  --domain=https://locker.codigo.sh \
  --format=dotenv)

# Option B: export from 1Password (add to a local script, never commit)
export INFISICAL_ENCRYPTION_KEY=$(op read "op://Codigo/Infisical Encryption Key/credential")
export DOZZLE_USERNAME=maumercado
export DOZZLE_PASSWORD=$(op read "op://Codigo/Infisical DB PWD/credential")
# ...

# Then run Ansible directly (no Pulumi needed for re-deploys)
ansible-playbook \
  -i ansible/inventory/production/hosts.yml \
  --private-key <(op read "op://Codigo/Hetzner VPS SSH Key (mau@codigo.sh)/ssh_private_key") \
  ansible/playbooks/deploy-tooling.yml
```

---

## What Does NOT Change

| Item | Why |
|------|-----|
| Infisical `codigo` project as source of truth | Still the single source — GitHub Sync still runs |
| GitHub Sync to Actions secrets | Still needed — secrets flow from Infisical to GitHub |
| Tunnel tokens flowing through Pulumi | They're Cloudflare provider outputs, not static secrets |
| Server IP flowing through Pulumi | It's a Hetzner provider output |
| SSH public key in Pulumi config | Needed to provision the Hetzner VPS SSH key resource |

---

## Future Improvement

Once this is done, the next step is Ansible reading from Infisical directly at runtime
(Infisical Ansible collection / `lookup` plugin), eliminating GitHub Sync for Category B
entirely. But that's a separate plan — this change is the quick win.
