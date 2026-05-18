import type { WorkbenchTab, PlayerConfig, ProblemArea } from '../types/index'

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
  const { engineService } = deps

  async function requestAiMove(input: {
    tab: WorkbenchTab
    attempt: { rootPositionSgf: string; userLine: string[] }
    task: { problemArea?: ProblemArea; rootPositionSgf?: string }
  }): Promise<string | null> {
    const { tab, attempt, task } = input

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
    if (tab.mode === 'problem' && task.problemArea && task.problemArea.length > 0) {
      engineInput.analysisAreaVertices = task.problemArea
    }

    const result = await engineService.requestMove(engineInput)

    if (!result) return null

    // In problem mode with problemArea, filter by area
    if (tab.mode === 'problem' && task.problemArea && task.problemArea.length > 0) {
      const area = task.problemArea
      const moveCoord = moveToCoord(result.move)
      if (moveCoord && isCoordInArea(moveCoord, area)) {
        return result.move
      }
      return null
    }

    return result.move
  }

  return { requestAiMove }
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
