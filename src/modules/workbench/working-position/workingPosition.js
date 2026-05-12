import {cloneMatrix} from '../../utils.js'

/**
 * @typedef {import('../contracts/positionSource.ts').ScratchPosition} WorkingPosition
 * @typedef {import('../contracts/positionSource.ts').ScratchRole} ScratchRole
 * @typedef {import('../contracts/positionSource.ts').ScratchPositionOrigin} ScratchPositionOrigin
 */

function normalizeSign(value) {
  let sign = Number(value)
  return sign > 0 ? 1 : sign < 0 ? -1 : 0
}

function cloneSignMap(signMap) {
  return signMap.map((row) => row.map(normalizeSign))
}

function normalizePlayer(sign) {
  return sign === -1 ? -1 : 1
}

function copyMetadata(target, source) {
  if (source.role != null) target.role = source.role
  if (source.komi != null) target.komi = source.komi
  if (source.rules != null) target.rules = source.rules
  if (source.source != null) target.source = {...source.source}
}

/**
 * Create a working position from explicit fields.
 * Normalizes signMap values to 1/-1/0 and nextPlayer to 1/-1.
 *
 * @param {{
 *   id: string,
 *   width: number,
 *   height: number,
 *   signMap: unknown[][],
 *   nextPlayer?: number,
 *   role?: ScratchRole,
 *   komi?: number,
 *   rules?: string,
 *   source?: ScratchPositionOrigin
 * }} input
 * @returns {WorkingPosition}
 */
export function createWorkingPosition({
  id,
  width,
  height,
  signMap,
  nextPlayer = 1,
  role,
  komi,
  rules,
  source,
}) {
  let position = {
    id,
    width,
    height,
    signMap: cloneSignMap(signMap),
    nextPlayer: normalizePlayer(nextPlayer),
  }

  copyMetadata(position, {role, komi, rules, source})
  return position
}

/**
 * Create a working position from a loose snapshot object.
 * Accepts the existing ScratchPosition / snapshot shape used by study.js
 * and editWorkspace. Returns null if snapshot is null or has no usable id.
 *
 * @param {object|null} snapshot
 * @param {object} [options={}]
 * @returns {WorkingPosition|null}
 */
export function createWorkingPositionFromSnapshot(snapshot, options = {}) {
  if (snapshot == null) return null

  let id = options.id ?? snapshot.id
  if (id == null) return null

  return createWorkingPosition({
    id,
    width: snapshot.width,
    height: snapshot.height,
    signMap: snapshot.signMap,
    nextPlayer: options.nextPlayer ?? snapshot.nextPlayer,
    role: options.role ?? snapshot.role,
    komi: options.komi ?? snapshot.komi,
    rules: options.rules ?? snapshot.rules,
    source: options.source ?? snapshot.source,
  })
}

/**
 * Deep-clone a working position. The returned object shares no references
 * with the input.
 *
 * @param {WorkingPosition} position
 * @returns {WorkingPosition}
 */
export function cloneWorkingPosition(position) {
  if (position == null) return null

  let result = {
    id: position.id,
    width: position.width,
    height: position.height,
    signMap: cloneMatrix(position.signMap),
    nextPlayer: position.nextPlayer,
  }

  copyMetadata(result, position)
  return result
}
