# W0 Control Inventory and Command Map

Date: 2026-05-19
Status: revised draft, aligned to PRD v0.5 and Architecture v0.5

## 0. Source of Truth

This document is subordinate to:

- `docs/design/gabaki-sabaki-training-prd-v0.5.md`
- `docs/design/gabaki-sabaki-training-architecture-v0.5.md`

If this document conflicts with either v0.5 document, v0.5 wins.

The W0 purpose is narrow:

1. Inventory every visible workbench control.
2. Classify controls as active, display-only, deferred, or implementation-only.
3. Map active controls to semantic commands.
4. Assign command owners using the v0.5 architecture:
   - UI components emit callbacks only.
   - Container/ViewModel reads state and dispatches commands.
   - Services own workflow and Store writes.
   - Repository owns persisted training facts.
   - Adapters isolate legacy Sabaki APIs.

W0 does not define new product behavior beyond v0.5.

## 1. Ownership Rules

### 1.1 State Owners

Workbench training state has only these training Stores:

| Store | Owns | Writes By | Reads By |
|---|---|---|---|
| `workbenchStore` | open tabs, active tab, `WorkbenchTab.mode`, player config, active attempt/recall ids, analysis context | `workbenchTabService`, `workbenchFlowService` | `TrainingWorkbenchContainer`, ViewModels |
| `trainingRuntimeStore` | current runtime affordances: pending move evaluations, active checkpoint, correction draft, visible bad moves, AI move pending | training services/controllers | `TrainingWorkbenchContainer`, ViewModels |
| `reviewQueueStore?` | optional review inbox UI queue | `reviewService` or review container | review UI |

Do not add task, attempt, bad move, recall, checkpoint, snapshot, or analysis Stores. These are persisted facts accessed through `trainingRepository` and services.

Existing non-training state sources still exist:

| Source | Owns |
|---|---|
| `documentStore` / legacy Sabaki core | game tree, current tree position, navigation, board mutation facts |
| `analysisService` | AI analysis cache and analysis update events |
| `overlayStore` | display-layer overlay toggles and info overlay state only |
| legacy `sabaki.state` | compatibility state during migration; not a training business source of truth |

### 1.2 Command Owner Rules

Active controls must route through one of these owners:

| Owner | Use For |
|---|---|
| `workbenchTabService` | open, close, switch tabs around `TrainingTask` |
| `workbenchFlowService` | submit, enter/return analysis, complete recall, restart attempt, snapshot, player config updates |
| `attemptService` through flow/controller | attempt creation, freeze, append/finalize |
| `aiMoveService` | AI-controlled move generation and execution |
| `recallService` | recall move submission, hints, skip/end/complete recall |
| `recallCheckpointService` | checkpoint creation, correction line, reveal AI candidates, comments, resume/skip checkpoint |
| `snapshotService` through `workbenchFlowService` | capture snapshot input only |
| `trainingRepository` through services | persisted training data |
| `legacySabakiAdapter` / board command adapter | legacy board commands, mode compatibility, undo/pass/edit-position during migration |
| `overlayStore` / overlay ViewModel | display overlay toggles only, not training business |
| board interaction resolver/executor | Goban click/drag semantics |

Forbidden in command mapping:

- UI component directly writes a training Store.
- Container directly mutates `workbenchStore` for a domain workflow.
- `snapshotService` opens tabs.
- Commands branch on `origin.provider` for core flow.
- Workbench command assumes `WorkbenchMode === sabaki.state.mode`.
- New source-specific open-tab commands. All material opens as `TrainingTask`.

## 2. Control Inventory

### 2.1 Shell Controls

