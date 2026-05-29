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
import {executePlayInteraction} from '../../workbench/board-interactions/executors/playInteractionExecutor.js'
import {executeRecallInteraction} from '../../workbench/board-interactions/executors/recallInteractionExecutor.js'
import {executeScratchEdit} from '../../workbench/board-interactions/executors/scratchEditInteractionExecutor.js'

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
  }
  getRecallAdapter: () =>
    {submitBoardClick(vertex: [number, number]): Promise<{handled: boolean; changed: boolean; isCorrect?: boolean; completed?: boolean; recallMoveIndex?: number; attempt?: unknown}>}
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
 * Derive the workbench mode from activeTab.mode.
 * Maps tab mode strings to the resolver's workbenchMode values.
 */
function toWorkbenchMode(tabMode: string): 'play' | 'problem' | 'recall' | 'analysis' | undefined {
  if (tabMode === 'play' || tabMode === 'problem' || tabMode === 'recall' || tabMode === 'analysis') {
    return tabMode
  }
  return undefined
}

/**
 * Safely extract a typed problemArea from unknown shape.
 */
function extractProblemArea(raw: unknown): {vertices?: [number, number][]; [key: string]: unknown} | null {
  if (raw == null) return null
  if (Array.isArray(raw)) {
    return { vertices: raw as [number, number][] }
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj.vertices)) {
      return obj as {vertices?: [number, number][]; [key: string]: unknown}
    }
  }
  return null
}

/**
 * Safely extract playerConfig with optional currentSide.
 */
function extractPlayerConfig(raw: unknown): {currentSide?: 'human' | 'ai'; [key: string]: unknown} | null {
  if (raw == null || typeof raw !== 'object') return null
  return raw as {currentSide?: 'human' | 'ai'; [key: string]: unknown}
}

/**
 * Infer a mutationContract from the resolved intent when mutationContract is null.
 *
 * This fallback handles modes like 'problem' that are not yet mapped to a
 * workspace kind in workspaceDefaults.ts. The mapping is based on which executor
 * the intent semantically belongs to:
 *   - PLAY_STONE -> playMove / problemAttemptMove
 *   - SUBMIT_RECALL_ANSWER -> recallAnswer
 *   - PLACE_BLACK_STONE, PLACE_WHITE_STONE, ERASE_STONE, DRAG_STONE,
 *     MARK_POINT, DRAW_LINE -> scratchEdit
 */
function inferContractFromIntent(intent: string): string | null {
  if (intent === BOARD_INTENTS.PLAY_STONE) return 'playMove'
  if (intent === BOARD_INTENTS.SUBMIT_RECALL_ANSWER) return 'recallAnswer'
  if (
    intent === BOARD_INTENTS.PLACE_BLACK_STONE ||
    intent === BOARD_INTENTS.PLACE_WHITE_STONE ||
    intent === BOARD_INTENTS.ERASE_STONE ||
    intent === BOARD_INTENTS.DRAG_STONE ||
    intent === BOARD_INTENTS.MARK_POINT ||
    intent === BOARD_INTENTS.DRAW_LINE
  ) {
    return 'scratchEdit'
  }
  return null
}

function getProblemPlayerSign(input: {
  task: {sideToMove?: 'black' | 'white'} | null
  activeTab: {playerConfig?: unknown}
}): number {
  if (input.task?.sideToMove === 'white') return -1
  if (input.task?.sideToMove === 'black') return 1

  const playerConfig = extractPlayerConfig(input.activeTab.playerConfig)
  const sideToMove = playerConfig?.sideToMove ?? playerConfig?.currentColor
  return sideToMove === 'white' ? -1 : 1
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
    activeTab: {playerConfig?: unknown}
    task: {sideToMove?: 'black' | 'white'} | null
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
  })

  return {
    handled: flowResult != null,
    changed: flowResult != null,
    ...(flowResult != null && typeof flowResult === 'object'
      ? flowResult as Record<string, unknown>
      : {}),
  }
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

type ChangedPlayResult = {
  changed: true
  treePosition?: string
  doublePass?: boolean
  resign?: boolean
  noLegalMove?: boolean
}

function isChangedPlayResult(result: unknown): result is ChangedPlayResult {
  return typeof result === 'object' && result != null && (result as {changed?: unknown}).changed === true
}

function isTerminalPlayResult(result: ChangedPlayResult): boolean {
  return result.doublePass === true || result.resign === true || result.noLegalMove === true
}

type PlayCommitActor = 'human' | 'ai'

type PlayCommitRunState = {
  committedAiMoves: number
  maxAiMoves: number
  allowTerminalCheck: boolean
  terminalCheckUsed: boolean
}

function isAiVsAiConfig(activeTab: {playerConfig?: unknown}): boolean {
  const config = extractPlayerConfig(activeTab.playerConfig)
  return config?.black === 'ai' && config?.white === 'ai'
}

function createPlayCommitRunState(activeTab: {playerConfig?: unknown}): PlayCommitRunState {
  const config = extractPlayerConfig(activeTab.playerConfig)
  const aiConfig = typeof config?.ai === 'object' && config.ai != null
    ? config.ai as {autoPlayLimits?: {maxAutoMovesPerRun?: unknown}}
    : null
  const configuredLimit = aiConfig?.autoPlayLimits?.maxAutoMovesPerRun
  const isAiVsAi = isAiVsAiConfig(activeTab)

  if (isAiVsAi) {
    return {
      committedAiMoves: 0,
      maxAiMoves: typeof configuredLimit === 'number' && Number.isFinite(configuredLimit)
        ? Math.max(0, configuredLimit)
        : 0,
      allowTerminalCheck: false,
      terminalCheckUsed: false,
    }
  }

  return {
    committedAiMoves: 0,
    maxAiMoves: 1,
    allowTerminalCheck: true,
    terminalCheckUsed: false,
  }
}

