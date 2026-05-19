# W0 Control Inventory and Command Map

Date: 2026-05-19
Status: approved

## 1. Control Inventory

### 1.1 Shell Controls

| ID | Component | Control | Classification | Current Status | Proposed Command | Payload | Owner |
|---|---|---|---|---|---|---|---|
| S-01 | GlobalHeader | taskTitle | display-only | display-only | -- | -- | -- |
| S-02 | GlobalHeader | mode chip | display-only | display-only | -- | -- | -- |
| S-03 | GlobalHeader | statusChips | display-only | display-only | -- | -- | -- |
| S-04 | GlobalHeader | engineName | display-only | display-only | -- | -- | -- |
| S-05 | GlobalHeader | engineConnected dot | display-only | display-only | -- | -- | -- |
| S-06 | ModeBar | segmented control (play/problem/recall/analysis) | active | unwired (onModeChange not provided by container) | `switchWorkbenchMode` | `{mode: 'play'\|'problem'\|'recall'\|'analysis'}` | container -> workbenchStore.updateTab |
| S-07 | StoneStatus | captures + player indicator | display-only | display-only | -- | -- | -- |
| S-08 | ModeActions (play) | onNewGame | active | unwired | `startNewGame` | `{}` | container -> controller (not yet exists) |
| S-09 | ModeActions (play) | onSettings | deferred | unwired | -- | -- | deferred: no settings dialog |
| S-10 | ModeActions (play) | onEnd | active | unwired | `endPlaySession` | `{}` | container -> controller |
| S-11 | ModeActions (play) | onResign | active | unwired | `resignGame` | `{}` | container -> controller |
| S-12 | ModeActions (problem) | onSubmit | active | unwired | `submitProblemAttempt` | `{}` | container -> controller.submitProblemAttempt() |
| S-13 | ModeActions (problem) | onAbandon | active | unwired | `abandonProblemAttempt` | `{}` | container -> controller.exitProblemMode() |
| S-14 | ModeActions (problem) | onSettings | deferred | unwired | -- | -- | deferred: no settings dialog |
| S-15 | ModeActions (problem) | onAnalysis | active | unwired | `enterAnalysisFromProblem` | `{}` | container -> workbenchFlowService.transition |
| S-16 | ModeActions (recall) | onAnalysis | active | unwired | `enterAnalysisFromRecall` | `{}` | container -> workbenchFlowService.transition |
| S-17 | ModeActions (recall) | onEnd | active | unwired | `endRecallSession` | `{}` | container -> controller.endRecallSession() |
| S-18 | ModeActions (recall) | onSnapshot | active | unwired | `takeSnapshot` | `{}` | container -> snapshotService.captureSnapshotInput |
| S-19 | ModeActions (analysis) | onSnapshot | active | unwired | `takeSnapshot` | `{}` | container -> snapshotService.captureSnapshotInput |
| S-20 | ModeActions (analysis) | onSettings | deferred | unwired | -- | -- | deferred: no settings dialog |
| S-21 | ModeActions (analysis) | onReturn | active | unwired | `returnFromAnalysis` | `{}` | container -> workbenchFlowService.transition |
| S-22 | GameTabBar | onSelect | active | unwired (container does not provide `games`) | `switchGameTab` | `{index: number}` | container -> workbenchTabService.switchTab |
| S-23 | GameTabBar | onClose | active | unwired | `closeGameTab` | `{index: number}` | container -> workbenchTabService.closeTab |
| S-24 | GameTabBar | onAdd | active | unwired | `addGameTab` | `{}` | container -> workbenchTabService.openGameTab |
| S-25 | TrainingTabBar | onTabChange | deferred | not rendered | -- | -- | deferred: WorkbenchShell uses ModeBar; this component unused |

### 1.2 Bottom Action Bar Controls

