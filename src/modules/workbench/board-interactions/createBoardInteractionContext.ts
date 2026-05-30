/**
 * Builds a ResolverInput from live state/board/event data.
 *
 * This module reads state and board but does NOT import sabaki.js, mutate
 * state, open menus, or refresh analysis. It is the bridge between raw
 * app state and the pure resolver.
 */

import {
  getMutationContractFromState,
  getPositionSourceFromState,
} from '../contracts/workspaceDefaults.ts'
import type {ScratchRole} from '../contracts/positionSource.ts'
import type {BoardInteractionPolicy} from './boardInteractionPolicy.ts'
import {MUTATION_CONTRACTS} from '../contracts/mutationContracts.ts'

type BoardLike = {
  width: number
  height: number
  markers: (null | {type: string; label?: string})[][]
  get(vertex: [number, number]): number
}

type StateLike = {
  mode?: string
  selectedTool?: string
  treePosition?: string
  editWorkspace?: {
    activeTab?: string
    currentSnapshot?: {id?: string; role?: ScratchRole} | null
    referenceSnapshot?: {id?: string; role?: ScratchRole} | null
    currentMarkerMap?: (null | {type: string; label?: string})[][] | null
    referenceMarkerMap?: (null | {type: string; label?: string})[][] | null
    currentLines?: {v1: number[]; v2: number[]; type: string}[] | null
    referenceLines?: {v1: number[]; v2: number[]; type: string}[] | null
    lineFirstVertex?: {type: string; vertex: number[]} | null
  } | null
}

export function createBoardInteractionContext({
  state,
  board,
  vertex,
  sourceVertex,
  event,
  isMac = false,
  policy,
  workbenchMode,
  tabId,
  taskId,
  playerConfig,
  problemArea,
  activeAttemptId,
  activeRecallSessionId,
}: {
  state: StateLike | null
  board: BoardLike | null
  vertex: [number, number]
  sourceVertex?: [number, number] | null
  event: {button?: number; ctrlKey?: boolean; metaKey?: boolean}
  isMac?: boolean
  policy?: BoardInteractionPolicy | null
  // W3 WorkbenchMode extension fields
  workbenchMode?: 'play' | 'problem' | 'recall' | 'analysis'
  tabId?: string
  taskId?: string
  playerConfig?: { currentSide?: 'human' | 'ai'; [key: string]: unknown } | null
  problemArea?: { vertices?: [number, number][]; [key: string]: unknown } | null
  activeAttemptId?: string
  activeRecallSessionId?: string
}) {
  if (state == null || board == null) return null

  // Use board.get() instead of reading signMap directly so this context builder
  // follows the Board read contract rather than a specific storage shape.
  let sign = board.get(vertex)
  let [vx, vy] = vertex
  let marker = board.markers[vy]?.[vx]
  let sourceSign =
    sourceVertex == null ? null : board.get(sourceVertex)
  let [svx, svy] = sourceVertex ?? [-1, -1]
  let sourceMarker =
    sourceVertex == null ? null : board.markers[svy]?.[svx]
  let mode = state.mode ?? 'play'
  let selectedTool = policy?.selectedTool ?? state.selectedTool ?? 'stone_1'

  let positionSource = policy?.positionSource ?? getPositionSourceFromState(state)
  let mutationContract = policy?.mutationContract ?? getMutationContractFromState(state)
  let allowedVertices = policy?.allowedVertices
  let readOnly = policy?.readOnly
  let readOnlyReason = policy?.readOnlyReason
  let lineFirstVertex = policy?.lineFirstVertex

  // Deprecated compatibility bridge for older W3 tests/call sites. It shapes
  // business fields into board-facing policy fields, and never returns those
  // business objects to the resolver.
  if (policy == null && workbenchMode != null) {
    if (workbenchMode === 'problem') {
      mutationContract = MUTATION_CONTRACTS.PROBLEM_ATTEMPT_MOVE
      if (problemArea?.vertices != null) allowedVertices = problemArea.vertices
      if (playerConfig?.currentSide === 'ai') {
        readOnly = true
        readOnlyReason = 'problem: AI turn, board is read-only'
      }
    } else if (workbenchMode === 'recall') {
      mutationContract = MUTATION_CONTRACTS.RECALL_ANSWER
    } else if (workbenchMode === 'analysis') {
      mutationContract = state.editWorkspace == null
        ? null
        : MUTATION_CONTRACTS.SCRATCH_EDIT
      lineFirstVertex = normalizeLineFirstVertex(state.editWorkspace?.lineFirstVertex)
    } else if (workbenchMode === 'play') {
      mutationContract = MUTATION_CONTRACTS.PLAY_MOVE
      if (playerConfig?.currentSide === 'ai') {
        readOnly = true
        readOnlyReason = 'play: AI turn, board is read-only'
      }
    }
  }

  return {
    mode,
    selectedTool,
    event: {
      button: event.button ?? 0,
      ctrlKey: event.ctrlKey ?? false,
      metaKey: event.metaKey ?? false,
      isMac,
    },
    point: {
      sign,
      markerType: marker?.type ?? null,
    },
    vertex,
    sourceVertex: sourceVertex ?? null,
    sourcePoint:
      sourceVertex == null
        ? null
        : {
            sign: sourceSign ?? 0,
            markerType: sourceMarker?.type ?? null,
          },
    positionSource,
    mutationContract,
    editWorkspacePresent: state.editWorkspace != null,
    ...(readOnly == null ? null : {readOnly}),
    ...(readOnlyReason == null ? null : {readOnlyReason}),
    ...(allowedVertices == null ? null : {allowedVertices}),
    ...(lineFirstVertex == null ? null : {lineFirstVertex}),
  }
}

function normalizeLineFirstVertex(
  raw: {type: string; vertex: number[]} | null | undefined,
): BoardInteractionPolicy['lineFirstVertex'] {
  if (
    raw == null ||
    !Array.isArray(raw.vertex) ||
    typeof raw.vertex[0] !== 'number' ||
    typeof raw.vertex[1] !== 'number'
  ) {
    return null
  }

  return {type: raw.type, vertex: [raw.vertex[0], raw.vertex[1]]}
}