function canAskAiForMove(runState: PlayCommitRunState): boolean {
  return runState.committedAiMoves < runState.maxAiMoves ||
    (runState.allowTerminalCheck && !runState.terminalCheckUsed)
}

function canExecuteAiMove(runState: PlayCommitRunState): boolean {
  return runState.committedAiMoves < runState.maxAiMoves
}

function createAiPlayResult(vertex: [number, number], positionSource: unknown) {
  return {
    intent: BOARD_INTENTS.PLAY_STONE,
    status: RESOLVE_STATUSES.RESOLVED,
    mutationContract: 'playMove',
    positionSource,
    payload: {vertex},
  }
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

      const workbenchMode = toWorkbenchMode(activeTab.mode)
      const problemArea = extractProblemArea(task?.problemArea ?? activeTab.problemArea)
      const playerConfig = extractPlayerConfig(activeTab.playerConfig)

      // Build state-like object for createBoardInteractionContext
      const state = {
        mode: activeTab.mode,
        selectedTool: settings.selectedTool,
        treePosition: 'node_root',
        editWorkspace: editWorkspacePresent ? {activeTab: 'current'} : null,
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
        workbenchMode,
        tabId: activeTab.id,
        taskId: activeTab.taskId,
        playerConfig,
        problemArea,
        activeAttemptId: activeTab.activeAttemptId,
        activeRecallSessionId: activeTab.activeRecallSessionId,
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
      // When mutationContract is null (e.g. problem mode which is not yet mapped
      // in workspaceDefaults), fall back to intent-based routing.
      const effectiveContract = result.mutationContract ?? inferContractFromIntent(result.intent)

      if (effectiveContract === 'problemAttemptMove') {
        const playServices = deps.getPlayServices()
        return await executeProblemAttemptMove(result, {activeTab, task}, playServices)
      }

      if (effectiveContract === 'playMove') {
        const playServices = deps.getPlayServices()
        const useTrainingAiReply =
          playServices.aiMoveService != null && activeTab.activeAttemptId != null

        const runState = createPlayCommitRunState(activeTab)

        const executePlayCommand = async (
          playResultInput: ReturnType<typeof resolveBoardInteraction>,
          actor: PlayCommitActor,
          move: string,
        ): Promise<unknown> => {
          const playResult = await executePlayInteraction(
            playResultInput,
            {player: (playResultInput.payload?.player as number) ?? undefined},
            {
              documentStore: playServices.documentStore,
              engineService: useTrainingAiReply ? undefined : playServices.engineService,
              analysisService: playServices.analysisService,
            },
          )

          if (isChangedPlayResult(playResult) && activeTab.activeAttemptId) {
            await afterPlayMoveCommitted({
              actor,
              move,
              playResult,
            })
          }

          return playResult
        }

        const afterPlayMoveCommitted = async (context: {
          actor: PlayCommitActor
          move: string
          playResult: ChangedPlayResult
        }): Promise<void> => {
          const attemptId = activeTab.activeAttemptId
          if (!attemptId) return

          const attemptBefore = await loadAttempt(playServices, attemptId)
          const moveIndex = attemptBefore?.userLine.length ?? 0

          if (playServices.attemptService) {
            await playServices.attemptService.appendMove(attemptId, context.move, context.actor)
          }

          if (playServices.monitor) {
            await playServices.monitor.onUserMove({
              attemptId,
              moveIndex,
              move: context.move,
              positionAfterHash: context.playResult.treePosition,
            })
          }

          if (context.actor === 'ai') {
            runState.committedAiMoves += 1
          }

          if (isTerminalPlayResult(context.playResult)) {
            return
          }

          if (!playServices.aiMoveService || !canAskAiForMove(runState)) {
            return
          }

          const canExecuteReturnedAiMove = canExecuteAiMove(runState)
          if (!canExecuteReturnedAiMove && runState.allowTerminalCheck) {
            runState.terminalCheckUsed = true
          }

          const attemptAfter = await loadAttempt(playServices, attemptId) ??
            (attemptBefore
              ? {...attemptBefore, userLine: [...attemptBefore.userLine, context.move]}
              : null)

          if (!attemptAfter) return

          const loadedTask = await loadTask(playServices, activeTab, task)
          const aiMove = await playServices.aiMoveService.maybePlayAiMove({
            tab: activeTab,
            attempt: attemptAfter,
            task: loadedTask,
            sideToMove: loadedTask.sideToMove,
            treePosition: context.playResult.treePosition,
          })
          const aiVertex = aiMove ? moveToVertex(aiMove) : null

          if (!aiMove || !aiVertex || !canExecuteReturnedAiMove) return

          await executePlayCommand(
            createAiPlayResult(aiVertex, result.positionSource) as ReturnType<typeof resolveBoardInteraction>,
            'ai',
            normalizeMoveToSgf(aiMove),
          )
        }

        return await executePlayCommand(result, 'human', vertexToSgfMove(vertex))
      }

      if (effectiveContract === 'recallAnswer') {
        const adapter = deps.getRecallAdapter()
        const recallResult = await executeRecallInteraction(result, {}, {adapter})
        return recallResult
      }

      if (effectiveContract === 'scratchEdit') {
        const editWorkspaceContext = deps.getEditWorkspaceContext()
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
