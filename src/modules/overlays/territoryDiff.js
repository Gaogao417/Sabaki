import {classifyOwnershipPoint} from './territory.js'

function createMetricTotals() {
  return {
    sum: 0,
    intersections: 0,
  }
}

function createDeltaStats() {
  return {
    strengthened: createMetricTotals(),
    weakened: createMetricTotals(),
  }
}

function addDeltaMetric(target, value) {
  target.sum += Math.abs(value)
  target.intersections += 1
}

function serializeMetric(metric) {
  return {
    sum: Math.round(metric.sum * 100) / 100,
    intersections: metric.intersections,
  }
}

function serializeDeltaStats(stats) {
  return {
    strengthened: serializeMetric(stats.strengthened),
    weakened: serializeMetric(stats.weakened),
  }
}

function getCompareTerritoryDeltaDirection(owner, delta) {
  if (owner === 0 || delta == null || !Number.isFinite(delta) || delta === 0) {
    return null
  }

  return Math.sign(delta) === owner ? 'strengthened' : 'weakened'
}

export function buildOwnershipDeltaSummary(deltaMap) {
  let stats = {
    black: createMetricTotals(),
    white: createMetricTotals(),
  }

  if (!Array.isArray(deltaMap) || deltaMap.length === 0) {
    return {
      black: serializeMetric(stats.black),
      white: serializeMetric(stats.white),
    }
  }

  for (let row of deltaMap) {
    for (let value of row) {
      let delta = Number(value)
      if (!Number.isFinite(delta) || delta === 0) continue

      let target = delta > 0 ? stats.black : stats.white
      addDeltaMetric(target, delta)
    }
  }

  return {
    black: serializeMetric(stats.black),
    white: serializeMetric(stats.white),
  }
}

export function buildCompareTerritoryMarkerMap(
  ownership,
  deltaMap,
  comparisonOwnership = null,
) {
  if (!Array.isArray(ownership)) return []

  let getMarkerSizeLevel = (delta) => {
    let absDelta = Math.abs(delta)
    if (absDelta >= 0.6) return 3
    if (absDelta >= 0.35) return 2
    return absDelta >= 0.15 ? 1 : 0
  }

  return ownership.map((row, y) =>
    row.map((value, x) => {
      let point = classifyOwnershipPoint(value)
      let fallbackPoint =
        comparisonOwnership == null
          ? point
          : classifyOwnershipPoint(comparisonOwnership?.[y]?.[x] ?? 0)
      let ownerPoint = point.owner !== 0 ? point : fallbackPoint
      let delta = deltaMap?.[y]?.[x] ?? 0
      let deltaDirection = getCompareTerritoryDeltaDirection(
        ownerPoint.owner,
        delta,
      )
      let sizeLevel = getMarkerSizeLevel(delta)

      if (deltaDirection != null && sizeLevel > 0) {
        return {
          type: 'point',
          label: `@territory-delta-${deltaDirection}-${sizeLevel}`,
        }
      }

      return point.owner === 0
        ? {type: 'point', label: '@territory-neutral'}
        : null
    }),
  )
}

export function summarizeCompareTerritoryRegion(region, deltaMap) {
  if (region == null || !Array.isArray(region.vertices)) {
    return serializeDeltaStats(createDeltaStats())
  }

  let stats = createDeltaStats()

  for (let [x, y] of region.vertices) {
    let delta = deltaMap?.[y]?.[x] ?? 0
    let direction = getCompareTerritoryDeltaDirection(region.sign, delta)
    if (direction == null) continue
    addDeltaMetric(stats[direction], delta)
  }

  return serializeDeltaStats(stats)
}

export function getDeltaAtVertex(deltaMap, vertex) {
  if (!vertex || !deltaMap?.[vertex[1]]) return null

  let value = Number(deltaMap[vertex[1]][vertex[0]])
  return Number.isFinite(value) ? value : null
}
