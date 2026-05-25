export type WorkbenchMode = 'play' | 'problem' | 'recall' | 'analysis'

/** @deprecated Use WorkbenchMode instead */
export type WorkbenchPhase = 'play' | 'recall' | 'analysis'

export type RecallSubstate =
  | 'normal'
  | 'checkpoint_correction'
  | 'checkpoint_ai_revealed'
  | 'checkpoint_commenting'

export type AnalysisReturnTarget = {
  mode: 'play' | 'problem' | 'recall'
  recallSubstate?: RecallSubstate
  treePosition?: string
  moveIndex?: number
}

export type PlayerConfig = {
  black: 'human' | 'ai'
  white: 'human' | 'ai'
  problemOpponent?: 'self' | 'ai'
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

  recallSubstate?: RecallSubstate
  analysisReturnTarget?: AnalysisReturnTarget

  activeAttemptId?: string
  activeRecallSessionId?: string
  activeAnalysisSessionId?: string

  currentTreePosition?: string

  parentTabId?: string
  childTabIds: string[]

  playerConfig?: PlayerConfig
  previousMode?: WorkbenchMode

  analysisContext?: {
    taskId: string
    source: string
    attemptId?: string
    checkpointId?: string
    positionHash?: string
    positionSgf?: string
  }

  createdAt: string
  updatedAt: string
}
