import {getSnapshotSignature, snapshotToGameTree} from '../../study.js'

export const SCRATCH_ANALYSIS_SOURCE = 'scratch-analysis'

export function createScratchAnalysisContext(snapshot, {tab, sourceTree, syncerId}) {
  if (snapshot == null) return null

  let result = snapshotToGameTree(snapshot, [], sourceTree)
  if (result == null) return null

  let {tree, treePosition} = result
  return {
    source: SCRATCH_ANALYSIS_SOURCE,
    tab,
    tree,
    treePosition,
    analyzePlayer: snapshot.nextPlayer,
    syncerId,
  }
}

export function getScratchAnalysisCacheKey(syncerId, snapshot) {
  if (syncerId == null || snapshot == null) return null
  let signature = getSnapshotSignature(snapshot)
  if (signature == null) return null
  return [syncerId, signature].join(':')
}
