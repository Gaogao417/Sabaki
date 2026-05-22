# W2 Shell and Tab Wiring Contract

Date: 2026-05-19
Status: pending-confirmation

## 0. Source of Truth

This contract is subordinate to:

- `docs/design/gabaki-sabaki-training-prd-v0.5.md`
- `docs/design/gabaki-sabaki-training-architecture-v0.5.md`

`w0-control-inventory-and-command-map-v0.1.md` is referenced for command naming and inventory continuity only. `w1-state-ownership-and-wiring-contract-v0.1.md` is referenced for store before/after declarations and projection contracts. Behavior and ownership come from PRD v0.5 / Architecture v0.5.

### Source Alignment

| Truth Source | Section | Constraint on This Contract |
| --- | --- | --- |
| PRD v0.5 | §0.4 Flow convergence: Play/Problem -> Submit -> Recall; Analysis flexible entry | Submit must transition to recall; Analysis must not pollute Attempt.userLine |
| PRD v0.5 | §3.1-3.4 Four main modes behavior | ModeBar segments map to play/problem/recall/analysis; button sets per §6.3-6.6 |
| PRD v0.5 | §4.3 WorkbenchTab | Tab holds mode, taskId, activeAttemptId, activeRecallSessionId, analysisContext; Tab can close, Task persists |
| PRD v0.5 | §5.2 Play/Problem -> Submit -> Recall | Submit path: freeze -> evaluate -> createRecall -> mode=recall |
| PRD v0.5 | §5.5 Snapshot | Any mode Snapshot -> new Tab + new TrainingTask(origin.provider='snapshot') |
| Arch v0.5 | §1.1/1.2 Read/write paths | Render: Store -> Container -> UI; Command: UI -> Container -> Service -> Store/Repo |
| Arch v0.5 | §4.2 workbenchStore | workbenchStore owns tabs, activeTabId, tab.mode, tab.playerConfig |
| Arch v0.5 | §4.3 trainingRuntimeStore | runtimeStore owns activeAttemptId, activeRecallSessionId, activeCheckpointId, pendingEvals, visibleBadMoveIds, correctionDraft |
| Arch v0.5 | §5.2 workbenchTabService | openTask/closeTab/switchTab; no openGameTab/openProblemTab as new primary paths |
| Arch v0.5 | §5.3 workbenchFlowService | submit/enterAnalysis/returnFromAnalysis/completeRecall/snapshotFromCurrentContext/startAttempt/restartAttempt |
| Arch v0.5 | §9.2-9.9 Key command paths | Full command paths for openTask/submit/recall/checkpoint/analysis/snapshot |
| Arch v0.5 | §14 Architecture red lines | origin not in main flow; Analysis doesn't pollute Attempt; Stores capped at 2-3 |

## 1. Scope

W2 wires shell and tab controls to training services and stores. Specifically:

**ModeBar (S-06):** mode segmented control -> `requestWorkbenchMode`

**ModeActions (S-08, S-10 through S-18):**
- S-08: new game -> `createTrainingTaskAndOpen`
- S-10: play submit -> `submitAttempt`
- S-11: play resign -> `resignAttempt`
- S-12: problem submit -> `submitAttempt`
- S-13: problem abandon -> `abandonAttempt`
- S-14: problem enter analysis -> `enterAnalysis`
- S-15: recall enter analysis -> `enterAnalysis`
- S-16: recall end recall -> `endRecall`
- S-17: snapshot -> `snapshotCurrentContext`
- S-18: analysis return -> `returnFromAnalysis`

**GameTabBar (S-19, S-20, S-21):**
- S-19: select tab -> `switchTaskTab`
- S-20: close tab -> `closeTaskTab`
- S-21: add/open task -> `openTask`

**Bottom bar shared (B-04, B-16):**
- B-04: submit -> `submitAttempt`
- B-16: snapshot -> `snapshotCurrentContext`

## 2. Full Wiring Loops

### 2.1 requestWorkbenchMode (S-06)

```text
ModeBar: onClick segmented button -> onModeChange(mode)
-> WorkbenchShell prop: onModeChange
-> TrainingWorkbenchContainer.handleModeChange(mode)
-> workbenchFlowService OR modeTransitionPolicy: validate activeTab.mode -> mode transition
-> workbenchStore.updateTab(activeTabId, {mode})
-> subscription triggers re-render
-> WorkbenchShell receives new mode prop
-> ModeBar, ModeActions, BottomActionBar, panels update
```

