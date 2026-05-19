# Goban Event Binding & Overlay State Matrix

Date: 2026-05-19
Status: draft

## 0. Purpose

This document defines how each `WorkbenchMode` controls Goban event bindings and overlay rendering. It is a wiring reference for Phase W3–W6 board interaction implementation.

Subordinate to:
- `docs/design/gabaki-sabaki-training-prd-v0.5.md`
- `docs/design/gabaki-sabaki-training-architecture-v0.5.md`

## 1. Goban Event Binding Matrix

### 1.1 Event Routing Chain

All vertex events flow through this chain:

```
BoundedGoban (Shudan) pointer event
  → gobantransformer.invert + transformVertex (display coords → logical coords)
  → Goban component handleVertexMouse{Down,Up,Move}
  → MainView.handleGobanVertexClick / handleGobanLineDraw / handleGobanAreaSelect
  → sabaki.clickVertex(vertex, {button, ctrlKey, altKey})
  → resolveBoardInteraction(resolverInput) → intent
  → executor → mode controller / service / adapter
```

Key code locations:
- Coordinate transform: `src/components/Goban.js` L31-48
- Intent resolver: `src/modules/workbench/board-interactions/resolveBoardInteraction.ts`
- Mode dispatch in legacy: `src/modules/sabaki.js` clickVertex (~L2373 play, ~L2553 scoring, ~L2581 recall, ~L2572 find)
- Handler prop wiring: `src/components/MainView.js` L391-442

### 1.2 Event Bindings by Mode

#### play

| Event | Condition | Intent | Executor Target |
|-------|-----------|--------|-----------------|
| Left-click empty | `playerConfig.current is human` | `play-stone` | `playInteractionExecutor` → `documentStore.playMove` |
| Left-click empty | `problemView.active` | problem move (intercept) | `problemModeController` |
| Right-click | any | context menu | legacy UI |
| Pass button | not a board event | `pass` | `playInteractionExecutor` |
| Area select (Ctrl/Alt+drag) | — | disabled | — |

Board is read-only when `playerConfig.current is ai`. No drag, no line draw, no area select.

#### problem

| Event | Condition | Intent | Executor Target |
|-------|-----------|--------|-----------------|
| Left-click empty | within problemArea (if set) | `play-stone` (problem move) | `problemModeController` → AI reply if opponent=ai |
| Left-click empty | outside problemArea | rejected or no-op | — |
| Right-click | any | context menu | legacy UI |
| Pass button | — | `pass` (problem pass) | `problemModeController` |

Problem AI constraint: if `playerConfig.problemOpponent === 'ai'` and `TrainingTask.problemArea` exists, AI moves must stay within problemArea. Service-level enforcement required, not just UI disable.

#### recall

| Event | Condition | Intent | Executor Target |
|-------|-----------|--------|-----------------|
| Left-click empty | correct next position | `submit-recall-answer` | `recallInteractionExecutor` → `trainingStore.submitRecallAnswer` |
| Left-click empty | wrong position | `submit-recall-answer` (wrong) | `recallInteractionExecutor` → mark incorrect |
| Left-click empty | during correction | `submit-correction` | `recallCheckpointService` |
| Right-click | — | disabled | — |
| Area select | — | disabled | — |

Recall mode MUST NOT modify the game tree. All recall answers are evaluated against expected moves, not written as formal moves.

#### analysis

Analysis has two sub-states: with editWorkspace and legacy (no editWorkspace).

**With editWorkspace** (primary workbench path):

