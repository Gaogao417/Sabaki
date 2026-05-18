import {h} from 'preact'
import PlayRightPanel from '../panels/PlayRightPanel.js'
import ProblemRightPanel from '../panels/ProblemRightPanel.js'
import RecallRightPanel from '../panels/RecallRightPanel.js'
import AnalysisRightPanel from '../panels/AnalysisRightPanel.js'

/**
 * RightModePanel renders mode-specific content in the right panel area.
 * Phase 6: delegates to mode-specific right panel components.
 *
 * @param {Object} props
 * @param {'play'|'problem'|'recall'|'analysis'} props.mode - Current mode
 */
export default function RightModePanel(props) {
  const {mode = 'play', ...rest} = props

  let panelContent
  switch (mode) {
    case 'play':
      panelContent = h(PlayRightPanel, {
        moveCount: rest.moveCount,
        captures: rest.captures,
        pendingEval: rest.pendingEval,
        badMoveCount: rest.badMoveCount,
      })
      break
    case 'problem':
      panelContent = h(ProblemRightPanel, {
        currentVariation: rest.currentVariation,
        opponentMode: rest.opponentMode,
        hint: rest.hint,
        aiAnalysisHidden: rest.aiAnalysisHidden,
        referenceLines: rest.referenceLines,
      })
      break
    case 'recall':
      panelContent = h(RecallRightPanel, {
        hintMessage: rest.hintMessage,
        systemCheckpoints: rest.systemCheckpoints,
        manualCheckpoints: rest.manualCheckpoints,
        correctCount: rest.correctCount,
        wrongCount: rest.wrongCount,
        progress: rest.progress,
        totalMoves: rest.totalMoves,
      })
      break
    case 'analysis':
      panelContent = h(AnalysisRightPanel, {
        moveCount: rest.moveCount,
        captures: rest.captures,
        evaluation: rest.evaluation,
        userOriginalLine: rest.userOriginalLine,
        userCorrection: rest.userCorrection,
        aiCandidates: rest.aiCandidates,
      })
      break
    default:
      panelContent = h('div', null, mode)
  }

  return h('div', {
    'data-testid': 'right-mode-panel',
    class: 'wb-right-mode-panel',
  }, panelContent)
}
