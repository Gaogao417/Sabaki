export type WorkbenchMode = 'play' | 'problem' | 'recall' | 'analysis'

/** @deprecated Use WorkbenchMode instead */
export type WorkbenchPhase = 'play' | 'recall' | 'analysis'

export type WorkbenchTab = {
  id: string
  taskId: string

  mode: WorkbenchMode

  activeAttemptId?: string
  activeRecallSessionId?: string
  activeAnalysisSessionId?: string

  currentTreePosition?: string

  parentTabId?: string
  childTabIds: string[]

  createdAt: string
  updatedAt: string
}
