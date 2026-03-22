---
name: code-review
description: Perform thorough code review of branch commits, identifying AI slop, redundant code, potential errors, architectural issues, duplicates, and premature optimizations. Generate detailed markdown report with findings and recommendations. Use when reviewing code quality, preparing for PR creation, or when user asks to review code or check commits before merging.
metadata:
  author: mau
  version: "1.0.0"
  category: Code Quality
allowed-tools: Bash(git log:*) Bash(git diff:*) Bash(git branch:*) Read Grep Glob Task(*) Edit Write(code-review-*.md) AskUserQuestion
---

# Code Review for Branch Commits

Structured workflow for reviewing commits on the current branch, focusing on code quality, consistency, and architectural soundness.

## Workflow

### Step 1: Identify Scope

Extract ticket ID from current branch:

```bash
git branch --show-current
# commitizen type of commits
```

Get changed files:

```bash
git log main...HEAD --oneline
git diff main...HEAD --name-only
git diff main...HEAD --stat
```

Auto-detect ticket ID from branch name. If detection fails or user wants to focus on specific areas, use AskUserQuestion to clarify scope.

Also detect the base branch — try `main`, then `master`, then `develop`/`dev`. If none exist, ask the user.

### Step 2: Launch Parallel Review Agents

Use the Task tool to spawn three specialized review agents in parallel to analyze the changes:

Each agent is a senior code reviewer focused on different quality dimensions:

**Agent 1 — Codebase Consistency Reviewer**

- Identify duplicate logic across files that should be consolidated
- Find similar patterns that should use existing utilities or helpers
- Check for reimplementation of functionality that already exists in the codebase
- Scan the project structure and any architecture docs (README, CONTRIBUTING, docs/) to understand conventions
- Flag type duplicates that should use shared types
- Identify inconsistent naming conventions or coding patterns compared to the rest of the codebase

**Agent 2 — Architecture & Clean Code Reviewer**

- Single Responsibility: Components/functions/classes doing too much
- Import/module boundaries: Violations of the project's layering or module structure
- Separation of concerns: Business logic leaking into presentation or transport layers
- Abstraction levels: Appropriate complexity for the problem being solved
- Method/function length and deeply nested conditionals
- Premature abstractions or over-engineering for the current requirements
- Consistent error propagation strategy (exceptions vs result types vs error codes)

**Agent 3 — Completeness & Quality Auditor**

- Missing error handling and edge cases
- Type safety issues (any types, missing null checks, unsafe casts)
- Security: XSS, SQL injection, command injection, exposed secrets, unsafe evals, path traversal
- Performance: N+1 queries, unnecessary iterations, missing indexes, unbounded data fetches
- Missing tests for new or changed functionality
- Test quality: meaningful assertions vs coverage theater, tests that only test mocks
- Incomplete implementations (TODOs, placeholder logic, half-finished features)
- AI slop: over-commented obvious code, generic placeholder comments, verbose boilerplate that adds no value
- Dead code and unused imports
- For bug fixes, assess whether the fix addresses the root cause or merely masks the symptom

### Step 3: Reconcile and Generate Report

After all agents complete:

**3.1 Reconcile Findings**

1. Read all agent outputs and identify overlapping findings
2. Deduplicate issues (same file + same line range = same issue)
3. For conflicting severity assessments, use the highest severity
4. Consolidate similar issues under one entry with multiple examples

**3.2 Generate Report File**

1. Fill in the report using the template structure below
2. **CRITICAL**: Use Write tool to create `code-review-[TICKET-ID]-[timestamp].md` in project root
3. Confirm to user that report has been generated with clickable link to the file

## Report Template

```markdown
# Code Review: [TICKET-ID]

**Branch**: `[branch-name]`
**Commits reviewed**: [count]
**Files changed**: [count]
**Date**: [timestamp]

## Summary

[1-2 sentence overview of the changes and overall quality assessment]

## Findings

### Critical
<!-- Security issues, breaking changes, boundary violations, data loss risks -->

### High
<!-- Code duplication, missing tests, architectural problems, incomplete implementations -->

### Medium
<!-- Minor improvements, edge cases, style inconsistencies, suboptimal patterns -->

### Low
<!-- Nitpicks, naming, minor documentation -->

## Recommendations

[Prioritized list of what to address before merging vs. what can be follow-up work]
```

## Severity Levels

- **Critical**: Security issues, breaking changes, module boundary violations, data loss risks
- **High**: Code duplication across files, missing tests for critical paths, architectural problems, incomplete implementations
- **Medium**: Minor improvements, unhandled edge cases, style inconsistencies, suboptimal patterns
- **Low**: Nitpicks, comments, naming suggestions, minor documentation gaps

## Review Principles

- **Parallel analysis**: Use multiple agents to cover different dimensions simultaneously
- **Focus on architecture**: Correctness, maintainability, consistency with existing codebase
- **Be specific**: File paths, line numbers, concrete examples, actionable recommendations
- **Explain impact**: Why issues matter, not just what they are
- **Prioritize appropriately**: Not everything blocks a merge — distinguish blockers from nice-to-haves
- **Respect existing patterns**: Flag deviations from established project conventions, not personal preferences

### Error Scenarios

Handle these gracefully:

- **No changes detected**: `git diff` returns empty → inform user branch is up to date with base
- **Ticket ID extraction fails**: Branch doesn't match common patterns → use `AskUserQuestion` to get ticket ID
- **Base branch unclear**: Neither `main`, `master`, nor `dev` exist → ask the user which branch to diff against
- **All agents report no findings**: Generate minimal report stating "No issues found"
- **Git command errors**: Report error to user and suggest possible fixes (e.g., not inside a git repo)

## Output

**File**: `code-review-[TICKET-ID]-[timestamp].md` in project root
**Format**: Markdown with clickable file paths and line references
**Content**: Consolidated findings from all review agents with clear, prioritized recommendations
