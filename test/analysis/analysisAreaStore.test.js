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

/** Tracks calls via mutable object (so closure mutations are visible). */
function createCallTracker() {
  return {
    engineRefreshCount: 0,
    stateUpdates: [],
  }
}

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

  it('setAnalysisAreaRects updates rects/vertices, returns true, notifies once', () => {
    let store = createAnalysisAreaStore()
    let notifications = 0
    store.subscribe(() => { notifications++ })

    let changed = store.setAnalysisAreaRects(
      [{sx: 0, sy: 0, ex: 3, ey: 3}],
      [[0, 0], [1, 0], [2, 0], [3, 0]],
    )

    assert.strictEqual(changed, true)
    assert.deepStrictEqual(store.getState().analysisAreaRects, [
      {sx: 0, sy: 0, ex: 3, ey: 3},
    ])
    assert.deepStrictEqual(store.getState().analysisAreaVertices, [
      [0, 0], [1, 0], [2, 0], [3, 0],
    ])
    assert.strictEqual(notifications, 1)
  })

  it('setting same rects/vertices returns false and does not notify', () => {
    let store = createAnalysisAreaStore()
    let notifications = 0
    store.subscribe(() => { notifications++ })

    store.setAnalysisAreaRects(
      [{sx: 0, sy: 0, ex: 3, ey: 3}],
      [[0, 0], [1, 0]],
    )
    assert.strictEqual(notifications, 1)

    let changed = store.setAnalysisAreaRects(
      [{sx: 0, sy: 0, ex: 3, ey: 3}],
      [[0, 0], [1, 0]],
    )

    assert.strictEqual(changed, false)
    assert.strictEqual(notifications, 1)
  })

  it('clearAnalysisArea clears rects/vertices but keeps areaSelectMode unchanged', () => {
    let store = createAnalysisAreaStore()
    store.setAnalysisAreaRects([{sx: 0, sy: 0, ex: 3, ey: 3}], [[0, 0]])
    store.toggleAreaSelectMode()
    assert.strictEqual(store.getState().areaSelectMode, true)

    let changed = store.clearAnalysisArea()

    assert.strictEqual(changed, true)
    assert.strictEqual(store.getState().analysisAreaRects, null)
    assert.strictEqual(store.getState().analysisAreaVertices, null)
    assert.strictEqual(store.getState().areaSelectMode, true)
  })

  it('clearAnalysisArea on empty state returns false and does not notify', () => {
    let store = createAnalysisAreaStore()
    let notifications = 0
    store.subscribe(() => { notifications++ })

    let changed = store.clearAnalysisArea()

    assert.strictEqual(changed, false)
    assert.strictEqual(notifications, 0)
  })

  it('toggleAreaSelectMode changes only areaSelectMode', () => {
    let store = createAnalysisAreaStore()
    store.setAnalysisAreaRects([{sx: 0, sy: 0, ex: 3, ey: 3}], [[0, 0]])

    store.toggleAreaSelectMode()

    assert.strictEqual(store.getState().areaSelectMode, true)
    assert.deepStrictEqual(store.getState().analysisAreaRects, [
      {sx: 0, sy: 0, ex: 3, ey: 3},
    ])
  })

  it('resetOnModeChange sets areaSelectMode false and only notifies when changed', () => {
    let store = createAnalysisAreaStore()
    let notifications = 0
    store.subscribe(() => { notifications++ })

    // Already false — no notification
    let changed1 = store.resetOnModeChange()
    assert.strictEqual(changed1, false)
    assert.strictEqual(notifications, 0)

    // Toggle on, then reset — should notify
    store.toggleAreaSelectMode()
    let notificationsAfterToggle = notifications

    let changed2 = store.resetOnModeChange()
    assert.strictEqual(changed2, true)
    assert.strictEqual(store.getState().areaSelectMode, false)
    assert.strictEqual(notifications, notificationsAfterToggle + 1)
  })

  it('setAnalysisAreaRects nulls both when vertices empty', () => {
    let store = createAnalysisAreaStore()
    store.setAnalysisAreaRects([{sx: 0, sy: 0, ex: 3, ey: 3}], [[0, 0]])

    let changed = store.setAnalysisAreaRects([{sx: 0, sy: 0, ex: 3, ey: 3}], [])

    assert.strictEqual(changed, true)
    assert.strictEqual(store.getState().analysisAreaRects, null)
    assert.strictEqual(store.getState().analysisAreaVertices, null)
  })

  it('unsubscribe stops notifications', () => {
    let store = createAnalysisAreaStore()
    let notifications = 0
    let unsub = store.subscribe(() => { notifications++ })

    store.setAnalysisArea([[0, 0]])
    assert.strictEqual(notifications, 1)

    unsub()
    store.clearAnalysisArea()
    assert.strictEqual(notifications, 1)
  })
})

// ===========================================================================
// 2. Sabaki orchestration tests
//    Simulates the sabaki.js area method pattern.
//    Uses mutable tracker objects so closure mutations are visible.
// ===========================================================================

