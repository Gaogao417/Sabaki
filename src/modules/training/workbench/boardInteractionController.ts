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
    engineService?: {generateReply(treePosition: string, player: unknown): void}
    analysisService?: {scheduleLiveAnalysis(treePosition: string): void}
  }
  getRecallAdapter: () =>
    {submitBoardClick(vertex: [number, number]): Promise<{handled: boolean; changed: boolean; isCorrect?: boolean; completed?: boolean; recallMoveIndex?: number; attempt?: unknown}>}
  getEditWorkspaceContext: () => unknown | null
  getEditWorkspaceDeps: () => {
    invalidateEditAnalysis?: () => void
    scheduleEditWorkspaceAnalysis?: (tab: string) => void
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
    task: {problemArea?: unknown} | null
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
  if (raw == null || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (Array.isArray(obj.vertices)) {
    return obj as {vertices?: [number, number][]; [key: string]: unknown}
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
 *   - PLAY_STONE -> playMove
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

      if (effectiveContract === 'playMove') {
        const playServices = deps.getPlayServices()
        const playResult = await executePlayInteraction(result, {player: (result.payload?.player as number) ?? undefined}, {
          documentStore: playServices.documentStore,
          engineService: playServices.engineService,
          analysisService: playServices.analysisService,
        })
        return playResult
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
        return scratchResult
      }

      // Unknown contract: no action
    },
  }
}
