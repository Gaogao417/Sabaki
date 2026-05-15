/**
 * Play Phase Controller
 *
 * Manages the full lifecycle of the play phase within a workbench tab:
 *   startPlay → handleMove* → (undo | submitPlay | exit)
 *
 * Layering:
 *   Container / clickVertex → PlayPhaseController → board-interaction (lower)
 *                                                 → attemptService / monitor (upper)
 *                                                 → phaseService (phase transition)
 */

import {resolveBoardInteraction} from '../../workbench/board-interactions/resolveBoardInteraction'
import {createBoardInteractionContext} from '../../workbench/board-interactions/createBoardInteractionContext'
import {executePlayInteraction} from '../../workbench/board-interactions/executors/playInteractionExecutor'
import {RESOLVE_STATUSES} from '../../workbench/board-interactions/intents'
import * as sgf from '@sabaki/sgf'

import type {AttemptService} from '../attempt/attemptService'
import type {PlayTrainingMonitor} from '../attempt/playTrainingMonitor'
import type {TrainingRuntimeStore} from '../store/trainingRuntimeStore'
import type {WorkbenchStore} from '../store/workbenchStore'
import type {PhaseTransition} from '../workbench/workbenchPhaseService'

// --- Types ---

type ContextInput = Parameters<typeof createBoardInteractionContext>[0]

export type PlayMoveInput = {
  vertex: [number, number]
  state: ContextInput['state']
  board: ContextInput['board']
  event: ContextInput['event']
  sourceVertex?: ContextInput['sourceVertex']
  isMac?: boolean
}

export type PlayMoveResult = {
  handled: boolean
  changed: boolean
  reason?: string
  treePosition?: string
}

export type StartPlayInput = {
  taskId: string
  tabId?: string
  rootPositionSgf: string
}

export type PlayServices = Parameters<typeof executePlayInteraction>[2]

export type PlayPhaseControllerDeps = {
  // Board execution
  getPlayServices: () => PlayServices
  getPlayer: (treePosition: string) => number

  // Tree navigation (for undo)
  navigateToParent(): string | null

  // Training services
  attemptService: AttemptService
  playTrainingMonitor: PlayTrainingMonitor

  // Phase transition
  phaseTransition(tabId: string, transition: PhaseTransition): void

  // Stores
  runtimeStore: TrainingRuntimeStore
  workbenchStore: WorkbenchStore

  logger?: {
    info(channel: string, message: string, data?: Record<string, unknown>): void
  }
}

export type PlayPhaseController = {
  startPlay(input: StartPlayInput): Promise<void>
  handleMove(input: PlayMoveInput): Promise<PlayMoveResult>
  undo(): Promise<void>
  submitPlay(): Promise<void>
  exit(): void
}

// --- Factory ---

