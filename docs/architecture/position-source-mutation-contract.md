# Position Source and Mutation Contract

Sabaki's workbench should not use `mode` as the lowest-level boundary for board
state. A workspace can still choose the default layout, controls, and
interaction surface, but board behavior must answer two smaller questions first:

- Where does the displayed position come from?
- Where may a board action write?

The upper-level truth is still the workbench mode state machine. The relationship
between the documents is:

```txt
ModeState / TransitionEffect
  -> derive PositionSource + MutationContract
  -> boardInteractionResolver
  -> focused executor
```

`WorkbenchMode.problem` is a first-class workbench mode. `Problem` the entity is
not a mode; it is the persisted training object that can be opened in
`WorkbenchMode.problem`.

The first phase keeps the existing UI intact and defines the contract that
future work should implement against.

## PositionSource

`PositionSource` describes where the current board position is read from.

```ts
type PositionSource =
  | {kind: 'game-tree'; treePosition: TreePosition}
  | {kind: 'scratch'; snapshotId: string; role?: WorkingPositionRole}

type WorkingPositionRole = 'current' | 'reference' | 'problem-attempt'
```

- `game-tree`: The position comes from the current SGF game tree node.
- `scratch`: Legacy code name for a temporary working snapshot that must not
  implicitly dirty the SGF tree.
- `role`: The purpose of the working position, such as the active analysis
  board, the comparison reference, or a problem attempt.

## WorkingPosition

Working positions extend the existing study snapshot shape. They intentionally
keep `signMap` so they remain compatible with `study.js`, `boardFromSnapshot`,
`snapshotToGameTree`, engine analysis, and overlay code.

```ts
type WorkingPosition = {
  id: string
  width: number
  height: number
  signMap: number[][]
  nextPlayer: 1 | -1
  role?: WorkingPositionRole
  komi?: number
  rules?: string
  source?: {
    type: 'game-tree-node' | 'manual' | 'problem'
    id?: string
  }
}
```

Working positions may be analyzed, compared, overlaid, and saved as problem
material. By default they do not write back to the current SGF tree.

The current `editWorkspace.currentSnapshot` and
`editWorkspace.referenceSnapshot` are the phase-one working positions:

- `currentSnapshot` maps to `role: 'current'`.
- `referenceSnapshot` maps to `role: 'reference'`.
- `editWorkspace` remains as a compatibility name while the data model evolves.
- Existing code may still use `ScratchPosition`, `SCRATCH_ROLES`, and
  `scratchEdit`; new design language should use working position for the data
  shape and `scratchEdit` for the write boundary.

## Mutation Contracts

```ts
type MutationContract =
  | 'playMove'
  | 'problemAttemptMove'
  | 'recallAnswer'
  | 'scratchEdit'
  | 'variationMove'
```

### playMove

Used for real play.

Allowed:

- Write to the game tree.
- Record normal history.
- Update the current player.
- Trigger engine analysis or engine move generation.
- Create a variation when the current node already has a different continuation.

Forbidden:

- Mutating working positions.
- Writing recall sessions or problem runtime.

### problemAttemptMove

Used when the user is solving a problem in `WorkbenchMode.problem`.

Allowed:

- Read the problem start position from a game tree node or a
  `scratch/problem-attempt` working position.
- Write the mutable problem Attempt while it is still `playing`.
- Update problem runtime companion state such as `problemView`, eval cache,
  pending move evaluations, and visible bad move ids.
- Trigger problem move evaluation and bad-move detection.
- On submit, freeze/finalize the Attempt and hand off to the mode transition
  that creates a RecallSession when applicable.

Forbidden:

- Writing RecallSession, RecallAttempt, RecallCheckpoint, or MoveComment.
- Mutating a frozen Attempt.
- Writing analysis scratch workspace state.
- Reusing `playMove` as the only write path; problem attempts must preserve
  Attempt/runtime ownership even when they temporarily write a game-tree node
  for legacy board display.

### scratchEdit

Used for scratch/edit analysis.

Allowed:

- Add black stones.
- Add white stones.
- Remove stones.
- Drag stones.
- Set the next player.
- Mutate working positions.
- Trigger engine analysis.
- Save a working position as a problem snapshot.

Forbidden:

