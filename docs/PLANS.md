# Plans

Central index of all planned, in-progress, and completed work for this platform.

## Planned

<!--
Dependency graph:

  [Hetzner private network] ──── [Observability stack]

  [Vultr CR verification] ── blocked on Reporter VPS
-->

- [Hetzner private network](./basic-infra-setup-plan.md) — Create Hetzner Cloud Network in
  `basic-infra-setup` Pulumi, attach tooling VPS, export network ID and tooling VPS private IP
  to Infisical `infrastructure/HETZNER_PRIVATE_NETWORK_ID` + `TOOLING_VPS_PRIVATE_IP`. Reporter
  Pulumi reads these to attach the Reporter VPS. No dependency on Reporter running first.

- [Observability stack](./basic-infra-setup-plan.md) — Deploy Loki, Prometheus, Grafana, cAdvisor,
  and node-exporter on the tooling VPS as new Ansible roles (`monitoring-config` +
  `monitoring-deploy`). Loki bound to private network interface for Reporter log driver push.
  Prometheus scrapes Reporter VPS health endpoint over private IP. Depends on Hetzner private
  network being deployed first.

- [Vultr CR access verification](./basic-infra-setup-plan.md) — Confirm `sjc.vultrcr.com/codigo`
  is reachable from the Reporter VPS and credentials are in Infisical
  `infrastructure/VULTR_CR_USERNAME` + `VULTR_CR_PASSWORD`. Blocked on Reporter VPS existing.

## In Progress

## Completed

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
