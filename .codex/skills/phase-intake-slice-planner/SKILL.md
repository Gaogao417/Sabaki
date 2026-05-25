---
name: phase-intake-slice-planner
description: Sabaki lightweight read-only planner that turns phase/plan/gaps/cleanup/partial requests into an executable step plan with explicit parallel branches.
---

# Phase Intake / Slice Planner

Use this skill inside the selected workflow before contract design when the request is phase-level, plan-level, gaps/cleanup/partial, crosses data/service/state/UI/legacy boundaries, or prior similar work exceeded 10 minutes in test writing or implementation.

This skill is read-only except for an optional `slice-plan.md` or JSON planning artifact. It does not write full contracts, tests, or production code.

Its job is scheduling, not ceremony: decompose the user request into `step1..stepN`. If a step has parallel work, write it as `step2.1..step2.N`. Do not replace separable steps with one umbrella step unless the work is truly indivisible.

## Output

Return a compact plan with:

- source truth refs
- current state / remaining gaps
- out of scope
- step list
- shared locks / integrators
- verification notes

The step list is the scheduling contract. Always use this shape:

```text
Step | Do | Mode | Depends on | Can run with | Locks / owner | Next role
```

Use top-level steps for serial order:

```text
step1
step2
step3
```

Use dotted substeps for parallel work inside a step:

```text
step2.1
step2.2
step2.3
```

All `step2.x` entries are parallel unless their `Depends on` or `Locks / owner` says otherwise. If several parallel branches need the same file, create a later serial integrator step, for example `step3 integrate container wiring`.

Downstream work receives one step payload per worker or main-session pass. The main session should fan out ready dotted substeps before creating a new umbrella step.

## Step Size

A step is small enough only when it protects one core behavior or one state-transition family, has one primary production owner, preferably touches at most 3 production files and 2 test files, suggests at most 8 contract rows, has no unresolved source conflict, and does not mix schema, state machine, legacy deprecation, UI routing, and regression repair in one bundle.

Mark oversized bundles `SPLIT_REQUIRED`; do not hide an oversized bundle behind an umbrella step.