| Event | Condition | Intent | Executor Target |
|-------|-----------|--------|-----------------|
| Left-click empty | tool=stone_1 | `place-black-stone` | `scratchEditInteractionExecutor` → editWorkspace |
| Left-click empty | tool=stone_-1 | `place-white-stone` | `scratchEditInteractionExecutor` → editWorkspace |
| Left-click empty | tool=eraser | `erase-stone` | `scratchEditInteractionExecutor` → editWorkspace |
| Left-click empty | tool=play | `play-stone` (scratch) | `scratchEditInteractionExecutor` → editWorkspace alternating |
| Left-click any | tool=cross/triangle/square/circle/label/number | `mark-point` | `scratchEditInteractionExecutor` → editWorkspace |
| Left-click stone + drag | dragMode=true | `drag-stone` | `scratchEditInteractionExecutor` → editWorkspace |
| Two-click start | tool=arrow/line | `draw-line` start | store firstVertex |
| Two-click end | tool=arrow/line | `draw-line` complete | `scratchEditInteractionExecutor` → editWorkspace.lines |
| Ctrl/Cmd+drag | areaSelectMode | add analysis area | `analysisAreaStore` |
| Alt+drag | areaSelectMode | remove analysis area | `analysisAreaStore` |
| Alt+right-click | — | clear all areas | `analysisAreaStore` |

**Legacy (no editWorkspace)**:

| Event | Condition | Intent | Executor Target |
|-------|-----------|--------|-----------------|
| Left-click | tool-based | `useTool` | legacy `sabaki.useTool` |
| Ctrl/Cmd+click | any | add coord to comment | legacy UI |
| Right-click | any | context menu | legacy UI |

Analysis hard rule: scratch/reference mutations MUST NOT modify frozen Attempt.userLine. Only Snapshot creates a new TrainingTask from exploration.

#### scoring / estimator

| Event | Condition | Intent | Executor Target |
|-------|-----------|--------|-----------------|
| Left-click stone | any | toggle dead chain | legacy `sabaki.clickVertex` → update deadStones |
| Left-click empty | — | no-op | — |
| Right-click | — | no-op | — |

Scoring and estimator are read-only for board position. Only dead-stone toggling is allowed.

#### find

| Event | Condition | Intent | Executor Target |
|-------|-----------|--------|-----------------|
| Left-click | any | toggle vertex selection | legacy `sabaki.findMove` |
| Right-click | — | no-op | — |

### 1.3 dragMode and drawLineMode Activation

From `src/components/MainView.js` L423-436:

```
dragMode = mode === 'analysis' && editWorkspaceActive
drawLineMode = mode === 'analysis' && ['arrow', 'line'].includes(selectedTool) ? selectedTool : null
```

Both are only active in analysis mode with editWorkspace. No other mode enables drag or line drawing.

### 1.4 Area Select Activation

Area select handlers are always bound (`MainView.handleGobanAreaSelect`), but meaningful only when:
- Mode is analysis (add/remove analysis areas)
- Mode is scoring/estimator (area-based scoring, future)

## 2. Overlay Rendering Matrix

### 2.1 Overlay Layers

The overlay system has four canonical layers (`src/modules/overlays/overlayLayers.ts`):

| Layer ID | Priority | Render Mode | Description |
|----------|----------|-------------|-------------|
| `ownership-paint` | 10 | paint | Semi-transparent territory coloring |
| `territory-diff-marker` | 20 | marker | Circular gain/loss indicators |
| `heatmap` | 30 | marker | AI move suggestion dots |
| `human-preference` | 40 | marker | Human prior move highlights |

Additional visual layers rendered directly by Goban component (not in overlayLayers):

| Layer | Description | Rendered In |
|-------|-------------|-------------|
| Ghost stones | Next moves, siblings, drag preview | `Goban.js` L579-640 |
| Move numbers | Numeric labels on stones | `Goban.js` L644-664 |
| Variation labels | Sequence labels during hover | `Goban.js` L670-693 |
| Lines/arrows | Drawn connections between vertices | `Goban.js` L556-576 |
| Dead stone dim | Semi-transparent dead stones | `MainView.js` L366, via `dimmedStones` prop |
| Area highlight | Dimmed non-scoring areas | `MainView.js` L369-389, via `paintMap` |

### 2.2 Overlay Data Flow

