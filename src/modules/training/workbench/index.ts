export {
  createWorkbenchTabService,
  type WorkbenchTabService,
  type WorkbenchTabServiceDeps,
} from './workbenchTabService'

/**
 * @deprecated Use createWorkbenchFlowService instead.
 */
export {
  createWorkbenchPhaseService,
  type WorkbenchPhaseService,
  type WorkbenchPhaseServiceDeps,
  type PhaseTransition,
  VALID_PHASE_TRANSITIONS,
  PHASE_TRANSITION_RESULT,
  InvalidPhaseTransitionError,
} from './workbenchPhaseService'

export {
  createWorkbenchFlowService,
  type WorkbenchFlowService,
  type WorkbenchFlowServiceDeps,
  InvalidModeTransitionError,
} from './workbenchFlowService'

export {
  computeModeBarPolicy,
  getModeTransitionAction,
  type ModeAvailability,
  type ModeBarPolicy,
  type UiPolicyInput,
  type ModeTransitionAction,
} from './workbenchUiPolicy'
