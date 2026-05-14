import {h, Component} from 'preact'

import WorkbenchShell from './WorkbenchShell.js'

class TrainingWorkbenchContainer extends Component {
  componentDidMount() {
    const {runtimeStore, workbenchStore} =
      this.props.sabaki.getTrainingServices()

    // Transitional: App still subscribes to training stores.
    // Container subscription will become the sole owner after
    // projectTrainingState is moved out of App.
    this._unsubRuntime = runtimeStore.subscribe(() => this.forceUpdate())
    this._unsubWorkbench = workbenchStore.subscribe(() => this.forceUpdate())
  }

  componentWillUnmount() {
    this._unsubRuntime?.()
    this._unsubWorkbench?.()
  }

  render() {
    const {sabaki, ...shellProps} = this.props
    const {runtimeStore} = sabaki.getTrainingServices()
    const rt = runtimeStore.getState()

    const recallViewModel = rt.recallView
      ? {
          moveIndex: rt.recallView.moveIndex,
          totalMoves: rt.recallView.expectedMoves.length,
          showHint: rt.recallView.showHint,
          completed: rt.recallView.completed,
        }
      : null

    // Transitional: handlers delegate to sabaki facade via controller.
    // Commit 3 replaces controller implementations with real logic.
    const {controller} = sabaki.getTrainingServices()
    const handlers = {
      onShowRecallHint: () => controller.showRecallHint(),
      onSkipRecallMove: () => controller.skipRecallMove(),
      onEndRecallSession: () => controller.endRecallSession(),
      onUndoProblemMove: () => controller.undoProblemMove(),
      onSubmitProblemAttempt: () => controller.submitProblemAttempt(),
      onExitProblemMode: () => controller.exitProblemMode(),
      onAdvanceReview: () => controller.advanceReview(),
    }

    return h(WorkbenchShell, {
      ...shellProps,
      ...handlers,
      recallViewModel,
      problemViewModel: rt.problemView,
    })
  }
}

export default TrainingWorkbenchContainer
