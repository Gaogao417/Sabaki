/**
 * modeTransitions.ts
 *
 * Pure state machine for Workbench mode transitions.
 *
 * Architecture v0.5 Section 0.4: "模式转换必须收敛到一个可测试的状态机模块"
 *
 * This module is PURE: no imports of service, store, adapter, or DB modules.
 * It can only import types from ../types/tab.ts.
 */

import type { WorkbenchMode } from '../types/tab'
import type { RecallSubstate } from '../types/tab'

// --- Types ---

export type TransitionEvent =
  | 'submit'
  | 'enterAnalysis'
  | 'returnFromAnalysis'
  | 'restartAttempt'
  | 'snapshot'
  | 'startCheckpoint'
  | 'revealAi'
  | 'commentCheckpoint'
  | 'resumeRecall'

export type TransitionInput = {
  from: WorkbenchMode
  recallSubstate?: RecallSubstate
  event: TransitionEvent
  hasActiveAttempt: boolean
  isAttemptFrozen: boolean
  hasActiveRecallSession: boolean
  hasTask: boolean
  hasCheckpoint: boolean
  isCorrectionSubmitted: boolean
  isCheckpointAiRevealed: boolean
  isCheckpointSavedOrSkipped: boolean
  hasAnalysisReturnTarget: boolean
}

export type TransitionEffect =
  | 'freezeAttempt'
  | 'createRecall'
  | 'saveAnalysisReturnTarget'
  | 'clearAnalysisReturnTarget'
  | 'restorePreviousMode'
  | 'clearActiveCheckpoint'
  | 'createNewTaskAndTab'
  | 'createNewAttempt'

export type TransitionResult = {
  allowed: true
  targetMode: WorkbenchMode
  targetRecallSubstate?: RecallSubstate
  effects: TransitionEffect[]
} | {
  allowed: false
  reason: string
}

// --- Core state machine ---

