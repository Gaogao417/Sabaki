import assert from 'assert'

import {createWorkbenchStore} from '../../src/modules/training/store/workbenchStore.ts'

function makeTab(overrides = {}) {
  return {
    id: 'tab_1',
    taskId: 'task_1',
    mode: 'play',
    childTabIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// --- Tests ---

describe('workbenchStore', () => {
  let store

  beforeEach(() => {
    store = createWorkbenchStore()
  })

  // --- Basic CRUD ---

  it('starts with empty state', () => {
    const state = store.getState()
    assert.deepStrictEqual(state.tabs, [])
    assert.strictEqual(state.activeTabId, null)
  })

  it('addTab adds a tab', () => {
    store.addTab(makeTab())
    assert.strictEqual(store.getState().tabs.length, 1)
    assert.strictEqual(store.getState().tabs[0].id, 'tab_1')
  })

  it('setActiveTab changes activeTabId', () => {
    store.addTab(makeTab({id: 'tab_1'}))
    store.setActiveTab('tab_1')
    assert.strictEqual(store.getState().activeTabId, 'tab_1')
  })

  it('setActiveTab(null) clears activeTabId', () => {
    store.addTab(makeTab())
    store.setActiveTab('tab_1')
    store.setActiveTab(null)
    assert.strictEqual(store.getState().activeTabId, null)
  })

  it('updateTab patches a tab', () => {
    store.addTab(makeTab({id: 'tab_1', mode: 'play'}))
    store.updateTab('tab_1', {mode: 'recall'})
    assert.strictEqual(store.getState().tabs[0].mode, 'recall')
  })

  it('updateTab does not mutate other tabs', () => {
    store.addTab(makeTab({id: 'tab_1', mode: 'play'}))
    store.addTab(makeTab({id: 'tab_2', mode: 'play'}))
    store.updateTab('tab_1', {mode: 'recall'})
    assert.strictEqual(store.getState().tabs[1].mode, 'play')
  })

  it('removeTab removes a tab', () => {
    store.addTab(makeTab({id: 'tab_1'}))
    store.addTab(makeTab({id: 'tab_2'}))
    store.removeTab('tab_1')
    assert.strictEqual(store.getState().tabs.length, 1)
    assert.strictEqual(store.getState().tabs[0].id, 'tab_2')
  })

  it('removeTab clears activeTabId if removed tab was active', () => {
    store.addTab(makeTab({id: 'tab_1'}))
    store.setActiveTab('tab_1')
    store.removeTab('tab_1')
    assert.strictEqual(store.getState().activeTabId, null)
  })

  it('removeTab keeps activeTabId if different tab was active', () => {
    store.addTab(makeTab({id: 'tab_1'}))
    store.addTab(makeTab({id: 'tab_2'}))
    store.setActiveTab('tab_2')
    store.removeTab('tab_1')
    assert.strictEqual(store.getState().activeTabId, 'tab_2')
  })

  it('setTabs replaces all tabs', () => {
    store.addTab(makeTab({id: 'tab_1'}))
    const newTabs = [makeTab({id: 'tab_a'}), makeTab({id: 'tab_b'})]
    store.setTabs(newTabs)
    assert.strictEqual(store.getState().tabs.length, 2)
    assert.strictEqual(store.getState().tabs[0].id, 'tab_a')
  })

  // --- Notification ---

  it('addTab notifies subscribers', () => {
    let callCount = 0
    store.subscribe(() => callCount++)
    store.addTab(makeTab())
    assert.strictEqual(callCount, 1)
  })

  it('updateTab notifies subscribers', () => {
    let callCount = 0
    store.addTab(makeTab({id: 'tab_1'}))
    store.subscribe(() => callCount++)
    store.updateTab('tab_1', {mode: 'recall'})
    assert.strictEqual(callCount, 1)
  })

  it('removeTab notifies subscribers', () => {
    let callCount = 0
    store.addTab(makeTab({id: 'tab_1'}))
    store.subscribe(() => callCount++)
    store.removeTab('tab_1')
    assert.strictEqual(callCount, 1)
  })

  it('setActiveTab notifies subscribers', () => {
    let callCount = 0
    store.addTab(makeTab({id: 'tab_1'}))
    store.subscribe(() => callCount++)
    store.setActiveTab('tab_1')
    assert.strictEqual(callCount, 1)
  })

  it('setTabs notifies subscribers', () => {
    let callCount = 0
    store.subscribe(() => callCount++)
    store.setTabs([makeTab({id: 'tab_1'})])
    assert.strictEqual(callCount, 1)
  })

  it('subscribe returns unsubscribe function', () => {
    let callCount = 0
    const unsubscribe = store.subscribe(() => callCount++)
    store.addTab(makeTab())
    assert.strictEqual(callCount, 1)
    unsubscribe()
    store.addTab(makeTab({id: 'tab_2'}))
    assert.strictEqual(callCount, 1)
  })

  // --- Duplicate id guard ---

  it('addTab throws on duplicate tab id', () => {
    store.addTab(makeTab({id: 'tab_1'}))
    assert.throws(() => {
      store.addTab(makeTab({id: 'tab_1'}))
    }, /duplicate tab id/)
  })

  // --- Missing id guard ---

  it('setActiveTab throws if tab does not exist', () => {
    assert.throws(() => {
      store.setActiveTab('missing_tab')
    }, /tab not found/)
  })

  it('updateTab throws if tab does not exist', () => {
    assert.throws(() => {
      store.updateTab('missing_tab', {mode: 'recall'})
    }, /tab not found/)
  })

  it('removeTab on missing tab is a no-op (does not throw)', () => {
    assert.doesNotThrow(() => {
      store.removeTab('missing_tab')
    })
  })

  // --- setTabs + activeTabId consistency ---

  it('setTabs clears activeTabId if active tab no longer exists', () => {
    store.addTab(makeTab({id: 'tab_1'}))
    store.setActiveTab('tab_1')
    store.setTabs([makeTab({id: 'tab_2'})])
    assert.strictEqual(store.getState().activeTabId, null)
  })

  it('setTabs keeps activeTabId if active tab still exists', () => {
    store.addTab(makeTab({id: 'tab_1'}))
    store.setActiveTab('tab_1')
    store.setTabs([makeTab({id: 'tab_1'}), makeTab({id: 'tab_2'})])
    assert.strictEqual(store.getState().activeTabId, 'tab_1')
  })

  // --- Immutability / external mutation defense ---

  it('addTab clones input tab to prevent external mutation', () => {
    const tab = makeTab({id: 'tab_1', mode: 'play'})
    store.addTab(tab)

    tab.mode = 'analysis'

    assert.strictEqual(store.getState().tabs[0].mode, 'play')
  })

  it('getState does not expose mutable internal tabs array', () => {
    store.addTab(makeTab({id: 'tab_1'}))

    const state = store.getState()
    state.tabs.push(makeTab({id: 'tab_2'}))

    assert.strictEqual(store.getState().tabs.length, 1)
  })

  // --- Phase 0 compatibility: legacy phase → mode normalization ---

  it('normalizes legacy phase field to mode', () => {
    const legacyTab = { id: 'tab_1', taskId: 'task_1', phase: 'recall', childTabIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    store.addTab(legacyTab)
    assert.strictEqual(store.getState().tabs[0].mode, 'recall')
    assert.strictEqual(store.getState().tabs[0].phase, undefined)
  })

  // Phase 0: phase takes priority over mode for legacy compat.
  // Phase 1 implementation will flip this so mode takes priority.
  it('currently prefers phase over mode when both present (Phase 0 compat)', () => {
    const tab = { id: 'tab_1', taskId: 'task_1', mode: 'problem', phase: 'play', childTabIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    store.addTab(tab)
    assert.strictEqual(store.getState().tabs[0].mode, 'play')
  })

  it('normalizes phase in updateTab patch', () => {
    store.addTab(makeTab({id: 'tab_1', mode: 'play'}))
    store.updateTab('tab_1', {phase: 'recall'})
    assert.strictEqual(store.getState().tabs[0].mode, 'recall')
  })

  // ================================================================
  // P1G-T35: Phase 1 Gap -- recallSubstate and analysisReturnTarget
  // Contract: docs/design/2026-05-25/phase1-gaps/test-contract-v0.1.md
  // Contract Section 9 row P1G-T35
  //
  // Harness manifest:
  // - Real production modules: createWorkbenchStore
  // - Fake/spy modules: NONE
  // - Valid for: STORE_SUBSCRIPTION
  // - Not valid for: SERVICE_REPOSITORY_TRANSITION, CONTROLLER_STATE_TRANSITION
  // ================================================================

  describe('P1G-T35: recallSubstate and analysisReturnTarget roundtrip', () => {
    it('updateTab persists recallSubstate', () => {
      store.addTab(makeTab({id: 'tab_1', mode: 'recall'}))
      store.updateTab('tab_1', {recallSubstate: 'normal'})
      assert.strictEqual(store.getState().tabs[0].recallSubstate, 'normal')
    })

    it('updateTab persists analysisReturnTarget', () => {
      const target = {
        mode: 'play',
        recallSubstate: undefined,
        treePosition: 'pos_42',
        moveIndex: 15,
      }
      store.addTab(makeTab({id: 'tab_1', mode: 'analysis'}))
      store.updateTab('tab_1', {analysisReturnTarget: target})

      const stored = store.getState().tabs[0].analysisReturnTarget
      assert.ok(stored, 'analysisReturnTarget should be stored')
      assert.strictEqual(stored.mode, 'play')
      assert.strictEqual(stored.treePosition, 'pos_42')
      assert.strictEqual(stored.moveIndex, 15)
    })

    it('updateTab can clear analysisReturnTarget by setting undefined', () => {
      const target = {mode: 'play', treePosition: 'pos_1'}
      store.addTab(makeTab({id: 'tab_1', mode: 'analysis', analysisReturnTarget: target}))
      store.updateTab('tab_1', {analysisReturnTarget: undefined})

      const tab = store.getState().tabs[0]
      assert.strictEqual(tab.analysisReturnTarget, undefined,
        'analysisReturnTarget should be cleared')
    })

    it('updateTab preserves recallSubstate when patching other fields', () => {
      store.addTab(makeTab({id: 'tab_1', mode: 'recall', recallSubstate: 'normal'}))
      store.updateTab('tab_1', {currentTreePosition: 'new_pos'})

      const tab = store.getState().tabs[0]
      assert.strictEqual(tab.recallSubstate, 'normal',
        'recallSubstate should be preserved when patching unrelated fields')
      assert.strictEqual(tab.currentTreePosition, 'new_pos')
    })

    it('addTab stores recallSubstate and analysisReturnTarget from initial tab', () => {
      const target = {mode: 'problem', treePosition: 'pos_99'}
      store.addTab(makeTab({
        id: 'tab_1',
        mode: 'analysis',
        recallSubstate: 'normal',
        analysisReturnTarget: target,
      }))

      const tab = store.getState().tabs[0]
      assert.strictEqual(tab.recallSubstate, 'normal')
      assert.strictEqual(tab.analysisReturnTarget.mode, 'problem')
    })

    it('updateTab notifies subscribers when setting recallSubstate', () => {
      let callCount = 0
      store.addTab(makeTab({id: 'tab_1', mode: 'recall'}))
      store.subscribe(() => callCount++)
      store.updateTab('tab_1', {recallSubstate: 'normal'})
      assert.strictEqual(callCount, 1,
        'subscriber should be notified on recallSubstate update')
    })
  })
})