```
overlayStore (territoryEnabled, territoryCompareEnabled)
  + training facts (attempt, recall, analysis context)
  + analysis data (ownership, variations, humanPolicyMap)
  + board state (deadStones, analysisAreaVertices, lines)
       ↓
resolveOverlayInput.ts → normalize raw facts into ResolvedOverlayInput
       ↓
composeWorkbenchOverlays.ts → paintMap + markerMap + statusProps + className
       ↓
BoardOverlayStack component → subscribe to overlayStore, compose, pass to Goban
       ↓
Goban component → merge overlay paintMap/markerMap with internal heatmap/ghost/lines
       ↓
BoundedGoban (Shudan) → SVG rendering
```

### 2.3 Overlay Activation by Mode

#### play

| Overlay | Active | Condition | Data Source |
|---------|--------|-----------|-------------|
| Ghost stones (next) | ✅ | `showNextMoves` (default true) | `board.childrenInfo` |
| Ghost stones (siblings) | ✅ | `showSiblings` (default true) | `board.siblingsInfo` |
| Heatmap | ✅ | `showAnalysis` enabled | `analysis.variations` |
| Human preference | ✅ | `showHumanPreference` enabled | `analysis.humanPolicyMap` |
| Move numbers | ❌ | disabled in play mode | — |
| Territory paint | ❌ | — | — |
| Territory diff | ❌ | — | — |
| Lines/arrows | ❌ | — | — |
| Area highlight | ❌ | — | — |

#### problem

Same as play mode overlays, with additions:

| Overlay | Active | Condition | Data Source |
|---------|--------|-----------|-------------|
| Ghost stones (next) | ✅ | `showNextMoves` | `board.childrenInfo` |
| Heatmap | ✅ | `showAnalysis` enabled | `analysis.variations` |
| Move numbers | ❌ | disabled | — |
| Territory paint | ❌ | — | — |
| Problem area indicator | 🔶 | if `problemArea` set | `TrainingTask.problemArea` → area highlight or border |

PROPOSED_GAP: Problem area visual indicator (showing problemArea bounds on the board) is not yet implemented. Need to decide render approach: paintMap overlay vs. SVG border vs. vertex highlighting.

#### recall

| Overlay | Active | Condition | Data Source |
|---------|--------|-----------|-------------|
| Ghost stones | ❌ | no next move preview | — |
| Heatmap | ❌ | — | — |
| Move numbers | ✅ | default on | gameTree history |
| Territory paint | ❌ | — | — |
| Recall progress indicator | 🔶 | during recall session | `recallSession` progress → not yet implemented |

PROPOSED_GAP: Recall progress visual indicator (showing which moves are correct/incorrect on the board) is not yet specified. Need product decision on visual treatment.

#### analysis (with editWorkspace)

| Overlay | Active | Condition | Data Source |
|---------|--------|-----------|-------------|
| Ghost stones (next) | ✅ | `showNextMoves` | editWorkspace children |
| Ghost stones (siblings) | ✅ | `showSiblings` | editWorkspace siblings |
| Heatmap | ✅ | `showAnalysis` enabled | `analysis.variations` |
| Human preference | ✅ | `showHumanPreference` enabled | `analysis.humanPolicyMap` |
| Move numbers | ✅ | `showMoveNumbers` | editWorkspace node history |
| Territory paint | ✅ | `overlayStore.territoryEnabled` | `baselineOwnership` from AI analysis |
| Territory diff | ✅ | `overlayStore.territoryCompareEnabled` | ownership delta |
| Lines/arrows | ✅ | tool=arrow/line | `editWorkspace.lines` |
| Area highlight | ✅ | analysisAreaVertices set | `analysisAreaStore` |
| Temporary line | ✅ | during line drawing | `Goban.state.temporaryLine` |

Analysis mode has full overlay access.

#### analysis (legacy, no editWorkspace)

Same as analysis with editWorkspace, but territory/diff overlays depend on legacy analysis pipeline.

#### scoring / estimator

| Overlay | Active | Condition | Data Source |
|---------|--------|-----------|-------------|
| Ghost stones | ❌ | — | — |
| Heatmap | ❌ | — | — |
| Territory paint | ❌ | — | — |
| Move numbers | ❌ | — | — |
| Dead stone dim | ✅ | stones in `deadStones` array | `MainView` → `dimmedStones` prop |
| Area highlight | ✅ | areaMap computed from dead stones | `sabaki.state.areaMap` |

