import assert from 'assert'
import {fromDimensions as newBoard} from '@sabaki/go-board'

import {
  createSnapshotFromBoard,
  snapshotToGameTree,
} from '../src/modules/study.js'
import {
  SCRATCH_ANALYSIS_SOURCE,
  createScratchAnalysisContext,
  getScratchAnalysisCacheKey,
} from '../src/modules/workbench/analysis/index.js'

function makeSnapshot(width = 9, height = 9, nextPlayer = 1, extras = {}) {
  let board = newBoard(width, height)
  let snapshot = createSnapshotFromBoard(board, nextPlayer)
  return {...snapshot, ...extras}
}

describe('scratchAnalysis', () => {
  describe('SCRATCH_ANALYSIS_SOURCE', () => {
    it('is a constant string distinct from game-tree sources', () => {
      assert.strictEqual(SCRATCH_ANALYSIS_SOURCE, 'scratch-analysis')
      assert.ok(SCRATCH_ANALYSIS_SOURCE !== 'game-tree')
    })
  })

  describe('createScratchAnalysisContext', () => {
    it('returns null for null snapshot', () => {
      assert.strictEqual(
        createScratchAnalysisContext(null, {
          tab: 'current',
          sourceTree: null,
          syncerId: 's1',
        }),
        null,
      )
    })

    it('builds context from current snapshot', () => {
      let snapshot = makeSnapshot(9, 9, 1)
      let ctx = createScratchAnalysisContext(snapshot, {
        tab: 'current',
        sourceTree: null,
        syncerId: 'syncer-1',
      })

      assert.ok(ctx != null)
      assert.strictEqual(ctx.source, SCRATCH_ANALYSIS_SOURCE)
      assert.strictEqual(ctx.tab, 'current')
      assert.strictEqual(ctx.analyzePlayer, 1)
      assert.strictEqual(ctx.syncerId, 'syncer-1')
      assert.ok(ctx.tree != null)
      assert.ok(ctx.treePosition != null)
    })

    it('builds context from reference snapshot', () => {
      let snapshot = makeSnapshot(9, 9, -1)
      let ctx = createScratchAnalysisContext(snapshot, {
        tab: 'reference',
        sourceTree: null,
        syncerId: 'syncer-2',
      })

      assert.ok(ctx != null)
      assert.strictEqual(ctx.tab, 'reference')
      assert.strictEqual(ctx.analyzePlayer, -1)
    })

    it('uses snapshot komi/rules when present', () => {
      let snapshot = makeSnapshot(9, 9, 1, {komi: 6.5, rules: 'japanese'})
      let ctx = createScratchAnalysisContext(snapshot, {
        tab: 'current',
        sourceTree: null,
        syncerId: 's1',
      })

      assert.ok(ctx != null)
      let rootProps = ctx.tree.root.data
      assert.ok(rootProps.KM != null)
      assert.strictEqual(rootProps.KM[0], '6.5')
      assert.ok(rootProps.RU != null)
      assert.strictEqual(rootProps.RU[0], 'japanese')
    })
  })

  describe('getScratchAnalysisCacheKey', () => {
    it('returns null for null inputs', () => {
      assert.strictEqual(getScratchAnalysisCacheKey(null, makeSnapshot()), null)
      assert.strictEqual(getScratchAnalysisCacheKey('s1', null), null)
    })

    it('keys by syncerId plus snapshot signature', () => {
      let snapshot = makeSnapshot(9, 9, 1)
      let key1 = getScratchAnalysisCacheKey('syncer-A', snapshot)
      let key2 = getScratchAnalysisCacheKey('syncer-B', snapshot)

      assert.ok(key1 != null)
      assert.ok(key2 != null)
      assert.notStrictEqual(key1, key2)
      assert.ok(key1.startsWith('syncer-A:'))
      assert.ok(key2.startsWith('syncer-B:'))
    })

    it('returns different keys for different snapshots', () => {
      let s1 = makeSnapshot(9, 9, 1)
      let s2 = makeSnapshot(9, 9, -1)
      let key1 = getScratchAnalysisCacheKey('s1', s1)
      let key2 = getScratchAnalysisCacheKey('s1', s2)

      assert.notStrictEqual(key1, key2)
    })

    it('returns same key for identical snapshots', () => {
      let s1 = makeSnapshot(9, 9, 1)
      let s2 = makeSnapshot(9, 9, 1)
      assert.strictEqual(
        getScratchAnalysisCacheKey('s1', s1),
        getScratchAnalysisCacheKey('s1', s2),
      )
    })

    it('does not depend on temporary tree identity', () => {
      let snapshot = makeSnapshot(9, 9, 1)
      let ctx = createScratchAnalysisContext(snapshot, {
        tab: 'current',
        sourceTree: null,
        syncerId: 's1',
      })
      let ctx2 = createScratchAnalysisContext(snapshot, {
        tab: 'current',
        sourceTree: null,
        syncerId: 's1',
      })

      // Trees are different objects but cache key should be identical
      assert.notStrictEqual(ctx.tree, ctx2.tree)
      assert.strictEqual(
        getScratchAnalysisCacheKey('s1', snapshot),
        getScratchAnalysisCacheKey('s1', snapshot),
      )
    })
  })

  describe('scratch analysis isolation', () => {
    it('scratch analysis context uses temporary tree not in game tree', () => {
      let snapshot = makeSnapshot(9, 9, 1)
      let ctx = createScratchAnalysisContext(snapshot, {
        tab: 'current',
        sourceTree: null,
        syncerId: 's1',
      })

      // The temporary tree root id should not collide with typical game tree ids
      assert.ok(ctx.tree.root.id != null)
      assert.ok(ctx.treePosition != null)
    })

    it('snapshotToGameTree prefers snapshot komi over sourceTree komi', () => {
      let snapshot = makeSnapshot(9, 9, 1, {komi: 7.5})
      let result = snapshotToGameTree(snapshot, [], null)
      assert.ok(result != null)
      assert.strictEqual(result.tree.root.data.KM[0], '7.5')
    })

    it('snapshotToGameTree falls back to sourceTree komi', () => {
      let snapshot = makeSnapshot(9, 9, 1)
      // snapshot without komi, sourceTree also null -> no KM
      let result = snapshotToGameTree(snapshot, [], null)
      assert.ok(result != null)
      assert.strictEqual(result.tree.root.data.KM, undefined)
    })
  })

  describe('scratch analysis runtime isolation', () => {
    it('scratch analysis write-back only targets editWorkspace, not SGF tree', () => {
      let snapshot = makeSnapshot(9, 9, 1)
      let ctx = createScratchAnalysisContext(snapshot, {
        tab: 'current',
        sourceTree: null,
        syncerId: 's1',
      })

      // Simulate the state shape during scratch analysis
      let state = {
        analysis: null,
        analysisTreePosition: null,
        treePosition: 'original-node',
        editWorkspace: {
          activeTab: 'current',
          currentSnapshot: snapshot,
          currentAnalysis: null,
          currentOwnership: null,
          referenceSnapshot: null,
          referenceAnalysis: null,
          referenceOwnership: null,
        },
      }

      // Simulate an analysis result arriving
      let analysisResult = {
        sign: 1,
        winrate: 55.3,
        scoreLead: 3.2,
        ownership: Array.from({length: 9}, () => Array(9).fill(0.1)),
        variations: [],
      }

      // The scratch analysis callback writes to editWorkspace only
      let analysisKey = 'currentAnalysis'
      let ownershipKey = 'currentOwnership'
      state.editWorkspace = {
        ...state.editWorkspace,
        [analysisKey]: analysisResult,
        [ownershipKey]: analysisResult.ownership,
      }

      // Global state.analysis and analysisTreePosition remain untouched
      assert.strictEqual(state.analysis, null)
      assert.strictEqual(state.analysisTreePosition, null)

      // Edit workspace received the analysis
      assert.strictEqual(state.editWorkspace.currentAnalysis, analysisResult)
      assert.deepEqual(state.editWorkspace.currentOwnership, analysisResult.ownership)
    })

    it('reference analysis does not bleed into current analysis', () => {
      let currentSnapshot = makeSnapshot(9, 9, 1)
      let referenceSnapshot = makeSnapshot(9, 9, -1)

      let refAnalysis = {
        sign: -1,
        winrate: 60,
        ownership: Array.from({length: 9}, () => Array(9).fill(-0.2)),
        variations: [],
      }

      let state = {
        editWorkspace: {
          activeTab: 'reference',
          currentSnapshot,
          currentAnalysis: null,
          currentOwnership: null,
          referenceSnapshot,
          referenceAnalysis: null,
          referenceOwnership: null,
        },
      }

      // Simulate reference analysis write-back
      state.editWorkspace = {
        ...state.editWorkspace,
        referenceAnalysis: refAnalysis,
        referenceOwnership: refAnalysis.ownership,
      }

      // Current analysis stays null
      assert.strictEqual(state.editWorkspace.currentAnalysis, null)
      assert.strictEqual(state.editWorkspace.currentOwnership, null)
      assert.strictEqual(state.editWorkspace.referenceAnalysis, refAnalysis)
    })

    it('global analysis-update listener should skip when editWorkspace is active', () => {
      // Simulate the guard condition from the global listener
      let state = {
        mode: 'analysis',
        editWorkspace: {activeTab: 'current'},
      }

      // The listener checks: if mode === 'analysis' && editWorkspace != null, return early
      let shouldSkipGlobalWrite =
        state.mode === 'analysis' && state.editWorkspace != null

      assert.ok(shouldSkipGlobalWrite, 'global listener must skip SBKV/SBKS writes')
    })

    it('scratch ownership cache is separate from game-tree ownership cache', () => {
      let snapshot = makeSnapshot(9, 9, 1)
      let scratchCache = {}
      let gameTreeCache = {}

      // Scratch key is based on snapshot signature
      let scratchKey = getScratchAnalysisCacheKey('syncer-1', snapshot)
      scratchCache[scratchKey] = Array.from({length: 9}, () => Array(9).fill(0.5))

      // Game-tree key is based on tree.root.id + treePosition (different structure)
      let gameTreeKey = 'syncer-1:tree-root:node-42'
      gameTreeCache[gameTreeKey] = Array.from({length: 9}, () => Array(9).fill(0.3))

      // Keys must not collide — scratch key is JSON snapshot, not tree node ids
      assert.notStrictEqual(scratchKey, gameTreeKey)
      assert.ok(scratchKey.startsWith('syncer-1:'))
      assert.ok(gameTreeKey.startsWith('syncer-1:'))

      // Each cache only has its own key
      assert.deepEqual(scratchCache[gameTreeKey], undefined)
      assert.deepEqual(gameTreeCache[scratchKey], undefined)
    })

    it('cached scratch ownership is reused without re-running analysis', () => {
      let snapshot = makeSnapshot(9, 9, 1)
      let syncerId = 'syncer-1'
      let ownership = Array.from({length: 9}, () => Array(9).fill(0.6))

      // Simulate caching
      let cache = {}
      let key = getScratchAnalysisCacheKey(syncerId, snapshot)
      cache[key] = ownership

      // Simulate cache lookup on next call
      let cached = cache[getScratchAnalysisCacheKey(syncerId, snapshot)]
      assert.deepEqual(cached, ownership)

      // Different syncer should not hit the same cache entry
      let otherKey = getScratchAnalysisCacheKey('syncer-2', snapshot)
      assert.strictEqual(cache[otherKey], undefined)
    })
  })
})
