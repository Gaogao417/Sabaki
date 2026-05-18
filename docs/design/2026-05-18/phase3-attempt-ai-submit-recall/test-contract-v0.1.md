# Phase 3 Test Contract: Attempt + AI Move + Submit + Recall

```
Date: 2026-05-18
Status: pending-confirmation
```

## 1. User Stories

**US-1:** As a learner in play mode, when it is the AI's turn according to `playerConfig`, I want the AI to auto-play and have the move tracked as `actor: 'ai'` on the attempt.

**US-2:** As a learner in play mode, I want to configure black and white sides independently as human or AI.

**US-3:** As a learner in problem mode, when the opponent is configured as AI, I want the AI to auto-respond; the AI's response must be constrained by the task's `problemArea`.

**US-4:** As a learner, when the AI has no valid move within the problem area, it should not force a move.

**US-5:** As a learner, when I click Submit, the system should evaluate my move record (move evaluations + bad moves), determine the attempt result, freeze the attempt, create a recall session, and switch to recall mode.

**US-6:** As a learner, AI moves should be written to the attempt's `userLine` and tracked as `ai` in `moveActors`, so recall can replay the full sequence.

**US-7:** As a developer, `appendMove` should accept an optional `actor` parameter while remaining backward compatible, so existing callers don't need immediate changes.

**US-8:** As a learner, after submit, runtime store state (problemView, activeAttempt) should be consistent -- problemView cleared, recall session active.

## 2. Mutation Contracts

| Operation | Contract Type | Description |
|---|---|---|
| `attemptService.appendMove(attemptId, move, actor?)` | `playMove` | Append to `userLine`, append `{moveIndex, actor}` to `moveActors` |
| `aiMoveService.shouldAiMove(tab, attempt)` | no mutation (read-only) | Returns boolean |
| `aiMoveService.requestAiMove(input)` | `playMove` (via orchestration) | Returns move coordinate string, caller does actual append |
| `engineMoveAdapter.requestMove(input)` | no mutation (read-only) | Delegates to engine, returns move |
| `workbenchFlowService.submit(tabId)` | mode transition + evaluation + freeze | Evaluate, freeze, finalize, create recall, switch to recall |

## 3. State Flows

### 3.1 Human Move (Play/Problem)

```
user clicks vertex
  --> resolver: parse intent
  --> attemptService.appendMove(attemptId, move, 'human')
      --> repository.updateAttempt: userLine=[...old, move], moveActors=[...old, {moveIndex, actor:'human'}]
  --> (then check shouldAiMove)
```

### 3.2 AI Move (Play Mode, after human move)

```
shouldAiMove(tab, attempt) = true
  --> aiMoveService.requestAiMove({tab, attempt, task})
      --> engineMoveAdapter.requestMove({positionSgf, ...params})
      <-- returns move coordinate or null
  --> if move: attemptService.appendMove(attemptId, move, 'ai')
```

### 3.3 AI Move (Problem Mode, after human move)

```
shouldAiMove(tab, attempt) = true
  --> aiMoveService.requestAiMove({tab, attempt, task})
      --> engineMoveAdapter.requestMove({positionSgf, analysisArea: task.problemArea, ...})
      <-- returns {move, candidates}
      --> if task.problemArea: filter candidates to area; if move outside area, return null
  --> if move: attemptService.appendMove(attemptId, move, 'ai')
```

### 3.4 Submit Flow (enhanced)

```
submit(tabId)
  --> assertTransition(tab, 'submit')
  --> freezeAttempt(attemptId)
  --> listMoveEvaluations(attemptId)
  --> listBadMoves(attemptId)
  --> evaluateAttempt({attempt, evals, badMoves})
  --> finalizeAttemptResult(attemptId, result)
  --> createRecallFromAttempt(attemptId)
  --> workbenchStore.updateTab: mode='recall', activeRecallSessionId=session.id
  --> runtimeStore.setProblemView(null)
```

## 4. Allowed Side Effects

- `attemptService.appendMove`: updates attempt persistence (userLine, moveActors)
- `aiMoveService.requestAiMove`: calls engine adapter (network/process IPC)
- `engineMoveAdapter.requestMove`: sends command to GTP engine, waits for response
- `workbenchFlowService.submit`: updates repo (freeze, finalize, create recall), updates workbenchStore (mode transition), updates runtimeStore (clear problemView)
- `runtimeStore.setActiveAttempt`, `runtimeStore.setActiveRecallSession`: runtime state changes
- Logging: structured logs only

## 5. Prohibited Side Effects

- `aiMoveService.shouldAiMove` must NOT modify store, repo, or engine (pure function)
- `engineMoveAdapter` must NOT directly write to training repository or workbench store
- `recallService.createRecallFromAttempt` must NOT write to the formal game tree (only recall tables)
- Analysis mode free play must NOT modify `attempt.userLine` (architecture boundary)
- Submit must NOT skip evaluation step -- result must be determined from evaluation/bad move data
- Submit must NOT create recall session before freeze (ordering is a business contract)

## 6. Test Contracts

### 6.1 attemptService.appendMove Enhancement

