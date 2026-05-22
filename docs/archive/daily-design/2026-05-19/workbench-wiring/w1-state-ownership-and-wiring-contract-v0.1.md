# W1 State Ownership and Wiring Contract

Date: 2026-05-19
Status: draft

## 0. Source of Truth

This W1 contract is subordinate to:

- `docs/design/gabaki-sabaki-training-prd-v0.5.md`
- `docs/design/gabaki-sabaki-training-architecture-v0.5.md`

`w0-control-inventory-and-command-map-v0.1.md` is referenced for command naming and inventory continuity only. Behavior and ownership come from PRD v0.5 / Architecture v0.5.

W1 answers three implementation-blocking questions:

1. How many state systems exist in the new architecture?
2. Who owns Goban interaction semantics?
3. Who owns overlay display state and overlay styling/composition?

## 1. State Systems

### 1.1 Training Stores

The training architecture maintains two required Stores and one optional Store.

| Store | Required | Responsibility | Must Not Own |
|---|---:|---|---|
| `workbenchStore` | yes | open `WorkbenchTab`s, active tab, tab mode, player config, active attempt/recall ids, analysis context, current tree position reference | persisted task/attempt/bad-move facts, board mutation, overlay style |
| `trainingRuntimeStore` | yes | current training runtime affordances: active checkpoint, pending move evaluations, correction draft, visible bad move ids, AI move pending | durable history, task metadata, board facts |
| `reviewQueueStore` | optional | review inbox UI queue if it cannot stay local to review container | review schedule facts, task facts |

No additional training Stores should be introduced for task, attempt, bad move, recall, checkpoint, snapshot, or analysis. Those are DB facts behind `trainingRepository` and domain services.

### 1.2 Existing Non-Training State Sources

These sources remain, but they are not new training Stores.

| Source | Owns | Read Through | Write Through |
|---|---|---|---|
| `documentStore` / legacy Sabaki core | game tree, tree position, navigation, board mutation facts | document/board adapter or existing board APIs | board command adapter / legacy adapter |
| `analysisService` | current AI analysis cache and update events | `analysisResultAdapter` | engine/analysis lifecycle |
| `overlayStore` | overlay toggles and info overlay state | overlay ViewModel / components | overlay UI commands only |
| `analysisAreaStore` | analysis area selection state during migration | area adapter/ViewModel | area selection UI or task import workflow |
| legacy `sabaki.state` | compatibility state and existing UI state during migration | adapter/ViewModel | legacy adapter or existing app shell |

`Workspace` state, especially `editWorkspace`, is legacy/scratch board state. It must not become the training fact source. Analysis exploration may read it and Snapshot may capture from it, but the persisted training fact is only the new `TrainingTask` created by Snapshot.

### 1.3 State Read Path

All workbench UI props should be projected by `TrainingWorkbenchContainer` and small ViewModel helpers.

```text
workbenchStore.activeTab
+ trainingRuntimeStore
+ trainingRepository queries
+ document/board adapter reads
+ analysisResultAdapter reads
+ overlay ViewModel
→ TrainingWorkbenchContainer / ViewModels
→ WorkbenchShell and panels
```

Panels and shell controls must not query Stores or services directly.

### 1.4 Command Write Path

Every active control must follow this path:

```text
UI callback
→ TrainingWorkbenchContainer command handler
→ service / mode controller / board interaction executor
→ Store / Repository / Adapter
→ re-project UI
```

Direct Store writes from UI components are disallowed. Container may call Store read APIs for projection, but workflow mutation should go through services/controllers.

## 2. Mode Ownership

### 2.1 WorkbenchMode

`WorkbenchMode` is the product mode:

```ts
type WorkbenchMode = 'play' | 'problem' | 'recall' | 'analysis'
```

It lives on `WorkbenchTab.mode` and is owned by `workbenchStore`, with writes through `workbenchTabService` and `workbenchFlowService`.

It controls:

- which panel renders;
- which command set is visible;
- which workflow transitions are legal;
- which ViewModel projection is used.

### 2.2 Legacy Sabaki Mode

Legacy `sabaki.state.mode` is an app/board compatibility mode. It is not the training business source of truth.

Rules:

