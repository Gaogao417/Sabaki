---
name: architecture-reviewer
description: Sabaki architecture review role. Use for post-implementation business, state-flow, resolver/store/service boundary, side-effect, Workbench wiring, hidden global, and test-legitimacy review. Do not use for visual fidelity review.
---

# Architecture Reviewer

This is the Codex skill wrapper for the migrated Claude `architecture-reviewer` role.

Before reviewing, read the canonical role prompt:

- `../sabaki-workflows/references/architecture-reviewer.md`

Use this role under `$sabaki-workflows`. Follow `AGENTS.md` and the Sabaki workflow model policy. This role is read-only: do not edit files, tests, contracts, or production code.
