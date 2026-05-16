/**
 * Engine config normalization and HumanSL detection contract tests.
 *
 * Test contract: docs/design/2026-05-16/gtp-console-improvements/test-contract-v0.2.md
 * Contracts covered:
 *   R3-C01 through R3-C08 (normalizeEngineConfig)
 *   R3-C09 through R3-C13 + R3-C13b (detectHumanSL)
 *   R3-N01 through R3-N04 (normalizeEngineConfig — v0.2 additions)
 *   R3-N05 (detectHumanSL — v0.2 addition)
 *
 * Run with: npx mocha --require tsx test/engineServiceConfig.test.js
 *
 * Test Legitimacy:
 *   All tests import production code paths, no local reimplementation.
 *   Production module missing -> tests FAIL (import error), no silent pass.
 */

import assert from 'assert'

// ---------------------------------------------------------------------------
// Global stubs required by enginesyncer.js and engineService.js module-level
// code. Must be set BEFORE dynamic imports below.
//
// - window.sabaki.setting: used by enginesyncer.js at module evaluation time
// - Audio / AudioContext: used by sound.js (pulled in via engineService.js ->
//   dialog.js -> sabaki.js -> sound.js) at module evaluation time
//
// See ensureGlobalStubs() below -- called at module level and again in
// before() hooks for resilience against other test files overwriting globals.
// ---------------------------------------------------------------------------

// Dynamic imports assigned in before() to guarantee global.window is set first.
let createEngineService
let EngineSyncer
let formatEngineCommandLine

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Ensure global stubs are in place. Called both at module level and inside
 * before() hooks, because other test files (e.g. enginePathTests.js) may
 * overwrite global.window between our module-level setup and our dynamic
 * imports.
 */
function ensureGlobalStubs() {
  global.window ??= {}
  global.window.sabaki ??= {}
  global.window.sabaki.setting ??= {}
  if (!global.window.sabaki.setting.get) {
    global.window.sabaki.setting.get = (key) =>
      key === 'gtp.engine_quit_timeout' ? 3000 : null
  }
  if (!global.window.sabaki.setting.onDidChange) {
    global.window.sabaki.setting.onDidChange = () => {}
  }
  if (!global.Audio) {
    global.Audio = class Audio {
      play() {
        return Promise.resolve()
      }
    }
  }
  if (!global.AudioContext) {
    global.AudioContext = class AudioContext {
      createOscillator() {
        return {connect: () => {}, start: () => {}}
      }
      createGain() {
        return {connect: () => {}, gain: {setValueAtTime: () => {}}}
      }
      close() {}
    }
  }
}

// Run once at module level for our own dynamic imports.
ensureGlobalStubs()

/**
 * Create a minimal engineService with only the deps needed for
 * normalizeEngineConfig. No real filesystem or engine process required.
 */
function createServiceForConfig() {
  return createEngineService({
    getSetting: () => null,
    getPlayer: () => 1,
    getGameTree: () => null,
    getTreePosition: () => null,
    getMode: () => 'play',
    getEditWorkspace: () => null,
    getGameIndex: () => 0,
    getGameTrees: () => [],
    setCurrentTreePosition: () => {},
    analyzeMove: () => {},
    scheduleEditWorkspaceAnalysis: () => {},
    scheduleLiveAnalysis: () => {},
    syncEditWorkspaceToCurrentPosition: () => {},
    cacheOwnership: () => {},
    saveCurrentGame: async () => {},
    startRecallSession: async () => {},
    stopEngineGameTraining: async () => {},
    setBusy: () => {},
    showInfoOverlay: () => {},
    hideInfoOverlay: () => {},
    showMessageBox: async () => {},
    notifyChange: () => {},
    getUserDataDirectory: () => '/tmp/sabaki-test-userdata',
    notifyAnalysisUpdate: () => {},
  })
}

