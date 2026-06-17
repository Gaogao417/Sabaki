/**
 * Board Interaction Controller
 *
 * Receives board click events from the Container, routes them through the
 * existing pure resolver (resolveBoardInteraction), and dispatches to the
 * correct executor target based on mutationContract.
 *
 * Architecture v0.5 constraints:
 *   - All deps injected; no direct store/service imports.
 *   - Controller only routes; executors write.
 *   - Resolver stays pure.
 *   - problemAttemptMove must write through problemFlowService, not the game tree.
 *   - recallAnswer must NOT modify the game tree.
 *   - scratchEdit must NOT modify Attempt.userLine.
 */

import {resolveBoardInteraction} from '../../workbench/board-interactions/resolveBoardInteraction.ts'
import {RESOLVE_STATUSES, BOARD_INTENTS} from '../../workbench/board-interactions/intents.ts'
import {createBoardInteractionContext} from '../../workbench/board-interactions/createBoardInteractionContext.ts'
import {executeRecallInteraction} from '../../workbench/board-interactions/executors/recallInteractionExecutor.js'
import {executeScratchEdit} from '../../workbench/board-interactions/executors/scratchEditInteractionExecutor.js'
import {deriveBoardInteractionPolicy} from './deriveBoardInteractionPolicy.ts'
import {createPlayAiTurnService} from './playAiTurnService.ts'
import type {PlayAiTurnService} from './playAiTurnService.ts'
import type {DeriveBoardInteractionPolicyInput} from './deriveBoardInteractionPolicy.ts'

export type BoardInteractionControllerDeps = {
  getPlayServices: () => {
    documentStore: {playMove(vertex: [number, number], options?: unknown): Promise<unknown>}
    engineService?: {
      generateReply(treePosition: string, player: unknown): void
      getAnalysisForPosition?(treePosition: string): unknown | null
    }
    analysisService?: {scheduleLiveAnalysis(treePosition: string): void}
    problemFlowService?: {
      appendProblemMove(input: {
        move: string
        vertex: number[]
        playerSign: number
        positionBeforeHash?: string
        positionAfterHash?: string
        preMoveAnalysis: unknown | null
        actor?: 'human' | 'ai'
      }): Promise<unknown>
    }
    attemptService?: {
      appendMove(attemptId: string, move: string, actor?: 'human' | 'ai'): Promise<void>
    }
    monitor?: {
      onUserMove(input: {
        attemptId: string
        moveIndex: number
        move: string
        positionBeforeHash?: string
        positionAfterHash?: string
      }): Promise<void>
    }
    repository?: {
      loadAttempt?(attemptId: string): Promise<{rootPositionSgf: string; userLine: string[]} | null>
      loadTask?(taskId: string): Promise<{problemArea?: [number, number][]; rootPositionSgf?: string; sideToMove?: 'black' | 'white'} | null>
    }
    aiMoveService?: {
      maybePlayAiMove(input: {
        tab: unknown
        attempt: {rootPositionSgf: string; userLine: string[]}
        task: {problemArea?: [number, number][]; rootPositionSgf?: string; sideToMove?: 'black' | 'white'}
        sideToMove?: 'black' | 'white'
        treePosition?: string
      }): Promise<string | null>
    }
    playAiTurnService?: PlayAiTurnService
  }
  getRecallAdapter: () =>
    {submitBoardClick(vertex: [number, number]): Promise<{handled: boolean; changed: boolean; isCorrect?: boolean; completed?: boolean; recallMoveIndex?: number; attempt?: unknown}>}
  getCheckpointCorrectionAdapter?: () =>
    {appendCorrectionMove(vertex: [number, number]): Promise<{handled: boolean; changed: boolean; recallMoveIndex?: number; attempt?: unknown}>}
  getEditWorkspaceContext: () => unknown | null
  getEditWorkspaceDeps: () => {
    invalidateEditAnalysis?: () => void
    scheduleEditWorkspaceAnalysis?: (tab: string) => void
    commitScratchResult?: (result: unknown) => void
  }
  getLegacySabaki: () => {
    clickVertex(vertex: [number, number], options?: unknown): void
  }
  getIsMac: () => boolean
}

