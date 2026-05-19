# W3 Goban Wiring Contract

Date: 2026-05-19
Status: pending-confirmation

## 0. Source of Truth

This contract is subordinate to:

- `docs/design/gabaki-sabaki-training-prd-v0.5.md`
- `docs/design/gabaki-sabaki-training-architecture-v0.5.md`

Referenced for continuity only:
- `goban-overlay-state-matrix-v0.1.md` — goban event/overlay state per mode
- `w1-state-ownership-and-wiring-contract-v0.1.md` — store ownership, interaction ownership
- `w2-shell-and-tab-wiring-contract-v0.1.md` — shell/tab wiring (completed)

### Source Alignment

| Truth Source | Section | Constraint on This Contract |
| --- | --- | --- |
| PRD v0.5 | §0.4 Flow convergence | Play/Problem/Recall/Analysis four modes; submit → recall; analysis doesn't pollute Attempt |
| PRD v0.5 | §3.1 Play Mode | Play free placement, AI config, submit freezes Attempt |
| PRD v0.5 | §3.2 Problem Mode | Problem has prompt, problemArea constrains AI replies, opponent self/ai |
| PRD v0.5 | §3.3 Recall Mode | Recall replays Attempt.userLine; bad move triggers checkpoint; recall MUST NOT modify game tree |
| PRD v0.5 | §3.4 Analysis Mode | Analysis free play/scratch/edit position; MUST NOT modify Attempt.userLine |
| PRD v0.5 | §4.3 WorkbenchTab | Tab holds mode, taskId, activeAttemptId, activeRecallSessionId, analysisContext |
| PRD v0.5 | §4.5 TrainingAttempt | userLine frozen after submit; analysis doesn't change userLine |
| Arch v0.5 | §1.1/1.2 Read/Write paths | Render: Store → Container → UI; Command: UI → Container → Service → Store/Repo |
| Arch v0.5 | §4.2 workbenchStore | tabs, activeTabId, tab.mode, tab.playerConfig; writers: tabService, flowService |
| Arch v0.5 | §4.3 trainingRuntimeStore | activeAttemptId, activeRecallSessionId, pendingMoveEvaluations, correctionDraft |
| Arch v0.5 | §5.3 workbenchFlowService | submit/enterAnalysis/returnFromAnalysis/completeRecall/snapshotFromCurrentContext |
| Arch v0.5 | §9.3 User move | click → mode controller → executor → documentStore → attemptService.appendMove → playTrainingMonitor → aiMoveService |
| Arch v0.5 | §14 Architecture red lines | source not in flow; Attempt frozen after submit; Analysis doesn't pollute Attempt; Stores capped 2-3; origin only for tracing |
| W1 | §2.1 WorkbenchMode | workbenchStore owns tab.mode; not equal to legacy sabaki.state.mode |
| W1 | §3.1-3.4 Goban Interaction | board interaction resolver is pure; doesn't import sabaki.js; doesn't read/write Store |
| W1 | §3.2 Context Inputs | resolver receives tabId, workbenchMode, taskId, playerConfig, board facts, event data, problemArea |
| Matrix | §1.1 Event Routing Chain | BoundedGoban → coord transform → Goban → handleVertexClick → resolveBoardInteraction → executor |
| Matrix | §1.2 Event Bindings by Mode | click/drag/line/area per mode → intent → executor target |
| Matrix | §2.3 Overlay Activation by Mode | which overlay layers active per mode |
| Matrix | §3.1-3.3 Goban Props by Mode | event handler, overlay display, board state props per mode |
| Matrix | §4.1-4.5 Mode Transition Effects | submit/enterAnalysis/returnFromAnalysis/snapshot/switchTab Goban prop changes |
| Matrix | §5.2 Current Gaps | GAP-G1 through GAP-G7 |

## 1. Scope

### In scope:

1. **projectGobanProps pure helper** — takes state snapshot inputs, outputs structured Goban props
2. **MainBoardStage upgrade** — receives board surface as children/props, stays presentational
3. **resolveBoardInteraction WorkbenchMode context** — extends ResolverInput with workbenchMode, tabId, taskId, playerConfig, problemArea
4. **Mode transition Goban prop re-projection** — submit/enterAnalysis/returnFromAnalysis update Goban props
5. **Click event chain** — MainBoardStage → resolveBoardInteraction(WorkbenchMode context) → executor