| ID | Component | Control | Classification | Command | Payload | Owner |
|---|---|---|---|---|---|---|
| S-01 | `GlobalHeader` | task title | display-only | -- | -- | ViewModel projection |
| S-02 | `GlobalHeader` | mode chip | display-only | -- | -- | ViewModel projection from active `WorkbenchTab.mode` |
| S-03 | `GlobalHeader` | status chips | display-only | -- | -- | ViewModel projection |
| S-04 | `GlobalHeader` | engine name | display-only | -- | -- | engine ViewModel |
| S-05 | `GlobalHeader` | engine connected dot | display-only | -- | -- | engine ViewModel |
| S-06 | `ModeBar` | mode segmented control | active | `requestWorkbenchMode` | `{mode}` | `workbenchFlowService` or `workbenchUiPolicy` gate, adapter only if legacy mode sync is required |
| S-07 | `StoneStatus` | captures + player indicator | display-only | -- | -- | document/board ViewModel |
| S-08 | `ModeActions(play)` | new game | active | `createTrainingTaskAndOpen` | `{mode:'play'}` | `taskImportService` -> `workbenchTabService.openTask` -> `workbenchFlowService.startAttempt` |
| S-09 | `ModeActions(play/problem/analysis)` | settings | deferred | -- | -- | deferred: no v0.5 settings UX |
| S-10 | `ModeActions(play)` | submit/end play attempt | active | `submitAttempt` | `{tabId}` | `workbenchFlowService.submit` |
| S-11 | `ModeActions(play)` | resign | active | `resignAttempt` | `{tabId}` | mode controller -> `attemptService`/flow, exact result contract deferred |
| S-12 | `ModeActions(problem)` | submit answer | active | `submitAttempt` | `{tabId}` | `workbenchFlowService.submit` |
| S-13 | `ModeActions(problem)` | abandon answer | active | `abandonAttempt` | `{tabId}` | mode controller -> `attemptService`/flow |
| S-14 | `ModeActions(problem)` | enter analysis | active | `enterAnalysis` | `{tabId, context?}` | `workbenchFlowService.enterAnalysis` |
| S-15 | `ModeActions(recall)` | enter analysis | active | `enterAnalysis` | `{tabId, context?}` | `workbenchFlowService.enterAnalysis` |
| S-16 | `ModeActions(recall)` | end recall | active | `endRecall` | `{tabId, recallSessionId}` | `recallService` + `workbenchFlowService` |
| S-17 | `ModeActions(all)` | snapshot | active | `snapshotCurrentContext` | `{tabId, reason?}` | `workbenchFlowService.snapshotFromCurrentContext` |
| S-18 | `ModeActions(analysis)` | return | active | `returnFromAnalysis` | `{tabId, toMode?}` | `workbenchFlowService.returnFromAnalysis` |
| S-19 | `GameTabBar` | select tab | active | `switchTaskTab` | `{tabId}` | `workbenchTabService.switchTab` |
| S-20 | `GameTabBar` | close tab | active | `closeTaskTab` | `{tabId}` | `workbenchTabService.closeTab` |
| S-21 | `GameTabBar` | add/open task | active | `openTask` | `{taskId?, mode?}` | material browser/import flow -> `workbenchTabService.openTask` |
| S-22 | `TrainingTabBar` | tab change | deferred | -- | -- | deferred unless UX replaces `ModeBar` |

### 2.2 Bottom Action Bar Controls

