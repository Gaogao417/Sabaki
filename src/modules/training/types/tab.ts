export type WorkbenchPhase = 'play' | 'recall' | 'analysis'

export type TrainingTaskKind = 'game' | 'problem' | 'snapshot_problem' | 'recall_segment'

export type WorkbenchTab = {
  id: string
  taskId: string

  phase: WorkbenchPhase

  sourceKind?: TrainingTaskKind

  activeAttemptId?: string
  activeRecallSessionId?: string
  activeAnalysisSessionId?: string

  currentTreePosition?: string

  parentTabId?: string
  childTabIds: string[]

  createdAt: string
  updatedAt: string
}
