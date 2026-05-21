# W4 Recall Mode Wiring Contract

Date: 2026-05-21
Status: pending-confirmation

## 0. Source of Truth

This contract is subordinate to:

- `docs/design/gabaki-sabaki-training-prd-v0.5.md`
- `docs/design/gabaki-sabaki-training-architecture-v0.5.md`

### Source Alignment

| Truth Source | Section | Constraint on This Contract |
| --- | --- | --- |
| PRD v0.5 | §2.5 Recall is obstructed active research | Recall produces friction: reproduce line → hit bad move → correct yourself → reveal AI → write comment |
| PRD v0.5 | §3.3 Recall Mode | ExpectedMoves = attempt.userLine; user recalls move-by-move; major/severe BadMove triggers Checkpoint |
| PRD v0.5 | §4.8 RecallSession | Session binds attemptId; currentMoveIndex tracks progress; completed flag |
| PRD v0.5 | §4.9 RecallAttempt | Each move attempt: expectedMove vs userMove, isCorrect, hintLevelUsed |
| PRD v0.5 | §4.10 RecallCheckpoint | Status: pending_correction → ai_revealed → commented/skipped; userCorrectionLine; aiCandidateLines |
| PRD v0.5 | §5.3 Recall Checkpoint flow | submitRecallMove → shouldTriggerCheckpoint → startCheckpoint → correction → reveal → comment → resume |
| PRD v0.5 | §8.3 Recall acceptance | Recall reproduces userLine; major/severe BadMove pauses; user corrects; AI revealed on request; comment saved |
| Arch v0.5 | §4.2 workbenchStore | tab.activeRecallSessionId tracks active session; tab.mode = 'recall' |
| Arch v0.5 | §4.3 trainingRuntimeStore | activeRecallSessionId, activeCheckpointId, correctionDraft, recallView with moveIndex/expectedMoves/userAttempts/showHint/completed |
| Arch v0.5 | §5.3 workbenchFlowService | submit → creates RecallSession → mode=recall; completeRecall → mode=analysis; enterAnalysis from recall |
| Arch v0.5 | §5.8 recallService | createRecallFromAttempt, submitRecallMove, completeRecall |
| Arch v0.5 | §5.9 recallCheckpointService | shouldTriggerCheckpoint, startCheckpoint, submitUserCorrectionLine, revealAiCandidateLines, saveComment, skipCheckpoint, resumeRecall |
| Arch v0.5 | §9.5 Recall Checkpoint command path | submitRecallMove → shouldTriggerCheckpoint → startCheckpoint → runtimeStore.setActiveCheckpoint |
| Arch v0.5 | §10.4 Recall Checkpoint UI rendering | runtimeStore.activeCheckpointId → load checkpoint → load BadMove/Evaluation/Comment → RecallCheckpointPanel |
| Arch v0.5 | §14 Architecture red lines | Recall answers MUST NOT write to game tree; Analysis doesn't pollute Attempt; Stores capped 2-3 |

## 1. Scope

### In scope:

1. **Recall session controls wiring** — hint, skip, end, progress projection
2. **Checkpoint sub-flow wiring** — start checkpoint, submit correction, reveal AI, save comment, skip, resume
3. **Container handler wiring** — new handlers for all recall-specific callbacks
4. **Projection enhancement** — checkpoint state, correct/wrong counts, panel state overlay
5. **State return path** — store updates project through container subscription to UI props

### Deferred:

| Deferred item | Reason | Exit condition |
| --- | --- | --- |
| `onMarkCheckpoint` (manual checkpoint trigger) | No PRD requirement for user-initiated checkpoint; checkpoints auto-trigger on major/severe BadMove | Product confirms manual checkpoint feature |
| `onVerify` (verify button) | No PRD/Architecture definition for verification step | Product defines verify behavior |
| `recallOriginalLine` toggle | No PRD business definition for toggling recall mode | Product defines toggle behavior |
| Board click → recallView refresh (GAP-R1) | recallInteractionExecutor handles board click but recallView refresh is in legacy controller | Full migration from legacy to service-based recall |

### Pre-existing wiring (W3.5, NOT re-tested):

- Board click routing to recallInteractionExecutor (W35-T19, W35-T20)
- recallInteractionExecutor does NOT write to documentStore
- resolveRecall() returns SUBMIT_RECALL_ANSWER intent

## 2. Control-to-Command Mapping

### 2.1 Recall Session Controls

