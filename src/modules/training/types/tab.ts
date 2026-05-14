export type WorkbenchPhase = 'play' | 'recall' | 'analysis'

export type WorkbenchTab = {
  id: string
  taskId: string

  phase: WorkbenchPhase

  activeAttemptId?: string
  activeRecallSessionId?: string
  activeAnalysisSessionId?: string

  currentTreePosition?: string

  parentTabId?: string
  childTabIds: string[]

  createdAt: string
  updatedAt: string
}
