Date: 2026-05-21
Status: pending-confirmation

# P0 Mock Contract Drift Remediation -- Wiring Test Contract v0.1

# 0. True Source Alignment

| True Source | Section / Line Index | Constraint on this Contract |
|---|---|---|
| PRD v0.5 SS2.5 | "Recall is obstructed active research" | Recall board click must submit a move through `recallService`, not a dead synchronous stub. |
| PRD v0.5 SS4.8 RecallSession | `expectedMoves: string[]`, `currentMoveIndex: number` | Recall move must advance `currentMoveIndex` on correct answer, stay on incorrect. |
| PRD v0.5 SS4.9 RecallAttempt | `userMove: string`, `expectedMove: string`, `isCorrect: boolean` | Recall answer must be compared as SGF string, not vertex tuple. |
| PRD v0.5 SS5.3 Recall Checkpoint | "submitRecallMove -> if major/severe BadMove -> startCheckpoint" | After correct move, `recallService` checks `shouldTriggerCheckpoint`. |
| PRD v0.5 SS5.5 Snapshot | "Snapshot is a global action" | Snapshot must work in every mode; must not crash when tab has no taskId. |
| PRD v0.5 SS2.6 Analysis | "Only Snapshot creates new TrainingTask" | Snapshot must create a new TrainingTask, not mutate the current one. |
| Arch v0.5 SS0.3 | "snapshotService does not open Tab" | Snapshot tab opening is `workbenchFlowService`'s job. |
| Arch v0.5 SS5.8 RecallService API | `submitRecallMove(input: {recallSessionId: string, userMove: string}): Promise<RecallAttempt>` | Executor must call this exact API, not `submitRecallAnswer`. |
| Arch v0.5 SS5.10 SnapshotService API | `captureSnapshotInput(input: {tabId, mode, analysisContext?, reason?})` | Real API takes `tabId` + `mode`, not `sourceTaskId`. Current production code uses a divergent signature. |
| Arch v0.5 SS5.3 WorkbenchFlowService | `snapshotFromCurrentContext(input: {tabId, reason?})` | Flow service must orchestrate snapshot; guard against null taskId before calling snapshotService. |
| Arch v0.5 SS9.5 Recall Checkpoint | "RecallModeController.handleRecallMove(userMove) -> recallService.submitRecallMove" | Controller must be async and await the service call. |
| Arch v0.5 SS9.7 Snapshot | Full chain: "SnapshotButton -> flowService.snapshotFromCurrentContext -> snapshotService.captureSnapshotInput -> taskImportService -> tabService.openTask" | The complete chain must not crash on free-play tabs. |
| Arch v0.5 SS1.3 Dependency Rules | "Store does not depend on Service; Service can depend on Store/Repository/Adapter" | Executor calls Service, never Store directly. |
| Arch v0.5 SS14 Architecture Red Lines | "origin does not participate in main flow judgment" | Free-play tabs (no taskId) are a legitimate use case, not a source-based exception. |

**UI/UX spec reference**: Recall Mode SS6.5 mentions "Recall progress" and "current checkpoint" UI -- relevant only for projection return testing, not for the executor/service contract itself.

# 1. User Story

**ISSUE-01**: As a user in Recall mode, when I click the board to reproduce my move sequence, my click should be submitted to the real `recallService.submitRecallMove` as an SGF coordinate string, compared against `expectedMoves`, and produce a `RecallAttempt` record. The board click should not silently vanish.

**ISSUE-02**: As a user on a free-play tab (no taskId), when I click "Snapshot", the system should either gracefully create a snapshot from the current position (without requiring a source task) or show a controlled error message. It should not throw an unhandled crash.

# 2. User Actions

1. User clicks a board intersection while in Recall mode (`tab.mode === 'recall'`).
2. User clicks the Snapshot button (or triggers the Snapshot shortcut) while on a free-play tab (`tab.taskId` is null/undefined).

# 3. Current Phase

Recall and Snapshot are active Workbench phases. These are production bugs, not new features.

# 4. Location Source

| Issue | Location Source | Detail |
|---|---|---|
| ISSUE-01 | `recall-session` | Recall operates on `activeRecallSessionId` within the active tab. The `expectedMoves` come from the frozen Attempt's `userLine`. |
| ISSUE-02 | `current-position` | Snapshot captures the current board position via `positionSnapshotAdapter`. For free-play, there is no parent task. |

# 5. Mutation Contract

| Issue | Contract | Notes |
|---|---|---|
| ISSUE-01 | `recallAnswer` | User submits a recall move. Must NOT modify the game tree. Must create a `RecallAttempt` in the repository. Must advance `currentMoveIndex` on correct answer. |
| ISSUE-02 | `snapshot` | Creates a new `TrainingTask` from the current position. Must NOT mutate the current tab's task. Must handle the case where there is no current task. |

# 6. Expected State Flow

## ISSUE-01: Recall Board Click

### Full Chain

```
Goban.handleVertexMouseUp:282
  -> onVertexClick(evt)                    // evt.vertex = [number, number]
  -> TrainingWorkbenchContainer shellProps.boardProps.handlerProps.onVertexClick
  -> controller.handleBoardClick({
       vertex, event, activeTab, settings, board,
       editWorkspacePresent, task, runtimeState
     })
  -> boardInteractionController.handleBoardClick(input)
  -> toWorkbenchMode(activeTab.mode)       // => 'recall'
  -> createBoardInteractionContext({...})   // builds resolverInput
  -> resolveBoardInteraction(resolverInput) // pure, returns BoardInteractionResult
  -> result.status === 'resolved'
  -> result.mutationContract === 'recallAnswer'
  -> deps.getRecallServiceOrStore()        // must return real recallService, not fallback
  -> executeRecallInteraction(result, {}, {recallService})
     // FIXED: executor is now async
     -> const userMove = vertexToSgf(vertex)           // [3,3] -> "dd"
     -> const recallSessionId = activeTab.activeRecallSessionId
     -> const recallAttempt = await recallService.submitRecallMove({
          recallSessionId,
          userMove
        })
     -> return {
          handled: true,
          changed: true,
          isCorrect: recallAttempt.isCorrect,
          recallMoveIndex: recallAttempt.moveNumber,
          attempt: recallAttempt,
        }
  <- controller returns result to Container
  <- Container projection picks up store changes via subscription
  <- UI updates: Recall progress, checkpoint state if triggered
```

