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
})
