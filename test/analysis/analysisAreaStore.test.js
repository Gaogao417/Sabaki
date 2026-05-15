const assert = require('assert')
const {
  createAnalysisAreaStore,
} = require('../../src/modules/analysis/analysisAreaStore.ts')
const {
  createAnalysisService,
} = require('../../src/modules/analysis/analysisService.ts')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal sabaki mock for createAnalysisService. */
function createMockSabaki(overrides = {}) {
  return {
    state: {mode: 'analysis', treePosition: 'root', ...overrides.state},
    inferredState: {analyzingEngineSyncer: null, gameTree: null},
    setState: overrides.setState ?? (() => {}),
    getPlayer: () => 1,
    getEditWorkspaceTabKeys: () => ({
      snapshotKey: 'snapshot',
      analysisKey: 'analysis',
      ownershipKey: 'ownership',
    }),
    engineSupportsOwnership: () => false,
    logger: {info: () => {}, warn: () => {}, error: () => {}, debug: () => {}},
    setting: {get: () => null},
    getEngineService: () => ({getAnalysisRelevantState: () => ({})}),
  }
}

// ===========================================================================
// 1. Store unit tests
// ===========================================================================

describe('analysisAreaStore — unit', () => {
  it('initial state is empty and areaSelectMode is false', () => {
    let store = createAnalysisAreaStore()
    let state = store.getState()

    assert.strictEqual(state.analysisAreaRects, null)
    assert.strictEqual(state.analysisAreaVertices, null)
    assert.strictEqual(state.areaSelectMode, false)
  })

  it('setAnalysisAreaRects emits areaChanged', () => {
    let store = createAnalysisAreaStore()
    let events = []
    store.subscribe(event => events.push(event))

    let changed = store.setAnalysisAreaRects(
      [{sx: 0, sy: 0, ex: 3, ey: 3}],
      [[0, 0], [1, 0]],
    )

    assert.strictEqual(changed, true)
    assert.deepStrictEqual(events.map(e => e.type), ['areaChanged'])
    assert.deepStrictEqual(store.getState().analysisAreaVertices, [
      [0, 0], [1, 0],
    ])
  })

  it('setAnalysisArea emits areaChanged', () => {
    let store = createAnalysisAreaStore()
    let events = []
    store.subscribe(event => events.push(event))

    store.setAnalysisArea([[0, 0], [1, 1]])

    assert.deepStrictEqual(events.map(e => e.type), ['areaChanged'])
  })

  it('setting same rects/vertices returns false and does not emit', () => {
    let store = createAnalysisAreaStore()
    let events = []
    store.subscribe(event => events.push(event))

    store.setAnalysisAreaRects(
      [{sx: 0, sy: 0, ex: 3, ey: 3}],
      [[0, 0], [1, 0]],
    )
    events.length = 0

    let changed = store.setAnalysisAreaRects(
      [{sx: 0, sy: 0, ex: 3, ey: 3}],
      [[0, 0], [1, 0]],
    )

    assert.strictEqual(changed, false)
    assert.deepStrictEqual(events, [])
  })

  it('clearAnalysisArea emits areaCleared', () => {
    let store = createAnalysisAreaStore()
    store.setAnalysisAreaRects([{sx: 0, sy: 0, ex: 3, ey: 3}], [[0, 0]])

    let events = []
    store.subscribe(event => events.push(event))

    let changed = store.clearAnalysisArea()

    assert.strictEqual(changed, true)
    assert.deepStrictEqual(events.map(e => e.type), ['areaCleared'])
  })

  it('clearAnalysisArea on empty state returns false and does not emit', () => {
    let store = createAnalysisAreaStore()
    let events = []
    store.subscribe(event => events.push(event))

    let changed = store.clearAnalysisArea()

    assert.strictEqual(changed, false)
    assert.deepStrictEqual(events, [])
  })

  it('clearAnalysisArea clears rects/vertices but keeps areaSelectMode unchanged', () => {
    let store = createAnalysisAreaStore()
    store.setAnalysisAreaRects([{sx: 0, sy: 0, ex: 3, ey: 3}], [[0, 0]])
    store.toggleAreaSelectMode()

    store.clearAnalysisArea()

    assert.strictEqual(store.getState().analysisAreaRects, null)
    assert.strictEqual(store.getState().analysisAreaVertices, null)
    assert.strictEqual(store.getState().areaSelectMode, true)
  })

  it('toggleAreaSelectMode emits areaSelectModeChanged', () => {
    let store = createAnalysisAreaStore()
    let events = []
    store.subscribe(event => events.push(event))

    store.toggleAreaSelectMode()

    assert.strictEqual(store.getState().areaSelectMode, true)
    assert.deepStrictEqual(events.map(e => e.type), ['areaSelectModeChanged'])
  })

  it('setAreaSelectMode emits areaSelectModeChanged only when changed', () => {
    let store = createAnalysisAreaStore()
    let events = []
    store.subscribe(event => events.push(event))

    let changed1 = store.setAreaSelectMode(false)
    assert.strictEqual(changed1, false)
    assert.deepStrictEqual(events, [])

    let changed2 = store.setAreaSelectMode(true)
    assert.strictEqual(changed2, true)
    assert.deepStrictEqual(events.map(e => e.type), ['areaSelectModeChanged'])
  })

  it('resetOnModeChange emits areaSelectModeChanged only when was true', () => {
    let store = createAnalysisAreaStore()
    let events = []
    store.subscribe(event => events.push(event))

    let changed1 = store.resetOnModeChange()
    assert.strictEqual(changed1, false)
    assert.deepStrictEqual(events, [])

    store.toggleAreaSelectMode()
    events.length = 0

    let changed2 = store.resetOnModeChange()
    assert.strictEqual(changed2, true)
    assert.deepStrictEqual(events.map(e => e.type), ['areaSelectModeChanged'])
  })

  it('setAnalysisAreaRects nulls both when vertices empty', () => {
    let store = createAnalysisAreaStore()
    store.setAnalysisAreaRects([{sx: 0, sy: 0, ex: 3, ey: 3}], [[0, 0]])

    let changed = store.setAnalysisAreaRects([{sx: 0, sy: 0, ex: 3, ey: 3}], [])

    assert.strictEqual(changed, true)
    assert.strictEqual(store.getState().analysisAreaRects, null)
    assert.strictEqual(store.getState().analysisAreaVertices, null)
  })

  it('unsubscribe stops events', () => {
    let store = createAnalysisAreaStore()
    let events = []
    let unsub = store.subscribe(event => events.push(event))

    store.setAnalysisArea([[0, 0]])
    assert.strictEqual(events.length, 1)

    unsub()
    store.clearAnalysisArea()
    assert.strictEqual(events.length, 1)
  })
})