| ID | Component | Control | Classification | Current Status | Proposed Command | Payload | Owner |
|---|---|---|---|---|---|---|---|
| B-01 | BottomActionBar (play) | onUndo | active | unwired | `undoMove` | `{}` | container -> sabaki existing undo |
| B-02 | BottomActionBar (play) | onPass | active | unwired | `passMove` | `{}` | container -> sabaki existing pass |
| B-03 | BottomActionBar (play) | onResign | active | unwired | `resignGame` | `{}` | container -> controller |
| B-04 | BottomActionBar (play) | onEndAttempt | active | unwired | `endPlaySession` | `{}` | container -> controller |
| B-05 | BottomActionBar (play) | onMarkDoubtful | active | unwired | `markDoubtful` | `{}` | container -> runtimeStore.upsertPendingMoveEvaluation |
| B-06 | BottomActionBar (problem) | onUndo | active | wired to controller.undoProblemMove() | -- | -- | -- |
| B-07 | BottomActionBar (problem) | onRedo | active | unwired | `redoProblemMove` | `{}` | container -> controller (method not exists) |
| B-08 | BottomActionBar (problem) | onPass | active | unwired | `passInProblem` | `{}` | container -> controller |
| B-09 | BottomActionBar (problem) | onRequestHint | active | unwired | `requestProblemHint` | `{}` | container -> controller (method not exists) |
| B-10 | BottomActionBar (problem) | onSubmitAnswer | active | wired to controller.submitProblemAttempt() | -- | -- | -- |
| B-11 | BottomActionBar (problem) | onAbandonAnswer | active | unwired | `abandonProblemAttempt` | `{}` | container -> controller.exitProblemMode() |
| B-12 | BottomActionBar (recall) | onMarkCheckpoint | active | unwired | `markRecallCheckpoint` | `{}` | container -> controller (method not exists) |
| B-13 | BottomActionBar (recall) | onHint | active | wired to controller.showRecallHint() | -- | -- | -- |
| B-14 | BottomActionBar (recall) | onVerifySkip | active | unwired | `verifySkipRecall` | `{}` | container -> controller.skipRecallMove() (semantic remap) |
| B-15 | BottomActionBar (recall) | onEnterAnalysis | active | unwired | `enterAnalysisFromRecall` | `{}` | container -> workbenchFlowService.transition |
| B-16 | BottomActionBar (analysis) | onUndo | active | unwired | `undoMove` | `{}` | container -> sabaki existing |
| B-17 | BottomActionBar (analysis) | onRedo | active | unwired | `redoMove` | `{}` | container -> sabaki existing |
| B-18 | BottomActionBar (analysis) | onClear | active | unwired | `clearAnalysis` | `{}` | container -> controller (method not exists) |
| B-19 | BottomActionBar (analysis) | onEditPosition | active | unwired | `editPosition` | `{}` | container -> sabaki.setMode('edit') |
| B-20 | BottomActionBar (analysis) | onSnapshot | active | unwired | `takeSnapshot` | `{}` | container -> snapshotService |
| B-21 | BottomActionBar (all) | onSelect | deferred | unwired | -- | -- | deferred: select tool semantics undefined |
| B-22 | BottomActionBar (all) | onHandShape | deferred | unwired | -- | -- | deferred: hand-shape tool semantics undefined |
| B-23 | BottomActionBar (all) | onZoomIn | deferred | unwired | -- | -- | deferred: zoom is UI-only state |
| B-24 | BottomActionBar (all) | onZoomOut | deferred | unwired | -- | -- | deferred: zoom is UI-only state |
| B-25 | BottomActionBar (all) | onFullscreen | deferred | unwired | -- | -- | deferred: fullscreen is window management |
| B-26 | BottomActionBar (analysis) | onAnnotationToolChange | active | unwired | `setAnnotationTool` | `{toolId: string}` | container -> runtimeStore or local state |

### 1.3 Left Panel Controls