**PROPOSED_GAP**: Architecture v0.5 does not explicitly define `requestWorkbenchMode` transition policy. W0 assigns to `workbenchFlowService` or `workbenchUiPolicy`. Current `workbenchFlowService.MODE_TRANSITIONS` only allows specific directions. Free mode switching (e.g. analysis -> play) needs additional policy. Suggestion: for segmented control, only allow legal transitions via existing flowService methods; illegal transitions silently ignored (button disabled), no exceptions thrown.

### 2.2 createTrainingTaskAndOpen (S-08)

```text
ModeActions(play): onClick "New Game" -> onNewGame()
-> WorkbenchShell prop: onNewGame
-> TrainingWorkbenchContainer.handleNewGame()
-> taskImportService.createManualTask({mode: 'play'})
-> trainingRepository.createTask
-> workbenchTabService.openTask({taskId, mode: 'play'})
-> workbenchStore.addTab + setActiveTab
-> subscription triggers re-render
-> GameTabBar shows new tab; panels switch to play
```

### 2.3 submitAttempt (S-10, S-12, B-04)

```text
ModeActions(play): onClick "End" -> onEnd()
  OR ModeActions(problem): onClick "Submit Answer" -> onSubmit()
  OR BottomActionBar(play/problem): onClick -> onEndAttempt()/onSubmitAnswer()
-> TrainingWorkbenchContainer.handleSubmit()
-> workbenchFlowService.submit(activeTabId)
  -> attemptService.freezeAttempt(activeAttemptId)
  -> evaluationRules.evaluateAttempt
  -> attemptService.finalizeAttemptResult
  -> recallService.createRecallSession
  -> workbenchStore.updateTab({mode:'recall', activeRecallSessionId})
  -> runtimeStore.setProblemView(null)
  -> runtimeStore.setActiveRecallSession(sessionId)
-> subscription triggers re-render
-> WorkbenchShell mode changes to 'recall'
-> RecallModePanel renders
```

### 2.4 resignAttempt (S-11)

```text
ModeActions(play): onClick "Resign" -> onResign()
-> TrainingWorkbenchContainer.handleResign()
-> workbenchFlowService.resign(activeTabId)  [PROPOSED_GAP]
  -> attemptService.freezeAttempt
  -> attemptService.finalizeAttemptResult(attemptId, 'abandoned')
-> subscription triggers re-render
```

**PROPOSED_GAP**: `workbenchFlowService` has no `resign` method. Needs addition. Resign-after behavior (auto-recall or stay in play) is undefined in PRD v0.5. MVP suggestion: resign freezes Attempt, does not auto-enter Recall.

### 2.5 abandonAttempt (S-13)

```text
ModeActions(problem): onClick "Abandon" -> onAbandon()
-> TrainingWorkbenchContainer.handleAbandon()
-> workbenchFlowService.abandon(activeTabId)  [PROPOSED_GAP]
  -> attemptService.finalizeAttemptResult(attemptId, 'abandoned')
-> subscription triggers re-render
```

**PROPOSED_GAP**: `workbenchFlowService` has no `abandon` method. Needs addition.

### 2.6 enterAnalysis (S-14, S-15, B-12)

```text
ModeActions(problem/recall): onClick "Enter Analysis" -> onAnalysis()
  OR BottomActionBar(recall): onClick -> onEnterAnalysis()
-> TrainingWorkbenchContainer.handleEnterAnalysis()
-> workbenchFlowService.enterAnalysis(activeTabId)
  -> assertTransition(tab, 'enterAnalysis')
  -> workbenchStore.updateTab(tabId, {mode:'analysis', previousMode: tab.mode})
-> subscription triggers re-render
-> WorkbenchShell mode changes to 'analysis'
-> AnalysisModePanel renders
```

### 2.7 endRecall (S-16)

```text
ModeActions(recall): onClick "End" -> onEnd()
-> TrainingWorkbenchContainer.handleEndRecall()
-> recallService.completeRecall(activeRecallSessionId)
  -> trainingRepository.updateRecallSession({completed:true, completedAt})
  -> trainingRepository.updateAttempt({status:'completed'})
-> workbenchFlowService.completeRecall(activeTabId)
  -> workbenchStore.updateTab({mode:'analysis'})
  -> runtimeStore.setActiveRecallSession(undefined)
-> subscription triggers re-render
```

### 2.8 snapshotCurrentContext (S-17, B-16)

