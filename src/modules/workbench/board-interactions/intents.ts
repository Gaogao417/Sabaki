/**
 * Board interaction intent constants, statuses, and resolved result types.
 *
 * Phase 3 shadow-mode: the resolver produces these values but production
 * clicks are not yet routed through it. Intents classify *what* the user
 * wants to do; the executor (Phase 4+) decides *how* to apply it.
 */

export const BOARD_INTENTS = Object.freeze({
  // Workspace-aware intents
  PLAY_STONE: 'play-stone',
  PLACE_BLACK_STONE: 'place-black-stone',
  PLACE_WHITE_STONE: 'place-white-stone',
  ERASE_STONE: 'erase-stone',
  DRAG_STONE: 'drag-stone',
  MARK_POINT: 'mark-point',
  DRAW_LINE: 'draw-line',
  SUBMIT_RECALL_ANSWER: 'submit-recall-answer',
  SUBMIT_CHECKPOINT_CORRECTION_MOVE: 'submit-checkpoint-correction-move',

  // Scratch-edit extended intents (Phase 7)
  SET_NEXT_PLAYER: 'set-next-player',
  CAPTURE_REFERENCE: 'capture-reference',
  TOGGLE_TAB: 'toggle-tab',
  SAVE_AS_PROBLEM: 'save-as-problem',

  // Explicit no-op
  NOOP: 'noop',

  // Legacy/unmigrated mode intents — kept distinct so executors can
  // distinguish "handled by legacy path" from "unknown".
  LEGACY_TOGGLE_DEAD_STONES: 'legacy-toggle-dead-stones',
  LEGACY_FIND_MOVE: 'legacy-find-move',
  LEGACY_SGF_EDIT: 'legacy-sgf-edit',
  LEGACY_ANALYSIS_FALLBACK: 'legacy-analysis-fallback',
  LEGACY_AUTOPLAY: 'legacy-autoplay',
  LEGACY_PLAY_RIGHT_CLICK: 'legacy-play-right-click',
} as const)

export type BoardIntent =
  | 'play-stone'
  | 'place-black-stone'
  | 'place-white-stone'
  | 'erase-stone'
  | 'drag-stone'
  | 'mark-point'
  | 'draw-line'
  | 'submit-recall-answer'
  | 'submit-checkpoint-correction-move'
  | 'set-next-player'
  | 'capture-reference'
  | 'toggle-tab'
  | 'save-as-problem'
  | 'noop'
  | 'legacy-toggle-dead-stones'
  | 'legacy-find-move'
  | 'legacy-sgf-edit'
  | 'legacy-analysis-fallback'
  | 'legacy-autoplay'
  | 'legacy-play-right-click'

export const RESOLVE_STATUSES = Object.freeze({
  RESOLVED: 'resolved',
  DEFERRED: 'deferred',
  REJECTED: 'rejected',
} as const)

export type ResolveStatus = 'resolved' | 'deferred' | 'rejected'

import type {MutationContract} from '../contracts/mutationContracts.ts'
import type {PositionSource} from '../contracts/positionSource.ts'

export type BoardInteractionResult = {
  intent: BoardIntent
  positionSource: PositionSource | null
  mutationContract: MutationContract | null
  status: ResolveStatus
  reason?: string
  payload?: Record<string, unknown>
}
