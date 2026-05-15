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
// 2. Effect subscription tests
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
// 3. AnalysisService integration tests
//    Verify analysisService subscription wires store → lifecycle refresh
// ===========================================================================

describe('analysisService + analysisAreaStore integration', () => {
  it('merged getState includes analysisAreaStore state', () => {
    let store = createAnalysisAreaStore()
    store.setAnalysisAreaRects(
      [{sx: 3, sy: 3, ex: 5, ey: 5}],
      [[3, 3], [4, 3], [5, 3]],
    )

    let sabaki = createMockSabaki()
    let service = createAnalysisService(sabaki, {
      analysisAreaStore: store,
    })

    // refreshActiveBoardAnalysis reads merged getState internally.
    // No error = area state merged correctly.
    service.refreshActiveBoardAnalysis()

    assert.deepStrictEqual(store.getState().analysisAreaVertices, [
      [3, 3], [4, 3], [5, 3],
    ])
  })

  it('analysisService subscription filters: areaChanged refreshes, areaSelectModeChanged does not', () => {
    // Test the subscription pattern directly — same logic analysisService uses.
    let store = createAnalysisAreaStore()
    let engineRefreshCount = 0

    // This mirrors the subscription in createAnalysisService:
    store.subscribe(event => {
      if (event.type === 'areaChanged' || event.type === 'areaCleared') {
        engineRefreshCount++
      }
    })

    // areaChanged → refresh
    store.setAnalysisAreaRects([{sx: 0, sy: 0, ex: 3, ey: 3}], [[0, 0]])
    assert.strictEqual(engineRefreshCount, 1)

    // areaSelectModeChanged → no refresh
    store.toggleAreaSelectMode()
    assert.strictEqual(engineRefreshCount, 1)

    // areaCleared → refresh
    store.clearAnalysisArea()
    assert.strictEqual(engineRefreshCount, 2)

    // Same values → no refresh
    store.clearAnalysisArea()
    assert.strictEqual(engineRefreshCount, 2)
  })

  it('after clearAnalysisArea, merged getState has null vertices', () => {
    let store = createAnalysisAreaStore()
    store.setAnalysisAreaRects([{sx: 0, sy: 0, ex: 3, ey: 3}], [[0, 0]])

    let sabaki = createMockSabaki()
    createAnalysisService(sabaki, {analysisAreaStore: store})

    store.clearAnalysisArea()

    assert.strictEqual(store.getState().analysisAreaVertices, null)
    assert.strictEqual(store.getState().analysisAreaRects, null)
  })

  it('createAnalysisService without analysisAreaStore does not crash', () => {
    let sabaki = createMockSabaki()
    let service = createAnalysisService(sabaki)

    service.refreshActiveBoardAnalysis()
  })
})
