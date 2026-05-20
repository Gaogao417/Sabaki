/**
 * gobanDataAdapter — read-only adapter that subscribes to board/overlay/settings
 * data sources and outputs GobanPropsInput snapshots for the Container.
 *
 * Architecture constraints:
 *   - NEVER writes to any store
 *   - NEVER calls any service method
 *   - NEVER imports sabaki.js directly
 *   - All dependencies injected via deps parameter
 */

import type { GobanPropsInput } from '../workbench/projectGobanProps'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type GobanDataAdapterDeps = {
  getSabakiState: () => {
    treePosition: string
    gameTrees: unknown[]
    gameIndex: number
    selectedTool: string
    editWorkspace: unknown | null
    showMoveNumbers: boolean | null
    showNextMoves: boolean | null
    showSiblings: boolean | null
    showAnalysis: boolean | null
    showCoordinates: boolean | null
    showHumanPreference: boolean | null
    showMoveColorization: boolean | null
    fuzzyStonePlacement: boolean | null
    animateStonePlacement: boolean | null
    boardTransformation: number[]
    analysisType: string | null
    areaSelectMode: boolean
  }
  getDocumentStore: () => {
    getCurrentTree(): unknown
    getCurrentTreePosition(): string
    getCurrentBoard(): {
      width: number
      height: number
      signMap: number[][]
      get(vertex: [number, number]): number
      markers: (null | { type: string; label?: string })[][]
      lines: unknown[]
      siblingsInfo: Record<string, unknown>
      childrenInfo: Record<string, unknown>
    }
  }
  getOverlayStore: () => {
    getState(): { territoryEnabled: boolean; territoryCompareEnabled: boolean }
  }
  getAnalysisResultAdapter: () => {
    getAnalysisForPosition(positionKey: string): unknown | null
  }
  getWorkbenchStore: () => {
    getState(): {
      activeTabId: string
      tabs: Array<{
        id: string
        mode: string
        taskId: string
        playerConfig?: unknown
        activeAttemptId?: string
        activeRecallSessionId?: string
        problemArea?: unknown
        previousMode?: string
      }>
    }
    subscribe(cb: () => void): () => void
  }
  getRuntimeStore: () => {
    getState(): {
      activeCheckpointId?: string
      correctionDraft?: unknown
      recallView?: unknown
      problemView?: unknown
    }
    subscribe(cb: () => void): () => void
  }
  getRepository: () => { loadTask(taskId: string): Promise<unknown> }
  subscribeToSabakiStateChange: (cb: () => void) => () => void
  subscribeToWorkbenchStore: (cb: () => void) => () => void
  subscribeToRuntimeStore: (cb: () => void) => () => void
  subscribeToAnalysisUpdates: (cb: () => void) => () => void
}

