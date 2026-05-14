export {
  createAttemptService,
  type AttemptService,
  type AttemptServiceDeps,
} from './attemptService'

export {
  createPlayTrainingMonitor,
  type PlayTrainingMonitor,
  type PlayTrainingMonitorDeps,
} from './playTrainingMonitor'

export {
  evaluateMove,
  classifySeverity,
  evaluateAttempt,
  shouldCreateBadMove,
  type Severity,
} from './evaluationRules'