export function resolveTransition(input: TransitionInput): TransitionResult {
  const { from, recallSubstate, event, hasActiveAttempt, isAttemptFrozen,
    hasActiveRecallSession, hasTask, hasCheckpoint, isCorrectionSubmitted,
    isCheckpointAiRevealed, isCheckpointSavedOrSkipped, hasAnalysisReturnTarget } = input

  // --- snapshot: allowed from any mode, targetMode unchanged ---
  if (event === 'snapshot') {
    return {
      allowed: true,
      targetMode: from,
      effects: ['createNewTaskAndTab'],
    }
  }

  // --- submit: allowed from play/problem with active attempt that is not frozen ---
  if (event === 'submit') {
    if (from !== 'play' && from !== 'problem') {
      return { allowed: false, reason: `submit is only allowed from play or problem, got ${from}` }
    }
    if (!hasActiveAttempt) {
      return { allowed: false, reason: 'submit requires an active attempt (hasActiveAttempt is false)' }
    }
    if (isAttemptFrozen) {
      return { allowed: false, reason: 'submit requires the attempt to not be frozen (isAttemptFrozen is true)' }
    }
    return {
      allowed: true,
      targetMode: 'recall',
      targetRecallSubstate: 'normal',
      effects: ['freezeAttempt', 'createRecall'],
    }
  }

  // --- enterAnalysis: allowed from play/problem (with task) or recall (with active session) ---
  if (event === 'enterAnalysis') {
    if (from === 'play' || from === 'problem') {
      if (!hasTask) {
        return { allowed: false, reason: `enterAnalysis from ${from} requires a task (hasTask is false)` }
      }
      return {
        allowed: true,
        targetMode: 'analysis',
        effects: ['saveAnalysisReturnTarget'],
      }
    }
    if (from === 'recall') {
      if (!hasActiveRecallSession) {
        return { allowed: false, reason: 'enterAnalysis from recall requires an active recall session (hasActiveRecallSession is false)' }
      }
      return {
        allowed: true,
        targetMode: 'analysis',
        effects: ['saveAnalysisReturnTarget'],
      }
    }
    return { allowed: false, reason: `enterAnalysis is not allowed from ${from}` }
  }

  // --- returnFromAnalysis: allowed from analysis only, requires analysisReturnTarget ---
  if (event === 'returnFromAnalysis') {
    if (from !== 'analysis') {
      return { allowed: false, reason: `returnFromAnalysis is only allowed from analysis, got ${from}` }
    }
    if (!hasAnalysisReturnTarget) {
      return { allowed: false, reason: 'returnFromAnalysis requires an analysisReturnTarget (hasAnalysisReturnTarget is false)' }
    }
    return {
      allowed: true,
      targetMode: 'analysis', // placeholder; service reads actual target from tab
      effects: ['clearAnalysisReturnTarget', 'restorePreviousMode'],
    }
  }

  // --- restartAttempt: allowed from analysis with a task ---
  if (event === 'restartAttempt') {
    if (from !== 'analysis') {
      return { allowed: false, reason: `restartAttempt is only allowed from analysis, got ${from}` }
    }
    if (!hasTask) {
      return { allowed: false, reason: 'restartAttempt requires a task (hasTask is false)' }
    }
    return {
      allowed: true,
      targetMode: from,
      effects: ['createNewAttempt'],
    }
  }

  // --- Checkpoint substate transitions (Phase 5 infrastructure) ---
  // These change recallSubstate but not tab.mode.

  if (event === 'startCheckpoint') {
    if (from !== 'recall') {
      return { allowed: false, reason: `startCheckpoint is only allowed from recall, got ${from}` }
    }
    if (recallSubstate !== undefined && recallSubstate !== 'normal') {
      return { allowed: false, reason: `startCheckpoint requires recallSubstate to be normal, got ${recallSubstate}` }
    }
    if (!hasActiveRecallSession) {
      return { allowed: false, reason: 'startCheckpoint requires an active recall session' }
    }
    if (!hasCheckpoint) {
      return { allowed: false, reason: 'startCheckpoint requires a checkpoint (hasCheckpoint is false)' }
    }
    return {
      allowed: true,
      targetMode: 'recall',
      targetRecallSubstate: 'checkpoint_correction',
      effects: [],
    }
  }

  if (event === 'revealAi') {
    if (from !== 'recall') {
      return { allowed: false, reason: `revealAi is only allowed from recall, got ${from}` }
    }
    if (recallSubstate !== 'checkpoint_correction') {
      return { allowed: false, reason: `revealAi requires recallSubstate checkpoint_correction, got ${recallSubstate ?? 'undefined'}` }
    }
    if (!isCorrectionSubmitted) {
      return { allowed: false, reason: 'revealAi requires isCorrectionSubmitted to be true' }
    }
    return {
      allowed: true,
      targetMode: 'recall',
      targetRecallSubstate: 'checkpoint_ai_revealed',
      effects: [],
    }
  }

  if (event === 'commentCheckpoint') {
    if (from !== 'recall') {
      return { allowed: false, reason: `commentCheckpoint is only allowed from recall, got ${from}` }
    }
    if (recallSubstate !== 'checkpoint_ai_revealed') {
      return { allowed: false, reason: `commentCheckpoint requires recallSubstate checkpoint_ai_revealed, got ${recallSubstate ?? 'undefined'}` }
    }
    if (!isCheckpointAiRevealed) {
      return { allowed: false, reason: 'commentCheckpoint requires isCheckpointAiRevealed to be true' }
    }
    return {
      allowed: true,
      targetMode: 'recall',
      targetRecallSubstate: 'checkpoint_commenting',
      effects: [],
    }
  }

  if (event === 'resumeRecall') {
    if (from !== 'recall') {
      return { allowed: false, reason: `resumeRecall is only allowed from recall, got ${from}` }
    }
    if (!isCheckpointSavedOrSkipped) {
      return { allowed: false, reason: 'resumeRecall requires isCheckpointSavedOrSkipped to be true' }
    }
    return {
      allowed: true,
      targetMode: 'recall',
      targetRecallSubstate: 'normal',
      effects: ['clearActiveCheckpoint'],
    }
  }

  // --- Catch-all: unknown event or unhandled combination ---
  return { allowed: false, reason: `Transition ${from} --${event}--> is not defined in the state machine` }
}

// --- Utility: list allowed events for a given mode state ---

export function getAllowedEvents(mode: WorkbenchMode, _recallSubstate?: RecallSubstate): TransitionEvent[] {
  switch (mode) {
    case 'play':
    case 'problem':
      return ['submit', 'enterAnalysis', 'snapshot']
    case 'recall':
      return ['enterAnalysis', 'snapshot', 'startCheckpoint', 'revealAi', 'commentCheckpoint', 'resumeRecall']
    case 'analysis':
      return ['returnFromAnalysis', 'restartAttempt', 'snapshot']
    default:
      return []
  }
}
