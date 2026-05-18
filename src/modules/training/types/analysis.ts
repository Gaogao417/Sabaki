export type NormalizedAnalysisResult = {
  positionKey: string
  scoreLead?: number
  winrate?: number
  visits?: number
  candidateMoves: Array<{
    move: string
    scoreLead?: number
    winrate?: number
    visits?: number
    pv: string[]
  }>
}

export type AnalysisContextSource = 'play' | 'problem' | 'recall' | 'direct'

export type AnalysisContext = {
  taskId: string
  attemptId?: string
  checkpointId?: string
  positionHash?: string
  positionSgf?: string
  source: AnalysisContextSource
}

const VALID_SOURCES: AnalysisContextSource[] = ['play', 'problem', 'recall', 'direct']

export function createAnalysisContext(input: {
  taskId: string
  attemptId?: string
  checkpointId?: string
  positionHash?: string
  positionSgf?: string
  source: string
}): AnalysisContext {
  if (!VALID_SOURCES.includes(input.source as AnalysisContextSource)) {
    throw new Error(`Invalid AnalysisContext source: ${input.source}. Must be one of: ${VALID_SOURCES.join(', ')}`)
  }
  return {
    taskId: input.taskId,
    attemptId: input.attemptId,
    checkpointId: input.checkpointId,
    positionHash: input.positionHash,
    positionSgf: input.positionSgf,
    source: input.source as AnalysisContextSource,
  }
}