export type BoardInteractionController = {
  handleBoardClick(input: {
    vertex: [number, number]
    event: {button: number; ctrlKey: boolean; metaKey: boolean}
    activeTab: {
      id: string
      mode: string
      taskId?: string
      playerConfig?: unknown
      activeAttemptId?: string
      activeRecallSessionId?: string
      problemArea?: unknown
      previousMode?: string
    }
    settings: {selectedTool: string; [key: string]: unknown}
    board: {get(vertex: [number, number]): number; markers: unknown[][]}
    editWorkspacePresent: boolean
    task: {problemArea?: unknown; rootPositionSgf?: string; sideToMove?: 'black' | 'white'} | null
    runtimeState: {activeCheckpointId?: string; correctionDraft?: unknown}
  }): Promise<unknown>
}

/**
 * Safely extract playerConfig with optional currentSide.
 */
function extractPlayerConfig(raw: unknown): {currentSide?: 'human' | 'ai'; [key: string]: unknown} | null {
  if (raw == null || typeof raw !== 'object') return null
  return raw as {currentSide?: 'human' | 'ai'; [key: string]: unknown}
}

function getProblemPlayerSign(input: {
  task: {sideToMove?: 'black' | 'white'} | null
  activeTab: {playerConfig?: unknown}
  moveIndex?: number
}): number {
  const moveIndex = input.moveIndex ?? 0
  if (input.task?.sideToMove === 'white') return moveIndex % 2 === 0 ? -1 : 1
  if (input.task?.sideToMove === 'black') return moveIndex % 2 === 0 ? 1 : -1

  const playerConfig = extractPlayerConfig(input.activeTab.playerConfig)
  const sideToMove = playerConfig?.sideToMove ?? playerConfig?.currentColor
  const firstSign = sideToMove === 'white' ? -1 : 1
  return moveIndex % 2 === 0 ? firstSign : -firstSign
}

function getPositionBeforeHash(positionSource: unknown): string | undefined {
  if (positionSource == null || typeof positionSource !== 'object') return undefined

  const source = positionSource as {kind?: unknown; treePosition?: unknown}
  return source.kind === 'game-tree' && typeof source.treePosition === 'string'
    ? source.treePosition
    : undefined
}

async function executeProblemAttemptMove(
  result: ReturnType<typeof resolveBoardInteraction>,
  input: {
    activeTab: {
      id: string
      mode: string
      taskId?: string
      playerConfig?: unknown
      activeAttemptId?: string
    }
    task: {problemArea?: unknown; rootPositionSgf?: string; sideToMove?: 'black' | 'white'} | null
  },
  services: ReturnType<BoardInteractionControllerDeps['getPlayServices']>,
): Promise<unknown> {
  if (
    result.status !== RESOLVE_STATUSES.RESOLVED ||
    result.intent !== BOARD_INTENTS.PLAY_STONE ||
    result.mutationContract !== 'problemAttemptMove'
  ) {
    return {
      handled: false,
      changed: false,
      reason: `unsupported problem attempt result: ${result.status}/${result.intent}/${result.mutationContract}`,
    }
  }

  const problemFlowService = services.problemFlowService
  if (!problemFlowService) {
    return {handled: false, changed: false, reason: 'missing problemFlowService'}
  }

  const vertex = result.payload?.vertex as [number, number]
  const move = vertexToSgfMove(vertex)
  const positionBeforeHash = getPositionBeforeHash(result.positionSource)
  const preMoveAnalysis = positionBeforeHash == null
    ? null
    : services.engineService?.getAnalysisForPosition?.(positionBeforeHash) ?? null
  const flowResult = await problemFlowService.appendProblemMove({
    move,
    vertex,
    playerSign: getProblemPlayerSign(input),
    positionBeforeHash,
    preMoveAnalysis,
    actor: 'human',
  })

  if (flowResult != null) {
    await maybeAppendProblemAiMove({
      result,
      input,
      services,
      positionBeforeHash,
      problemFlowService,
    })
  }

  return {
    handled: flowResult != null,
    changed: flowResult != null,
    ...(flowResult != null && typeof flowResult === 'object'
      ? flowResult as Record<string, unknown>
      : {}),
  }
}

function normalizeProblemArea(raw: unknown): [number, number][] | undefined {
  const vertices = Array.isArray(raw)
    ? raw
    : raw != null && typeof raw === 'object' && Array.isArray((raw as {vertices?: unknown}).vertices)
      ? (raw as {vertices: unknown[]}).vertices
      : null

  if (vertices == null) return undefined

  const normalized = vertices
    .filter((vertex): vertex is [number, number] =>
      Array.isArray(vertex) &&
      vertex.length >= 2 &&
      typeof vertex[0] === 'number' &&
      typeof vertex[1] === 'number',
    )
    .map(vertex => [vertex[0], vertex[1]] as [number, number])

  return normalized.length === 0 ? undefined : normalized
}

