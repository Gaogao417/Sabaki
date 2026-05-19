# Workbench Wiring Completion Plan and Parallelism

Date: 2026-05-19
Status: draft

## Goal

Connect the finished Workbench UI to the finished training services/stores through a testable wiring layer.

## Source Of Truth

This document is a planning aid only. It is not a product or architecture source of truth.

The only product and architecture sources of truth are:

1. `docs/design/gabaki-sabaki-training-prd-v0.5.md`
2. `docs/design/gabaki-sabaki-training-architecture-v0.5.md`
3. `docs/design/workbench-ui-ux-spec.md`, only for visible UI/control placement after the two sources above.

If any phase, task split, command name, owner, or suggested implementation in this document conflicts with PRD v0.5 or Architecture v0.5, this document is wrong and must be updated before work continues.

The target loop is:

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

## Prerequisite: Goban/Overlay State Matrix

Before Phase W3 board interaction wiring begins, all workers must reference:

- `docs/design/2026-05-19/workbench-wiring/goban-overlay-state-matrix-v0.1.md`

This document defines the contract for how each WorkbenchMode controls Goban event bindings and overlay rendering. It covers:

- Event binding matrix (click/drag/hover → intent per mode)
- Overlay activation matrix (which visual layers are active per mode)
- Goban props projection by mode
- Mode transition effects on Goban state
- Current wiring gaps (GAP-G1 through GAP-G7)

Phase W3–W6 board interaction wiring must follow the bindings and overlays defined in this matrix. If implementation reveals a conflict between the matrix and PRD/Architecture v0.5, the matrix must be updated before implementation continues.

## Completion Plan

### Phase W0: Control Inventory and Command Map

Deliverables:

- Read and cite PRD v0.5 and Architecture v0.5 before listing commands.
- Inventory every control in `src/components/workbench/**` and `src/components/WorkbenchShell.js`.
- Mark each control as active, display-only, disabled, or deferred.
- Define command names and payloads.
- Assign one owner for each command:
  - presentational component
  - `TrainingWorkbenchContainer`
  - controller
  - service
  - existing Sabaki command

Acceptance:

- No control has an ambiguous owner.
- Every owner is traced to Architecture v0.5, not inferred from current component shape.
- Deferred controls have a reason and later exit condition.

### Phase W1: Projection and Subscription Foundation

Deliverables:

- Define stable projection from `runtimeStore`, `workbenchStore`, Sabaki state, and engine state into WorkbenchShell props.
- Test that store updates cause container rerender/projection changes.
- Remove or quarantine hardcoded demo state where it blocks real projection.

Acceptance:

- `runtimeStore.setRecallView`, `runtimeStore.setProblemView`, and `workbenchStore.setTabs` can update visible props through subscription.
- Panels remain presentational.

### Phase W2: Shell and Tab Wiring

Deliverables:

- Route shell actions through container/controller or existing Sabaki commands.

- Wire mode bar, training tab bar, game tab bar, add/close/select tab controls, and bottom bar shared controls.
Acceptance:

- Mode/tab actions update the correct store/Sabaki state.
- UI projection updates after state changes.

### Phase W3: Problem Mode Wiring

Deliverables:

- Wire problem start/open/import controls.
- Wire problem area controls.
- Wire submit, undo, exit, opponent controls, and attempt result projection.
- Ensure problem remains a workbench workflow, not a board mode.

Acceptance:

- Problem controls update `problemView`, attempt state, repository state, and projected panel state as contracted.
- No direct service imports in problem panels.

### Phase W4: Recall Mode Wiring

Deliverables:

- Wire start/session controls, hint, skip, end, checkpoint actions, and progress projection.
- Ensure recall answers do not become formal game-tree moves.

Acceptance:

- Recall controls update `recallView`, checkpoint/session state, and projected panel state.
- Store subscription drives progress/completion UI.

### Phase W5: Analysis Mode Wiring

