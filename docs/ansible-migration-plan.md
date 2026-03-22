# Ansible Migration Plan

Status: **Planned**

## Goal

Replace the 18 `command.remote.Command` resources across 5 Pulumi TypeScript files with
Ansible roles. Pulumi continues provisioning cloud resources (Hetzner VPS, Cloudflare
DNS/tunnels, S3, IAM). Ansible takes over all server configuration — user setup, Docker
install, swarm init, file copies, and stack deployment.

This eliminates:
- `ignoreChanges` hacks that exist because shell scripts aren't idempotent
- Shell-in-TypeScript (`pulumi.interpolate` heredocs) that are hard to test and maintain
- Non-idempotent scripts that append duplicate entries to `.bashrc`
- The nvm/fnm conflict (serverConfig.ts installs nvm, serverCopyToolingFiles.ts sources fnm)
- The `setupFirewall` not-awaited bug in `index.ts` (firewall completes before Docker with Ansible)

---

## What Stays in Pulumi

| File | Resources | Why |
|------|-----------|-----|
| `infra/hetznerProvider.ts` | Hetzner VPS, SSH key, private network (future) | Real cloud resources |
| `infra/cloudflare.ts` | DNS records, tunnels, ZeroTrust configs | Real Cloudflare provider resources |
| `infra/s3.ts` | S3 bucket + lifecycle | Real AWS provider resource |
| `infra/iam.ts` | IAM user, access key, policy | Real AWS provider resource |
| `index.ts` | Orchestration + Ansible trigger | Provisions cloud, then triggers Ansible |

---

## What Moves to Ansible

| Current File | Lines | Resources | Ansible Role |
|---|---|---|---|
| `serverConfig.ts` | 183 | createUser, disableRootSSH, installNode, setupFirewall | `base-server` |
| `setupEnvs.ts` | 51 | createEnvVars | `base-server` (blockinfile) |
| `setupDockerInServer.ts` | 108 | installDocker, initDockerSwarm, getWorkerToken, createDockerNetworks | `docker` |
| `serverCopyToolingFiles.ts` | 181 | createFolders, 6x copy, setPermissionsAndCronJob | `tooling-files` |
| `deployDockerStacks.ts` | 70 | deployDockerStacks | `tooling-deploy` |
| **Total** | **593** | **18 resources** | **4 roles** |

---

## Directory Structure

```
services/
├── ansible/
│   ├── ansible.cfg
│   ├── requirements.yml
│   ├── inventory/
│   │   └── production/
│   │       ├── hosts.yml
│   │       └── group_vars/
│   │           ├── all.yml
│   │           └── managers.yml
│   ├── roles/
│   │   ├── base-server/
│   │   │   ├── tasks/main.yml
│   │   │   ├── handlers/main.yml
│   │   │   └── templates/
│   │   │       └── bashrc_env.j2
│   │   ├── docker/
│   │   │   ├── tasks/main.yml
│   │   │   └── handlers/main.yml
│   │   ├── tooling-files/
│   │   │   ├── tasks/main.yml
│   │   │   ├── templates/
│   │   │   │   ├── docker-compose.tooling.yaml.j2
│   │   │   │   └── Caddyfile.j2
│   │   │   └── files/
│   │   │       ├── backupData.js
│   │   │       ├── uploadToS3.js
│   │   │       └── restoreAndCopyBackup.js
│   │   └── tooling-deploy/
│   │       └── tasks/main.yml
│   └── playbooks/
│       ├── bootstrap.yml           # first-time: runs as root, creates codigo user
│       ├── site.yml                # full config: runs as codigo
│       └── deploy-tooling.yml      # redeploy tooling stack only
```

---

## Role Details

### `base-server` — replaces `serverConfig.ts` + `setupEnvs.ts`

