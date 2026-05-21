# Mock Contract Drift Audit Report — Workbench/Training

**Branch:** `codex/workbench-wiring`
**Date:** 2026-05-21
**Scope:** `test/workbench/wiring/`, `test/recallInteractionExecutorTests.js`, `test/workbench/shared/workbenchSpyFactories.ts`
**Production Reference:** `src/modules/training/`, `src/modules/workbench/`, `src/components/TrainingWorkbenchContainer.js`

---

## Executive Summary

Two confirmed P0 production bugs are masked by tests that pass green against dead APIs:

1. **Recall board click** calls `trainingStore.submitRecallAnswer(vertex)` — a synchronous method that does not exist on the real `recallService`. The real API is `submitRecallMove({recallSessionId, userMove})` (async, SGF string format). Container fallback silently swallows the click.

2. **Snapshot on free-play tab** passes `sourceTaskId: null` to `snapshotService.captureSnapshotInput`, which throws `task not found (id=null)`. No test covers this path because all snapshot tests use spy `flowService` that skips the real service chain.

Additionally, 6 P1 issues (hand-rolled untyped mocks, weak wiring assertions, spy skipping real chains) and 2 P2 issues (placeholder passes, type escapes) were identified.

---

## P0 — Immediate Production Bugs Masked by Tests

### ISSUE-01: `submitRecallAnswer` is a zombie API — recall board click is a dead path

**Problem Type:** Old API / Mock Contract Drift / Fake Green / Type Escape

**Production files:**