```text
ModeActions/BottomActionBar: onClick "Snapshot" -> onSnapshot()
-> TrainingWorkbenchContainer.handleSnapshot()
-> workbenchFlowService.snapshotFromCurrentContext(activeTabId)
  -> snapshotService.captureSnapshotInput({tabId, sourceTaskId, sourceAttemptId})
  -> trainingRepository.createTask(origin.provider='snapshot')
  -> tabService.openTask({taskId, mode:'problem', parentTabId})
-> subscription triggers re-render
-> GameTabBar shows new tab; new tab becomes active
```

### 2.9 returnFromAnalysis (S-18)

```text
ModeActions(analysis): onClick "Return" -> onReturn()
-> TrainingWorkbenchContainer.handleReturnFromAnalysis()
-> workbenchFlowService.returnFromAnalysis(activeTabId, previousMode)
  -> assertTransition(tab, 'returnFromAnalysis')
  -> workbenchStore.updateTab(tabId, {mode: toMode, previousMode: undefined})
-> subscription triggers re-render
-> WorkbenchShell mode changes to previousMode
```

### 2.10 switchTaskTab (S-19)

```text
GameTabBar: onClick tab -> onSelect(index)
-> WorkbenchShell prop: onSelectGame
-> TrainingWorkbenchContainer.handleSelectTab(index)
-> derive tabId from tabs[index]
-> workbenchTabService.switchTab(tabId)
  -> workbenchStore.setActiveTab(tabId)
-> subscription triggers re-render
-> All panels update to new active tab state
```

### 2.11 closeTaskTab (S-20)

```text
GameTabBar: onClick close -> onClose(index)
-> WorkbenchShell prop: onCloseGame
-> TrainingWorkbenchContainer.handleCloseTab(index)
-> derive tabId from tabs[index]
-> workbenchTabService.closeTab(tabId)
  -> unlink parent/child
  -> cascade close child tabs
  -> workbenchStore.removeTab(tabId)
-> subscription triggers re-render
-> GameTabBar updates; active tab switches to neighbor or null
```

### 2.12 openTask (S-21)

```text
GameTabBar: onClick "+" -> onAdd()
-> WorkbenchShell prop: onAddGame
-> TrainingWorkbenchContainer.handleAddTask()
-> (MaterialBrowser flow or taskImportService.createManualTask)
-> workbenchTabService.openTask({taskId, mode})
-> workbenchStore.addTab + setActiveTab
-> subscription triggers re-render
```

Full MaterialBrowser opening flow is out of W2 scope. W2 provides basic wiring to create an empty Play tab.

## 3. Store Before/After Declarations

### 3.1 submitAttempt (from W1 §7.1)

| Store field | Before | After |
| --- | --- | --- |
| `workbenchStore.activeTab.mode` | `'play'` or `'problem'` | `'recall'` |
| `workbenchStore.activeTab.activeAttemptId` | attempt id | same attempt id (frozen) |
| `workbenchStore.activeTab.activeRecallSessionId` | undefined | new session id |
| `trainingRuntimeStore.activeRecallSessionId` | undefined | new session id |
| `trainingRuntimeStore.problemView` | ProblemView or null | null |

### 3.2 enterAnalysis (from W1 §7.2)

| Store field | Before | After |
| --- | --- | --- |
| `workbenchStore.activeTab.mode` | `'play'`/`'problem'`/`'recall'` | `'analysis'` |
| `workbenchStore.activeTab.previousMode` | undefined | previous mode value |

Forbidden side effect: `Attempt.userLine` must not change.

### 3.3 returnFromAnalysis (from W1 §7.3)

| Store field | Before | After |
| --- | --- | --- |
| `workbenchStore.activeTab.mode` | `'analysis'` | `previousMode` value |
| `workbenchStore.activeTab.previousMode` | previous mode | undefined |

### 3.4 snapshotCurrentContext (from W1 §7.4)

| Store field | Before | After |
| --- | --- | --- |
| `workbenchStore.tabs` | N tabs | N+1 tabs |
| `workbenchStore.activeTabId` | current id | new tab id |

### 3.5 endRecall (from W1 §7.7)

| Store field | Before | After |
| --- | --- | --- |
| `workbenchStore.activeTab.mode` | `'recall'` | `'analysis'` |
| `trainingRuntimeStore.activeRecallSessionId` | session id | undefined |

### 3.6 switchTaskTab

| Store field | Before | After |
| --- | --- | --- |
| `workbenchStore.activeTabId` | current id | selected tab id |

### 3.7 closeTaskTab

| Store field | Before | After |
| --- | --- | --- |
| `workbenchStore.tabs` | N tabs | N-1 tabs (minus closed tab + cascade children) |
| `workbenchStore.activeTabId` | possibly closed tab id | neighbor tab id |