### State Advancement

| State Change | Owner | Evidence |
|---|---|---|
| `repository.createRecallAttempt(recallAttempt)` | `recallService.submitRecallMove` | Arch v0.5 SS5.8 |
| `repository.updateRecallSession(id, {currentMoveIndex: moveIndex + 1})` | `recallService.submitRecallMove` (on correct answer only) | Arch v0.5 SS5.8 |
| `runtimeStore.setActiveCheckpoint(checkpointId)` | `recallService.submitRecallMove` (if checkpoint triggered) | Arch v0.5 SS9.5 |
| No change to `documentStore`, no game tree modification | executor constraint | PRD v0.5 SS2.5, Arch v0.5 SS0.3 |

### Error Paths

| Error Condition | Expected Behavior |
|---|---|
| `activeTab.activeRecallSessionId` is undefined | Executor returns `{handled: false, changed: false, reason: 'no active recall session'}`. No crash. |
| `recallService.submitRecallMove` throws "session not found" | Controller catches error, returns `{handled: false, changed: false, reason: error.message}`. No unhandled crash. |
| `recallService.submitRecallMove` throws "session already completed" | Same: controlled error return. |
| `recallService.submitRecallMove` throws "checkpoint active" | Same: controlled error return. |
| User clicks rapidly (race condition) | Executor must be awaited; controller must handle concurrent clicks gracefully. |

## ISSUE-02: Snapshot on Free-Play Tab

### Full Chain

```
SnapshotButton.onClick (or keyboard shortcut)
  -> TrainingWorkbenchContainer.handleSnapshot()
  -> if (!activeTab) return                     // existing guard
  // NEW GUARD NEEDED: handle taskId === null
  -> flowService.snapshotFromCurrentContext(activeTab.id)
  -> workbenchFlowService.snapshotFromCurrentContext(tabId)
     -> const tab = getTab(tabId)
     // CURRENT BUG: tab.taskId is null, passed directly to snapshotService
     // FIX: guard before calling snapshotService
     -> if (!tab.taskId) {
          // Option A: skip snapshotService, build snapshotTask directly from positionSnapshotAdapter
          // Option B: throw controlled error
          // Option C: make snapshotService.captureSnapshotInput accept optional sourceTaskId
        }
     -> snapshotService.captureSnapshotInput({tabId, sourceTaskId: tab.taskId})
     // CURRENT: sourceTaskId is typed as string (non-optional), crashes on null
     // FIXED: sourceTaskId becomes optional; snapshotService handles absent source task
     -> repository.createTask(snapshotTask)
     -> tabService.openTask({taskId, mode: 'problem', parentTabId: tabId})
  <- new tab opened
  <- Container subscription picks up new tab in workbenchStore
  <- UI renders new problem tab
```

### State Advancement

| State Change | Owner | Evidence |
|---|---|---|
| `repository.createTask(snapshotTask)` with `origin.provider = 'snapshot'` | `workbenchFlowService` | Arch v0.5 SS9.7 |
| `workbenchStore.addTab(newTab)` | `tabService.openTask` | Arch v0.5 SS5.2 |
| `workbenchStore.setActiveTab(newTabId)` | `tabService.openTask` | Arch v0.5 SS5.2 |
| No change to current tab's taskId or mode | constraint | Arch v0.5 SS14 |

### Error / Guard Paths

| Condition | Expected Behavior |
|---|---|
| `activeTab.taskId` is null/undefined | `workbenchFlowService` builds snapshotTask using `positionSnapshotAdapter` directly, with `origin.parentTaskId` set to undefined. No crash. |
| `activeTab.taskId` exists | Current happy path preserved. `snapshotService.captureSnapshotInput` loads task for origin metadata. |
| `snapshotService.captureSnapshotInput` called with `sourceTaskId: undefined` | Must not throw. Must not call `repository.loadTask(undefined)`. Must return a valid `ProblemSnapshotInput` with `sourceTaskId` omitted. |
| `positionSnapshotAdapter.captureCurrentPosition()` fails | Controlled error propagated to Container; no unhandled crash. |

# 7. Allowed Side Effects

| Side Effect | Boundary | Owner |
|---|---|---|
| `repository.createRecallAttempt(...)` | SERVICE_REPOSITORY_TRANSITION | `recallService.submitRecallMove` |
| `repository.updateRecallSession(...)` | SERVICE_REPOSITORY_TRANSITION | `recallService.submitRecallMove` |
| `checkpointService.startCheckpoint(...)` | SERVICE_REPOSITORY_TRANSITION | `recallService.submitRecallMove` |
| `runtimeStore.setActiveCheckpoint(...)` | STORE_SUBSCRIPTION | `recallService.submitRecallMove` |
| `repository.createTask(snapshotTask)` | SERVICE_REPOSITORY_TRANSITION | `workbenchFlowService.snapshotFromCurrentContext` |
| `workbenchStore.addTab(newTab)` | STORE_SUBSCRIPTION | `tabService.openTask` |
| `workbenchStore.setActiveTab(newTabId)` | STORE_SUBSCRIPTION | `tabService.openTask` |