export function createPlayPhaseController(
  deps: PlayPhaseControllerDeps,
): PlayPhaseController {
  const {
    getPlayServices,
    getPlayer,
    navigateToParent,
    attemptService,
    playTrainingMonitor,
    phaseTransition,
    runtimeStore,
    workbenchStore,
    logger,
  } = deps

  // Track move index across handleMove calls
  let moveCounter = 0

  function getActiveTabId(): string | null {
    return workbenchStore.getState().activeTabId
  }

  // --- Lifecycle ---

  async function startPlay(input: StartPlayInput): Promise<void> {
    let attempt = await attemptService.createAttempt({
      taskId: input.taskId,
      tabId: input.tabId,
      rootPositionSgf: input.rootPositionSgf,
    })

    playTrainingMonitor.startForAttempt({
      attemptId: attempt.id,
      taskId: input.taskId,
    })

    moveCounter = 0

    logger?.info('playPhase.start', 'Play session started', {
      taskId: input.taskId,
      tabId: input.tabId,
      attemptId: attempt.id,
    })
  }

  // --- Move ---

  async function handleMove(input: PlayMoveInput): Promise<PlayMoveResult> {
    let {vertex, state, board, event, sourceVertex, isMac} = input

    let ctx = createBoardInteractionContext({
      state,
      board,
      vertex,
      sourceVertex,
      event,
      isMac: isMac ?? false,
    })

    if (ctx == null) {
      return {handled: false, changed: false, reason: 'null context'}
    }

    let result = resolveBoardInteraction(ctx)

    if (
      result.status !== RESOLVE_STATUSES.RESOLVED ||
      result.intent !== 'play-stone' ||
      result.mutationContract !== 'playMove'
    ) {
      return {
        handled: false,
        changed: false,
        reason: result.reason ?? `unresolved: status=${result.status} intent=${result.intent}`,
      }
    }

    // Execute stone placement
    let positionBefore = (state as {treePosition?: string}).treePosition ?? ''
    let currentPlayer = getPlayer(positionBefore)
    let services = getPlayServices()
    let playResult = await executePlayInteraction(
      result,
      {player: currentPlayer},
      services,
    )

    if (!playResult.handled) {
      return {handled: true, changed: false, reason: playResult.reason}
    }

    // Training tracking
    let activeAttemptId = runtimeStore.getState().activeAttemptId

    if (activeAttemptId && playResult.changed && !playResult.pass) {
      let move = sgf.stringifyVertex(vertex)

      try {
        await attemptService.appendMove(activeAttemptId, move)
        await playTrainingMonitor.onUserMove({
          attemptId: activeAttemptId,
          moveIndex: moveCounter,
          move,
          positionBeforeHash: positionBefore,
          positionAfterHash: playResult.treePosition,
        })

        moveCounter++

        logger?.info('playPhase.move', 'Move tracked', {
          attemptId: activeAttemptId,
          moveIndex: moveCounter - 1,
          move,
        })
      } catch (err) {
        logger?.info('playPhase.trackingError', 'Training tracking failed', {
          attemptId: activeAttemptId,
          move,
          error: String(err),
        })
      }
    }

    return {
      handled: true,
      changed: playResult.changed,
      treePosition: playResult.treePosition,
    }
  }

  // --- Undo ---

  async function undo(): Promise<void> {
    let activeAttemptId = runtimeStore.getState().activeAttemptId
    if (!activeAttemptId) return

    // Navigate tree back to parent node
    let newPosition = navigateToParent()
    if (newPosition == null) return

    // Pop last move from attempt's userLine
    await attemptService.undoLastMove(activeAttemptId)

    // Remove the most recent pending evaluation for this attempt
    let pending = runtimeStore.getState().pendingMoveEvaluations
    let lastEval = Object.values(pending)
      .filter(e => e.attemptId === activeAttemptId)
      .sort((a, b) => b.moveIndex - a.moveIndex)[0]

    if (lastEval) {
      runtimeStore.removePendingMoveEvaluation(lastEval.id)
    }

    moveCounter = Math.max(0, moveCounter - 1)

    logger?.info('playPhase.undo', 'Move undone', {
      attemptId: activeAttemptId,
      moveIndex: moveCounter,
    })
  }

  // --- Submit ---

  async function submitPlay(): Promise<void> {
    let activeAttemptId = runtimeStore.getState().activeAttemptId
    if (!activeAttemptId) return

    let tabId = getActiveTabId()
    if (!tabId) return

    // Freeze attempt (no more moves allowed)
    await attemptService.freezeAttempt(activeAttemptId)

    // Stop monitoring
    playTrainingMonitor.stopForAttempt(activeAttemptId)

    // Transition to recall phase
    phaseTransition(tabId, 'submit')

    logger?.info('playPhase.submit', 'Play submitted, transitioning to recall', {
      attemptId: activeAttemptId,
      tabId,
    })
  }

  // --- Exit ---

  function exit(): void {
    let activeAttemptId = runtimeStore.getState().activeAttemptId

    if (activeAttemptId) {
      playTrainingMonitor.stopForAttempt(activeAttemptId)
    }

    // Clear play-phase runtime state
    runtimeStore.setActiveAttempt(undefined)
    runtimeStore.setProblemView(null)

    let pending = runtimeStore.getState().pendingMoveEvaluations
    for (let id of Object.keys(pending)) {
      runtimeStore.removePendingMoveEvaluation(id)
    }
    runtimeStore.setVisibleBadMoveIds([])

    moveCounter = 0

    logger?.info('playPhase.exit', 'Play session exited', {
      attemptId: activeAttemptId ?? 'none',
    })
  }

  return {startPlay, handleMove, undo, submitPlay, exit}
}
