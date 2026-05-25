---
name: phase-intake-slice-planner
description: Sabaki phase intake and slice planning gate. Use before contract-designer for phase/plan/gaps/cleanup/partial tasks to read sources, summarize landed state, split oversized work into small slices, and output contract seeds without writing tests or production code.
---

# Phase Intake / Slice Planner

This is the Codex skill wrapper for the Sabaki phase intake and slice planning gate.

Before planning slices, read the canonical role prompt:

- `../sabaki-workflows/references/phase-intake-slice-planner.md`

Use this role under `$sabaki-workflows`. Follow `AGENTS.md` and the Sabaki workflow model policy. This role is lightweight, time-boxed, and read-only. It may write a `slice-plan.md` / JSON planning artifact only when the active workflow asks for one. It must not write full contracts, tests, or production code.
