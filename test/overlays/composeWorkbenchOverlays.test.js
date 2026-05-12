import assert from 'assert'

import {resolveOverlayInput} from '../../src/modules/overlays/resolveOverlayInput.ts'
import {composeWorkbenchOverlays} from '../../src/modules/overlays/composeWorkbenchOverlays.ts'

function makeResolved(overrides = {}) {
  return resolveOverlayInput({
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
  })
}

describe('composeWorkbenchOverlays', () => {
  it('returns base paint/marker and null status when overlay is off', () => {
    let basePaint = [[0.5, 0], [0, -0.3]]
    let baseMarkers = [[null, null], [{type: 'circle'}, null]]
    let input = makeResolved({
      basePaintMap: basePaint,
      baseMarkerMap: baseMarkers,
    })
    let result = composeWorkbenchOverlays(input)

    assert.deepEqual(result.paintMap, basePaint)
    assert.deepEqual(result.markerMap, baseMarkers)
    assert.strictEqual(result.statusProps, null)
    assert.strictEqual(result.className, '')
    assert.deepEqual(result.layers, [])
  })

  it('generates territory paint, summary, and territory-mode class', () => {
    let ownership = [
      [0.9, 0.4, 0.05],
      [-0.95, -0.25, 0],
    ]
    let input = makeResolved({
      territoryMode: true,
      gameTreeOwnership: ownership,
    })
    let result = composeWorkbenchOverlays(input)

    assert.strictEqual(result.className, 'territory-mode')
    assert.ok(result.paintMap != null)
    assert.strictEqual(result.paintMap.length, 2)
    assert.strictEqual(result.paintMap[0].length, 3)
    // Black solid => 1, black influence => 0.45, neutral => 0
    assert.strictEqual(result.paintMap[0][0], 1)
    assert.strictEqual(result.paintMap[0][1], 0.45)
    assert.strictEqual(result.paintMap[0][2], 0)

    assert.ok(result.statusProps != null)
    assert.strictEqual(result.statusProps.territoryMode, true)
    assert.ok(result.statusProps.territorySummary != null)
    assert.strictEqual(result.statusProps.territorySummary.black.total.sum, 1.3)
    assert.strictEqual(result.statusProps.territorySummary.white.total.sum, 1.2)

    assert.ok(result.layers.includes('ownership-paint'))
  })

  it('returns warning status without territory paint when unavailable', () => {
    let input = makeResolved({
      territoryMode: true,
      appMode: 'scoring',
      basePaintMap: [[0, 0]],
      baseMarkerMap: null,
    })
    let result = composeWorkbenchOverlays(input)

    assert.deepEqual(result.paintMap, [[0, 0]])
    assert.strictEqual(result.markerMap, null)
    assert.ok(result.statusProps != null)
    assert.strictEqual(
      result.statusProps.unavailableReason,
      'scoring-or-estimator',
    )
    assert.strictEqual(result.statusProps.territorySummary, null)
    assert.deepEqual(result.layers, [])
  })

  it('produces diff markers and summary when delta map is active', () => {
    let refOwnership = [
      [0.9, 0.9, 0],
      [0.9, 0, -0.9],
    ]
    let curOwnership = [
      [0.5, 0.6, 0],
      [0.7, 0.5, -0.5],
    ]
    let input = makeResolved({
      territoryMode: true,
      editWorkspaceActive: true,
      territoryCompareActive: true,
      editWorkspaceReferenceOwnership: refOwnership,
      editWorkspaceCurrentOwnership: curOwnership,
    })
    let result = composeWorkbenchOverlays(input)

    assert.ok(result.statusProps != null)
    assert.ok(result.statusProps.deltaSummary != null)
    assert.strictEqual(result.statusProps.diffSourceType, 'workspace')

    // Diff markers should be composed into the marker map
    assert.ok(result.markerMap != null)
    assert.ok(result.layers.includes('territory-diff-marker'))
    assert.ok(result.layers.includes('ownership-paint'))
  })

  it('prioritizes hover delta over last-move delta', () => {
    let ownership = [
      [0.9, 0.4, 0.05],
      [-0.9, -0.2, 0],
    ]
    let hoverOwnership = [
      [0.5, 0.3, 0.05],
      [-0.7, -0.1, 0],
    ]
    let input = makeResolved({
      territoryMode: true,
      gameTreeOwnership: ownership,
      hoverOwnership,
    })
    let result = composeWorkbenchOverlays(input)

    assert.ok(result.statusProps != null)
    assert.strictEqual(result.statusProps.diffSourceType, 'hover')
  })

  it('layers are sorted by OVERLAY_LAYERS priority', () => {
    let refOwnership = [
      [0.9, 0.9, 0],
      [0.9, 0, -0.9],
    ]
    let curOwnership = [
      [0.5, 0.6, 0],
      [0.7, 0.5, -0.5],
    ]
    let input = makeResolved({
      territoryMode: true,
      editWorkspaceActive: true,
      territoryCompareActive: true,
      editWorkspaceReferenceOwnership: refOwnership,
      editWorkspaceCurrentOwnership: curOwnership,
      heatmapActive: true,
      humanPreferenceActive: true,
    })
    let result = composeWorkbenchOverlays(input)

    // ownership-paint (priority 10) should come before territory-diff-marker (priority 20)
    // which should come before heatmap (priority 30) and human-preference (priority 40)
    let ownershipIdx = result.layers.indexOf('ownership-paint')
    let diffIdx = result.layers.indexOf('territory-diff-marker')
    let heatmapIdx = result.layers.indexOf('heatmap')
    let humanIdx = result.layers.indexOf('human-preference')

    assert.ok(ownershipIdx >= 0)
    assert.ok(diffIdx >= 0)
    assert.ok(heatmapIdx >= 0)
    assert.ok(humanIdx >= 0)
    assert.ok(ownershipIdx < diffIdx)
    assert.ok(diffIdx < heatmapIdx)
    assert.ok(heatmapIdx < humanIdx)
  })

  it('returns territory off paint/marker when territory mode off', () => {
    let basePaint = [[0.5, 0], [0, -0.3]]
    let input = makeResolved({
      territoryMode: false,
      basePaintMap: basePaint,
    })
    let result = composeWorkbenchOverlays(input)

    assert.deepEqual(result.paintMap, basePaint)
    assert.strictEqual(result.statusProps, null)
  })

  it('blends territory paint with base area paint', () => {
    let ownership = [[0.9, -0.5]]
    let basePaint = [[-0.3, -0.7]]
    let input = makeResolved({
      territoryMode: true,
      gameTreeOwnership: ownership,
      basePaintMap: basePaint,
    })
    let result = composeWorkbenchOverlays(input)

    assert.ok(result.paintMap != null)
    // ownership-paint value 1 at [0][0], base is negative, value non-zero => value * 0.55
    assert.strictEqual(result.paintMap[0][0], 0.55)
    // ownership-paint value -0.45 (influence) at [0][1], base is negative, value non-zero => -0.45 * 0.55
    assert.ok(Math.abs(result.paintMap[0][1] - (-0.45 * 0.55)) < 1e-10)
  })
})