// ===========================================================================
// 2. Defensive copy tests
//    Store must not allow external mutation of internal state.
// ===========================================================================

describe('analysisAreaStore — defensive copy', () => {
  it('mutating input rects after setAnalysisAreaRects does not affect store', () => {
    let store = createAnalysisAreaStore()
    let rects = [{sx: 0, sy: 0, ex: 3, ey: 3}]
    let vertices = [[0, 0], [1, 0]]

    store.setAnalysisAreaRects(rects, vertices)

    // Mutate inputs
    rects[0].ex = 99
    vertices.push([2, 0])

    let state = store.getState()
    assert.strictEqual(state.analysisAreaRects[0].ex, 3)
    assert.strictEqual(state.analysisAreaVertices.length, 2)
  })

  it('mutating input vertices after setAnalysisArea does not affect store', () => {
    let store = createAnalysisAreaStore()
    let vertices = [[0, 0], [1, 1]]

    store.setAnalysisArea(vertices)

    vertices.push([2, 2])

    assert.strictEqual(store.getState().analysisAreaVertices.length, 2)
  })

  it('mutating getState() return does not affect store', () => {
    let store = createAnalysisAreaStore()
    store.setAnalysisAreaRects(
      [{sx: 0, sy: 0, ex: 3, ey: 3}],
      [[0, 0], [1, 0]],
    )

    let state = store.getState()

    // Mutate returned state
    state.analysisAreaRects[0].ex = 99
    state.analysisAreaVertices.push([2, 0])
    state.areaSelectMode = true

    let fresh = store.getState()
    assert.strictEqual(fresh.analysisAreaRects[0].ex, 3)
    assert.strictEqual(fresh.analysisAreaVertices.length, 2)
    assert.strictEqual(fresh.areaSelectMode, false)
  })
})

// ===========================================================================
// 3. Effect subscription tests
//    Two subscribers: UI (all events) and engine (areaChanged/areaCleared only)
// ===========================================================================

