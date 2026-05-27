const assert = require('assert')
const {
  createOverlayStore,
} = require('../../src/modules/overlays/overlayStore.ts')

function createControlledPromise() {
  let resolve
  let reject
  let promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })

  return {promise, resolve, reject}
}

async function flushMicrotasks() {
  await Promise.resolve()
  await Promise.resolve()
}

function createDeps(appState, overrides = {}) {
  let notified = 0
  let calls = {
    analyzeMove: [],
    scheduleEditWorkspaceAnalysis: 0,
    captureEditReference: 0,
  }

  let deps = {
    getAppState: () => appState,
    ensureAnalysisReady: () => Promise.resolve({id: 'syncer'}),
    analyzeMove: treePosition => {
      calls.analyzeMove.push(treePosition)
    },
    scheduleEditWorkspaceAnalysis: () => {
      calls.scheduleEditWorkspaceAnalysis++
    },
    captureEditReference: () => {
      calls.captureEditReference++
      appState.editWorkspace.referenceSnapshot = {}
    },
    getInfoOverlayDuration: () => 1,
    notifyChange: () => {
      notified++
    },
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
    ...overrides,
  }

  return {
    deps,
    calls,
    get notified() {
      return notified
    },
  }
}

describe('overlayStore', () => {
  let warn

  beforeEach(() => {
    warn = console.warn
    console.warn = () => {}
  })

  afterEach(() => {
    console.warn = warn
  })

  it('rejects territory outside analysis mode', () => {
    let appState = {
      mode: 'play',
      editWorkspace: null,
      treePosition: 'root',
      analysisTreePosition: 'root',
      currentOwnership: () => null,
    }
    let tracker = createDeps(appState)
    let store = createOverlayStore(tracker.deps)

    assert.strictEqual(store.setTerritoryEnabled(true), false)
    assert.strictEqual(store.getState().territoryEnabled, false)
    assert.strictEqual(tracker.notified, 0)
  })

  it('clears territory state when leaving analysis mode', () => {
    let appState = {
      mode: 'analysis',
      editWorkspace: {referenceSnapshot: {}},
      treePosition: 'root',
      analysisTreePosition: 'root',
      currentOwnership: () => [[0]],
    }
    let tracker = createDeps(appState)
    let store = createOverlayStore(tracker.deps)

    assert.strictEqual(store.setTerritoryEnabled(true), true)
    assert.strictEqual(store.getState().territoryEnabled, true)

    appState.mode = 'play'
    store.onModeChange('play')

    assert.strictEqual(store.getState().territoryEnabled, false)
    assert.strictEqual(store.getState().territoryCompareEnabled, false)

    appState.mode = 'analysis'
    assert.strictEqual(store.setTerritoryCompareEnabled(true), true)
    assert.strictEqual(store.getState().territoryEnabled, false)
    assert.strictEqual(store.getState().territoryCompareEnabled, true)

    appState.mode = 'play'
    store.onModeChange('play')

    assert.strictEqual(store.getState().territoryEnabled, false)
    assert.strictEqual(store.getState().territoryCompareEnabled, false)
  })

  describe('OVR-T01/OVR-T02 overlay transition cleanup', () => {
    for (const targetMode of ['play', 'problem', 'recall']) {
      it(`clears territory and notifies subscribers when leaving analysis for ${targetMode}`, () => {
        let appState = {
          mode: 'analysis',
          editWorkspace: {referenceSnapshot: {}},
          treePosition: 'root',
          analysisTreePosition: 'root',
          currentOwnership: () => [[0]],
        }
        let tracker = createDeps(appState)
        let store = createOverlayStore(tracker.deps)

        assert.strictEqual(store.setTerritoryEnabled(true), true)
        assert.strictEqual(store.getState().territoryEnabled, true)

        let subscriberCalls = 0
        store.subscribe(() => {
          subscriberCalls++
        })
        let notifiedBefore = tracker.notified

        appState.mode = targetMode
        store.onModeChange(targetMode)

        assert.strictEqual(store.getState().territoryEnabled, false)
        assert.strictEqual(store.getState().territoryCompareEnabled, false)
        assert.strictEqual(subscriberCalls, 1)
        assert.strictEqual(tracker.notified, notifiedBefore + 1)
      })

      it(`clears territory compare and notifies subscribers when leaving analysis for ${targetMode}`, () => {
        let appState = {
          mode: 'analysis',
          editWorkspace: {referenceSnapshot: {}},
          treePosition: 'root',
          analysisTreePosition: 'root',
          currentOwnership: () => [[0]],
        }
        let tracker = createDeps(appState)
        let store = createOverlayStore(tracker.deps)

        assert.strictEqual(store.setTerritoryCompareEnabled(true), true)
        assert.strictEqual(store.getState().territoryEnabled, false)
        assert.strictEqual(store.getState().territoryCompareEnabled, true)

        let subscriberCalls = 0
        store.subscribe(() => {
          subscriberCalls++
        })
        let notifiedBefore = tracker.notified

        appState.mode = targetMode
        store.onModeChange(targetMode)

        assert.strictEqual(store.getState().territoryEnabled, false)
        assert.strictEqual(store.getState().territoryCompareEnabled, false)
        assert.strictEqual(subscriberCalls, 1)
        assert.strictEqual(tracker.notified, notifiedBefore + 1)
      })
    }

    for (const overlayKind of ['territory', 'compare']) {
      it(`ignores late ${overlayKind} ownership readiness after leaving analysis`, async () => {
        let pending = createControlledPromise()
        let appState = {
          mode: 'analysis',
          editWorkspace: {referenceSnapshot: {}},
          treePosition: 'root',
          analysisTreePosition: 'root',
          currentOwnership: () => [[0]],
        }
        let tracker = createDeps(appState, {
          ensureAnalysisReady: () => pending.promise,
        })
        let store = createOverlayStore(tracker.deps)

        if (overlayKind === 'territory') {
          assert.strictEqual(store.setTerritoryEnabled(true), true)
          assert.strictEqual(store.getState().territoryEnabled, true)
        } else {
          assert.strictEqual(store.setTerritoryCompareEnabled(true), true)
          assert.strictEqual(store.getState().territoryCompareEnabled, true)
        }

        appState.mode = 'play'
        store.onModeChange('play')
        pending.resolve({id: 'syncer'})
        await flushMicrotasks()

        assert.strictEqual(store.getState().territoryEnabled, false)
        assert.strictEqual(store.getState().territoryCompareEnabled, false)
        assert.deepStrictEqual(tracker.calls.analyzeMove, [])
        assert.strictEqual(tracker.calls.scheduleEditWorkspaceAnalysis, 0)
      })
    }
  })
})
