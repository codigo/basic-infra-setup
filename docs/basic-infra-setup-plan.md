# basic-infra-setup Plan (Services Repo)

This document lives in the **Reporter** repo as a planning reference, but all work described here must be done in the **`basic-infra-setup`** repository.

It defines what the shared infrastructure services repo must provide before the Reporter VPS can gain centralised observability. The Reporter infrastructure plan (`infrastructure-plan.md`) assumes everything in this document is already done before the observability phase runs — and the Ansible `deploy` role checks for it automatically at deploy time.

---

## Goal

The Reporter VPS launches as a **standalone single-node Swarm manager** and is production-ready from day one with no dependency on this work. When the observability stack is live and the Hetzner private network is in place, the Reporter Ansible `deploy` role will automatically detect Loki and switch from Docker's default JSON-file logging to the Loki log driver — no manual steps, no code changes, no Swarm merge required.

```
Tooling VPS (basic-infra-setup)              Reporter VPS (standalone Swarm)
─────────────────────────────────            ─────────────────────────────────
  Grafana     — dashboards               ←scrapes←   /api/health/ready (Prometheus)
  Loki        — log aggregation          ←pushes←    Docker log driver (Loki push URL)
  Prometheus  — metrics scraping
  cAdvisor    — tooling VPS containers
  node-exporter — tooling VPS host

          Both VPSes on the same Hetzner Cloud Network
          Traffic flows over private IPs — no public ports
```

The Reporter VPS never joins the `basic-infra-setup` Swarm. Observability is connected
purely via the Hetzner private network: Loki receives logs pushed by the Docker log driver
over the private IP, and Prometheus scrapes the Reporter VPS health endpoint over the
private IP.

---

## Checklist — What Must Be Done in `basic-infra-setup`

### 1. Create Hetzner Private Network and Attach Tooling VPS

The Hetzner Cloud Network is **created and owned by `basic-infra-setup`** (this repo). The network ID and tooling VPS private IP are exported to Infisical so the Reporter Pulumi stack can attach the Reporter VPS to the same network at provisioning time — no circular dependency, `basic-infra-setup` always goes first.

- [ ] Add `hcloud.Network` + `hcloud.NetworkSubnet` resources to `basic-infra-setup` Pulumi (`infra/hetznerProvider.ts`)
- [ ] Attach the tooling VPS to the network with `hcloud.ServerNetwork`
- [ ] Export the network ID and tooling VPS private IP as Pulumi outputs
- [ ] Write both values to Infisical via CI/CD so the Reporter Pulumi stack can consume them
- [ ] Confirm the tooling VPS has a private IP on the network (e.g. `10.0.0.2`)

**Data produced:**

| Key                    | Where to store                                    | Consumed by                                    |
| ---------------------- | ------------------------------------------------- | ---------------------------------------------- |
| Hetzner network ID     | Infisical `infrastructure/HETZNER_PRIVATE_NETWORK_ID` | Reporter Pulumi — attach Reporter VPS to network |
| Tooling VPS private IP | Infisical `infrastructure/TOOLING_VPS_PRIVATE_IP` | Reporter Ansible `deploy` role — Loki push URL |

**Data consumed from Reporter (after Reporter VPS is provisioned):**

| Key                        | Written by                | Where                                                 |
| -------------------------- | ------------------------- | ----------------------------------------------------- |
| Reporter VPS private IP    | Reporter Pulumi           | Infisical `infrastructure/REPORTER_VPS_PRIVATE_IP`    |

---

### 2. Observability Stack Services

Deploy as a Docker Compose stack (or Docker Swarm stack) on the tooling VPS. Services must be accessible from the Hetzner private network — Loki on `0.0.0.0:3100` (or bound to the private interface), Prometheus on its scrape schedule reaching out to the Reporter VPS private IP.

#### Loki

