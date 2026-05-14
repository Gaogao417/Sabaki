/**
 * Analysis display resolution: mode + user flags → which analysis UI is visible.
 *
 * Encapsulates the mode-based gating currently inline in App.js / MainView.js / Sidebar.js.
 * Does NOT read sabaki.state, import sabaki.js, or produce side effects.
 */

export type AnalysisDisplayInput = {
  /** Current app mode ('play', 'analysis', 'recall', 'scoring', etc.). */
  mode: string

  /** User toggle: show analysis overlay. */
  showAnalysis: boolean

  /** User toggle: show AI suggestions. */
  showAISuggestions: boolean

  /** User toggle: show human preference. */
  showHumanPreference: boolean

  /** User toggle: show next moves on board. */
  showNextMoves: boolean

  /** User toggle: show sibling variations on board. */
  showSiblings: boolean

  /** Whether the edit workspace is active. */
  editWorkspaceActive: boolean
}

export type AnalysisDisplayOutput = {
  showAnalysis: boolean
  showAISuggestions: boolean
  showHumanPreference: boolean
  showNextMoves: boolean
  showSiblings: boolean
  showAnalysisSummaryCard: boolean
}

const ANALYSIS_HIDDEN_MODES = ['guess', 'problem', 'review']
const NEXT_MOVES_HIDDEN_MODES = ['guess', 'recall', 'problem', 'review']

export function resolveAnalysisDisplay(input: AnalysisDisplayInput): AnalysisDisplayOutput {
  let {
    mode,
    showAnalysis,
    showAISuggestions,
    showHumanPreference,
    showNextMoves,
    showSiblings,
    editWorkspaceActive,
  } = input

  let analysisAllowed = mode === 'analysis' || mode === 'recall'

  return {
    showAnalysis:
      analysisAllowed && showAnalysis && (showAISuggestions || showHumanPreference),
    showAISuggestions: analysisAllowed && showAISuggestions,
    showHumanPreference: analysisAllowed && showHumanPreference,
    showNextMoves:
      !editWorkspaceActive && !NEXT_MOVES_HIDDEN_MODES.includes(mode) && showNextMoves,
    showSiblings:
      !editWorkspaceActive && !NEXT_MOVES_HIDDEN_MODES.includes(mode) && showSiblings,
    showAnalysisSummaryCard: analysisAllowed,
  }
}
