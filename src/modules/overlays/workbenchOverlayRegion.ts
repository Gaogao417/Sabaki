import type {
  WorkbenchMode,
  WorkbenchTab,
} from '../training/types/index'

export type WorkbenchOverlayTransitionReason =
  | 'manual'
  | 'snapshot'
  | 'edit-position'
  | 'recall-complete'
  | 'return'
  | 'restart-attempt'

export type WorkbenchOverlayTransitionInput = {
  tabId: string
  fromMode: WorkbenchMode
  toMode: WorkbenchMode
  beforeTab: WorkbenchTab
  afterTab: WorkbenchTab
  reason?: WorkbenchOverlayTransitionReason
}

export type WorkbenchOverlayRegion = {
  onWorkbenchModeTransition(input: WorkbenchOverlayTransitionInput): void
}

export type WorkbenchOverlayRegionDeps = {
  overlayStore: {
    onModeChange(mode: string): void
  }
  logger?: {
    info(channel: string, message: string, data?: Record<string, unknown>): void
  }
}

export function createWorkbenchOverlayRegion(
  deps: WorkbenchOverlayRegionDeps,
): WorkbenchOverlayRegion {
  return {
    onWorkbenchModeTransition(input) {
      deps.overlayStore.onModeChange(input.toMode)
      deps.logger?.info(
        'overlay.region.modeTransition',
        'Workbench overlay region handled mode transition',
        {
          tabId: input.tabId,
          fromMode: input.fromMode,
          toMode: input.toMode,
          reason: input.reason ?? null,
        },
      )
    },
  }
}
