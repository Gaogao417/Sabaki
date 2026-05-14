import {h, Component} from 'preact'

import WorkbenchShell from './WorkbenchShell.js'

class TrainingWorkbenchContainer extends Component {
  componentDidMount() {
    const {runtimeStore, workbenchStore} =
      this.props.sabaki.getTrainingContext()

    this._unsubRuntime = runtimeStore.subscribe(() => this.forceUpdate())
    this._unsubWorkbench = workbenchStore.subscribe(() => this.forceUpdate())
  }

  componentWillUnmount() {
    this._unsubRuntime?.()
    this._unsubWorkbench?.()
  }

  render() {
    const {sabaki, ...shellProps} = this.props
    const {
      runtimeStore,
      legacyTrainingFlowController,
    } = sabaki.getTrainingContext()
    const rt = runtimeStore.getState()

    // Project runtimeStore view models into legacy prop shapes
    // that WorkbenchShell/RecallBar/ProblemBar expect.
    const projected = projectFromRuntime(rt)

    const handlers = {
      onShowRecallHint: () => legacyTrainingFlowController.showRecallHint(),
      onSkipRecallMove: () => legacyTrainingFlowController.skipRecallMove(),
      onEndRecallSession: () => legacyTrainingFlowController.endRecallSession(),
      onUndoProblemMove: () => legacyTrainingFlowController.undoProblemMove(),
      onSubmitProblemAttempt: () =>
        legacyTrainingFlowController.submitProblemAttempt(),
      onExitProblemMode: () => legacyTrainingFlowController.exitProblemMode(),
      onAdvanceReview: () => legacyTrainingFlowController.advanceReview(),
    }

    return h(WorkbenchShell, {
      ...shellProps,
      ...projected,
      ...handlers,
    })
  }
}

function projectFromRuntime(rt) {
  const result = {}

  if (rt.recallView) {
    const v = rt.recallView
    result.recallSession = {active: true}
    result.recallMoveIndex = v.moveIndex
    result.recallExpectedMoves = v.expectedMoves
    result.recallUserAttempts = v.userAttempts
    result.recallShowHint = v.showHint
    result.recallCompleted = v.completed
  }

  if (rt.problemView) {
    const v = rt.problemView
    result.problemSession = v.legacyProblemSession
    result.problemAttempt = {
      userLine: v.evalCache.map((e) => e.move),
      moveEvaluations: v.evalCache,
    }
    result.problemEvalCache = v.evalCache
    result.problemBadMoves = v.badMoves
    result.problemSubmitted = v.submitted
    result.problemResult = v.result
  }

  if (rt.reviewQueueView) {
    const v = rt.reviewQueueView
    result.reviewQueue = v.queue
    result.reviewCurrentIndex = v.currentIndex
    result.reviewTotalDue = v.totalDue
  }

  return result
}

export default TrainingWorkbenchContainer
