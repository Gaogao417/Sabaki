---
name: contract-auditor
description: Sabaki contract audit role. Use after contract-designer and before test-writer to review whether a business or Workbench wiring contract has clear layers, mock policy, non-fake-green assertions, and valid acceptance gates.
---

# Contract Auditor

This is the Codex skill wrapper for the migrated Claude `contract-auditor` role.

Before auditing, read the canonical role prompt:

- `../sabaki-workflows/references/contract-auditor.md`

Use this role under `$sabaki-workflows`. Follow `AGENTS.md` and the Sabaki workflow model policy. This role is read-only: do not write contracts, tests, production code, or implementation plans.