# 8. Forbidden Side Effects

| Forbidden Side Effect | Reason |
|---|---|
| Executor writing directly to `documentStore` or game tree during recall | PRD v0.5 SS2.5: recall is read-only against the game tree |
| Container writing directly to `workbenchStore` or `trainingRuntimeStore` | Arch v0.5 SS0.3: "UI does not write business Store" |
| `snapshotService` opening a tab | Arch v0.5 SS5.10: "SnapshotService does not create Tab" |
| Executor calling `trainingStore.submitRecallAnswer` | Dead API; must be removed |
| Container fallback `{submitRecallAnswer: () => ({handled: false})}` | Silent click swallower; must be removed |
| `repository.loadTask(null)` or `repository.loadTask(undefined)` | Must be guarded before calling |
| Any module importing `window.sabaki` for recall/snapshot logic | Arch v0.5 SS0.3: forbidden global lookup |

# 9. Test / Acceptance Contract Table

| ID | Type | Classification | Contract | Importance | Omission Risk |
|---|---|---|---|---|---|
| P0-T01 | CONTROLLER_STATE_TRANSITION | MUST_AUTOMATE | Recall executor calls `recallService.submitRecallMove({recallSessionId, userMove: SGF_string})` with correct vertex-to-SGF conversion. Returns `{handled: true, isCorrect: <bool>, recallMoveIndex: <number>, attempt: <RecallAttempt>}`. | Critical | Without this, recall board clicks are dead. |
| P0-T02 | CONTROLLER_STATE_TRANSITION | MUST_AUTOMATE | Recall executor is async: `controller.handleBoardClick` awaits the executor result. No unhandled Promise. | Critical | Race conditions on rapid clicks. |
| P0-T03 | SIDE_EFFECT_BOUNDARY | MUST_AUTOMATE | Recall executor does NOT call `documentStore.playMove` or any game tree mutation. | Critical | Would corrupt the frozen attempt. |
| P0-T04 | SERVICE_REPOSITORY_TRANSITION | MUST_AUTOMATE | `recallService.submitRecallMove` with correct answer creates `RecallAttempt` in repository and advances `currentMoveIndex`. | Critical | Without this, recall progress does not advance. |
| P0-T05 | SERVICE_REPOSITORY_TRANSITION | MUST_AUTOMATE | `recallService.submitRecallMove` with incorrect answer creates `RecallAttempt` with `isCorrect: false` and does NOT advance `currentMoveIndex`. | High | Incorrect moves must allow retry. |
| P0-T06 | CONTROLLER_STATE_TRANSITION | MUST_AUTOMATE | When `activeTab.activeRecallSessionId` is undefined, recall executor returns `{handled: false, changed: false}` with a descriptive reason. No crash. | High | User sees no feedback otherwise. |
| P0-T07 | SERVICE_REPOSITORY_TRANSITION | MUST_AUTOMATE | When `recallService.submitRecallMove` throws (session not found, session completed, checkpoint active), controller catches the error and returns `{handled: false}`. No unhandled crash. | High | Runtime crash on edge cases. |
| P0-T08 | CONTAINER_DELEGATION | MUST_AUTOMATE | Container wires real `recallService` to `getRecallServiceOrStore`. The fallback `{submitRecallAnswer: () => ({handled: false})}` is removed. | Critical | Current dead path. |
| P0-T09 | SIDE_EFFECT_BOUNDARY | MUST_AUTOMATE | `workbenchFlowService.snapshotFromCurrentContext` on a tab with `taskId: null` does NOT crash. It either creates a snapshot task without a parent task, or returns a controlled error. | Critical | Current production crash. |
| P0-T10 | SERVICE_REPOSITORY_TRANSITION | MUST_AUTOMATE | `snapshotService.captureSnapshotInput` with `sourceTaskId: undefined` returns a valid `ProblemSnapshotInput` without calling `repository.loadTask(undefined)`. | Critical | Current crash on free-play. |
| P0-T11 | CONTROLLER_STATE_TRANSITION | MUST_AUTOMATE | `workbenchFlowService.snapshotFromCurrentContext` on a tab with valid `taskId` preserves existing behavior: creates task with `origin.provider: 'snapshot'`, `origin.parentTaskId: tab.taskId`. | High | Regression guard. |
| P0-T12 | SIDE_EFFECT_BOUNDARY | MUST_AUTOMATE | `snapshotService` does NOT open a tab. Tab opening is `tabService.openTask`'s responsibility. | High | Architecture boundary. |
| P0-T13 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | No production module in the recall click chain imports or uses `submitRecallAnswer`. The method name does not appear in executor, controller, or container code. | Critical | Zombie API elimination. |
| P0-T14 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | `ProblemSnapshotInput.sourceTaskId` is typed as `string | undefined` (optional), not `string` (required). | High | Type safety for free-play. |
| P0-T15 | CONTAINER_DELEGATION | MUST_AUTOMATE | Container `handleSnapshot()` guard: if `activeTab` is null, returns early. Existing behavior preserved. | Medium | Regression guard. |

# 10. Tests That Must Be Automated

### ISSUE-01 Tests

**P0-T01: Recall executor calls correct service API**

- **Layer**: `CONTROLLER_STATE_TRANSITION`
- **Production Subject**: `executeRecallInteraction` (migrated to `.ts`)
- **Real Dependencies**: real `recallService` backed by in-memory repository, real `trainingRuntimeStore`
- **Mocked Dependencies**: `positionSnapshotAdapter` (local tiny stub)
- **Mock Contract Source**: real production `RecallService` interface constrains the in-memory implementation
- **Forbidden Mocks**: must NOT mock `recallService.submitRecallMove` itself -- use a real `createRecallService` with in-memory repo
- **Primary Assertion**: Given vertex `[3, 3]`, the service receives `submitRecallMove({recallSessionId: 'rs_test', userMove: 'dd'})`. The returned `RecallAttempt.isCorrect` matches expected behavior.
- **Downstream Covered By**: P0-T04, P0-T05