- Do not assume `WorkbenchMode` and `sabaki.state.mode` are the same enum.
- Do not call `sabaki.setMode(workbenchMode)` from generic workbench code.
- Any required legacy mode sync must go through `legacySabakiAdapter` or a board command adapter.
- Product workflow decisions must use active `WorkbenchTab.mode`, not legacy global mode.

### 2.3 Mode Transition Owner

`workbenchFlowService` owns legal workflow transitions:

| Transition | Owner |
|---|---|
| `play/problem --submit--> recall` | `workbenchFlowService.submit` |
| `play/problem/recall --enterAnalysis--> analysis` | `workbenchFlowService.enterAnalysis` |
| `analysis --returnFromAnalysis--> previous mode` | `workbenchFlowService.returnFromAnalysis` |
| `recall --complete--> analysis or end` | `workbenchFlowService` + `recallService` |
| `any mode --snapshot--> new tab` | `workbenchFlowService.snapshotFromCurrentContext` |

The segmented mode control is a request, not permission to arbitrarily set mode. It must route through the transition policy.

## 3. Goban Interaction Ownership

> **PROPOSED_GAP: Board Interaction Policy / Resolver / Executor**
>
> Status: intended architecture extension, already partially exists in `src/modules/workbench/board-interactions/*`.
> Reason: Goban click semantics cannot safely belong to panels or legacy `sabaki.state.mode`. A dedicated interaction layer is needed to resolve raw board events into intents before routing to mode controllers.
> Needs ratification in Architecture v0.5.
>
> Ownership boundaries:
> - Mode controllers (`PlayModeController`, `ProblemModeController`, `RecallModeController`, `AnalysisModeController`) still own mode-specific business commands.
> - Board interaction layer only resolves raw board events into semantic intents.
> - Executor routes intents to the correct mode controller / service / adapter.
> - The layer does NOT own training facts, does NOT write Store, does NOT replace `workbenchFlowService`.
>
> Flow:
> ```text
> Goban event
>   → board interaction resolver: what does this click mean?
>   → executor / router
>   → Play/Problem/Recall/Analysis controller or service
> ```

### 3.1 Owner

Goban interaction semantics are owned by the board interaction layer:

```text
src/modules/workbench/board-interactions/*
```

Specifically:

- context builder: raw app/tab/board/event facts into `BoardInteractionContext`;
- resolver: pure mapping from context to intent;
- executor: performs the routed command through services/adapters.

UI components own pointer events only. They do not decide whether a click means play move, problem answer, recall answer, annotation, edit-position mutation, or area selection.

### 3.2 Context Inputs

The context builder must receive all facts needed to resolve intent without reading globals:

| Input | Source |
|---|---|
| `tabId` | `workbenchStore.activeTabId` |
| `workbenchMode` | active `WorkbenchTab.mode` |
| `taskId` and task fields | active tab + repository/ViewModel |
| `playerConfig` | active `WorkbenchTab.playerConfig` |
| active attempt/recall/checkpoint ids | active tab + runtime store |
| current tree position and board | document/board adapter |
| selected board tool | board UI state / interaction policy |
| edit/exploration workspace metadata | legacy workspace adapter during migration |
| event data | Goban pointer event |
| problem area / analysis area | task fields or area adapter |

The resolver must not import `sabaki.js`, read Stores, mutate state, or call services.

### 3.3 Intent Output

The resolver produces an intent. The executor routes it.

| WorkbenchMode | Typical Intent | Executor Target |
|---|---|---|
| `play` | play stone, pass, undo, mark doubtful | board adapter + attempt/monitor services |
| `problem` | submit problem move, AI reply if enabled, pass/undo | problem mode controller + `aiMoveService` + attempt services |
| `recall` | submit recall move, checkpoint correction move | `recallService` / `recallCheckpointService` |
| `analysis` | scratch play/edit/mark/line, edit position | analysis controller + board adapter; must not mutate frozen Attempt |

Problem AI has a hard rule: if `playerConfig.problemOpponent === 'ai'`, the move generator and executor must enforce `TrainingTask.problemArea`. The UI may disable controls, but service-level enforcement is still required.

### 3.4 Selected Tool State

Selected board tool is interaction UI state, not a training fact.

