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

type SabakiStateLike = {
  mode?: string
  treePosition?: TreePosition
  editWorkspace?: {
    activeTab?: ScratchRole
    currentSnapshot?: ScratchPosition | null
    referenceSnapshot?: ScratchPosition | null
  } | null
}

export const SCRATCH_ROLES = Object.freeze({
  CURRENT: 'current',
  REFERENCE: 'reference',
  PROBLEM_ATTEMPT: 'problem-attempt',
} as const)

export const MUTATION_CONTRACTS = Object.freeze({
  PLAY_MOVE: 'playMove',
  SCRATCH_EDIT: 'scratchEdit',
  RECALL_ANSWER: 'recallAnswer',
  VARIATION_MOVE: 'variationMove',
} as const)

export const WORKSPACE_KINDS = Object.freeze({
  PLAY: 'play',
  SCRATCH_ANALYSIS: 'scratch-analysis',
  VARIATION_ANALYSIS: 'variation-analysis',
  RECALL: 'recall',
} as const)

export const OVERLAY_LAYER_SOURCES = Object.freeze({
  OWNERSHIP: 'ownership',
  TERRITORY_DIFF: 'territoryDiff',
  HEATMAP: 'heatmap',
  HUMAN_PREFERENCE: 'humanPreference',
} as const)

export const OVERLAY_RENDER_MODES = Object.freeze({
  PAINT: 'paint',
  MARKER: 'marker',
  TOOLTIP: 'tooltip',
  SIDEBAR: 'sidebar',
} as const)

export const WORKSPACE_DEFAULTS = Object.freeze({
  [WORKSPACE_KINDS.PLAY]: {
    positionSourceKind: 'game-tree',
    mutationContract: MUTATION_CONTRACTS.PLAY_MOVE,
  },
  [WORKSPACE_KINDS.SCRATCH_ANALYSIS]: {
    positionSourceKind: 'scratch',
    mutationContract: MUTATION_CONTRACTS.SCRATCH_EDIT,
  },
  [WORKSPACE_KINDS.VARIATION_ANALYSIS]: {
    positionSourceKind: 'game-tree',
    mutationContract: MUTATION_CONTRACTS.VARIATION_MOVE,
  },
  [WORKSPACE_KINDS.RECALL]: {
    positionSourceKind: 'game-tree',
    mutationContract: MUTATION_CONTRACTS.RECALL_ANSWER,
  },
} satisfies Record<
  WorkspaceKind,
  {
    positionSourceKind: PositionSource['kind']
    mutationContract: MutationContract
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

export function getMutationContractForWorkspace(
  workspaceKind: WorkspaceKind | null,
): MutationContract | null {
  return workspaceKind == null
    ? null
    : (WORKSPACE_DEFAULTS[workspaceKind]?.mutationContract ?? null)
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

export function getMutationContractFromState(
  state: SabakiStateLike | null,
): MutationContract | null {
  return getMutationContractForWorkspace(getWorkspaceKindFromState(state))
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
