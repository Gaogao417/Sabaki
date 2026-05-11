export type TreePosition = string

export type ScratchRole = 'current' | 'reference' | 'problem-attempt'

export type GameTreePositionSource = {
  kind: 'game-tree'
  treePosition: TreePosition
}

export type ScratchPositionSource = {
  kind: 'scratch'
  snapshotId: string
  role?: ScratchRole
}

export type PositionSource = GameTreePositionSource | ScratchPositionSource

export type ScratchPositionOrigin = {
  type: 'game-tree-node' | 'manual' | 'problem'
  id?: string
}

export type ScratchPosition = {
  id: string
  width: number
  height: number
  signMap: number[][]
  nextPlayer: 1 | -1
  role?: ScratchRole
  komi?: number
  rules?: string
  source?: ScratchPositionOrigin
}

export type MutationContract =
  | 'playMove'
  | 'scratchEdit'
  | 'recallAnswer'
  | 'variationMove'

export type InteractionContractId = MutationContract

/**
 * Which durable state a committed interaction is allowed to write.
 *
 * - game-tree: A normal played move updates the SGF tree/current line.
 * - scratch-position: A setup/edit operation updates only the scratch snapshot.
 * - training-attempt: A recall answer updates attempt/session progress.
 * - game-tree-variation: A candidate move updates a variation branch, not the
 *   main play line.
 * - none: Read-only interactions such as hover/selection do not write board
 *   state.
 */
export type InteractionBoardUpdate =
  | 'game-tree'
  | 'scratch-position'
  | 'training-attempt'
  | 'game-tree-variation'
  | 'none'

/**
 * Which analysis or feedback pipeline should run after the write.
 *
 * - refresh-game-tree-analysis: Re-analyze the active game-tree node or
 *   variation.
 * - refresh-scratch-analysis: Re-analyze the scratch current/reference board.
 * - refresh-recall-feedback: Recompute answer correctness, hint, progress, or
 *   completion state.
 * - none: The interaction does not require analysis/feedback refresh.
 */
export type InteractionAnalysisUpdate =
  | 'refresh-game-tree-analysis'
  | 'refresh-scratch-analysis'
  | 'refresh-recall-feedback'
  | 'none'

/**
 * How overlays should react once board/analysis state has changed.
 *
 * - derive-from-active-position: Show helpers for the current game-tree or
 *   variation position.
 * - derive-from-current-reference: Show scratch overlays derived from current
 *   and optional reference snapshots.
 * - clear-or-hide: Hide/clear overlays when they would reveal training answers
 *   or no longer match the task.
 * - preserve: Keep the current overlay display unchanged.
 */
export type InteractionOverlayUpdate =
  | 'derive-from-active-position'
  | 'derive-from-current-reference'
  | 'clear-or-hide'
  | 'preserve'

/**
 * Contract for one committed board/workbench interaction.
 *
 * Read this as "when the user finishes one meaningful operation, which state
 * pipeline should run?" It is deliberately about state updates, not raw input
 * gestures. A click, drag, toolbar action, or answer submission can all end up
 * using one of these contracts once the UI has interpreted the input.
 *
 * Field meanings:
 * - id: Product-level operation name, used by older helpers as the mutation id.
 * - boardUpdate: Which durable board/session state this operation is allowed to
 *   write.
 * - analysisUpdate: Which analysis or feedback result should refresh after the
 *   write.
 * - overlayUpdate: How visible helper layers should react after the new state is
 *   available.
 */
export type InteractionContract = {
  id: InteractionContractId
  boardUpdate: InteractionBoardUpdate
  analysisUpdate: InteractionAnalysisUpdate
  overlayUpdate: InteractionOverlayUpdate
}

export type WorkspaceKind =
  | 'play'
  | 'scratch-analysis'
  | 'variation-analysis'
  | 'recall'

export type OverlayLayerSource =
  | 'ownership'
  | 'territoryDiff'
  | 'heatmap'
  | 'humanPreference'

export type OverlayRenderMode = 'paint' | 'marker' | 'tooltip' | 'sidebar'

export type OverlayLayer = {
  id: string
  priority: number
  opacity: number
  hitTest: boolean
  source: OverlayLayerSource
  renderMode: OverlayRenderMode
}

/** Loose-shaped snapshot used as input; sign values are not yet normalized. */
type BoardSnapshot = {
  id?: string
  width: number
  height: number
  signMap: unknown[][]
  nextPlayer?: number
  role?: ScratchRole
  komi?: number
  rules?: string
  source?: ScratchPositionOrigin
}

