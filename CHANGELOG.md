## [1.2.11](https://github.com/codigo/basic-infra-setup/compare/v1.2.10...v1.2.11) (2026-02-27)


### Bug Fixes

* add AWS_REGION to server env, fix cron and fnm setup ([cca4847](https://github.com/codigo/basic-infra-setup/commit/cca48471416bfb7d63da5fcf44e2f5ff61e6f687))

## [1.2.10](https://github.com/codigo/basic-infra-setup/compare/v1.2.9...v1.2.10) (2026-02-27)


### Bug Fixes

* use heredocs instead of echo for copying scripts to server ([0152c8b](https://github.com/codigo/basic-infra-setup/commit/0152c8b641d1641ce71b09e74a8b8bad20acfed2))

## [1.2.9](https://github.com/codigo/basic-infra-setup/compare/v1.2.8...v1.2.9) (2026-02-27)


### Bug Fixes

* add database restore to backup restore script ([a590519](https://github.com/codigo/basic-infra-setup/commit/a590519b3b02b5bdd930d1fb5622aa80119679e3))

## [1.2.8](https://github.com/codigo/basic-infra-setup/compare/v1.2.7...v1.2.8) (2026-02-27)


### Bug Fixes

* backup without sudo, exclude container-owned dirs ([d5c7461](https://github.com/codigo/basic-infra-setup/commit/d5c7461fef131119ab2a2f0cc7663805fba2e14d))

## [1.2.7](https://github.com/codigo/basic-infra-setup/compare/v1.2.6...v1.2.7) (2026-02-27)


### Bug Fixes

* harden infrastructure, backups, and S3 lifecycle ([#121](https://github.com/codigo/basic-infra-setup/issues/121)) ([0bf490d](https://github.com/codigo/basic-infra-setup/commit/0bf490d032e01bf60607d71ebdd24e4f5d6c3283))

## [1.2.6](https://github.com/codigo/basic-infra-setup/compare/v1.2.5...v1.2.6) (2026-02-17)

### Bug Fixes

- add ignoreChanges to root SSH commands in serverConfig ([81592c1](https://github.com/codigo/basic-infra-setup/commit/81592c1a72af85ff1bf0b20a51e4fdc3358eedf2))

## [1.2.5](https://github.com/codigo/basic-infra-setup/compare/v1.2.4...v1.2.5) (2026-02-17)

### Bug Fixes

- revert SSH key handling to echo, add debug output ([b754e26](https://github.com/codigo/basic-infra-setup/commit/b754e264426d62bfc642edd941209d841300f990))

## [1.2.4](https://github.com/codigo/basic-infra-setup/compare/v1.2.3...v1.2.4) (2026-02-17)

### Bug Fixes

- revert SSH key handling to use raw keys from secrets ([1ccc97c](https://github.com/codigo/basic-infra-setup/commit/1ccc97c87863efeb6cade7f272a16669335fa376))

## [1.2.3](https://github.com/codigo/basic-infra-setup/compare/v1.2.2...v1.2.3) (2026-02-17)

### Bug Fixes

- use printf for SSH key decode to avoid echo escape issues ([2dd03a4](https://github.com/codigo/basic-infra-setup/commit/2dd03a40632d93f88b25e14acdda6a9c48ace528))

## [1.2.2](https://github.com/codigo/basic-infra-setup/compare/v1.2.1...v1.2.2) (2026-02-17)

### Bug Fixes

- decode base64 SSH keys before writing to file ([8ef52bf](https://github.com/codigo/basic-infra-setup/commit/8ef52bf5692325dfe7e2f2ba61441c7378f9ebb3))

## [1.2.1](https://github.com/codigo/basic-infra-setup/compare/v1.2.0...v1.2.1) (2026-02-17)

### Bug Fixes

- ignore SSH key changes to prevent Hetzner uniqueness error ([4538197](https://github.com/codigo/basic-infra-setup/commit/4538197e668b003e3405ccfa3885fe4ef8e24474))

# [1.2.0](https://github.com/codigo/basic-infra-setup/compare/v1.1.5...v1.2.0) (2026-02-13)

### Features

- add SMTP/Resend email config to Infisical ([73630c2](https://github.com/codigo/basic-infra-setup/commit/73630c286992a1972840aff4a8f568359ef129ff))

## [1.1.5](https://github.com/codigo/basic-infra-setup/compare/v1.1.4...v1.1.5) (2026-02-13)

### Bug Fixes

- trigger docker stack redeploy when compose file changes ([0b11c8c](https://github.com/codigo/basic-infra-setup/commit/0b11c8ced7676b60582fc8c2920d89655298e52b))

## [1.1.4](https://github.com/codigo/basic-infra-setup/compare/v1.1.3...v1.1.4) (2026-02-13)

### Bug Fixes

- remove depends_on from infisical service (unsupported in Swarm) ([f1ad1e5](https://github.com/codigo/basic-infra-setup/commit/f1ad1e5de4570b14fb04de09f5947aac5f4622f9))

## [1.1.3](https://github.com/codigo/basic-infra-setup/compare/v1.1.2...v1.1.3) (2026-02-13)

### Bug Fixes

- rename Pulumi stack to codigo-services and decode SSH public key ([e6f7534](https://github.com/codigo/basic-infra-setup/commit/e6f7534b332d7236b79e75e3b24d1c9f7dd40dc3))

## [1.1.2](https://github.com/codigo/basic-infra-setup/compare/v1.1.1...v1.1.2) (2026-02-13)

### Bug Fixes

- use correct Pulumi stack name codigo/mau-app/prod ([6d699bb](https://github.com/codigo/basic-infra-setup/commit/6d699bb3368597d7cb3e6d107b2d9de156ec23af))

## [1.1.1](https://github.com/codigo/basic-infra-setup/compare/v1.1.0...v1.1.1) (2026-02-13)

### Bug Fixes

- trigger deploy workflow on push to main instead of repository_dispatch ([c1bd8aa](https://github.com/codigo/basic-infra-setup/commit/c1bd8aa370d8f3689213c99ee1108332b8c4a61e))

# [1.1.0](https://github.com/codigo/basic-infra-setup/compare/v1.0.0...v1.1.0) (2026-02-13)

### Features

- add self-hosted Infisical to tooling stack ([b228924](https://github.com/codigo/basic-infra-setup/commit/b228924bfa2d4d64ee87f039f393388f6194db11))

# 1.0.0 (2024-10-12)

### Features

- 🐳 improve docker-compose configurations ([#84](https://github.com/codigo/basic-infra-setup/issues/84)) ([237128d](https://github.com/codigo/basic-infra-setup/commit/237128d48bade1beb90d8210375f350b381c832f))
- 🚀 Improve Docker Swarm setup process ([#75](https://github.com/codigo/basic-infra-setup/issues/75)) ([6ecc357](https://github.com/codigo/basic-infra-setup/commit/6ecc35744ca5753810f494cff63af7ed3a9668bd))
