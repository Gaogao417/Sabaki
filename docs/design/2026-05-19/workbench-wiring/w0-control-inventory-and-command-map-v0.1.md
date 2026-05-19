# W0 Control Inventory and Command Map

Date: 2026-05-19
Status: blocked — do not implement from this document until rewritten from PRD v0.5 + Architecture v0.5

> This document is a derived inventory, not a source of truth.
> It currently contains candidate commands and ownership assignments that may conflict with
> `docs/design/gabaki-sabaki-training-prd-v0.5.md` and
> `docs/design/gabaki-sabaki-training-architecture-v0.5.md`.
> Before writing tests or production code, rewrite this inventory with explicit v0.5 citations
> for every command owner, store write, service responsibility, and tab/snapshot flow.
> If any row conflicts with v0.5, the row is wrong.

## 0. Architecture Compliance (v0.5 Constraints)

Upper constraints from PRD v0.5 + Architecture v0.5. Every command in this document must satisfy:

1. **Write path**: UI → Container → Service → Store/Repository/Adapter. No UI writes Store directly.
   - workbenchStore writers: workbenchTabService, workbenchFlowService only (arch v0.5:448).
   - runtimeStore writes happen inside services, not from container.
2. **Unified Tab API**: All tab creation goes through `workbenchTabService.openTask({taskId, mode?, parentTabId?})`. No openGameTab/openProblemTab/openSnapshotProblemTab (arch v0.5:584).
3. **WorkbenchMode ≠ legacy Sabaki mode**: Training uses WorkbenchMode internally. Legacy Sabaki mode contact goes through legacySabakiAdapter only (PRD v0.5:1459).
4. **Snapshot is global**: Available in all 4 modes. Owner is `workbenchFlowService.snapshotFromCurrentContext`. snapshotService does not create tabs (arch v0.5:933, PRD v0.5:1076).
5. **Player config split**: Play uses `black`/`white` PlayerController. Problem uses `problemOpponent` constrained by `task.problemArea` (PRD v0.5:690, arch v0.5:698).

## 1. Control Inventory

### 1.1 Shell Controls

| ID | Component | Control | Classification | Current Status | Proposed Command | Payload | Owner |
|---|---|---|---|---|---|---|---|
| S-01 | GlobalHeader | taskTitle | display-only | display-only | -- | -- | -- |
| S-02 | GlobalHeader | mode chip | display-only | display-only | -- | -- | -- |
| S-03 | GlobalHeader | statusChips | display-only | display-only | -- | -- | -- |
| S-04 | GlobalHeader | engineName | display-only | display-only | -- | -- | -- |
| S-05 | GlobalHeader | engineConnected dot | display-only | display-only | -- | -- | -- |
| S-06 | ModeBar | segmented control (play/problem/recall/analysis) | active | unwired (onModeChange not provided by container) | `switchWorkbenchMode` | `{mode: 'play'\|'problem'\|'recall'\|'analysis'}` | container -> workbenchFlowService (mode transition) |
| S-07 | StoneStatus | captures + player indicator | display-only | display-only | -- | -- | -- |
| S-08 | ModeActions (play) | onNewGame | active | unwired | `startNewGame` | `{}` | container -> workbenchFlowService.startAttempt |
| S-09 | ModeActions (play) | onSettings | deferred | unwired | -- | -- | deferred: no settings dialog |
| S-10 | ModeActions (play) | onEnd | active | unwired | `endPlaySession` | `{}` | container -> workbenchFlowService (freeze attempt) |
| S-11 | ModeActions (play) | onResign | active | unwired | `resignGame` | `{}` | container -> workbenchFlowService (end game) |
| S-12 | ModeActions (problem) | onSubmit | active | unwired | `submitProblemAttempt` | `{}` | container -> workbenchFlowService.submit(tabId) |
| S-13 | ModeActions (problem) | onAbandon | active | unwired | `abandonProblemAttempt` | `{}` | container -> workbenchFlowService (abandon attempt) |
| S-14 | ModeActions (problem) | onSettings | deferred | unwired | -- | -- | deferred: no settings dialog |
| S-15 | ModeActions (problem) | onAnalysis | active | unwired | `enterAnalysis` | `{}` | container -> workbenchFlowService.enterAnalysis({tabId}) |
| S-16 | ModeActions (recall) | onAnalysis | active | unwired | `enterAnalysis` | `{}` | container -> workbenchFlowService.enterAnalysis({tabId}) |
| S-17 | ModeActions (recall) | onEnd | active | unwired | `endRecallSession` | `{}` | container -> workbenchFlowService.completeRecall({tabId}) |
| S-18 | ModeActions (recall) | onSnapshot | active | unwired | `snapshotFromCurrentContext` | `{}` | container -> workbenchFlowService.snapshotFromCurrentContext({tabId}) |
| S-19 | ModeActions (analysis) | onSnapshot | active | unwired | `snapshotFromCurrentContext` | `{}` | container -> workbenchFlowService.snapshotFromCurrentContext({tabId}) |
| S-20 | ModeActions (analysis) | onSettings | deferred | unwired | -- | -- | deferred: no settings dialog |
| S-21 | ModeActions (analysis) | onReturn | active | unwired | `returnFromAnalysis` | `{}` | container -> workbenchFlowService.returnFromAnalysis({tabId}) |
| S-22 | GameTabBar | onSelect | active | unwired (container does not provide `games`) | `switchGameTab` | `{tabId}` | container -> workbenchTabService.switchTab(tabId) |
| S-23 | GameTabBar | onClose | active | unwired | `closeGameTab` | `{tabId}` | container -> workbenchTabService.closeTab(tabId) |
| S-24 | GameTabBar | onAdd | active | unwired | `openTask` | `{mode: 'play'}` | container -> workbenchTabService.openTask({mode:'play'}) |
| S-25 | TrainingTabBar | onTabChange | deferred | not rendered | -- | -- | deferred: WorkbenchShell uses ModeBar; this component unused |

