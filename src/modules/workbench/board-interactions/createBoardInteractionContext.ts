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
  getWorkspaceKindFromState,
} from '../contracts/workspaceDefaults.ts'

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
    currentSnapshot?: {id?: string; role?: string} | null
    referenceSnapshot?: {id?: string; role?: string} | null
  } | null
}

export function createBoardInteractionContext({
  state,
  board,
  vertex,
  event,
  isMac = false,
}: {
  state: StateLike | null
  board: BoardLike | null
  vertex: [number, number]
  event: {button?: number; ctrlKey?: boolean; metaKey?: boolean}
  isMac?: boolean
}) {
  if (state == null || board == null) return null

  // Use board.get() instead of reading signMap directly so this context builder
  // follows the Board read contract rather than a specific storage shape.
  let sign = board.get(vertex)
  let [vx, vy] = vertex
  let marker = board.markers[vy]?.[vx]
  let mode = state.mode ?? 'play'
  let selectedTool = state.selectedTool ?? 'stone_1'

  let positionSource = getPositionSourceFromState(state)
  let mutationContract = getMutationContractFromState(state)

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
    positionSource,
    mutationContract,
    editWorkspacePresent: state.editWorkspace != null,
  }
}