**P0-T02: Recall executor chain is fully async**

- **Layer**: `CONTROLLER_STATE_TRANSITION`
- **Production Subject**: `boardInteractionController.handleBoardClick` for recall mode
- **Real Dependencies**: real `executeRecallInteraction` (async), real `recallService` with in-memory repo
- **Mocked Dependencies**: `documentStore` (local tiny stub -- not in recall path but required by controller deps shape)
- **Mock Contract Source**: local tiny stub for documentStore (not in recall path)
- **Forbidden Mocks**: must NOT mock `executeRecallInteraction` or `recallService`
- **Primary Assertion**: `handleBoardClick` returns a Promise that resolves (not a synchronous value). The resolved value contains `handled: true`.
- **Downstream Covered By**: P0-T01

**P0-T03: Recall executor does not modify game tree**

- **Layer**: `SIDE_EFFECT_BOUNDARY`
- **Production Subject**: `executeRecallInteraction` + `boardInteractionController.handleBoardClick` in recall mode
- **Real Dependencies**: real executor, real `recallService` with in-memory repo
- **Mocked Dependencies**: `documentStore` with spy `playMove` that records calls
- **Mock Contract Source**: local tiny stub with call counter
- **Forbidden Mocks**: must NOT mock `recallService.submitRecallMove`
- **Primary Assertion**: After a recall board click, `documentStore.playMove` was NOT called.
- **Downstream Covered By**: none (terminal assertion)

**P0-T04: Correct recall answer advances session index**

- **Layer**: `SERVICE_REPOSITORY_TRANSITION`
- **Production Subject**: `recallService.submitRecallMove` (real production function)
- **Real Dependencies**: real `createRecallService` with in-memory repository, real `trainingRuntimeStore`, real `recallCheckpointService` (with null-returning spy)
- **Mocked Dependencies**: `recallCheckpointService.shouldTriggerCheckpoint` returns null (no checkpoint); `logger` (local tiny stub)
- **Mock Contract Source**: real production `RecallCheckpointService` interface constrains the spy
- **Forbidden Mocks**: must NOT mock `repository.createRecallAttempt` or `repository.updateRecallSession`
- **Primary Assertion**: After submitting correct move, `repository.loadRecallSession(id).currentMoveIndex` is `previousIndex + 1`. A `RecallAttempt` with `isCorrect: true` exists in the repository.
- **Downstream Covered By**: none (terminal assertion)

**P0-T05: Incorrect recall answer does NOT advance session index**

- **Layer**: `SERVICE_REPOSITORY_TRANSITION`
- **Production Subject**: `recallService.submitRecallMove` (real)
- **Real Dependencies**: same harness as P0-T04
- **Mocked Dependencies**: same as P0-T04
- **Mock Contract Source**: same as P0-T04
- **Forbidden Mocks**: same as P0-T04
- **Primary Assertion**: After submitting incorrect move, `repository.loadRecallSession(id).currentMoveIndex` is unchanged. A `RecallAttempt` with `isCorrect: false` exists.
- **Downstream Covered By**: none (terminal assertion)

**P0-T06: Missing recallSessionId returns controlled error**

- **Layer**: `CONTROLLER_STATE_TRANSITION`
- **Production Subject**: `executeRecallInteraction` (migrated)
- **Real Dependencies**: none (pure executor logic)
- **Mocked Dependencies**: none needed
- **Mock Contract Source**: n/a
- **Forbidden Mocks**: must NOT create a mock `recallService` for this test
- **Primary Assertion**: When `recallSessionId` is not provided in the context, the executor returns `{handled: false, changed: false, reason: <string containing 'session'>}`. No exception thrown.
- **Downstream Covered By**: P0-T07

**P0-T07: Service error is caught by controller**

- **Layer**: `CONTROLLER_STATE_TRANSITION`
- **Production Subject**: `boardInteractionController.handleBoardClick`
- **Real Dependencies**: real controller
- **Mocked Dependencies**: `getRecallServiceOrStore` returns a service that throws on `submitRecallMove`
- **Mock Contract Source**: real production `RecallService` interface constrains the throwing service shape
- **Forbidden Mocks**: must NOT mock `executeRecallInteraction`
- **Primary Assertion**: `handleBoardClick` does not throw. Returns `{handled: false}` or resolves to undefined. No unhandled rejection.
- **Downstream Covered By**: none (terminal assertion)

**P0-T08: Container wires real recallService**

- **Layer**: `CONTAINER_DELEGATION`
- **Production Subject**: `TrainingWorkbenchContainer._tryCreateClickController`
- **Real Dependencies**: `sabaki.getTrainingContext()` returns a context with real `recallService`
- **Mocked Dependencies**: `sabaki` mock with `getTrainingContext` and `getPlayServices`
- **Mock Contract Source**: real production `RecallService` type constrains the injected service
- **Forbidden Mocks**: must NOT use `{submitRecallAnswer: () => ...}` as a fallback
- **Primary Assertion**: `getRecallServiceOrStore()` returns an object with `submitRecallMove` method (not `submitRecallAnswer`). When `recallService` is null, the controller either throws or returns a controlled no-op -- NOT a silent `{handled: false}` from a `submitRecallAnswer` stub.
- **Downstream Covered By**: P0-T01

**P0-T13: No production code references `submitRecallAnswer`**

