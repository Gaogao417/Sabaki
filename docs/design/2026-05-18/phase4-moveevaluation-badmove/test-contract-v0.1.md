# Phase 4 Test Contract: MoveEvaluation / BadMove

```
Date: 2026-05-18
Status: pending-confirmation
```

## 1. User Stories

**US-1:** As a learner, every move I make during play/problem mode should generate a pending MoveEvaluation that tracks position hash and awaits analysis.

**US-2:** As a learner, when the engine provides analysis results, my pending MoveEvaluation should be updated with scoreDrop, winrateDrop, engineSuggestedMove, and engineSuggestedLine.

**US-3:** As a learner, when my move causes a major or severe score drop, the system should create a BadMove record for review. Minor drops should NOT create BadMove records.

**US-4:** As a learner, if engine analysis takes too long (>30s), my pending evaluation should be marked as failed, and should NOT create a BadMove.

**US-5:** As a learner, when I submit my attempt, failed evaluations should NOT be used as decisive pass/fail evidence — only evaluated ones count.

**US-6:** As a developer, `classifySeverity` should be a pure function — no external state, no side effects.

**US-7:** As a developer, `evaluateMove` should be a pure function that computes evaluation from before/after analysis results.

**US-8:** As a developer, regular MoveEvaluation records should NOT store full SGF snapshots — only BadMove / Checkpoint / Snapshot records do.

**US-9:** As a developer, BadMove records should use `generatedTaskId` for derived task references.

**US-10:** As a developer, `playTrainingMonitor` should integrate with `analysisResultAdapter` to receive real-time analysis updates and automatically evaluate pending moves.

## 2. Mutation Contracts

| Operation | Contract Type | Description |
|---|---|---|
| `playTrainingMonitor.onUserMove(...)` | `createEvaluation` | Creates pending MoveEvaluation in repo + runtime store |
| `playTrainingMonitor.onAnalysisUpdated(...)` | `updateEvaluation` | Updates pending evaluation to 'evaluated', optionally creates BadMove |
| `playTrainingMonitor.failExpiredPendingEvaluations()` | `updateEvaluation` | Marks expired pending evaluations as 'failed' |
| `playTrainingMonitor.startForAttempt(...)` | `subscribe` | Binds monitor to attempt, subscribes to analysis updates |
| `playTrainingMonitor.stopForAttempt(...)` | `unsubscribe` | Unbinds monitor, unsubscribes from analysis |
| `evaluationRules.classifySeverity(...)` | pure function | No mutation — returns Severity |
| `evaluationRules.evaluateMove(...)` | pure function | No mutation — returns MoveEvaluation |
| `evaluationRules.evaluateAttempt(...)` | pure function | No mutation — returns TrainingAttemptResult |
| `evaluationRules.shouldCreateBadMove(severity)` | pure function | No mutation — returns boolean |

## 3. State Flows

### 3.1 User Move → Pending Evaluation

```
user makes a move
  --> playTrainingMonitor.onUserMove({attemptId, moveIndex, move, positionBeforeHash})
      --> creates MoveEvaluation {status:'pending', move, positionBeforeHash}
      --> attemptService.saveMoveEvaluation(evaluation)
          --> repository.createMoveEvaluation(evaluation)
          --> runtimeStore.upsertPendingMoveEvaluation(evaluation)
```

### 3.2 Analysis Update → Evaluated + Possible BadMove

```
engine provides analysis for a position
  --> analysisResultAdapter.notifyAnalysisUpdate(positionKey)
  --> monitor.onAnalysisUpdated({positionKey})
      --> find pending evaluations for active attempt
      --> for each pending: get beforeEval + afterEval
      --> evaluateMove({beforeEval, afterEval, move, moveIndex})
      --> repository.updateMoveEvaluation(id, {status:'evaluated', scoreDrop, ...})
      --> runtimeStore.removePendingMoveEvaluation(id)
      --> classifySeverity({scoreDrop, winrateDrop})
      --> if shouldCreateBadMove(severity):
            --> create BadMove {severity, moveEvaluationId, attemptId, taskId}
            --> attemptService.saveBadMove(badMove)
            --> runtimeStore.setVisibleBadMoveIds([...ids, badMove.id])
```

### 3.3 Timeout → Failed Evaluation

```
failExpiredPendingEvaluations() called
  --> filter pending where createdAt + 30s < now
  --> for each expired:
      --> repository.updateMoveEvaluation(id, {status:'failed'})
      --> runtimeStore.removePendingMoveEvaluation(id)
      --> do NOT create BadMove for failed evaluations
```

### 3.4 Submit with Failed Evaluations

```
workbenchFlowService.submit(tabId)
  --> freezeAttempt(attemptId)
  --> listMoveEvaluationsByAttempt(attemptId)
  --> listBadMovesByAttempt(attemptId)
  --> evaluateAttempt({attempt, evaluations, badMoves})
      --> if any evaluations are still 'pending' → result = 'pending'
      --> 'failed' evaluations are ignored (not pending, not creating BadMove)
      --> only evaluated evaluations contribute to BadMove count
  --> finalizeAttemptResult(attemptId, result)
```

