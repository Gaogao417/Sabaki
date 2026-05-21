# P0 Remediation Plan — Recall Dead Path + Snapshot Null TaskId

**Branch:** `codex/workbench-wiring`
**Date:** 2026-05-21 (revised v2)
**Scope:** Fix two confirmed P0 production bugs. Minimal scope.

---

## Scope

**Changing:**
- `recallInteractionExecutor.js` — replace `trainingStore.submitRecallAnswer(vertex)` with async adapter call
- `boardInteractionController.ts` — rename `getRecallServiceOrStore` → `getRecallAdapter`, update type, await executor
- `TrainingWorkbenchContainer.js` — wire adapter factory, remove dead fallback
- `executeBoardInteraction.js` — update JSDoc, adjust executor call signature
- `snapshotService.ts` — make `sourceTaskId` optional, skip task load when null
- `workbenchFlowService.ts` — pass `tab.taskId ?? undefined`, handle parentless snapshot
- `workbenchSpyFactories.ts` — add adapter spy factory, update snapshot spy
- 6 test files — replace `submitRecallAnswer` with adapter-based tests

**NOT changing:**
- `recallService.ts` — its API is correct, already tested by `recallService.test.js`
- Other executors (`playInteractionExecutor.js`, `scratchEditInteractionExecutor.js`)
- `sabaki.js` — legacy paths only trigger `scratchEdit` contract in analysis mode, never `recallAnswer`
- `App.js` — the default tab with `taskId: null` is a valid use case; fix is in snapshotService, not tab creation
- File extensions (no JS-to-TS migration)
- P1/P2 audit items

---

## BUG-1 Fix: Recall Adapter Layer

**Root cause:** `recallInteractionExecutor.js:35` calls `trainingStore.submitRecallAnswer(vertex)` — method doesn't exist on real `recallService`. Real API: `submitRecallMove({recallSessionId, userMove}): Promise<RecallAttempt>`.

### Adapter interface

```typescript
type RecallBoardAdapter = {
  submitBoardClick(vertex: [number, number]): Promise<{
    handled: boolean
    changed: boolean
    isCorrect: boolean
    completed: boolean
    recallMoveIndex: number
    attempt: RecallAttempt | null
  }>
}
```

Adapter wraps `recallService.submitRecallMove`. Converts vertex to SGF via `sgf.stringifyVertex(vertex)`. Reads `recallSessionId` from store state at call time (lazy, not bound at construction).

### Critical design detail: lazy store read

The adapter is NOT a long-lived closure. `getRecallAdapter` is a factory function called on every `handleBoardClick`. Inside the factory:
1. Read current `workbenchStore.getState()` to find the active tab's `activeRecallSessionId`
2. Create an adapter that closes over the `recallService` and reads `recallSessionId` at that moment
3. If `recallSessionId` is undefined (not in recall mode), return `{handled: false}` immediately

This matches the existing `getRecallServiceOrStore: () => ...` pattern (factory called per-click, not per-constructor).

### Files that change

**1. `recallInteractionExecutor.js`**
- Change `executeRecallInteraction` to `async`
- Replace `trainingStore.submitRecallAnswer(vertex)` with `await adapter.submitBoardClick(vertex)`
- Services param changes from `{trainingStore}` to `{adapter}`

**2. `boardInteractionController.ts`**
- Rename `getRecallServiceOrStore` → `getRecallAdapter` in `BoardInteractionControllerDeps`
- Change return type from `{submitRecallAnswer(vertex): ...}` to `RecallBoardAdapter`
- Await executor result on line 196 (currently sync)

**3. `TrainingWorkbenchContainer.js`** (line 533)
- Replace `getRecallServiceOrStore: () => recallService || {submitRecallAnswer: () => ({handled: false})}`
- With `getRecallAdapter` factory that:
  - Reads `workbenchStore.getState().tabs.find(t => t.id === activeTabId)?.activeRecallSessionId`
  - If no activeRecallSessionId: returns no-op adapter `{submitBoardClick: async () => ({handled: false, changed: false, ...})}`
  - If recallService is available: returns real adapter wrapping recallService with the sessionId
  - If recallService is null (test harness): returns no-op adapter