/**
 * Create an EngineSyncer with a controller that has a mocked process and
 * sendCommand. Uses /bin/echo as a valid executable path so the constructor
 * does not set pathError.
 *
 * @param {object} opts
 * @param {string[]} [opts.commands] - commands to set on syncer
 * @param {Function} [opts.sendCommand] - mock sendCommand implementation
 */
function createSyncerForHumanSL({commands = [], sendCommand = null} = {}) {
  let syncer = new EngineSyncer({
    path: '/bin/echo',
    args: '',
    commands: '',
  })

  // The controller was created but the engine is not started, so process is
  // null. detectHumanSL requires process != null. Set a fake process.
  if (syncer.controller) {
    syncer.controller.process = {}

    if (sendCommand) {
      syncer.controller.sendCommand = sendCommand
    }
  }

  syncer.commands = commands

  return syncer
}

// ---------------------------------------------------------------------------
// Tests: normalizeEngineConfig (R3-C01 through R3-C08)
// ---------------------------------------------------------------------------

describe('normalizeEngineConfig', () => {
  let service

  before(async () => {
    // Re-establish global stubs before dynamic import, in case another test
    // file (e.g. enginePathTests.js) has overwritten global.window.
    ensureGlobalStubs()

    let engineServiceModule =
      await import('../src/modules/engine/engineService.js')
    createEngineService = engineServiceModule.createEngineService
    formatEngineCommandLine = engineServiceModule.formatEngineCommandLine
    service = createServiceForConfig()
  })

  // ─── R3-C01: no duplicate gtp subcommand ────────────────────
  //
  // Production subject: engineService.js -> normalizeEngineConfig
  // Production bug: args contains "gtp gtp" causing KataGo startup failure

  it('R3-C01: does not duplicate the gtp subcommand when args already starts with gtp', () => {
    let result = service.normalizeEngineConfig({
      name: 'KataGo',
      path: '/opt/homebrew/bin/katago',
      args: 'gtp -model "/path/model.bin.gz"',
    })

    let gtpCount = (result.args.match(/\bgtp\b/g) || []).length
    assert.equal(
      gtpCount,
      1,
      `Expected exactly 1 "gtp" token, got ${gtpCount}: ${result.args}`,
    )
  })

  // ─── R3-C02: gtp appears once, flags follow in correct order ─
  //
  // Production subject: engineService.js -> normalizeEngineConfig
  // Production bug: -model or -config before gtp breaks KataGo

  it('R3-C02: gtp subcommand precedes -model and -config flags', () => {
    let result = service.normalizeEngineConfig({
      name: 'KataGo',
      path: '/opt/homebrew/bin/katago',
      args: 'gtp -model "/path/model.bin.gz" -config "/path/gtp.cfg"',
    })

    let args = result.args
    let gtpIndex = args.indexOf('gtp')
    let modelIndex = args.indexOf('-model')
    let configIndex = args.indexOf('-config')

    assert.ok(gtpIndex >= 0, `args must contain "gtp": ${args}`)
    assert.ok(modelIndex >= 0, `args must contain "-model": ${args}`)
    assert.ok(configIndex >= 0, `args must contain "-config": ${args}`)
    assert.ok(gtpIndex < modelIndex, `"gtp" must come before "-model": ${args}`)
    assert.ok(
      gtpIndex < configIndex,
      `"gtp" must come before "-config": ${args}`,
    )

    // Structural: no duplicate "gtp gtp" subcommand.
    // We check that the args do not contain "gtp gtp" (the regression bug),
    // rather than counting all occurrences of the word "gtp" (which would
    // false-positive on paths like "gtp.cfg").
    assert.ok(
      !args.includes('gtp gtp'),
      `args must not contain duplicate "gtp gtp": ${args}`,
    )
  })

  // ─── R3-C03: -human-model placed after gtp, before user args ─
  //
  // Production subject: engineService.js -> normalizeEngineConfig
  // Production bug: -human-model before gtp causes KataGo parse failure

  it('R3-C03: -human-model is placed after gtp and before user-provided args', () => {
    let result = service.normalizeEngineConfig({
      name: 'KataGo',
      path: '/opt/homebrew/bin/katago',
      args: 'gtp -model "/path/model.bin.gz"',
      enableHumanSL: true,
      humanModelPath: '/tmp/human-model.bin.gz',
    })

    let args = result.args
    let gtpIndex = args.indexOf('gtp')
    let humanModelIndex = args.indexOf('-human-model')
    // "user-provided" args that remain after stripping "gtp": "-model ..."
    let modelIndex = args.indexOf('-model')

    assert.ok(humanModelIndex >= 0, `args must contain "-human-model": ${args}`)
    assert.ok(
      gtpIndex < humanModelIndex,
      `"gtp" must come before "-human-model": ${args}`,
    )
    assert.ok(
      humanModelIndex < modelIndex,
      `"-human-model" must come before user-provided "-model": ${args}`,
    )
  })

  // ─── R3-C04: empty args produces just "gtp" ────────────────
  //
  // Production subject: engineService.js -> normalizeEngineConfig
  // Production bug: edge case where empty args breaks KataGo invocation

  it('R3-C04: empty args produces "gtp" subcommand only', () => {
    let result = service.normalizeEngineConfig({
      name: 'KataGo',
      path: '/opt/homebrew/bin/katago',
      args: '',
    })

    assert.equal(
      result.args,
      'gtp',
      `Expected exactly "gtp", got: "${result.args}"`,
    )
  })

  // ─── R3-C05: enableHumanSL includes -human-model flag ──────
  //
  // Production subject: engineService.js -> normalizeEngineConfig
  // Production bug: HumanSL functionality silently disabled

  it('R3-C05: enableHumanSL=true includes -human-model flag in args', () => {
    let result = service.normalizeEngineConfig({
      name: 'KataGo',
      path: '/opt/homebrew/bin/katago',
      args: 'gtp',
      enableHumanSL: true,
      humanModelPath: '/tmp/human-model.bin.gz',
    })

    assert.ok(
      result.args.includes('-human-model'),
      `args must contain "-human-model": ${result.args}`,
    )
    assert.ok(
      result.args.includes('/tmp/human-model.bin.gz'),
      `args must contain human model path: ${result.args}`,
    )
  })

  // ─── R3-C06: non-KataGo engines pass through unchanged ─────
  //
  // Production subject: engineService.js -> normalizeEngineConfig
  // Production bug: Leela Zero or other engines broken by KataGo-specific processing

  it('R3-C06: non-KataGo engines leave args unchanged', () => {
    let originalArgs = 'gtp -w /dev/null'
    let result = service.normalizeEngineConfig({
      name: 'Leela Zero',
      path: '/usr/bin/leelaz',
      args: originalArgs,
    })

    assert.equal(result.args, originalArgs)
  })

  // ─── R3-C07: preserves engine fields ──────────────────────
  //
  // Production subject: engineService.js -> normalizeEngineConfig
  // Production bug: config normalization discards user settings

  it('R3-C07: preserves id, name, path, and other engine fields', () => {
    let result = service.normalizeEngineConfig({
      id: 'my-engine-42',
      name: 'KataGo',
      path: '/opt/homebrew/bin/katago',
      args: 'gtp',
      customField: 'preserved',
      commands: 'list_commands',
    })

    assert.equal(result.id, 'my-engine-42')
    assert.equal(result.name, 'KataGo')
    assert.equal(result.path, '/opt/homebrew/bin/katago')
    assert.equal(result.customField, 'preserved')
    assert.equal(result.commands, 'list_commands')
  })

  // ─── R3-C08: extra whitespace handled correctly ───────────
  //
  // Production subject: engineService.js -> normalizeEngineConfig
  // Production bug: trailing/leading spaces break engine startup

  it('R3-C08: extra whitespace in args produces correctly formatted output', () => {
    let result = service.normalizeEngineConfig({
      name: 'KataGo',
      path: '/opt/homebrew/bin/katago',
      args: '  gtp  -model foo  ',
    })

    let args = result.args

    // No leading/trailing whitespace
    assert.equal(
      args,
      args.trim(),
      `args should have no leading/trailing whitespace: "${args}"`,
    )

    // gtp appears exactly once
    let gtpCount = (args.match(/\bgtp\b/g) || []).length
    assert.equal(gtpCount, 1, `"gtp" must appear exactly once: ${args}`)

    // -model flag preserved
    assert.ok(args.includes('-model'), `args must contain "-model": ${args}`)

    // No double spaces in output
    assert.ok(
      !args.includes('  '),
      `args should not contain double spaces: "${args}"`,
    )
  })

  // ─── R3-N01: auto-prepend gtp, quoted paths with spaces survive ─
  //
  // Production subject: engineService.js -> normalizeEngineConfig
  // Production bug: args without "gtp" prefix not auto-prepended, or
  //   quoted paths with spaces get split/broken during normalization.

  it('R3-N01: auto-prepends gtp when args lack gtp prefix; quoted paths with spaces survive', () => {
    let result = service.normalizeEngineConfig({
      name: 'KataGo',
      path: '/opt/homebrew/bin/katago',
      args: '-model "/path with spaces/model.bin.gz" -config "/path with spaces/gtp.cfg"',
    })

    let args = result.args

    // gtp is at the start
    assert.ok(args.startsWith('gtp'), `args must start with "gtp": ${args}`)

    // gtp appears exactly once as a subcommand (check no "gtp gtp")
    assert.ok(
      !args.includes('gtp gtp'),
      `args must not contain "gtp gtp": ${args}`,
    )

    // Flags are preserved
    assert.ok(args.includes('-model'), `args must contain "-model": ${args}`)
    assert.ok(args.includes('-config'), `args must contain "-config": ${args}`)

    // Quoted paths with spaces survive intact
    assert.ok(
      args.includes('"/path with spaces/model.bin.gz"'),
      `args must preserve quoted model path with spaces: ${args}`,
    )
    assert.ok(
      args.includes('"/path with spaces/gtp.cfg"'),
      `args must preserve quoted config path with spaces: ${args}`,
    )
  })

  // ─── R3-N02: auto-prepend gtp for simple flags without gtp prefix ─
  //
  // Production subject: engineService.js -> normalizeEngineConfig
  // Production bug: args starting with flags (not "gtp") not auto-prepended.

  it('R3-N02: auto-prepends gtp when args start with flags and lack gtp prefix', () => {
    let result = service.normalizeEngineConfig({
      name: 'KataGo',
      path: '/opt/homebrew/bin/katago',
      args: '-model foo -config bar',
    })

    let args = result.args

    assert.ok(args.startsWith('gtp'), `args must start with "gtp": ${args}`)

    // Original flags preserved after gtp
    assert.ok(args.includes('-model'), `args must contain "-model": ${args}`)
    assert.ok(args.includes('-config'), `args must contain "-config": ${args}`)
  })

  // ─── R3-N03: default humanModelPath when enableHumanSL but no path ─
  //
  // Production subject: engineService.js -> normalizeEngineConfig
  // Production bug: enableHumanSL without explicit humanModelPath produces
  //   no -human-model flag or uses wrong default path.

  it('R3-N03: enableHumanSL=true with empty humanModelPath uses default model path', () => {
    let result = service.normalizeEngineConfig({
      name: 'KataGo',
      path: '/opt/homebrew/bin/katago',
      args: 'gtp',
      enableHumanSL: true,
      // humanModelPath intentionally omitted / empty
    })

    let args = result.args

    assert.ok(
      args.includes('-human-model'),
      `args must contain "-human-model": ${args}`,
    )

    // Default path should include getUserDataDirectory() value + models dir + filename
    // createServiceForConfig returns '/tmp/sabaki-test-userdata' for getUserDataDirectory
    assert.ok(
      args.includes('/tmp/sabaki-test-userdata'),
      `args must contain default user data directory: ${args}`,
    )
    assert.ok(
      args.includes('models'),
      `args must contain "models" segment: ${args}`,
    )
    assert.ok(
      args.includes('b18c384nbt-humanv0.bin.gz'),
      `args must contain default HumanSL model filename: ${args}`,
    )
  })

  // ─── R3-N04: gtp inside a flag value is not stripped ──────────
  //
  // Production subject: engineService.js -> normalizeEngineConfig
  // Production bug: regex or string stripping removes "gtp" inside config paths,
  //   breaking the -config flag value.

  it('R3-N04: gtp inside a flag value (e.g. config path) is not stripped', () => {
    let result = service.normalizeEngineConfig({
      name: 'KataGo',
      path: '/opt/homebrew/bin/katago',
      args: 'gtp -config "/path/gtp.cfg"',
    })

    let args = result.args

    // The leading gtp subcommand is present exactly once (no duplicate)
    let gtpCount = (args.match(/\bgtp\b/g) || []).length
    // "gtp" appears as subcommand AND inside the path, so count is >= 2 is ok
    assert.ok(
      gtpCount >= 2,
      `"gtp" must appear at least twice (subcommand + in path): ${args}`,
    )

    // No "gtp gtp" duplication
    assert.ok(
      !args.includes('gtp gtp'),
      `args must not contain "gtp gtp": ${args}`,
    )

    // The config path with "gtp.cfg" survives intact
    assert.ok(
      args.includes('gtp.cfg'),
      `args must preserve "gtp.cfg" in config path: ${args}`,
    )

    // gtp subcommand is at the start
    assert.ok(args.startsWith('gtp'), `args must start with "gtp": ${args}`)
  })
})

