import {executePlayInteraction} from '../../workbench/board-interactions/executors/playInteractionExecutor.js'
import {BOARD_INTENTS, RESOLVE_STATUSES} from '../../workbench/board-interactions/intents.ts'

// This module intentionally does only two things for Workbench Play:
// 1. commit a Play move and record it on the active Attempt;
// 2. after attempt start or a committed move, ask "is the next player AI?"
//    and, if yes, commit that AI move through the same Play path.
// Problem, Recall, and Analysis are routed elsewhere.
export type PlayAiTurnActor = 'human' | 'ai'

export type PlayAiTurnTab = {
  id: string
  mode: string
  taskId?: string
  playerConfig?: unknown
  activeAttemptId?: string
}

export type PlayAiTurnTask = {
  problemArea?: [number, number][]
  rootPositionSgf?: string
  sideToMove?: 'black' | 'white'
} | null

export type PlayAiTurnAttempt = {
  rootPositionSgf: string
  userLine: string[]
}

export type PlayAiTurnServices = {
  documentStore: {playMove(vertex: [number, number], options?: unknown): Promise<unknown>}
  engineService?: {
    generateReply(treePosition: string, player: unknown): void
  }
  analysisService?: {scheduleLiveAnalysis(treePosition: string): void}
  attemptService?: {
    appendMove(attemptId: string, move: string, actor?: PlayAiTurnActor): Promise<void>
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
    loadAttempt?(attemptId: string): Promise<PlayAiTurnAttempt | null>
    loadTask?(taskId: string): Promise<NonNullable<PlayAiTurnTask> | null>
  }
  aiMoveService?: {
    maybePlayAiMove(input: {
      tab: unknown
      attempt: PlayAiTurnAttempt
      task: NonNullable<PlayAiTurnTask>
      sideToMove?: 'black' | 'white'
      treePosition?: string
    }): Promise<string | null>
  }
}

export type PlayAiTurnResult = {
  status: string
  intent: string
  mutationContract?: string
  positionSource?: unknown
  payload?: {
    vertex?: [number, number]
    player?: unknown
  }
}

export type ChangedPlayResult = {
  changed: true
  treePosition?: string
  doublePass?: boolean
  resign?: boolean
  noLegalMove?: boolean
}

export type PlayAiTurnService = {
  commitMove(input: {
    result: PlayAiTurnResult
    tab: PlayAiTurnTab
    task: PlayAiTurnTask
    actor: PlayAiTurnActor
    move: string
  }): Promise<unknown>
  playAiIfTurn(input: {
    tab: PlayAiTurnTab
    task: PlayAiTurnTask
    positionSource?: unknown
    treePosition?: string
  }): Promise<void>
}

export function createPlayAiTurnService(deps: {
  getPlayServices: () => PlayAiTurnServices
}): PlayAiTurnService {
  async function commitMove(input: {
    result: PlayAiTurnResult
    tab: PlayAiTurnTab
    task: PlayAiTurnTask
    actor: PlayAiTurnActor
    move: string
  }): Promise<unknown> {
    const services = deps.getPlayServices()
    return commitMoveWithServices({...input, services, continueAfterCommit: true})
  }

  async function playAiIfTurn(input: {
    tab: PlayAiTurnTab
    task: PlayAiTurnTask
    positionSource?: unknown
    treePosition?: string
  }): Promise<void> {
    const services = deps.getPlayServices()
    const attemptId = input.tab.activeAttemptId
    if (input.tab.mode !== 'play' || !attemptId || !services.aiMoveService) return

    const task = await loadTask(services, input.tab, input.task)
    const maxAiMoves = getMaxAiMovesForThisTrigger(input.tab, task)
    let treePosition = input.treePosition

    // Human-vs-AI commits at most one AI reply per trigger. AI-vs-AI may loop,
    // but only up to the configured or board-derived auto-play limit.
    for (let committed = 0; committed < maxAiMoves; committed++) {
      const attempt = await services.repository?.loadAttempt?.(attemptId)
      if (!attempt) return

      const aiMove = await services.aiMoveService.maybePlayAiMove({
        tab: input.tab,
        attempt,
        task,
        sideToMove: task.sideToMove,
        treePosition,
      })
      const boardSize = getBoardSize(task)
      const vertex = aiMove ? moveToVertex(aiMove, boardSize) : null
      if (!aiMove || !vertex) return

      const result = await commitMoveWithServices({
        services,
        result: createAiPlayResult(vertex, input.positionSource),
        tab: input.tab,
        task: input.task,
        actor: 'ai',
        move: normalizeMoveToSgf(aiMove, boardSize),
        continueAfterCommit: false,
      })

      if (!isChangedPlayResult(result) || isTerminalPlayResult(result)) return
      treePosition = result.treePosition

      if (!isAiVsAi(input.tab.playerConfig)) return
    }
  }

  return {commitMove, playAiIfTurn}

  async function commitMoveWithServices(input: {
    services: PlayAiTurnServices
    result: PlayAiTurnResult
    tab: PlayAiTurnTab
    task: PlayAiTurnTask
    actor: PlayAiTurnActor
    move: string
    continueAfterCommit: boolean
  }): Promise<unknown> {
    const useWorkbenchAi =
      input.services.aiMoveService != null && input.tab.activeAttemptId != null

    // Workbench owns AI continuation, so suppress the legacy executor hook
    // that would otherwise call engineService.generateReply.
    const playResult = await executePlayInteraction(
      input.result as any,
      {player: input.result.payload?.player as number | undefined},
      {
        documentStore: input.services.documentStore,
        engineService: useWorkbenchAi ? undefined : input.services.engineService,
        analysisService: input.services.analysisService,
      },
    )

    const attemptId = input.tab.activeAttemptId
    if (!isChangedPlayResult(playResult) || !attemptId) return playResult

    const attemptBefore = await input.services.repository?.loadAttempt?.(attemptId)
    const moveIndex = attemptBefore?.userLine.length ?? 0

    await input.services.attemptService?.appendMove(
      attemptId,
      input.move,
      input.actor,
    )

    await input.services.monitor?.onUserMove({
      attemptId,
      moveIndex,
      move: input.move,
      positionAfterHash: playResult.treePosition,
    })

    if (input.continueAfterCommit && !isTerminalPlayResult(playResult)) {
      await playAiIfTurn({
        tab: input.tab,
        task: input.task,
        positionSource: input.result.positionSource,
        treePosition: playResult.treePosition,
      })
    }

    return playResult
  }
}