type ScratchPositionInput = Omit<ScratchPosition, 'signMap' | 'nextPlayer'> & {
  signMap: unknown[][]
  nextPlayer?: number
}

/**
 * Minimal shape of Sabaki state needed to derive workspace kind, position source,
 * and interaction contract. Mode-to-workspace mapping:
 *   'play' | 'autoplay' -> PLAY
 *   'analysis'          -> SCRATCH_ANALYSIS
 *   'recall'            -> RECALL
 *   anything else       -> null
 */
type SabakiStateLike = {
  mode?: string
  treePosition?: TreePosition
  editWorkspace?: {
    activeTab?: ScratchRole
    currentSnapshot?: ScratchPosition | null
    referenceSnapshot?: ScratchPosition | null
  } | null
}

/**
 * Roles for scratch positions used by workbench flows.
 *
 * - CURRENT - The primary scratch board where the user edits and analyzes.
 * - REFERENCE - A comparison snapshot for territory/ownership diff overlays.
 * - PROBLEM_ATTEMPT - A scratch board scoped to a problem-solving attempt. Reserved
 *   for future use; not yet consumed in production code.
 *
 * Note: `editWorkspace.activeTab` still uses raw strings ('current' / 'reference')
 * in several call sites. Migration to these constants is ongoing.
 */
export const SCRATCH_ROLES = Object.freeze({
  CURRENT: 'current',
  REFERENCE: 'reference',
  PROBLEM_ATTEMPT: 'problem-attempt',
} as const)

/**
 * Legacy write-permission contract ids.
 *
 * New workbench code should prefer `INTERACTION_CONTRACTS`, which describes the
 * full state-update pipeline after a committed interaction. These ids remain as
 * the low-level board/session write names so older call sites can migrate in
 * small steps.
 *
 * Do not extend this as the primary abstraction; add/update an
 * `InteractionContract` instead.
 */
export const MUTATION_CONTRACTS = Object.freeze({
  PLAY_MOVE: 'playMove',
  SCRATCH_EDIT: 'scratchEdit',
  RECALL_ANSWER: 'recallAnswer',
  VARIATION_MOVE: 'variationMove',
} as const)

/**
 * Interaction contracts - state-update pipelines for committed interactions.
 *
 * This layer answers what happens after an interaction is accepted: which board
 * state may change, which analysis should refresh, and how overlays should
 * respond. Raw click/drag interpretation can still be implemented by dedicated
 * interaction handlers, but workspace defaults should point here rather than to
 * a growing board mode enum.
 *
 * Operation meanings:
 * - PLAY_MOVE: The user plays a normal move in a real game/review line. The move
 *   becomes part of the SGF game tree; engine analysis and overlays follow the
 *   new active game-tree node.
 * - SCRATCH_EDIT: The user edits a scratch board for study, such as placing a
 *   black/white stone, removing a stone, dragging a setup stone, changing the
 *   next player, or editing the reference board. The current SGF tree must not
 *   be changed; scratch analysis and current/reference overlays are refreshed.
 * - RECALL_ANSWER: The user submits an answer during recall/training. The click
 *   is recorded as an attempt/session result instead of a free board edit;
 *   recall feedback updates, and normal analysis overlays are hidden or cleared
 *   so they do not leak the answer.
 * - VARIATION_MOVE: The user tries a candidate move from a game-tree position.
 *   This is not scratch setup: it writes a game-tree variation, or later a
 *   temporary variation branch, then refreshes variation/game-tree analysis.
 */
export const INTERACTION_CONTRACTS = Object.freeze({
  PLAY_MOVE: {
    id: 'playMove',
    boardUpdate: 'game-tree',
    analysisUpdate: 'refresh-game-tree-analysis',
    overlayUpdate: 'derive-from-active-position',
  },
  SCRATCH_EDIT: {
    id: 'scratchEdit',
    boardUpdate: 'scratch-position',
    analysisUpdate: 'refresh-scratch-analysis',
    overlayUpdate: 'derive-from-current-reference',
  },
  RECALL_ANSWER: {
    id: 'recallAnswer',
    boardUpdate: 'training-attempt',
    analysisUpdate: 'refresh-recall-feedback',
    overlayUpdate: 'clear-or-hide',
  },
  VARIATION_MOVE: {
    id: 'variationMove',
    boardUpdate: 'game-tree-variation',
    analysisUpdate: 'refresh-game-tree-analysis',
    overlayUpdate: 'derive-from-active-position',
  },
} as const satisfies Record<string, InteractionContract>)