async function maybeAppendProblemAiMove(input: {
  result: ReturnType<typeof resolveBoardInteraction>
  input: {
    activeTab: {
      id: string
      mode: string
      taskId?: string
      playerConfig?: unknown
      activeAttemptId?: string
    }
    task: {problemArea?: unknown; rootPositionSgf?: string; sideToMove?: 'black' | 'white'} | null
  }
  services: ReturnType<BoardInteractionControllerDeps['getPlayServices']>
  positionBeforeHash?: string
  problemFlowService: NonNullable<ReturnType<BoardInteractionControllerDeps['getPlayServices']>['problemFlowService']>
}): Promise<void> {
  const {services, problemFlowService} = input
  const attemptId = input.input.activeTab.activeAttemptId
  if (!attemptId || !services.aiMoveService) return

  const attemptAfter = await loadAttempt(services, attemptId)
  if (!attemptAfter) return

  const loadedTask = await loadTask(
    services,
    input.input.activeTab,
    input.input.task,
  )
  const problemArea = normalizeProblemArea(loadedTask.problemArea)
  const taskForAi = {
    ...loadedTask,
    ...(problemArea == null ? {} : {problemArea}),
  }

  const aiMove = await services.aiMoveService.maybePlayAiMove({
    tab: input.input.activeTab,
    attempt: attemptAfter,
    task: taskForAi,
    sideToMove: taskForAi.sideToMove,
  })
  const aiVertex = aiMove ? moveToVertex(aiMove) : null

  if (!aiMove || !aiVertex) return

  const normalizedMove = normalizeMoveToSgf(aiMove)
  await problemFlowService.appendProblemMove({
    move: normalizedMove,
    vertex: aiVertex,
    playerSign: getProblemPlayerSign({
      activeTab: input.input.activeTab,
      task: taskForAi,
      moveIndex: attemptAfter.userLine.length,
    }),
    positionBeforeHash: input.positionBeforeHash,
    preMoveAnalysis: null,
    actor: 'ai',
  })
}

function vertexToSgfMove(vertex: [number, number]): string {
  const [x, y] = vertex
  if (x < 0 || y < 0) return ''
  return String.fromCharCode(97 + x) + String.fromCharCode(97 + y)
}

function moveToVertex(move: string): [number, number] | null {
  if (!move) return [-1, -1]

  const normalized = move.trim()
  if (normalized.toLowerCase() === 'pass') return [-1, -1]
  if (normalized.toLowerCase() === 'resign') return null
  if (normalized.length < 2) return null

  const secondChar = normalized.charCodeAt(1)
  if (secondChar >= 48 && secondChar <= 57) {
    const match = normalized.match(/^([A-HJ-T])(\d+)$/i)
    if (!match) return null
    const columns = 'ABCDEFGHJKLMNOPQRST'
    const x = columns.indexOf(match[1].toUpperCase())
    const y = Number.parseInt(match[2], 10) - 1
    return x < 0 || y < 0 ? null : [x, y]
  }

  const x = normalized.charCodeAt(0) - 97
  const y = normalized.charCodeAt(1) - 97
  if (x < 0 || y < 0) return null
  return [x, y]
}

function normalizeMoveToSgf(move: string): string {
  const vertex = moveToVertex(move)
  return vertex ? vertexToSgfMove(vertex) : move
}

async function loadAttempt(
  playServices: ReturnType<BoardInteractionControllerDeps['getPlayServices']>,
  attemptId: string,
): Promise<{rootPositionSgf: string; userLine: string[]} | null> {
  return await playServices.repository?.loadAttempt?.(attemptId) ?? null
}

async function loadTask(
  playServices: ReturnType<BoardInteractionControllerDeps['getPlayServices']>,
  activeTab: {taskId?: string},
  task: {problemArea?: unknown; rootPositionSgf?: string; sideToMove?: 'black' | 'white'} | null,
): Promise<{problemArea?: [number, number][]; rootPositionSgf?: string; sideToMove?: 'black' | 'white'}> {
  const loaded = activeTab.taskId
    ? await playServices.repository?.loadTask?.(activeTab.taskId) ?? null
    : null
  return {
    ...(task ?? {}),
    ...(loaded ?? {}),
  } as {problemArea?: [number, number][]; rootPositionSgf?: string; sideToMove?: 'black' | 'white'}
}

