import type {
  ModeEnterEffectInput,
  ModeExitEffectInput,
  WorkbenchModeEffects,
} from '../training/workbench/workbenchFlowService.ts'
import type {
  EngineAnalysis,
  WorkbenchAnalysisScratchResultInput,
  WorkbenchAnalysisScratchTarget,
} from './analysisTypes.ts'

export type {
  WorkbenchAnalysisScratchResultInput,
  WorkbenchAnalysisScratchTarget,
} from './analysisTypes.ts'

export type WorkbenchAnalysisScratchAdapter = {
  createOrStampWorkspace(input: {
    target: WorkbenchAnalysisScratchTarget
    transition: ModeEnterEffectInput
  }): void
  scheduleScratchAnalysis(input: {target: WorkbenchAnalysisScratchTarget}): void
  clearWorkspace(input: {
    target: WorkbenchAnalysisScratchTarget
    transition: ModeExitEffectInput
  }): void
  writeAnalysisResult?(input: {
    target: WorkbenchAnalysisScratchTarget
    analysis: EngineAnalysis | null
    final?: boolean
  }): void
}

export type WorkbenchAnalysisScratchRegion = WorkbenchModeEffects & {
  getActiveTarget(tabId: string): WorkbenchAnalysisScratchTarget | null
  applyScratchAnalysisResult(
    input: WorkbenchAnalysisScratchResultInput,
  ): boolean
}

export function createWorkbenchAnalysisScratchRegion(input: {
  adapter: WorkbenchAnalysisScratchAdapter
}): WorkbenchAnalysisScratchRegion {
  const activeTargets = new Map<string, WorkbenchAnalysisScratchTarget>()
  const generations = new Map<string, number>()

  function nextGeneration(tabId: string): number {
    const generation = (generations.get(tabId) ?? 0) + 1
    generations.set(tabId, generation)
    return generation
  }

  function createTarget(
    transition: ModeEnterEffectInput,
  ): WorkbenchAnalysisScratchTarget {
    const generation = nextGeneration(transition.tabId)

    return {
      kind: 'scratch',
      tabId: transition.tabId,
      workspaceId: `${transition.tabId}:analysis-scratch:${generation}`,
      generation,
      targetTab: 'current',
      status: 'active',
      sourceMode: transition.fromMode,
      reason: transition.reason,
    }
  }

  function isSameActiveTarget(
    actual: WorkbenchAnalysisScratchTarget | null,
    expected: WorkbenchAnalysisScratchTarget,
  ): actual is WorkbenchAnalysisScratchTarget {
    return (
      actual != null &&
      actual.status === 'active' &&
      expected.status === 'active' &&
      actual.tabId === expected.tabId &&
      actual.workspaceId === expected.workspaceId &&
      actual.generation === expected.generation &&
      actual.targetTab === expected.targetTab
    )
  }

  return {
    enterAnalysis(transition) {
      const target = createTarget(transition)
      activeTargets.set(transition.tabId, target)
      input.adapter.createOrStampWorkspace({target, transition})
      input.adapter.scheduleScratchAnalysis({target})
    },

    exitAnalysis(transition) {
      const target = activeTargets.get(transition.tabId)
      if (target == null) return

      input.adapter.clearWorkspace({target, transition})
      activeTargets.set(transition.tabId, {...target, status: 'inactive'})
    },

    getActiveTarget(tabId) {
      return activeTargets.get(tabId) ?? null
    },

    applyScratchAnalysisResult(result) {
      const target = activeTargets.get(result.target.tabId) ?? null
      if (!isSameActiveTarget(target, result.target)) return false

      input.adapter.writeAnalysisResult?.({
        target,
        analysis: result.analysis,
        final: result.final,
      })
      return true
    },
  }
}
