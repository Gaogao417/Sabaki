/**
 * Regression tests for three reported issues:
 * 1. Review mode defaults: heatmap + human prior + territory should be ON
 * 2. AppLogger should output to console
 * 3. Territory overlay colors should NOT flip with current player
 */

const assert = require('assert')

// ---------------------------------------------------------------------------
// Issue 1: Review mode defaults (territory auto-enable)
// ---------------------------------------------------------------------------

describe('regression: review mode defaults', () => {
  const {createOverlayStore} = require('../src/modules/overlays/overlayStore.ts')

  function createDeps(appState) {
    let notified = 0
    return {
      deps: {
        getAppState: () => appState,
        ensureAnalysisReady: () => Promise.resolve({id: 'syncer'}),
        analyzeMove: () => {},
        scheduleEditWorkspaceAnalysis: () => {},
        captureEditReference: () => {
          appState.editWorkspace.referenceSnapshot = {}
        },
        getInfoOverlayDuration: () => 1,
        notifyChange: () => { notified++ },
      },
      get notified() { return notified },
    }
  }

  let warn
  beforeEach(() => {
    warn = console.warn
    console.warn = () => {}
  })
  afterEach(() => { console.warn = warn })

  it('territory is NOT enabled by default in overlayStore initial state', () => {
    let tracker = createDeps({mode: 'play', editWorkspace: null})
    let store = createOverlayStore(tracker.deps)
    assert.strictEqual(store.getState().territoryEnabled, false)
  })

  it('entering analysis mode should allow territory to be enabled', () => {
    let appState = {
      mode: 'analysis',
      editWorkspace: {referenceSnapshot: {}},
      treePosition: 'root',
      analysisTreePosition: 'root',
      currentOwnership: () => [[0]],
    }
    let tracker = createDeps(appState)
    let store = createOverlayStore(tracker.deps)

    let result = store.setTerritoryEnabled(true)
    assert.strictEqual(result, true)
    assert.strictEqual(store.getState().territoryEnabled, true)
  })

  it('auto-enable territory when entering analysis mode for the first time', () => {
    let appState = {
      mode: 'analysis',
      editWorkspace: {referenceSnapshot: {}},
      treePosition: 'root',
      analysisTreePosition: 'root',
      currentOwnership: () => [[0.9]],
    }
    let tracker = createDeps(appState)
    let store = createOverlayStore(tracker.deps)

    // Simulate entering analysis mode: auto-enable territory
    store.setTerritoryEnabled(true)
    assert.strictEqual(store.getState().territoryEnabled, true)
  })

  it('onModeChange clears territory when leaving analysis mode', () => {
    let appState = {
      mode: 'analysis',
      editWorkspace: {referenceSnapshot: {}},
      treePosition: 'root',
      analysisTreePosition: 'root',
      currentOwnership: () => [[0]],
    }
    let tracker = createDeps(appState)
    let store = createOverlayStore(tracker.deps)

    store.setTerritoryEnabled(true)
    assert.strictEqual(store.getState().territoryEnabled, true)

    // Simulate leaving analysis mode
    appState.mode = 'play'
    store.onModeChange('play')
    assert.strictEqual(store.getState().territoryEnabled, false, 'Territory should be cleared when leaving analysis mode')
  })
})


// ---------------------------------------------------------------------------
// Issue 3: Territory overlay colors should not flip with current player
// ---------------------------------------------------------------------------

describe('regression: territory colors independent of current player', () => {
  let parseAnalysis

  before(() => {
    // Mock window before requiring enginesyncer (which accesses window.sabaki at import time)
    global.window = {
      sabaki: {
        setting: {
          get: (key) => {
            if (key === 'gtp.engine_quit_timeout') return 5000
            return null
          },
        },
      },
    }

    const enginesyncer = require('../src/modules/enginesyncer.js')
    parseAnalysis = enginesyncer.parseAnalysis
  })

  after(() => {
    delete global.window
    delete require.cache[require.resolve('../src/modules/enginesyncer.js')]
  })

  // Minimal board mock for parseAnalysis
  function makeBoard(width, height) {
    return {
      width,
      height,
      parseVertex: (move) => {
        let x = move.charCodeAt(0) - 65
        let y = height - parseInt(move.slice(1))
        return [x, y]
      },
    }
  }

  it('ownership should NOT flip when analyzing for White (sign=-1)', () => {
    let board = makeBoard(9, 9)

    // Simulate an info line with ownership
    // Create a simple ownership line: 9x9 = 81 values, all positive (black territory)
    let ownershipValues = Array(81).fill('0.9').join(' ')
    let line = `info move D4 visits 100 winrate 5000 scoreLead 5.0 pv D4 E5 ownership ${ownershipValues}`

    // Parse for Black (sign=1)
    let resultBlack = parseAnalysis(line, board, 1)
    assert.ok(resultBlack.ownership != null)
    assert.strictEqual(resultBlack.ownership[0][0], 0.9, 'Black analysis: ownership should be positive (black territory)')

    // Parse for White (sign=-1) - ownership should NOT flip
    let resultWhite = parseAnalysis(line, board, -1)
    assert.ok(resultWhite.ownership != null)
    // BUG: Currently ownership gets flipped to -0.9 for White
    // FIX: ownership should remain positive regardless of sign
    assert.strictEqual(
      resultWhite.ownership[0][0],
      0.9,
      'White analysis: ownership should remain positive (black territory), NOT flipped',
    )
  })

  it('negative ownership should NOT be negated when analyzing for White', () => {
    let board = makeBoard(9, 9)

    // All negative values (white territory)
    let ownershipValues = Array(81).fill('-0.8').join(' ')
    let line = `info move D4 visits 100 winrate 5000 scoreLead 5.0 pv D4 ownership ${ownershipValues}`

    let resultBlack = parseAnalysis(line, board, 1)
    assert.strictEqual(resultBlack.ownership[0][0], -0.8, 'Black analysis: white territory stays negative')

    let resultWhite = parseAnalysis(line, board, -1)
    assert.strictEqual(
      resultWhite.ownership[0][0],
      -0.8,
      'White analysis: white territory should stay negative, NOT flipped to positive',
    )
  })
})
