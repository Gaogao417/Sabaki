export type WorkbenchMode = 'play' | 'problem' | 'recall' | 'analysis'

/** @deprecated Use WorkbenchMode instead */
export type WorkbenchPhase = 'play' | 'recall' | 'analysis'

export type PlayerConfig = {
  black: 'human' | 'ai'
  white: 'human' | 'ai'
  ai?: {
    engineId?: string
    timeLimitMs?: number
    maxVisits?: number
    autoPlay?: boolean
  }
}

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

  playerConfig?: PlayerConfig
  previousMode?: WorkbenchMode

  createdAt: string
  updatedAt: string
}