### Deferred (post-MVP):

| Deferred item | Reason | Exit condition |
| --- | --- | --- |
| Problem area visual indicator (GAP-G5) | Needs product decision on render approach | Product confirms render scheme |
| Recall progress visual indicator (GAP-G6) | Product hasn't specified visual treatment | Product confirms visual spec |
| Full overlay pipeline WorkbenchMode wiring (GAP-G4) | overlay composition module not yet WorkbenchMode-aware | W5 analysis wiring phase |
| Analysis area selection in workbench context | area select handler bound but workbench context builder not ready | W5 analysis wiring |
| Play AI auto-move chain | aiMoveService call needs engine adapter ready | W5 or independent AI move wiring phase |
| Analysis mode full scratch wiring | Depends on editWorkspace adapter | W5 analysis wiring |

## 2. User Stories

1. As a Play mode user, I want to click an empty point on the board to place a stone, so the system records it to my Attempt.
2. As a Play mode AI-config user, I want the board to become read-only when it's AI's turn, so I don't accidentally click during AI thinking.
3. As a Problem mode user, I want to place stones within the problemArea with AI responding in-range, so I can focus on solving.
4. As a Recall mode user, I want to click an empty point to submit a recall answer without modifying the game tree, so the system judges correctness without polluting the formal record.
5. As an Analysis mode user, I want to freely place stones on scratch board without changing Attempt.userLine, so my exploration doesn't affect recorded facts.
6. After submit, the board should show the recall start position with move numbers and no ghost stones.
7. After enterAnalysis, the board should switch to scratch/editWorkspace and support drag/line tools.
8. After returnFromAnalysis, the board should restore the original mode's game tree and position.
9. When switching tabs, the board should immediately reflect the new tab's mode and position.

## 3. Current State

W3 happens after W2 (shell/tab wiring) is complete. Current state:

- workbenchStore owns tabs, activeTabId, tab.mode, tab.previousMode
- TrainingWorkbenchContainer has projectFromWorkbench and projectFromRuntime for shell/panel props, nothing for Goban
- MainBoardStage is a placeholder rendering "棋盘区域" text
- MainView.js still assembles gobanProps based on legacy sabaki.state.mode (L391-442)
- resolveBoardInteraction exists but uses legacy mode string, lacks WorkbenchMode/tab context
- Workbench render path: TrainingWorkbenchContainer → WorkbenchShell → MainBoardStage, not MainView

## 4. Position Source

| Mode | Position Source | MutationContract |
| --- | --- | --- |
| play | game-tree (formal tree, current treePosition) | playMove |
| problem | game-tree (formal tree, current treePosition) | playMove (with problemArea constraint) |
| recall | game-tree (read-only formal tree, recall start position) | recallAnswer |
| analysis | scratch (editWorkspace) | scratchEdit |

## 5. Mutation Contracts

| Mode | Intent | Contract | Executor |
| --- | --- | --- | --- |
| play | play-stone | playMove | playInteractionExecutor → documentStore.playMove |
| problem | play-stone | playMove (problemArea-filtered) | playInteractionExecutor → documentStore.playMove |
| recall | submit-recall-answer | recallAnswer | recallInteractionExecutor → recallService.submitRecallMove |
| analysis | place-black/white/erase/drag/mark/draw-line/play-stone | scratchEdit | scratchEditInteractionExecutor → editWorkspace |
| analysis (no workspace) | legacy-sgf-edit | deferred | legacy sabaki path |

## 6. Wiring Loops

### 6.1 projectGobanProps Projection (State → Props)

