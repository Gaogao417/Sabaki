const assert = require('assert')
const {
  createOverlayStore,
} = require('../../src/modules/overlays/overlayStore.ts')

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
      notifyChange: () => {
        notified++
      },
    },
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
    assert.strictEqual(store.setTerritoryCompareEnabled(true), true)
    assert.strictEqual(store.getState().territoryEnabled, true)

    appState.mode = 'play'
    store.onModeChange('play')

    assert.strictEqual(store.getState().territoryEnabled, false)
    assert.strictEqual(store.getState().territoryCompareEnabled, false)
  })
})