describe('analysisAreaStore effects', () => {
  function createEffectsHarness() {
    let store = createAnalysisAreaStore()
    let tracker = {
      renderCount: 0,
      engineRefreshCount: 0,
    }

    // UI subscriber: any store event triggers render
    store.subscribe(() => {
      tracker.renderCount++
    })

    // Engine subscriber: only area constraint changes trigger refresh
    store.subscribe(event => {
      if (event.type === 'areaChanged' || event.type === 'areaCleared') {
        tracker.engineRefreshCount++
      }
    })

    return {store, tracker}
  }

  it('setAnalysisAreaRects triggers both render and engine refresh', () => {
    let {tracker, store} = createEffectsHarness()

    store.setAnalysisAreaRects(
      [{sx: 0, sy: 0, ex: 3, ey: 3}],
      [[0, 0], [1, 0]],
    )

    assert.strictEqual(tracker.renderCount, 1)
    assert.strictEqual(tracker.engineRefreshCount, 1)
  })

  it('same rects/vertices triggers neither render nor engine', () => {
    let {tracker, store} = createEffectsHarness()

    store.setAnalysisAreaRects(
      [{sx: 0, sy: 0, ex: 3, ey: 3}],
      [[0, 0]],
    )
    assert.strictEqual(tracker.renderCount, 1)
    assert.strictEqual(tracker.engineRefreshCount, 1)

    store.setAnalysisAreaRects(
      [{sx: 0, sy: 0, ex: 3, ey: 3}],
      [[0, 0]],
    )

    assert.strictEqual(tracker.renderCount, 1)
    assert.strictEqual(tracker.engineRefreshCount, 1)
  })

  it('clearAnalysisArea when changed triggers both', () => {
    let {tracker, store} = createEffectsHarness()

    store.setAnalysisAreaRects([{sx: 0, sy: 0, ex: 3, ey: 3}], [[0, 0]])
    assert.strictEqual(tracker.renderCount, 1)
    assert.strictEqual(tracker.engineRefreshCount, 1)

    store.clearAnalysisArea()
    assert.strictEqual(tracker.renderCount, 2)
    assert.strictEqual(tracker.engineRefreshCount, 2)
  })

  it('clearAnalysisArea when empty triggers neither', () => {
    let {tracker, store} = createEffectsHarness()

    store.clearAnalysisArea()

    assert.strictEqual(tracker.renderCount, 0)
    assert.strictEqual(tracker.engineRefreshCount, 0)
  })

  it('toggleAreaSelectMode triggers render but NOT engine refresh', () => {
    let {tracker, store} = createEffectsHarness()

    store.toggleAreaSelectMode()

    assert.strictEqual(tracker.renderCount, 1)
    assert.strictEqual(tracker.engineRefreshCount, 0)
  })

  it('resetOnModeChange triggers render only when changed, never engine', () => {
    let {tracker, store} = createEffectsHarness()

    // Already false — no effect
    store.resetOnModeChange()
    assert.strictEqual(tracker.renderCount, 0)
    assert.strictEqual(tracker.engineRefreshCount, 0)

    // Toggle on, then reset — render only
    store.toggleAreaSelectMode()
    let renderAfterToggle = tracker.renderCount

    store.resetOnModeChange()
    assert.strictEqual(tracker.renderCount, renderAfterToggle + 1)
    assert.strictEqual(tracker.engineRefreshCount, 0)
  })
})

// ===========================================================================
// 4. AnalysisService integration tests
//    Verify store → analysisService subscription wiring.
// ===========================================================================