### 1.2 Bottom Action Bar Controls

| ID | Component | Control | Classification | Current Status | Proposed Command | Payload | Owner |
|---|---|---|---|---|---|---|---|
| B-01 | BottomActionBar (play) | onUndo | active | unwired | `undoMove` | `{}` | container -> legacySabakiAdapter (board navigation) |
| B-02 | BottomActionBar (play) | onPass | active | unwired | `passMove` | `{}` | container -> legacySabakiAdapter (board pass) |
| B-03 | BottomActionBar (play) | onResign | active | unwired | `resignGame` | `{}` | container -> workbenchFlowService (end game) |
| B-04 | BottomActionBar (play) | onEndAttempt | active | unwired | `endPlaySession` | `{}` | container -> workbenchFlowService (freeze attempt) |
| B-05 | BottomActionBar (play) | onMarkDoubtful | active | unwired | `markDoubtful` | `{}` | container -> playTrainingMonitor (mark evaluation) |
| B-06 | BottomActionBar (problem) | onUndo | active | wired to controller.undoProblemMove() | -- | -- | -- |
| B-07 | BottomActionBar (problem) | onRedo | active | unwired | `redoProblemMove` | `{}` | container -> workbenchFlowService (redo via service) |
| B-08 | BottomActionBar (problem) | onPass | active | unwired | `passInProblem` | `{}` | container -> workbenchFlowService (problem pass) |
| B-09 | BottomActionBar (problem) | onRequestHint | active | unwired | `requestProblemHint` | `{}` | container -> workbenchFlowService (problem hint) |
| B-10 | BottomActionBar (problem) | onSubmitAnswer | active | wired to controller.submitProblemAttempt() | -- | -- | -- |
| B-11 | BottomActionBar (problem) | onAbandonAnswer | active | unwired | `abandonProblemAttempt` | `{}` | container -> workbenchFlowService (abandon attempt) |
| B-12 | BottomActionBar (recall) | onMarkCheckpoint | active | unwired | `markRecallCheckpoint` | `{}` | container -> recallCheckpointService.createCheckpoint |
| B-13 | BottomActionBar (recall) | onHint | active | wired to controller.showRecallHint() | -- | -- | -- |
| B-14 | BottomActionBar (recall) | onVerifySkip | active | unwired | `verifySkipRecall` | `{}` | container -> recallService.skipRecallMove |
| B-15 | BottomActionBar (recall) | onEnterAnalysis | active | unwired | `enterAnalysis` | `{}` | container -> workbenchFlowService.enterAnalysis({tabId}) |
| B-16 | BottomActionBar (analysis) | onUndo | active | unwired | `undoMove` | `{}` | container -> legacySabakiAdapter (board navigation) |
| B-17 | BottomActionBar (analysis) | onRedo | active | unwired | `redoMove` | `{}` | container -> legacySabakiAdapter (board navigation) |
| B-18 | BottomActionBar (analysis) | onClear | active | unwired | `clearAnalysis` | `{}` | container -> workbenchFlowService (clear scratch) |
| B-19 | BottomActionBar (analysis) | onEditPosition | active | unwired | `editPosition` | `{}` | container -> legacySabakiAdapter (setMode via adapter) |
| B-20 | BottomActionBar (analysis) | onSnapshot | active | unwired | `snapshotFromCurrentContext` | `{}` | container -> workbenchFlowService.snapshotFromCurrentContext({tabId}) |
| B-21 | BottomActionBar (all) | onSelect | deferred | unwired | -- | -- | deferred: select tool semantics undefined |
| B-22 | BottomActionBar (all) | onHandShape | deferred | unwired | -- | -- | deferred: hand-shape tool semantics undefined |
| B-23 | BottomActionBar (all) | onZoomIn | deferred | unwired | -- | -- | deferred: zoom is UI-only state |
| B-24 | BottomActionBar (all) | onZoomOut | deferred | unwired | -- | -- | deferred: zoom is UI-only state |
| B-25 | BottomActionBar (all) | onFullscreen | deferred | unwired | -- | -- | deferred: fullscreen is window management |
| B-26 | BottomActionBar (analysis) | onAnnotationToolChange | active | unwired | `setAnnotationTool` | `{toolId: string}` | container -> local UI state (no domain store) |

