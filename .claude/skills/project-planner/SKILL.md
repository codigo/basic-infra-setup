---
name: project-planner
description: Manage a centralized project plans index and create detailed plan documents. Use when the user wants to plan a new feature, track plan status, create a plan document, update a plan's status, or review all planned/in-progress/completed work. Triggers on phrases like "plan for", "add a plan", "update plan status", "what plans do we have", or "let's plan".
---

# Project Planner

Maintain a centralized `docs/PLANS.md` index that links to individual plan documents in `docs/`. Each plan has a status and its own detailed markdown file.

## Workflow

### Creating a new plan

1. Discuss the plan with the user to understand scope, goals, and key decisions.
2. Create `docs/<plan-name>.md` with the plan template below.
3. Add an entry to `docs/PLANS.md` under the appropriate status section with a link to the plan doc.

### Updating a plan's status

1. Read `docs/PLANS.md`.
2. Move the plan entry to the correct status section (Planned → In Progress → Completed).
3. Update the `Status:` line in the plan's own doc file to match.

### Completing a plan

1. Update any project documentation affected by the completed work (e.g., `README.md`, `CLAUDE.md`, architectural docs). The plan doc describes what changed — use it to identify which docs need updates.
2. Move the plan entry in `docs/PLANS.md` to the **Completed** section. Replace the file link with just the title (since the file will be deleted).
3. Delete the plan document from `docs/`. The plan was a roadmap — once the work is done and docs are updated, the plan itself is no longer needed.

### Reviewing plans

1. Read `docs/PLANS.md` and summarize the current state of all plans.

## PLANS.md Format

```markdown
# Plans

Central index of all planned, in-progress, and completed work for this platform.

## Planned

- [Plan Title](./plan-file.md) — One-line summary.

## In Progress

- [Plan Title](./plan-file.md) — One-line summary.

## Completed

- Plan Title — One-line summary.
```

## Plan Document Template

Each plan doc follows this structure. Sections can be added or removed based on the plan's complexity, but the frontmatter status line and Goal section are always required.

```markdown
# <Plan Title>

Status: **Planned** | **In Progress** | **Completed**

## Goal

What we want to achieve and why.

## Architecture

How it fits into the existing system. Diagrams, network layout, container topology as needed.

## Setup Steps

Numbered steps to implement. Include code snippets, config changes, and file paths.

## Migration Strategy

What changes from the current state. What moves, what stays, what gets added.

## What Does NOT Change

Explicitly call out what remains untouched to set scope boundaries.

## Future Improvements

Optional follow-on work that is not part of this plan's scope.
```

## File Naming

Use kebab-case for plan doc filenames: `docs/<descriptive-name>-plan.md`

Examples: `infisical-migration-plan.md`, `monitoring-upgrade-plan.md`, `multi-node-swarm-plan.md`