- **Layer**: `ARCHITECTURE_BOUNDARY`
- **Production Subject**: entire recall click chain: executor, controller, container
- **Real Dependencies**: source file text scan
- **Mocked Dependencies**: none
- **Mock Contract Source**: n/a
- **Forbidden Mocks**: n/a
- **Primary Assertion**: grep for `submitRecallAnswer` in `src/modules/workbench/board-interactions/executors/`, `src/modules/training/workbench/boardInteractionController.ts`, and `src/components/TrainingWorkbenchContainer.js` returns zero matches.
- **Downstream Covered By**: none (terminal assertion)

### ISSUE-02 Tests

**P0-T09: Snapshot on free-play tab does not crash**

- **Layer**: `SERVICE_REPOSITORY_TRANSITION`
- **Production Subject**: `workbenchFlowService.snapshotFromCurrentContext` (real production class instance)
- **Real Dependencies**: real `workbenchFlowService` with in-memory repository, real `workbenchStore`, real `positionSnapshotAdapter`
- **Mocked Dependencies**: `tabService.openTask` (returns fake tab); `snapshotService` -- see note
- **Mock Contract Source**: real production interfaces for all deps; `snapshotService` must either be the real one (with adapted `captureSnapshotInput`) or a typed spy
- **Forbidden Mocks**: must NOT mock `workbenchFlowService` itself -- use a real instance
- **Primary Assertion**: Given a tab with `taskId: undefined` (free-play), `snapshotFromCurrentContext` resolves without throwing. A new task is created in the repository. The new task's `origin.parentTaskId` is undefined.
- **Downstream Covered By**: P0-T10

**P0-T10: snapshotService handles missing sourceTaskId**

- **Layer**: `SERVICE_REPOSITORY_TRANSITION`
- **Production Subject**: `snapshotService.captureSnapshotInput` (real, after fix)
- **Real Dependencies**: real `snapshotService` with in-memory repository, real `workbenchStore`, real `positionSnapshotAdapter`
- **Mocked Dependencies**: `logger` (local tiny stub)
- **Mock Contract Source**: real production `SnapshotService` interface
- **Forbidden Mocks**: must NOT mock `repository.loadTask` -- use real in-memory repo that returns null for undefined id
- **Primary Assertion**: `captureSnapshotInput({tabId: 'tab_freeplay', sourceTaskId: undefined})` returns a valid `ProblemSnapshotInput` without throwing. Does NOT call `repository.loadTask(undefined)`.
- **Downstream Covered By**: none (terminal assertion)

**P0-T11: Snapshot on task-backed tab preserves existing behavior**

- **Layer**: `SERVICE_REPOSITORY_TRANSITION`
- **Production Subject**: `workbenchFlowService.snapshotFromCurrentContext` (real)
- **Real Dependencies**: same harness as P0-T09
- **Mocked Dependencies**: same as P0-T09
- **Mock Contract Source**: same as P0-T09
- **Forbidden Mocks**: must NOT mock `workbenchFlowService`
- **Primary Assertion**: Given a tab with `taskId: 'task_123'`, snapshot creates a new task with `origin.provider: 'snapshot'`, `origin.parentTaskId: 'task_123'`. New tab is opened.
- **Downstream Covered By**: none (regression guard)

**P0-T12: snapshotService does not open tabs**

- **Layer**: `SIDE_EFFECT_BOUNDARY`
- **Production Subject**: `snapshotService.captureSnapshotInput` (real)
- **Real Dependencies**: real `snapshotService`, in-memory repository, real `workbenchStore`
- **Mocked Dependencies**: `positionSnapshotAdapter` (local tiny stub returning fixed snapshot); `logger` (local tiny stub)
- **Mock Contract Source**: real production `PositionSnapshotAdapter` interface constrains the stub
- **Forbidden Mocks**: must NOT mock `repository.loadTask`
- **Primary Assertion**: After calling `captureSnapshotInput`, `workbenchStore.getState().tabs.length` is unchanged. No tab was created by the snapshot service.
- **Downstream Covered By**: none (architecture boundary)

**P0-T14: ProblemSnapshotInput.sourceTaskId is optional**

- **Layer**: `ARCHITECTURE_BOUNDARY`
- **Production Subject**: `ProblemSnapshotInput` type definition
- **Real Dependencies**: TypeScript compiler
- **Mocked Dependencies**: none
- **Mock Contract Source**: n/a
- **Primary Assertion**: `const input: ProblemSnapshotInput = {positionSgf: '(;SZ[19])', sideToMove: 'black'}` compiles without error (no `sourceTaskId` required). `const input2: ProblemSnapshotInput = {sourceTaskId: 'task_1', positionSgf: '(;SZ[19])', sideToMove: 'black'}` also compiles.
- **Downstream Covered By**: P0-T10

**P0-T15: Container handleSnapshot guard**

- **Layer**: `CONTAINER_DELEGATION`
- **Production Subject**: `TrainingWorkbenchContainer.handleSnapshot`
- **Real Dependencies**: Container component logic
- **Mocked Dependencies**: `flowService` (typed spy); `workbenchStore` state with `activeTab: null`
- **Mock Contract Source**: real production `WorkbenchFlowService` interface
- **Forbidden Mocks**: must NOT mock Container internals
- **Primary Assertion**: When `activeTab` is null, `flowService.snapshotFromCurrentContext` is NOT called.
- **Downstream Covered By**: none (existing guard, regression protection)

# 11. Manual Acceptance Only

| ID | What to Verify | Why Not Automated |
|---|---|---|
| P0-M01 | Visual: Recall board click shows correct/incorrect feedback in the UI panel | Requires running app with full rendering |
| P0-M02 | Visual: Snapshot button on free-play tab shows success toast or error message | Requires running app with full rendering |
| P0-M03 | Visual: Recall checkpoint UI appears when major/severe BadMove is hit after fix | Requires end-to-end play -> submit -> recall flow |