**4. `executeBoardInteraction.js`**
- Update JSDoc line 15: remove `submitRecallAnswer`
- Change dep from `trainingStore` to `adapter`
- Forward `deps.adapter` to `executeRecallInteraction`

---

## BUG-2 Fix: Snapshot on Default Tab (taskId: null)

**Root cause:** `App.js:350` creates a default free-play tab with `taskId: null` on app startup. When user clicks snapshot on this tab, `workbenchFlowService.ts:305` passes `sourceTaskId: null` to `snapshotService.captureSnapshotInput`, which calls `repository.loadTask(null)` and throws.

**Confirmed by user runtime log:**
```
[INFO][flow.snapshotFromCurrentContext] Snapshot from current context
  {tabId: 'tab_default_1779373945264', mode: 'recall', taskId: null, attemptId: null}
```

**Fix strategy (human decision):** Support parentless snapshot tasks.

### Files that change

**1. `snapshotService.ts`**
- `ProblemSnapshotInput.sourceTaskId`: `string` → `string | undefined` (optional)
- `captureSnapshotInput` param: `sourceTaskId` becomes optional
- Body (lines 65-73): wrap task validation in `if (input.sourceTaskId != null)`. When null: skip `repository.loadTask`, skip origin derivation, return `sourceTaskId: undefined`

**2. `workbenchFlowService.ts`** (lines 305-343)
- Pass `sourceTaskId: tab.taskId ?? undefined` instead of bare `tab.taskId`
- `origin.parentTaskId: tab.taskId ?? undefined` (conditional)

---

## Test Changes

### New tests (2)

**T-RECALL-ADAPTER: Board click reaches real recallService API**
- File: `test/workbench/wiring/recall-adapter-wiring.test.js` (new)
- What: create controller with real `recallService` + in-memory repository + pre-created recall session, trigger recall board click, verify `recallService.submitRecallMove` called with correct SGF vertex (`"dd"` for `[3,3]`) and correct `recallSessionId`
- Why needed: all 6 existing files mock `submitRecallAnswer` — no test verifies real `submitRecallMove` API from board click path
- Does NOT re-test recallService internals (correct/incorrect move, index advance — already covered by `recallService.test.js`)

**T-SNAPSHOT-FREEPLAY: Snapshot on taskId=null default tab succeeds**
- File: `test/workbench/wiring/snapshot-null-taskid.test.js` (new)
- What: create real `workbenchFlowService` + real `snapshotService` + in-memory repository + mock positionSnapshotAdapter, trigger snapshot on tab with `taskId: null`, verify no crash, verify snapshot task created with `origin.parentTaskId: undefined`
- Why needed: all existing snapshot tests use spy `flowService` that skips real chain. User hit this crash in production.

### Tests to modify (6 files)

Replace all `submitRecallAnswer` references with adapter-based spies:
- `test/recallInteractionExecutorTests.js` — change `trackTrainingStore()` to `{adapter}` with `submitBoardClick`
- `test/workbench/wiring/w8-p1-board-interaction-controller.test.js` — change `createControllerDeps()`
- `test/workbench/wiring/w8-p2-executor-routing.test.js` — change `createRecallTestDeps()`
- `test/workbench/wiring/w8-p2-coord-fix.test.js` — change local mock
- `test/workbench/wiring/w35-board-interaction-controller.test.js` — change mock references
- `test/workbench/wiring/w3-goban-boundary.test.js` — change mock references

### Tests NOT to modify

- `test/training/recallService.test.js` — already correctly tests `submitRecallMove`
- `test/training/recallCheckpointService.test.js` — already tests checkpoint integration

---

## Shared Spy Factory Updates

`test/workbench/shared/workbenchSpyFactories.ts`:

