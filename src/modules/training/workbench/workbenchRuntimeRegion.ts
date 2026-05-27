import type {RecallSession} from '../types/index'
import type {TrainingRuntimeStore} from '../store/trainingRuntimeStore'
import {mapRecallSessionToRecallView} from '../recall/recallService'

export type WorkbenchRuntimeRegion = {
  onRecallActivated(input: {session: RecallSession}): void
  onRecallCompleted(input?: {sessionId?: string}): void
  onCheckpointResumed(input?: {checkpointId?: string}): void
}

export type WorkbenchRuntimeRegionDeps = {
  runtimeStore: TrainingRuntimeStore
}

export function createWorkbenchRuntimeRegion(
  deps: WorkbenchRuntimeRegionDeps,
): WorkbenchRuntimeRegion {
  const {runtimeStore} = deps

  return {
    onRecallActivated(input) {
      runtimeStore.setProblemView(null)
      runtimeStore.setActiveRecallSession(input.session.id)
      runtimeStore.setRecallView(mapRecallSessionToRecallView(input.session, []))
      runtimeStore.setActiveCheckpoint(undefined)
    },

    onRecallCompleted() {
      runtimeStore.setActiveRecallSession(undefined)
      runtimeStore.setRecallView(null)
    },

    onCheckpointResumed() {
      runtimeStore.setActiveCheckpoint(undefined)
    },
  }
}
