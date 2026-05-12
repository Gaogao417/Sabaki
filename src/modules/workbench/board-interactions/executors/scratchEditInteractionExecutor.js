import {
  placeBlackStone,
  placeWhiteStone,
  eraseWorkingStone,
  setWorkingNextPlayer,
} from '../../working-position/index.js'

const SUPPORTED_INTENTS = Object.freeze([
  'place-black-stone',
  'place-white-stone',
  'erase-stone',
  'play-stone',
])

/**
 * Execute a scratch-edit intent against an edit workspace context.
 *
 * @param {import('../intents.ts').BoardInteractionResult} result
 * @param {import('../../contracts/workspaceDefaults.ts').ScratchEditExecutionContext} context
 * @param {{invalidateEditAnalysis?: () => void, scheduleEditWorkspaceAnalysis?: (tab: string) => void}} [deps]
 * @returns {{handled: boolean, changed: boolean, reason?: string, tab?: string, snapshot?: object}}
 */
export function executeScratchEdit(result, context, deps) {
  if (!SUPPORTED_INTENTS.includes(result.intent)) {
    return {handled: false, changed: false, reason: `unsupported intent: ${result.intent}`}
  }

  let tab = context.activeTab ?? 'current'
  let snapshot =
    tab === 'reference' ? context.referenceSnapshot : context.currentSnapshot

  if (snapshot == null) {
    return {handled: false, changed: false, reason: 'no active snapshot'}
  }

  let vertex = result.payload.vertex
  let [x, y] = vertex
  let updated

  switch (result.intent) {
    case 'place-black-stone': {
      if (result.payload.action === 'remove') {
        updated = eraseWorkingStone(snapshot, vertex)
      } else {
        updated = placeBlackStone(snapshot, vertex)
      }
      break
    }

    case 'place-white-stone': {
      if (result.payload.action === 'remove') {
        updated = eraseWorkingStone(snapshot, vertex)
      } else {
        updated = placeWhiteStone(snapshot, vertex)
      }
      break
    }

    case 'erase-stone': {
      if (snapshot.signMap[y][x] === 0) {
        return {handled: true, changed: false, reason: 'already empty'}
      }
      updated = eraseWorkingStone(snapshot, vertex)
      break
    }

    case 'play-stone': {
      if (snapshot.signMap[y][x] !== 0) {
        return {handled: true, changed: false, reason: 'occupied point'}
      }
      let sign = snapshot.nextPlayer
      updated = sign > 0
        ? placeBlackStone(snapshot, vertex)
        : placeWhiteStone(snapshot, vertex)
      updated = setWorkingNextPlayer(updated, -sign)
      break
    }
  }

  if (deps?.invalidateEditAnalysis) deps.invalidateEditAnalysis()
  if (deps?.scheduleEditWorkspaceAnalysis) deps.scheduleEditWorkspaceAnalysis(tab)

  return {handled: true, changed: true, tab, snapshot: updated}
}
