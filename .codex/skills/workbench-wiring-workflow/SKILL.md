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

Every non-trivial wiring slice must name the loop it touches:

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
   - Output: slice graph with `parallel_batches[]`, `dependencies`, `serial_blockers`, `write_scope`, `test_scope`, source refs, and contract seeds.

2. Slice gate
   - Main session reads the slice graph.
   - Independent slices in the same `parallel_batch` may fan out to multiple same-role agent instances.
   - Shared files such as `workbenchFlowService.ts`, `WorkbenchTab` types, stores, repositories, and container wiring are serial locks.

3. `agent:contract-designer`
   - Input: one wiring slice payload.
   - Output path: `docs/archive/daily-design/YYYY-MM-DD/<task-name>/test-contract-v0.N.md`.
   - Must cite active source truth.
   - Must list control event, container handler, controller command, service/repository boundary, store before/after, projection result, allowed side effects, forbidden side effects, and manual acceptance.

4. `agent:contract-auditor`
   - Blocks contracts that blur layer ownership or allow mocking the production subject under test.

5. `$test-writer`
   - Writes state-forward and state-return tests from the approved contract.
   - Must include a harness/mock manifest.
   - May run in parallel only with disjoint `test_scope`.

6. `agent:test-auditor`
   - Rejects callback-only fake green tests, wrong-layer mocks, reverse-contract tests, and tests that manually mutate asserted state.

7. `$implementation-agent`
   - Implements minimal wiring against approved contract/tests.
   - Keeps presentational panels presentational.
   - Shared production files require one integrator.

8. `agent:architecture-reviewer`
   - Reviews boundary leaks, duplicate state, hidden globals, direct service imports in UI components, and weak tests.
   - Must trace at least one UI event to projected UI update loop.

Use `agent:visual-fidelity-reviewer` only if wiring changed visible layout or visual behavior enough to risk a UI regression.
