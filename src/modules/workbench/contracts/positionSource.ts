export type TreePosition = string

export type ScratchRole = 'current' | 'reference' | 'problem-attempt'

export type GameTreePositionSource = {
  kind: 'game-tree'
  treePosition: TreePosition
}

export type ScratchPositionSource = {
  kind: 'scratch'
  snapshotId: string
  role?: ScratchRole
}

export type PositionSource = GameTreePositionSource | ScratchPositionSource

export type ScratchPositionOrigin = {
  type: 'game-tree-node' | 'manual' | 'problem'
  id?: string
}

export type ScratchPosition = {
  id: string
  width: number
  height: number
  signMap: number[][]
  nextPlayer: 1 | -1
  role?: ScratchRole
  komi?: number
  rules?: string
  source?: ScratchPositionOrigin
}

/** Loose-shaped snapshot used as input; sign values are not yet normalized. */
type BoardSnapshot = {
  id?: string
  width: number
  height: number
  signMap: unknown[][]
  nextPlayer?: number
  role?: ScratchRole
  komi?: number
  rules?: string
  source?: ScratchPositionOrigin
}

type ScratchPositionInput = Omit<ScratchPosition, 'signMap' | 'nextPlayer'> & {
  signMap: unknown[][]
  nextPlayer?: number
}

/**
 * Roles for scratch positions used by workbench flows.
 *
 * - CURRENT - The primary scratch board where the user edits and analyzes.
 * - REFERENCE - A comparison snapshot for territory/ownership diff overlays.
 * - PROBLEM_ATTEMPT - A scratch board scoped to a problem-solving attempt. Reserved
 *   for future use; not yet consumed in production code.
 *
 * Note: `editWorkspace.activeTab` still uses raw strings ('current' / 'reference')
 * in several call sites. Migration to these constants is ongoing.
 */
export const SCRATCH_ROLES = Object.freeze({
  CURRENT: 'current',
  REFERENCE: 'reference',
  PROBLEM_ATTEMPT: 'problem-attempt',
} as const)

function cloneSignMap(signMap: unknown[][]): number[][] {
  return signMap.map((row) =>
    row.map((value) => {
      let sign = Number(value)
      return sign > 0 ? 1 : sign < 0 ? -1 : 0
    }),
  )
}

function normalizePlayer(sign: number | undefined): 1 | -1 {
  return sign === -1 ? -1 : 1
}

function copyScratchMetadata(
  target: ScratchPosition,
  source: Partial<ScratchPosition>,
): void {
  if (source.role != null) target.role = source.role
  if (source.komi != null) target.komi = source.komi
  if (source.rules != null) target.rules = source.rules

  if (source.source != null) {
    target.source = {...source.source}
  }
}

export function createGameTreePositionSource(
  treePosition: TreePosition,
): GameTreePositionSource {
  return {kind: 'game-tree', treePosition}
}

export function createScratchPositionSource(
  snapshotId: string,
  role: ScratchRole | null = null,
): ScratchPositionSource {
  return {
    kind: 'scratch',
    snapshotId,
    ...(role == null ? null : {role}),
  }
}

export function createScratchPosition({
  id,
  width,
  height,
  signMap,
  nextPlayer = 1,
  role,
  komi,
  rules,
  source,
}: ScratchPositionInput): ScratchPosition {
  let position: ScratchPosition = {
    id,
    width,
    height,
    signMap: cloneSignMap(signMap),
    nextPlayer: normalizePlayer(nextPlayer),
  }

  copyScratchMetadata(position, {role, komi, rules, source})
  return position
}

export function createScratchPositionFromSnapshot(
  snapshot: BoardSnapshot | null,
  options: Partial<ScratchPosition> = {},
): ScratchPosition | null {
  if (snapshot == null) return null

  let id = options.id ?? snapshot.id
  if (id == null) return null

  return createScratchPosition({
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

export function snapshotFromScratchPosition(
  position: ScratchPosition | null,
): ScratchPosition | null {
  if (position == null) return null

  return createScratchPositionFromSnapshot(position)
}