export function createBoardInteractionController(
  deps: BoardInteractionControllerDeps,
): BoardInteractionController {
  return {
    async handleBoardClick(input) {
      const {vertex, event, activeTab, settings, board, editWorkspacePresent, task, runtimeState} = input

      const playerConfig = extractPlayerConfig(activeTab.playerConfig)
      const editWorkspaceContext = editWorkspacePresent
        ? deps.getEditWorkspaceContext()
        : null
      const policy = deriveBoardInteractionPolicy({
        tab: activeTab as DeriveBoardInteractionPolicyInput['tab'],
        runtimeState,
        task: task as DeriveBoardInteractionPolicyInput['task'],
        playerConfig: playerConfig as DeriveBoardInteractionPolicyInput['playerConfig'],
        selectedTool: settings.selectedTool,
        treePosition: activeTab.currentTreePosition ?? 'node_root',
        editWorkspace: editWorkspaceContext as DeriveBoardInteractionPolicyInput['editWorkspace'],
      })

      // Build state-like object for createBoardInteractionContext
      const state = {
        mode: activeTab.mode,
        selectedTool: settings.selectedTool,
        treePosition: 'node_root',
        editWorkspace: editWorkspaceContext ?? (editWorkspacePresent ? {activeTab: 'current'} : null),
      }

      // Build the ResolverInput using the existing context builder
      const resolverInput = createBoardInteractionContext({
        state,
        board: board as {
          width: number
          height: number
          markers: (null | {type: string; label?: string})[][]
          get(vertex: [number, number]): number
        },
        vertex,
        event,
        isMac: deps.getIsMac(),
        policy,
      })

      if (resolverInput == null) return

      // Resolve through the pure resolver
      const result = resolveBoardInteraction(resolverInput)

      // Route based on status and mutationContract
      if (result.status === RESOLVE_STATUSES.REJECTED) {
        // No action for rejected/noop
        return
      }

      if (result.status === RESOLVE_STATUSES.DEFERRED) {
        // Migration seam: delegate to legacy sabaki.clickVertex
        deps.getLegacySabaki().clickVertex(vertex, event)
        return
      }

      // RESOLVED: dispatch based on mutationContract.
      const effectiveContract = result.mutationContract

      if (effectiveContract === 'problemAttemptMove') {
        const playServices = deps.getPlayServices()
        return await executeProblemAttemptMove(result, {activeTab, task}, playServices)
      }

      if (effectiveContract === 'playMove') {
        const playServices = deps.getPlayServices()
        const playAiTurnService = playServices.playAiTurnService ??
          createPlayAiTurnService({getPlayServices: () => playServices})

        return await playAiTurnService.commitMove({
          result,
          tab: activeTab,
          task,
          actor: 'human',
          move: vertexToSgfMove(vertex),
        })
      }

      if (effectiveContract === 'recallAnswer') {
        const adapter = deps.getRecallAdapter()
        const recallResult = await executeRecallInteraction(result, {}, {adapter})
        return recallResult
      }

      if (effectiveContract === 'checkpointCorrection') {
        if (
          result.status !== RESOLVE_STATUSES.RESOLVED ||
          result.intent !== BOARD_INTENTS.SUBMIT_CHECKPOINT_CORRECTION_MOVE
        ) {
          return {
            handled: false,
            changed: false,
            reason: `unsupported checkpoint correction result: ${result.status}/${result.intent}`,
          }
        }

        const adapter = deps.getCheckpointCorrectionAdapter?.()
        if (!adapter) {
          return {
            handled: false,
            changed: false,
            reason: 'missing checkpointCorrectionAdapter',
          }
        }

        return await adapter.appendCorrectionMove(
          result.payload?.vertex as [number, number],
        )
      }

      if (effectiveContract === 'scratchEdit') {
        const editWorkspaceDeps = deps.getEditWorkspaceDeps()
        const scratchResult = executeScratchEdit(result, editWorkspaceContext as any, editWorkspaceDeps)
        if (
          scratchResult.handled &&
          (scratchResult.changed ||
            scratchResult.lineFirstVertex !== undefined ||
            scratchResult.newTab != null ||
            scratchResult.capturedSnapshot != null)
        ) {
          editWorkspaceDeps.commitScratchResult?.(scratchResult)
        }
        return scratchResult
      }

      // Unknown contract: no action
    },
  }
}
