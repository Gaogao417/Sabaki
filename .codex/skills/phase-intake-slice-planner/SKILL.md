---
name: phase-intake-slice-planner
description: Sabaki lightweight read-only planner that turns phase/plan/gaps/cleanup/partial requests into an executable step plan with explicit parallel branches and a persistent task checklist artifact.
---

# Phase Intake / Slice Planner

Use this skill inside the selected workflow before contract design when the request is phase-level, plan-level, gaps/cleanup/partial, crosses data/service/state/UI/legacy boundaries, or prior similar work exceeded 10 minutes in test writing or implementation.

This skill is read-only except for the task checklist artifact. It does not write full contracts, tests, or production code.

Its job is scheduling, not ceremony: decompose the user request into `step1..stepN`. If a step has parallel work, write it as `step2.1..step2.N`. Do not replace separable steps with one umbrella step unless the work is truly indivisible.

## Output

The planner MUST produce two things:

### 1. Compact planning summary

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

### 2. Task checklist artifact

The planner MUST write a task checklist file to:

```
docs/.workflow-checklist.md
```

This file is the single source of truth for workflow progress. The main agent reads it to know what to do next and updates it after each step completes.

Format:

```markdown
# Workflow Checklist

- workflow: <business-contract-workflow | workbench-wiring-workflow | frontend-visual-workflow>
- task: <one-line task description>
- created: <YYYY-MM-DD>
- source_truth: <refs to PRD/architecture/spec docs>

## Steps

- [ ] step1: <description> — role: <contract-designer | frontend-design-source-reader | ...> — mode: serial
- [ ] step2.1: <description> — role: <...> — mode: parallel — scope: <files>
- [ ] step2.2: <description> — role: <...> — mode: parallel — scope: <files>
- [ ] step3: <description> — role: <...> — mode: serial — depends_on: step2.1, step2.2
- [ ] step4: commit tests
- [ ] step5: <description> — role: implementation-agent
- [ ] step6: run tests
- [ ] step7: commit implementation
- [ ] step8: architecture review

## Retries

(none)
```

Rules for the checklist:

- Every step from the planning summary must appear as a checklist item.
- `- [ ]` means pending; `- [x]` means completed.
- The main agent MUST check off a step immediately after it completes (success or retry-exhausted).
- If a review step returns REQUEST_CHANGES, add a retry entry under `## Retries` and re-dispatch the upstream step. Do NOT stop or wait for user confirmation.
- Maximum 3 retries per step. After 3 retries, mark the step `[x]` with a note `FAILED after 3 retries` and stop the workflow.
- The main agent reads this file at the start of every turn to find the first unchecked step.

## Step Size

A step is small enough only when it protects one core behavior or one state-transition family, has one primary production owner, preferably touches at most 3 production files and 2 test files, suggests at most 8 contract rows, has no unresolved source conflict, and does not mix schema, state machine, legacy deprecation, UI routing, and regression repair in one bundle.

Mark oversized bundles `SPLIT_REQUIRED`; do not hide an oversized bundle behind an umbrella step.
