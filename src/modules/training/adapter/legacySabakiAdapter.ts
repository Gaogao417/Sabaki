/**
 * Wraps sabaki.js legacy API for the new training domain.
 *
 * During transition, new training code uses this adapter instead of
 * directly calling sabaki.js methods. This isolates training from
 * legacy global state.
 */

type SabakiLike = {
  state: {
    mode: string
    treePosition: string
    [key: string]: unknown
  }
  setMode(mode: string): void
  setState(patch: Record<string, unknown>, callback?: (() => void) | null): void
  loadGameTrees(trees: unknown[], options?: Record<string, unknown>): Promise<void>
  setCurrentTreePosition(tree: unknown, treePosition: string, options?: Record<string, unknown>): void
  getPlayServices(): {
    documentStore: {
      getCurrentTree(): unknown
      getCurrentTreePosition(): string
    }
    engineService: {
      ensureAnalyzerForProblemMode(): void
      getAnalysisForPosition(tp: string): unknown
    }
    analysisService: unknown
  }
  getTrainingStore(): unknown
  analyzeMove(treePosition: string): void
  inferredState: {
    analyzingEngineSyncer: unknown | null
    [key: string]: unknown
  }
}

export type LegacySabakiAdapter = {
  getCurrentMode(): string
  setLegacyMode(mode: string): void
  getCurrentTreePosition(): string | undefined
  navigateToTreePosition(tree: unknown, position: string): void
  notifyLegacyStateChanged(patch?: Record<string, unknown>): void
  loadGameTrees(trees: unknown[], options?: Record<string, unknown>): Promise<void>
  getCurrentTree(): unknown
  getSabaki(): SabakiLike

  // Problem-mode setup helpers
  setupProblemLegacyState(patch: {
    problemSession: unknown
    problemAttempt: unknown
    problemWorkspace: unknown
    problemEvalCache: unknown[]
    problemBadMoves: unknown[]
    problemSubmitted: boolean
    problemResult: unknown
  }): void
  setCurrentTreePosition(tree: unknown, position: string): void
  setProblemMode(): void
  startAnalysisIfEngineReady(treePosition: string): void
}

export function createLegacySabakiAdapter(sabaki: SabakiLike): LegacySabakiAdapter {
  return {
    getCurrentMode() {
      return sabaki.state.mode
    },

    setLegacyMode(mode: string) {
      sabaki.setMode(mode)
    },

    getCurrentTreePosition() {
      return sabaki.state.treePosition
    },

    navigateToTreePosition(tree: unknown, position: string) {
      sabaki.setCurrentTreePosition(tree, position)
    },

    notifyLegacyStateChanged(patch?: Record<string, unknown>) {
      sabaki.setState(patch ?? {})
    },

    loadGameTrees(trees: unknown[], options?: Record<string, unknown>) {
      return sabaki.loadGameTrees(trees, options)
    },

    getCurrentTree() {
      return sabaki.getPlayServices().documentStore.getCurrentTree()
    },

    getSabaki() {
      return sabaki
    },

    setupProblemLegacyState(patch) {
      sabaki.setState({
        problemSession: patch.problemSession,
        problemAttempt: patch.problemAttempt,
        problemWorkspace: patch.problemWorkspace,
        problemEvalCache: patch.problemEvalCache,
        problemBadMoves: patch.problemBadMoves,
        problemSubmitted: patch.problemSubmitted,
        problemResult: patch.problemResult,
      })
    },

    setCurrentTreePosition(tree: unknown, position: string) {
      sabaki.setCurrentTreePosition(tree, position)
    },

    setProblemMode() {
      sabaki.setMode('problem')
    },

    startAnalysisIfEngineReady(treePosition: string) {
      if (sabaki.inferredState.analyzingEngineSyncer != null) {
        sabaki.analyzeMove(treePosition)
      }
    },
  }
}