```yaml
# tasks/main.yml
- name: Create codigo user
  ansible.builtin.user:
    name: codigo
    shell: /bin/bash
    create_home: true
    groups: [sudo]
    append: true

- name: Deploy SSH authorized key
  ansible.posix.authorized_key:
    user: codigo
    key: "{{ ssh_public_key }}"
    state: present
    exclusive: true

- name: Disable root SSH login
  ansible.builtin.lineinfile:
    path: /etc/ssh/sshd_config
    regexp: '^#?PermitRootLogin'
    line: 'PermitRootLogin no'
  notify: Restart sshd

- name: Disable password authentication
  ansible.builtin.lineinfile:
    path: /etc/ssh/sshd_config
    regexp: '^#?PasswordAuthentication'
    line: 'PasswordAuthentication no'
  notify: Restart sshd

- name: Remove root authorized_keys
  ansible.builtin.file:
    path: /root/.ssh/authorized_keys
    state: absent

- name: Install UFW
  ansible.builtin.apt:
    name: ufw
    state: present
    update_cache: true

- name: UFW default deny incoming
  community.general.ufw:
    default: deny
    direction: incoming

- name: UFW default deny routed
  community.general.ufw:
    default: deny
    direction: routed

- name: UFW default allow outgoing
  community.general.ufw:
    default: allow
    direction: outgoing

- name: UFW deny HTTP/HTTPS (traffic comes via Cloudflare tunnels)
  community.general.ufw:
    rule: deny
    port: "{{ item }}"
  loop: ['80', '443']

- name: UFW allow SSH
  community.general.ufw:
    rule: allow
    port: '22'
    proto: tcp

- name: UFW enable
  community.general.ufw:
    state: enabled

- name: Install fnm (Fast Node Manager)
  ansible.builtin.shell: |
    curl -fsSL https://fnm.vercel.app/install | bash
  args:
    creates: /home/codigo/.local/share/fnm/fnm
  become_user: codigo

- name: Install Node.js via fnm
  ansible.builtin.shell: |
    export PATH="/home/codigo/.local/share/fnm:$PATH"
    eval "$(fnm env)"
    fnm install 24
    fnm default 24
  args:
    creates: /home/codigo/.local/share/fnm/node-versions
  become_user: codigo

- name: Set environment variables in .bashrc
  ansible.builtin.blockinfile:
    path: /home/codigo/.bashrc
    marker: "# {mark} ANSIBLE MANAGED - Platform Env Vars"
    create: true
    owner: codigo
    group: codigo
    mode: '0644'
    block: |
      export AWS_ACCESS_KEY_ID="{{ aws_access_key_id }}"
      export AWS_SECRET_ACCESS_KEY="{{ aws_secret_access_key }}"
      export AWS_REGION="{{ aws_region }}"
      export BACKUP_DIR="{{ backup_dir }}"
      export APP_BUCKET="{{ app_bucket }}"
      export PATH="/home/codigo/.local/share/fnm:$PATH"
      eval "$(fnm env)"
```

**Fixes:**
- `lineinfile` replaces SSH config lines — no duplicate appends
- `blockinfile` replaces entire env block atomically — no `sed -i` cleanup needed
- Standardizes on `fnm` (removes the nvm/fnm conflict)
- UFW runs after user creation, before Docker — guaranteed ordering (no missing `dependsOn`)

### `docker` — replaces `setupDockerInServer.ts`

```yaml
# tasks/main.yml
- name: Install Docker prerequisites
  ansible.builtin.apt:
    name: [apt-transport-https, ca-certificates, curl, gnupg, lsb-release]
    state: present
    update_cache: true

- name: Add Docker GPG key
  ansible.builtin.apt_key:
    url: https://download.docker.com/linux/ubuntu/gpg
    state: present

- name: Add Docker repository
  ansible.builtin.apt_repository:
    repo: "deb [arch=amd64] https://download.docker.com/linux/ubuntu {{ ansible_distribution_release }} stable"
    state: present

- name: Install Docker CE
  ansible.builtin.apt:
    name: [docker-ce, docker-ce-cli, containerd.io]
    state: present
    update_cache: true

- name: Add codigo user to docker group
  ansible.builtin.user:
    name: codigo
    groups: docker
    append: true

- name: Install Python Docker SDK (required by community.docker modules)
  ansible.builtin.pip:
    name: [docker>=2.0.0, jsondiff, pyyaml]
    state: present

- name: Initialize Docker Swarm
  community.docker.docker_swarm:
    state: present
  register: swarm_result

- name: Create caddy_net overlay network
  community.docker.docker_network:
    name: caddy_net
    driver: overlay
    attachable: true
    scope: swarm

- name: Create tooling_net overlay network
  community.docker.docker_network:
    name: tooling_net
    driver: overlay
    attachable: true
    scope: swarm

- name: Remove legacy internal_net if present
  community.docker.docker_network:
    name: internal_net
    state: absent
  ignore_errors: true
```

