import {getAnalysisPreviewCacheKey} from '../overlays/analysisPreview.js'
import type {GameTree, OwnershipGrid, EngineSyncerLike} from './analysisTypes.ts'

// ---------------------------------------------------------------------------
// Internal cache state
// ---------------------------------------------------------------------------

let ownershipCache: Record<string, OwnershipGrid> = {}
let previewOwnershipCache: Record<string, OwnershipGrid> = {}

// ---------------------------------------------------------------------------
// Cache key helpers
// ---------------------------------------------------------------------------

export function getOwnershipCacheKey(
  syncerId: string | null | undefined,
  tree: GameTree | null | undefined,
  treePosition: string | null | undefined,
): string | null {
  if (syncerId == null || tree == null || treePosition == null) return null
  return [syncerId, tree.root.id, treePosition].join(':')
}

// ---------------------------------------------------------------------------
// Ownership cache
// ---------------------------------------------------------------------------

export function cacheOwnership(
  syncerId: string,
  tree: GameTree,
  treePosition: string,
  ownership: OwnershipGrid | null,
): void {
  let key = getOwnershipCacheKey(syncerId, tree, treePosition)
  if (key == null || ownership == null) return
  ownershipCache[key] = ownership
}

export function getCachedOwnership(
  syncerId: string,
  tree: GameTree,
  treePosition: string,
): OwnershipGrid | null {
  let key = getOwnershipCacheKey(syncerId, tree, treePosition)
  return key == null ? null : ownershipCache[key] || null
}

// ---------------------------------------------------------------------------
// Preview ownership cache
// ---------------------------------------------------------------------------

export function cachePreviewOwnership(
  syncerId: string,
  tree: GameTree,
  treePosition: string,
  moves: unknown[],
  ownership: OwnershipGrid | null,
): void {
  let key = getAnalysisPreviewCacheKey(tree, treePosition, moves)
  if (syncerId == null || key == null || ownership == null) return
  previewOwnershipCache[`${syncerId}:${key}`] = ownership
}

export function getCachedPreviewOwnership(
  syncerId: string,
  tree: GameTree,
  treePosition: string,
  moves: unknown[],
): OwnershipGrid | null {
  let key = getAnalysisPreviewCacheKey(tree, treePosition, moves)
  return key == null || syncerId == null
    ? null
    : previewOwnershipCache[`${syncerId}:${key}`] || null
}

// ---------------------------------------------------------------------------
// Derived queries
// ---------------------------------------------------------------------------

export function getCurrentOwnership(
  syncer: EngineSyncerLike | null,
  state: {
    treePosition: string
    analysis: {ownership?: OwnershipGrid} | null
    analysisTreePosition: string
  },
  gameTree: GameTree | null,
): OwnershipGrid | null {
  let {treePosition, analysis, analysisTreePosition} = state

  if (
    syncer != null &&
    analysis != null &&
    analysis.ownership != null &&
    analysisTreePosition === treePosition
  ) {
    cacheOwnership(syncer.id, gameTree!, treePosition, analysis.ownership)
    return analysis.ownership
  }

  return syncer == null
    ? null
    : getCachedOwnership(syncer.id, gameTree!, treePosition)
}

export function getOwnershipForTreePosition(
  syncer: EngineSyncerLike | null,
  treePosition: string,
  state: {
    analysis: {ownership?: OwnershipGrid} | null
    analysisTreePosition: string
  },
  gameTree: GameTree | null,
): OwnershipGrid | null {
  let analyzingSyncer = syncer
  if (analyzingSyncer == null || treePosition == null) return null

  let {analysis, analysisTreePosition} = state

  if (
    analysis != null &&
    analysis.ownership != null &&
    analysisTreePosition === treePosition
  ) {
    cacheOwnership(
      analyzingSyncer.id,
      gameTree!,
      treePosition,
      analysis.ownership,
    )
    return analysis.ownership
  }

  return getCachedOwnership(analyzingSyncer.id, gameTree!, treePosition)
}

// ---------------------------------------------------------------------------
// Factory — resets internal state (for tests / re-creation)
// ---------------------------------------------------------------------------

export type AnalysisCache = ReturnType<typeof createAnalysisCache>

export function createAnalysisCache() {
  ownershipCache = {}
  previewOwnershipCache = {}

  return {
    getOwnershipCacheKey,
    cacheOwnership,
    getCachedOwnership,
    cachePreviewOwnership,
    getCachedPreviewOwnership,
    getCurrentOwnership,
    getOwnershipForTreePosition,
  }
}