describe('formatEngineCommandLine', () => {
  before(async () => {
    ensureGlobalStubs()
    let engineServiceModule =
      await import('../src/modules/engine/engineService.js')
    formatEngineCommandLine = engineServiceModule.formatEngineCommandLine
  })

  it('preserves shell-reproducible quoting for executable and args with spaces', () => {
    let result = formatEngineCommandLine('/Applications/KataGo/katago', [
      'gtp',
      '-model',
      '/path with spaces/model.bin.gz',
      '-config',
      '/path with spaces/gtp.cfg',
    ])

    assert.equal(
      result,
      '/Applications/KataGo/katago gtp -model "/path with spaces/model.bin.gz" -config "/path with spaces/gtp.cfg"',
    )
  })
})

// ---------------------------------------------------------------------------
// Tests: detectHumanSL (R3-C09 through R3-C13)
// ---------------------------------------------------------------------------

describe('detectHumanSL', () => {
  before(async () => {
    ensureGlobalStubs()
    let syncerModule = await import('../src/modules/enginesyncer.js')
    EngineSyncer = syncerModule.default
  })

  // ─── R3-C09: positive case ──────────────────────────────
  //
  // Production subject: enginesyncer.js -> EngineSyncer.detectHumanSL
  // Production bug: HumanSL features disabled despite model being loaded

  it('R3-C09: returns true and sets modelLoaded=true when usesHumanSLProfile is true', async () => {
    let syncer = createSyncerForHumanSL({
      commands: ['kata-get-models'],
      sendCommand: async () => ({
        content: JSON.stringify([{name: 'default', usesHumanSLProfile: true}]),
      }),
    })

    let result = await syncer.detectHumanSL()

    assert.equal(result, true, 'detectHumanSL should return true')
    assert.equal(syncer.humanSL.modelLoaded, true, 'modelLoaded should be true')
    assert.equal(syncer.humanSL.available, true, 'available should be true')
  })

  // ─── R3-C10: negative case ──────────────────────────────
  //
  // Production subject: enginesyncer.js -> EngineSyncer.detectHumanSL
  // Production bug: falsely enables HumanSL UI

  it('R3-C10: returns false and sets modelLoaded=false when usesHumanSLProfile is false', async () => {
    let syncer = createSyncerForHumanSL({
      commands: ['kata-get-models'],
      sendCommand: async () => ({
        content: JSON.stringify([{name: 'default', usesHumanSLProfile: false}]),
      }),
    })

    let result = await syncer.detectHumanSL()

    assert.equal(result, false, 'detectHumanSL should return false')
    assert.equal(
      syncer.humanSL.modelLoaded,
      false,
      'modelLoaded should be false',
    )
  })

  // ─── R3-C11: no false positive from key names ──────────
  //
  // Production subject: enginesyncer.js -> EngineSyncer.detectHumanSL
  // Production bug: old /human/i regex would match JSON key "usesHumanSLProfile"

  it('R3-C11: returns false when usesHumanSLProfile key exists but value is false', async () => {
    let syncer = createSyncerForHumanSL({
      commands: ['kata-get-models'],
      sendCommand: async () => ({
        // The JSON contains the key "usesHumanSLProfile" (which has "Human" in it)
        // but the value is false. Old regex-based detection would match the key.
        content: JSON.stringify([{name: 'default', usesHumanSLProfile: false}]),
      }),
    })

    let result = await syncer.detectHumanSL()

    assert.equal(
      result,
      false,
      'must not false-positive on key name containing "Human"',
    )
    assert.equal(syncer.humanSL.modelLoaded, false)
  })

  // ─── R3-C12: command not in list ────────────────────────
  //
  // Production subject: enginesyncer.js -> EngineSyncer.detectHumanSL
  // Production bug: crash on non-KataGo engines

  it('R3-C12: returns false when kata-get-models is not in commands list', async () => {
    let syncer = createSyncerForHumanSL({
      commands: ['name', 'version', 'list_commands'],
      sendCommand: async () => {
        // Should not be called
        assert.fail(
          'sendCommand should not be called when command is not in list',
        )
      },
    })

    let result = await syncer.detectHumanSL()

    assert.equal(result, false)
    assert.equal(syncer.humanSL.modelLoaded, false)
  })

  // ─── R3-C13: invalid JSON response ─────────────────────
  //
  // Production subject: enginesyncer.js -> EngineSyncer.detectHumanSL
  // Production bug: crash on empty/malformed engine response

  it('R3-C13: returns false when kata-get-models returns invalid JSON', async () => {
    let syncer = createSyncerForHumanSL({
      commands: ['kata-get-models'],
      sendCommand: async () => ({
        content: 'this is not valid json {{{',
      }),
    })

    let result = await syncer.detectHumanSL()

    assert.equal(result, false)
    assert.equal(syncer.humanSL.modelLoaded, false)
  })

  it('R3-C13b: returns false when kata-get-models returns empty string', async () => {
    let syncer = createSyncerForHumanSL({
      commands: ['kata-get-models'],
      sendCommand: async () => ({
        content: '',
      }),
    })

    let result = await syncer.detectHumanSL()

    assert.equal(result, false)
    assert.equal(syncer.humanSL.modelLoaded, false)
  })

  // ─── R3-N05: sendCommand rejects / throws ─────────────────
  //
  // Production subject: enginesyncer.js -> EngineSyncer.detectHumanSL
  // Production bug: unhandled promise rejection crashes the app

  it('R3-N05: returns false and sets lastError when sendCommand rejects', async () => {
    let syncer = createSyncerForHumanSL({
      commands: ['kata-get-models'],
      sendCommand: async () => {
        throw new Error('Engine process crashed')
      },
    })

    let result = await syncer.detectHumanSL()

    assert.equal(result, false, 'detectHumanSL should return false on throw')
    assert.equal(
      syncer.humanSL.modelLoaded,
      false,
      'modelLoaded should be false',
    )
    assert.ok(
      syncer.humanSL.lastError != null,
      'lastError should be set when sendCommand throws',
    )
    assert.ok(
      syncer.humanSL.lastError.includes('Engine process crashed'),
      `lastError should contain error message, got: ${syncer.humanSL.lastError}`,
    )
  })
})
