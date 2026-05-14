export { createWorkbenchStore } from './store/workbenchStore'
export { createTrainingRuntimeStore } from './store/trainingRuntimeStore'
export { createTrainingRepository } from './repository/trainingRepository'
export { createLegacySabakiAdapter } from './adapter/legacySabakiAdapter'
export { createPositionSnapshotAdapter } from './adapter/positionSnapshotAdapter'
export { createAnalysisResultAdapter } from './adapter/analysisResultAdapter'

export {
  createWorkbenchTabService,
  createWorkbenchPhaseService,
  VALID_PHASE_TRANSITIONS,
  PHASE_TRANSITION_RESULT,
  InvalidPhaseTransitionError,
} from './workbench/index'

export {
  createAttemptService,
  createPlayTrainingMonitor,
  evaluateMove,
  classifySeverity,
  evaluateAttempt,
  shouldCreateBadMove,
} from './attempt/index'

export {
  createRecallService,
  createRecallCheckpointService,
} from './recall/index'

export {
  createSnapshotService,
} from './analysis/index'

export {
  createReviewService,
} from './review/reviewService'

export {
  createProblemService,
} from './problem/problemService'

export {
  createProblemFlowService,
} from './problem/problemFlowService'

export {
  projectTrainingState,
} from './adapter/trainingStateProjection'

export {
  createLegacyTrainingFlowController,
} from './controller/legacyTrainingFlowController'

export type * from './types/index'