**Key improvements:**
- `community.docker.docker_swarm` is idempotent — no manual state checks
- Returns `swarm_result.swarm_facts.JoinTokens.Worker` — no separate `join-token` command
- `apt` install is idempotent — no `ignoreChanges` guard needed
- `ignore_errors: true` on network removal handles the case where it's already gone

### `tooling-files` — replaces `serverCopyToolingFiles.ts`

```yaml
# tasks/main.yml
- name: Create directory structure
  ansible.builtin.file:
    path: "{{ item }}"
    state: directory
    owner: codigo
    group: codigo
    mode: '0755'
  loop:
    - /home/codigo/bin
    - /home/codigo/logs
    - /home/codigo/tooling/data/caddy/config
    - /home/codigo/tooling/data/caddy/data
    - /home/codigo/tooling/data/dozzle
    - /home/codigo/tooling/bin/cloudflared
    - /home/codigo/tooling/data/infisical/postgres
    - /home/codigo/tooling/data/infisical/redis

- name: Template docker-compose.tooling.yaml
  ansible.builtin.template:
    src: docker-compose.tooling.yaml.j2
    dest: /home/codigo/tooling/docker-compose.tooling.yaml
    owner: codigo
    group: codigo
    mode: '0644'

- name: Template Caddyfile
  ansible.builtin.template:
    src: Caddyfile.j2
    dest: /home/codigo/tooling/data/caddy/Caddyfile
    owner: codigo
    group: codigo
    mode: '0644'

- name: Copy dozzle users.yaml
  ansible.builtin.template:
    src: dozzle-users.yaml.j2
    dest: /home/codigo/tooling/data/dozzle/users.yaml
    owner: codigo
    group: codigo
    mode: '0600'

- name: Copy backup scripts
  ansible.builtin.copy:
    src: "{{ item }}"
    dest: /home/codigo/bin/{{ item }}
    owner: codigo
    group: codigo
    mode: '0755'
  loop:
    - backupData.js
    - uploadToS3.js
    - restoreAndCopyBackup.js

- name: Install AWS SDK for backup scripts
  community.general.npm:
    path: /home/codigo/bin
    name: "@aws-sdk/client-s3"
    state: present

- name: Schedule backup cron job
  ansible.builtin.cron:
    name: "Run data backup"
    minute: "0"
    hour: "0,12"
    job: >-
      source /home/codigo/.bashrc &&
      /home/codigo/.local/share/fnm/fnm exec --using=24
      node /home/codigo/bin/backupData.js >> /home/codigo/logs/backup.log 2>&1
    user: codigo

- name: Schedule S3 upload cron job
  ansible.builtin.cron:
    name: "Upload backups to S3"
    minute: "30"
    hour: "0,12"
    job: >-
      source /home/codigo/.bashrc &&
      /home/codigo/.local/share/fnm/fnm exec --using=24
      node /home/codigo/bin/uploadToS3.js >> /home/codigo/logs/upload.log 2>&1
    user: codigo
```

**Key improvements:**
- `template` module replaces heredoc file copies — Jinja2 vars, no shell expansion risks
- `cron` module uses `name` as unique key — no dedup logic needed, idempotent by design
- All config files are actual files in the repo (not embedded in TypeScript strings)

### `tooling-deploy` — replaces `deployDockerStacks.ts`

```yaml
# tasks/main.yml
- name: Login to container registry
  community.docker.docker_login:
    registry_url: "{{ docker_registry }}"
    username: "{{ docker_username }}"
    password: "{{ docker_password }}"

- name: Deploy tooling stack
  community.docker.docker_stack:
    name: tooling
    state: present
    compose:
      - /home/codigo/tooling/docker-compose.tooling.yaml
    with_registry_auth: true
    prune: true
```

---

## Playbooks

### `playbooks/bootstrap.yml` — first-time only (runs as root)