| UI Control | Panel Prop | Container Handler | Service/Store Call | Store Transition |
| --- | --- | --- | --- | --- |
| Hint button | `onHint` | `handleRecallHint()` | `runtimeStore.setRecallView({...view, showHint: true})` | recallView.showHint: false → true |
| Skip button | `onSkip` | `handleRecallSkip()` | `legacyTrainingFlowController.skipRecallMove()` | recallView.moveIndex: N → N+1; userAttempts += skip attempt |
| End Recall button | `onEndRecall` | `handleEndRecall()` | `flowService.completeRecall(tabId)` | tab.mode: recall → analysis; runtimeStore.activeRecallSessionId → undefined |
| Enter Analysis | `onAnalysis` / `onEnterAnalysis` | `handleEnterAnalysis()` | `flowService.enterAnalysis(tabId)` | tab.mode: recall → analysis; tab.previousMode = 'recall' |

### 2.2 Checkpoint Controls

| UI Control | Panel Prop | Container Handler | Service/Store Call | Store Transition |
| --- | --- | --- | --- | --- |
| Submit Correction | `onSubmitCorrection` | `handleSubmitCorrection()` | `recallCheckpointService.submitUserCorrectionLine({checkpointId, moves})` | checkpoint.status: pending_correction → unchanged (awaiting reveal); runtimeStore.correctionDraft → undefined |
| Reveal AI | `onRevealAI` | `handleRevealAI()` | `recallCheckpointService.revealAiCandidateLines(checkpointId)` | checkpoint.status: pending_correction → ai_revealed; aiCandidateLines populated |
| Skip Checkpoint | `onSkipCheckpoint` | `handleSkipCheckpoint()` | `recallCheckpointService.skipCheckpoint(checkpointId)` | checkpoint.status → skipped; runtimeStore.activeCheckpointId → undefined; session.currentMoveIndex += 1 |
| (Comment save) | Future: comment form | `handleSaveCheckpointComment()` | `recallCheckpointService.saveComment({checkpointId, comment})` + `resumeRecall(checkpointId)` | checkpoint.status → commented; runtimeStore.activeCheckpointId → undefined; session.currentMoveIndex += 1 |

### 2.3 Checkpoint Auto-Trigger

| Event | Trigger | Service Call | Store Transition |
| --- | --- | --- | --- |
| Correct recall move at BadMove index | `recallService.submitRecallMove()` internally checks | `checkpointService.shouldTriggerCheckpoint()` → `startCheckpoint()` | runtimeStore.activeCheckpointId: undefined → checkpointId |

Note: The checkpoint auto-trigger is already implemented inside `recallService.submitRecallMove()`. W4 wiring needs to ensure that when activeCheckpointId becomes set, the UI projection reflects it.

## 3. State Transitions

### 3.1 Recall Session Lifecycle

```text
[no recallView]
  → flowService.submit(tabId)
  → recallView = {moveIndex: 0, expectedMoves, userAttempts: [], showHint: false, completed: false}
  → tab.mode = 'recall'

[recallView active, moveIndex < expectedMoves.length]
  → handleRecallHint()
  → recallView.showHint = true

  → handleRecallSkip()
  → recallView.moveIndex += 1
  → recallView.userAttempts += {isCorrect: false, userMove: 'skip'}

  → board click → recallInteractionExecutor → legacy controller updates recallView
  → (correct move at BadMove index → activeCheckpointId set → checkpoint substate)

[recallView.completed = true or user clicks End]
  → handleEndRecall()
  → tab.mode = 'analysis'
  → recallView = null
  → activeRecallSessionId = undefined
```

### 3.2 Checkpoint Sub-flow

```text
[recallView active, activeCheckpointId = undefined]
  → correct move at major/severe BadMove index
  → activeCheckpointId = 'cp_xxx'

[activeCheckpointId set]
  → UI shows checkpoint panel with correction/reveal/skip buttons

  → handleSubmitCorrection({moves: [...]})
  → checkpoint.status = pending_correction (correction saved but status unchanged)
  → correctionDraft = undefined

  → handleRevealAI()
  → checkpoint.status = ai_revealed
  → aiCandidateLines populated from MoveEvaluation

  → handleSaveCheckpointComment({content: '...'})
  → checkpoint.status = commented
  → activeCheckpointId = undefined
  → session.currentMoveIndex += 1

  OR

  → handleSkipCheckpoint()
  → checkpoint.status = skipped
  → activeCheckpointId = undefined
  → session.currentMoveIndex += 1
```

