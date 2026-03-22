# Plans

Central index of all planned, in-progress, and completed work for this platform.

## Planned

- [Ansible migration](./ansible-migration-plan.md) — Replace 18 `command.remote.Command` resources across 5 Pulumi TypeScript files with 4 Ansible roles. Pulumi keeps cloud provisioning; Ansible takes over server configuration, Docker setup, file copies, and stack deployment. Also fixes nvm/fnm conflict, SSH hardening duplicates, and the `setupFirewall` dependency bug.

- [Hetzner private network](./basic-infra-setup-plan.md) — Create Hetzner Cloud Network in `basic-infra-setup` Pulumi, attach tooling VPS, export network ID and tooling VPS private IP to Infisical. Reporter Pulumi reads these to attach the Reporter VPS. No dependency on Reporter running first.

- [Observability stack](./basic-infra-setup-plan.md) — Deploy Loki, Prometheus, Grafana, cAdvisor, and node-exporter on the tooling VPS via Ansible roles (depends on Ansible migration). Loki bound to private network interface. Prometheus scrapes Reporter VPS over private IP. Depends on Hetzner private network.

- [Vultr CR access verification](./basic-infra-setup-plan.md) — Confirm `sjc.vultrcr.com/codigo` is reachable from the Reporter VPS and that Vultr CR credentials are stored in Infisical `infrastructure/VULTR_CR_USERNAME` + `VULTR_CR_PASSWORD`.

## In Progress

## Completed

- Infisical Reporter GitHub Sync — Enabled GitHub Sync on the Reporter Infisical project, syncing the `production` environment `infrastructure/` folder to Reporter GitHub Actions secrets. Duplicate empty environments (`dev`, `prod` slugs) removed via API.

- tooling_net overlay network — Renamed unused `internal_net` to `tooling_net`, attached Infisical to it so app services can reach tooling internally without going through the internet.

- [Self-hosted Infisical (Secret Management)](./infisical-migration-plan.md) — Add Infisical to the tooling stack as a single source of truth for secrets, replacing the GitHub UI for secret management.

- Platform/Application Separation — Separated mau-app deployment from the shared platform layer. Each app now deploys itself.