/**
 * Workspace kinds - top-level task presets.
 *
 * Three layers stay intentionally separate:
 * - Workspace: what task the user is doing.
 * - InteractionContract: how a committed action updates board, analysis, and
 *   overlay state.
 * - Overlay display/preset: what auxiliary information is visible.
 *
 * A workspace may select defaults for those layers, but it must not become the
 * board write boundary itself.
 *
 * Implicit mode -> workspace mapping (see `getWorkspaceKindFromState`):
 *   state.mode 'play'      -> PLAY
 *   state.mode 'analysis'  -> SCRATCH_ANALYSIS
 *   state.mode 'recall'    -> RECALL
 *   (no mode maps to VARIATION_ANALYSIS yet)
 *
 * Note: `state.mode 'problem'` has a full implementation in sabaki.js
 * (startProblem / handleProblemMove) but is not yet mapped to a dedicated
 * workspace kind. Decision deferred.
 */
export const WORKSPACE_KINDS = Object.freeze({
  PLAY: 'play',
  SCRATCH_ANALYSIS: 'scratch-analysis',
  VARIATION_ANALYSIS: 'variation-analysis',
  RECALL: 'recall',
} as const)

/**
 * Overlay data-source types - what kind of analysis data feeds an overlay layer.
 *
 * - OWNERSHIP - KataGo ownership percentages per vertex.
 * - TERRITORY_DIFF - Territory difference between current and reference snapshots.
 * - HEATMAP - AI candidate-move heatmap (policy probability distribution).
 * - HUMAN_PREFERENCE - HumanSL human-player preference map (policy distribution).
 *
 * Phase 5 (defined, not yet imported): These values exist in the codebase as raw
 * strings (enginesyncer.js, Goban.js, sabaki.js) but are not yet referenced
 * through this constant. Will be wired up when the overlay composition layer is
 * implemented.
 */
export const OVERLAY_LAYER_SOURCES = Object.freeze({
  OWNERSHIP: 'ownership',
  TERRITORY_DIFF: 'territoryDiff',
  HEATMAP: 'heatmap',
  HUMAN_PREFERENCE: 'humanPreference',
} as const)

/**
 * Overlay rendering modes - how an overlay layer is visually presented on the board.
 *
 * - PAINT - Canvas fill with per-vertex colors (e.g. ownership heat colors).
 * - MARKER - Board markers such as candidate-point circles or move labels.
 * - TOOLTIP - Hover-triggered popup showing precise data for a single vertex.
 * - SIDEBAR - Data displayed in a side panel instead of on the board canvas.
 *
 * Phase 5 (defined, not yet imported): The current code uses different rendering
 * paths (paintMap / markerMap arrays, component props) rather than string dispatch.
 * Will be wired up when the overlay composition layer is implemented.
 */
export const OVERLAY_RENDER_MODES = Object.freeze({
  PAINT: 'paint',
  MARKER: 'marker',
  TOOLTIP: 'tooltip',
  SIDEBAR: 'sidebar',
} as const)

/**
 * Default contracts for each workspace.
 *
 * This preserves the three-layer split:
 * - workspace: what task the user is doing;
 * - interactionContract: how committed actions update board, analysis, overlay;
 * - overlay display/preset: what auxiliary information is visible.
 *
 * Overlay defaults are intentionally not encoded here yet. Phase 5 should add a
 * separate overlay preset contract instead of folding display state into the
 * workspace or interaction contract.
 */
export const WORKSPACE_DEFAULTS = Object.freeze({
  [WORKSPACE_KINDS.PLAY]: {
    positionSourceKind: 'game-tree',
    interactionContract: INTERACTION_CONTRACTS.PLAY_MOVE,
  },
  [WORKSPACE_KINDS.SCRATCH_ANALYSIS]: {
    positionSourceKind: 'scratch',
    interactionContract: INTERACTION_CONTRACTS.SCRATCH_EDIT,
  },
  [WORKSPACE_KINDS.VARIATION_ANALYSIS]: {
    positionSourceKind: 'game-tree',
    interactionContract: INTERACTION_CONTRACTS.VARIATION_MOVE,
  },
  [WORKSPACE_KINDS.RECALL]: {
    positionSourceKind: 'game-tree',
    interactionContract: INTERACTION_CONTRACTS.RECALL_ANSWER,
  },
} satisfies Record<
  WorkspaceKind,
  {
    positionSourceKind: PositionSource['kind']
    interactionContract: InteractionContract
  }
>)

function cloneSignMap(signMap: unknown[][]): number[][] {
  return signMap.map((row) =>
    row.map((value) => {
      let sign = Number(value)
      return sign > 0 ? 1 : sign < 0 ? -1 : 0
    }),
  )
}