Deliverables:

- Wire snapshot, reference/current, key point, annotation, analysis result, and review/bad-move derivation actions.
- Keep scratch/reference state separate from formal game-tree state.

Acceptance:

- Analysis actions update snapshot/runtime/workbench state through services/adapters.
- Scratch/reference actions do not mutate formal SGF unless explicitly contracted.

### Phase W6: Review Queue and Derived Task Wiring

Deliverables:

- Wire due review queue, advance review, generated bad-move task open, and review completion state.
- Project review queue status into header/panels.

Acceptance:

- Review queue view updates after controller/service actions.
- Generated task links are persisted and open through tab/workbench services.

### Phase W7: Architecture Review and Manual App Pass

Deliverables:

- Run targeted tests and `npm test`.
- Architecture review of boundary leaks and weak tests.
- Manual click-through of play/problem/recall/analysis/review.

Acceptance:

- Relevant tests pass.
- No panel imports training services, repository, `sabaki`, or `window.sabaki`.
- Stores remain pure.
- User-visible state follows backend state, not local demo state.

## Parallel Task Suggestions

### Batch A: Discovery

Run in parallel:

| Task | Writes | Notes |
| --- | --- | --- |
| Control inventory | docs only | Enumerates components and controls |
| Current wiring audit | docs only | Finds existing callbacks, hardcoded props, missing handlers |
| Boundary scan | docs only | Searches for service imports, `window.sabaki`, duplicated state |

Do not implement production code in this batch.

### Batch B: Test Contracts by Slice

Run in parallel after W0 command names are agreed:

| Task | Writes | Notes |
| --- | --- | --- |
| Projection/subscription tests | `test/workbench/container/**` | Owns projection helpers |
| Shell/tab tests | `test/workbench/wiring/shell*.test.js` | Owns mode/tab/shared controls |
| Problem tests | `test/workbench/wiring/problem*.test.js` | Owns problem workflow |
| Recall tests | `test/workbench/wiring/recall*.test.js` | Owns recall workflow |
| Analysis tests | `test/workbench/wiring/analysis*.test.js` | Owns analysis/snapshot workflow |

Use one integrator for shared test helper changes.

### Batch C: Implementation by Layer

Run in parallel only after tests and command map exist:

| Task | Writes | Notes |
| --- | --- | --- |
| Controller commands | `src/modules/training/controller/**` | Owns orchestration |
| Container/projection | `src/components/TrainingWorkbenchContainer.js` | Owns handler mapping and projections |
| Panel callback plumbing | `src/components/WorkbenchShell.js`, `src/components/workbench/**` | Owns presentational pass-through |
| Service gap fixes | `src/modules/training/**` excluding controller/store | Only if tests reveal true service gaps |

Avoid two workers editing `TrainingWorkbenchContainer.js` or the same controller file.

### Batch D: Verification

Run in parallel:

| Task | Writes | Notes |
| --- | --- | --- |
| Test runner | none | Runs targeted tests then `npm test` |
| Architecture review | none | Reviews boundaries and test legitimacy |
| Manual workflow pass | notes only | Clicks app workflows and records gaps |

## Integration Rules

- One active integrator owns merges between parallel workers.
- Each worker lists changed files and the command names it touched.
- Shared command names are decided before implementation.
- Visual changes are out of scope unless needed to expose real backend state.
- Any no-op control must be documented as deferred, disabled, or display-only.

## Risk Register

| Risk | Mitigation |
| --- | --- |
| Tests only prove callback calls | Require store before/after and projection assertions |
| Panels import services directly | Architecture review plus static boundary tests |
| Container becomes a domain service | Keep orchestration in controller and services |
| Duplicate local state diverges from store | Projection tests and no long-lived mirrored state |
| Recall/scratch mutates formal game tree | Side-effect tests for game-tree isolation |
| Parallel workers conflict in container/controller | Assign single owner per file family |
