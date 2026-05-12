# Workbench Phase 0 Behavior Baseline Tests

本文定义 workbench 迁移前必须固定的行为基线。它的目的不是证明旧实现设计正确，而是记录和保护当前可观察行为，确保后续把 `clickVertex()`、working position、resolver 和 executor 拆开时，同一场景下的用户结果不会悄悄改变。

## Testing Principle

每个行为基线测试都应该先用 contract 语言说明这次操作：

```txt
Scenario:
PositionSource:
MutationContract:
BoardInteractionIntent:
Action:
Expected writes:
Forbidden writes:
Visible result:
```

Phase 0 优先补 Playwright characterization tests。它们应该少而硬：覆盖用户会真实触发的关键闭环，并断言正确写入和禁止写入。不要在 Phase 0 用 Playwright 穷举所有工具、鼠标键、modifier 和点位状态。后续 `resolveBoardInteraction()` 落地后，组合矩阵应主要放在 resolver 单元测试中。

## Priority Levels

- `P0`: 迁移 `clickVertex()` 或 workbench 边界前必须固定。
- `P1`: 第一个 edit-analysis executor 稳定前应该固定。
- `P2`: 对 overlay、engine、菜单或 legacy 删除有帮助，但不阻塞 Phase 0。

## P0 Tests

| Scenario | Contract statement | Setup | Action | Expected writes | Forbidden writes | Visible result |
| --- | --- | --- | --- | --- | --- | --- |
| Play mode places a real move | `game-tree + playMove + play-stone` | Empty or known game tree, `mode = play` | Left-click an empty vertex | Game tree gets a new move node; `treePosition` advances; current player flips | `editWorkspace` and working snapshots are not created or changed | Board shows the new stone at the clicked vertex |
| Analysis workspace seeds from current game tree | `scratch/current + scratchEdit + enter-edit-analysis` | Known game-tree position | Switch to `analysis` | `editWorkspace.currentSnapshot` is created from the current board; source metadata points at the current tree node when available | Current SGF tree is not changed | Board still displays the same position after entering analysis |
| Analysis `stone_1` places black in working position | `scratch/current + scratchEdit + place-black-stone` | `mode = analysis`, edit workspace active, `selectedTool = stone_1` | Left-click an empty vertex | `currentSnapshot.signMap` changes at that vertex | Game tree, `treePosition`, and real history are unchanged | Board shows a black stone |
| Analysis `stone_-1` places white in working position | `scratch/current + scratchEdit + place-white-stone` | `mode = analysis`, edit workspace active, `selectedTool = stone_-1` | Left-click an empty vertex | `currentSnapshot.signMap` changes at that vertex | Game tree, `treePosition`, and real history are unchanged | Board shows a white stone |
| Analysis `eraser` removes from working position | `scratch/current + scratchEdit + erase-stone` | `mode = analysis`, edit workspace active, a working-position stone exists, `selectedTool = eraser` | Left-click the occupied vertex | `currentSnapshot.signMap` becomes `0` at that vertex | Game tree and `treePosition` are unchanged | Board no longer shows a stone there |
| Analysis `play` tool uses working next player | `scratch/current + scratchEdit + place-next-player-stone` | `mode = analysis`, edit workspace active, `selectedTool = play`, known `currentSnapshot.nextPlayer` | Left-click an empty vertex | Stone is placed with `nextPlayer`; `nextPlayer` flips | Game tree, `treePosition`, and real history are unchanged | Board shows the placed stone with the expected color |
| Recall correct click submits an answer | `game-tree/problem-attempt + recallAnswer + submit-recall-answer` | Recall session with one expected move | Click the expected vertex | `recallUserAttempts` records a correct answer; `recallMoveIndex` advances; recall navigation may advance `treePosition` | No free-edit stone is inserted outside recall flow; `editWorkspace` is not changed | Recall progress advances |
| Recall wrong click records a wrong answer | `game-tree/problem-attempt + recallAnswer + submit-recall-answer` | Recall session with one expected move | Click a different vertex | `recallUserAttempts` records a wrong answer; `recallMoveIndex` does not advance | Game tree is not freely edited; `editWorkspace` is not changed | Recall remains on the same answer step |

## P1 Tests

