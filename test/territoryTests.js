import assert from 'assert'

import {
  classifyOwnershipPoint,
  buildTerritorySummary,
  buildTerritoryRegions,
  buildTerritoryPaintMap,
  buildTerritoryMarkerMap,
  getRegionAtVertex,
} from '../src/modules/territory.js'

describe('territory', () => {
  it('classifies ownership thresholds consistently', () => {
    assert.equal(classifyOwnershipPoint(0.8).bucket, 'solid')
    assert.equal(classifyOwnershipPoint(0.79).bucket, 'influence')
    assert.equal(classifyOwnershipPoint(0.1).owner, 0)
    assert.equal(classifyOwnershipPoint(-0.9).ownerName, 'white')
  })

  it('summarizes black, white, and neutral totals', () => {
    let summary = buildTerritorySummary([
      [0.9, 0.4, 0.05],
      [-0.95, -0.25, 0],
    ])

    assert.deepEqual(summary.black, {
      owner: 'black',
      total: {sum: 1.3, intersections: 2},
      solid: {sum: 0.9, intersections: 1},
      influence: {sum: 0.4, intersections: 1},
      neutral: {sum: 0, intersections: 0},
    })
    assert.deepEqual(summary.white, {
      owner: 'white',
      total: {sum: 1.2, intersections: 2},
      solid: {sum: 0.95, intersections: 1},
      influence: {sum: 0.25, intersections: 1},
      neutral: {sum: 0, intersections: 0},
    })
    assert.deepEqual(summary.neutral.total, {sum: 0.05, intersections: 2})
  })

  it('splits disconnected regions and looks them up by vertex', () => {
    let data = buildTerritoryRegions([
      [0.9, 0.9, 0],
      [0.9, 0, -0.9],
      [0, -0.9, -0.9],
    ])

    let blackRegion = getRegionAtVertex(data, [0, 0])
    let whiteRegion = getRegionAtVertex(data, [2, 2])
    let neutralRegion = getRegionAtVertex(data, [2, 0])

    assert.equal(blackRegion.owner, 'black')
    assert.equal(blackRegion.vertices.length, 3)
    assert.equal(whiteRegion.owner, 'white')
    assert.equal(whiteRegion.vertices.length, 3)
    assert.equal(neutralRegion.owner, 'neutral')
    assert.equal(neutralRegion.vertices.length, 1)
  })

  it('builds territory paint and neutral marker maps', () => {
    let ownership = [
      [0.95, 0.4, 0.05],
      [-0.9, -0.2, 0],
    ]

    assert.deepEqual(buildTerritoryPaintMap(ownership), [
      [1, 0.45, 0],
      [-1, -0.45, 0],
    ])
    assert.deepEqual(buildTerritoryMarkerMap(ownership), [
      [null, null, {type: 'point', label: '@territory-neutral'}],
      [null, null, {type: 'point', label: '@territory-neutral'}],
    ])
  })
})