#### find

| Overlay | Active | Condition | Data Source |
|---------|--------|-----------|-------------|
| Ghost stones (next) | ✅ | `showNextMoves` | `board.childrenInfo` |
| Heatmap | ❌ | — | — |
| Move numbers | ❌ | — | — |
| Selected vertex highlight | ✅ | find vertex selected | `highlightVertices` prop |

## 3. Goban Props by Mode

This section lists which Goban props change based on WorkbenchMode. All props flow through `MainView.js` L391-442.

### 3.1 Event Handler Props

| Prop | play | problem | recall | analysis (editWS) | scoring | find |
|------|------|---------|--------|--------------------|---------|------|
| `onVertexClick` | ✅ play-stone | ✅ problem move | ✅ recall answer | ✅ tool-dependent | ✅ toggle dead | ✅ find vertex |
| `onLineDraw` | — | — | — | ✅ arrow/line tool | — | — |
| `onAreaSelect` | bound | bound | bound | ✅ | bound | bound |
| `onStoneDragEnd` | — | — | — | ✅ | — | — |
| `onPlayVariationMoves` | — | — | — | ✅ hover replay | — | — |
| `drawLineMode` | null | null | null | `'arrow'`/`'line'`/null | null | null |
| `dragMode` | false | false | false | true | false | false |

### 3.2 Overlay Display Props

| Prop | play | problem | recall | analysis (editWS) | scoring | find |
|------|------|---------|--------|--------------------|---------|------|
| `paintMap` | from overlayStack | from overlayStack | [] | from overlayStack | areaMap based | [] |
| `markerMap` | from overlayStack | from overlayStack | null | from overlayStack | null | null |
| `dimmedStones` | [] | [] | [] | [] | deadStones | [] |
| `analysis` | conditional | conditional | null | conditional | null | null |
| `showMoveNumbers` | false | false | true | setting | false | false |
| `showNextMoves` | setting | setting | false | setting | false | setting |
| `showSiblings` | setting | setting | false | setting | false | setting |
| `crosshair` | false | false | false | false | false | false |

### 3.3 Board State Props

| Prop | play | problem | recall | analysis | scoring | find |
|------|------|---------|--------|----------|---------|------|
| `gameTree` | formal tree | formal tree | formal tree (read-only) | editWorkspace tree | formal tree | formal tree |
| `treePosition` | current move | current move | recall start position | editWorkspace position | current move | current move |
| `board` | live board | live board | recall start board | editWorkspace board | live board | live board |

## 4. Mode Transition Effects on Goban

When WorkbenchMode transitions, Goban behavior changes atomically. The following transitions require specific Goban state updates:

### 4.1 submitAttempt (play/problem → recall)

| What changes | Before | After |
|--------------|--------|-------|
| Event binding | play-stone / problem move | submit-recall-answer |
| `showMoveNumbers` | false | true |
| `showNextMoves` | true | false |
| `showSiblings` | true | false |
| `gameTree` | formal tree | formal tree (read-only) |
| `treePosition` | current move | attempt start position |
| Overlays | heatmap/ghost active | move numbers only |

### 4.2 enterAnalysis (any → analysis)

| What changes | Before | After |
|--------------|--------|-------|
| Event binding | mode-specific | tool-dependent (stone/marker/line) |
| `dragMode` | false | true (if editWorkspace) |
| `drawLineMode` | null | depends on selectedTool |
| `gameTree` | formal tree | editWorkspace tree (snapshot of formal) |
| Overlays | mode-specific | full overlay access |

### 4.3 returnFromAnalysis (analysis → previousMode)

| What changes | Before | After |
|--------------|--------|-------|
| Event binding | tool-dependent | previousMode binding |
| `dragMode` | true | false |
| `drawLineMode` | tool-dependent | null |
| `gameTree` | editWorkspace tree | formal tree (restored) |
| `treePosition` | editWorkspace position | original position |
| Overlays | full | previousMode set |