### 1.3 Left Panel Controls

| ID | Component | Control | Classification | Current Status | Proposed Command | Payload | Owner |
|---|---|---|---|---|---|---|---|
| LP-01 | PlayModePanel | onMarkDoubtful | active | unwired | `markDoubtful` | `{}` | container -> playTrainingMonitor (mark evaluation) |
| LP-02 | PlayModePanel | onEnterAnalysis | active | unwired | `enterAnalysis` | `{}` | container -> workbenchFlowService.enterAnalysis({tabId}) |
| LP-03 | PlayModePanel | onOpponentChange (OpponentControl) | active | unwired | `updatePlayPlayerConfig` | `{side: 'black'\|'white', controller: 'human'\|'ai'}` | container -> workbenchFlowService.updatePlayerConfig |
| LP-04 | PlayModePanel | onBlackPlayerChange | deferred | prop exists, not provided | -- | -- | deferred: per-side player selection |
| LP-05 | PlayModePanel | onWhitePlayerChange | deferred | prop exists, not provided | -- | -- | deferred: per-side player selection |
| LP-06 | ProblemModePanel | submit-answer-btn | active | stub (`onClick: () => {}`) | `submitProblemAttempt` | `{}` | container -> workbenchFlowService.submit(tabId) |
| LP-07 | ProblemModePanel | abandon-answer-btn | active | stub (`onClick: () => {}`) | `abandonProblemAttempt` | `{}` | container -> workbenchFlowService (abandon attempt) |
| LP-08 | ProblemModePanel | request-hint-btn | active | unwired (onRequestHint passed via rest but container doesn't provide) | `requestProblemHint` | `{}` | container -> workbenchFlowService (problem hint) |
| LP-09 | ProblemModePanel | onOpponentChange | active | unwired | `updateProblemOpponent` | `{problemOpponent: 'self'\|'ai'}` | container -> workbenchFlowService.updatePlayerConfig (problemArea-gated) |
| LP-10 | RecallModePanel | onRecallToggle (ModeToggle) | active | unwired | `toggleRecallOriginalLine` | `{checked: boolean}` | container -> recallService.setRecallSubMode |
| LP-11 | RecallModePanel | onMarkCheckpoint | active | unwired | `markRecallCheckpoint` | `{}` | container -> recallCheckpointService.createCheckpoint |
| LP-12 | RecallModePanel | onVerify | active | unwired | `verifyRecallMove` | `{}` | container -> recallService.handleRecallMove (board-click routing) |
| LP-13 | RecallModePanel | onHint | active | unwired (panel level) | `showRecallHint` | `{}` | container -> recallService.showHint |
| LP-14 | RecallModePanel | onEndRecall | active | unwired (panel level) | `endRecallSession` | `{}` | container -> workbenchFlowService.completeRecall({tabId}) |
| LP-15 | RecallModePanel | onSubmitCorrection | active | unwired | `submitCorrectionLine` | `{checkpointId: string, moves: string[]}` | container -> recallCheckpointService.submitUserCorrectionLine |
| LP-16 | RecallModePanel | onRevealAI | active | unwired | `revealAiCandidates` | `{}` | container -> recallCheckpointService.revealAiCandidateLines |
| LP-17 | RecallModePanel | onSkipCheckpoint | active | unwired | `skipCheckpoint` | `{checkpointId: string}` | container -> recallCheckpointService.skipCheckpoint |
| LP-18 | RecallCheckpointPanel | onSelect | active | stub (inline `() => {}` in RecallModePanel, ignoring component's onSelect prop) | `selectCheckpoint` | `{checkpointId: string}` | container -> recallCheckpointService.selectCheckpoint |
| LP-19 | AnalysisModePanel | key point filter buttons (4 tags) | active | stub (`onClick: () => {}`) | `setKeyPointFilter` | `{filter: 'all'\|'bad'\|'checkpoint'\|'comment'}` | container -> local UI state (filter is view-only) |
| LP-20 | AnalysisModePanel | onSnapshot | active | unwired | `snapshotFromCurrentContext` | `{}` | container -> workbenchFlowService.snapshotFromCurrentContext({tabId}) |

### 1.4 Right Panel Controls

| ID | Component | Control | Classification | Current Status | Proposed Command | Payload | Owner |
|---|---|---|---|---|---|---|---|
| RP-01 | PlayRightPanel | drawer-toggle buttons (3x) | deferred | no onClick | -- | -- | deferred: drawer expand/collapse is UI-only |
| RP-02 | ProblemRightPanel | no active controls | -- | -- | -- | -- | -- |
| RP-03 | RecallRightPanel | no active controls | -- | -- | -- | -- | -- |
| RP-04 | AnalysisRightPanel | onExpandAI | deferred | no handler (ExpandableTitle checks for onExpand prop) | -- | -- | deferred: drawer expand is UI-only |
| RP-05 | AnalysisRightPanel | onExpandVariation | deferred | same as RP-04 | -- | -- | deferred: same as RP-04 |
| RP-06 | AnalysisRightPanel | onExpandSnapshot | deferred | same as RP-04 | -- | -- | deferred: same as RP-04 |
| RP-07 | AnalysisRightPanel | add-snapshot-btn | active | no onClick handler | `snapshotFromCurrentContext` | `{}` | container -> workbenchFlowService.snapshotFromCurrentContext({tabId}) |

## 2. Command Surface

Deduplicated semantic commands. Every command follows v0.5 write path: Container → Service → Store/Repository/Adapter.

### 2.1 workbenchFlowService Commands (mode transitions + lifecycle)

| Command | Source Controls | Service Method | Payload | Side Effects | v0.5 Ref |
|---|---|---|---|---|---|
| `switchWorkbenchMode` | S-06 | workbenchFlowService (mode transition) | `{tabId, mode}` | updates workbenchStore tab mode; legacy mode via adapter only | arch:643-668 |
| `startAttempt` | S-08 | workbenchFlowService.startAttempt(tabId) | `{tabId}` | creates task + attempt, opens tab via openTask | arch:598 |
| `endPlaySession` | S-10, B-04 | workbenchFlowService (freeze attempt) | `{tabId}` | freezes attempt via attemptService, stops monitor | arch:598 |
| `resignGame` | S-11, B-03 | workbenchFlowService (end game) | `{tabId}` | ends game, saves result | arch:598 |
| `submitProblemAttempt` | S-12, B-10, LP-06 | workbenchFlowService.submit(tabId) | `{tabId}` | freezes attempt, may enterRecall, updates problemView | arch:598, PRD:submit flow |
| `abandonProblemAttempt` | S-13, B-11, LP-07 | workbenchFlowService (abandon) | `{tabId}` | clears problem state, reverts mode | arch:598 |
| `enterAnalysis` | S-15, S-16, B-15, LP-02 | workbenchFlowService.enterAnalysis({tabId}) | `{tabId}` | updates tab mode to analysis | arch:643-668 |
| `completeRecall` | S-17, LP-14 | workbenchFlowService.completeRecall({tabId}) | `{tabId}` | saves session/attempts to DB, clears recallView, transitions mode | arch:598 |
| `snapshotFromCurrentContext` | S-18, S-19, B-20, LP-20, RP-07 | workbenchFlowService.snapshotFromCurrentContext({tabId}) | `{tabId, reason?}` | snapshotService.capture → taskImportService → openTask (new tab) | arch:1597-1608, PRD:1076 |
| `returnFromAnalysis` | S-21 | workbenchFlowService.returnFromAnalysis({tabId}) | `{tabId}` | restores previous mode from tab.previousMode | arch:643-668 |
| `updatePlayerConfig` | LP-03 | workbenchFlowService.updatePlayerConfig | `{tabId, black?, white?, ai?}` | updates tab playerConfig via workbenchStore (service writes store) | arch:598 |
| `updateProblemOpponent` | LP-09 | workbenchFlowService.updatePlayerConfig | `{tabId, problemOpponent}` | updates tab playerConfig; AI gated by task.problemArea | arch:598, PRD:690 |
| `clearAnalysis` | B-18 | workbenchFlowService (clear scratch) | `{tabId}` | clears analysis scratch state | arch:598 |

### 2.2 workbenchTabService Commands (tab lifecycle)

| Command | Source Controls | Service Method | Payload | Side Effects | v0.5 Ref |
|---|---|---|---|---|---|
| `openTask` | S-24 | workbenchTabService.openTask | `{mode?, parentTabId?}` | creates task + tab, adds to workbenchStore | arch:561-596 |
| `switchGameTab` | S-22 | workbenchTabService.switchTab(tabId) | `{tabId}` | updates workbenchStore.activeTabId | arch:561 |
| `closeGameTab` | S-23 | workbenchTabService.closeTab(tabId) | `{tabId}` | removes tab, unlinks parent/child | arch:561 |

### 2.3 recallService / recallCheckpointService Commands

| Command | Source Controls | Service Method | Payload | Side Effects | v0.5 Ref |
|---|---|---|---|---|---|
| `showRecallHint` | LP-13, B-13 | recallService.showHint | `{tabId}` | sets recallView.showHint via runtimeStore (service writes) | -- |
| `verifySkipRecall` | B-14 | recallService.skipRecallMove | `{tabId}` | skips move, navigates game tree via adapter | -- |
| `verifyRecallMove` | LP-12 | recallService.handleRecallMove | `{tabId, vertex}` | validates recall attempt, updates runtimeStore | -- |
| `toggleRecallOriginalLine` | LP-10 | recallService.setRecallSubMode | `{tabId, checked}` | toggles recall sub-mode in runtimeStore | -- |
| `markRecallCheckpoint` | B-12, LP-11 | recallCheckpointService.createCheckpoint | `{tabId, recallSessionId}` | creates checkpoint, updates runtimeStore | -- |
| `submitCorrectionLine` | LP-15 | recallCheckpointService.submitUserCorrectionLine | `{tabId, checkpointId, moves}` | saves correction, updates runtimeStore | -- |
| `revealAiCandidates` | LP-16 | recallCheckpointService.revealAiCandidateLines | `{tabId, checkpointId}` | loads AI lines, updates runtimeStore | -- |
| `skipCheckpoint` | LP-17 | recallCheckpointService.skipCheckpoint | `{tabId, checkpointId}` | marks skipped, resumes recall | -- |
| `selectCheckpoint` | LP-18 | recallCheckpointService.selectCheckpoint | `{tabId, checkpointId}` | updates active checkpoint via runtimeStore | -- |

### 2.4 problemFlowService Commands

| Command | Source Controls | Service Method | Payload | Side Effects | v0.5 Ref |
|---|---|---|---|---|---|
| `redoProblemMove` | B-07 | problemFlowService.redoMove | `{tabId}` | redoes last problem move, updates problemView | -- |
| `passInProblem` | B-08 | problemFlowService.passMove | `{tabId}` | adds pass in problem context | -- |
| `requestProblemHint` | B-09, LP-08 | problemFlowService.showHint | `{tabId}` | shows directional hint, updates problemView | -- |
| `undoProblemMove` | B-06 | problemFlowService.undoMove | `{tabId}` | undoes move, updates problemView.evalCache | -- |

### 2.5 legacySabakiAdapter Commands (board/legacy operations)

| Command | Source Controls | Adapter Method | Payload | Side Effects | v0.5 Ref |
|---|---|---|---|---|---|
| `undoMove` | B-01, B-16 | legacySabakiAdapter.undo | `{}` | navigates game tree | arch:264-284 |
| `passMove` | B-02 | legacySabakiAdapter.pass | `{}` | adds pass node | arch:264-284 |
| `editPosition` | B-19 | legacySabakiAdapter.setMode('edit') | `{}` | switches legacy mode via adapter | arch:264-284 |

### 2.6 playTrainingMonitor Commands

| Command | Source Controls | Service Method | Payload | Side Effects | v0.5 Ref |
|---|---|---|---|---|---|
| `markDoubtful` | B-05, LP-01 | playTrainingMonitor.markDoubtful | `{tabId, vertex?}` | creates evaluation record | -- |

### 2.7 Local UI State Commands (no domain store)

| Command | Source Controls | Target | Payload | Notes |
|---|---|---|---|---|
| `setAnnotationTool` | B-26 | container local state | `{toolId}` | annotation tool selection is UI-only |
| `setKeyPointFilter` | LP-19 | container local state | `{filter}` | key point filter is view-only |

## 3. Gap Analysis

Prioritized stubs and unwired controls.

### P0 — Core training flow broken (user cannot complete primary workflow)

| Gap ID | Controls | Issue | Recommendation |
|---|---|---|---|
| G-01 | LP-06 submit-answer-btn (ProblemModePanel) | stub: `onClick: () => {}`. onSubmitProblemAttempt exists in container but routes via BottomActionBar, not panel. | Wire button onClick to workbenchFlowService.submit(tabId). |
| G-02 | LP-07 abandon-answer-btn (ProblemModePanel) | stub: `onClick: () => {}`. onExitProblemMode exists in container. | Wire to workbenchFlowService (abandon attempt). |
| G-03 | S-06 ModeBar segmented control | unwired. Cannot switch modes. | Provide onModeChange handler calling workbenchFlowService mode transition. |
| G-04 | S-12/S-13 ModeActions (problem) onSubmit/onAbandon | unwired. Top-bar submit/abandon buttons do nothing. | Wire to workbenchFlowService.submit / abandon via container. |

### P1 — Secondary workflow gaps (workflow incomplete but not broken)

| Gap ID | Controls | Issue | Recommendation |
|---|---|---|---|
| G-05 | LP-10 onRecallToggle | unwired. Cannot switch between original-line recall and checkpoint queue. | Add handler calling recallService.setRecallSubMode. |
| G-06 | LP-18 RecallCheckpointPanel onSelect | stub: inline `() => {}`. | Pass in onSelectCheckpoint prop → recallCheckpointService.selectCheckpoint. |
| G-07 | LP-19 analysis key point filters | stub: `onClick: () => {}`. | Wire to local UI state (view-only filter). |
| G-08 | LP-11 onMarkCheckpoint (recall) | unwired. | Add handler calling recallCheckpointService.createCheckpoint. |
| G-09 | LP-15 onSubmitCorrection | unwired. | Add handler calling recallCheckpointService.submitUserCorrectionLine. |
| G-10 | LP-16 onRevealAI | unwired. | Add handler calling recallCheckpointService.revealAiCandidateLines. |
| G-11 | LP-17 onSkipCheckpoint | unwired. | Add handler calling recallCheckpointService.skipCheckpoint. |
| G-12 | LP-01/B-05 onMarkDoubtful | unwired. | Add handler calling playTrainingMonitor.markDoubtful. |
| G-13 | S-18/S-19/B-20/LP-20/RP-07 snapshot | 5 UI entry points, all unwired. Snapshot is global command per PRD v0.5. | All wire to workbenchFlowService.snapshotFromCurrentContext({tabId}). |
| G-14 | S-21 onReturn (analysis) | unwired. | Add handler calling workbenchFlowService.returnFromAnalysis({tabId}). |

### P2 — Controller method missing (new controller methods needed)

| Gap ID | Controls | Missing Method | Recommendation |
|---|---|---|---|
| G-15 | B-07 onRedo (problem) | problemFlowService.redoMove() | Implement symmetric to undoProblemMove. |
| G-16 | B-09/LP-08 requestProblemHint | problemFlowService.showHint() | Needs problemFlowService integration. |
| G-17 | B-08 onPass (problem) | problemFlowService.passMove() | Handle pass in problem mode. |
| G-18 | S-08 startNewGame | workbenchFlowService.startAttempt(tabId) | Create task + attempt + tab via openTask. |
| G-19 | S-10/B-04 endPlaySession | workbenchFlowService (freeze attempt) | Freeze attempt, stop monitor. |

### P3 — Minor feature gaps

| Gap ID | Controls | Issue | Recommendation |
|---|---|---|---|
| G-20 | S-22/S-23/S-24 GameTabBar | unwired. Container does not provide games data or callbacks. | Add workbenchStore tab projection + handlers to workbenchTabService. |
| G-21 | B-18 onClear (analysis) | unwired. | Add handler to workbenchFlowService (clear scratch). |
| G-22 | B-19 onEditPosition | unwired. | Delegate to legacySabakiAdapter.setMode('edit'). |
| G-23 | B-26 annotation tool change | unwired. | Add local container state (UI-only, no domain store). |
| G-24 | LP-03 onOpponentChange (play) | unwired. | Wire to workbenchFlowService.updatePlayerConfig (black/white). |
| G-25 | LP-09 onOpponentChange (problem) | unwired. | Wire to workbenchFlowService.updatePlayerConfig (problemOpponent, problemArea-gated). |

## 4. Deferred Controls

| Control | Reason | Exit Condition |
|---|---|---|
| S-09, S-14, S-20 ModeActions onSettings | No settings dialog implementation. Settings are no-ops until UX spec'd. | Training settings UX spec defined and implemented. |
| S-25 TrainingTabBar | Not rendered (WorkbenchShell uses ModeBar's segmented control instead). Remove or repurpose. | Tab-based navigation UX spec replaces mode segmented. |
| LP-04 onBlackPlayerChange | Per-player config requires WorkbenchPlayerConfig.black/white (PRD v0.5:690). OpponentControl currently toggles single value. | OpponentControl supports per-side PlayerController. |
| LP-05 onWhitePlayerChange | Same as LP-04. | Same as LP-04. |
| B-21 onSelect | Select tool semantics undefined. | Select tool interaction contract defined. |
| B-22 onHandShape | Hand-shape tool semantics undefined. | Hand-shape tool interaction contract defined. |
| B-23/B-24 onZoomIn/onZoomOut | Zoom is pure UI state, not training domain. | Board zoom implementation needs workbench state. |
| B-25 onFullscreen | Window management, not training domain. | Electron window management integration. |
| RP-01 drawer-toggle buttons (PlayRightPanel) | Drawer expand/collapse is UI-only. | Drawer component and state defined. |
| RP-04/RP-05/RP-06 ExpandableTitle | Drawer expand/collapse is UI-only. | Drawer component and state defined. |
| MaterialLibraryDialog | Placeholder content. | Material library feature spec. |

## 5. Already-Wired Controls (Reference)

These are wired in TrainingWorkbenchContainer via legacyTrainingFlowController. **Note**: v0.5 requires migrating from legacyTrainingFlowController to workbenchFlowService. These wirings work today but need service-layer refactoring.

| Container Handler | Current Target (legacy) | v0.5 Target | Used by Controls |
| `onShowRecallHint` | controller.showRecallHint() | recallService.showHint | B-13 (BottomActionBar recall hint) |
| `onSkipRecallMove` | controller.skipRecallMove() | recallService.skipRecallMove | B-14 (BottomActionBar verify-skip) |
| `onEndRecallSession` | controller.endRecallSession() | workbenchFlowService.completeRecall | S-17 (ModeActions), LP-14 |
| `onUndoProblemMove` | controller.undoProblemMove() | problemFlowService.undoMove | B-06 |
| `onSubmitProblemAttempt` | controller.submitProblemAttempt() | workbenchFlowService.submit | B-10 |
| `onExitProblemMode` | controller.exitProblemMode() | workbenchFlowService (abandon) | -- (no current UI entry point maps to this handler) |
| `onAdvanceReview` | controller.advanceReview() | reviewService.advance | -- (no current UI entry point maps to this handler) |

## 6. Name Mismatch Mapping

Critical wiring challenge: callback prop names used by panels/toolbars differ from container handler names. All new wiring should route through the v0.5 service layer, not through legacy controller aliases.

| UI Callback Prop Name (component expects) | v0.5 Service Target | Needs Container Adapter? |
|---|---|---|
| `onHint` (BottomActionBar recall) | recallService.showHint | yes: container maps to service |
| `onVerifySkip` (BottomActionBar recall) | recallService.skipRecallMove | yes: container maps to service |
| `onSubmitAnswer` (BottomActionBar problem) | workbenchFlowService.submit(tabId) | yes: container maps to service |
| `onAbandonAnswer` (BottomActionBar problem) | workbenchFlowService (abandon) | yes: container maps to service |
| `onUndo` (BottomActionBar problem) | problemFlowService.undoMove | yes: container maps to service |
| `onRequestHint` (BottomActionBar problem) | problemFlowService.showHint | yes: container maps to service |
| `onMarkDoubtful` (BottomActionBar play + PlayModePanel) | playTrainingMonitor.markDoubtful | yes: container maps to service |
| `onSubmit` (ModeActions problem) | workbenchFlowService.submit(tabId) | yes: container maps to service |
| `onAbandon` (ModeActions problem) | workbenchFlowService (abandon) | yes: container maps to service |
| `onEnd` (ModeActions play/recall) | workbenchFlowService (freeze/completeRecall) | yes: mode-dependent routing |
| `onResign` (ModeActions play + BottomActionBar) | workbenchFlowService (end game) | yes: container maps to service |
| `onSnapshot` (all modes) | workbenchFlowService.snapshotFromCurrentContext | yes: global command, single service entry |
| `onAnalysis` (ModeActions problem/recall) | workbenchFlowService.enterAnalysis | yes: container maps to service |
| `onReturn` (ModeActions analysis) | workbenchFlowService.returnFromAnalysis | yes: container maps to service |
| `onNewGame` (ModeActions play) | workbenchFlowService.startAttempt | yes: container maps to service |
| `onModeChange` (ModeBar) | workbenchFlowService (mode transition) | yes: container maps to service |

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

Container only subscribes to runtimeStore and workbenchStore, but many projections require sabaki state (board, game tree, engine). Per v0.5 (arch:264-284), sabaki state access must go through legacySabakiAdapter. Options: (a) container reads adapter projections, (b) adapter mirrors relevant sabaki state into runtimeStore. Architectural decision deferred to W1.

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

1. **Service layer scaffolding** — instantiate workbenchFlowService, recallService, recallCheckpointService, problemFlowService with correct store wiring. All commands route through these, not legacy controller.
2. **Mode switching** — wire S-06 to workbenchFlowService mode transition. Required for navigation. Legacy mode via adapter only.
3. **Problem submit/abandon** — wire LP-06, LP-07, S-12, S-13 through workbenchFlowService.submit / abandon.
4. **Problem undo/redo/hint** — wire B-06, B-07, B-09 through problemFlowService.
5. **Recall panel actions** — wire LP-10 through LP-18 through recallService / recallCheckpointService.
6. **Snapshot** — wire all 5 snapshot entry points to workbenchFlowService.snapshotFromCurrentContext (global command per PRD v0.5).
7. **Analysis mode** — wire key point filter (local state), annotation tool (local state), return via workbenchFlowService.
8. **Game tab bar** — wire tab select/close/add through workbenchTabService (openTask only, no source-specific APIs).
9. **Play actions** — wire new game, end, resign, pass through workbenchFlowService and legacySabakiAdapter.
10. **Player config** — wire play black/white and problem problemOpponent through workbenchFlowService.updatePlayerConfig (problemArea-gated for problem).
