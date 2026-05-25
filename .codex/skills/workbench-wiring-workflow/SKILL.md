---
name: workbench-wiring-workflow
description: Sabaki Workbench wiring workflow. Use when already-drawn Workbench UI must be connected to training domain behavior and state.
---

# Workbench Wiring Workflow

Use this workflow when Workbench UI already exists visually and the task is to connect controls to training domain behavior.

This workflow proves that user actions change backend state and backend state projects back into UI. It is not for pure visual fidelity; use `$frontend-visual-workflow` for that.

## Source Of Truth

Use current documents in this priority order:

1. `docs/product/`
2. `docs/architecture/`
3. `docs/ui_ux/`

Generated contracts, plans, tests, inventories, and archived docs are derived artifacts. They must not override active source truth.

## Required State Loop

Every non-trivial wiring step must name the loop it touches:

```text
UI control event
  -> WorkbenchShell / panel callback prop
  -> TrainingWorkbenchContainer handler
  -> controller command
  -> service / adapter / repository
  -> runtimeStore / workbenchStore / Sabaki state
  -> container subscription
  -> projection into props
  -> UI state update
```

## Role Order And Interfaces

1. `$phase-intake-slice-planner`
   - Required for phase/plan/gaps/cleanup/partial/cross-boundary wiring requests.
   - Output: executable `step1..stepN` plan. Parallel work is written as dotted substeps such as `step2.1..step2.N`.
   - The planner output is the dispatch plan. It must say what each step does, whether it is serial or parallel, dependencies, shared locks/owner, and the next role.

2. Step dispatch
   - Main session reads the planner step plan and starts the next ready dotted step group.
   - Independent dotted steps such as `step2.1..step2.N` should fan out to multiple same-role agent instances.
   - Do not collapse multiple ready steps into one umbrella contract unless the planner marks them indivisible.
   - Shared files such as `workbenchFlowService.ts`, `WorkbenchTab` types, stores, repositories, and container wiring are serial locks; assign one later integrator step for those files.

3. `agent:contract-designer`
   - Input: one wiring step payload.
   - Output path: `docs/archive/daily-design/YYYY-MM-DD/<task-name>/test-contract-v0.N.md`.
   - Must cite active source truth.
   - Must list control event, container handler, controller command, service/repository boundary, store before/after, projection result, allowed side effects, forbidden side effects, and manual acceptance.

4. `agent:contract-auditor`
   - Blocks contracts that blur layer ownership or allow mocking the production subject under test.

5. `$test-writer`
   - Writes state-forward and state-return tests from the approved contract.
   - Must include a harness/mock manifest.
   - May run in parallel only for dotted steps in the same ready group with disjoint test scope; otherwise use the named test integrator step.

6. `agent:test-auditor`
   - Rejects callback-only fake green tests, wrong-layer mocks, reverse-contract tests, and tests that manually mutate asserted state.

7. `$implementation-agent`
   - Implements minimal wiring against approved contract/tests.
   - Keeps presentational panels presentational.
   - May run in parallel only for dotted steps in the same ready group with disjoint write scope.
   - Shared production files require one named integrator step; other workers must avoid those files or wait for the integrator handoff.

8. `agent:architecture-reviewer`
   - Reviews boundary leaks, duplicate state, hidden globals, direct service imports in UI components, and weak tests.
   - Must trace at least one UI event to projected UI update loop.

Use `agent:visual-fidelity-reviewer` only if wiring changed visible layout or visual behavior enough to risk a UI regression.