### 4.4 snapshotCurrentContext (any → new tab)

Creates new tab. Source tab Goban state unchanged. New tab gets a board snapshot as its initial state.

### 4.5 switchTaskTab

| What changes | Effect |
|--------------|--------|
| `activeTabId` | All Goban props re-projected from new tab's mode/state |
| Event binding | Changes to new tab's mode binding |
| Overlays | Changes to new tab's overlay set |
| `gameTree` | Switches to new tab's tree |
| `treePosition` | Switches to new tab's position |

## 5. Wiring Ownership

### 5.1 Who Sets Goban Props

| Prop Category | Set By | Notes |
|---------------|--------|-------|
| `gameTree`, `treePosition`, `board` | `documentStore` / editWorkspace adapter | Board facts |
| `onVertexClick`, event handlers | `MainView` → `sabaki.clickVertex` → `resolveBoardInteraction` | Must migrate to workbench board interaction layer |
| `paintMap`, `markerMap` | `overlayStore` → `resolveOverlayInput` → `composeWorkbenchOverlays` | Overlay pipeline |
| `dimmedStones` | scoring/estimator dead stone computation | Mode-specific |
| `drawLineMode`, `dragMode` | `MainView` based on mode + tool | Must extend for WorkbenchMode |
| `showMoveNumbers`, `showNextMoves`, `showSiblings` | user settings + mode override | Settings |
| `analysis`, `analysisType` | `analysisService` / `analysisResultAdapter` | Engine data |

### 5.2 Current Gaps for Workbench Wiring

| Gap | Description | Blocking Phase |
|-----|-------------|----------------|
| GAP-G1 | `MainView` uses legacy `sabaki.state.mode` to determine `dragMode`/`drawLineMode`; needs WorkbenchMode awareness | W5 analysis wiring |
| GAP-G2 | `resolveBoardInteraction` uses legacy mode string; needs WorkbenchMode + tab context input | W3 problem, W4 recall, W5 analysis |
| GAP-G3 | No WorkbenchMode → overlay activation policy; overlays currently depend on legacy mode + overlayStore toggles only | W4 recall, W5 analysis |
| GAP-G4 | `paintMap`/`markerMap` from overlay pipeline not yet wired to WorkbenchMode-dependent activation | W5 analysis |
| GAP-G5 | Problem area visual indicator not implemented | W3 problem |
| GAP-G6 | Recall progress visual indicator not specified | W4 recall |
| GAP-G7 | Mode transition effects on Goban props (§4) not wired through workbenchStore subscriptions | W3–W6 |

### 5.3 Implementation Approach

Goban props should be computed from a projection function that takes WorkbenchMode + active tab state as input:

```
projectGobanProps(workbenchMode, activeTab, runtimeState, settings, analysisData, overlayComposition)
  → { eventHandlerProps, overlayDisplayProps, boardStateProps }
```

This projection lives in `TrainingWorkbenchContainer` or a dedicated ViewModel helper. It replaces the current scattered mode checks in `MainView`.

## 6. PROPOSED_GAP Summary

| ID | Description | Handling |
|----|-------------|----------|
| GAP-G1 | MainView dragMode/drawLineMode uses legacy mode | Extend MainView to read WorkbenchMode from workbenchStore when available |
| GAP-G2 | resolveBoardInteraction lacks WorkbenchMode context | Extend ResolverInput to include workbenchMode, taskId, playerConfig, problemArea |
| GAP-G3 | No WorkbenchMode → overlay activation policy | Add overlay activation rules to WorkbenchMode projection |
| GAP-G4 | Overlay pipeline not wired to WorkbenchMode | Wire overlay composition into WorkbenchMode projection |
| GAP-G5 | Problem area visual indicator | Add problemArea to paintMap or dedicated highlight layer |
| GAP-G6 | Recall progress visual indicator | Product decision needed; MVP: no board indicator, panel-only |
| GAP-G7 | Mode transition Goban prop updates | Wire through workbenchStore subscription + projection |