During migration it may continue to live in legacy state. W1 implementation should introduce a narrow adapter/helper so components use:

```text
getSelectedBoardTool()
setSelectedBoardTool(toolId)
```

instead of coupling workbench controls directly to legacy state shape.

### 3.5 Area Selection

Analysis area / problem area has two roles:

| Role | Owner |
|---|---|
| temporary area selection UI | `analysisAreaStore` or local board UI state during migration |
| persisted Problem AI constraint | `TrainingTask.problemArea` |

When a task is created/imported, selected area may be copied into `TrainingTask.problemArea`. After that, Problem AI constraints must read from the task, not from transient area UI state.

## 4. Overlay Ownership

### 4.1 Overlay Store

`overlayStore` owns display toggles only:

- `territoryEnabled`
- `territoryCompareEnabled`
- `showInfoOverlay`
- `infoOverlayText`

It must not own:

- Attempt / BadMove / Recall facts;
- checkpoint state;
- task state;
- business decisions about training flow.

### 4.2 Overlay Contracts

> Implementation detail under `TrainingOverlayViewModel` and overlay rendering layer. This is NOT an additional training Store or business service. It describes the internal pipeline of how `TrainingOverlayViewModel` produces rendering output. If this pipeline changes ownership (e.g. overlay composition becomes a standalone service), it must be re-marked as `PROPOSED_GAP` and ratified in Architecture v0.5.

Overlay rendering is split into four layers.

| Layer | Responsibility |
|---|---|
| `overlayStore` | user-requested overlay toggles and info overlay visibility |
| `resolveOverlayInput` | raw facts -> normalized overlay input and availability reason |
| `composeWorkbenchOverlays` | normalized input -> paint map, marker map, status props, class name, layer ids |
| `BoardOverlayStack` / Goban | render composed overlay output |

`overlayLayers.ts` owns canonical layer definitions:

- source;
- render mode;
- priority;
- opacity;
- hit-test behavior;
- visual channels.

### 4.3 Training Overlays

Training business overlays should be derived through a ViewModel:

```text
TrainingTask / Attempt / BadMove / RecallCheckpoint / runtime state
→ TrainingOverlayViewModel
→ overlay props / marker candidates
→ overlay rendering layer
```

Training overlays must not be implemented by making `overlayStore` call training services.

### 4.4 Overlay Style Ownership

Overlay visual style is owned by:

- `overlayLayers.ts` for layer contract and priority;
- overlay composition modules for paint/marker/status output;
- CSS/theme tokens for final visual presentation.

Mode panels may request or display overlay state, but they do not define overlay style rules.

## 5. ViewModel Contract

The following are mode-specific projections of Architecture v0.5's `ModePanelViewModel`. Each ViewModel provides projection for one `WorkbenchMode` panel; they are not new architecture layers.

### 5.1 Shell ViewModel

| Prop | Source |
|---|---|
| `mode` | active `WorkbenchTab.mode` |
| `taskTitle` | active `TrainingTask.title` |
| `statusChips` | task/attempt/recall/runtime derived |
| `engineName`, `engineConnected` | engine service projection |
| `games`/tabs | `workbenchStore.tabs` joined with task titles |
| `activeIndex` | active tab id |
| captures/current player/move number | document/board adapter |

### 5.2 Play ViewModel

| Prop | Source |
|---|---|
| task summary | active `TrainingTask` |
| move count/captures | document/board adapter |
| black/white player config | active tab `playerConfig` |
| pending evaluation count | runtime/repository |
| bad move count | repository |

### 5.3 Problem ViewModel

| Prop | Source |
|---|---|
| prompt/goal/passRule/referenceLines | active `TrainingTask` |
| problem area status | active `TrainingTask.problemArea` |
| opponent mode | active tab `playerConfig.problemOpponent` |
| AI opponent enabled | `problemOpponent === 'ai' && task.problemArea exists` |
| attempt state/result | active attempt + runtime/repository |

### 5.4 Recall ViewModel

| Prop | Source |
|---|---|
| progress/current/total | active recall session |
| hint state | recall runtime/session |
| checkpoint queue | `recallCheckpointService`/repository |
| active checkpoint | runtime store |
| correction draft | runtime store |

### 5.5 Analysis ViewModel

