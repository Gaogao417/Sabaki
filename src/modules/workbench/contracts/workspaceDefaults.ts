import type {MutationContract} from './mutationContracts.ts'
import {MUTATION_CONTRACTS} from './mutationContracts.ts'
import type {PositionSource, ScratchPosition, ScratchRole, TreePosition} from './positionSource.ts'
import {
  createGameTreePositionSource,
  createScratchPositionSource,
} from './positionSource.ts'

/**
 * Workspace kinds - top-level task presets.
 *
 * Two layers stay intentionally separate:
 * - Workspace: what task the user is doing.
 * - MutationContract: which durable state a committed action may write.
 *
 * A workspace may select defaults, but it must not become the board write
 * boundary itself.
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

export type WorkspaceKind =
  | 'play'
  | 'scratch-analysis'
  | 'variation-analysis'
  | 'recall'

/**
 * Default contracts for each workspace.
 *
 * This preserves the workspace/write-boundary split:
 * - workspace: what task the user is doing;
 * - mutationContract: which durable state committed actions may write.
 */
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

type ScratchSnapshotLike = {
  id?: string
  role?: ScratchRole
}

/**
 * Minimal shape of Sabaki state needed to derive workspace kind, position source,
 * and mutation contract.
 *
 * Mode-to-workspace mapping (Phase 1):
 *   'play'                          -> PLAY
 *   'analysis' + editWorkspace      -> SCRATCH_ANALYSIS
 *   'recall'                        -> RECALL
 *   'autoplay', 'scoring', 'estimator', 'find', 'guess', 'problem',
 *   native SGF edit fallback        -> null (legacy/unmigrated)
 */
type SabakiStateLike = {
  mode?: string
  treePosition?: TreePosition
  editWorkspace?: {
    activeTab?: string
    currentSnapshot?: ScratchSnapshotLike | null
    referenceSnapshot?: ScratchSnapshotLike | null
  } | null
}

export function getWorkspaceKindFromState(
  state: SabakiStateLike | null,
): WorkspaceKind | null {
  if (state?.mode === 'analysis' && state.editWorkspace != null) {
    return WORKSPACE_KINDS.SCRATCH_ANALYSIS
  }

  if (state?.mode === 'recall') return WORKSPACE_KINDS.RECALL
  if (state?.mode === 'play' || state?.mode === 'problem') return WORKSPACE_KINDS.PLAY

  return null
}

export function getMutationContractForWorkspace(
  workspaceKind: WorkspaceKind | null,
): MutationContract | null {
  return workspaceKind == null
    ? null
    : (WORKSPACE_DEFAULTS[workspaceKind]?.mutationContract ?? null)
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

    let role = snapshot?.role ?? (activeTab as ScratchRole)

    return snapshot?.id == null
      ? null
      : createScratchPositionSource(snapshot.id, role)
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

type MarkerCell = {type: string; label?: string} | null

type LineEntry = {v1: number[]; v2: number[]; type: string}

export type ScratchEditExecutionContext = {
  activeTab: string
  currentSnapshot: ScratchPosition | null
  referenceSnapshot: ScratchPosition | null
  currentMarkerMap: MarkerCell[][] | null
  referenceMarkerMap: MarkerCell[][] | null
  currentLines: LineEntry[] | null
  referenceLines: LineEntry[] | null
  lineFirstVertex: {type: string; vertex: number[]} | null
}

export function createScratchEditExecutionContext(
  editWorkspace: {
    activeTab?: string
    currentSnapshot?: ScratchPosition | null
    referenceSnapshot?: ScratchPosition | null
    currentMarkerMap?: MarkerCell[][] | null
    referenceMarkerMap?: MarkerCell[][] | null
    currentLines?: LineEntry[] | null
    referenceLines?: LineEntry[] | null
    lineFirstVertex?: {type: string; vertex: number[]} | null
  } | null | undefined,
): ScratchEditExecutionContext | null {
  if (editWorkspace == null) return null

  return {
    activeTab: editWorkspace.activeTab ?? 'current',
    currentSnapshot: editWorkspace.currentSnapshot ?? null,
    referenceSnapshot: editWorkspace.referenceSnapshot ?? null,
    currentMarkerMap: editWorkspace.currentMarkerMap ?? null,
    referenceMarkerMap: editWorkspace.referenceMarkerMap ?? null,
    currentLines: editWorkspace.currentLines ?? null,
    referenceLines: editWorkspace.referenceLines ?? null,
    lineFirstVertex: editWorkspace.lineFirstVertex ?? null,
  }
}
