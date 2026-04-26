const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..')
const katagoDataDir = path.resolve(repoRoot, 'katago_data')
const katagoConfigPath = path.resolve(katagoDataDir, 'gtp.cfg')
const katagoModelPath = path.resolve(
  katagoDataDir,
  'kata1-b18c384nbt-s9996604416-d4316597426.bin.gz',
)

function findExecutable(name) {
  let pathExts =
    process.platform === 'win32'
      ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';')
      : ['']

  for (let dir of (process.env.PATH || '').split(path.delimiter)) {
    for (let ext of pathExts) {
      let candidate = path.resolve(dir, name + ext)
      if (fs.existsSync(candidate)) return candidate
    }
  }

  return null
}

function getKatagoBinaryPath() {
  let candidates = [
    process.env.KATAGO_BIN,
    path.resolve(
      katagoDataDir,
      process.platform === 'win32' ? 'katago.exe' : 'katago',
    ),
    findExecutable('katago'),
  ].filter(Boolean)

  return candidates.find((candidate) => fs.existsSync(candidate)) || null
}

function getKatagoEngine() {
  let katagoBin = getKatagoBinaryPath()

  if (katagoBin == null) return null
  if (!fs.existsSync(katagoConfigPath) || !fs.existsSync(katagoModelPath)) {
    return null
  }

  return {
    name: 'KataGo Test Fixture',
    path: katagoBin,
    args: [
      'gtp',
      `-model "${katagoModelPath}"`,
      `-config "${katagoConfigPath}"`,
      '-override-config',
      [
        'maxVisits=8',
        'numSearchThreads=1',
        'logAllGTPCommunication=false',
        'logSearchInfo=false',
        'logToStderr=false',
      ].join(','),
    ].join(' '),
  }
}

module.exports = {
  katagoDataDir,
  katagoConfigPath,
  katagoModelPath,
  getKatagoBinaryPath,
  getKatagoEngine,
}
