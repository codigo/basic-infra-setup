# Plans

Central index of all planned, in-progress, and completed work for this platform.

## Planned

- [Hetzner private network attachment](./basic-infra-setup-plan.md) — Attach the tooling VPS to the Hetzner Cloud Network created by the Reporter Pulumi stack. Write tooling VPS private IP to Infisical `infrastructure/TOOLING_VPS_PRIVATE_IP` so Reporter can build the Loki push URL. Depends on Reporter Pulumi Phase 2 running first.

- [Observability stack](./basic-infra-setup-plan.md) — Deploy Loki, Prometheus, Grafana, cAdvisor, and node-exporter on the tooling VPS. Loki bound to private network interface for Reporter log driver push. Prometheus scrapes Reporter VPS health endpoint over private IP. Depends on Hetzner private network attachment.

- [Infisical Reporter project setup](./basic-infra-setup-plan.md) — Create Reporter project in Infisical with `staging` and `production` environments, load ~44 secrets, create CI/CD and runtime machine identities, enable GitHub Sync to Reporter repo.

- [Vultr CR access verification](./basic-infra-setup-plan.md) — Confirm `sjc.vultrcr.com/codigo` is reachable from the Reporter VPS and that Vultr CR credentials are stored in Infisical `infrastructure/VULTR_CR_USERNAME` + `VULTR_CR_PASSWORD`.

## In Progress

## Completed

- tooling_net overlay network — Renamed unused `internal_net` to `tooling_net`, attached Infisical to it so app services can reach tooling internally without going through the internet.

- [Self-hosted Infisical (Secret Management)](./infisical-migration-plan.md) — Add Infisical to the tooling stack as a single source of truth for secrets, replacing the GitHub UI for secret management.

- Platform/Application Separation — Separated mau-app deployment from the shared platform layer. Each app now deploys itself.
