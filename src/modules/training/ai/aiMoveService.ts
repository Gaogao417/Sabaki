import type { WorkbenchTab, PlayerConfig, ProblemArea } from '../types/index'
import type { TrainingRepository } from '../repository/trainingRepository'
import type { TrainingRuntimeStore } from '../store/trainingRuntimeStore'
import type { WorkbenchStore } from '../store/workbenchStore'

export type AiMoveServiceDeps = {
  engineService: {
    requestMove(input: {
      engineId?: string
      positionSgf: string
      timeLimitMs?: number
      maxVisits?: number
      analysisAreaVertices?: ProblemArea
    }): Promise<{ move: string; candidates: string[] } | null>
  }
  runtimeStore?: TrainingRuntimeStore
  workbenchStore?: WorkbenchStore
  repository?: Pick<TrainingRepository, 'loadAttempt'>
}

export type ShouldAiMoveInput = {
  tab: WorkbenchTab
  attempt: { userLine: string[] } | null
  sideToMove?: 'black' | 'white'
}

/**
 * Pure function: determines whether AI should make the next move.
 * Does not modify store, repo, or engine.
 */
export function shouldAiMove(input: ShouldAiMoveInput): boolean {
  const { tab, attempt, sideToMove = 'black' } = input

  // No active attempt -> no AI move
  if (!attempt) return false

  // No playerConfig -> no AI move
  const config: PlayerConfig | undefined = tab.playerConfig
  if (!config) return false

  // autoPlay must be true (or undefined for backward compat, but explicitly false means no)
  if (config.ai?.autoPlay === false) return false

  const mode = tab.mode

  // Recall and analysis modes never get AI auto-move
  if (mode === 'recall' || mode === 'analysis') return false

  // Calculate whose turn it is based on userLine length and sideToMove
  // move 0 -> sideToMove, move 1 -> opposite, etc.
  const moveCount = attempt.userLine.length
  const isBlackTurn = moveCount % 2 === 0
    ? sideToMove === 'black'
    : sideToMove !== 'black'

  const currentSide: 'black' | 'white' = isBlackTurn ? 'black' : 'white'

  if (mode === 'play' || mode === 'problem') {
    // Check if the current side is configured as AI
    return config[currentSide] === 'ai'
  }

  return false
}

