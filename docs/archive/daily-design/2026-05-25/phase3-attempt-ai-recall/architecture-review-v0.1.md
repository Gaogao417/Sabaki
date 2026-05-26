Date: 2026-05-25
Role: architecture-reviewer
Status: REQUEST_CHANGES
Subject: Current Phase 3 implementation diff

# Phase 3 Architecture Review v0.1

## Verdict

The implementation is broadly aligned with the Phase 3 architecture boundaries: Sabaki injects runtime/workbench/repository into `aiMoveService`, Recall completion no longer mutates source Attempt, repository-level frozen Attempt guards are in place, and submit now finalizes result before freezing. One lifecycle issue should be fixed before Phase 3 is considered approved.

## Finding

### A1. AI pending state is not cleared when the engine request rejects

Severity: P2

`requestAiMove` records `pendingAiMove` before awaiting `engineService.requestMove`, but clears it only after the await returns. If the engine call rejects, control leaves the function before either `clearAiMovePending` call runs. That leaves `runtimeStore.pendingAiMove` stuck until another AI request overwrites it, which makes the new runtime fact untrustworthy and will break the deferred pending/interruption UI once connected.

Evidence:

- `src/modules/training/ai/aiMoveService.ts` sets pending at lines 90-98.
- `src/modules/training/ai/aiMoveService.ts` awaits the engine at line 126.
- `src/modules/training/ai/aiMoveService.ts` clears pending only at lines 134 and 138, both after the awaited engine result.

Required change:

Wrap the engine request path so `runtimeStore.clearAiMovePending(requestId)` runs on rejection as well, while still using request-id clearing so an older failing request cannot clear a newer pending request. Add a focused test that rejects the engine promise and asserts the matching pending fact is cleared.

## Boundary Checks

- `src/modules/sabaki.js` injects `runtimeStore`, `workbenchStore`, and `repository` into `createAiMoveService`, so stale guards run in production wiring.
- `src/modules/training/repository/trainingRepository.ts` blocks protected Attempt fields after status leaves `playing`.
- `src/modules/training/recall/recallService.ts` completes RecallSession without calling `repository.updateAttempt`.
- `src/modules/training/problem/problemFlowService.ts` keeps Problem undo inside runtime/repository services and does not let UI components mutate the store directly.
- No new `window.sabaki` global lookup or component-to-core-store mutation was found in the reviewed diff.
