import type { ProblemArea } from '../types/index'

export type EngineMoveAdapterDeps = {
  engineConnection: {
    analyze(params: {
      positionSgf: string
      analysisArea?: ProblemArea
      area?: ProblemArea
      analyzeRange?: ProblemArea
      [key: string]: unknown
    }): Promise<{
      move: string
      candidates: Array<{
        move: string
        visits: number
        winrate: number
        scoreLead: number
        pv: string[]
      }>
    }>
  }
}

export type EngineMoveRequestInput = {
  engineId?: string
  positionSgf: string
  timeLimitMs?: number
  maxVisits?: number
  analysisArea?: ProblemArea
}

export type EngineMoveResult = {
  move: string
  candidates: string[]
}

export function createEngineMoveAdapter(deps: EngineMoveAdapterDeps) {
  const { engineConnection } = deps

  async function requestMove(input: EngineMoveRequestInput): Promise<EngineMoveResult> {
    const { positionSgf, analysisArea } = input

    const analyzeParams: Record<string, unknown> = {
      positionSgf,
    }

    if (analysisArea) {
      analyzeParams.analysisArea = analysisArea
      analyzeParams.area = analysisArea
      analyzeParams.analyzeRange = analysisArea
    }

    const result = await engineConnection.analyze(analyzeParams)

    return {
      move: result.move,
      candidates: result.candidates.map(c => c.move),
    }
  }

  return { requestMove }
}
