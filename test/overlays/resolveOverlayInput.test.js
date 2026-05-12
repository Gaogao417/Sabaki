import assert from 'assert'

import {resolveOverlayInput, getTerritoryCompareAvailability} from '../../src/modules/overlays/resolveOverlayInput.ts'

function makeRaw(overrides = {}) {
  return {
    territoryMode: false,
    appMode: 'analysis',
    editWorkspaceActive: false,
    territoryCompareActive: false,
    editActiveTab: null,
    analysisPending: false,
    engineSyncerAvailable: true,
    activeAnalysis: null,
    analysisTreePositionMatches: true,
    gameTreeOwnership: null,
    editCurrentOwnership: null,
    editReferenceOwnership: null,
    editWorkspaceCurrentOwnership: null,
    editWorkspaceReferenceOwnership: null,
    editPreviewOwnership: null,
    keyPointSummary: null,
    hoveredVertex: null,
    hoverOwnership: null,
    hoverPending: false,
    basePaintMap: null,
    baseMarkerMap: null,
    heatmapActive: false,
    humanPreferenceActive: false,
    ...overrides,
  }
}

describe('resolveOverlayInput', () => {
  describe('territory mode off', () => {
    it('returns null ownership and empty layers when territoryMode is false', () => {
      let result = resolveOverlayInput(makeRaw({territoryMode: false}))
      assert.strictEqual(result.territoryMode, false)
      assert.strictEqual(result.baselineOwnership, null)
      assert.strictEqual(result.unavailableReason, null)
      assert.deepEqual(result.activeLayerIds, [])
      assert.strictEqual(result.heatmapActive, false)
      assert.strictEqual(result.humanPreferenceActive, false)
    })

    it('passes through heatmap and humanPreference flags when territory off', () => {
      let result = resolveOverlayInput(makeRaw({
        territoryMode: false,
        heatmapActive: true,
        humanPreferenceActive: true,
      }))
      assert.strictEqual(result.heatmapActive, true)
      assert.strictEqual(result.humanPreferenceActive, true)
    })
  })

  describe('unavailable reason codes', () => {
    it('returns scoring-or-estimator when mode is scoring', () => {
      let result = resolveOverlayInput(makeRaw({
        territoryMode: true,
        appMode: 'scoring',
      }))
      assert.strictEqual(result.unavailableReason, 'scoring-or-estimator')
    })

    it('returns scoring-or-estimator when mode is estimator', () => {
      let result = resolveOverlayInput(makeRaw({
        territoryMode: true,
        appMode: 'estimator',
      }))
      assert.strictEqual(result.unavailableReason, 'scoring-or-estimator')
    })

    it('returns analysis-engine-required when no engine syncer', () => {
      let result = resolveOverlayInput(makeRaw({
        territoryMode: true,
        appMode: 'analysis',
        engineSyncerAvailable: false,
      }))
      assert.strictEqual(result.unavailableReason, 'analysis-engine-required')
    })

    it('returns ownership-pending when edit workspace analysis is pending', () => {
      let result = resolveOverlayInput(makeRaw({
        territoryMode: true,
        appMode: 'analysis',
        editWorkspaceActive: true,
        analysisPending: true,
        gameTreeOwnership: null,
      }))
      assert.strictEqual(result.unavailableReason, 'ownership-pending')
    })

    it('returns ownership-pending when compare active but currentOwnership missing', () => {
      let result = resolveOverlayInput(makeRaw({
        territoryMode: true,
        appMode: 'analysis',
        editWorkspaceActive: true,
        territoryCompareActive: true,
        editWorkspaceCurrentOwnership: null,
        editWorkspaceReferenceOwnership: [[0.5]],
      }))
      assert.strictEqual(result.unavailableReason, 'ownership-pending')
    })

    it('returns ownership-pending when analysis tree position does not match', () => {
      let result = resolveOverlayInput(makeRaw({
        territoryMode: true,
        appMode: 'analysis',
        analysisTreePositionMatches: false,
        gameTreeOwnership: null,
      }))
      assert.strictEqual(result.unavailableReason, 'ownership-pending')
    })

    it('returns ownership-unavailable when engine does not provide ownership', () => {
      // Edge case: analysis exists and has ownership field, but getCurrentOwnership
      // returns null (e.g. cache miss). Position matches, analysis present,
      // but baseline ownership is still null.
      let result = resolveOverlayInput(makeRaw({
        territoryMode: true,
        appMode: 'analysis',
        editWorkspaceActive: true,
        analysisTreePositionMatches: true,
        activeAnalysis: {ownership: [[0.5]]},
        editCurrentOwnership: null,
        gameTreeOwnership: null,
      }))
      assert.strictEqual(result.unavailableReason, 'ownership-unavailable')
    })

    it('returns null when all conditions are satisfied', () => {
      let result = resolveOverlayInput(makeRaw({
        territoryMode: true,
        appMode: 'analysis',
        engineSyncerAvailable: true,
        gameTreeOwnership: [[0.5, -0.3], [0.1, 0.9]],
      }))
      assert.strictEqual(result.unavailableReason, null)
    })
  })

  describe('baseline ownership selection', () => {
    it('uses gameTreeOwnership in non-edit mode', () => {
      let ownership = [[0.9, 0.1], [-0.5, 0.3]]
      let result = resolveOverlayInput(makeRaw({
        territoryMode: true,
        editWorkspaceActive: false,
        gameTreeOwnership: ownership,
      }))
      assert.deepEqual(result.baselineOwnership, ownership)
    })

    it('uses edit active tab ownership in edit workspace', () => {
      let ownership = [[0.7, 0.2], [-0.3, 0.8]]
      let result = resolveOverlayInput(makeRaw({
        territoryMode: true,
        editWorkspaceActive: true,
        editCurrentOwnership: ownership,
      }))
      assert.deepEqual(result.baselineOwnership, ownership)
    })

    it('uses reference ownership when compare active', () => {
      let refOwnership = [[0.6, 0.4], [-0.2, 0.7]]
      let result = resolveOverlayInput(makeRaw({
        territoryMode: true,
        editWorkspaceActive: true,
        territoryCompareActive: true,
        editWorkspaceReferenceOwnership: refOwnership,
        editWorkspaceCurrentOwnership: [[0.5, 0.3], [-0.1, 0.6]],
      }))
      assert.deepEqual(result.baselineOwnership, refOwnership)
    })
  })

  describe('territory compare delta', () => {
    it('computes delta from reference to current when compare active', () => {
      let refOwnership = [[0.8, 0.2], [-0.5, 0.6]]
      let curOwnership = [[0.6, 0.4], [-0.3, 0.8]]
      let result = resolveOverlayInput(makeRaw({
        territoryMode: true,
        editWorkspaceActive: true,
        territoryCompareActive: true,
        editWorkspaceReferenceOwnership: refOwnership,
        editWorkspaceCurrentOwnership: curOwnership,
      }))

      assert.ok(result.lastMoveDeltaMap != null)
      // Delta = current - reference
      assert.ok(Math.abs(result.lastMoveDeltaMap[0][0] - (-0.2)) < 1e-10)
      assert.ok(Math.abs(result.lastMoveDeltaMap[0][1] - 0.2) < 1e-10)
      assert.strictEqual(result.lastMoveDiffAvailable, true)
      assert.strictEqual(result.diffSourceType, 'workspace')
    })

    it('returns no delta when compare not active', () => {
      let result = resolveOverlayInput(makeRaw({
        territoryMode: true,
        editWorkspaceActive: false,
        gameTreeOwnership: [[0.5]],
      }))
      assert.strictEqual(result.lastMoveDeltaMap, null)
      assert.strictEqual(result.lastMoveDiffAvailable, false)
    })
  })

  describe('active layer IDs', () => {
    it('includes ownership-paint when ownership available', () => {
      let result = resolveOverlayInput(makeRaw({
        territoryMode: true,
        gameTreeOwnership: [[0.5, -0.3]],
      }))
      assert.ok(result.activeLayerIds.includes('ownership-paint'))
    })

    it('includes territory-diff-marker when delta available', () => {
      let result = resolveOverlayInput(makeRaw({
        territoryMode: true,
        editWorkspaceActive: true,
        territoryCompareActive: true,
        editWorkspaceReferenceOwnership: [[0.8, 0.2]],
        editWorkspaceCurrentOwnership: [[0.6, 0.4]],
      }))
      assert.ok(result.activeLayerIds.includes('territory-diff-marker'))
      assert.ok(result.activeLayerIds.includes('ownership-paint'))
    })

    it('returns empty layers when unavailable', () => {
      let result = resolveOverlayInput(makeRaw({
        territoryMode: true,
        appMode: 'scoring',
        gameTreeOwnership: [[0.5]],
      }))
      assert.deepEqual(result.activeLayerIds, [])
    })

    it('passes through heatmap and humanPreference flags', () => {
      let result = resolveOverlayInput(makeRaw({
        territoryMode: true,
        gameTreeOwnership: [[0.5]],
        heatmapActive: true,
        humanPreferenceActive: true,
      }))
      assert.strictEqual(result.heatmapActive, true)
      assert.strictEqual(result.humanPreferenceActive, true)
    })
  })
})

describe('getTerritoryCompareAvailability', () => {
  it('returns true when analysis mode with reference snapshot', () => {
    assert.strictEqual(
      getTerritoryCompareAvailability({
        appMode: 'analysis',
        editWorkspaceReferenceSnapshot: {signMap: [[1]]},
      }),
      true,
    )
  })

  it('returns false when not analysis mode', () => {
    assert.strictEqual(
      getTerritoryCompareAvailability({
        appMode: 'play',
        editWorkspaceReferenceSnapshot: {signMap: [[1]]},
      }),
      false,
    )
  })

  it('returns false when no reference snapshot', () => {
    assert.strictEqual(
      getTerritoryCompareAvailability({
        appMode: 'analysis',
        editWorkspaceReferenceSnapshot: null,
      }),
      false,
    )
  })
})