export function createAiMoveService(deps: AiMoveServiceDeps) {
  const { engineService, runtimeStore, workbenchStore, repository } = deps

  function hasProblemArea(task: { problemArea?: ProblemArea }): task is { problemArea: ProblemArea } {
    return Array.isArray(task.problemArea) && task.problemArea.length > 0
  }

  async function requestAiMove(input: {
    tab: WorkbenchTab
    attempt: { rootPositionSgf: string; userLine: string[] }
    task: { problemArea?: ProblemArea; rootPositionSgf?: string; sideToMove?: 'black' | 'white' }
    color?: 'black' | 'white'
  }): Promise<string | null> {
    const { tab, attempt, task } = input

    if (tab.mode === 'problem' && !hasProblemArea(task)) {
      return null
    }

    const requestId = `ai_req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const positionHash = hashAiMovePosition(attempt)
    const mode = tab.mode
    if (mode !== 'play' && mode !== 'problem') return null
    const sideToMove = 'sideToMove' in task ? task.sideToMove : undefined

    runtimeStore?.setAiMovePending({
      requestId,
      tabId: tab.id,
      attemptId: tab.activeAttemptId ?? '',
      positionHash,
      mode,
      color: input.color ?? inferAiMoveColor(attempt, sideToMove),
      startedAt: new Date().toISOString(),
    })

    const engineInput: {
      engineId?: string
      positionSgf: string
      timeLimitMs?: number
      maxVisits?: number
      analysisAreaVertices?: ProblemArea
    } = {
      positionSgf: attempt.rootPositionSgf,
    }

    // Pass engine params from playerConfig if available
    if (tab.playerConfig?.ai?.engineId) {
      engineInput.engineId = tab.playerConfig.ai.engineId
    }
    if (tab.playerConfig?.ai?.timeLimitMs) {
      engineInput.timeLimitMs = tab.playerConfig.ai.timeLimitMs
    }
    if (tab.playerConfig?.ai?.maxVisits) {
      engineInput.maxVisits = tab.playerConfig.ai.maxVisits
    }

    // In problem mode, pass analysisAreaVertices from task
    if (tab.mode === 'problem' && hasProblemArea(task)) {
      engineInput.analysisAreaVertices = task.problemArea
    }

    let result: Awaited<ReturnType<AiMoveServiceDeps['engineService']['requestMove']>>
    try {
      result = await engineService.requestMove(engineInput)
    } catch (error) {
      runtimeStore?.clearAiMovePending(requestId)
      throw error
    }

    if (!(await isAiMoveRequestFresh({
      requestId,
      tab,
      attempt,
      positionHash,
    }))) {
      runtimeStore?.clearAiMovePending(requestId)
      return null
    }

    runtimeStore?.clearAiMovePending(requestId)

    if (!result) return null

    // In problem mode with problemArea, filter by area
    if (tab.mode === 'problem' && hasProblemArea(task)) {
      const area = task.problemArea
      const moveCoord = moveToCoord(result.move)
      if (moveCoord && isCoordInArea(moveCoord, area)) {
        return result.move
      }
      return null
    }

    return result.move
  }

  async function maybePlayAiMove(input: {
    tab: WorkbenchTab
    attempt: { rootPositionSgf: string; userLine: string[] }
    task: { problemArea?: ProblemArea; rootPositionSgf?: string; sideToMove?: 'black' | 'white' }
    sideToMove?: 'black' | 'white'
  }): Promise<string | null> {
    const { tab, attempt, task } = input
    if (!shouldAiMove({ tab, attempt, sideToMove: input.sideToMove ?? task.sideToMove })) {
      return null
    }

    return requestAiMove({ tab, attempt, task })
  }

  return { requestAiMove, maybePlayAiMove }

  async function isAiMoveRequestFresh(input: {
    requestId: string
    tab: WorkbenchTab
    attempt: { rootPositionSgf: string; userLine: string[] }
    positionHash: string
  }): Promise<boolean> {
    const { requestId, tab, attempt, positionHash } = input
    if (runtimeStore?.hasSupersededAiMoveRequest(requestId)) return false

    const pending = runtimeStore?.getState().pendingAiMove
    if (pending && pending.requestId !== requestId) return false

    const workbenchState = workbenchStore?.getState()
    const activeTab = workbenchState?.tabs.find(t => t.id === tab.id)
    if (workbenchState && workbenchState.activeTabId !== tab.id) return false
    if (activeTab && activeTab.mode !== tab.mode) return false
    if (activeTab && activeTab.activeAttemptId !== tab.activeAttemptId) return false

    const runtimeState = runtimeStore?.getState()
    if (runtimeState?.activeAttemptId && tab.activeAttemptId && runtimeState.activeAttemptId !== tab.activeAttemptId) {
      return false
    }

    const latestAttempt = tab.activeAttemptId && repository
      ? await repository.loadAttempt(tab.activeAttemptId)
      : null
    if (latestAttempt) {
      return hashAiMovePosition(latestAttempt) === positionHash
    }

    return hashAiMovePosition(attempt) === positionHash
  }
}

function hashAiMovePosition(attempt: { rootPositionSgf: string; userLine: string[] }): string {
  return JSON.stringify({
    rootPositionSgf: attempt.rootPositionSgf,
    userLine: attempt.userLine,
  })
}

function inferAiMoveColor(
  attempt: { userLine: string[] },
  sideToMove: 'black' | 'white' = 'black',
): 'black' | 'white' {
  const moveCount = attempt.userLine.length
  const blackTurn = moveCount % 2 === 0
    ? sideToMove === 'black'
    : sideToMove !== 'black'
  return blackTurn ? 'black' : 'white'
}

/**
 * Convert a move string to zero-based {x, y}.
 * Handles both SGF coordinates (e.g. "dd") and human-readable GTP coordinates (e.g. "C3", "Q16").
 * Returns null for pass or invalid coordinates.
 */
function moveToCoord(move: string): { x: number; y: number } | null {
  if (!move || move.length < 2) return null

  // Detect format: if second char is a digit, it's human-readable (e.g. "C3", "Q16")
  // If second char is a letter, it's SGF (e.g. "dd")
  const secondChar = move.charCodeAt(1)
  if (secondChar >= 48 && secondChar <= 57) {
    // Second char is a digit -> human-readable GTP format
    return humanReadableToCoord(move)
  } else if (secondChar >= 97 && secondChar <= 122) {
    // Second char is a lowercase letter -> SGF format
    const x = move.charCodeAt(0) - 97 // 'a' = 0
    const y = move.charCodeAt(1) - 97
    if (x < 0 || y < 0) return null
    return { x, y }
  }
  return null
}

/**
 * Convert human-readable GTP coordinate (e.g. "C3", "Q16") to zero-based {x, y}.
 * Columns: A-T (skipping I), Rows: 1-based from bottom.
 */
function humanReadableToCoord(coord: string): { x: number; y: number } | null {
  const match = coord.match(/^([A-HJ-T])(\d+)$/i)
  if (!match) return null
  const colLetter = match[1].toUpperCase()
  const rowNumber = parseInt(match[2], 10)

  // Map column letter to index (skipping I)
  const columns = 'ABCDEFGHJKLMNOPQRST'
  const x = columns.indexOf(colLetter)
  if (x < 0) return null

  // Row: 1-based, where 1 is the bottom row
  const y = rowNumber - 1
  if (y < 0) return null

  return { x, y }
}

/**
 * Check if a coordinate appears in a vertex list.
 */
function isCoordInArea(coord: { x: number; y: number }, area: ProblemArea): boolean {
  if (!area || area.length === 0) return true
  return area.some(([vx, vy]) => vx === coord.x && vy === coord.y)
}
