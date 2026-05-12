/**
 * Recall interaction executor: handles submit-recall-answer results.
 *
 * Delegates to trainingStore.submitRecallAnswer(vertex).
 * Does NOT call documentStore, engineService, analysisService, or scratch edit.
 * Returns a narrow result object for the caller to commit state changes.
 */

import {RESOLVE_STATUSES} from '../intents.ts'

const SUPPORTED_INTENTS = Object.freeze(['submit-recall-answer'])

/**
 * @param {import('../intents.ts').BoardInteractionResult} result
 * @param {Record<string, unknown>} [_context]
 * @param {{trainingStore: {submitRecallAnswer: function}}} services
 * @returns {{handled: boolean, changed: boolean, reason?: string, isCorrect?: boolean, completed?: boolean, recallMoveIndex?: number, attempt?: object}}
 */
export function executeRecallInteraction(result, _context, services) {
  if (result.status !== RESOLVE_STATUSES.RESOLVED) {
    return {handled: false, changed: false, reason: result.reason ?? `status: ${result.status}`}
  }

  if (!SUPPORTED_INTENTS.includes(result.intent)) {
    return {handled: false, changed: false, reason: `unsupported intent: ${result.intent}`}
  }

  if (result.mutationContract !== 'recallAnswer') {
    return {handled: false, changed: false, reason: `unsupported contract: ${result.mutationContract}`}
  }

  let vertex = result.payload.vertex
  let {trainingStore} = services

  let answerResult = trainingStore.submitRecallAnswer(vertex)

  return {
    handled: answerResult.handled,
    changed: answerResult.changed,
    reason: answerResult.reason,
    isCorrect: answerResult.isCorrect,
    completed: answerResult.completed,
    recallMoveIndex: answerResult.recallMoveIndex,
    attempt: answerResult.attempt,
  }
}