- [ ] Deploy Grafana Loki (log aggregation)
- [ ] Bind Loki to the private network interface so the Reporter Docker log driver can push to it: `0.0.0.0:3100` (or scoped to the private CIDR)
- [ ] Set a sensible retention policy (e.g. 30 days)
- [ ] Confirm the `/ready` endpoint responds from the Reporter VPS private network:

  ```bash
  # Run from Reporter VPS (or any host on the private network):
  curl http://<TOOLING_VPS_PRIVATE_IP>:3100/ready
  # Expected: "ready"
  ```

**Required for Reporter:** The Reporter Ansible `deploy` role curls this endpoint at deploy time. If it returns `ready`, the `docker-stack.yml` is rendered with the Loki log driver:

```yaml
logging:
  driver: loki
  options:
    loki-url: 'http://<TOOLING_VPS_PRIVATE_IP>:3100/loki/api/v1/push'
```

If it fails, Docker's default JSON-file driver is used. No overlay DNS, no Swarm needed.

#### Prometheus

- [ ] Deploy Prometheus
- [ ] Add scrape config entries for the Reporter VPS using its **private IP** (not overlay DNS — different Swarms):

  ```yaml
  - job_name: 'reporter-api-health'
    metrics_path: /api/health/ready
    static_configs:
      # REPORTER_VPS_PRIVATE_IP written to Infisical by Reporter Pulumi (Phase 2)
      - targets: ['<REPORTER_VPS_PRIVATE_IP>:3000']

  - job_name: 'reporter-api-metrics'
    metrics_path: /api/metrics
    static_configs:
      - targets: ['<REPORTER_VPS_PRIVATE_IP>:3000']
    # /api/metrics does not exist yet — add scrape config now, endpoint added later
  ```

```
- [ ] Confirm Prometheus can reach the Reporter VPS health endpoint over the private network

**Reporter already provides:**
- `GET /api/health` — liveness (always 200)
- `GET /api/health/ready` — readiness with Postgres + Redis latency fields

A future `/api/metrics` prom-client endpoint requires zero Reporter infrastructure changes — just enabling the scrape config above.

#### Grafana

- [ ] Deploy Grafana
- [ ] Configure Loki and Prometheus as data sources
- [ ] Provision a basic Reporter dashboard (or import a Node.js / Fastify community dashboard)
- [ ] Persistent volume for dashboards and Grafana config

#### cAdvisor

- [ ] Deploy on the tooling VPS
- [ ] Mounts: `/var/run/docker.sock`, `/sys`, `/rootfs`
- [ ] Feeds tooling VPS container resource metrics into Prometheus
- [ ] **Note**: covers tooling VPS containers only in this setup. Reporter VPS container metrics require a cAdvisor instance on the Reporter VPS — deferred until needed or until the Swarms merge.

#### node-exporter

- [ ] Deploy on the tooling VPS
- [ ] Feeds tooling VPS host-level metrics (CPU, memory, disk, network) into Prometheus
- [ ] **Note**: same scope as cAdvisor — tooling VPS only. Reporter VPS host metrics deferred.

---

### 3. Infisical (locker.codigo.sh) — Confirm Ready

These items may already be done. Verify each before the Reporter production deploy.

- [ ] Infisical server at `locker.codigo.sh` is reachable from both the public internet and the Hetzner private network — containers can resolve secrets at boot
- [ ] Reporter project exists with `staging` and `production` environments
- [ ] All ~44 Reporter secrets loaded in the `production` environment under the correct folders (`infrastructure/`, `auth/`, `services/`, `app/`)
- [ ] **CI/CD machine identity** created for GitHub Actions (used in build + deploy workflows)
- [ ] **Runtime machine identity** created for the production Reporter VPS (used by Varlock at container boot)
- [ ] GitHub Sync integration enabled on the Reporter project → auto-populates GitHub repository secrets

**Data produced:**

| Key | Where to store | Consumed by |
|-----|---------------|-------------|
| CI/CD Universal Auth ID + Secret | Infisical `infrastructure/` + GitHub repo secrets (auto-synced) | GitHub Actions build + deploy workflows |
| Runtime Universal Auth ID + Secret | Infisical `infrastructure/INFISICAL_CLIENT_ID` + `INFISICAL_CLIENT_SECRET` | Reporter Swarm stack env → Varlock |

---

### 4. Vultr Container Registry — Confirm Ready

- [ ] `sjc.vultrcr.com/codigo` is accessible from the Reporter VPS (for `docker pull` during deploy)
- [ ] Vultr CR credentials stored in Infisical `infrastructure/VULTR_CR_USERNAME` + `VULTR_CR_PASSWORD`
- [ ] Reporter Ansible `docker` role runs `docker login sjc.vultrcr.com` using these credentials

---

## Data Handoff Summary

### basic-infra-setup → Infisical → Reporter

| Value | Written by | Infisical key | Consumed in Reporter |
|-------|-----------|--------------|---------------------|
| Tooling VPS private IP | `basic-infra-setup` (manual or Pulumi) | `infrastructure/TOOLING_VPS_PRIVATE_IP` | Reporter Ansible `deploy` role — Loki push URL |
| Infisical CI/CD identity | Infisical admin | GitHub repo secrets (auto-synced) | GitHub Actions build + deploy workflows |
| Infisical runtime identity | Infisical admin | `infrastructure/INFISICAL_CLIENT_ID` + `INFISICAL_CLIENT_SECRET` | Swarm stack env → Varlock |
| Vultr CR credentials | Vultr dashboard | `infrastructure/VULTR_CR_USERNAME` + `VULTR_CR_PASSWORD` | Ansible `docker` role login |

### Reporter → Infisical → basic-infra-setup

| Value | Written by | Infisical key | Consumed in basic-infra-setup |
|-------|-----------|--------------|------------------------------|
| Hetzner private network ID | Reporter Pulumi (Phase 2) | `infrastructure/HETZNER_PRIVATE_NETWORK_ID` | Attach tooling VPS to the network |
| Reporter VPS private IP | Reporter Pulumi (Phase 2) | `infrastructure/REPORTER_VPS_PRIVATE_IP` | Prometheus scrape config targets |

---

## How the Reporter Infrastructure Plan Uses This

The Reporter Ansible `deploy` role performs a single readiness check at deploy time:

```

