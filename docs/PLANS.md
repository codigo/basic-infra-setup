# Plans

Central index of all planned, in-progress, and completed work for this platform.

## Planned

<!--
Dependency graph — what can run in parallel vs what must be serial:

  [Ansible migration ✓ merging] ──┬── [Simplify secrets flow]  ──┐
                                   │                               │
                                   └── [Hetzner private network] ──┼── [Observability stack]
                                                                    │
                                   ┌── [Infisical verify + sync] ──┘
                                   │
                                   └── [Vultr CR verification] ── blocked on Reporter VPS
-->

### Group A — Parallel (no dependencies between them, both unblock Group B)

- [Simplify secrets flow](./simplify-secrets-flow-plan.md) — Remove Pulumi as middleman for
  Ansible-only secrets. CI/CD passes Category B secrets (Infisical, Dozzle, Docker registry,
  tunnel tokens) as direct env vars to Ansible instead of routing them through `pulumi config set`.
  Pulumi config shrinks to cloud-provider-only credentials (~8 entries vs 20+). Separate PR after
  Ansible migration merges.

- [Hetzner private network](./basic-infra-setup-plan.md) — Create Hetzner Cloud Network in
  `basic-infra-setup` Pulumi, attach tooling VPS, export network ID and tooling VPS private IP
  to Infisical `infrastructure/HETZNER_PRIVATE_NETWORK_ID` + `TOOLING_VPS_PRIVATE_IP`. Reporter
  Pulumi reads these to attach the Reporter VPS. Separate PR.

- [Infisical verify + sync check](./basic-infra-setup-plan.md) — Verify all `codigo` project
  secrets are present in `prod` env and GitHub Sync is pushing correctly to GitHub Actions secrets.
  Pre-flight check before the secrets flow simplification PR can be safely merged. Manual task.

### Group B — Serial (depends on Group A completing)

- [Observability stack](./basic-infra-setup-plan.md) — Deploy Loki, Prometheus, Grafana, cAdvisor,
  and node-exporter on the tooling VPS as new Ansible roles (`monitoring-config` +
  `monitoring-deploy`). Loki bound to private network interface for Reporter log driver push.
  Prometheus scrapes Reporter VPS health endpoint over private IP. Depends on: Ansible migration
  merged + Hetzner private network deployed.

### Group C — Blocked on external work

- [Vultr CR access verification](./basic-infra-setup-plan.md) — Confirm `sjc.vultrcr.com/codigo`
  is reachable from the Reporter VPS and credentials are in Infisical
  `infrastructure/VULTR_CR_USERNAME` + `VULTR_CR_PASSWORD`. Blocked on Reporter VPS existing.

## In Progress

- Ansible migration cutover (PR #123) — Phase 2: `index.ts` updated, old `infra/*.ts` deleted,
  CI/CD workflows updated. Awaiting merge + GitHub Sync to push `DOZZLE_USERNAME` to Actions.

## Completed

- Ansible migration (Phase 1, PR #122) — Added 4 Ansible roles (base-server, docker,
  tooling-files, tooling-deploy), playbooks, inventory, and requirements. Validated with
  `--check --diff` against live server.

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