# 12. Do Not Test

| ID | What | Why |
|---|---|---|
| P0-D01 | Vertex-to-SGF conversion utility internal algorithm | Pure function; test through P0-T01 service call verification |
| P0-D02 | JSDoc cleanup in `executeBoardInteraction.js` | Cosmetic; no behavioral contract |
| P0-D03 | `.js` -> `.ts` migration of executor files | Mechanical; compiler verifies type correctness |

# 13. Fragile Test Warnings

| Test ID | Risk | Mitigation |
|---|---|---|
| P0-T08 | Container wiring test may be fragile if `_tryCreateClickController` is refactored | Focus on behavior: "when recallService exists, `getRecallServiceOrStore()` returns it" rather than testing internal method name |
| P0-T07 | Error message text assertion may break on message wording changes | Assert on `{handled: false}` and no-throw, not on exact error message |
| P0-T01 | Vertex-to-SGF mapping `[3,3]` -> `"dd"` is tested through the service call; if the conversion utility is shared, a separate unit test may be needed later | Acceptable for now: conversion is inline in executor |

# 14. Out of Scope

- P1 remediation (shared typed spy factories, mock migration)
- P2 remediation (`as any` cleanup, `assert.ok(true)` removal)
- Migrating `playInteractionExecutor.js` and `scratchEditInteractionExecutor.js` to TypeScript (P1)
- Removing `this.skip()` calls in `w35-board-interaction-controller.test.js` (P1)
- Adding integration tests for Submit -> Recall -> Checkpoint full flow (P1, Batch 4 in audit)
- Downgrading R-T01/R-T02 classifications (P1)

# 15. v0.5 Conflict Check

| Check | Conclusion | Evidence | Handling |
|---|---|---|---|
| Does the fix use `origin.provider` or old `source/kind` as a flow branch? | NO. The snapshot fix handles absent taskId uniformly, regardless of origin. | `snapshotService.ts:81-85` uses `task.origin.provider` only for metadata enrichment (`sourceGameId`, `sourceProblemId`), not for flow branching. The fix preserves this. | No conflict. |
| Does the fix introduce `openGameTab` / `openProblemTab` / `openSnapshotProblemTab` as new primary paths? | NO. The fix uses `tabService.openTask({taskId, mode: 'problem'})` per Arch v0.5 SS9.7. | `workbenchFlowService.ts:330-334` calls `tabService.openTask`. | No conflict. |
| Does `snapshotService` take on tab opening responsibility? | NO. Current code has `tabService.openTask` called by `workbenchFlowService`, not by `snapshotService`. | `workbenchFlowService.ts:330-334`. | No conflict. |
| Does Container write directly to store? | NO. Container calls `flowService`/`controller`, which call services, which write to store/repo. | `TrainingWorkbenchContainer.js:141-143`. | No conflict. |
| Does UI component depend directly on service/store/repository? | NO. `handleSnapshot` delegates to `flowService`. `onVertexClick` delegates to `controller`. | Container code. | No conflict. |
| Does `snapshotService.captureSnapshotInput` use the Arch v0.5 SS5.10 signature `{tabId, mode, analysisContext?, reason?}`? | **MISMATCH DETECTED**. Current production `snapshotService.captureSnapshotInput` takes `{tabId, sourceTaskId, sourceAttemptId?}`, which differs from the v0.5 spec's `{tabId, mode, analysisContext?, reason?}`. | `snapshotService.ts:55-59` vs Arch v0.5 SS5.10. | The fix should migrate toward the v0.5 signature. For this P0 remediation, the minimum is making `sourceTaskId` optional. A follow-up task should align the full signature with v0.5. Marked as GAP-SIGMA. |
| Does the fix allow `recallService.submitRecallMove` to be called without `recallSessionId`? | The executor must extract `recallSessionId` from `activeTab.activeRecallSessionId`. If absent, return controlled error. | Arch v0.5 SS5.8 requires `recallSessionId: string` (non-optional in input). | No conflict: absent session = handled error, not a bypass. |
| Does the fix call `documentStore.playMove` during recall? | NO. Recall is read-only against the game tree. | PRD v0.5 SS2.5, Arch v0.5 SS0.3. | No conflict. |

**GAP-SIGMA**: `snapshotService.captureSnapshotInput` parameter signature diverges from Architecture v0.5 SS5.10. Current code uses `{tabId, sourceTaskId, sourceAttemptId?}`. Architecture v0.5 specifies `{tabId, mode, analysisContext?, reason?}`. This P0 fix only makes `sourceTaskId` optional. A separate architecture alignment task should migrate the full signature to match v0.5. This gap does not block the P0 crash fix.

# 16. Workbench Wiring Checklist

## ISSUE-01: Recall Board Click Wiring