export type GobanDataAdapter = {
  getSnapshot(): GobanPropsInput
  subscribe(callback: () => void): () => void
  destroy(): void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultBoolean(value: boolean | null | undefined, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function defaultString(value: string | null | undefined, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGobanDataAdapter(deps: GobanDataAdapterDeps): GobanDataAdapter {
  // Adapter-internal listeners for data-source changes
  const listeners = new Set<() => void>()

  // Task cache: keyed by tabId. Invalidated on tab switch.
  let cachedTaskId: string | null = null
  let cachedTask: unknown = null
  let lastActiveTabId: string | null = null

  // Subscription cleanup functions
  const unsubscribes: Array<() => void> = []

  // --- notify all listeners ---
  function notifyListeners() {
    for (const cb of listeners) {
      cb()
    }
  }

  // --- task loading (async, fires notification when loaded) ---
  function loadTaskIfNeeded() {
    const ws = deps.getWorkbenchStore().getState()
    const activeTabId = ws.activeTabId
    const activeTab = ws.tabs.find(t => t.id === activeTabId)

    // Invalidate cache on tab switch
    if (activeTabId !== lastActiveTabId) {
      lastActiveTabId = activeTabId
      cachedTaskId = null
      cachedTask = null
    }

    const taskId = activeTab?.taskId
    if (!taskId) return

    // Already cached for this tab
    if (taskId === cachedTaskId) return

    // Trigger async load; cache result and notify when ready
    cachedTaskId = taskId
    deps.getRepository().loadTask(taskId).then(task => {
      // Only update if still the same tab+task
      const currentWs = deps.getWorkbenchStore().getState()
      const currentTab = currentWs.tabs.find(t => t.id === currentWs.activeTabId)
      if (currentTab?.taskId === taskId) {
        cachedTask = task
        notifyListeners()
      }
    }).catch(() => {
      // Silently ignore load failures; cachedTask remains null
    })
  }

  // --- subscription wiring ---
  function onSourceChange() {
    loadTaskIfNeeded()
    notifyListeners()
  }

  unsubscribes.push(deps.subscribeToSabakiStateChange(onSourceChange))
  unsubscribes.push(deps.subscribeToWorkbenchStore(onSourceChange))
  unsubscribes.push(deps.subscribeToRuntimeStore(onSourceChange))
  unsubscribes.push(deps.subscribeToAnalysisUpdates(onSourceChange))

  // Kick off initial task load (deferred so sentinel deps in T15 do not crash)
  // Use microtask to allow the constructor to return first.
  Promise.resolve().then(() => {
    loadTaskIfNeeded()
  })

  // --- getSnapshot ---
  function getSnapshot(): GobanPropsInput {
    const sabakiState = deps.getSabakiState()
    const documentStore = deps.getDocumentStore()
    const analysisResultAdapter = deps.getAnalysisResultAdapter()
    const ws = deps.getWorkbenchStore().getState()
    const rs = deps.getRuntimeStore().getState()

    const activeTab = ws.tabs.find(t => t.id === ws.activeTabId)

    // boardState
    const gameTree = documentStore.getCurrentTree()
    const treePosition = documentStore.getCurrentTreePosition()
    const board = documentStore.getCurrentBoard()

    // workbenchMode from activeTab
    const workbenchMode = (activeTab?.mode || 'play') as GobanPropsInput['workbenchMode']

    // overlayState
    const overlayState: GobanPropsInput['overlayState'] = {
      paintMap: (sabakiState as Record<string, unknown>).paintMap as number[][] ?? [],
      markerMap: (sabakiState as Record<string, unknown>).markerMap as (object | null)[][] ?? [],
      dimmedStones: ((sabakiState as Record<string, unknown>).dimmedStones as [number, number][]) ?? [],
      analysis: analysisResultAdapter.getAnalysisForPosition(treePosition),
    }

    // settings
    const boardTransformation =
      Array.isArray(sabakiState.boardTransformation) && sabakiState.boardTransformation.length === 6
        ? sabakiState.boardTransformation
        : [1, 0, 0, 1, 0, 0]

    const settings: GobanPropsInput['settings'] = {
      showMoveNumbers: defaultBoolean(sabakiState.showMoveNumbers, false),
      showNextMoves: defaultBoolean(sabakiState.showNextMoves, true),
      showSiblings: defaultBoolean(sabakiState.showSiblings, true),
      showAnalysis: defaultBoolean(sabakiState.showAnalysis, false),
      showCoordinates: defaultBoolean(sabakiState.showCoordinates, true),
      showHumanPreference: defaultBoolean(sabakiState.showHumanPreference, false),
      selectedTool: defaultString(sabakiState.selectedTool, 'stone_1'),
      editWorkspaceActive: sabakiState.editWorkspace != null,
      boardTransformation,
      areaSelectMode: !!sabakiState.areaSelectMode,
    }

    // analysisData
    const analysisData: GobanPropsInput['analysisData'] = {
      activeAnalysis: analysisResultAdapter.getAnalysisForPosition(treePosition),
      analysisType: sabakiState.analysisType ?? '',
    }

    // runtimeState
    const runtimeState: GobanPropsInput['runtimeState'] = {
      activeCheckpointId: rs.activeCheckpointId,
      correctionDraft: rs.correctionDraft,
    }

    // task
    const taskData: GobanPropsInput['task'] = cachedTask as GobanPropsInput['task'] ?? null

    return {
      workbenchMode,
      task: taskData,
      runtimeState,
      boardState: {
        gameTree: gameTree as object | null,
        treePosition,
        board: board as object,
      },
      overlayState,
      settings,
      analysisData,
    }
  }

  // --- subscribe ---
  function subscribe(callback: () => void): () => void {
    listeners.add(callback)
    return () => {
      listeners.delete(callback)
    }
  }

  // --- destroy ---
  function destroy() {
    for (const unsub of unsubscribes) {
      unsub()
    }
    unsubscribes.length = 0
    listeners.clear()
  }

  return {
    getSnapshot,
    subscribe,
    destroy,
  }
}