| ID | Type | Priority | Contract |
|---|---|---|---|
| C01 | unit | P0 | `appendMove(attemptId, move, 'human')` appends to `userLine` and adds `{moveIndex, actor:'human'}` to `moveActors` |
| C02 | unit | P0 | `appendMove(attemptId, move, 'ai')` appends to `userLine` and adds `{moveIndex, actor:'ai'}` to `moveActors` |
| C03 | unit | P0 | `appendMove(attemptId, move)` without actor defaults to `'human'` (backward compat) |
| C04 | unit | P1 | `appendMove` throws when attempt is not in `'playing'` status |
| C05 | unit | P1 | `appendMove` throws when attempt is not found |
| C06 | unit | P0 | `moveIndex` in `moveActors` matches zero-based index in `userLine` |

### 6.2 aiMoveService.shouldAiMove

| ID | Type | Priority | Contract |
|---|---|---|---|
| C07 | unit | P0 | Returns `false` when `playerConfig` is undefined |
| C08 | unit | P0 | Returns `false` when no active attempt |
| C09 | unit | P0 | In play mode, returns `true` when it is AI's turn after human just played |
| C10 | unit | P0 | In play mode, returns `false` when it is human's turn |
| C11 | unit | P1 | In play mode, returns `false` when both sides are human |
| C12 | unit | P0 | In problem mode, returns `true` when opponent is AI after human solver played |
| C13 | unit | P0 | Returns `false` in recall or analysis mode |
| C34 | unit | P0 | `shouldAiMove` is a pure function -- only uses input (tab, attempt, task.sideToMove), no external state |
| C36 | unit | P1 | Returns `false` when `playerConfig.ai.autoPlay === false` |
| C37 | unit | P2 | In AI vs AI play, returns `true` after each AI move |

### 6.3 aiMoveService.requestAiMove

| ID | Type | Priority | Contract |
|---|---|---|---|
| C14 | unit | P1 | Calls `engineMoveAdapter.requestMove` with correct params (positionSgf, engine params, analysisArea if available) |
| C15 | unit | P0 | In play mode, returns engine's top move |
| C16 | unit | P0 | In problem mode, returns move when engine move is inside `problemArea` |
| C17 | unit | P0 | In problem mode, returns `null` when engine move is outside `problemArea` |
| C18 | unit | P1 | When no `problemArea`, returns engine's top move (no area filtering) |
| C19 | unit | P1 | Returns `null` when engineMoveAdapter returns `null` |

### 6.4 engineMoveAdapter.requestMove

| ID | Type | Priority | Contract |
|---|---|---|---|
| C20 | unit | P1 | Delegates to engine and returns `{move, candidates}` |
| C21 | unit | P1 | Passes `analysisArea` to constrain engine analysis scope |

### 6.5 workbenchFlowService.submit Enhancement

| ID | Type | Priority | Contract |
|---|---|---|---|
| C22 | unit | P0 | Submit full flow: attempt status='submitted', result finalized, recall created, tab.mode='recall' |
| C23 | unit | P0 | Submit sets attempt status to `'submitted'` |
| C24 | unit | P0 | Submit determines result from evaluation data |
| C25 | unit | P0 | Submit creates recall session with `attemptId` pointing to frozen attempt |
| C26 | unit | P0 | Submit sets `tab.activeRecallSessionId` |
| C27 | unit | P1 | Submit is no-op when `activeAttemptId` is not set (graceful degradation) |
| C28 | unit | P1 | Submit finalizes `'pass'` when no bad moves |
| C29 | unit | P1 | Submit finalizes `'fail'` when severe bad moves |
| C30 | unit | P1 | Submit finalizes `'soft_pass'` when only minor bad moves |
| C31 | unit | P1 | Submit clears problemView and activates recall in runtime store |
| C38 | unit | P0 | Submit writes attempt result to persistence |
| C39 | unit | P0 | Submit step ordering: freeze -> evaluate -> finalize -> create recall -> mode transition |

### 6.6 Architecture Boundaries

| ID | Type | Priority | Contract |
|---|---|---|---|
| C32 | unit | P0 | `shouldAiMove` does not modify store, repo, or engine |
| C33 | unit | P0 | `engineMoveAdapter` does not write to training repo or workbench store |

## 7. Fragile Test Warnings

1. **C09/C10/C12 (shouldAiMove turn calculation)**: Turn determination depends on `userLine.length` and `task.sideToMove`. Tests should frame this as "given config and move history, should AI move?" rather than asserting internal turn calculation.

2. **C17 (problem area boundary)**: Test coordinates in/out of area, not exact boundary check implementation (inclusive vs exclusive). Use clear in-area/out-of-area examples.

3. **C39 (submit ordering)**: Do NOT test function call order. Test via observable state: attempt is frozen, result is finalized, recall is created, mode is transitioned. The ordering contract that freeze happens before recall creation can be tested by making recall creation fail and asserting attempt is already frozen.

4. **C14 (adapter args)**: Test the parameters the adapter receives, not the specific method names it calls internally.

5. **C24 (evaluation result)**: `evaluateAttempt` is a pure function already tested separately. Submit tests should verify submit delegates correctly, not re-test evaluation logic.

## 8. Out of Scope

- Analysis mode free play not affecting attempt (Phase 6)
- recallCheckpointService (Phase 5)
- Review scheduling (Phase 7)
- `playTrainingMonitor` integration with mode (Phase 4)
- AI move loop orchestration (scheduling consecutive AI moves in AI vs AI) -- Phase 3 only covers `shouldAiMove` decision
- `problemFlowService.submitActiveProblem` refactoring to use unified submit path
- Pre-existing mode transition timing issue in `workbenchFlowService.submit`
