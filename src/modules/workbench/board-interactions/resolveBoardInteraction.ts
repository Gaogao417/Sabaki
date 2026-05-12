/**
 * Pure resolver: given a compact context snapshot, a board event, the selected
 * tool, point state, and active workspace metadata, produce a
 * BoardInteractionResult.
 *
 * This function must not import sabaki.js, read global state, or produce
 * side effects. All information flows through the input parameters.
 */

import {BOARD_INTENTS, RESOLVE_STATUSES} from './intents.ts'
import type {
  BoardInteractionResult,
  BoardIntent,
  ResolveStatus,
} from './intents.ts'
import type {MutationContract} from '../contracts/mutationContracts.ts'
import type {PositionSource} from '../contracts/positionSource.ts'

export type BoardEvent = {
  button: number
  ctrlKey: boolean
  metaKey: boolean
  isMac: boolean
}

export type PointState = {
  sign: number // 1 = black, -1 = white, 0 = empty
  markerType: string | null
}

export type ResolverInput = {
  mode: string
  selectedTool: string
  event: BoardEvent
  point: PointState
  vertex: [number, number]
  sourceVertex?: [number, number] | null
  sourcePoint?: PointState | null
  positionSource: PositionSource | null
  mutationContract: MutationContract | null
  editWorkspacePresent: boolean
}

function noop(
  reason: string,
  input: ResolverInput,
  status: ResolveStatus = RESOLVE_STATUSES.REJECTED,
): BoardInteractionResult {
  return {
    intent: BOARD_INTENTS.NOOP,
    positionSource: input.positionSource,
    mutationContract: input.mutationContract,
    status,
    reason,
  }
}

function legacy(
  intent: BoardIntent,
  input: ResolverInput,
  reason: string,
): BoardInteractionResult {
  return {
    intent,
    positionSource: null,
    mutationContract: null,
    status: RESOLVE_STATUSES.DEFERRED,
    reason,
  }
}

function isRightClick(event: BoardEvent): boolean {
  return event.button === 2 || (event.isMac && event.button === 0 && event.ctrlKey)
}

function verticesEqual(a: [number, number], b: [number, number]): boolean {
  return a[0] === b[0] && a[1] === b[1]
}

// --- Mode-specific resolvers ---

function resolvePlay(input: ResolverInput): BoardInteractionResult {
  let {event, point, vertex} = input

  // Only left-click and right-click are valid in play mode
  if (event.button !== 0 && !isRightClick(event)) {
    return noop('play: unsupported button', input)
  }

  if (isRightClick(event)) {
    return legacy(BOARD_INTENTS.LEGACY_PLAY_RIGHT_CLICK, input, 'right-click in play mode')
  }

  // Left-click only from here
  if (point.sign === 0) {
    return {
      intent: BOARD_INTENTS.PLAY_STONE,
      positionSource: input.positionSource,
      mutationContract: input.mutationContract,
      status: RESOLVE_STATUSES.RESOLVED,
      payload: {vertex},
    }
  }

  return noop('play: occupied point', input)
}