| Scenario | Contract statement | Setup | Action | Expected writes | Forbidden writes | Visible result |
| --- | --- | --- | --- | --- | --- | --- |
| Analysis edits reference tab only | `scratch/reference + scratchEdit + place-black-stone` | Analysis workspace with `referenceSnapshot`, active tab `reference` | Use a stone tool on an empty point | `referenceSnapshot.signMap` changes | `currentSnapshot` and game tree are unchanged | Reference preview or active board reflects the edit |
| Analysis captures reference without dirtying game tree | `scratch/reference + scratchEdit + capture-reference` | Analysis workspace with a current snapshot | Capture reference | `referenceSnapshot` is created or replaced | Game tree and real history are unchanged | Reference UI becomes available |
| Analysis marker tools write marker maps only | `scratch/current + scratchEdit + mark-point` | Analysis workspace, marker tool selected | Click a vertex | Current marker map changes | Snapshot stones and game tree are unchanged | Marker appears on board |
| Analysis line/arrow writes edit lines only | `scratch/current + scratchEdit + draw-line` | Analysis workspace, line or arrow tool selected | Draw between two vertices with the rendered board mouse gesture | Current lines list changes | Snapshot stones and game tree are unchanged | Line or arrow appears on board |
| Analysis drag moves only working-position stones | `scratch/current + scratchEdit + drag-stone` | Analysis workspace with a working-position stone | Drag the rendered stone to an empty vertex | Working snapshot source and target points change | Game tree is unchanged | Stone appears at the new point |

## P2 Tests

| Scenario | Contract statement | Setup | Action | Expected writes | Forbidden writes | Visible result |
| --- | --- | --- | --- | --- | --- | --- |
| Scoring toggles dead stones | `legacy + legacy-toggle-dead-stone` | `mode = scoring`, board has stones | Click an occupied vertex | `deadStones` toggles the related stones | Game tree is unchanged | Stones are dimmed or restored |
| Estimator toggles dead stones | `legacy + legacy-toggle-dead-stone` | `mode = estimator`, board has stones | Click an occupied vertex | `deadStones` toggles the chain | Game tree is unchanged | Stones are dimmed or restored |
| Find click sets and clears find vertex | `legacy + legacy-find-point` | `mode = find` | Click a vertex, then click it again | `findVertex` is set, then cleared | Game tree and working snapshots are unchanged | Highlight appears, then disappears |
| Analysis right-click stone tool toggles color behavior | `scratch/current + scratchEdit + place-opposite-stone` | Analysis workspace, `selectedTool = stone_1` or `stone_-1` | Right-click an empty vertex | Working snapshot receives the opposite color according to current behavior | Game tree is unchanged | Board shows the expected opposite-color stone |
| Native SGF edit stays legacy | `legacy + legacy-sgf-edit` | A real user-reachable legacy edit affordance, if one remains | Use the legacy affordance without corrupting state | Existing SGF edit behavior remains available where supported | New workbench paths are not invoked | Existing visible behavior is unchanged |

## Baseline Assertion Checklist

For every P0/P1 Playwright test, prefer capturing both positive and negative state:

```txt
beforeTreeSignature
beforeTreePosition
beforeCurrentSnapshot
beforeReferenceSnapshot
beforeRecallState
```

Then assert the expected write changed and forbidden writes stayed stable. For example, analysis stone placement should assert:

- `editWorkspace.currentSnapshot.signMap[y][x]` changed.
- The board visibly shows the new stone.
- The game-tree signature or root/current node data did not change.
- `treePosition` did not advance.

Play mode should assert the inverse:

- The game tree changed and `treePosition` advanced.
- The visible board shows the new stone.
- `editWorkspace` was not created or mutated.

Recall should account for current behavior: a correct answer may navigate forward through the game tree. The forbidden write is not "treePosition never changes"; it is "recall does not perform free board editing or scratch editing."

Gesture baselines must use the real rendered-board path. A line test should
dispatch the same mouse gesture that causes `onLineDraw`; a drag test should
dispatch the same mouse gesture that causes `onStoneDragEnd`. Do not model those
behaviors by calling lower-level edit helpers in sequence.

Legacy fallback baselines should not manufacture impossible app state. Clearing
`editWorkspace` after entering analysis protects an implementation escape hatch,
not a user contract. Keep that path skipped or move it to a lower-level
compatibility test until it can be deleted.

## Out of Scope for Phase 0

Do not block Phase 0 on exhaustive tests for:

- Engine attach/detach and analysis result quality.
- Overlay color blending or exact heatmap values.
- Every marker, label, number, line, and arrow variant.
- Every right-click menu branch and dialog.
- Full legacy feature modernization.

Those tests should be added when the corresponding executor, overlay input contract, or legacy deletion work begins.
