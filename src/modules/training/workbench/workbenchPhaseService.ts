import type { WorkbenchPhase } from '../types/index'
import type { WorkbenchStore } from '../store/workbenchStore'

const VALID_PHASES: Set<string> = new Set(['play', 'recall', 'analysis'])

export type PhaseTransition =
  | 'submit'
  | 'complete'
  | 'restart'
  | 'snapshot'

export const VALID_PHASE_TRANSITIONS: Record<WorkbenchPhase, PhaseTransition[]> = {
  play: ['submit'],
  recall: ['complete', 'restart'],
  analysis: ['restart', 'snapshot'],
}

export const PHASE_TRANSITION_RESULT: Record<string, WorkbenchPhase> = {
  'play:submit': 'recall',
  'recall:complete': 'analysis',
  'recall:restart': 'play',
  'analysis:restart': 'play',
}

export type WorkbenchPhaseService = {
  transition(tabId: string, transition: PhaseTransition): void
  getPhase(tabId: string): WorkbenchPhase | null
  getValidTransitions(tabId: string): PhaseTransition[]
}

export type WorkbenchPhaseServiceDeps = {
  workbenchStore: WorkbenchStore
  logger?: { info(channel: string, message: string, data?: Record<string, unknown>): void }
}

export class InvalidPhaseTransitionError extends Error {
  constructor(
    public readonly tabId: string,
    public readonly from: WorkbenchPhase,
    public readonly transition: PhaseTransition,
  ) {
    super(`Invalid phase transition: ${from} --${transition}--> ? (tabId=${tabId})`)
    this.name = 'InvalidPhaseTransitionError'
  }
}

export function createWorkbenchPhaseService(deps: WorkbenchPhaseServiceDeps): WorkbenchPhaseService {
  const { workbenchStore, logger } = deps

  function getTab(tabId: string) {
    return workbenchStore.getState().tabs.find(t => t.id === tabId) ?? null
  }

  function transition(tabId: string, transition: PhaseTransition): void {
    const tab = getTab(tabId)
    if (!tab) {
      throw new Error(`workbenchPhaseService.transition: tab not found (id=${tabId})`)
    }

    if (!VALID_PHASES.has(tab.phase)) {
      throw new Error(`workbenchPhaseService.transition: unknown phase "${tab.phase}" on tab ${tabId}`)
    }

    const allowed = VALID_PHASE_TRANSITIONS[tab.phase]
    if (!allowed.includes(transition)) {
      logger?.info('phase.transition.rejected', 'Phase transition rejected', {
        tabId,
        from: tab.phase,
        transition,
        allowed,
      })
      throw new InvalidPhaseTransitionError(tabId, tab.phase, transition)
    }

    const key = `${tab.phase}:${transition}` as const

    // snapshot does not change current tab phase — it creates a new tab
    if (transition === 'snapshot') {
      logger?.info('phase.snapshot', 'Snapshot transition (phase unchanged)', {
        tabId,
        from: tab.phase,
      })
      return
    }

    const newPhase = PHASE_TRANSITION_RESULT[key]
    if (!newPhase) {
      throw new Error(`workbenchPhaseService.transition: no result phase for ${key}`)
    }

    logger?.info('phase.transition', 'Phase transition', {
      tabId,
      from: tab.phase,
      to: newPhase,
      transition,
    })

    workbenchStore.updateTab(tabId, { phase: newPhase })
  }

  function getPhase(tabId: string): WorkbenchPhase | null {
    const tab = getTab(tabId)
    return tab?.phase ?? null
  }

  function getValidTransitions(tabId: string): PhaseTransition[] {
    const tab = getTab(tabId)
    if (!tab) return []
    if (!VALID_PHASES.has(tab.phase)) return []
    return VALID_PHASE_TRANSITIONS[tab.phase]
  }

  return {
    transition,
    getPhase,
    getValidTransitions,
  }
}
