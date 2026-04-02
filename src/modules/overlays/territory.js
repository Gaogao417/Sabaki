export const TERRITORY_SOLID_THRESHOLD = 0.8
export const TERRITORY_NEUTRAL_THRESHOLD = 0.1

export function classifyOwnershipPoint(
  value,
  {
    solidThreshold = TERRITORY_SOLID_THRESHOLD,
    neutralThreshold = TERRITORY_NEUTRAL_THRESHOLD,
  } = {},
) {
  let ownership = Number(value)
  if (Number.isNaN(ownership)) ownership = 0

  let absOwnership = Math.abs(ownership)
  let owner = absOwnership <= neutralThreshold ? 0 : Math.sign(ownership)
  let bucket =
    owner === 0
      ? 'neutral'
      : absOwnership >= solidThreshold
        ? 'solid'
        : 'influence'

  return {
    ownership,
    absOwnership,
    owner,
    ownerName: owner > 0 ? 'black' : owner < 0 ? 'white' : 'neutral',
    bucket,
  }
}

function createMetricTotals() {
  return {
    sum: 0,
    intersections: 0,
  }
}

function createOwnerStats(owner) {
  return {
    owner,
    total: createMetricTotals(),
    solid: createMetricTotals(),
    influence: createMetricTotals(),
    neutral: createMetricTotals(),
  }
}

function addMetric(target, value) {
  target.sum += value
  target.intersections += 1
}

function serializeMetric(metric) {
  return {
    sum: Math.round(metric.sum * 100) / 100,
    intersections: metric.intersections,
  }
}

function serializeStats(stats) {
  return {
    owner: stats.owner,
    total: serializeMetric(stats.total),
    solid: serializeMetric(stats.solid),
    influence: serializeMetric(stats.influence),
    neutral: serializeMetric(stats.neutral),
  }
}

export function buildTerritorySummary(
  ownership,
  {
    solidThreshold = TERRITORY_SOLID_THRESHOLD,
    neutralThreshold = TERRITORY_NEUTRAL_THRESHOLD,
  } = {},
) {
  if (!Array.isArray(ownership) || ownership.length === 0) {
    return {
      black: serializeStats(createOwnerStats('black')),
      white: serializeStats(createOwnerStats('white')),
      neutral: serializeStats(createOwnerStats('neutral')),
    }
  }

  let summary = {
    black: createOwnerStats('black'),
    white: createOwnerStats('white'),
    neutral: createOwnerStats('neutral'),
  }

  for (let y = 0; y < ownership.length; y++) {
    for (let x = 0; x < ownership[y].length; x++) {
      let point = classifyOwnershipPoint(ownership[y][x], {
        solidThreshold,
        neutralThreshold,
      })

      if (point.owner === 0) {
        addMetric(summary.neutral.total, point.absOwnership)
        addMetric(summary.neutral.neutral, point.absOwnership)
        continue
      }

      let stats = point.owner > 0 ? summary.black : summary.white
      addMetric(stats.total, point.absOwnership)
      addMetric(stats[point.bucket], point.absOwnership)
    }
  }

  return {
    black: serializeStats(summary.black),
    white: serializeStats(summary.white),
    neutral: serializeStats(summary.neutral),
  }
}

export function buildTerritoryPaintMap(
  ownership,
  {
    solidThreshold = TERRITORY_SOLID_THRESHOLD,
    neutralThreshold = TERRITORY_NEUTRAL_THRESHOLD,
  } = {},
) {
  if (!Array.isArray(ownership)) return []

  return ownership.map((row) =>
    row.map((value) => {
      let point = classifyOwnershipPoint(value, {
        solidThreshold,
        neutralThreshold,
      })

      if (point.owner === 0) return 0
      return point.owner * (point.bucket === 'solid' ? 1 : 0.45)
    }),
  )
}

export function buildTerritoryMarkerMap(
  ownership,
  {
    solidThreshold = TERRITORY_SOLID_THRESHOLD,
    neutralThreshold = TERRITORY_NEUTRAL_THRESHOLD,
  } = {},
) {
  if (!Array.isArray(ownership)) return []

  return ownership.map((row) =>
    row.map((value) => {
      let point = classifyOwnershipPoint(value, {
        solidThreshold,
        neutralThreshold,
      })

      return point.owner === 0
        ? {type: 'point', label: '@territory-neutral'}
        : null
    }),
  )
}

export function buildTerritoryRegions(
  ownership,
  {
    solidThreshold = TERRITORY_SOLID_THRESHOLD,
    neutralThreshold = TERRITORY_NEUTRAL_THRESHOLD,
  } = {},
) {
  if (!Array.isArray(ownership) || ownership.length === 0) {
    return {regions: [], regionMap: []}
  }

  let height = ownership.length
  let width = ownership[0].length
  let visited = ownership.map((row) => row.map(() => false))
  let regionMap = ownership.map((row) => row.map(() => null))
  let regions = []

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (visited[y][x]) continue

      let point = classifyOwnershipPoint(ownership[y][x], {
        solidThreshold,
        neutralThreshold,
      })
      let stats = createOwnerStats(point.ownerName)
      let vertices = []
      let stack = [[x, y]]
      let regionId = regions.length

      visited[y][x] = true

      while (stack.length > 0) {
        let [cx, cy] = stack.pop()
        let currentPoint = classifyOwnershipPoint(ownership[cy][cx], {
          solidThreshold,
          neutralThreshold,
        })

        if (currentPoint.owner !== point.owner) continue

        vertices.push([cx, cy])
        regionMap[cy][cx] = regionId

        if (currentPoint.owner === 0) {
          addMetric(stats.total, currentPoint.absOwnership)
          addMetric(stats.neutral, currentPoint.absOwnership)
        } else {
          addMetric(stats.total, currentPoint.absOwnership)
          addMetric(stats[currentPoint.bucket], currentPoint.absOwnership)
        }

        for (let [nx, ny] of [
          [cx - 1, cy],
          [cx + 1, cy],
          [cx, cy - 1],
          [cx, cy + 1],
        ]) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || visited[ny][nx]) {
            continue
          }

          let neighbor = classifyOwnershipPoint(ownership[ny][nx], {
            solidThreshold,
            neutralThreshold,
          })

          if (neighbor.owner !== point.owner) continue
          visited[ny][nx] = true
          stack.push([nx, ny])
        }
      }

      regions.push({
        id: regionId,
        owner: point.ownerName,
        sign: point.owner,
        vertices,
        ...serializeStats(stats),
      })
    }
  }

  return {regions, regionMap}
}

export function getRegionAtVertex(regionData, vertex) {
  if (regionData == null) return null

  let {regions, regionMap} = regionData
  if (!vertex || !regionMap?.[vertex[1]]) return null

  let regionId = regionMap[vertex[1]][vertex[0]]
  return regionId == null ? null : regions[regionId] ?? null
}