function getMaxAiMovesForThisTrigger(
  tab: {playerConfig?: unknown},
  task: NonNullable<PlayAiTurnTask>,
): number {
  if (!isAiVsAi(tab.playerConfig)) return 1

  const config = extractPlayerConfig(tab.playerConfig)
  const aiConfig = typeof config?.ai === 'object' && config.ai != null
    ? config.ai as {autoPlayLimits?: {maxAutoMovesPerRun?: unknown}}
    : null
  const limit = aiConfig?.autoPlayLimits?.maxAutoMovesPerRun
  return typeof limit === 'number' && Number.isFinite(limit)
    ? Math.max(0, limit)
    : getDefaultAiVsAiMoveLimit(task)
}

function getDefaultAiVsAiMoveLimit(task: NonNullable<PlayAiTurnTask>): number {
  const boardSize = getBoardSize(task)
  return boardSize * boardSize + 2
}

function isAiVsAi(raw: unknown): boolean {
  const config = extractPlayerConfig(raw)
  return config?.black === 'ai' && config?.white === 'ai'
}

function extractPlayerConfig(raw: unknown): {black?: unknown; white?: unknown; ai?: unknown} | null {
  if (raw == null || typeof raw !== 'object') return null
  return raw as {black?: unknown; white?: unknown; ai?: unknown}
}

function isChangedPlayResult(result: unknown): result is ChangedPlayResult {
  return typeof result === 'object' && result != null && (result as {changed?: unknown}).changed === true
}

function isTerminalPlayResult(result: ChangedPlayResult): boolean {
  return result.doublePass === true || result.resign === true || result.noLegalMove === true
}

async function loadTask(
  services: PlayAiTurnServices,
  tab: {taskId?: string},
  task: PlayAiTurnTask,
): Promise<NonNullable<PlayAiTurnTask>> {
  const loaded = tab.taskId
    ? await services.repository?.loadTask?.(tab.taskId) ?? null
    : null
  return {
    ...(task ?? {}),
    ...(loaded ?? {}),
  } as NonNullable<PlayAiTurnTask>
}

function createAiPlayResult(vertex: [number, number], positionSource: unknown): PlayAiTurnResult {
  return {
    intent: BOARD_INTENTS.PLAY_STONE,
    status: RESOLVE_STATUSES.RESOLVED,
    mutationContract: 'playMove',
    positionSource,
    payload: {vertex},
  }
}

function getBoardSize(task: NonNullable<PlayAiTurnTask>): number {
  const sgf = task.rootPositionSgf
  if (typeof sgf !== 'string') return 19

  const match = sgf.match(/\bSZ\[(\d+)(?::\d+)?\]/)
  const size = match ? Number.parseInt(match[1], 10) : 19
  return Number.isFinite(size) && size > 0 ? size : 19
}

function moveToVertex(move: string, boardSize = 19): [number, number] | null {
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
    const y = boardSize - Number.parseInt(match[2], 10)
    return x < 0 || y < 0 || x >= boardSize || y >= boardSize ? null : [x, y]
  }

  const x = normalized.charCodeAt(0) - 97
  const y = normalized.charCodeAt(1) - 97
  if (x < 0 || y < 0 || x >= boardSize || y >= boardSize) return null
  return [x, y]
}

function vertexToSgfMove(vertex: [number, number]): string {
  const [x, y] = vertex
  if (x < 0 || y < 0) return ''
  return String.fromCharCode(97 + x) + String.fromCharCode(97 + y)
}

function normalizeMoveToSgf(move: string, boardSize = 19): string {
  const vertex = moveToVertex(move, boardSize)
  return vertex ? vertexToSgfMove(vertex) : move
}
