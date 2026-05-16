import path from 'path'

const humanSLPatterns = ['b18c384nbt-humanv0']

export function getKatagoDataPath({isPackaged, resourcesPath, appRoot}) {
  if (isPackaged) {
    return path.join(resourcesPath, 'katago_data')
  }
  return path.join(appRoot, 'katago_data')
}

export function classifyModel(filename) {
  let lower = filename.toLowerCase()
  for (let pattern of humanSLPatterns) {
    if (lower.includes(pattern)) return 'humanSL'
  }
  return 'analysis'
}

export function listBundledModels(dataDir, {readdirSync, statSync}) {
  try {
    let files = readdirSync(dataDir)
    return files
      .filter((f) => f.endsWith('.bin.gz') || f.endsWith('.bin'))
      .map((f) => {
        let fullPath = path.join(dataDir, f)
        let stat = statSync(fullPath)
        return {filename: f, path: fullPath, size: stat.size, kind: classifyModel(f)}
      })
  } catch (err) {
    return []
  }
}

export function selectDefaultAnalysisModel(models) {
  return models.find((m) => m.kind === 'analysis') || null
}

export function getBundledHumanSLModel(models) {
  return models.find((m) => m.kind === 'humanSL') || null
}

export function getBundledConfig(dataDir, {existsSync}) {
  let cfgPath = path.join(dataDir, 'gtp.cfg')
  return {path: cfgPath, available: existsSync(cfgPath)}
}