## 4. Allowed Side Effects

- `playTrainingMonitor.onUserMove`: writes to repository (createMoveEvaluation), updates runtime store (upsertPendingMoveEvaluation)
- `playTrainingMonitor.onAnalysisUpdated`: updates repository (updateMoveEvaluation, createBadMove), updates runtime store (removePendingMoveEvaluation, setVisibleBadMoveIds)
- `playTrainingMonitor.failExpiredPendingEvaluations`: updates repository (updateMoveEvaluation), updates runtime store (removePendingMoveEvaluation)
- `attemptService.saveMoveEvaluation`: calls repository + updates runtime store
- `attemptService.saveBadMove`: calls repository
- Logging: structured logs via logger

## 5. Prohibited Side Effects

- `classifySeverity` must NOT access external state or modify anything
- `evaluateMove` must NOT access external state or modify anything
- `shouldCreateBadMove` must NOT access external state or modify anything
- `evaluateAttempt` must NOT access external state or modify anything
- `playTrainingMonitor` must NOT write to the game tree
- `playTrainingMonitor` must NOT create BadMove for 'minor' severity
- `playTrainingMonitor` must NOT create BadMove for 'failed' evaluations
- `analysisResultAdapter` must NOT directly write to training repository or workbench store
- Failed evaluations must NOT influence pass/fail decision in `evaluateAttempt`

## 6. Test Contracts

### 6.1 evaluationRules.classifySeverity (pure function)

| ID | Type | Priority | Contract |
|---|---|---|---|
| C01 | unit | P0 | Returns `'none'` when scoreDrop and winrateDrop are undefined |
| C02 | unit | P0 | Returns `'none'` when scoreDrop is 0 |
| C03 | unit | P0 | Returns `'minor'` when scoreDrop >= 2.0 (default threshold) |
| C04 | unit | P0 | Returns `'minor'` when scoreDrop >= 2.0 and < 5.0 |
| C05 | unit | P0 | Returns `'major'` when scoreDrop >= 5.0 (default threshold) |
| C06 | unit | P0 | Returns `'major'` when scoreDrop >= 5.0 and < 8.0 |
| C07 | unit | P0 | Returns `'severe'` when scoreDrop >= 8.0 (fixed threshold) |
| C08 | unit | P0 | Returns `'minor'` when winrateDrop >= 0.05 (winrate alone only reaches minor) |
| C09 | unit | P0 | Returns `'none'` when winrateDrop < 0.05 |
| C10 | unit | P0 | scoreDrop takes precedence over winrateDrop for severity classification |
| C11 | unit | P1 | Respects custom passRule.scoreDropThreshold for minor threshold |
| C12 | unit | P1 | Respects custom passRule.severeDropThreshold for major threshold |
| C13 | unit | P1 | Respects custom passRule.winrateDropThreshold |

### 6.2 evaluationRules.evaluateMove (pure function)

| ID | Type | Priority | Contract |
|---|---|---|---|
| C14 | unit | P0 | Returns evaluation with status='pending' when no analysis results |
| C15 | unit | P0 | Returns evaluation with status='evaluated' when before/after analysis provided |
| C16 | unit | P0 | Computes scoreDrop as abs(beforeScoreLead - afterScoreLead) |
| C17 | unit | P0 | Computes winrateDrop as abs(beforeWinrate - afterWinrate) |
| C18 | unit | P0 | Extracts engineSuggestedMove from beforeEval.candidateMoves[0].move |
| C19 | unit | P0 | Extracts engineSuggestedLine from beforeEval.candidateMoves[0].pv |
| C20 | unit | P1 | Generates unique IDs across calls |
| C21 | unit | P0 | Does NOT modify any external state |

### 6.3 evaluationRules.shouldCreateBadMove

| ID | Type | Priority | Contract |
|---|---|---|---|
| C22 | unit | P0 | Returns `false` for severity `'none'` |
| C23 | unit | P0 | Returns `false` for severity `'minor'` — minor drops do NOT create BadMove |
| C24 | unit | P0 | Returns `true` for severity `'major'` |
| C25 | unit | P0 | Returns `true` for severity `'severe'` |

### 6.4 evaluationRules.evaluateAttempt

| ID | Type | Priority | Contract |
|---|---|---|---|
| C26 | unit | P0 | Returns `'abandoned'` when attempt status is `'abandoned'` |
| C27 | unit | P0 | Returns `'pending'` when any evaluation has status `'pending'` |
| C28 | unit | P0 | Returns `'pass'` when no bad moves and all evaluations evaluated |
| C29 | unit | P0 | Returns `'soft_pass'` when only minor bad moves |
| C30 | unit | P0 | Returns `'soft_pass'` when only major bad moves (no severe) |
| C31 | unit | P0 | Returns `'fail'` when severe bad moves exist (default, no passRule) |
| C32 | unit | P1 | Returns `'fail'` when passRule.requireNoSevereBadMove and severe exists |
| C33 | unit | P1 | Returns `'fail'` when passRule.maxBadMoveCount exceeded |
| C34 | unit | P0 | `'failed'` evaluations are NOT treated as `'pending'` — they don't block result |

