import type { NormalizedAnalysisResult } from '../types/analysis'

type EngineAnalysisEntry = {
  winrate?: number
  scoreLead?: number
  visits?: number
  moveVisits?: Record<string, number>
  pv?: Record<string, string[]>
}

type AnalysisServiceLike = {
  getAnalysisResults?(treePosition: string): EngineAnalysisEntry | null | undefined
}

type EngineServiceLike = {
  getAnalysisForPosition?(treePosition: string): EngineAnalysisEntry | null | undefined
}

type SabakiLike = {
  getPlayServices(): {
    analysisService?: AnalysisServiceLike
    engineService?: EngineServiceLike
  }
  state: {
    treePosition: string
  }
}

export type AnalysisResultAdapter = {
  getAnalysisForPosition(positionKey: string): NormalizedAnalysisResult | null
  subscribeToAnalysisUpdates(callback: (positionKey: string) => void): () => void
  notifyAnalysisUpdate(positionKey: string): void
}

export function createAnalysisResultAdapter(sabaki: SabakiLike): AnalysisResultAdapter {
  const listeners = new Set<(positionKey: string) => void>()

  function normalizeEntry(
    entry: EngineAnalysisEntry | null | undefined,
    positionKey: string,
  ): NormalizedAnalysisResult | null {
    if (!entry) return null

    const candidateMoves: NormalizedAnalysisResult['candidateMoves'] = []

    if (entry.moveVisits && entry.pv) {
      for (const [move, visits] of Object.entries(entry.moveVisits)) {
        const pv = entry.pv[move] ?? [move]
        candidateMoves.push({
          move,
          visits,
          pv,
        })
      }
    }

    // Sort by visits descending
    candidateMoves.sort((a, b) => (b.visits ?? 0) - (a.visits ?? 0))

    return {
      positionKey,
      scoreLead: entry.scoreLead,
      winrate: entry.winrate,
      visits: entry.visits,
      candidateMoves,
    }
  }

  return {
    getAnalysisForPosition(positionKey: string) {
      const services = sabaki.getPlayServices()

      // Try analysisService first, then engineService
      const entry =
        services.analysisService?.getAnalysisResults?.(positionKey) ??
        services.engineService?.getAnalysisForPosition?.(positionKey)

      return normalizeEntry(entry, positionKey)
    },

    subscribeToAnalysisUpdates(callback) {
      listeners.add(callback)
      return () => {
        listeners.delete(callback)
      }
    },

    notifyAnalysisUpdate(positionKey: string) {
      for (const cb of listeners) {
        cb(positionKey)
      }
    },
  }
}
