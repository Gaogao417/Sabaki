import {RESOLVE_STATUSES} from '../intents.ts'

const SUPPORTED_INTENTS = Object.freeze(['play-stone'])

/**
 * Execute a play interaction: write a real move to the game tree,
 * trigger sounds, logging, engine reply, and live analysis.
 *
 * This executor is async because ko/suicide confirmation requires
 * dialog interaction. It does not write to editWorkspace, working
 * position, recall session, or scratch analysis.
 *
 * @param {import('../intents.ts').BoardInteractionResult} result
 * @param {{player?: number}} [context]
 * @param {{documentStore: {playMove: function}, engineService?: {generateReply: function}, analysisService?: {scheduleLiveAnalysis: function}}} services
 * @returns {Promise<{handled: boolean, changed: boolean, reason?: string, treePosition?: string, pass?: boolean, capturing?: boolean, suicide?: boolean, ko?: boolean, doublePass?: boolean}>}
 */
export async function executePlayInteraction(result, context, services) {
  if (result.status !== RESOLVE_STATUSES.RESOLVED) {
    return {handled: false, changed: false, reason: result.reason ?? `status: ${result.status}`}
  }

  if (!SUPPORTED_INTENTS.includes(result.intent)) {
    return {handled: false, changed: false, reason: `unsupported intent: ${result.intent}`}
  }

  if (result.mutationContract !== 'playMove') {
    return {handled: false, changed: false, reason: `unsupported contract: ${result.mutationContract}`}
  }

  let vertex = result.payload.vertex
  let {documentStore, engineService, analysisService} = services

  let moveResult = await documentStore.playMove(vertex, {
    player: context?.player ?? null,
  })

  if (!moveResult.valid) {
    return {handled: true, changed: false, reason: moveResult.reason}
  }

  // Engine reply after changed non-double-pass moves
  if (moveResult.changed && !moveResult.doublePass && engineService) {
    let currentPlayer = context?.player ?? null
    engineService.generateReply(moveResult.treePosition, currentPlayer)
  }

  // Schedule live analysis
  if (moveResult.changed && analysisService) {
    analysisService.scheduleLiveAnalysis(moveResult.treePosition)
  }

  return {
    handled: true,
    changed: moveResult.changed,
    treePosition: moveResult.treePosition,
    pass: moveResult.pass,
    capturing: moveResult.capturing,
    suicide: moveResult.suicide,
    ko: moveResult.ko,
    doublePass: moveResult.doublePass,
  }
}