function resolveAnalysisEdit(input: ResolverInput): BoardInteractionResult {
  let {selectedTool, event, point, sourcePoint, sourceVertex, vertex} = input
  let effectiveTool = selectedTool

  if (sourceVertex != null) {
    if (event.button !== 0) {
      return noop('drag stone: unsupported button', input)
    }

    if (verticesEqual(sourceVertex, vertex)) {
      return noop('drag stone: same source and target', input)
    }

    if ((sourcePoint?.sign ?? 0) === 0) {
      return noop('drag stone: empty source', input)
    }

    if (point.sign !== 0) {
      return noop('drag stone: occupied target', input)
    }

    return {
      intent: BOARD_INTENTS.DRAG_STONE,
      positionSource: input.positionSource,
      mutationContract: input.mutationContract,
      status: RESOLVE_STATUSES.RESOLVED,
      payload: {source: sourceVertex, target: vertex, vertex},
    }
  }

  // Right-click toggles stone color
  if (isRightClick(event) && ['stone_1', 'stone_-1'].includes(effectiveTool)) {
    effectiveTool = effectiveTool === 'stone_1' ? 'stone_-1' : 'stone_1'
  }

  // Right-click with label/number tools is a menu action, not a board intent
  if (isRightClick(event) && ['number', 'label'].includes(effectiveTool)) {
    return noop('right-click label/number: menu action', input)
  }

  // Only left and right buttons are valid
  if (event.button !== 0 && event.button !== 2 && !isRightClick(event)) {
    return noop('unsupported button', input)
  }

  // Stone tools — toggle semantics: same-color stone is removed, empty or
  // opposite-color stone is placed.
  if (effectiveTool === 'stone_1') {
    let toolSign = 1
    let action = point.sign === toolSign ? 'remove' : 'place'
    return {
      intent: BOARD_INTENTS.PLACE_BLACK_STONE,
      positionSource: input.positionSource,
      mutationContract: input.mutationContract,
      status: RESOLVE_STATUSES.RESOLVED,
      payload: {sign: toolSign, action, vertex},
    }
  }

  if (effectiveTool === 'stone_-1') {
    let toolSign = -1
    let action = point.sign === toolSign ? 'remove' : 'place'
    return {
      intent: BOARD_INTENTS.PLACE_WHITE_STONE,
      positionSource: input.positionSource,
      mutationContract: input.mutationContract,
      status: RESOLVE_STATUSES.RESOLVED,
      payload: {sign: toolSign, action, vertex},
    }
  }

  // Eraser
  if (effectiveTool === 'eraser') {
    return {
      intent: BOARD_INTENTS.ERASE_STONE,
      positionSource: input.positionSource,
      mutationContract: input.mutationContract,
      status: RESOLVE_STATUSES.RESOLVED,
      payload: {vertex},
    }
  }

  // Play tool in scratch workspace
  if (effectiveTool === 'play') {
    if (point.sign !== 0) {
      return noop('play tool: occupied point', input)
    }
    return {
      intent: BOARD_INTENTS.PLAY_STONE,
      positionSource: input.positionSource,
      mutationContract: input.mutationContract,
      status: RESOLVE_STATUSES.RESOLVED,
      payload: {vertex}, // nextPlayer determined by workspace, not tool
    }
  }

  // Marker tools
  if (['cross', 'triangle', 'square', 'circle', 'label', 'number'].includes(effectiveTool)) {
    return {
      intent: BOARD_INTENTS.MARK_POINT,
      positionSource: input.positionSource,
      mutationContract: input.mutationContract,
      status: RESOLVE_STATUSES.RESOLVED,
      payload: {markerType: effectiveTool, vertex},
    }
  }

  // Line/arrow tools (two-click: first click starts, second completes)
  if (['line', 'arrow'].includes(effectiveTool)) {
    return {
      intent: BOARD_INTENTS.DRAW_LINE,
      positionSource: input.positionSource,
      mutationContract: input.mutationContract,
      status: RESOLVE_STATUSES.RESOLVED,
      payload: {lineType: effectiveTool, vertex},
    }
  }

  return noop('analysis: unknown tool', input)
}

function resolveRecall(input: ResolverInput): BoardInteractionResult {
  let {event, point, vertex} = input

  if (event.button !== 0) {
    return noop('recall: non-left button', input)
  }

  if (point.sign === 0) {
    return {
      intent: BOARD_INTENTS.SUBMIT_RECALL_ANSWER,
      positionSource: input.positionSource,
      mutationContract: input.mutationContract,
      status: RESOLVE_STATUSES.RESOLVED,
      payload: {vertex},
    }
  }

  return noop('recall: occupied point', input)
}

// --- Main resolver ---

export function resolveBoardInteraction(
  input: ResolverInput,
): BoardInteractionResult {
  let {mode, editWorkspacePresent} = input

  // Play / autoplay
  if (mode === 'play') {
    return resolvePlay(input)
  }
  if (mode === 'autoplay') {
    return legacy(BOARD_INTENTS.LEGACY_AUTOPLAY, input, 'autoplay mode')
  }

  // Analysis with edit workspace (scratch analysis)
  if (mode === 'analysis' && editWorkspacePresent) {
    return resolveAnalysisEdit(input)
  }

  // Analysis without workspace (legacy SGF edit fallback)
  if (mode === 'analysis' && !editWorkspacePresent) {
    return legacy(BOARD_INTENTS.LEGACY_SGF_EDIT, input, 'analysis without editWorkspace')
  }

  // Scoring / estimator
  if (mode === 'scoring' || mode === 'estimator') {
    if (input.event.button !== 0 || input.point.sign === 0) {
      return noop('scoring/estimator: empty point or non-left button', input)
    }
    return legacy(
      BOARD_INTENTS.LEGACY_TOGGLE_DEAD_STONES,
      input,
      `${mode} mode: toggle dead stones`,
    )
  }

  // Recall
  if (mode === 'recall') {
    return resolveRecall(input)
  }

  // Find
  if (mode === 'find') {
    if (input.event.button !== 0) return noop('find: non-left button', input)
    return legacy(BOARD_INTENTS.LEGACY_FIND_MOVE, input, 'find mode')
  }

  // Problem / review
  if (mode === 'problem' || mode === 'review') {
    if (input.event.button !== 0) return noop('problem/review: non-left button', input)
    return legacy(BOARD_INTENTS.LEGACY_PROBLEM_MOVE, input, `${mode} mode`)
  }

  // Guess
  if (mode === 'guess') {
    if (input.event.button !== 0) return noop('guess: non-left button', input)
    return legacy(BOARD_INTENTS.LEGACY_GUESS_MOVE, input, 'guess mode')
  }

  return noop('unknown mode', input)
}
