function createMetricTotals() {
  return {
    sum: 0,
    intersections: 0,
  }
}

function createDeltaStats() {
  return {
    black: createMetricTotals(),
    white: createMetricTotals(),
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
    black: serializeMetric(stats.black),
    white: serializeMetric(stats.white),
  }
}

function getDeltaColor(delta) {
  if (delta == null || !Number.isFinite(delta) || delta === 0) return null
  return delta > 0 ? 'black' : 'white'
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

export function buildCompareTerritoryMarkerMap(deltaMap) {
  if (!Array.isArray(deltaMap)) return []

  let getMarkerSizeLevel = (delta) => {
    let absDelta = Math.abs(delta)
    if (absDelta >= 0.6) return 3
    if (absDelta >= 0.35) return 2
    return absDelta >= 0.15 ? 1 : 0
  }

  return deltaMap.map((row) =>
    row.map((value) => {
      let delta = Number(value)
      let color = getDeltaColor(delta)
      let sizeLevel = getMarkerSizeLevel(delta)

      if (color != null && sizeLevel > 0) {
        return {
          type: 'point',
          label: `@territory-delta-${color}-${sizeLevel}`,
        }
      }

      return null
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
    let color = getDeltaColor(delta)
    if (color == null) continue
    addDeltaMetric(stats[color], delta)
  }

  return serializeDeltaStats(stats)
}

export function getDeltaAtVertex(deltaMap, vertex) {
  if (!vertex || !deltaMap?.[vertex[1]]) return null

  let value = Number(deltaMap[vertex[1]][vertex[0]])
  return Number.isFinite(value) ? value : null
}
