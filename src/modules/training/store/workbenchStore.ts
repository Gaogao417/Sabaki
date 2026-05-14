import type { WorkbenchTab } from '../types/index'

export type WorkbenchStoreState = {
  tabs: WorkbenchTab[]
  activeTabId: string | null
}

export type WorkbenchStore = {
  getState(): WorkbenchStoreState
  subscribe(listener: () => void): () => void

  // Service-only mutation methods
  setTabs(tabs: WorkbenchTab[]): void
  addTab(tab: WorkbenchTab): void
  updateTab(tabId: string, patch: Partial<WorkbenchTab>): void
  removeTab(tabId: string): void
  setActiveTab(tabId: string | null): void
}

export function createWorkbenchStore(): WorkbenchStore {
  let state: WorkbenchStoreState = {
    tabs: [],
    activeTabId: null,
  }

  const listeners = new Set<() => void>()

  function notify() {
    for (const listener of listeners) {
      listener()
    }
  }

  function findTab(tabId: string): WorkbenchTab | undefined {
    return state.tabs.find(t => t.id === tabId)
  }

  return {
    getState() {
      return {
        tabs: [...state.tabs],
        activeTabId: state.activeTabId,
      }
    },

    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    setTabs(tabs: WorkbenchTab[]) {
      state = { ...state, tabs }
      // Clear activeTabId if it no longer references a tab in the new list
      if (state.activeTabId != null && !tabs.some(t => t.id === state.activeTabId)) {
        state = { ...state, activeTabId: null }
      }
      notify()
    },

    addTab(tab: WorkbenchTab) {
      if (findTab(tab.id)) {
        throw new Error(`workbenchStore.addTab: duplicate tab id "${tab.id}"`)
      }
      state = { ...state, tabs: [...state.tabs, { ...tab }] }
      notify()
    },

    updateTab(tabId: string, patch: Partial<WorkbenchTab>) {
      if (!findTab(tabId)) {
        throw new Error(`workbenchStore.updateTab: tab not found (id="${tabId}")`)
      }
      state = {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === tabId ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t
        ),
      }
      notify()
    },

    removeTab(tabId: string) {
      state = {
        ...state,
        tabs: state.tabs.filter((t) => t.id !== tabId),
        activeTabId: state.activeTabId === tabId ? null : state.activeTabId,
      }
      notify()
    },

    setActiveTab(tabId: string | null) {
      if (tabId != null && !findTab(tabId)) {
        throw new Error(`workbenchStore.setActiveTab: tab not found (id="${tabId}")`)
      }
      state = { ...state, activeTabId: tabId }
      notify()
    },
  }
}
