import type { Problem, ReferenceLine, PassRule } from '../types/index'
import type { TrainingRepository } from '../repository/trainingRepository'
import type { PositionSnapshotAdapter, PositionSnapshot } from '../adapter/positionSnapshotAdapter'
import type { WorkbenchStore } from '../store/workbenchStore'

export type ProblemSnapshotInput = {
  sourceTaskId: string
  sourceAttemptId?: string
  sourceGameId?: string
  sourceProblemId?: string
  sourceMoveIndex?: number

  positionSgf: string
  sideToMove: 'black' | 'white'

  currentLine?: string[]
  referenceLines?: ReferenceLine[]

  snapshotReason?: string
}

export type SnapshotService = {
  captureSnapshotInput(input: {
    tabId: string
    sourceTaskId: string
    sourceAttemptId?: string
  }): Promise<ProblemSnapshotInput>

  createProblemFromCurrentAnalysisPosition(input: ProblemSnapshotInput): Promise<Problem>
}

export type SnapshotServiceDeps = {
  repository: TrainingRepository
  positionSnapshotAdapter: PositionSnapshotAdapter
  workbenchStore: WorkbenchStore
  logger?: { info(channel: string, message: string, data?: Record<string, unknown>): void }
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function buildPassRuleFromSnapshot(input: ProblemSnapshotInput): PassRule {
  return {
    scoreDropThreshold: 2.0,
    severeDropThreshold: 5.0,
    requireNoSevereBadMove: false,
    compareWithReference: false,
  }
}

export function createSnapshotService(deps: SnapshotServiceDeps): SnapshotService {
  const { repository, positionSnapshotAdapter, workbenchStore, logger } = deps

  async function captureSnapshotInput(input: {
    tabId: string
    sourceTaskId: string
    sourceAttemptId?: string
  }): Promise<ProblemSnapshotInput> {
    const tab = workbenchStore.getState().tabs.find(t => t.id === input.tabId)
    if (!tab) {
      throw new Error(`snapshotService.captureSnapshotInput: tab not found (id=${input.tabId})`)
    }

    if (tab.phase !== 'analysis') {
      throw new Error(`snapshotService.captureSnapshotInput: tab must be in analysis phase (current=${tab.phase})`)
    }

    const task = await repository.loadTask(input.sourceTaskId)
    if (!task) {
      throw new Error(`snapshotService.captureSnapshotInput: task not found (id=${input.sourceTaskId})`)
    }

    const snapshot: PositionSnapshot = positionSnapshotAdapter.captureCurrentPosition()

    let sourceGameId: string | undefined
    let sourceProblemId: string | undefined

    if (task.source.kind === 'game') {
      sourceGameId = task.source.gameId
    } else if (task.source.kind === 'problem') {
      sourceProblemId = task.source.problemId
    } else if (task.source.kind === 'snapshot_problem') {
      sourceProblemId = task.source.problemId
    }

    logger?.info('snapshot.capture', 'Snapshot input captured', {
      tabId: input.tabId,
      sourceTaskId: input.sourceTaskId,
      positionHash: snapshot.positionHash,
      moveNumber: snapshot.moveNumber,
    })

    return {
      sourceTaskId: input.sourceTaskId,
      sourceAttemptId: input.sourceAttemptId,
      sourceGameId,
      sourceProblemId,
      sourceMoveIndex: snapshot.moveNumber,
      positionSgf: snapshot.positionSgf,
      sideToMove: snapshot.sideToMove,
    }
  }

  async function createProblemFromCurrentAnalysisPosition(input: ProblemSnapshotInput): Promise<Problem> {
    const now = new Date().toISOString()
    const problemId = `snap_${generateId()}`

    const problem: Problem = {
      id: problemId,
      type: 'best_move',
      positionSgf: input.positionSgf,
      sideToMove: input.sideToMove,
      title: undefined,
      positionDescription: '',
      taskGoal: '',
      referenceLines: input.referenceLines ?? [],
      passRule: buildPassRuleFromSnapshot(input),
      tags: ['snapshot'],
      difficulty: undefined,
      status: 'inbox',
      sourceTaskId: input.sourceTaskId,
      sourceAttemptId: input.sourceAttemptId,
      sourceGameId: input.sourceGameId,
      sourceProblemId: input.sourceProblemId,
      sourceMoveIndex: input.sourceMoveIndex,
      parentSnapshotReason: input.snapshotReason,
      createdAt: now,
      updatedAt: now,
    }

    const saved = await repository.createProblem(problem)

    logger?.info('snapshot.create', 'Problem created from snapshot', {
      problemId: saved.id,
      sourceTaskId: input.sourceTaskId,
      sourceAttemptId: input.sourceAttemptId,
      sourceMoveIndex: input.sourceMoveIndex,
    })

    return saved
  }

  return {
    captureSnapshotInput,
    createProblemFromCurrentAnalysisPosition,
  }
}
