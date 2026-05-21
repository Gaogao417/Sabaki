import type { WorkbenchTab } from '../types/index'

export type WorkbenchStoreState = {
  tabs: WorkbenchTab[]
  activeTabId: string | null
}

export type WorkbenchStoreDeps = {
  logger?: {
    info(channel: string, message: string, data?: Record<string, unknown>): void
    warn?(channel: string, message: string, data?: Record<string, unknown>): void
  }
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

export function createWorkbenchStore(deps?: WorkbenchStoreDeps): WorkbenchStore {
  const { logger } = deps ?? {}
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

  // Phase 0 compatibility: derive mode from phase when mode is absent.
  // When both are present, phase takes priority (handles legacy patch with {phase}).
  function normalizeTab(tab: Record<string, unknown>): WorkbenchTab {
    const phase = tab.phase as WorkbenchTab['mode'] | undefined
    const existingMode = tab.mode as WorkbenchTab['mode'] | undefined
    const mode = phase || existingMode
    const { phase: _, ...rest } = tab as Record<string, unknown> & { phase?: unknown }
    return { ...rest, mode } as WorkbenchTab
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
      const normalized = tabs.map(t => normalizeTab(t))
      state = { ...state, tabs: normalized }
      // Clear activeTabId if it no longer references a tab in the new list
      if (state.activeTabId != null && !normalized.some(t => t.id === state.activeTabId)) {
        state = { ...state, activeTabId: null }
      }
      notify()
    },

    addTab(tab: WorkbenchTab) {
      if (findTab(tab.id)) {
        throw new Error(`workbenchStore.addTab: duplicate tab id "${tab.id}"`)
      }
      const normalized = normalizeTab(tab)
      state = { ...state, tabs: [...state.tabs, normalized] }
      logger?.info('workbench.tab_added', 'Tab added', { tabId: tab.id, mode: normalized.mode })
      notify()
    },

    updateTab(tabId: string, patch: Partial<WorkbenchTab>) {
      if (!findTab(tabId)) {
        throw new Error(`workbenchStore.updateTab: tab not found (id="${tabId}")`)
      }
      const prevTab = findTab(tabId)
      state = {
        ...state,
        tabs: state.tabs.map((t) => {
          if (t.id !== tabId) return t
          const merged = { ...t, ...patch, updatedAt: new Date().toISOString() }
          return normalizeTab(merged)
        }),
      }
      const updatedTab = findTab(tabId)
      if (prevTab && updatedTab && prevTab.mode !== updatedTab.mode) {
        logger?.info('workbench.tab_mode_changed', 'Tab mode changed', {
          tabId,
          from: prevTab.mode,
          to: updatedTab.mode,
        })
      }
      notify()
    },

    removeTab(tabId: string) {
      const removedTab = findTab(tabId)
      state = {
        ...state,
        tabs: state.tabs.filter((t) => t.id !== tabId),
        activeTabId: state.activeTabId === tabId ? null : state.activeTabId,
      }
      logger?.info('workbench.tab_removed', 'Tab removed', { tabId, mode: removedTab?.mode })
      notify()
    },

    setActiveTab(tabId: string | null) {
      if (tabId != null && !findTab(tabId)) {
        throw new Error(`workbenchStore.setActiveTab: tab not found (id="${tabId}")`)
      }
      const targetTab = tabId != null ? findTab(tabId) : undefined
      logger?.info('workbench.tab_switched', 'Active tab changed', { tabId, mode: targetTab?.mode })
      state = { ...state, activeTabId: tabId }
      notify()
    },
  }
}