function normalizePlayer(sign: number | undefined): 1 | -1 {
  return sign === -1 ? -1 : 1
}

function copyScratchMetadata(
  target: ScratchPosition,
  source: Partial<ScratchPosition>,
): void {
  if (source.role != null) target.role = source.role
  if (source.komi != null) target.komi = source.komi
  if (source.rules != null) target.rules = source.rules

  if (source.source != null) {
    target.source = {...source.source}
  }
}

export function createGameTreePositionSource(
  treePosition: TreePosition,
): GameTreePositionSource {
  return {kind: 'game-tree', treePosition}
}

export function createScratchPositionSource(
  snapshotId: string,
  role: ScratchRole | null = null,
): ScratchPositionSource {
  return {
    kind: 'scratch',
    snapshotId,
    ...(role == null ? null : {role}),
  }
}

export function createScratchPosition({
  id,
  width,
  height,
  signMap,
  nextPlayer = 1,
  role,
  komi,
  rules,
  source,
}: ScratchPositionInput): ScratchPosition {
  let position: ScratchPosition = {
    id,
    width,
    height,
    signMap: cloneSignMap(signMap),
    nextPlayer: normalizePlayer(nextPlayer),
  }

  copyScratchMetadata(position, {role, komi, rules, source})
  return position
}

export function createScratchPositionFromSnapshot(
  snapshot: BoardSnapshot | null,
  options: Partial<ScratchPosition> = {},
): ScratchPosition | null {
  if (snapshot == null) return null

  let id = options.id ?? snapshot.id
  if (id == null) return null

  return createScratchPosition({
    id,
    width: snapshot.width,
    height: snapshot.height,
    signMap: snapshot.signMap,
    nextPlayer: options.nextPlayer ?? snapshot.nextPlayer,
    role: options.role ?? snapshot.role,
    komi: options.komi ?? snapshot.komi,
    rules: options.rules ?? snapshot.rules,
    source: options.source ?? snapshot.source,
  })
}

export function snapshotFromScratchPosition(
  position: ScratchPosition | null,
): ScratchPosition | null {
  if (position == null) return null

  return createScratchPositionFromSnapshot(position)
}

export function getInteractionContractForWorkspace(
  workspaceKind: WorkspaceKind | null,
): InteractionContract | null {
  return workspaceKind == null
    ? null
    : (WORKSPACE_DEFAULTS[workspaceKind]?.interactionContract ?? null)
}

export function getMutationContractForWorkspace(
  workspaceKind: WorkspaceKind | null,
): MutationContract | null {
  return getInteractionContractForWorkspace(workspaceKind)?.id ?? null
}

export function getWorkspaceKindFromState(
  state: SabakiStateLike | null,
): WorkspaceKind | null {
  if (state?.mode === 'analysis' && state.editWorkspace != null) {
    return WORKSPACE_KINDS.SCRATCH_ANALYSIS
  }

  if (state?.mode === 'recall') return WORKSPACE_KINDS.RECALL
  if (state?.mode === 'play' || state?.mode === 'autoplay') {
    return WORKSPACE_KINDS.PLAY
  }

  return null
}

export function getInteractionContractFromState(
  state: SabakiStateLike | null,
): InteractionContract | null {
  return getInteractionContractForWorkspace(getWorkspaceKindFromState(state))
}

export function getMutationContractFromState(
  state: SabakiStateLike | null,
): MutationContract | null {
  return getInteractionContractFromState(state)?.id ?? null
}

export function getPositionSourceFromState(
  state: SabakiStateLike | null,
  tab: ScratchRole | null = null,
): PositionSource | null {
  let workspaceKind = getWorkspaceKindFromState(state)

  if (
    state != null &&
    workspaceKind === WORKSPACE_KINDS.SCRATCH_ANALYSIS &&
    state.editWorkspace != null
  ) {
    let activeTab = tab ?? state.editWorkspace.activeTab ?? 'current'
    let snapshot =
      activeTab === 'reference'
        ? state.editWorkspace.referenceSnapshot
        : state.editWorkspace.currentSnapshot

    return snapshot?.id == null
      ? null
      : createScratchPositionSource(snapshot.id, snapshot.role ?? activeTab)
  }

  if (
    state?.treePosition != null &&
    (workspaceKind === WORKSPACE_KINDS.PLAY ||
      workspaceKind === WORKSPACE_KINDS.RECALL)
  ) {
    return createGameTreePositionSource(state.treePosition)
  }

  return null
}