```text
workbenchStore.activeTab (mode, playerConfig, activeAttemptId, activeRecallSessionId, analysisContext)
+ trainingRuntimeStore (activeCheckpointId, correctionDraft)
+ trainingRepository query (task.problemArea, task.prompt, task.goal)
+ documentStore/board adapter (gameTree, treePosition, board)
+ editWorkspace adapter (scratch tree, position, markers, lines)
+ overlayStore (territoryEnabled, territoryCompareEnabled)
+ analysisResultAdapter (current analysis, candidateMoves)
+ user settings (showMoveNumbers, showNextMoves, showSiblings, showAnalysis, showCoordinates)
+ selected board tool (via adapter)
  ↓
projectGobanProps(workbenchMode, task, runtimeState, boardState, overlayState, settings, analysisData)
  ↓ pure function returns:
{
  boardStateProps: { gameTree, treePosition, board },
  overlayDisplayProps: { paintMap, markerMap, dimmedStones, analysis, showMoveNumbers, showNextMoves, showSiblings, crosshair, overlayGhostStoneMap },
  interactionProps: { dragMode, drawLineMode, areaSelectMode },
  handlerProps: { onVertexClick, onLineDraw, onAreaSelect, onStoneDragEnd, onPlayVariationMoves }
}
  ↓
TrainingWorkbenchContainer passes result as props to WorkbenchShell → MainBoardStage
  ↓
MainBoardStage renders Goban/BoardOverlayStack with these props
```

### 6.2 Click Event Chain (Goban Click → Resolver → Executor)

```text
Goban component handleVertexMouseUp
  → coordinate transform (gobantransformer.invert + transformVertex)
  → MainBoardStage.props.onVertexClick(vertex, event)
  → TrainingWorkbenchContainer.handleBoardVertexClick(vertex, event)
  → build enhanced context:
      {
        mode: activeTab.mode,          // WorkbenchMode, not legacy string
        selectedTool,
        event: { button, ctrlKey, metaKey, isMac },
        point: { sign, markerType },
        vertex,
        positionSource,
        mutationContract,
        editWorkspacePresent,
        // W3 extension:
        workbenchMode: activeTab.mode,
        tabId: activeTab.id,
        taskId: activeTab.taskId,
        playerConfig: activeTab.playerConfig,
        problemArea: task.problemArea,
        activeAttemptId: activeTab.activeAttemptId,
        activeRecallSessionId: activeTab.activeRecallSessionId,
      }
  → resolveBoardInteraction(enhancedInput)
  → BoardInteractionResult { intent, mutationContract, status, payload }
  → route to executor:
      mutationContract === 'playMove'        → playInteractionExecutor
      mutationContract === 'recallAnswer'    → recallInteractionExecutor
      mutationContract === 'scratchEdit'     → scratchEditInteractionExecutor
      status === DEFERRED                    → legacy sabaki path (migration seam)
      status === REJECTED                    → no-op
  → executor performs board/service mutation
  → store update triggers subscription
  → TrainingWorkbenchContainer re-renders
  → projectGobanProps re-projects
  → Goban props update
```

### 6.3 Mode Transition Goban Prop Updates

#### submitAttempt (per matrix §4.1)

```text
Before: play/problem mode
After: recall mode

boardStateProps:
  gameTree: stays formal tree (read-only in recall)
  treePosition: reverts to attempt start position
  board: derived from recall start position

overlayDisplayProps:
  showMoveNumbers: false → true
  showNextMoves: setting → false
  showSiblings: setting → false
  analysis: conditional → null
  paintMap: overlayStack → []

interactionProps:
  dragMode: false (unchanged)
  drawLineMode: null (unchanged)

handlerProps:
  onVertexClick: play-stone → recall-answer handler
```

#### enterAnalysis (per matrix §4.2)

```text
Before: play/problem/recall mode
After: analysis mode

boardStateProps:
  gameTree: formal tree → editWorkspace tree (snapshot of formal)
  treePosition: current → editWorkspace position
  board: derived from editWorkspace position

overlayDisplayProps:
  showMoveNumbers: mode-specific → user setting
  showNextMoves: mode-specific → user setting
  showSiblings: mode-specific → user setting
  analysis: mode-specific → conditional (full overlay access)

interactionProps:
  dragMode: false → true (editWorkspace present)
  drawLineMode: null → depends on selectedTool
```

#### returnFromAnalysis (per matrix §4.3)

```text
Before: analysis mode
After: previousMode

All props restore to previousMode projection.
gameTree: editWorkspace tree → formal tree (restored)
treePosition: editWorkspace position → original position
dragMode: true → false
drawLineMode: tool-dependent → null
```

#### switchTaskTab (per matrix §4.5)

```text
activeTabId changes → all Goban props re-projected from new tab's mode and state.
gameTree, treePosition, board: switch to new tab's tree.
event binding, overlays: switch to new tab's mode.
```