## 4. Allowed Side Effects

| Command | Allowed |
| --- | --- |
| submitAttempt | `trainingRepository` transaction (freeze, finalize, create recall); `runtimeStore` update |
| resignAttempt | `trainingRepository` update (freeze, finalize) |
| abandonAttempt | `trainingRepository` update (finalize) |
| endRecall | `trainingRepository` update (complete session, update attempt) |
| snapshotCurrentContext | `trainingRepository` transaction (create task); `workbenchStore` addTab |
| createTrainingTaskAndOpen | `trainingRepository` write (create task); `workbenchStore` addTab |
| enterAnalysis | `workbenchStore` updateTab; `attemptService.markAnalysisOpened` (optional) |
| returnFromAnalysis | `workbenchStore` updateTab |
| requestWorkbenchMode | `workbenchStore` updateTab |
| switchTaskTab | `workbenchStore` setActiveTab |
| closeTaskTab | `workbenchStore` removeTab + cascade |
| openTask | `workbenchStore` addTab + setActiveTab |

Legacy compatibility allowed:
- `legacySabakiAdapter.setLegacyMode` only when legacy UI sync needed
- `legacySabakiAdapter.notifyLegacyStateChanged` only after tab switch

## 5. Forbidden Side Effects

1. UI component directly writes `workbenchStore` or `trainingRuntimeStore`.
2. Container directly calls `workbenchStore.updateTab` for domain workflows (must go through service).
3. Command path branches on `origin.provider` or `task.kind`.
4. `Attempt.userLine` modified in enterAnalysis or returnFromAnalysis.
5. Analysis free play writes to frozen Attempt.
6. Snapshot reuses current Tab as new Task.
7. Using `openGameTab`/`openProblemTab`/`openSnapshotProblemTab` as new primary paths.
8. Container directly calls `sabaki.setMode()`.
9. `snapshotService` opens Tab (must go through `workbenchFlowService`).
10. ModeBar segmented control throws unhandled exception on illegal transition.

## 6. Test/Verification Contract

### 6.1 State Transition Tests (MUST_AUTOMATE)

| ID | Contract | Criticality |
| --- | --- | --- |
| W2-T01 | submitAttempt: activeTab.mode play -> recall, creates RecallSession, freezes Attempt | critical |
| W2-T02 | submitAttempt: activeTab.mode problem -> recall | critical |
| W2-T03 | enterAnalysis: saves previousMode, sets mode to analysis | critical |
| W2-T04 | returnFromAnalysis: restores previousMode, clears previousMode field | critical |
| W2-T05 | enterAnalysis does not modify Attempt.userLine | critical |
| W2-T06 | snapshotFromCurrentContext creates new tab + new task, activeTabId switches to new tab | critical |
| W2-T07 | switchTab changes activeTabId | high |
| W2-T08 | closeTab removes tab, cascades child tabs, unlinks parent | high |
| W2-T19 | completeRecall: recall -> analysis, clears runtimeStore.activeRecallSessionId | high |
| W2-T20 | submitAttempt clears runtimeStore.problemView | medium |
| W2-T22 | openTask infers default mode (has prompt -> problem, else -> play) | high |
| W2-T31 | resignAttempt freezes Attempt and sets result='abandoned' | medium |

### 6.2 Wiring Tests (MUST_AUTOMATE)

| ID | Contract | Criticality |
| --- | --- | --- |
| W2-T09 | Container onModeChange routes to flowService or transition policy | high |
| W2-T10 | Container handleSubmit routes to flowService.submit | critical |
| W2-T11 | Container handleEnterAnalysis routes to flowService.enterAnalysis | critical |
| W2-T12 | Container handleReturnFromAnalysis routes to flowService.returnFromAnalysis | critical |
| W2-T13 | Container handleSnapshot routes to flowService.snapshotFromCurrentContext | high |
| W2-T14 | Container handleSelectTab maps index to tabId, calls tabService.switchTab | high |
| W2-T15 | Container handleCloseTab maps index to tabId, calls tabService.closeTab | high |
| W2-T21 | GameTabBar games projected from workbenchStore.tabs + task titles | high |
| W2-T32 | abandonAttempt routes to correct service/controller | medium |

### 6.3 Architecture Boundary Tests (MUST_AUTOMATE)