```yaml
---
- name: Bootstrap new VPS — create codigo user
  hosts: managers
  remote_user: root
  gather_facts: false
  tasks:
    - name: Create codigo user
      ansible.builtin.user:
        name: codigo
        shell: /bin/bash
        create_home: true

    - name: Add to sudo (passwordless)
      ansible.builtin.copy:
        dest: /etc/sudoers.d/codigo
        content: "codigo ALL=(ALL) NOPASSWD:ALL\n"
        mode: '0440'

    - name: Deploy SSH key
      ansible.posix.authorized_key:
        user: codigo
        key: "{{ ssh_public_key }}"
        exclusive: true
```

### `playbooks/site.yml` — full config (runs as codigo)

```yaml
---
- name: Configure tooling VPS
  hosts: managers
  become: true
  roles:
    - base-server
    - docker
    - tooling-files
    - tooling-deploy
```

### `playbooks/deploy-tooling.yml` — redeploy stack only

```yaml
---
- name: Redeploy tooling stack
  hosts: managers
  become: true
  roles:
    - tooling-files
    - tooling-deploy
```

---

## Collections Required

```yaml
# ansible/requirements.yml
---
collections:
  - name: community.docker
    version: ">=5.0.0"
  - name: community.general
    version: ">=12.0.0"
  - name: ansible.posix
    version: ">=2.0.0"
```

Install: `ansible-galaxy collection install -r ansible/requirements.yml`

---

## SSH Key Setup

The Hetzner VPS uses a dedicated SSH key (`mau@codigo.sh`), separate from the main MacIcio key.

**Stored in:**
- `~/code/codigo-projects/ssh-keys/id_rsa` (local machine)
- 1Password: `Codigo` vault → "Hetzner VPS SSH Key (mau@codigo.sh)"
- Infisical: `codigo-infra` project → `SSH_PRIVATE_KEY` / `SSH_PUBLIC_KEY` (base64)
- GitHub Actions: synced from Infisical via GitHub Sync

**Local SSH config** (`~/.ssh/config`) routes `5.78.86.194` through this key automatically.

**Fingerprint:** `SHA256:DYyfnWBzX6h1GSZu4a7Yv6Bx74ZhNuIWjEZupUDjyuw`

### Ansible connects using:

**CI/CD (GitHub Actions):**
```bash
ansible-playbook \
  -i '${server_ip},' \
  --private-key <(echo '${{ secrets.SSH_PRIVATE_KEY }}' | base64 -d) \
  ansible/playbooks/site.yml
```

**Local (your machine):**
```bash
# Pull key from 1Password at runtime
ansible-playbook \
  -i '5.78.86.194,' \
  --private-key <(op read "op://Codigo/Hetzner VPS SSH Key (mau@codigo.sh)/ssh_private_key") \
  ansible/playbooks/site.yml
```

---

## How Pulumi Triggers Ansible

After provisioning the Hetzner VPS, `index.ts` replaces Steps 5-9 with two
`command.local.Command` resources:

```typescript
// Step 1: Bootstrap (first run only — creates codigo user as root)
const bootstrap = new command.local.Command("bootstrap", {
  create: pulumi.interpolate`
    ANSIBLE_HOST_KEY_CHECKING=False ansible-playbook \
      -i '${server.ipv4Address},' \
      --private-key <(echo '${sshPrivateKey}' | base64 -d) \
      --extra-vars 'ssh_public_key=${sshPublicKey}' \
      ansible/playbooks/bootstrap.yml
  `,
}, { dependsOn: [server] });

// Step 2: Full configuration (every run)
const configure = new command.local.Command("configure-server", {
  create: pulumi.interpolate`
    ANSIBLE_HOST_KEY_CHECKING=False ansible-playbook \
      -i '${server.ipv4Address},' \
      --private-key <(echo '${sshPrivateKey}' | base64 -d) \
      --extra-vars 'server_ip=${server.ipv4Address}' \
      --extra-vars 'aws_access_key_id=${accessKey.id}' \
      --extra-vars 'aws_secret_access_key=${accessKey.secret}' \
      --extra-vars 'aws_region=${awsRegion}' \
      --extra-vars 'backup_dir=${backupDir}' \
      --extra-vars 'app_bucket=${bucket.bucket}' \
      --extra-vars 'tunnel_token_maumercado=${maumercadoTunnelToken}' \
      --extra-vars 'tunnel_token_codigo=${codigoTunnelToken}' \
      --extra-vars 'docker_registry=${dockerRegistry}' \
      --extra-vars 'docker_username=${dockerUsername}' \
      --extra-vars 'docker_password=${dockerPassword}' \
      ansible/playbooks/site.yml
  `,
  triggers: [composeFileHash, caddyfileHash],
}, { dependsOn: [bootstrap] });
```