## 7. projectGobanProps Function Spec

### Location

`src/modules/training/workbench/projectGobanProps.ts`

Pure projection function. Does not import stores, does not call services, does not produce side effects.

### Signature

```ts
type WorkbenchMode = 'play' | 'problem' | 'recall' | 'analysis'

type GobanPropsInput = {
  workbenchMode: WorkbenchMode
  task: {
    problemArea?: object
    prompt?: string
    goal?: string
  } | null
  runtimeState: {
    activeCheckpointId?: string
    correctionDraft?: object
  }
  boardState: {
    gameTree: object | null
    treePosition: string
    board: object
  }
  overlayState: {
    paintMap: number[][]
    markerMap: (object | null)[][]
    dimmedStones: [number, number][]
    analysis: object | null
    overlayGhostStoneMap?: object | null
  }
  settings: {
    showMoveNumbers: boolean
    showNextMoves: boolean
    showSiblings: boolean
    showAnalysis: boolean
    showCoordinates: boolean
    showHumanPreference: boolean
    selectedTool: string
    editWorkspaceActive: boolean
    boardTransformation: number[]
    areaSelectMode: boolean
  }
  analysisData: {
    activeAnalysis: object | null
    analysisType: string
  } | null
}

type GobanPropsOutput = {
  boardStateProps: {
    gameTree: object | null
    treePosition: string
    board: object
  }
  overlayDisplayProps: {
    paintMap: number[][]
    markerMap: (object | null)[][]
    dimmedStones: [number, number][]
    analysis: object | null
    showMoveNumbers: boolean
    showNextMoves: boolean
    showSiblings: boolean
    crosshair: boolean
    overlayGhostStoneMap?: object | null
    showCoordinates: boolean
    showMoveColorization: boolean
    fuzzyStonePlacement: boolean
    animateStonePlacement: boolean
    highlightVertices: [number, number][]
    analysisType: string
    showHumanPreference: boolean
  }
  interactionProps: {
    dragMode: boolean
    drawLineMode: string | null
    areaSelectMode: boolean
    transformation: number[]
  }
  handlerProps: {
    onVertexClick: Function
    onLineDraw: Function
    onAreaSelect: Function
    onStoneDragEnd: Function | null
    onPlayVariationMoves: Function | null
  }
}
```

### Per-Mode Behavior

| Output field | play | problem | recall | analysis (editWS) | analysis (no editWS) |
| --- | --- | --- | --- | --- | --- |
| showMoveNumbers | false | false | true | settings.showMoveNumbers | false |
| showNextMoves | settings | settings | false | settings | settings |
| showSiblings | settings | settings | false | settings | settings |
| analysis | if showAnalysis | if showAnalysis | null | if showAnalysis | null |
| dragMode | false | false | false | true | false |
| drawLineMode | null | null | null | tool ∈ [arrow,line] ? tool : null | null |
| dimmedStones | [] | [] | [] | [] | [] |
| crosshair | false | false | false | false | false |
| onStoneDragEnd | null | null | null | drag handler | null |
| onPlayVariationMoves | null | null | null | variation handler | null |

### Purity Guarantees

projectGobanProps MUST NOT:
- Import sabaki.js
- Read global state or window properties
- Call service/repository/adapter/store
- Modify any input parameter
- Produce random output or Date.now() calls

## 8. ResolverInput Extension Spec

### Current ResolverInput

```ts
type ResolverInput = {
  mode: string
  selectedTool: string
  event: BoardEvent
  point: PointState
  vertex: [number, number]
  sourceVertex?: [number, number] | null
  sourcePoint?: PointState | null
  positionSource: PositionSource | null
  mutationContract: MutationContract | null
  editWorkspacePresent: boolean
}
```

### W3 Extension

Add optional workbench context fields. When present, resolver uses WorkbenchMode branches instead of legacy mode string. When absent (non-workbench path), behavior is completely unchanged.

```ts
type ResolverInput = {
  // ... existing fields unchanged ...
  // W3 extension: workbench context (optional, undefined for non-workbench path)
  workbenchMode?: WorkbenchMode
  tabId?: string
  taskId?: string
  playerConfig?: object
  problemArea?: object
  activeAttemptId?: string
  activeRecallSessionId?: string
}
```