| ID | Component | Control | Classification | Current Status | Proposed Command | Payload | Owner |
|---|---|---|---|---|---|---|---|
| LP-01 | PlayModePanel | onMarkDoubtful | active | unwired | `markDoubtful` | `{}` | container -> runtimeStore.upsertPendingMoveEvaluation |
| LP-02 | PlayModePanel | onEnterAnalysis | active | unwired | `enterAnalysisFromPlay` | `{}` | container -> workbenchFlowService.transition |
| LP-03 | PlayModePanel | onOpponentChange (OpponentControl) | active | unwired | `setOpponentType` | `{value: 'self'\|'ai'}` | container -> workbenchStore.updateTab({playerConfig}) |
| LP-04 | PlayModePanel | onBlackPlayerChange | deferred | prop exists, not provided | -- | -- | deferred: per-side player selection |
| LP-05 | PlayModePanel | onWhitePlayerChange | deferred | prop exists, not provided | -- | -- | deferred: per-side player selection |
| LP-06 | ProblemModePanel | submit-answer-btn | active | stub (`onClick: () => {}`) | `submitProblemAttempt` | `{}` | container -> controller.submitProblemAttempt() |
| LP-07 | ProblemModePanel | abandon-answer-btn | active | stub (`onClick: () => {}`) | `abandonProblemAttempt` | `{}` | container -> controller.exitProblemMode() |
| LP-08 | ProblemModePanel | request-hint-btn | active | unwired (onRequestHint passed via rest but container doesn't provide) | `requestProblemHint` | `{}` | container -> controller (method not exists) |
| LP-09 | ProblemModePanel | onOpponentChange | active | unwired | `setOpponentType` | `{value: 'self'\|'ai'}` | container -> workbenchStore.updateTab |
| LP-10 | RecallModePanel | onRecallToggle (ModeToggle) | active | unwired | `toggleRecallOriginalLine` | `{checked: boolean}` | container -> runtimeStore (new state field) |
| LP-11 | RecallModePanel | onMarkCheckpoint | active | unwired | `markRecallCheckpoint` | `{}` | container -> checkpointService.startCheckpoint |
| LP-12 | RecallModePanel | onVerify | active | unwired | `verifyRecallMove` | `{}` | container -> controller.handleRecallMove (board-click routing?) |
| LP-13 | RecallModePanel | onHint | active | unwired (panel level) | `showRecallHint` | `{}` | container -> controller.showRecallHint() |
| LP-14 | RecallModePanel | onEndRecall | active | unwired (panel level) | `endRecallSession` | `{}` | container -> controller.endRecallSession() |
| LP-15 | RecallModePanel | onSubmitCorrection | active | unwired | `submitCorrectionLine` | `{checkpointId: string, moves: string[]}` | container -> checkpointService.submitUserCorrectionLine |
| LP-16 | RecallModePanel | onRevealAI | active | unwired | `revealAiCandidates` | `{}` | container -> checkpointService.revealAiCandidateLines |
| LP-17 | RecallModePanel | onSkipCheckpoint | active | unwired | `skipCheckpoint` | `{checkpointId: string}` | container -> checkpointService.skipCheckpoint |
| LP-18 | RecallCheckpointPanel | onSelect | active | stub (inline `() => {}` in RecallModePanel, ignoring component's onSelect prop) | `selectCheckpoint` | `{checkpointId: string}` | container -> runtimeStore.setActiveCheckpoint |
| LP-19 | AnalysisModePanel | key point filter buttons (4 tags) | active | stub (`onClick: () => {}`) | `setKeyPointFilter` | `{filter: 'all'\|'bad'\|'checkpoint'\|'comment'}` | container -> runtimeStore.setVisibleBadMoveIds |
| LP-20 | AnalysisModePanel | onSnapshot | active | unwired | `takeSnapshot` | `{}` | container -> snapshotService |

### 1.4 Right Panel Controls

| ID | Component | Control | Classification | Current Status | Proposed Command | Payload | Owner |
|---|---|---|---|---|---|---|---|
| RP-01 | PlayRightPanel | drawer-toggle buttons (3x) | deferred | no onClick | -- | -- | deferred: drawer expand/collapse is UI-only |
| RP-02 | ProblemRightPanel | no active controls | -- | -- | -- | -- | -- |
| RP-03 | RecallRightPanel | no active controls | -- | -- | -- | -- | -- |
| RP-04 | AnalysisRightPanel | onExpandAI | deferred | no handler (ExpandableTitle checks for onExpand prop) | -- | -- | deferred: drawer expand is UI-only |
| RP-05 | AnalysisRightPanel | onExpandVariation | deferred | same as RP-04 | -- | -- | deferred: same as RP-04 |
| RP-06 | AnalysisRightPanel | onExpandSnapshot | deferred | same as RP-04 | -- | -- | deferred: same as RP-04 |
| RP-07 | AnalysisRightPanel | add-snapshot-btn | active | no onClick handler | `takeSnapshot` | `{}` | container -> snapshotService |

## 2. Command Surface

Deduplicated semantic commands. Each command has one owner and one target.

| Command | Source Controls | Target | Payload | Side Effects |
|---|---|---|---|---|
| `switchWorkbenchMode` | S-06 | workbenchStore.updateTab(tabId, {mode}) + sabaki.setMode(mode) | `{mode}` | switches sabaki mode, updates active tab mode |
| `startNewGame` | S-08 | controller (new method) | `{}` | creates task + attempt, opens tab |
| `endPlaySession` | S-10, B-04 | controller.stopEngineGameTraining() | `{}` | freezes attempt, stops monitor |
| `resignGame` | S-11, B-03 | controller (new method) | `{}` | ends game, saves result |
| `submitProblemAttempt` | S-12, B-10, LP-06 | controller.submitProblemAttempt() | `{}` | evaluates answer, updates problemView.submitted/result, possible review dispatch |
| `abandonProblemAttempt` | S-13, B-11, LP-07 | controller.exitProblemMode() | `{}` | clears problemView, sets mode to play |
| `enterAnalysisFromProblem` | S-15 | workbenchFlowService.transition(tabId, 'enterAnalysis') | `{}` | updates tab mode to analysis |
| `enterAnalysisFromRecall` | S-16, B-15 | workbenchFlowService.transition(tabId, 'enterAnalysis') | `{}` | updates tab mode to analysis |
| `endRecallSession` | S-17, LP-14 | controller.endRecallSession() | `{}` | saves session/attempts to DB, clears recallView, sets mode |
| `takeSnapshot` | S-18, S-19, B-20, LP-20, RP-07 | snapshotService.captureSnapshotInput + createProblemFromCurrentAnalysisPosition | `{tabId, sourceTaskId}` | reads board state, creates new problem, optionally opens new tab |
| `returnFromAnalysis` | S-21 | workbenchFlowService.transition(tabId, 'returnFromAnalysis') | `{}` | restores previous mode |
| `switchGameTab` | S-22 | workbenchTabService.switchTab(tabId) | `{tabId}` (derived from index) | updates workbenchStore.activeTabId |
| `closeGameTab` | S-23 | workbenchTabService.closeTab(tabId) | `{tabId}` (derived from index) | removes tab, unlinks parent/child, cleans up children |
| `addGameTab` | S-24 | workbenchTabService.openGameTab(gameId) | `{gameId}` | creates task + tab, adds to store |
| `undoMove` | B-01, B-16 | sabaki existing undo | `{}` | navigates game tree |
| `passMove` | B-02 | sabaki existing pass | `{}` | adds pass node in game tree |
| `redoProblemMove` | B-07 | controller (new method) | `{}` | redoes last problem move |
| `passInProblem` | B-08 | controller (new method) | `{}` | adds pass move in problem |
| `requestProblemHint` | B-09, LP-08 | controller (new method) | `{}` | shows directional hint, updates problemView |
| `markRecallCheckpoint` | B-12, LP-11 | checkpointService.startCheckpoint | `{recallSessionId, badMoveId}` | creates checkpoint, updates runtimeStore |
| `verifySkipRecall` | B-14 | controller.skipRecallMove() | `{}` | skips move, navigates game tree |
| `undoProblemMove` | B-06 | controller.undoProblemMove() | `{}` | undoes move, updates problemView.evalCache |
| `clearAnalysis` | B-18 | controller (new method) | `{}` | clears analysis state |
| `editPosition` | B-19 | sabaki.setMode('edit') | `{}` | switches sabaki mode |
| `setAnnotationTool` | B-26 | runtimeStore (new field activeAnnotationTool) or local container state | `{toolId}` | no domain side effects |
| `markDoubtful` | B-05, LP-01 | runtimeStore.upsertPendingMoveEvaluation | `{evaluation}` | updates runtimeStore |
| `setOpponentType` | LP-03, LP-09 | workbenchStore.updateTab(tabId, {playerConfig: ...}) | `{value}` | updates tab config |
| `toggleRecallOriginalLine` | LP-10 | runtimeStore (new field recallOriginalLine) | `{checked}` | toggles recall sub-mode |
| `verifyRecallMove` | LP-12 | controller.handleRecallMove(vertex) (needs board coordinates) | `{vertex}` | validates recall move |
| `showRecallHint` | LP-13, B-13 | controller.showRecallHint() | `{}` | sets recallView.showHint = true |
| `submitCorrectionLine` | LP-15 | checkpointService.submitUserCorrectionLine | `{checkpointId, moves}` | saves correction, updates runtimeStore |
| `revealAiCandidates` | LP-16 | checkpointService.revealAiCandidateLines | `{checkpointId}` | loads AI lines, updates runtimeStore |
| `skipCheckpoint` | LP-17 | checkpointService.skipCheckpoint | `{checkpointId}` | marks skipped, resumes recall |
| `selectCheckpoint` | LP-18 | runtimeStore.setActiveCheckpoint(checkpointId) | `{checkpointId}` | updates active checkpoint |
| `setKeyPointFilter` | LP-19 | runtimeStore.setVisibleBadMoveIds + filter state | `{filter}` | filters visible key points |

## 3. Gap Analysis

Prioritized stubs and unwired controls.

### P0 — Core training flow broken (user cannot complete primary workflow)

| Gap ID | Controls | Issue | Recommendation |
|---|---|---|---|
| G-01 | LP-06 submit-answer-btn (ProblemModePanel) | stub: `onClick: () => {}`. onSubmitProblemAttempt exists in container but routes via BottomActionBar, not panel. | Wire button onClick to onSubmitAnswer prop (or reuse container handler). |
| G-02 | LP-07 abandon-answer-btn (ProblemModePanel) | stub: `onClick: () => {}`. onExitProblemMode exists in container. | Wire to onAbandonAnswer prop. |
| G-03 | S-06 ModeBar segmented control | unwired. Cannot switch modes. | Provide onModeChange handler calling switchWorkbenchMode. |
| G-04 | S-12/S-13 ModeActions (problem) onSubmit/onAbandon | unwired. Top-bar submit/abandon buttons do nothing. | Provide handlers mapped to existing controller methods. |

### P1 — Secondary workflow gaps (workflow incomplete but not broken)

| Gap ID | Controls | Issue | Recommendation |
|---|---|---|---|
| G-05 | LP-10 onRecallToggle | unwired. Cannot switch between original-line recall and checkpoint queue. | Add runtimeStore field + handler. |
| G-06 | LP-18 RecallCheckpointPanel onSelect | stub: inline `() => {}`. | Pass in onSelectCheckpoint prop. |
| G-07 | LP-19 analysis key point filters | stub: `onClick: () => {}`. | Wire to setKeyPointFilter command. |
| G-08 | LP-11 onMarkCheckpoint (recall) | unwired. | Add handler calling checkpointService.startCheckpoint. |
| G-09 | LP-15 onSubmitCorrection | unwired. | Add handler calling checkpointService.submitUserCorrectionLine. |
| G-10 | LP-16 onRevealAI | unwired. | Add handler calling checkpointService.revealAiCandidateLines. |
| G-11 | LP-17 onSkipCheckpoint | unwired. | Add handler calling checkpointService.skipCheckpoint. |
| G-12 | LP-01/B-05 onMarkDoubtful | unwired. | Add handler calling runtimeStore.upsertPendingMoveEvaluation. |
| G-13 | S-18/B-20/LP-20/RP-07 takeSnapshot | 4 UI entry points, all unwired. Target service (snapshotService) exists. | Add handler calling snapshotService.captureSnapshotInput. |
| G-14 | S-21 onReturn (analysis) | unwired. | Add handler calling workbenchFlowService.transition(tabId, 'returnFromAnalysis'). |

### P2 — Controller method missing (new controller methods needed)

| Gap ID | Controls | Missing Method | Recommendation |
|---|---|---|---|
| G-15 | B-07 onRedo (problem) | controller.redoProblemMove() | Implement symmetric to undoProblemMove. |
| G-16 | B-09/LP-08 requestProblemHint | controller.showProblemHint() | Needs problemFlowService integration. |
| G-17 | B-08 onPass (problem) | controller.passInProblem() | Handle pass in problem mode. |
| G-18 | S-08 startNewGame | controller.startNewGame() | Create task + attempt + tab. |
| G-19 | S-10/B-04 endPlaySession | controller.endPlaySession() | Freeze attempt, stop monitor. |

### P3 — Minor feature gaps

| Gap ID | Controls | Issue | Recommendation |
|---|---|---|---|
| G-20 | S-22/S-23/S-24 GameTabBar | unwired. Container does not provide games data or callbacks. | Add workbenchStore tab projection + handlers. |
| G-21 | B-18 onClear (analysis) | unwired. | Add simple controller method. |
| G-22 | B-19 onEditPosition | unwired. | Simple delegation to sabaki.setMode('edit'). |
| G-23 | B-26 annotation tool change | unwired. | Add local state or runtimeStore field in container. |
| G-24 | LP-03/LP-09 onOpponentChange | unwired. | Add handler calling workbenchStore.updateTab. |

## 4. Deferred Controls

| Control | Reason | Exit Condition |
|---|---|---|
| S-09, S-14, S-20 ModeActions onSettings | No settings dialog implementation. Settings are no-ops until UX spec'd. | Training settings UX spec defined and implemented. |
| S-25 TrainingTabBar | Not rendered (WorkbenchShell uses ModeBar's segmented control instead). Remove or repurpose. | Tab-based navigation UX spec replaces mode segmented. |
| LP-04 onBlackPlayerChange | Per-player config requires playerConfig refinement. Currently handled via single opponentType. | playerConfig type supports per-player selection. |
| LP-05 onWhitePlayerChange | Same as LP-04. | Same as LP-04. |
| B-21 onSelect | Select tool semantics undefined. | Select tool interaction contract defined. |
| B-22 onHandShape | Hand-shape tool semantics undefined. | Hand-shape tool interaction contract defined. |
| B-23/B-24 onZoomIn/onZoomOut | Zoom is pure UI state, not training domain. | Board zoom implementation needs workbench state. |
| B-25 onFullscreen | Window management, not training domain. | Electron window management integration. |
| RP-01 drawer-toggle buttons (PlayRightPanel) | Drawer expand/collapse is UI-only. | Drawer component and state defined. |
| RP-04/RP-05/RP-06 ExpandableTitle | Drawer expand/collapse is UI-only. | Drawer component and state defined. |
| MaterialLibraryDialog | Placeholder content. | Material library feature spec. |

## 5. Already-Wired Controls (Reference)

These are wired in TrainingWorkbenchContainer and working:

| Container Handler | Controller Method | Used by Controls |
|---|---|---|
| `onShowRecallHint` | controller.showRecallHint() | B-13 (BottomActionBar recall hint) |
| `onSkipRecallMove` | controller.skipRecallMove() | B-14 (BottomActionBar verify-skip) |
| `onEndRecallSession` | controller.endRecallSession() | S-17 (ModeActions), LP-14 |
| `onUndoProblemMove` | controller.undoProblemMove() | B-06 |
| `onSubmitProblemAttempt` | controller.submitProblemAttempt() | B-10 |
| `onExitProblemMode` | controller.exitProblemMode() | -- (no current UI entry point maps to this handler) |
| `onAdvanceReview` | controller.advanceReview() | -- (no current UI entry point maps to this handler) |

## 6. Name Mismatch Mapping

Critical wiring challenge: callback prop names used by panels/toolbars differ from container handler names.

| UI Callback Prop Name (component expects) | Container Handler Name | Needs Alias? |
|---|---|---|
| `onHint` (BottomActionBar recall) | `onShowRecallHint` | yes: add `onHint: handlers.onShowRecallHint` in container |
| `onVerifySkip` (BottomActionBar recall) | `onSkipRecallMove` | yes: add `onVerifySkip: handlers.onSkipRecallMove` in container |
| `onSubmitAnswer` (BottomActionBar problem) | `onSubmitProblemAttempt` | yes: add `onSubmitAnswer: handlers.onSubmitProblemAttempt` in container |
| `onAbandonAnswer` (BottomActionBar problem) | `onExitProblemMode` | yes: add `onAbandonAnswer: handlers.onExitProblemMode` in container |
| `onUndo` (BottomActionBar problem) | `onUndoProblemMove` | yes: add `onUndo: handlers.onUndoProblemMove` in container |
| `onRequestHint` (BottomActionBar problem) | (does not exist) | no: new controller method needed |
| `onMarkDoubtful` (BottomActionBar play + PlayModePanel) | (does not exist) | no: new handler needed |
| `onSubmit` (ModeActions problem) | `onSubmitProblemAttempt` | yes: add `onSubmit: handlers.onSubmitProblemAttempt` in container |
| `onAbandon` (ModeActions problem) | `onExitProblemMode` | yes: add `onAbandon: handlers.onExitProblemMode` in container |
| `onEnd` (ModeActions play/recall) | (partial: endRecallSession exists, endPlaySession does not) | mode-dependent routing |
| `onResign` (ModeActions play + BottomActionBar) | (does not exist) | no: new controller method needed |
| `onSnapshot` (ModeActions recall/analysis + BottomActionBar) | (does not exist) | no: new handler needed |
| `onAnalysis` (ModeActions problem/recall) | (does not exist) | no: workbenchFlowService.transition needed |
| `onReturn` (ModeActions analysis) | (does not exist) | no: workbenchFlowService.transition needed |
| `onNewGame` (ModeActions play) | (does not exist) | no: new controller method needed |

## 7. Projection Gaps

`projectFromRuntime` maps data from runtimeStore to UI props. Data below is needed but not yet projected.

| UI Prop Needed | Source | Currently Projected? |
|---|---|---|
| `mode` (WorkbenchShell) | workbenchStore active tab mode | no — container does not read workbenchStore |
| `taskTitle` | runtimeStore or repository | no |
| `statusChips` | derived | no |
| `engineName`, `engineConnected` | sabaki engine state | no |
| `games` (GameTabBar) | workbenchStore.tabs | no |
| `activeIndex` (GameTabBar) | workbenchStore.activeTabId | no |
| `blackCaptures`, `whiteCaptures`, `currentPlayer` | sabaki board state | no |
| `moveCount` (all modes) | sabaki game tree | no |
| `captures` (play, analysis) | sabaki board state | no |
| `opponentType` (play, problem) | workbenchStore tab playerConfig | no |
| `recallOriginalLine` (recall) | runtimeStore (new field) | no |
| `progress`, `currentMove`, `totalMoves`, `correctCount`, `wrongCount` (recall) | runtimeStore.recallView | partially projected (recallMoveIndex, recallExpectedMoves, recallUserAttempts), but prop names don't match |
| `checkpoints`, `activeCheckpointId` (recall) | runtimeStore or checkpointService | no |
| `hintMessage` (recall right) | runtimeStore.recallView.showHint + derived | no |
| `prompt`, `goal`, `passRuleSummary`, `referenceLines` (problem) | problemView.legacyProblemSession | no |
| `evaluation` (analysis) | engine analysis | no |
| `activeAnnotationTool` | runtimeStore (new field) | no |
| `workspaceLabel` (BottomActionBar) | derived from mode | no (but component has default) |
| `moveNumber` (BottomActionBar) | sabaki game tree | no |
| `engineStatus` (BottomActionBar) | sabaki engine state | no |
| `recallProgress`/`recallTotal`/`recallWaiting` (BottomActionBar) | runtimeStore.recallView | no |

Container only subscribes to runtimeStore and workbenchStore, but many projections require sabaki state (board, game tree, engine). This either needs (a) additional container subscription to sabaki state, or (b) mirroring from sabaki state into runtimeStore. Architectural decision deferred to W1.

## 8. Summary Statistics

| Category | Count |
|---|---|
| Total controls (incl. display-only) | 87 |
| Active (needs wiring) | 47 |
| Already wired | 7 |
| Stubs (no-op onClick) | 6 |
| Unwired (no callback provided) | 34 |
| Display-only | 31 |
| Deferred | 14 |
| Unique semantic commands | 34 |
| New controller methods needed | 7 |
| Name mismatches (UI prop vs container handler) | 10 |
| Projection gaps (need sabaki state) | ~20 |

## 9. Wiring Priority Recommendation

Wiring for W1 should follow this order to maximize workflow coverage:

1. **Name alignment** — resolve 10 name mismatches so existing container handlers reach the correct UI controls.
2. **Mode switching** — wire S-06 switchWorkbenchMode. Required for navigation.
3. **Problem submit/abandon** — wire LP-06, LP-07, S-12, S-13. These are stubs blocking problem completion.
4. **Problem undo/redo/hint** — wire B-06 (partially done), B-07, B-09.
5. **Recall panel actions** — wire LP-10 through LP-18. Recall workflow is largely unwired beyond hint/skip/end.
6. **Snapshot** — wire all 5 snapshot entry points to snapshotService.
7. **Analysis mode** — wire key point filter, annotation tool, return button.
8. **Game tab bar** — wire tab select/close/add.
9. **Play actions** — wire new game, end, resign, pass.