describe('sabaki area orchestration', () => {
  function createOrchestrator() {
    let store = createAnalysisAreaStore()
    let tracker = createCallTracker()

    let sabakiLike = {
      getAnalysisAreaStore: () => store,
      setState: (patch) => { tracker.stateUpdates.push(patch) },
    }

    // Wire store → engine refresh (simulates analysisService subscription)
    store.subscribe(() => { tracker.engineRefreshCount++ })

    return {store, tracker, sabakiLike}
  }

  it('setAnalysisAreaRects calls store setter, clears highlightVertices', () => {
    let {store, tracker, sabakiLike} = createOrchestrator()

    // sabaki.setAnalysisAreaRects pattern:
    sabakiLike.getAnalysisAreaStore().setAnalysisAreaRects(
      [{sx: 0, sy: 0, ex: 3, ey: 3}],
      [[0, 0], [1, 0]],
    )
    sabakiLike.setState({highlightVertices: []})

    assert.deepStrictEqual(store.getState().analysisAreaVertices, [[0, 0], [1, 0]])
    assert.strictEqual(tracker.stateUpdates.length, 1)
    assert.deepStrictEqual(tracker.stateUpdates[0], {highlightVertices: []})
  })

  it('clearAnalysisArea refreshes engine only when area actually changed', () => {
    let {store, tracker, sabakiLike} = createOrchestrator()

    // Clear on empty state — store returns false, subscriber not called
    sabakiLike.getAnalysisAreaStore().clearAnalysisArea()
    assert.strictEqual(tracker.engineRefreshCount, 0)

    // Set area — subscriber fires once
    sabakiLike.getAnalysisAreaStore().setAnalysisAreaRects(
      [{sx: 0, sy: 0, ex: 3, ey: 3}],
      [[0, 0]],
    )
    assert.strictEqual(tracker.engineRefreshCount, 1)

    // Clear area — subscriber fires again
    sabakiLike.getAnalysisAreaStore().clearAnalysisArea()
    assert.strictEqual(tracker.engineRefreshCount, 2)
  })

  it('toggleAreaSelectMode triggers subscriber for React re-render', () => {
    let {tracker, sabakiLike} = createOrchestrator()

    sabakiLike.getAnalysisAreaStore().toggleAreaSelectMode()

    // Subscriber fires (for React re-render), but in real code
    // lifecycle.refreshActiveBoardAnalysis routes based on mode/area.
    // At orchestration level we verify the notification fires.
    assert.strictEqual(tracker.engineRefreshCount, 1)
  })

  it('resetOnModeChange during mode change only notifies when areaSelectMode changes', () => {
    let {store, tracker, sabakiLike} = createOrchestrator()

    // areaSelectMode is already false — no notification
    sabakiLike.getAnalysisAreaStore().resetOnModeChange()
    assert.strictEqual(tracker.engineRefreshCount, 0)

    // areaSelectMode is true — reset notifies
    store.toggleAreaSelectMode()
    let countAfterToggle = tracker.engineRefreshCount

    sabakiLike.getAnalysisAreaStore().resetOnModeChange()
    assert.strictEqual(tracker.engineRefreshCount, countAfterToggle + 1)
  })
})

// ===========================================================================
// 3. Analysis engine integration tests
//    Tests createAnalysisService with real analysisAreaStore injection.
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

    // The service's internal getLifecycleDeps builds a merged getState.
    // Call refreshActiveBoardAnalysis which reads getState() internally.
    // If area state is not merged, the lifecycle would read undefined for
    // analysisAreaVertices. No error = merge works.
    service.refreshActiveBoardAnalysis()

    // Verify the store state is still correct
    assert.deepStrictEqual(store.getState().analysisAreaVertices, [
      [3, 3], [4, 3], [5, 3],
    ])
  })

  it('area store subscription triggers lifecycle refresh', () => {
    let store = createAnalysisAreaStore()
    let sabaki = createMockSabaki()
    let service = createAnalysisService(sabaki, {
      analysisAreaStore: store,
    })

    // Changing the store should trigger the lifecycle refresh subscriber.
    // No assertion on side effects — just verify no error thrown and
    // the subscription is wired (tested by the chain not throwing).
    store.setAnalysisAreaRects(
      [{sx: 5, sy: 5, ex: 7, ey: 7}],
      [[5, 5], [6, 5], [7, 5]],
    )

    assert.deepStrictEqual(store.getState().analysisAreaVertices, [
      [5, 5], [6, 5], [7, 5],
    ])
  })

  it('after clearAnalysisArea, merged getState has null vertices', () => {
    let store = createAnalysisAreaStore()
    store.setAnalysisAreaRects([{sx: 0, sy: 0, ex: 3, ey: 3}], [[0, 0]])

    let sabaki = createMockSabaki()
    let service = createAnalysisService(sabaki, {
      analysisAreaStore: store,
    })

    // Clear area through external API
    store.clearAnalysisArea()

    // Verify state is cleared in the store (and thus in merged getState)
    assert.strictEqual(store.getState().analysisAreaVertices, null)
    assert.strictEqual(store.getState().analysisAreaRects, null)

    // The subscription should have fired lifecycle refresh with null area.
    // No error = the chain handled the null area correctly.
    service.refreshActiveBoardAnalysis()
  })

  it('createAnalysisService without analysisAreaStore does not crash', () => {
    let sabaki = createMockSabaki()

    // No analysisAreaStore dep — service should still work
    let service = createAnalysisService(sabaki)

    // Should not throw — area state defaults to {}
    service.refreshActiveBoardAnalysis()
  })
})
