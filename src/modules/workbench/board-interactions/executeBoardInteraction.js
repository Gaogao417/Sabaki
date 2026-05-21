import {RESOLVE_STATUSES} from './intents.ts'
import {executeScratchEdit} from './executors/scratchEditInteractionExecutor.js'
import {executeRecallInteraction} from './executors/recallInteractionExecutor.js'

/**
 * Thin router: given a resolved BoardInteractionResult and an edit workspace
 * context, dispatch to the correct executor or defer.
 *
 * Phase 4 handles mutationContract === scratchEdit.
 * Phase 8 adds mutationContract === playMove via executePlayInteractionAsync.
 * Phase 9 adds mutationContract === recallAnswer via executeRecallInteraction.
 *
 * @param {import('./intents.ts').BoardInteractionResult} result
 * @param {import('../contracts/workspaceDefaults.ts').ScratchEditExecutionContext} context
 * @param {{invalidateEditAnalysis?: () => void, scheduleEditWorkspaceAnalysis?: (tab: string) => void, adapter?: {submitBoardClick: function}}} [deps]
 * @returns {{
 *   handled: boolean,
 *   changed: boolean,
 *   reason?: string,
 *   tab?: string,
 *   snapshot?: object,
 *   markerMap?: (object|null)[][],
 *   lines?: object[],
 *   lineFirstVertex?: {type: string, vertex: number[]} | null,
 *   newTab?: string,
 *   capturedSnapshot?: object,
 *   isCorrect?: boolean,
 *   completed?: boolean,
 *   recallMoveIndex?: number,
 *   attempt?: object,
 * }}
 */
export function executeBoardInteraction(result, context, deps) {
  if (result.status !== RESOLVE_STATUSES.RESOLVED) {
    return {handled: false, changed: false, reason: result.reason ?? `status: ${result.status}`}
  }

  if (result.mutationContract == null) {
    return {handled: false, changed: false, reason: 'no mutation contract'}
  }

  if (result.mutationContract === 'scratchEdit') {
    return executeScratchEdit(result, context, deps)
  }

  if (result.mutationContract === 'recallAnswer') {
    return executeRecallInteraction(result, context, deps)
  }

  // playMove is handled by the async router (executeBoardInteractionAsync),
  // not this synchronous path.
  return {handled: false, changed: false, reason: `unsupported contract: ${result.mutationContract}`}
}
