export function composeMarkerMaps(...maps) {
  let firstMap = maps.find((map) => Array.isArray(map) && map.length > 0)
  if (firstMap == null) return null

  let height = firstMap.length
  let width = firstMap[0].length
  let composed = [...Array(height)].map((_, y) =>
    [...Array(width)].map((__, x) => {
      for (let i = maps.length - 1; i >= 0; i--) {
        let marker = maps[i]?.[y]?.[x]
        if (marker != null) return marker
      }

      return null
    }),
  )

  return composed
}