| ID | Component | Control | Classification | Command | Payload | Owner |
|---|---|---|---|---|---|---|
| B-01 | `BottomActionBar(play/analysis)` | undo | active | `undoBoardCommand` | `{tabId}` | board command adapter / legacy adapter |
| B-02 | `BottomActionBar(play/problem)` | pass | active | `passMove` | `{tabId}` | mode controller -> attempt/board command adapter |
| B-03 | `BottomActionBar(play)` | resign | active | `resignAttempt` | `{tabId}` | mode controller -> flow/attempt service |
| B-04 | `BottomActionBar(play/problem)` | submit/end attempt | active | `submitAttempt` | `{tabId}` | `workbenchFlowService.submit` |
| B-05 | `BottomActionBar(play)` | mark doubtful | active | `markCurrentMoveDoubtful` | `{tabId, moveRef}` | mode controller -> `attemptService`/runtime update |
| B-06 | `BottomActionBar(problem)` | redo | active | `redoBoardCommand` | `{tabId}` | board command adapter / problem controller |
| B-07 | `BottomActionBar(problem)` | request hint | active | `requestProblemHint` | `{tabId}` | problem mode controller, using `TrainingTask` fields |
| B-08 | `BottomActionBar(problem)` | abandon | active | `abandonAttempt` | `{tabId}` | mode controller -> flow/attempt service |
| B-09 | `BottomActionBar(recall)` | mark checkpoint | active | `startRecallCheckpoint` | `{tabId, recallSessionId, badMoveId?}` | `recallCheckpointService.startCheckpoint` |
| B-10 | `BottomActionBar(recall)` | hint | active | `showRecallHint` | `{tabId, recallSessionId}` | `recallService` |
| B-11 | `BottomActionBar(recall)` | verify/skip | active | `skipRecallMove` | `{tabId, recallSessionId}` | `recallService` |
| B-12 | `BottomActionBar(recall)` | enter analysis | active | `enterAnalysis` | `{tabId, context?}` | `workbenchFlowService.enterAnalysis` |
| B-13 | `BottomActionBar(analysis)` | redo | active | `redoBoardCommand` | `{tabId}` | board command adapter / legacy adapter |
| B-14 | `BottomActionBar(analysis)` | clear exploration | active | `clearAnalysisExploration` | `{tabId}` | analysis mode controller, not Attempt mutation |
| B-15 | `BottomActionBar(analysis)` | edit position | active | `setBoardInteractionTool` or `enterEditPosition` | `{tabId, tool?}` | board interaction policy + adapter |
| B-16 | `BottomActionBar(all)` | snapshot | active | `snapshotCurrentContext` | `{tabId, reason?}` | `workbenchFlowService.snapshotFromCurrentContext` |
| B-17 | `BottomActionBar(all)` | select/hand shape | deferred | -- | -- | deferred until board tool contract is defined |
| B-18 | `BottomActionBar(all)` | zoom in/out | implementation-only | -- | -- | local board UI state, not training domain |
| B-19 | `BottomActionBar(all)` | fullscreen | implementation-only | -- | -- | Electron/window UI |
| B-20 | `BottomActionBar(analysis)` | annotation tool change | active | `setBoardInteractionTool` | `{toolId}` | board interaction policy / local board UI state |

### 2.3 Left Panel Controls

| ID | Component | Control | Classification | Command | Payload | Owner |
|---|---|---|---|---|---|---|
| LP-01 | `PlayModePanel` | mark doubtful | active | `markCurrentMoveDoubtful` | `{tabId, moveRef}` | mode controller -> attempt/runtime |
| LP-02 | `PlayModePanel` | enter analysis | active | `enterAnalysis` | `{tabId, context?}` | `workbenchFlowService.enterAnalysis` |
| LP-03 | `PlayModePanel` | black/white player control | active | `updatePlayerConfig` | `{tabId, patch:{black?, white?, ai?}}` | `workbenchFlowService.updatePlayerConfig` |
| LP-04 | `ProblemModePanel` | submit answer | active | `submitAttempt` | `{tabId}` | `workbenchFlowService.submit` |
| LP-05 | `ProblemModePanel` | abandon answer | active | `abandonAttempt` | `{tabId}` | problem mode controller -> flow/attempt |
| LP-06 | `ProblemModePanel` | request hint | active | `requestProblemHint` | `{tabId}` | problem mode controller |
| LP-07 | `ProblemModePanel` | opponent self/AI | active | `updatePlayerConfig` | `{tabId, patch:{problemOpponent}}` | `workbenchFlowService.updatePlayerConfig`; must gate AI on `TrainingTask.problemArea` |
| LP-08 | `RecallModePanel` | original line/checkpoint toggle | active | `setRecallPanelMode` | `{tabId, panelMode}` | recall controller -> `trainingRuntimeStore` |
| LP-09 | `RecallModePanel` | mark checkpoint | active | `startRecallCheckpoint` | `{tabId, recallSessionId, badMoveId?}` | `recallCheckpointService.startCheckpoint` |
| LP-10 | `RecallModePanel` | verify recall move | active | `submitRecallMove` | `{tabId, recallSessionId, vertexOrMove}` | board interaction resolver -> `recallService.submitRecallMove` |
| LP-11 | `RecallModePanel` | hint | active | `showRecallHint` | `{tabId, recallSessionId}` | `recallService` |
| LP-12 | `RecallModePanel` | end recall | active | `endRecall` | `{tabId, recallSessionId}` | `recallService` + `workbenchFlowService` |
| LP-13 | `RecallModePanel` | submit correction line | active | `submitCorrectionLine` | `{checkpointId, moves}` | `recallCheckpointService.submitUserCorrectionLine` |
| LP-14 | `RecallModePanel` | reveal AI candidates | active | `revealAiCandidates` | `{checkpointId}` | `recallCheckpointService.revealAiCandidateLines` |
| LP-15 | `RecallModePanel` | skip checkpoint | active | `skipCheckpoint` | `{checkpointId}` | `recallCheckpointService.skipCheckpoint` |
| LP-16 | `RecallCheckpointPanel` | select checkpoint | active | `selectCheckpoint` | `{checkpointId}` | recall controller -> `trainingRuntimeStore.setActiveCheckpoint` |
| LP-17 | `AnalysisModePanel` | key point filter | active | `setKeyPointFilter` | `{filter}` | analysis ViewModel/controller -> runtime visible ids |
| LP-18 | `AnalysisModePanel` | snapshot | active | `snapshotCurrentContext` | `{tabId, reason?}` | `workbenchFlowService.snapshotFromCurrentContext` |