---

## Secrets Flow Change

| Before | After |
|--------|-------|
| GitHub Actions runs `sed` to replace `{{ VAR }}` in compose file | Ansible templates with Jinja2 directly |
| All config files embedded as strings in Pulumi config | Config files are real files in `ansible/roles/*/templates/` |
| Two template engines (GitHub Actions `{{ }}` + Pulumi interpolation) | One: Jinja2 |
| `pulumi config set docker_compose_tooling "$(cat ...)"` (entire file as config) | File lives in repo, Ansible templates it |

---

## CI/CD Changes

**Before (`.github/workflows/deploy-infrastructure.yaml`):**
```yaml
- name: Process templates       # sed replacements for {{ VAR }} placeholders
- name: Set Pulumi config       # 15+ pulumi config set calls
- name: pulumi up
```

**After:**
```yaml
- name: Install Ansible + collections
  run: |
    pip install ansible
    ansible-galaxy collection install -r ansible/requirements.yml

- name: pulumi up               # Pulumi provisions cloud, triggers Ansible
```

Secrets flow: Infisical → GitHub Sync → `${{ secrets.X }}` → Pulumi `--extra-vars` → Ansible → Jinja2 template.

---

## Migration Steps

**Approach: full cutover (not incremental)**

1. **Write all 4 Ansible roles** alongside existing Pulumi code — no conflicts, no risk
2. **Dry-run against live server:**
   ```bash
   ANSIBLE_HOST_KEY_CHECKING=False ansible-playbook \
     -i '5.78.86.194,' \
     --private-key <(op read "op://Codigo/Hetzner VPS SSH Key (mau@codigo.sh)/ssh_private_key") \
     --check --diff \
     ansible/playbooks/site.yml
   ```
   Should show mostly no changes (server is already configured)
3. **Cut over `index.ts`** — replace Steps 5-9 with `command.local.Command` Ansible triggers
4. **Delete** the 5 old `infra/*.ts` files
5. **Update CI/CD** — remove template processing, simplify config, add Ansible install
6. **`pulumi preview`** — should show removal of 18 remote commands, addition of 2 local commands
7. **`pulumi up`** — applies the cutover
8. **Commit:** `feat: migrate server configuration from command.remote.Command to Ansible`

---

## Bugs Fixed by Migration

| Bug | Current state | Fixed by |
|-----|--------------|---------|
| nvm vs fnm conflict | `serverConfig.ts` installs nvm; `serverCopyToolingFiles.ts` sources fnm | Standardize on fnm in `base-server` role |
| `setupFirewall` not awaited | `index.ts:45` doesn't wait for firewall before Step 6 | Ansible role ordering guarantees firewall → Docker sequence |
| `disableRootSSH` appends duplicates | `tee -a` adds lines on every run; only safe because `ignoreChanges` | `lineinfile` replaces — never appends |
| `installNode` appends to .bashrc | Same append pattern | `blockinfile` replaces entire managed block |

---

## What Does NOT Change

| Item | Why |
|------|-----|
| Docker compose file structure (services, networks) | Same services, same networks — just templated differently |
| Caddyfile routing rules | Same routes — now a Jinja2 template |
| Backup scripts (backupData.js, uploadToS3.js, restoreAndCopyBackup.js) | Same files — copied by Ansible instead of heredoc |
| Live server state | Ansible is idempotent — all roles are no-ops against already-configured server |
| Cloudflare/S3/IAM Pulumi resources | Untouched — these stay in Pulumi |

---

## Future: Observability Stack (Phase 2)

Once this migration is complete, the observability stack (Loki, Prometheus, Grafana, cAdvisor,
node-exporter) is added as two new Ansible roles:

- `monitoring-config` — create dirs, template Prometheus/Loki/Grafana configs
- `monitoring-deploy` — `docker_stack` deploy for `docker-compose.monitoring.yaml`

No new Pulumi `command.remote.Command` resources needed. Just Ansible roles.