### Behavior Changes

When `workbenchMode` is present:

1. `mode` field is still set (compatibility), but resolveBoardInteraction primary routing uses `workbenchMode`
2. `problem` WorkbenchMode: same click resolution as play (play-stone on empty), but mutationContract determined by workbench context
3. `recall` WorkbenchMode: click produces submit-recall-answer intent, mutationContract = recallAnswer
4. `analysis` WorkbenchMode: click determined by selectedTool, uses editWorkspacePresent for scratch vs legacy
5. Play mode with playerConfig current side = AI: board click produces REJECTED (read-only)

When `workbenchMode` is absent: behavior completely unchanged, uses legacy mode string branches.

### Purity Preserved

Extension fields don't break resolver purity. Resolver still:
- Doesn't import sabaki.js
- Doesn't read global state
- Doesn't call service/store/repository
- Doesn't modify any input
- All information passed via parameters

### Problem Area Restriction

New resolver logic (in resolvePlay, when workbenchMode === 'problem'):

```ts
// Inside resolvePlay, if workbenchMode === 'problem' and problemArea exists
// and vertex is outside problemArea, return REJECTED
function isVertexInProblemArea(vertex: [number, number], area: object): boolean
```

This is a UI-layer pre-check. Service layer must still enforce (per PRD §3.2 hard constraint).

## 9. Store Before/After Declarations (Goban-affecting Mode Transitions)

### submitAttempt

| Store field | Before | After |
| --- | --- | --- |
| workbenchStore.activeTab.mode | 'play' / 'problem' | 'recall' |
| workbenchStore.activeTab.activeRecallSessionId | undefined | new session id |
| trainingRuntimeStore.activeRecallSessionId | undefined | new session id |
| trainingRuntimeStore.problemView | ProblemView or null | null |

Goban prop effects: treePosition → recall start; showMoveNumbers → true; showNextMoves → false; showSiblings → false; handler → recall-answer.

### enterAnalysis

| Store field | Before | After |
| --- | --- | --- |
| workbenchStore.activeTab.mode | 'play'/'problem'/'recall' | 'analysis' |
| workbenchStore.activeTab.previousMode | undefined | previous mode value |

Goban prop effects: gameTree → editWorkspace tree; dragMode → true; drawLineMode → tool-dependent; handler → tool-dependent.

### returnFromAnalysis

| Store field | Before | After |
| --- | --- | --- |
| workbenchStore.activeTab.mode | 'analysis' | previousMode value |
| workbenchStore.activeTab.previousMode | previous mode | undefined |

Goban prop effects: gameTree → formal tree; dragMode → false; drawLineMode → null; handler → mode-specific.

### switchTaskTab

| Store field | Before | After |
| --- | --- | --- |
| workbenchStore.activeTabId | current id | selected tab id |

Goban prop effects: all Goban props re-projected from new tab.

## 10. Allowed Side Effects

| Command | Allowed |
| --- | --- |
| play-stone (play/problem) | documentStore.playMove; attemptService.appendMove; playTrainingMonitor.onUserMove |
| submit-recall-answer | recallService.submitRecallMove (no game tree write, no documentStore write) |
| scratch edit | editWorkspace mutation (no formal tree write, no Attempt.userLine write) |
| drag stone | editWorkspace mutation (no formal tree write) |
| draw line | editWorkspace mutation (no formal tree write) |
| playInteractionExecutor async | engineService.generateReply; analysisService.scheduleLiveAnalysis |

Legacy compatibility allowed (migration seam):
- When status === DEFERRED, fallback to legacy sabaki.clickVertex path
- Exit condition: remove DEFERRED fallback after all WorkbenchMode branches implemented

## 11. Forbidden Side Effects

