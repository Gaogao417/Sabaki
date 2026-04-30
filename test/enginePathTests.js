import assert from 'assert'
import nodePath from 'path'

global.window = {
  sabaki: {
    setting: {
      get: (key) => (key === 'gtp.engine_quit_timeout' ? 3000 : null),
    },
  },
}

let resolveEngineExecutable
let parseEngineArgs

function existsFrom(paths) {
  let existing = new Set(paths)

  return (candidate) => existing.has(candidate)
}

describe('engine path handling', () => {
  before(async () => {
    let module = await import('../src/modules/enginesyncer.js')

    resolveEngineExecutable = module.resolveEngineExecutable
    parseEngineArgs = module.parseEngineArgs
  })

  describe('resolveEngineExecutable', () => {
    it('resolves quoted Windows executable paths with spaces', () => {
      let enginePath = 'C:\\Program Files\\KataGo\\katago.exe'
      let result = resolveEngineExecutable(`"${enginePath}"`, {
        platform: 'win32',
        env: {},
        pathModule: nodePath.win32,
        existsSync: existsFrom([enginePath]),
      })

      assert.equal(result.error, null)
      assert.equal(result.path, enginePath)
    })

    it('finds Windows command names with PATHEXT', () => {
      let result = resolveEngineExecutable('katago', {
        platform: 'win32',
        env: {
          PATH: 'C:\\Tools;C:\\KataGo',
          PATHEXT: '.COM;.EXE;.BAT',
        },
        pathModule: nodePath.win32,
        existsSync: existsFrom(['C:\\KataGo\\katago.EXE']),
      })

      assert.equal(result.error, null)
      assert.equal(result.path, 'C:\\KataGo\\katago.EXE')
    })

    it('finds Windows executable paths without an explicit extension', () => {
      let result = resolveEngineExecutable('C:\\KataGo\\katago', {
        platform: 'win32',
        env: {PATHEXT: '.EXE'},
        pathModule: nodePath.win32,
        existsSync: existsFrom(['C:\\KataGo\\katago.EXE']),
      })

      assert.equal(result.error, null)
      assert.equal(result.path, 'C:\\KataGo\\katago.EXE')
    })

    it('does not append PATHEXT to Windows command names that already include an extension', () => {
      let result = resolveEngineExecutable('katago.exe', {
        platform: 'win32',
        env: {PATH: 'C:\\KataGo', PATHEXT: '.EXE'},
        pathModule: nodePath.win32,
        existsSync: existsFrom(['C:\\KataGo\\katago.exe']),
      })

      assert.equal(result.error, null)
      assert.equal(result.path, 'C:\\KataGo\\katago.exe')
    })

    it('resolves macOS executable paths', () => {
      let result = resolveEngineExecutable('/opt/homebrew/bin/katago', {
        platform: 'darwin',
        env: {},
        pathModule: nodePath.posix,
        existsSync: existsFrom(['/opt/homebrew/bin/katago']),
      })

      assert.equal(result.error, null)
      assert.equal(result.path, '/opt/homebrew/bin/katago')
    })

    it('finds macOS command names on PATH', () => {
      let result = resolveEngineExecutable('katago', {
        platform: 'darwin',
        env: {PATH: '/usr/local/bin:/opt/homebrew/bin'},
        pathModule: nodePath.posix,
        existsSync: existsFrom(['/opt/homebrew/bin/katago']),
      })

      assert.equal(result.error, null)
      assert.equal(result.path, '/opt/homebrew/bin/katago')
    })
  })

  describe('parseEngineArgs', () => {
    it('keeps quoted Windows model and config paths intact', () => {
      let result = parseEngineArgs(
        'gtp -model "C:\\KataGo Models\\model.bin.gz" -config "C:\\KataGo\\gtp.cfg"',
      )

      assert.deepEqual(result.args, [
        'gtp',
        '-model',
        'C:\\KataGo Models\\model.bin.gz',
        '-config',
        'C:\\KataGo\\gtp.cfg',
      ])
    })

    it('keeps quoted macOS model and config paths intact', () => {
      let result = parseEngineArgs(
        'gtp -model "/Users/me/KataGo Models/model.bin.gz" -config "/Users/me/KataGo/gtp.cfg"',
      )

      assert.deepEqual(result.args, [
        'gtp',
        '-model',
        '/Users/me/KataGo Models/model.bin.gz',
        '-config',
        '/Users/me/KataGo/gtp.cfg',
      ])
    })

    it('returns a readable error for invalid quoting', () => {
      let result = parseEngineArgs(
        'gtp -model "C:\\KataGo Models\\model.bin.gz',
      )

      assert.equal(result.args, undefined)
      assert.match(result.error, /Invalid engine arguments/)
    })
  })
})