### 2.4 Right Panel Controls

| ID | Component | Control | Classification | Command | Payload | Owner |
|---|---|---|---|---|---|---|
| RP-01 | `PlayRightPanel` | drawer expand/collapse | implementation-only | -- | -- | local UI state |
| RP-02 | `ProblemRightPanel` | display-only state | display-only | -- | -- | ViewModel projection |
| RP-03 | `RecallRightPanel` | display-only state | display-only | -- | -- | ViewModel projection |
| RP-04 | `AnalysisRightPanel` | expand AI/variation/snapshot sections | implementation-only | -- | -- | local UI state |
| RP-05 | `AnalysisRightPanel` | add snapshot | active | `snapshotCurrentContext` | `{tabId, reason?}` | `workbenchFlowService.snapshotFromCurrentContext` |

## 3. Deduplicated Command Surface

| Command | Source Controls | Owner | v0.5 Contract |
|---|---|---|---|
| `openTask` | S-21 | `workbenchTabService.openTask` | Opens a standard `TrainingTask`; default mode inferred from task fields unless explicit. |
| `createTrainingTaskAndOpen` | S-08 | `taskImportService` -> `workbenchTabService.openTask` | Creates/imports a `TrainingTask`, then opens it. |
| `switchTaskTab` | S-19 | `workbenchTabService.switchTab` | Changes active tab only. |
| `closeTaskTab` | S-20 | `workbenchTabService.closeTab` | Closes UI tab; Task persists. |
| `requestWorkbenchMode` | S-06 | `workbenchFlowService` / `workbenchUiPolicy` | Mode changes must validate v0.5 transitions and legacy compatibility. |
| `updatePlayerConfig` | LP-03, LP-07 | `workbenchFlowService.updatePlayerConfig` | Play uses black/white; Problem uses `problemOpponent`; AI in Problem requires `problemArea`. |
| `submitAttempt` | S-10, S-12, B-04, LP-04 | `workbenchFlowService.submit` | Freeze Attempt, evaluate, create RecallSession, set tab mode to recall. |
| `abandonAttempt` | S-13, B-08, LP-05 | mode controller -> flow/attempt | Stops current attempt without pretending it succeeded. Exact persistence contract W1/W2. |
| `resignAttempt` | S-11, B-03 | mode controller -> flow/attempt | Records resign/end result. Exact result schema W1/W2. |
| `enterAnalysis` | S-14, S-15, B-12, LP-02 | `workbenchFlowService.enterAnalysis` | Sets analysis context; does not mutate `Attempt.userLine`. |
| `returnFromAnalysis` | S-18 | `workbenchFlowService.returnFromAnalysis` | Returns to previous workbench mode. |
| `endRecall` | S-16, LP-12 | `recallService` + `workbenchFlowService` | Completes or exits recall according to recall state. |
| `showRecallHint` | B-10, LP-11 | `recallService` | Runtime hint only. |
| `skipRecallMove` | B-11 | `recallService` | Records/advances recall skip semantics. |
| `submitRecallMove` | LP-10, Goban click | board resolver -> `recallService.submitRecallMove` | Recall move validation must come from recall service, not UI. |
| `startRecallCheckpoint` | B-09, LP-09 | `recallCheckpointService.startCheckpoint` | Starts active correction checkpoint. |
| `submitCorrectionLine` | LP-13 | `recallCheckpointService.submitUserCorrectionLine` | Saves correction line for checkpoint. |
| `revealAiCandidates` | LP-14 | `recallCheckpointService.revealAiCandidateLines` | AI candidates are shown after user requests. |
| `skipCheckpoint` | LP-15 | `recallCheckpointService.skipCheckpoint` | Marks checkpoint skipped/resumed. |
| `selectCheckpoint` | LP-16 | recall controller -> runtime store | UI selection only. |
| `requestProblemHint` | B-07, LP-06 | problem mode controller | Uses `TrainingTask` problem fields; no separate Problem source model. |
| `passMove` | B-02 | mode controller + board adapter | Appends a pass in the correct mode/attempt context. |
| `undoBoardCommand` | B-01 | board command adapter | Board/history command; training side effects must be explicit. |
| `redoBoardCommand` | B-06, B-13 | board command adapter | Board/history command; training side effects must be explicit. |
| `markCurrentMoveDoubtful` | B-05, LP-01 | mode controller -> attempt/runtime | Creates or updates a pending move evaluation/bad-move candidate through service/controller. |
| `setKeyPointFilter` | LP-17 | analysis ViewModel/controller | Filters visible key points; no DB fact mutation. |
| `setBoardInteractionTool` | B-15, B-20 | board interaction policy | Updates board tool/interaction state. |
| `clearAnalysisExploration` | B-14 | analysis mode controller | Clears scratch/exploration state only. |
| `snapshotCurrentContext` | S-17, B-16, LP-18, RP-05, shortcuts/menu | `workbenchFlowService.snapshotFromCurrentContext` | Global command in every WorkbenchMode; creates ordinary `TrainingTask` with `origin.provider='snapshot'`, then opens via `openTask`. |