| Control/Area | Command | Owner | v0.5 Source | State Advancement | State Return | Test Strategy | Parallel Group |
|---|---|---|---|---|---|---|---|
| Goban board intersection (recall mode) | `onVertexClick(evt)` | Goban (external) | n/a | n/a | n/a | n/a | n/a |
| Container `shellProps.boardProps.handlerProps.onVertexClick` | delegates to `controller.handleBoardClick` | `TrainingWorkbenchContainer` | Arch v0.5 SS1.2 | n/a | n/a | P0-T08 (CONTAINER_DELEGATION) | container-projection |
| `boardInteractionController.handleBoardClick` | resolves intent, routes to `recallAnswer` executor | `boardInteractionController` | Arch v0.5 SS9.5 | n/a | n/a | P0-T02 (CONTROLLER_STATE_TRANSITION) | controller |
| `executeRecallInteraction` (async) | calls `recallService.submitRecallMove({recallSessionId, userMove: vertexToSgf(vertex)})` | executor | Arch v0.5 SS5.8 | `repository.createRecallAttempt`, `repository.updateRecallSession` | executor returns `{handled, isCorrect, recallMoveIndex, attempt}` | P0-T01 (CONTROLLER_STATE_TRANSITION) | controller |
| `recallService.submitRecallMove` | creates `RecallAttempt`, checks checkpoint | `recallService` | Arch v0.5 SS5.8 | `RecallAttempt` persisted, `currentMoveIndex` advanced | `RecallAttempt` object | P0-T04, P0-T05 (SERVICE_REPOSITORY_TRANSITION) | service |
| Error guard: no recallSessionId | executor returns `{handled: false}` | executor | Arch v0.5 SS9.5 | none | error result | P0-T06 (CONTROLLER_STATE_TRANSITION) | controller |
| Error guard: service throws | controller catches, returns controlled error | controller | Arch v0.5 SS9.5 | none | error result | P0-T07 (CONTROLLER_STATE_TRANSITION) | controller |
| Side effect boundary: no game tree mutation | executor must NOT call documentStore | executor | PRD v0.5 SS2.5 | none | n/a | P0-T03 (SIDE_EFFECT_BOUNDARY) | controller |
| Zombie API elimination | no `submitRecallAnswer` in production | all chain modules | Arch v0.5 SS5.8 | n/a | n/a | P0-T13 (ARCHITECTURE_BOUNDARY) | contracts |
| Container fallback removal | wire real `recallService`, remove dead fallback | `TrainingWorkbenchContainer` | Arch v0.5 SS1.2 | n/a | real service available | P0-T08 (CONTAINER_DELEGATION) | container-projection |

## ISSUE-02: Snapshot on Free-Play Tab Wiring

| Control/Area | Command | Owner | v0.5 Source | State Advancement | State Return | Test Strategy | Parallel Group |
|---|---|---|---|---|---|---|---|
| SnapshotButton / keyboard shortcut | `handleSnapshot()` | `TrainingWorkbenchContainer` | Arch v0.5 SS9.7 | n/a | n/a | P0-T15 (CONTAINER_DELEGATION) | container-projection |
| Container `handleSnapshot` | guard `!activeTab`, then `flowService.snapshotFromCurrentContext(tabId)` | Container | Arch v0.5 SS9.7 | n/a | n/a | P0-T15 | container-projection |
| `workbenchFlowService.snapshotFromCurrentContext` | guard null taskId, build snapshot, create task, open tab | `workbenchFlowService` | Arch v0.5 SS5.3, SS9.7 | `repository.createTask`, `workbenchStore.addTab` | new `WorkbenchTab` | P0-T09, P0-T11 (SERVICE_REPOSITORY_TRANSITION) | service |
| `snapshotService.captureSnapshotInput` | handle optional `sourceTaskId`, skip `loadTask` if absent | `snapshotService` | Arch v0.5 SS5.10 (note GAP-SIGMA) | none (read-only) | `ProblemSnapshotInput` | P0-T10 (SERVICE_REPOSITORY_TRANSITION) | service |
| Side effect: snapshotService does NOT open tab | tab opening is `tabService.openTask` | architecture boundary | Arch v0.5 SS5.10 | n/a | n/a | P0-T12 (SIDE_EFFECT_BOUNDARY) | service |
| Type fix: `ProblemSnapshotInput.sourceTaskId` optional | `sourceTaskId?: string` | types | Arch v0.5 SS5.10 | n/a | n/a | P0-T14 (ARCHITECTURE_BOUNDARY) | contracts |

# 17. Task Parallelism Suggestions

| Parallel Task | Write Scope | Dependencies | Parallelism Rationale | Merge Risk |
|---|---|---|---|---|
| **contracts** | `docs/design/2026-05-21/mock-drift-p0-remediation/` | None | This document. Must complete before tests. | Low -- docs only. |
| **type-fixes** | `src/modules/training/analysis/snapshotService.ts` (type change), `src/modules/training/types/` if `ProblemSnapshotInput` is in a shared types file | contracts | Makes `sourceTaskId` optional. Independent of executor changes. | Low if type change is small. Could conflict with any other consumer of `ProblemSnapshotInput`. |
| **recall-executor** | `src/modules/workbench/board-interactions/executors/recallInteractionExecutor.js` -> `.ts`, `src/modules/training/workbench/boardInteractionController.ts` (type deps), `src/components/TrainingWorkbenchContainer.js` (fallback removal) | contracts, type-fixes | Executor migration + async conversion. Touches controller types and container wiring. | Medium -- touches Container, controller, and executor simultaneously. Coordinate with snapshot fix. |
| **snapshot-guard** | `src/modules/training/workbench/workbenchFlowService.ts` (guard), `src/modules/training/analysis/snapshotService.ts` (null handling) | contracts, type-fixes | Adds null taskId guard to flow service and snapshot service. | Medium -- overlaps with type-fixes on `snapshotService.ts`. |
| **tests-recall** | `test/workbench/wiring/` (new test files for recall executor, controller, service) | contracts, recall-executor | Tests for P0-T01 through P0-T08, P0-T13. Can write red tests before implementation lands. | Low -- test files only. |
| **tests-snapshot** | `test/workbench/wiring/` (new test files for snapshot guard) | contracts, snapshot-guard | Tests for P0-T09 through P0-T12, P0-T14, P0-T15. Can write red tests before implementation lands. | Low -- test files only. |
| **architecture-review** | No writes | All above | Review after all changes merged. | None. |

**Recommended execution order**: contracts -> tests-recall + tests-snapshot (can be parallel, write red tests) -> type-fixes -> recall-executor + snapshot-guard (can be parallel if no file overlap) -> run tests -> architecture-review.