1. UI component directly writes workbenchStore or trainingRuntimeStore (per W1 §1.4, Arch §14)
2. Container directly calls workbenchStore.updateTab for domain workflows (must go through service)
3. resolveBoardInteraction imports sabaki.js or reads global state (per W1 §3.2, resolver purity)
4. Recall answer writes to game tree (per PRD §3.3, matrix §1.2 recall)
5. Analysis scratch edit writes Attempt.userLine (per PRD §3.4, matrix §1.2 analysis)
6. projectGobanProps calls service/store/adapter or produces IO
7. MainBoardStage holds non-presentational logic (doesn't decide click semantics)
8. WorkbenchShell directly assembles goban props (Container passes them in)
9. Container branches on origin.provider for Goban projection (per PRD §2.3)
10. Problem AI places stones outside problemArea (per PRD §3.2 hard constraint)

## 12. Test/Verification Contract

### 12.1 State Transition Tests (MUST_AUTOMATE)

| ID | Contract | Criticality |
| --- | --- | --- |
| W3-T01 | projectGobanProps(play) returns showMoveNumbers=false, showNextMoves=settings, dragMode=false | high |
| W3-T02 | projectGobanProps(recall) returns showMoveNumbers=true, showNextMoves=false, showSiblings=false | critical |
| W3-T03 | projectGobanProps(analysis + editWS) returns dragMode=true, drawLineMode from selectedTool | high |
| W3-T04 | projectGobanProps(analysis + no editWS) returns dragMode=false, drawLineMode=null | high |
| W3-T05 | submitAttempt: Goban props projection changes from play to recall correctly | critical |
| W3-T06 | enterAnalysis: Goban props projection changes (gameTree, dragMode, drawLineMode) | critical |
| W3-T07 | returnFromAnalysis: Goban props restore to previous mode projection | critical |
| W3-T08 | switchTaskTab: Goban props re-projected from new tab | high |
| W3-T18 | play mode + playerConfig current side=AI → resolveBoardInteraction returns REJECTED | high |
| W3-T19 | submitAttempt: projectGobanProps re-projection shows recall start position | critical |
| W3-T21 | projectGobanProps with null gameTree returns safe defaults | medium |
| W3-T23 | play mode AI turn: projectGobanProps returns handler that rejects clicks | medium |

### 12.2 Wiring Tests (MUST_AUTOMATE)

| ID | Contract | Criticality |
| --- | --- | --- |
| W3-T09 | Container handleBoardVertexClick routes to resolveBoardInteraction with workbenchMode context | critical |
| W3-T10 | resolveBoardInteraction workbenchMode='play' + empty vertex → play-stone intent + playMove contract | critical |
| W3-T11 | resolveBoardInteraction workbenchMode='recall' + empty vertex → submit-recall-answer + recallAnswer | critical |
| W3-T12 | resolveBoardInteraction workbenchMode='problem' + vertex outside problemArea → REJECTED | high |
| W3-T20 | Container passes projectGobanProps result as boardProps to WorkbenchShell → MainBoardStage | high |

### 12.3 Architecture Boundary Tests (MUST_AUTOMATE)

| ID | Contract | Criticality |
| --- | --- | --- |
| W3-T13 | resolveBoardInteraction does not import sabaki.js or read global state | critical |
| W3-T14 | projectGobanProps does not call service/store/repository/adapter | critical |
| W3-T15 | MainBoardStage receives all board data and handlers via props, does not import services | high |
| W3-T22 | No command branches on origin.provider for Goban projection | high |

### 12.4 Side Effect Tests (MUST_AUTOMATE)

| ID | Contract | Criticality |
| --- | --- | --- |
| W3-T16 | play-stone executor writes to documentStore and attemptService but NOT to editWorkspace | high |
| W3-T17 | recall answer executor does NOT write to documentStore or game tree | critical |

### 12.5 Manual Acceptance Tests

| ID | Click Path | Verify |
| --- | --- | --- |
| W3-M01 | Play mode: click empty point → stone placed | Move recorded, tree position updates |
| W3-M02 | Play mode (AI config): set current player to AI → click board → no stone placed | Board read-only during AI turn |
| W3-M03 | Recall mode: click empty point → no game tree change | Recall answer recorded |
| W3-M04 | Play → Submit → observe board changes | showMoveNumbers on, ghost stones off, position at attempt start |
| W3-M05 | Play → Enter Analysis → observe board changes | dragMode on, can drag stones, can draw lines |
| W3-M06 | Analysis → Return → observe board changes | Back to original mode, dragMode off, position restored |
| W3-M07 | Multiple tabs: switch tab → board updates immediately | Mode, position, overlays all switch |
| W3-M08 | Recall mode: ghost stones hidden, move numbers shown | Overlay correct |

## 13. Not Tested

| Scope | Reason |
| --- | --- |
| MainBoardStage CSS/layout | Frontend visual workflow |
| Goban component internal rendering | Existing component, not workbench wiring scope |
| BoardOverlayStack internal overlay composition | Overlay pipeline separate workflow (GAP-G4) |
| Stone placement animation | Frontend visual workflow |
| Sound effect on play | Frontend behavior, not business contract |
| Legacy mode string fallback compatibility | Migration seam, exit condition defined |
| areaSelectMode full behavior | Deferred to W5 analysis wiring |
| Play variation hover replay | Deferred to W5 analysis wiring |
| Problem AI auto-reply full chain | Needs engine adapter ready |

## 14. Fragile Test Warnings

1. **projectGobanProps field-by-field assertions**: Don't test every field name exists. Test behavioral contracts: play dragMode=false, recall showMoveNumbers=true, analysis+editWS dragMode=true.
2. **Handler reference tests**: Don't test onVertexClick points to a specific function. Test that container handleBoardVertexClick routes correctly with workbenchMode.
3. **Resolver input field name tests**: Don't lock on workbenchMode field name. Test "click in play mode produces play-stone intent".
4. **Container internal method name tests**: Don't test handleBoardVertexClick method name. Test "board click event routed through container arrives at resolver with workbench context".
5. **projectGobanProps internal branch implementation**: Don't test if/else structure. Test "given mode=X, output.Y=Z".

## 15. Out of Scope

| Scope | Reason |
| --- | --- |
| Overlay pipeline WorkbenchMode wiring (GAP-G4) | W5 analysis wiring |
| Problem area visual indicator (GAP-G5) | Needs product decision |
| Recall progress visual indicator (GAP-G6) | Product unspecified |
| AI auto-move chain | Needs engine adapter |
| Full analysis mode scratch wiring | W5 scope |
| Board toolbar wiring | W5 scope |
| Edit position mode wiring | W5 scope |
| Problem mode full domain wiring (prompt/hint/referenceLines panel) | W3 problem panel wiring separate |
| Left panel internal controls | W3 scope but not goban wiring |
| Review queue wiring | W6 scope |

## 16. PROPOSED_GAP Summary

| ID | Description | Handling |
| --- | --- | --- |
| GAP-W3-01 | Play mode AI-turn read-only board needs currentPlayer | Container passes currentPlayer from documentStore adapter. MVP: if playerConfig current side is AI, projectGobanProps sets onVertexClick to no-op/reject |
| GAP-W3-02 | Problem area visual indicator not implemented | Deferred. Resolver has problemArea reject logic, but no board visual |
| GAP-W3-03 | Analysis mode full scratch wiring depends on editWorkspace adapter | W5 scope. W3 only ensures projectGobanProps returns correct analysis interactionProps |
| GAP-W3-04 | Recall start position retrieval from Attempt | Needs positionSnapshotAdapter or rebuild from Attempt.rootPositionSgf + userLine. MVP: container navigates to attempt root position |
| GAP-W3-05 | Legacy DEFERRED fallback exit condition | Exit when play/problem/recall/analysis WorkbenchMode branches all implemented, then remove legacy fallback |

## 17. v0.5 Conflict Check

| Check | Result | Evidence |
| --- | --- | --- |
| origin.provider as Goban projection branch | Not introduced | projectGobanProps reads workbenchMode and task fields only |
| source-specific open API as new primary path | Not introduced | W3 doesn't involve tab opening commands |
| snapshotService opens tabs | Not introduced | W3 doesn't change snapshot command path |
| Container directly writes store | Not introduced | Goban click goes through resolver → executor → service → store |
| UI component depends on service/store | Not introduced | MainBoardStage presentational, receives all data via props |
| resolver calls service | Not introduced | W3 extension only adds context fields to ResolverInput |
| projectGobanProps calls IO | Not introduced | Pure projection function, all inputs via parameters |
| recall writes game tree | Not introduced | recall mutationContract=recallAnswer, executor doesn't call documentStore |
| analysis writes Attempt.userLine | Not introduced | analysis mutationContract=scratchEdit, executor doesn't call attemptService |
| resolver uses legacy mode instead of WorkbenchMode | No | When workbenchMode present, uses it; absent → legacy fallback (migration seam) |
