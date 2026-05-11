# Position Source and Mutation Contract

Sabaki's workbench should not use `mode` as the lowest-level boundary for board
state. A workspace can still choose the default layout, controls, and
interaction surface, but board behavior must answer two smaller questions first:

- Where does the displayed position come from?
- Where may a board action write?

The first phase keeps the existing UI intact and defines the contract that
future work should implement against.

## PositionSource

`PositionSource` describes where the current board position is read from.

```ts
type PositionSource =
  | {kind: 'game-tree'; treePosition: TreePosition}
  | {kind: 'scratch'; snapshotId: string; role?: ScratchRole}

type ScratchRole = 'current' | 'reference' | 'problem-attempt'
```

- `game-tree`: The position comes from the current SGF game tree node.
- `scratch`: The position comes from a temporary snapshot that must not
  implicitly dirty the SGF tree.
- `role`: The purpose of the scratch position, such as the active analysis
  board, the comparison reference, or a problem attempt.

## ScratchPosition

Scratch positions extend the existing study snapshot shape. They intentionally
keep `signMap` so they remain compatible with `study.js`, `boardFromSnapshot`,
`snapshotToGameTree`, engine analysis, and overlay code.

```ts
type ScratchPosition = {
  id: string
  width: number
  height: number
  signMap: number[][]
  nextPlayer: 1 | -1
  role?: ScratchRole
  komi?: number
  rules?: string
  source?: {
    type: 'game-tree-node' | 'manual' | 'problem'
    id?: string
  }
}
```

Scratch positions may be analyzed, compared, overlaid, and saved as problem
material. By default they do not write back to the current SGF tree.

The current `editWorkspace.currentSnapshot` and
`editWorkspace.referenceSnapshot` are the phase-one scratch positions:

- `currentSnapshot` maps to `role: 'current'`.
- `referenceSnapshot` maps to `role: 'reference'`.
- `editWorkspace` remains as a compatibility name while the data model evolves.

## Mutation Contracts

### playMove

Used for real play.

Allowed:

- Write to the game tree.
- Record normal history.
- Update the current player.
- Trigger engine analysis or engine move generation.
- Create a variation when the current node already has a different continuation.

Forbidden:

- Mutating scratch positions.

### scratchEdit

Used for scratch analysis.

Allowed:

- Add black stones.
- Add white stones.
- Remove stones.
- Drag stones.
- Set the next player.
- Mutate scratch positions.
- Trigger engine analysis.
- Save a scratch position as a problem snapshot.

Forbidden:

- Writing to the current SGF game tree.
- Recording the change as real game history.
- Changing the current game-tree node.

### recallAnswer

Used for recall or training answers.

Allowed:

- Read the expected move from a problem or game record.
- Write to an attempt or session.
- Record correct, wrong, hint, or skipped answers.
- Advance training progress on correct answers.

Forbidden:

- Free board editing.
- Writing to the current SGF game tree.
- Mutating scratch setup.

### variationMove

Used for game-tree variation analysis.

Allowed:

- Start from a game-tree position.
- Write a game-tree variation, or later a temporary variation.
- Trigger analysis.
- Compare against the original position.

Forbidden:

- Sharing the same write path as `scratchEdit`.

## Workspace Defaults

| Workspace          | Position source                          | Mutation contract | Notes                                                                          |
| ------------------ | ---------------------------------------- | ----------------- | ------------------------------------------------------------------------------ |
| Play               | `game-tree`                              | `playMove`        | Simple overlays and play controls.                                             |
| Scratch analysis   | `scratch/current`                        | `scratchEdit`     | Current/reference scratch boards, territory compare, heatmaps, problem saving. |
| Variation analysis | `game-tree`                              | `variationMove`   | Phase one keeps the interface; full UI can come later.                         |
| Recall             | `game-tree` or `scratch/problem-attempt` | `recallAnswer`    | Answer-focused controls; overlays hidden by default.                           |

## Overlay Composition

Overlays consume positions; they never mutate positions.

```ts
type OverlayLayer = {
  id: string
  priority: number
  opacity: number
  hitTest: boolean
  source: 'ownership' | 'territoryDiff' | 'heatmap' | 'humanPreference'
  renderMode: 'paint' | 'marker' | 'tooltip' | 'sidebar'
}
```

Rules:

- Overlay input is derived from `PositionSource`: board, ownership, marker maps,
  paint maps, and analysis metadata.
- Multiple overlays compose by `priority` and `renderMode`.
- Existing `BoardOverlayStack`, `paintMap`, `markerMap`, and `composeMarkerMaps`
  remain the preferred implementation path.
- Overlay click or hover behavior may expose UI affordances, but must not mutate
  board state directly.

## Legacy Policy

Core workspaces remain:

- Play
- Recall and training
- Scratch analysis
- Variation analysis

Legacy areas are frozen or hidden from the product center:

- Scoring
- Estimator
- Find
- Guess
- Autoplay
- Native SGF edit tools

Phase one does not delete the legacy code. New workbench behavior should be
designed around `PositionSource` and mutation contracts instead of expanding
legacy modes.

## Phase-One Code Anchors

- `src/modules/position-contracts.ts` defines the shared TypeScript contract
  types and runtime helpers.
- `src/modules/study.js` preserves optional scratch metadata when cloning or
  deserializing snapshots.
- `src/modules/sabaki.js` seeds analysis workspace snapshots as scratch
  positions and exposes `playMove`, `scratchEdit`, `recallAnswer`, and
  `variationMove` method boundaries.