| Prop | Source |
|---|---|
| analysis context | active tab `analysisContext` |
| bad move list | repository + active attempt |
| recall comments/checkpoint comparisons | repository |
| candidates/evaluation | analysis adapter |
| snapshot availability | active tab + board context |
| key point filter | runtime store |

## 6. Wiring Contract

### 6.1 Callback Aliasing

Presentational components may keep callback prop names such as `onSubmit`, `onAbandon`, `onSnapshot`, `onHint`, `onUndo`.

`TrainingWorkbenchContainer` must provide a single aliasing layer:

```text
UI callback prop
→ semantic command handler
→ service/controller
```

No component should know the service name.

### 6.2 Error Handling

Command handlers should:

1. derive active tab id once;
2. fail fast if no active tab exists;
3. call exactly one semantic owner;
4. let the owner update Store/repository;
5. log domain errors with command name and tab id;
6. re-project state through subscriptions.

### 6.3 Snapshot Wiring

Every discoverable Snapshot entry point must call the same command:

```text
snapshotCurrentContext({tabId, reason?})
→ workbenchFlowService.snapshotFromCurrentContext({tabId, reason})
→ snapshotService.captureSnapshotInput({tabId, mode: activeTab.mode, ...})
→ taskImportService.createTaskFromSnapshot
→ trainingRepository.createTask(origin.provider='snapshot')
→ workbenchTabService.openTask({taskId: newTaskId, mode, parentTabId: tabId})
```

Snapshot is available in every WorkbenchMode unless the active board context cannot be captured. It is not an Analysis-only command.

### 6.4 Submit Wiring

Play and Problem submit use the same workflow owner:

```text
submitAttempt({tabId})
→ workbenchFlowService.submit(tabId)
→ attemptService.freezeAttempt
→ evaluationRules.evaluateAttempt
→ recallService.createRecallFromAttempt
→ workbenchStore update through flow service
→ trainingRuntimeStore active recall update through flow/service
```

Problem-specific UI fields live on `TrainingTask`; they do not create a separate Problem source flow.

### 6.5 Enter Analysis Wiring

```text
enterAnalysis({tabId, context?})
→ workbenchFlowService.enterAnalysis
→ tab.mode = 'analysis'
→ tab.analysisContext set
```

Analysis exploration must not implicitly mutate `Attempt.userLine`. Only Snapshot creates a new `TrainingTask` from exploration.

## 7. Store Before/After Declarations

Core commands must produce the following observable Store state transitions.

### 7.1 submitAttempt

| Store field | Before | After |
|---|---|---|
| `workbenchStore.activeTab.mode` | `'play'` or `'problem'` | `'recall'` |
| `workbenchStore.activeTab.activeAttemptId` | attempt id | same attempt id (frozen), not cleared — recall session references it |
| `trainingRuntimeStore.activeRecallSessionId` | `null` | new session id |
| `trainingRuntimeStore.pendingMoveEvaluations` | pending list | cleared (evaluated during submit) |

### 7.2 enterAnalysis

| Store field | Before | After |
|---|---|---|
| `workbenchStore.activeTab.mode` | `'play'` / `'problem'` / `'recall'` | `'analysis'` |
| `workbenchStore.activeTab.analysisContext` | `null` or previous | new context with `previousMode`, `sourceAttemptId?` |

Forbidden side effect: `Attempt.userLine` must not change.

### 7.3 returnFromAnalysis

| Store field | Before | After |
|---|---|---|
| `workbenchStore.activeTab.mode` | `'analysis'` | `previousMode` from `analysisContext` |
| `workbenchStore.activeTab.analysisContext` | active context | cleared |

### 7.4 snapshotCurrentContext

| Store field | Before | After |
|---|---|---|
| `workbenchStore.tabs` | N tabs | N+1 tabs (new tab with new `taskId`) |
| `workbenchStore.activeTabId` | current id | new tab id (snapshot tab becomes active) |

New tab fields: `mode` from snapshot context, `parentTabId` = source tab id, `taskId` = newly created task id.

### 7.5 updatePlayerConfig

| Store field | Before | After |
|---|---|---|
| `workbenchStore.activeTab.playerConfig` | current config | merged patch |