# 18. Harness Manifest

### ISSUE-01 Harness: Recall Executor + Service

| Module | Real / Fake | Notes |
|---|---|---|
| `executeRecallInteraction` | **REAL** (migrated to .ts) | Subject under test |
| `boardInteractionController` | **REAL** | Subject under test (for P0-T02, P0-T07) |
| `recallService` | **REAL** (`createRecallService`) | Subject under test (for P0-T04, P0-T05) |
| `trainingRepository` | **In-memory fake** | Must implement `createRecallSession`, `loadRecallSession`, `createRecallAttempt`, `updateRecallSession`, `listCheckpointsByRecallSession` |
| `trainingRuntimeStore` | **REAL** (`createTrainingRuntimeStore` or equivalent factory) | |
| `recallCheckpointService` | **Typed spy** | `shouldTriggerCheckpoint` returns null; must satisfy `RecallCheckpointService` interface |
| `positionSnapshotAdapter` | **Not needed** for recall tests | |
| `documentStore` | **Local tiny stub** with spy `playMove` | Only to verify it is NOT called |

### ISSUE-02 Harness: Snapshot Flow

| Module | Real / Fake | Notes |
|---|---|---|
| `workbenchFlowService` | **REAL** | Subject under test |
| `snapshotService` | **REAL** (`createSnapshotService`) | Subject under test (for P0-T10, P0-T12) |
| `trainingRepository` | **In-memory fake** | Must implement `loadTask` (returns null for undefined/null id), `createTask` |
| `workbenchStore` | **REAL** | |
| `positionSnapshotAdapter` | **Local tiny stub** | Returns fixed `PositionSnapshot` |
| `tabService` | **Typed spy** | `openTask` returns fake tab; must satisfy `WorkbenchTabService` interface |
| `logger` | **Local tiny stub** | `{info: () => {}}` |

### In-Memory Repository Fake Requirements

The in-memory repository fake used in both harnesses must implement at minimum:

```typescript
{
  loadTask(id: string): Promise<Task | null>      // returns null for unknown/null/undefined id
  createTask(task: Task): Promise<Task>
  loadRecallSession(id: string): Promise<RecallSession | null>
  createRecallSession(session: RecallSession): Promise<RecallSession>
  updateRecallSession(id: string, patch: Partial<RecallSession>): Promise<void>
  createRecallAttempt(attempt: RecallAttempt): Promise<RecallAttempt>
  loadAttempt(id: string): Promise<Attempt | null>
  listCheckpointsByRecallSession(id: string): Promise<Checkpoint[]>
}
```

This fake MUST be shared between ISSUE-01 and ISSUE-02 test harnesses, placed in `test/workbench/shared/inMemoryTrainingRepository.ts`, and typed with the real `TrainingRepository` interface.

# 19. Caller Signature Evidence

| Handler | Caller | Real Signature | File:Line |
|---|---|---|---|
| `onVertexClick` | Goban `handleVertexMouseUp` | `onVertexClick(evt)` where `evt.vertex = [number, number]` | External component |
| `handleBoardClick` | Container `shellProps.boardProps.handlerProps.onVertexClick` | `handleBoardClick({vertex, event, activeTab, settings, board, editWorkspacePresent, task, runtimeState})` | `boardInteractionController.ts:43-61` |
| `getRecallServiceOrStore` | controller `handleBoardClick` at recall branch | `getRecallServiceOrStore(): RecallService` (must return object with `submitRecallMove`) | `boardInteractionController.ts:29-30,195` |
| `submitRecallMove` | executor `executeRecallInteraction` | `submitRecallMove(input: {recallSessionId: string, userMove: string}): Promise<RecallAttempt>` | `recallService.ts:18-21` |
| `handleSnapshot` | Container SnapshotButton callback | `handleSnapshot(): Promise<void>` | `TrainingWorkbenchContainer.js:141-143` |
| `snapshotFromCurrentContext` | Container `handleSnapshot` | `snapshotFromCurrentContext(tabId: string): Promise<WorkbenchTab>` | `workbenchFlowService.ts:295` |
| `captureSnapshotInput` | flowService `snapshotFromCurrentContext` | `captureSnapshotInput(input: {tabId: string, sourceTaskId?: string, sourceAttemptId?: string}): Promise<ProblemSnapshotInput>` | `snapshotService.ts:55-59` (after fix) |

**False-green risk**: If tests call `handleBoardClick` with `(vertex, event)` as two separate arguments instead of a single `input` object, the test passes but production fails because the controller expects one object. Tests must use the exact calling convention from `boardInteractionController.ts:43`.

**False-green risk**: If tests call `submitRecallMove` with `(vertex)` instead of `({recallSessionId, userMove})`, the test passes against a mock but fails against real `recallService`. Tests for the executor layer MUST pass the object-form argument.

# 20. Weak Test Prohibition

The following assertion patterns are **forbidden** as primary acceptance for P0 tests:

- "callback was called once" -- acceptable only as auxiliary evidence for UI_COMMAND_MAPPING, never as primary assertion for CONTROLLER_STATE_TRANSITION
- "result.handled === true" alone without verifying state change -- acceptable only for error path tests (P0-T06, P0-T07)
- "typeof handler === 'function'" -- forbidden entirely for this contract
- "spy.callCount === 1" without verifying arguments -- forbidden as primary assertion
- "result does not throw" without verifying return value or state -- forbidden as primary assertion

Primary assertions must verify one of:
- Real repository state change (new record created, index advanced)
- Real store state change (activeCheckpointId set)
- Return value shape matches production interface (RecallAttempt fields)
- Error is caught and returned as controlled `{handled: false}` result