### 6.5 playTrainingMonitor.onUserMove

| ID | Type | Priority | Contract |
|---|---|---|---|
| C35 | unit | P0 | Creates MoveEvaluation with status='pending' and persists to repository |
| C36 | unit | P0 | Stores evaluation in runtimeStore.pendingMoveEvaluations |
| C37 | unit | P0 | Includes beforeScoreLead/beforeWinrate from analysis if available at move time |
| C38 | unit | P1 | Generates unique evaluation IDs |

### 6.6 playTrainingMonitor.onAnalysisUpdated

| ID | Type | Priority | Contract |
|---|---|---|---|
| C39 | unit | P0 | Updates pending evaluation to status='evaluated' with scoreDrop/winrateDrop |
| C40 | unit | P0 | Removes evaluation from runtimeStore.pendingMoveEvaluations after update |
| C41 | unit | P0 | Creates BadMove when severity is `'major'` |
| C42 | unit | P0 | Creates BadMove when severity is `'severe'` |
| C43 | unit | P0 | Does NOT create BadMove when severity is `'minor'` |
| C44 | unit | P0 | Does NOT create BadMove when severity is `'none'` |
| C45 | unit | P0 | Adds BadMove ID to runtimeStore.visibleBadMoveIds when created |
| C46 | unit | P1 | Skips evaluation when no beforeEval available (waits for more data) |
| C47 | unit | P0 | Does nothing when no active monitor |
| C48 | unit | P0 | Does nothing when no pending evaluations for active attempt |

### 6.7 playTrainingMonitor.failExpiredPendingEvaluations

| ID | Type | Priority | Contract |
|---|---|---|---|
| C49 | unit | P0 | Marks evaluations older than 30s as 'failed' in repository |
| C50 | unit | P0 | Removes expired evaluations from runtimeStore.pendingMoveEvaluations |
| C51 | unit | P0 | Does NOT create BadMove for failed evaluations |
| C52 | unit | P0 | Does not fail evaluations younger than 30s |
| C53 | unit | P0 | Does nothing when no active monitor |

### 6.8 playTrainingMonitor.startForAttempt / stopForAttempt

| ID | Type | Priority | Contract |
|---|---|---|---|
| C54 | unit | P0 | startForAttempt subscribes to analysis updates |
| C55 | unit | P0 | stopForAttempt unsubscribes from analysis updates |
| C56 | unit | P0 | After stop, onAnalysisUpdated does nothing |
| C57 | unit | P0 | stopForAttempt ignores non-active attempt IDs |

### 6.9 SGF Snapshot Optimization

| ID | Type | Priority | Contract |
|---|---|---|---|
| C58 | unit | P1 | onUserMove does NOT save positionBeforeSgf/positionAfterSgf in MoveEvaluation |
| C59 | unit | P1 | BadMove creation includes positionBeforeSgf/positionAfterSgf when provided |

### 6.10 Architecture Boundaries

| ID | Type | Priority | Contract |
|---|---|---|---|
| C60 | unit | P0 | classifySeverity is a pure function — no side effects, no external state |
| C61 | unit | P0 | evaluateMove is a pure function — no side effects, no external state |
| C62 | unit | P0 | shouldCreateBadMove is a pure function — no side effects |
| C63 | unit | P0 | analysisResultAdapter does not write to training repo or workbench store |
| C64 | unit | P0 | playTrainingMonitor does not write to the game tree |

## 7. Fragile Test Warnings

1. **C03-C07 (threshold boundary)**: Test exact threshold values (>=2.0, >=5.0, >=8.0) and values just below. Don't test internal threshold constants — test the behavior at boundaries.

2. **C49-C52 (timeout)**: Use controlled timestamps (passing `now` parameter) rather than relying on real-time delays. The 30s timeout is an implementation detail; tests should verify "old enough evaluations fail, recent ones don't."

3. **C34 (failed vs pending)**: Distinguish 'failed' (timed out) from 'pending' (still waiting). Both are non-evaluated, but only 'pending' blocks the result.

4. **C43 (minor no BadMove)**: This is a critical behavioral change from current code. Test with a scoreDrop of exactly 2.0 (minor threshold) and verify NO BadMove is created.

## 8. Out of Scope

- RecallCheckpoint integration (Phase 5)
- SnapshotService (Phase 6)
- Review scheduling (Phase 7)
- Legacy mode cleanup (Phase 8)
- AI move loop orchestration (Phase 3)
- Integration with UI components
- Engine analysis pipeline internals