Guard: if `patch.problemOpponent === 'ai'` and `TrainingTask.problemArea` is falsy, the update must be rejected or AI opponent must remain disabled.

### 7.6 selectCheckpoint

| Store field | Before | After |
|---|---|---|
| `trainingRuntimeStore.activeCheckpointId` | current or `null` | selected checkpoint id |

No training facts are created or mutated.

### 7.7 endRecall

| Store field | Before | After |
|---|---|---|
| `workbenchStore.activeTab.mode` | `'recall'` | depends on flow: `'analysis'` or tab closed |
| `trainingRuntimeStore.activeRecallSessionId` | session id | cleared |

## 8. Implementation Order

1. Add ViewModel projection helpers for shell/play/problem/recall/analysis.
2. Add a command handler map in `TrainingWorkbenchContainer`.
3. Add callback aliasing from UI prop names to semantic command handlers.
4. Add or wrap board interaction context so it consumes `WorkbenchMode`, active tab, task, runtime, selected tool, and board facts.
5. Wire safe commands first: tab switch/close, submit, enter/return analysis, snapshot.
6. Wire player config with Problem AI `problemArea` gating.
7. Wire recall checkpoint commands.
8. Keep overlay state and training overlay derivation separate.

## 9. Acceptance Checks

W1 is complete when:

- No workbench UI component directly writes a Store.
- No command owner depends on `origin.provider` for core flow.
- No generic command calls `sabaki.setMode(workbenchMode)`.
- All tab open paths use standard `TrainingTask` open semantics.
- Snapshot buttons/shortcuts share one command path.
- Problem AI cannot be enabled or executed without `TrainingTask.problemArea`.
- Goban click behavior is resolved by board interaction resolver/executor, not panel code.
- `overlayStore` remains display-only and has no training service dependency.
- Training overlay data is derived by ViewModel/composition, not stored as business facts in `overlayStore`.

## 10. Manual Acceptance

Each workflow must be clickable in the running app. Minimum click paths:

### 10.1 Play Submit → Recall

1. Open app, ensure training workbench loads.
2. Click Play mode in ModeBar.
3. Place stones on the board.
4. Click Submit (ModeActions or BottomActionBar).
5. Confirm: tab mode changes to Recall, left panel shows RecallModePanel, board position resets to attempt start.

### 10.2 Problem AI Gating

1. Open a Problem task that has no `problemArea`.
2. Open left panel, attempt to switch opponent to AI.
3. Confirm: AI opponent control is disabled or rejected.
4. Open a Problem task that has `problemArea`.
5. Switch opponent to AI.
6. Confirm: AI opponent activates, AI moves stay within problem area.

### 10.3 Enter Analysis and Return

1. In any mode (Play/Problem/Recall), click Enter Analysis.
2. Confirm: mode switches to Analysis, left panel shows AnalysisModePanel.
3. Place exploration moves.
4. Click Return.
5. Confirm: mode returns to previous mode, board position restores, no Attempt.userLine mutation.

### 10.4 Snapshot from Any Mode

1. In Play mode, click Snapshot.
2. Confirm: new tab opens with captured position.
3. Switch to Problem mode, click Snapshot.
4. Confirm: new tab opens.
5. Switch to Recall mode, click Snapshot.
6. Confirm: new tab opens.
7. In Analysis mode, click Snapshot.
8. Confirm: new tab opens with exploration branch.

### 10.5 Recall Checkpoint Flow

1. After Submit (10.1), Recall mode is active.
2. Place recall moves until hitting a BadMove.
3. Confirm: checkpoint triggers, correction panel appears.
4. Place correction line.
5. Click Reveal AI Candidates.
6. Confirm: AI candidate lines appear alongside user correction.

### 10.6 Player Config Update

1. In Play mode, change black/white player config in left panel.
2. Confirm: config change reflects immediately (AI takes over if set).
3. In Problem mode, switch opponent between self and AI.
4. Confirm: gating by problemArea works as in 10.2.

### 10.7 Tab Switch and Close

1. Open multiple tasks (tabs).
2. Click different tabs in GameTabBar.
3. Confirm: active tab switches, mode and panel update.
4. Close a tab.
5. Confirm: tab closes, task persists, active tab switches to neighbor.
