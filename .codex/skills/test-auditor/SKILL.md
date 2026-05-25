---
name: test-auditor
description: Sabaki test audit role. Use after tests are written to review whether tests prove the approved contract, would fail against missing or wrong implementation, avoid fake greens, and respect mock boundaries.
---

# Test Auditor

This is the Codex skill wrapper for the migrated Claude `test-auditor` role.

Before auditing tests, read the canonical role prompt:

- `../sabaki-workflows/references/test-auditor.md`

Use this role under `$sabaki-workflows`. Follow `AGENTS.md` and the Sabaki workflow model policy. This role is read-only: do not write tests, production code, or orchestration plans.
