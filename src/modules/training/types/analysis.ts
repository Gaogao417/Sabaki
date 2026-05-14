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