## 4. Projection Enhancements

The current `projectFromRuntime(rt)` outputs basic recall fields but is missing checkpoint and progress detail fields. W4 adds:

| Projected Prop | Source | Target Component Prop |
| --- | --- | --- |
| `activeCheckpointId` | `rt.activeCheckpointId` | RecallModePanel.activeCheckpointId |
| `correctionDraft` | `rt.correctionDraft` | RecallModePanel (for correction submission) |
| `recallCorrectCount` | `rt.recallView.userAttempts.filter(a => a.isCorrect).length` | RecallModePanel.correctCount |
| `recallWrongCount` | `rt.recallView.userAttempts.filter(a => !a.isCorrect).length` | RecallModePanel.wrongCount |
| `recallTotalMoves` | `rt.recallView.expectedMoves.length` | RecallModePanel.totalMoves |
| `recallProgress` | `(moveIndex / totalMoves) * 100` | RecallModePanel.progress |
| `recallStatus` | derived from state: 'active' / 'completed' | RecallModePanel.status |
| `recallPanelState` | derived: 'empty' if no view, 'active' if active, 'success' if completed, 'disabled' if not recall mode | RecallModePanel.state |

## 5. Test Matrix

### 5.1 State Forward Tests

| Test ID | Description | Command | Store Before | Store After | Status |
| --- | --- | --- | --- | --- | --- |
| W4-T01 | Hint shows hint for current move | `handleRecallHint()` | `recallView.showHint = false` | `recallView.showHint = true` | GREEN |
| W4-T02 | Skip advances moveIndex, adds wrong attempt | `handleRecallSkip()` | `recallView.moveIndex = 2, userAttempts.length = 2` | `recallView.moveIndex = 3, userAttempts.length = 3, last.isCorrect = false` | GREEN |
| W4-T03 | End recall transitions to analysis | `handleEndRecall()` | `tab.mode = 'recall', activeRecallSessionId = 'rs_1'` | `tab.mode = 'analysis', activeRecallSessionId = undefined` | GREEN |
| W4-T04 | Enter analysis from recall | `handleEnterAnalysis()` | `tab.mode = 'recall'` | `tab.mode = 'analysis', tab.previousMode = 'recall'` | GREEN |
| W4-T05 | Submit correction line | `handleSubmitCorrection()` | `activeCheckpointId = 'cp_1', checkpoint.status = 'pending_correction'` | `checkpoint.userCorrectionLine = [...], correctionDraft = undefined` | GREEN |
| W4-T06 | Reveal AI candidates | `handleRevealAI()` | `checkpoint.status = 'pending_correction'` | `checkpoint.status = 'ai_revealed', aiCandidateLines.length > 0` | GREEN |
| W4-T07 | Skip checkpoint resumes recall | `handleSkipCheckpoint()` | `activeCheckpointId = 'cp_1'` | `activeCheckpointId = undefined, session.currentMoveIndex += 1` | GREEN |
| W4-T08 | Save comment and resume | `handleSaveCheckpointComment()` | `checkpoint.status = 'ai_revealed', activeCheckpointId = 'cp_1'` | `checkpoint.status = 'commented', activeCheckpointId = undefined, session.currentMoveIndex += 1` | GREEN |

### 5.2 State Return Tests (Projection)

| Test ID | Description | Store Update | Projected Props Asserted | Status |
| --- | --- | --- | --- | --- |
| W4-T09 | recallView projects progress props | `runtimeStore.setRecallView({moveIndex: 3, expectedMoves: 5 moves, userAttempts: 3})` | `recallMoveIndex = 3`, `recallTotalMoves = 5`, `recallCorrectCount = computed`, `recallProgress = 60` | GREEN |
| W4-T10 | activeCheckpointId projects to panel | `runtimeStore.setActiveCheckpoint('cp_1')` | `activeCheckpointId = 'cp_1'` in projected props | GREEN |
| W4-T11 | No recallView projects empty state | `runtimeStore.setRecallView(null)` | `recallPanelState = 'empty'` | GREEN |
| W4-T12 | Completed recallView projects success state | `runtimeStore.setRecallView({...view, completed: true})` | `recallPanelState = 'success'` | GREEN |
| W4-T13 | correctCount/wrongCount derived from userAttempts | `runtimeStore.setRecallView({userAttempts: [{isCorrect: true}, {isCorrect: false}, {isCorrect: true}]})` | `recallCorrectCount = 2`, `recallWrongCount = 1` | GREEN |
| W4-T14 | mode='analysis' + no recallView → panel state disabled | `workbenchStore tab mode = 'analysis', runtimeStore.recallView = null` | `recallPanelState = 'disabled'` | GREEN |