## 4. Projection Gaps for W1

W1 must define ViewModels before broad wiring. Required projections:

| Projection | Source |
|---|---|
| active `mode` | `workbenchStore.activeTab.mode` |
| active task title/prompt/goal/passRule/referenceLines/problemArea | `trainingRepository.loadTask(activeTab.taskId)` |
| tab list and active tab | `workbenchStore.tabs` |
| active attempt/recall/checkpoint ids | `workbenchStore` + `trainingRuntimeStore` |
| move number/captures/current player | document/board state via adapter |
| problem opponent and play player config | `activeTab.playerConfig` |
| Problem AI enabled/disabled status | `TrainingTask.problemArea` + `playerConfig.problemOpponent` |
| recall progress/checkpoint panel state | `recallService`/repository + runtime state |
| bad move list/key point filter | repository + runtime visible ids |
| analysis context and candidate panels | `activeTab.analysisContext`, analysis adapter, repository |
| snapshot availability | active tab + current board context |
| overlay props | `TrainingOverlayViewModel` -> overlay rendering layer |

## 5. Current Implementation Notes

The current code has several migration-era mismatches W1 must fix:

- Container handler names do not match UI callback prop names in several shell/panel components.
- Some panel buttons are no-op stubs.
- `WorkbenchShell` currently receives many legacy Sabaki props and does not yet fully project from active `WorkbenchTab`.
- Some services still expose compatibility methods that v0.5 wants replaced by `openTask` and `workbenchFlowService`.
- Legacy `sabaki.state.mode` still drives rendering in places; W1 must define the compatibility bridge instead of treating it as the training source of truth.

These notes describe implementation debt only. They do not override v0.5 ownership.

## 6. W1 Priority

1. Define state ownership and compatibility boundaries.
2. Build `TrainingWorkbenchContainer` projections from `workbenchStore`, `trainingRuntimeStore`, repository, board/document state, engine/analysis state, and overlay ViewModel.
3. Add callback alias layer so existing UI controls call semantic commands.
4. Wire `submitAttempt`, `enterAnalysis`, `returnFromAnalysis`, `snapshotCurrentContext`, tab switching, and player config through v0.5 owners.
5. Define Goban interaction policy for Play / Problem / Recall / Analysis before wiring board-click commands.
6. Keep overlay display state separate from training business state.