describe('analysisService + analysisAreaStore integration', () => {
  /**
   * Full harness: sabaki mock + engine service mock + area store,
   * wired so runBoardAnalysis reaches buildAnalyzeArgs.
   * Captures what the engine actually receives for analysisAreaVertices.
   */
  function createFullHarness() {
    let store = createAnalysisAreaStore()
    let capturedBuildArgs = null

    let sabaki = createMockSabaki()
    sabaki.state = {mode: 'analysis', treePosition: 'root'}
    sabaki.inferredState = {
      analyzingEngineSyncer: {id: 'test-syncer', suspended: false},
      gameTree: {get: () => ({sign: 0})},
    }

    let engineServiceMock = {
      getAnalysisRelevantState: () => ({}),
      engineSupportsOwnership: () => false,
      getAnalyzeCommand: () => 'analyze',
      buildAnalyzeArgs: (_syncer, _player, opts) => {
        capturedBuildArgs = opts
        return []
      },
      syncEngine: async () => true,
      getAnalysisVisitLimit: () => null,
      getAnalysisMaxTime: () => null,
      prepareAnalysis: async () => {},
      startAnalysis: async () => {},
      getAttachedSyncers: () => [],
      getLastAnalyzingSyncerId: () => null,
    }

    let service = createAnalysisService(sabaki, {
      analysisAreaStore: store,
    })
    service.setEngineService(engineServiceMock)

    return {store, service, capturedBuildArgs: () => capturedBuildArgs}
  }

  /** Wait for a promise to resolve by polling. */
  function flushAsync() {
    return new Promise(resolve => setTimeout(resolve, 0))
  }

  it('areaChanged triggers analysisService.analyzeGameTreePosition', async () => {
    let {store, service} = createFullHarness()
    let analyzeCalled = false
    let analyzeResolve
    let analyzePromise = new Promise(r => { analyzeResolve = r })

    service.analyzeGameTreePosition = async () => {
      analyzeCalled = true
      analyzeResolve()
    }

    store.setAnalysisAreaRects(
      [{sx: 0, sy: 0, ex: 3, ey: 3}],
      [[0, 0], [1, 0]],
    )

    await analyzePromise
    assert.strictEqual(analyzeCalled, true)
  })

  it('areaCleared triggers analysisService.analyzeGameTreePosition', async () => {
    let {store, service} = createFullHarness()
    store.setAnalysisAreaRects([{sx: 0, sy: 0, ex: 3, ey: 3}], [[0, 0]])

    let analyzeCalled = false
    let analyzeResolve
    let analyzePromise = new Promise(r => { analyzeResolve = r })
    service.analyzeGameTreePosition = async () => {
      analyzeCalled = true
      analyzeResolve()
    }

    store.clearAnalysisArea()

    await analyzePromise
    assert.strictEqual(analyzeCalled, true)
  })

  it('areaSelectModeChanged does NOT trigger analyzeGameTreePosition', async () => {
    let {store, service} = createFullHarness()
    let analyzeCalled = false
    service.analyzeGameTreePosition = async () => { analyzeCalled = true }

    store.toggleAreaSelectMode()
    store.setAreaSelectMode(true) // no-op since already true
    store.resetOnModeChange()

    await flushAsync()
    assert.strictEqual(analyzeCalled, false)
  })

  it('merged getState includes area vertices from store', () => {
    let store = createAnalysisAreaStore()
    store.setAnalysisAreaRects(
      [{sx: 3, sy: 3, ex: 5, ey: 5}],
      [[3, 3], [4, 3], [5, 3]],
    )

    let sabaki = createMockSabaki()
    let service = createAnalysisService(sabaki, {
      analysisAreaStore: store,
    })

    // buildAnalysisTarget uses merged getState internally.
    // It should not throw — area state is correctly merged.
    let target = service.buildAnalysisTarget()
    assert.ok(target != null)
    assert.strictEqual(target.kind, 'game-tree')
  })

  it('buildAnalyzeArgs receives null vertices after clearAnalysisArea', async () => {
    let {store, service, capturedBuildArgs} = createFullHarness()
    store.setAnalysisAreaRects(
      [{sx: 3, sy: 3, ex: 5, ey: 5}],
      [[3, 3], [4, 3], [5, 3]],
    )
    store.clearAnalysisArea()

    // No vertices → getBoard is not called, so simple tree mock suffices
    let finishResolve
    let analysisPromise = new Promise(r => { finishResolve = r })

    await service.runBoardAnalysis({
      syncer: {
        id: 'test-syncer',
        suspended: false,
        on: (evt, handler) => {
          // Immediately finish to trigger finish() path
          if (evt === 'analysis-update') setImmediate(() => handler())
        },
        removeListener: () => {},
        sendAbort: () => {},
        queueCommand: () => {},
      },
      tree: {get: () => ({sign: 0})},
      treePosition: 'root',
      analyzePlayer: 1,
    })

    let args = capturedBuildArgs()
    assert.ok(args != null, 'buildAnalyzeArgs was called')
    assert.strictEqual(args.analysisAreaVertices, null)
  })

  it('createAnalysisService without analysisAreaStore skips subscription', () => {
    let sabaki = createMockSabaki()
    let service = createAnalysisService(sabaki)

    // No subscription wired — refreshActiveBoardAnalysis still callable
    service.refreshActiveBoardAnalysis()
  })
})
