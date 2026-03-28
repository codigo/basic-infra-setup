# Plans

Central index of all planned, in-progress, and completed work for this platform.

## Planned

- [Vultr CR access verification](./basic-infra-setup-plan.md) — Confirm `sjc.vultrcr.com/codigo`
  is reachable from the Reporter VPS and credentials are in Infisical. Blocked on Reporter VPS.

## In Progress

- [Hetzner private network](./basic-infra-setup-plan.md) — Create Hetzner Cloud Network in
  `basic-infra-setup` Pulumi, attach tooling VPS with static private IP `10.42.1.2`, export the
  network ID and tooling VPS private IP, and publish both to Reporter Infisical
  `production/infrastructure` for Reporter VPS attachment and observability integration.

## Completed

- Observability stack — Loki, Prometheus, Grafana, cAdvisor, and node-exporter deployed on the
  tooling VPS as Ansible roles (`monitoring-config` + `monitoring-deploy`). Grafana at
  `grafana.codigo.sh` via Caddy/Cloudflare. Prometheus scrapes cAdvisor + node-exporter + Loki.
  Reporter VPS scrape targets added conditionally once Hetzner private network is deployed.
  PR #126.

- Ansible migration — Replaced 18 `command.remote.Command` resources with 4 Ansible roles
  (base-server, docker, tooling-files, tooling-deploy). Pulumi provisions cloud resources;
  Ansible configures the server. Validated with `--check --diff` against live server.
  PRs #122 (roles) + #123 (cutover).

- Simplify secrets flow — Removed Pulumi as middleman for Ansible-only secrets. Category B
  secrets (Infisical, Dozzle, Docker registry, backup) now flow directly from GitHub Actions
  env vars to Ansible via `lookup('env')` in group_vars/all.yml. Pulumi config reduced from
  ~20 entries to 9 cloud-provider-only credentials. PR #125.

- Infisical verify + sync check — Confirmed all Category B secrets present in Infisical
  `codigo` project (`prod` env) and syncing correctly to GitHub Actions secrets. `DOZZLE_USERNAME`
  added to Infisical. Bcrypt hash verified correct against 1Password plaintext.

- Infisical Reporter GitHub Sync — Enabled GitHub Sync on the Reporter Infisical project,
  syncing the `production` environment `infrastructure/` folder to Reporter GitHub Actions
  secrets. Duplicate empty environments (`dev`, `prod` slugs) removed via API.

- tooling_net overlay network — Renamed unused `internal_net` to `tooling_net`, attached
  Infisical to it so app services can reach tooling internally without going through the internet.

- [Self-hosted Infisical (Secret Management)](./infisical-migration-plan.md) — Add Infisical to
  the tooling stack as a single source of truth for secrets, replacing the GitHub UI for secret
  management.

- Platform/Application Separation — Separated mau-app deployment from the shared platform layer.
  Each app now deploys itself.