Ansible deploy role (runs on Reporter VPS):

Read TOOLING_VPS_PRIVATE_IP from Infisical
→ Not set: skip Loki check entirely, deploy with JSON-file logging (standalone mode)
→ Set: curl http://<TOOLING_VPS_PRIVATE_IP>:3100/ready

        → 200 "ready":   Render docker-stack.yml WITH loki logging driver
                          loki-url: "http://<TOOLING_VPS_PRIVATE_IP>:3100/loki/api/v1/push"

        → Fails/timeout: Render docker-stack.yml WITHOUT logging blocks
                          (Loki not yet deployed, that's fine — re-run deploy later)

```

No Swarm topology changes. No overlay DNS. The Reporter VPS stays as a standalone
manager throughout. Observability is purely a network-level concern handled at deploy time.

---

## Status

| Item | Status |
|------|--------|
| Create Hetzner private network (owned by basic-infra-setup) | ⬜ Pending |
| Attach tooling VPS to private network | ⬜ Pending |
| Write network ID + tooling VPS private IP to Infisical | ⬜ Pending |
| Loki | 🔄 PR #126 (deploys on tooling VPS; private interface binding after network) |
| Prometheus | 🔄 PR #126 (Reporter scrape targets added after private network) |
| Grafana (grafana.codigo.sh) | 🔄 PR #126 |
| cAdvisor (tooling VPS only) | 🔄 PR #126 |
| node-exporter (tooling VPS only) | 🔄 PR #126 |
| Infisical — Reporter project + secrets | ✅ Done |
| Infisical — CI/CD machine identity | ✅ Done |
| Infisical — runtime machine identity | ✅ Done |
| Infisical — GitHub sync enabled (infrastructure/ → Reporter repo) | ✅ Done |
| Vultr CR credentials in Infisical | ⬜ Pending |