### 5.3 Side-Effect Isolation Tests

| Test ID | Description | Forbidden Side Effect | Asserted | Status |
| --- | --- | --- | --- | --- |
| W4-T15 | Hint does not modify game tree | documentStore.playMove not called | GREEN |
| W4-T16 | Skip does not modify game tree | documentStore.playMove not called | GREEN |
| W4-T17 | Checkpoint skip does not modify game tree | documentStore.playMove not called | GREEN |
| W4-T18 | Reveal AI does not modify Attempt.userLine | attemptService.appendMove not called | GREEN |

### 5.4 Architecture Boundary Tests

| Test ID | Description | Boundary Rule | Status |
| --- | --- | --- | --- |
| W4-T19 | Container handlers call services, not repository directly | No repository import in Container | GREEN |
| W4-T20 | RecallModePanel remains presentational | Panel does not import recallService, runtimeStore, or repository | GREEN |

### 5.5 MANUAL_ACCEPTANCE

| Test ID | Description | Verification |
| --- | --- | --- |
| W4-MA01 | Click hint → hint visual appears on board | Manual: verify hint indicator shows on board |
| W4-MA02 | Skip move → progress advances, no game tree change | Manual: verify board position unchanged, progress ring advances |
| W4-MA03 | End recall → mode transitions to analysis, board updates | Manual: verify mode bar shows analysis, board switches to scratch |
| W4-MA04 | Checkpoint auto-triggers at BadMove → checkpoint panel appears | Manual: create attempt with known bad move, recall to that point |
| W4-MA05 | Submit correction → reveal AI → comment → resume → recall continues | Manual: complete full checkpoint sub-flow |

## 6. Identified Gaps

### GAP-R1: recallView refresh after recallService.submitRecallMove

The `recallInteractionExecutor` (W3.5) routes board clicks to either `recallService.submitRecallMove()` (service path) or `trainingStore.submitRecallAnswer()` (store path). After the service call, `recallView` is NOT automatically refreshed — only the legacy controller path updates `recallView`.

**Recommendation:** Container should listen for `runtimeStore.activeCheckpointId` changes after each recall move and refresh `recallView` accordingly, or `recallService.submitRecallMove()` should update `recallView` as part of its flow.

**Resolution for W4:** For now, W4 wires the controls that ARE within the Container's responsibility (hint, skip, end, checkpoint actions). Board click → recallView update remains on the legacy controller path, to be migrated in a later phase.

### GAP-R2: Missing Container handlers

The Container currently lacks handlers for: `handleSubmitCorrection`, `handleRevealAI`, `handleSkipCheckpoint`, `handleSaveCheckpointComment`. W4 adds these.

### GAP-R3: Missing projection fields

`projectFromRuntime` currently projects basic recall fields but not: `activeCheckpointId`, `correctCount`, `wrongCount`, `totalMoves`, `progress`, `panelState`, `checkpoints`. W4 adds these.

### GAP-R4: recallService vs legacy controller dual path

Recall board clicks can go through either `recallService.submitRecallMove()` (new path, doesn't update recallView) or `legacyTrainingFlowController.handleRecallMove()` (old path, updates recallView). This dual path needs reconciliation, but W4 focuses on the controls that are uniquely Container-managed.

## 7. Implementation Notes

1. **Container handlers** are synchronous (no async needed for hint, skip). Checkpoint handlers call `recallCheckpointService` which is async.
2. **Projection** derives computed values (correctCount, wrongCount, progress) from `recallView` in `projectFromRuntime()`.
3. **Handlers access services** through `sabaki.getTrainingContext()` — same pattern as existing W2/W3 handlers.
4. **`handleEndRecall`** already exists in Container. It calls `flowService.completeRecall(tabId)`. W4 just needs to ensure it also clears `recallView` and `activeCheckpointId`.
5. **Legacy handlers** for `onShowRecallHint` and `onSkipRecallMove` route through `legacyTrainingFlowController`. W4 should migrate these to direct `runtimeStore` manipulation where possible (hint is pure store update; skip calls legacy controller but should eventually use service).
