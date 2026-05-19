import type { WorkbenchMode } from '../types/index'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModeAvailability = {
  enabled: boolean
  reason?: string // Tooltip text when disabled (Chinese, per PRD/UX language)
}

export type ModeBarPolicy = {
  [mode in WorkbenchMode]: ModeAvailability
}

export type UiPolicyInput = {
  currentMode: WorkbenchMode
  previousMode?: WorkbenchMode
  activeAttemptId?: string
  activeRecallSessionId?: string
}

export type ModeTransitionAction = 'enterAnalysis' | 'returnFromAnalysis' | 'noop' | null

// ---------------------------------------------------------------------------
// computeModeBarPolicy
// ---------------------------------------------------------------------------

/**
 * Pure function: given the current workbench tab state, compute which mode
 * segments in the segmented mode control are enabled/disabled and why.
 *
 * Policy rules derive from:
 *   - workbenchFlowService.MODE_TRANSITIONS (legal flow transitions)
 *   - W1 contract section 2.3 (segmented control is a request, not permission)
 *   - PRD v0.5 mode bar behaviour
 *
 * User-clickable transitions from the segmented control:
 *   - any mode -> analysis  (enterAnalysis)
 *   - analysis -> previousMode (returnFromAnalysis)
 *   - currentMode -> currentMode (no-op, always enabled)
 *
 * NOT user-clickable (flow-driven only):
 *   - play/problem -> recall (submit only)
 *   - recall -> play/problem (completeRecall only)
 *   - play <-> problem (no direct transition in v0.5)
 */
export function computeModeBarPolicy(input: UiPolicyInput): ModeBarPolicy {
  const { currentMode, previousMode } = input

  const policy: ModeBarPolicy = {
    play: { enabled: false },
    problem: { enabled: false },
    recall: { enabled: false },
    analysis: { enabled: false },
  }

  // Every mode is clickable on itself (no-op).
  policy[currentMode] = { enabled: true }

  // enterAnalysis is legal from play, problem, and recall.
  if (currentMode !== 'analysis') {
    policy.analysis = { enabled: true }
  }

  // In analysis mode, the user can return to previousMode.
  if (currentMode === 'analysis') {
    if (previousMode) {
      policy[previousMode] = { enabled: true }
    }
  }

  // Fill in disabled reasons for all disabled segments.
  const allModes: WorkbenchMode[] = ['play', 'problem', 'recall', 'analysis']

  for (const mode of allModes) {
    if (policy[mode].enabled) continue

    policy[mode] = {
      enabled: false,
      reason: getDisabledReason(currentMode, mode, input),
    }
  }

  return policy
}

// ---------------------------------------------------------------------------
// getModeTransitionAction
// ---------------------------------------------------------------------------

/**
 * Given current state and a target mode click, return the action the
 * container should invoke on workbenchFlowService, or null if the
 * transition is not allowed from the segmented control.
 *
 * This maps UI clicks to service methods:
 *   - enterAnalysis  -> flowService.enterAnalysis(tabId)
 *   - returnFromAnalysis -> flowService.returnFromAnalysis(tabId, previousMode)
 *   - noop -> no service call needed (already in target mode)
 *   - null -> click should be ignored / segment is disabled
 */
export function getModeTransitionAction(
  input: UiPolicyInput,
  targetMode: WorkbenchMode,
): ModeTransitionAction {
  const { currentMode, previousMode } = input

  // Clicking current mode is a no-op.
  if (targetMode === currentMode) {
    return 'noop'
  }

  // From non-analysis modes, clicking analysis triggers enterAnalysis.
  if (currentMode !== 'analysis' && targetMode === 'analysis') {
    return 'enterAnalysis'
  }

  // From analysis, clicking previousMode triggers returnFromAnalysis.
  if (currentMode === 'analysis' && targetMode === previousMode) {
    return 'returnFromAnalysis'
  }

  // All other clicks are not allowed from the segmented control.
  return null
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getDisabledReason(
  currentMode: WorkbenchMode,
  targetMode: WorkbenchMode,
  input: UiPolicyInput,
): string {
  // --- analysis disabled from analysis (no previousMode to return to) ---
  if (targetMode === 'analysis') {
    // This case occurs when currentMode === 'analysis' and the user clicks
    // analysis again but there is no distinct previousMode to return to
    // (shouldn't normally happen since analysis -> analysis is a no-op).
    return '请先返回上一个模式'
  }

  // --- target is play ---
  if (targetMode === 'play') {
    if (currentMode === 'problem') return '请先提交或放弃当前题目'
    if (currentMode === 'recall') return '回忆进行中，请先结束回忆'
    if (currentMode === 'analysis') return '请先返回上一个模式'
  }

  // --- target is problem ---
  if (targetMode === 'problem') {
    if (currentMode === 'play') return '请先结束当前对局'
    if (currentMode === 'recall') return '回忆进行中，请先结束回忆'
    if (currentMode === 'analysis') return '请先返回上一个模式'
  }

  // --- target is recall ---
  if (targetMode === 'recall') {
    if (currentMode === 'analysis') return '请先返回上一个模式'
    if (currentMode === 'play') {
      return input.activeAttemptId
        ? '请先提交当前对局'
        : '请先提交当前对局'
    }
    if (currentMode === 'problem') {
      return input.activeAttemptId
        ? '请先提交当前答案'
        : '请先提交当前答案'
    }
  }

  return ''
}