| ID | Contract | Criticality |
| --- | --- | --- |
| W2-T16 | No UI component directly writes workbenchStore | critical |
| W2-T17 | No command branches on origin.provider | critical |
| W2-T18 | workbenchFlowService rejects illegal mode transitions | high |
| W2-T33 | snapshotFromCurrentContext creates task with origin.provider='snapshot' | medium |

### 6.4 Manual Acceptance Tests

| ID | Click Path |
| --- | --- |
| W2-T23 | ModeBar: click segments, verify panel switching and button set changes |
| W2-T24 | Play mode: place stones -> Submit -> verify RecallModePanel visible |
| W2-T25 | Problem mode: click "Enter Analysis" -> verify AnalysisModePanel visible |
| W2-T26 | Analysis mode: click "Return" -> verify panel restores to previous mode panel |
| W2-T27 | Any mode: click Snapshot -> verify new tab in GameTabBar and activated |
| W2-T28 | Multiple tabs: click different tabs -> verify panels, mode, title all update |
| W2-T29 | Close a tab -> verify active tab switches to neighbor |
| W2-T30 | Play/Problem: click submit in both ModeActions and BottomActionBar -> verify same behavior |

## 7. Not Tested

| Scope | Reason |
| --- | --- |
| GlobalHeader display-only props | display-only, no interaction logic |
| StoneStatus display | display-only |
| ModeActions button render count | weak test, proves rendering not wiring |
| BottomActionBar CSS class | style test, frontend visual workflow |
| ModeBar segmented control DOM structure | weak test, proves existence only |
| WorkbenchShell layout | frontend visual workflow |
| Zoom/Fullscreen (B-18/B-19) | implementation-level, not training business |
| Settings (S-09) | deferred per W0 |

## 8. Fragile Test Warnings

1. **"handler called once" tests**: Container wiring tests must verify which service method was called and with what arguments (tabId, mode), not just callback count.
2. **index -> tabId mapping tests**: Test the contract "given tabs list, select index N calls switchTab with correct tabId", not the internal mapping implementation.
3. **Button label tests**: Do not lock on button text. Lock on semantic command (submitAttempt).
4. **previousMode field name tests**: Test "return restores to pre-analysis mode", not the specific field name.
5. **Container internal method name tests**: Test "UI callback prop -> service method" mapping, not handler method names.

## 9. Out of Scope

| Scope | Reason |
| --- | --- |
| Left panel internal controls (LP-01..LP-18) | W3 scope |
| Right panel controls (RP-01..RP-05) | W3 scope |
| Goban board interaction wiring | Needs board interaction policy first |
| Overlay wiring | Overlay ViewModel separate workflow |
| Recall Checkpoint detail wiring (B-09..B-15) | W3 scope |
| Review flow wiring | Review service separate |
| AI Move auto-reply wiring | Needs engine integration |
| undoBoardCommand / redoBoardCommand / passMove | Board command adapter not ready |
| Settings dialog | Deferred (S-09) |

## 10. PROPOSED_GAP Summary

| ID | Description | Handling |
| --- | --- | --- |
| GAP-01 | `workbenchFlowService` lacks `resign(tabId)` method | Add `resign`: freeze + finalizeResult('abandoned'). Post-resign behavior needs product decision. |
| GAP-02 | `workbenchFlowService` lacks `abandon(tabId)` method | Add `abandon`: finalizeResult('abandoned'), mark Attempt abandoned. |
| GAP-03 | `requestWorkbenchMode` free mode switching policy undefined | Add `workbenchUiPolicy` or extend MODE_TRANSITIONS. MVP: segmented control only allows legal transitions, illegal ones disable buttons. |
| GAP-04 | `GameTabBar` uses index not tabId | Container handles mapping. Long-term: GameTabBar should pass tabId directly. |
| GAP-05 | Resign post-flow unclear (auto-recall or not) | PRD v0.5 undefined. MVP: resign freezes Attempt, no auto-Recall. |

## 11. v0.5 Conflict Check

| Check | Result | Evidence |
| --- | --- | --- |
| origin.provider as flow branch | No | All W2 commands do not check origin.provider |
| source-specific open API as new primary path | No | Uses workbenchTabService.openTask |
| snapshotService opens tabs | No | snapshotFromCurrentContext orchestrated in flowService |
| Container directly writes store | No | All handlers route to service/controller |
| UI component depends on service/store | No | All components receive callback props only |
| Restores kind/source distinction | No | W2 does not use task.kind or task.source |
| Attempt.userLine modified in Analysis | No | enterAnalysis only changes mode and analysisContext |
| Snapshot reuses current Tab | No | snapshotFromCurrentContext creates new Tab |