| File | Line | What happens |
|---|---|---|
| [recallInteractionExecutor.js](src/modules/workbench/board-interactions/executors/recallInteractionExecutor.js#L35) | L35 | Calls `trainingStore.submitRecallAnswer(vertex)` — synchronous, tuple `[number, number]` |
| [boardInteractionController.ts](src/modules/training/workbench/boardInteractionController.ts#L30) | L30 | Types `getRecallServiceOrStore` as returning `{submitRecallAnswer(vertex): ...}` |
| [boardInteractionController.ts](src/modules/training/workbench/boardInteractionController.ts#L195-L197) | L195-197 | Routes `recallAnswer` contract to executor with this store |
| [TrainingWorkbenchContainer.js](src/components/TrainingWorkbenchContainer.js#L533) | L533 | Wires `getRecallServiceOrStore: () => recallService \|\| {submitRecallAnswer: () => ({handled: false})}` |
| [executeBoardInteraction.js](src/modules/workbench/board-interactions/executeBoardInteraction.js#L15) | L15 (JSDoc) | Documents `trainingStore?: {submitRecallAnswer: function}` |

**Real API (recallService.ts):**

```typescript
submitRecallMove(input: {recallSessionId: string, userMove: string}): Promise<RecallAttempt>
```

Key differences:
- **Name**: `submitRecallAnswer` vs `submitRecallMove`
- **Parameters**: `vertex: [number, number]` vs `{recallSessionId: string, userMove: string}`
- **Return**: synchronous object vs `Promise<RecallAttempt>`
- **Coordinate format**: numeric tuple `[3, 3]` vs SGF string `"dd"`

**Test files covering this dead path (all green):**

| Test file | `submitRecallAnswer` occurrences | Mock method |
|---|---|---|
| [recallInteractionExecutorTests.js](test/recallInteractionExecutorTests.js#L25-L36) | 14 | `trackTrainingStore()` local spy |
| [w8-p1-board-interaction-controller.test.js](test/workbench/wiring/w8-p1-board-interaction-controller.test.js#L165-L169) | 3 | `createControllerDeps()` local `recallServiceStore` |
| [w8-p2-executor-routing.test.js](test/workbench/wiring/w8-p2-executor-routing.test.js#L222-L226) | 6 | `createRecallTestDeps()` local mock |
| [w8-p2-coord-fix.test.js](test/workbench/wiring/w8-p2-coord-fix.test.js) | 13 | Local spy |
| [w35-board-interaction-controller.test.js](test/workbench/wiring/w35-board-interaction-controller.test.js) | 4 | Local mock |
| [w3-goban-boundary.test.js](test/workbench/wiring/w3-goban-boundary.test.js) | 4 | Local mock |

**Why tests mislead:**
- Every test hand-rolls a mock with `submitRecallAnswer`. If the real service drops this method, tests still pass.
- The executor is synchronous in production. If changed to noop `return {handled: true, changed: true}`, all tests still pass because they only check mock call count and return value shape.
- The **synchronous** nature of the mock hides the fact that the real `submitRecallMove` is `async` — the entire click controller → executor chain must be refactored to `async/await` or it will not await the Promise, causing race conditions.

**Real production impact:**
1. Runtime crash: `TypeError: trainingStore.submitRecallAnswer is not a function`
2. Silent click loss: Container fallback `{submitRecallAnswer: () => ({handled: false})}` causes click to return `handled: false` — no move submitted, no error shown
3. If patched to call real API without async: unhandled Promise, race conditions on rapid clicks

**Remediation:**
1. Migrate `recallInteractionExecutor.js` to `.ts`, bind to real `RecallService` type
2. Make `executeRecallInteraction` async: `await recallService.submitRecallMove({recallSessionId, userMove: vertexToSgf(vertex)})`
3. Make `boardInteractionController.handleBoardClick` await the recall executor result
4. Add `recallSessionId` to the click handler input (from `activeTab.activeRecallSessionId`)
5. Add coordinate conversion utility (`vertexToSgf`) in the executor
6. Remove Container fallback `{submitRecallAnswer: () => ({handled: false})}` — replace with real wiring
7. Clean up JSDoc in `executeBoardInteraction.js` line 15
8. Migrate entire `board-interactions/executors/` directory to TypeScript (including `playInteractionExecutor.js` and `scratchEditInteractionExecutor.js`) to prevent future drift

---

### ISSUE-02: Snapshot on free-play tab crashes — `sourceTaskId: null` unhandled

**Problem Type:** Missing Real Integration / Fake Green

**Production files:**

| File | Line | What happens |
|---|---|---|
| [workbenchFlowService.ts](src/modules/training/workbench/workbenchFlowService.ts#L305-L309) | L305-309 | `snapshotService.captureSnapshotInput({tabId, sourceTaskId: tab.taskId})` |
| [snapshotService.ts](src/modules/training/analysis/snapshotService.ts#L71-L73) | L71-73 | `repository.loadTask(input.sourceTaskId)` → throws if null |
| [snapshotService.ts](src/modules/training/analysis/snapshotService.ts#L7) | L7 | `ProblemSnapshotInput.sourceTaskId: string` — non-optional |
| [TrainingWorkbenchContainer.js](src/components/TrainingWorkbenchContainer.js#L141-L143) | L141-143 | `handleSnapshot()` → `flowService.snapshotFromCurrentContext(activeTab.id)` |

**Test files (all use spy, none trigger real chain):**

| Test file | Coverage | Gap |
|---|---|---|
| [regression-wiring.test.js](test/workbench/wiring/regression-wiring.test.js#L455-L469) R-T06 | Checks `flowService.calls.snapshotFromCurrentContext` call count | Spy returns fake tab, never calls real `snapshotService` |
| [workbenchSpyFactories.ts](test/workbench/shared/workbenchSpyFactories.ts#L104-L111) | Spy `snapshotFromCurrentContext` records call | Returns `makeTab({id: 'tab_snapshot_new'})` without any validation |
| [dashboard-wiring.test.js](test/workbench/wiring/dashboard-wiring.test.js) | D-T06a delegation check | Spy flowService, no real snapshot chain |

**Why tests mislead:**
- Spy `flowService.snapshotFromCurrentContext` does not invoke real `snapshotService.captureSnapshotInput`
- No test creates a tab with `taskId: null` and triggers snapshot
- No test verifies that `repository.loadTask(null)` is called or throws

**Real production impact:**
- User on free-play tab clicks snapshot → `snapshotService.captureSnapshotInput({sourceTaskId: null})` → `repository.loadTask(null)` → returns null → `throw new Error('task not found (id=null)')`
- Unhandled error crashes the snapshot flow

**Additional constraint for fix:**
- `ProblemSnapshotInput.sourceTaskId` is typed as `string` (non-optional). Supporting free-play snapshots requires making it `sourceTaskId?: string` and updating `Problem` type + repository schema accordingly.

**Remediation:**
1. Add guard in Container `handleSnapshot()`: `if (!activeTab?.taskId) return` or show user-facing error
2. OR: Make `snapshotService.captureSnapshotInput` handle `sourceTaskId: null` gracefully (generate a synthetic task for free-play)
3. Update `ProblemSnapshotInput.sourceTaskId` to `sourceTaskId?: string`
4. Add integration test: real `workbenchFlowService` + in-memory repository + real `snapshotService`, verify snapshot on `taskId: null` tab either succeeds or returns controlled error
5. Add negative test: verify `taskId: null` does not cause unhandled crash

---

## P1 — False Green / Weak Wiring

### ISSUE-03: Hand-rolled local service mocks in JS test files, no TS type binding

**Problem Type:** Mock Contract Drift / Type Escape

**Files:**

| File | Lines | What's hand-rolled |
|---|---|---|
| [w8-p1-board-interaction-controller.test.js](test/workbench/wiring/w8-p1-board-interaction-controller.test.js#L143-L223) | L143-223 | `createControllerDeps()`: `recallServiceStore.submitRecallAnswer`, `recallServiceShape.submitRecallMove`, `documentStore.playMove` |
| [w8-p2-executor-routing.test.js](test/workbench/wiring/w8-p2-executor-routing.test.js#L170-L299) | L170-299 | `createPlayTestDeps()`, `createRecallTestDeps()`, `createScratchTestDeps()` |
| [w8-p2-coord-fix.test.js](test/workbench/wiring/w8-p2-coord-fix.test.js#L93-L124) | L93-124 | Local mock factories |

**Why tests mislead:**
- These are plain JS — no compiler enforces that mock shape matches production interface
- `recallServiceStore` (L165-169) has `submitRecallAnswer` — non-existent on real `recallService`
- `recallServiceShape` (L172-176) has `submitRecallMove` but returns `{id, isCorrect, moveNumber}` instead of full `RecallAttempt`
- Play test deps (L191) include `submitRecallAnswer: () => ({handled: false})` as a dummy for non-recall paths — if code path erroneously calls it, test won't fail

**If production method is renamed/deleted:** Tests still green (mock retains old name)

**If handler becomes noop:** Tests still green (assertions check mock call count, not downstream state)

**Remediation:**
1. Migrate `createControllerDeps`, `createPlayTestDeps`, `createRecallTestDeps`, `createScratchTestDeps` into `workbenchSpyFactories.ts`
2. Use `satisfies` to bind each spy to the real production TS interface
3. Delete all `submitRecallAnswer` references from shared factories
4. After ISSUE-01 fix, all controller deps factories should only expose `submitRecallMove`

---

### ISSUE-04: Executor routing tests claim SIDE_EFFECT_BOUNDARY but only check spy call count

**Problem Type:** Weak Wiring

**Files:**
- [w8-p2-executor-routing.test.js](test/workbench/wiring/w8-p2-executor-routing.test.js) T-RECALL-01/02

**Current assertions:**
- T-RECALL-01: `result.handled === true && result.isCorrect === true && documentStore NOT called`
- T-RECALL-02: `vertex [3,3] passed through; result.handled/changed/isCorrect === true`

**What's missing:**
- No repository state verification (was `RecallAttempt` created?)
- No store state verification (was `currentMoveIndex` advanced?)
- No runtimeStore verification (was `activeRecallSession` set?)
- No projection round-trip verification

**Real `submitRecallMove` side effects (all untested):**
- `repository.createRecallAttempt(recallAttempt)` — creates record
- `repository.updateRecallSession(id, {currentMoveIndex: ...})` — advances index
- `checkpointService.shouldTriggerCheckpoint(...)` — may trigger checkpoint
- Returns full `RecallAttempt` with `isCorrect`, `moveNumber`, `hintLevelUsed`

**Remediation:**
1. Add at least one integration test: real `recallService` + in-memory repository → board click → verify `createRecallAttempt` called with correct data
2. Verify `repository.updateRecallSession` called to advance `currentMoveIndex`

---

### ISSUE-05: Regression R-T01/R-T02 only check `typeof === 'function'` — equivalent to noop

**Problem Type:** Placeholder Pass / Weak Wiring

**Files:**
- [regression-wiring.test.js](test/workbench/wiring/regression-wiring.test.js#L252-L278) R-T01: `typeof shellProps.boardProps.handlerProps.onVertexClick === 'function'` + `doesNotThrow`
- [regression-wiring.test.js](test/workbench/wiring/regression-wiring.test.js#L293-L314) R-T02: Same pattern for Problem mode

**Why tests mislead:**
- `onVertexClick: () => {}` satisfies both assertions
- No verification that handler calls the controller
- No verification that handler passes correct arguments
- No verification of downstream state change
- Classified as `CONTROLLER_STATE_TRANSITION` but actually only checks handler existence

**Remediation:**
1. After calling handler, verify controller's `handleBoardClick` was invoked (expose controller from harness or track its calls)
2. OR: Downgrade classification to `CONTAINER_DELEGATION` and annotate as "existence check only"

---

### ISSUE-06: `createSpyFlowService` skips real snapshot/submit/recall chains entirely

**Problem Type:** Fake Green / Missing Real Integration

**Files:**
- [workbenchSpyFactories.ts](test/workbench/shared/workbenchSpyFactories.ts#L69-L128) L69-128

**Methods that skip real chains:**

| Method | Lines | What spy does | What real code does |
|---|---|---|---|
| `snapshotFromCurrentContext` | L104-111 | Records call, returns fake tab | Calls `snapshotService.captureSnapshotInput` → `repository.loadTask` → `repository.createTask` → `tabService.openTask` |
| `submit` | L86-88 | Records call | `attemptService.freezeAttempt` → evaluate → `recallService.createRecallSession` → `workbenchStore.updateTab(mode: 'recall')` |
| `completeRecall` | L95-97 | Records call | `recallService.completeRecall` → `runtimeStore.setRecallView(null)` → `workbenchStore.updateTab(mode: 'analysis')` |
| `loadDashboardData` | L115-124 | Returns empty arrays | Queries repository for inbox/incomplete/bad-move tasks |

**Note:** These spies are correctly scoped for `CONTAINER_DELEGATION` tests. The issue is that **no test exists** that uses a real `workbenchFlowService` to cover these chains.

**Remediation:**
1. Create `createWorkbenchFlowServiceTestHarness`: real `workbenchFlowService` + in-memory repository + spy `snapshotService`
2. Add submit integration test: real flow → verify recall session created + tab mode transition
3. Add snapshot integration test: real flow → verify task created + tab opened

---

### ISSUE-07: `w35-board-interaction-controller.test.js` — 13 `this.skip()` calls

**Problem Type:** Placeholder Pass

**Files:**
- [w35-board-interaction-controller.test.js](test/workbench/wiring/w35-board-interaction-controller.test.js#L220) L220,241,267,296,326,355,385,409,432,453,480,513,538

**Analysis:**
- All skip when `createBoardInteractionController` is falsy (module not loaded)
- Controller now exists (`boardInteractionController.ts`), so skips should not trigger in normal runs
- However, these tests still use `submitRecallAnswer` and would benefit from shared factory migration
- Skip logic creates risk: if module loading breaks silently, all tests silently disappear from the suite

**Remediation:**
1. Remove skip logic (controller is now available), import directly
2. Upgrade mocks to shared typed spy factory

---

## P2 — Low Priority

### ISSUE-08: `assert.ok(true)` — literal always-pass assertions

**Problem Type:** Placeholder Pass

**Files:**
- [reviewService.test.js](test/training/reviewService.test.js#L467) L467
- [css-atoms.test.js](test/workbench/css-atoms.test.js#L346) L346

**Remediation:** Replace with meaningful assertions or remove.

---

### ISSUE-09: ~110 `as any` / `: any` type escapes in test files

**Problem Type:** Type Escape

**Analysis:** ~45 `as any` and ~65 `: any` occurrences across test files, primarily in `w8-p3` and `w8-p2` TypeScript tests. These bypass compiler checks that would catch mock interface drift.

**Remediation:** Gradually replace with `satisfies` or concrete type imports.

---

### ISSUE-10: Entire `board-interactions/executors/` directory is JS with loose JSDoc

**Problem Type:** Type Escape

**Files:**
- [recallInteractionExecutor.js](src/modules/workbench/board-interactions/executors/recallInteractionExecutor.js) — 47 lines
- [executeBoardInteraction.js](src/modules/workbench/board-interactions/executeBoardInteraction.js) — JSDoc references `submitRecallAnswer`
- [playInteractionExecutor.js](src/modules/workbench/board-interactions/executors/playInteractionExecutor.js)
- [scratchEditInteractionExecutor.js](src/modules/workbench/board-interactions/executors/scratchEditInteractionExecutor.js)

**Analysis:** JSDoc `@param {{trainingStore: {submitRecallAnswer: function}}} services` is a comment, not a type constraint. If migrated to `.ts` with real `RecallService` import, the compiler would immediately flag `submitRecallAnswer` as non-existent.

**Remediation:** Migrate entire `executors/` directory to TypeScript with real interface imports.

---

## Remediation Execution Sequence

### Batch 1: Expose real bugs immediately (P0)

| Step | Action | Bug exposed |
|---|---|---|
| 1.1 | Migrate `recallInteractionExecutor.js` → `.ts`, import real `RecallService` type | **Compile fail:** `submitRecallAnswer` does not exist on `RecallService` |
| 1.2 | Make executor async: `await recallService.submitRecallMove({recallSessionId, userMove: vertexToSgf(vertex)})` | — |
| 1.3 | Add `recallSessionId` to controller click handler input (from `activeTab.activeRecallSessionId`) | — |
| 1.4 | Fix Container fallback: remove `{submitRecallAnswer: () => ({handled: false})}`, wire real adapter | — |
| 1.5 | Add integration test: real `recallService` + in-memory repo → board click → verify `RecallAttempt` created, `currentMoveIndex` advanced | — |
| 1.6 | Add snapshot error path test: `taskId: null` → verify `snapshotFromCurrentContext` throws controlled error or returns gracefully | Exposes free-play snapshot crash |
| 1.7 | Add guard in Container `handleSnapshot()` or make `snapshotService` handle `null` taskId | — |
| 1.8 | Update `ProblemSnapshotInput.sourceTaskId` to `sourceTaskId?: string` if supporting free-play | — |

### Batch 2: Build shared typed factories (P1)

| Step | Action |
|---|---|
| 2.1 | Add `createSpyRecallService()` to `workbenchSpyFactories.ts`, bind to `RecallService` type, only mock `submitRecallMove` (not `submitRecallAnswer`) |
| 2.2 | Migrate `createControllerDeps`, `createPlayTestDeps`, `createRecallTestDeps`, `createScratchTestDeps` into shared factory |
| 2.3 | Create `createWorkbenchFlowServiceTestHarness`: real flowService + in-memory repo + spy snapshotService |

### Batch 3: Downgrade or delete stale tests (P1)

| Step | Action |
|---|---|
| 3.1 | Delete all `submitRecallAnswer` hand-rolled mocks (6 files, ~44 occurrences) |
| 3.2 | R-T01/R-T02: downgrade to `CONTAINER_DELEGATION` with annotation, or upgrade to verify controller invocation |
| 3.3 | Remove 13 `this.skip()` calls in `w35-board-interaction-controller.test.js`, import directly |
| 3.4 | Replace `assert.ok(true)` with meaningful assertions |
| 3.5 | Clean up JSDoc in `executeBoardInteraction.js` L15 |

### Batch 4: Add real integration tests (P1)

| Step | Action | Chain covered |
|---|---|---|
| 4.1 | Recall board click → real recallService → repo.createRecallAttempt + repo.updateRecallSession.currentMoveIndex | click → executor → service → repo |
| 4.2 | Submit → real flowService.submit → real recallService.createRecallSession → tab.mode transitions to recall | submit → flow → recall → store |
| 4.3 | Snapshot → real flowService.snapshotFromCurrentContext → real snapshotService.captureSnapshotInput → repo.createTask + tabService.openTask | snapshot → flow → snapshot → repo → tab |
| 4.4 | Snapshot error → taskId null, incomplete attempt, missing tab | error path coverage |

---

## Statistics

| Pattern | Matches | Scope |
|---|---|---|
| `submitRecallAnswer` | 47 | 6 test files + 3 production files |
| `submitRecallMove` | 54 | test files + `recallService.ts` |
| `this.skip` | 125+ | wiring + component tests |
| `as any` / `: any` | ~110 | test + production files |
| `assert.ok(true)` | 5 | 2 test files (+ 3 comments) |
| `typeof === 'function'` (weak assertion) | 14 | regression + wiring tests |
| `snapshotFromCurrentContext` | 77 | test + production files |
| `captureSnapshotInput` | 61 | test + production files |