**Add `createSpyRecallBoardAdapter()`** — returns `RecallBoardAdapter` spy:
- Records calls to `submitBoardClick` with vertex argument
- Default returns `{handled: true, changed: true, isCorrect: true, completed: false, recallMoveIndex: 0, attempt: {...}}`
- Does NOT expose `submitRecallAnswer`

---

## Old Mock Cleanup

**Production files losing `submitRecallAnswer` (4):**
- `src/modules/workbench/board-interactions/executors/recallInteractionExecutor.js`
- `src/modules/training/workbench/boardInteractionController.ts`
- `src/modules/workbench/board-interactions/executeBoardInteraction.js`
- `src/components/TrainingWorkbenchContainer.js`

**Test files losing `submitRecallAnswer` (6):**
- `test/recallInteractionExecutorTests.js`
- `test/workbench/wiring/w8-p1-board-interaction-controller.test.js`
- `test/workbench/wiring/w8-p2-executor-routing.test.js`
- `test/workbench/wiring/w8-p2-coord-fix.test.js`
- `test/workbench/wiring/w35-board-interaction-controller.test.js`
- `test/workbench/wiring/w3-goban-boundary.test.js`

**Total: ~47 occurrences removed across 10 files.**

---

## Execution Order

| Step | Action | Depends on |
|---|---|---|
| 1 | Snapshot type: `ProblemSnapshotInput.sourceTaskId` optional | — |
| 2 | Snapshot logic: `captureSnapshotInput` skip task load when null | Step 1 |
| 3 | Snapshot flow: `workbenchFlowService` pass `tab.taskId ?? undefined` | Step 2 |
| 4 | Spy factory: add `createSpyRecallBoardAdapter` to workbenchSpyFactories.ts | — |
| 5 | Executor: update `recallInteractionExecutor.js` to async + adapter | — |
| 6 | Controller: rename `getRecallServiceOrStore` → `getRecallAdapter`, await executor | Step 5 |
| 7 | Router: update `executeBoardInteraction.js` JSDoc + dep forwarding | Step 5 |
| 8 | Container: wire real adapter factory, remove dead fallback | Step 6 |
| 9 | Snapshot test: T-SNAPSHOT-FREEPLAY — run, confirm passes | Steps 1-3 |
| 10 | Recall test: T-RECALL-ADAPTER — run, confirm passes | Steps 4-8 |
| 11 | Test cleanup: update 6 test files to use adapter spy | Steps 4-8 |
| 12 | Final grep: `grep -r "submitRecallAnswer" src/ test/` — must return zero | Steps 5-11 |
| 13 | Run full test suite | Step 12 |

Steps 1-3 (snapshot) and Steps 4-8 (recall) can run in parallel.

---

## Out of Scope

- JS-to-TS migration of executors
- `as any` / `: any` cleanup (~110 occurrences)
- P1: shared typed factory migration for play/scratch deps
- P1: integration test harness for full flow chains
- P1: R-T01/R-T02 assertion upgrade
- P1: `this.skip()` removal in w35 tests
- P2: `assert.ok(true)` replacements
- P2: executor directory TS migration
- Any changes to `recallService.ts` or its existing tests
- `sabaki.js` legacy path (confirmed safe — only triggers `scratchEdit`, never `recallAnswer`)
- `App.js` default tab creation (valid use case; fix is in snapshotService, not tab creation)

---

## Investigation Notes

**BUG-2 (snapshot taskId:null) — confirmed real:**
- `App.js:350` creates default free-play tab with `taskId: null` on startup
- User runtime log confirms: `{tabId: 'tab_default_1779373945264', mode: 'recall', taskId: null}`
- Error: `snapshotService.captureSnapshotInput: task not found (id=null)`
- Fix: make `sourceTaskId` optional in snapshotService, handle parentless snapshots

**sabaki.js legacy path — confirmed safe:**
- Lines 1218 and 1696 call `executeBoardInteraction` without deps
- Both only execute in `mode === 'analysis'` with `editWorkspace != null`
- Mutation contract is always `scratchEdit`, never `recallAnswer`
- No deps needed for scratch edit path
