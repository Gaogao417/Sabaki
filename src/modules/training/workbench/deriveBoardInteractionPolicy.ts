import type {BoardInteractionPolicy} from '../../workbench/board-interactions/boardInteractionPolicy.ts'
import {MUTATION_CONTRACTS} from '../../workbench/contracts/mutationContracts.ts'
import {
  createGameTreePositionSource,
  createScratchPositionSource,
} from '../../workbench/contracts/positionSource.ts'
import type {ScratchRole, TreePosition} from '../../workbench/contracts/positionSource.ts'
import type {TrainingRuntimeState} from '../store/trainingRuntimeStore.ts'
import type {PlayerConfig, TrainingTask, WorkbenchTab} from '../types/index'

type ScratchSnapshotLike = {
  id?: string
  role?: ScratchRole
}

type EditWorkspaceLike = {
  activeTab?: string
  currentSnapshot?: ScratchSnapshotLike | null
  referenceSnapshot?: ScratchSnapshotLike | null
  lineFirstVertex?: {type: string; vertex: number[]} | null
} | null

export type DeriveBoardInteractionPolicyInput = {
  tab: Pick<
    WorkbenchTab,
    'id' | 'mode' | 'currentTreePosition' | 'playerConfig'
  > & {
    problemArea?: unknown
  }
  runtimeState?: Partial<TrainingRuntimeState> | null
  task?: Pick<TrainingTask, 'problemArea'> | null
  playerConfig?: (PlayerConfig & {currentSide?: 'human' | 'ai'}) | null
  selectedTool?: string
  treePosition?: TreePosition
  editWorkspace?: EditWorkspaceLike
}

function normalizeProblemArea(raw: unknown): [number, number][] | undefined {
  const vertices = Array.isArray(raw)
    ? raw
    : raw != null && typeof raw === 'object' && Array.isArray((raw as {vertices?: unknown}).vertices)
      ? (raw as {vertices: unknown[]}).vertices
      : null

  if (vertices == null) return undefined

  return vertices
    .filter((vertex): vertex is [number, number] =>
      Array.isArray(vertex) &&
      vertex.length >= 2 &&
      typeof vertex[0] === 'number' &&
      typeof vertex[1] === 'number',
    )
    .map(vertex => [vertex[0], vertex[1]])
}

function normalizeLineFirstVertex(
  raw: {type: string; vertex: number[]} | null | undefined,
): BoardInteractionPolicy['lineFirstVertex'] {
  if (raw == null) return null
  const {type, vertex} = raw
  if (
    typeof type !== 'string' ||
    !Array.isArray(vertex) ||
    typeof vertex[0] !== 'number' ||
    typeof vertex[1] !== 'number'
  ) {
    return null
  }

  return {type, vertex: [vertex[0], vertex[1]]}
}

function isReadOnlyAiTurn(input: DeriveBoardInteractionPolicyInput): boolean {
  const {tab, runtimeState} = input
  const playerConfig =
    input.playerConfig ?? (tab.playerConfig as PlayerConfig & {currentSide?: 'human' | 'ai'} | undefined)

  return playerConfig?.currentSide === 'ai' ||
    runtimeState?.pendingAiMove?.tabId === tab.id
}

function getScratchPositionSource(editWorkspace: EditWorkspaceLike) {
  if (editWorkspace == null) return null

  const activeTab = editWorkspace.activeTab ?? 'current'
  const snapshot = activeTab === 'reference'
    ? editWorkspace.referenceSnapshot
    : editWorkspace.currentSnapshot
  const role = snapshot?.role ?? (activeTab as ScratchRole)

  return snapshot?.id == null
    ? null
    : createScratchPositionSource(snapshot.id, role)
}

export function deriveBoardInteractionPolicy(
  input: DeriveBoardInteractionPolicyInput,
): BoardInteractionPolicy {
  const {
    tab,
    runtimeState,
    task,
    selectedTool = 'stone_1',
    treePosition = tab.currentTreePosition ?? 'node_root',
    editWorkspace = null,
  } = input

  const gameTreeSource = createGameTreePositionSource(treePosition)
  const aiTurn = isReadOnlyAiTurn(input)

  if (tab.mode === 'problem') {
    const allowedVertices = normalizeProblemArea(task?.problemArea ?? tab.problemArea)
    const submitted = runtimeState?.problemView?.submitted === true

    return {
      positionSource: gameTreeSource,
      mutationContract: MUTATION_CONTRACTS.PROBLEM_ATTEMPT_MOVE,
      selectedTool,
      ...(allowedVertices == null ? null : {allowedVertices}),
      ...(aiTurn
        ? {readOnly: true, readOnlyReason: 'problem: AI turn, board is read-only'}
        : null),
      ...(submitted
        ? {readOnly: true, readOnlyReason: 'problem: submitted attempt is read-only'}
        : null),
    }
  }

  if (tab.mode === 'recall') {
    if (runtimeState?.activeCheckpointId != null || runtimeState?.correctionDraft != null) {
      return {
        positionSource: gameTreeSource,
        mutationContract: MUTATION_CONTRACTS.CHECKPOINT_CORRECTION,
        selectedTool,
      }
    }

    return {
      positionSource: gameTreeSource,
      mutationContract: MUTATION_CONTRACTS.RECALL_ANSWER,
      selectedTool,
    }
  }

  if (tab.mode === 'analysis') {
    if (editWorkspace == null) {
      return {
        positionSource: null,
        mutationContract: null,
        selectedTool,
        readOnly: true,
        readOnlyReason: 'analysis: edit workspace required',
        lineFirstVertex: null,
      }
    }

    return {
      positionSource: getScratchPositionSource(editWorkspace),
      mutationContract: MUTATION_CONTRACTS.SCRATCH_EDIT,
      selectedTool,
      lineFirstVertex: normalizeLineFirstVertex(editWorkspace?.lineFirstVertex),
    }
  }

  return {
    positionSource: gameTreeSource,
    mutationContract: MUTATION_CONTRACTS.PLAY_MOVE,
    selectedTool,
    ...(aiTurn
      ? {readOnly: true, readOnlyReason: 'play: AI turn, board is read-only'}
      : null),
  }
}