- Writing to the current SGF game tree.
- Recording the change as real game history.
- Changing the current game-tree node.

### recallAnswer

Used for recall or training answers.

Allowed:

- Read the expected move from a problem or game record.
- Write RecallSession / RecallAttempt progress.
- Record correct, wrong, hint, or skipped answers.
- Advance training progress on correct answers.

Forbidden:

- Free board editing.
- Writing to the current SGF game tree.
- Mutating edit setup.
- Modifying the source Attempt's `userLine`, `result`, or `status`.

### variationMove

Used for game-tree variation analysis.

Allowed:

- Start from a game-tree position.
- Write a game-tree variation, or later a temporary variation.
- Trigger analysis.
- Compare against the original position.

Forbidden:

- Sharing the same write path as `scratchEdit`.

## BoardInteractionIntent and Dispatch

Contracts do not remove dispatch. A board event must still be routed to code
that can perform the requested action. The goal is to move from one large
`mode` branch that understands every feature to a small routing step followed
by focused executors.

`BoardInteractionIntent` describes what the raw input means after considering
workspace, selected tool, mouse button, board cell state, and modifiers.
Examples:

- `play-stone`
- `place-black-stone`
- `place-white-stone`
- `erase-stone`
- `drag-stone`
- `mark-point`
- `draw-line`
- `submit-problem-move`
- `submit-recall-answer`
- `open-variation-menu`
- `legacy-toggle-dead-stone`

`MutationContract` describes where an accepted intent is allowed to write. One
mutation contract can own many intents. For example, `scratchEdit` may include
stone placement, erasing, dragging, markers, labels, lines, next-player changes,
and reference-snapshot updates, but all of those writes stay inside working
positions or scratch/edit state.

Recommended routing shape:

```txt
Goban raw event
  -> boardInteractionResolver
  -> BoardInteractionIntent + PositionSource + MutationContract
  -> focused executor
```

Executor ownership:

| Executor | Owns | Must not own |
| --- | --- | --- |
| `playInteractionExecutor` | Real moves, game-tree writes, play analysis refresh | Scratch markers, recall attempts |
| `problemInteractionExecutor` | Problem attempt moves, mutable Attempt writes before submit, problem runtime, evaluation handoff | RecallSession writes, frozen Attempt writes, scratch analysis workspace |
| `scratchEditInteractionExecutor` | Working positions, edit markers/lines, scratch analysis refresh | Current SGF game-tree writes |
| `recallInteractionExecutor` | Answer attempts, hints, skipped/correct/wrong progress | Free board editing |
| `variationInteractionExecutor` | Variation writes or future temporary variations | Scratch setup writes |
| `legacyInteractionExecutor` | Unmigrated scoring, estimator, find, guess, autoplay, native SGF edit | New workbench behavior |

If code still exposes an `InteractionContract`, treat it as compatibility
metadata or a derived description of post-write effects. It should not become a
second primary dispatch key. Analysis, overlay, and UI refreshes should either
live in the focused executor that owns the write or be returned by that executor
as explicit effects.

Anti-goal:

```txt
raw event
  -> mutation contract
  -> one central switch that implements every mode again
```

That shape recreates the current `clickVertex` problem with new names. The
module split is valuable only when the resolver is pure and the write/effect
logic moves behind executor boundaries.

## Workspace Defaults

| Workspace          | Position source                          | Mutation contract | Notes                                                                          |
| ------------------ | ---------------------------------------- | ----------------- | ------------------------------------------------------------------------------ |
| Play               | `game-tree`                              | `playMove`        | Simple overlays and play controls.                                             |
| Problem            | `game-tree` or `scratch/problem-attempt` | `problemAttemptMove` | Doing a problem; mutable Attempt plus problem runtime until submit.          |
| Edit analysis      | `scratch/current`                        | `scratchEdit`     | Current/reference working boards, territory compare, heatmaps, problem saving. |
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
- Problem
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
- `src/modules/study.js` preserves optional working-position metadata when cloning or
  deserializing snapshots.
- `src/modules/sabaki.js` seeds analysis workspace snapshots as working
  positions and exposes `playMove`, `scratchEdit`, `recallAnswer`, and
  `problemAttemptMove` / `variationMove` method boundaries.
