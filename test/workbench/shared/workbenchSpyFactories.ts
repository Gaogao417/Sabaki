import type { SnapshotService, ProblemSnapshotInput } from '../../../src/modules/training/analysis/snapshotService'
import type { WorkbenchFlowService } from '../../../src/modules/training/workbench/workbenchFlowService'
import type {
  OpenProblemTabOptions,
  OpenTaskOptions,
  WorkbenchTabService,
} from '../../../src/modules/training/workbench/workbenchTabService'
import type { ReviewService, ReviewServiceDeps } from '../../../src/modules/training/review/reviewService'
import type { RecallCheckpointService } from '../../../src/modules/training/recall/recallCheckpointService'
import type { TaskImportService } from '../../../src/modules/training/import/taskImportService'
import type { PlayerConfig, Problem, WorkbenchMode, WorkbenchTab } from '../../../src/modules/training/types/index'

type Call<T = Record<string, unknown>> = T

export type SpyFlowServiceCalls = {
  submit: Array<Call<{tabId: string}>>
  enterAnalysis: Array<Call<{tabId: string}>>
  returnFromAnalysis: Array<Call<{tabId: string; toMode: WorkbenchMode}>>
  completeRecall: Array<Call<{tabId: string}>>
  restartAttempt: Array<Call<{tabId: string}>>
  startAttempt: Array<Call<{tabId: string}>>
  snapshotFromCurrentContext: Array<Call<{tabId: string}>>
  updatePlayerConfig: Array<Call<{tabId: string; patch: Partial<PlayerConfig>}>>
}

export type SpyWorkbenchFlowService = WorkbenchFlowService & {
  calls: SpyFlowServiceCalls
}

export type SpyTabServiceCalls = {
  openGameTab: Array<Call<{gameId: string}>>
  openProblemTab: Array<Call<{problemId: string; options?: OpenProblemTabOptions}>>
  openTask: OpenTaskOptions[]
  openSnapshotProblemTab: Array<Call<{problemId: string; options: {parentTabId: string}}>>
  closeTab: Array<Call<{tabId: string}>>
  switchTab: Array<Call<{tabId: string}>>
}

export type SpyWorkbenchTabService = WorkbenchTabService & {
  calls: SpyTabServiceCalls
}

export type SpySnapshotServiceCalls = {
  captureSnapshotInput: Array<Parameters<SnapshotService['captureSnapshotInput']>[0]>
  createProblemFromCurrentAnalysisPosition: ProblemSnapshotInput[]
}

export type SpySnapshotService = SnapshotService & {
  calls: SpySnapshotServiceCalls
}

function now(): string {
  return new Date().toISOString()
}

function makeTab(overrides: Partial<WorkbenchTab> & Pick<WorkbenchTab, 'id' | 'taskId'>): WorkbenchTab {
  return {
    mode: 'problem',
    childTabIds: [],
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  }
}

export function createSpyFlowService(
  overrides: Partial<WorkbenchFlowService> = {},
): SpyWorkbenchFlowService {
  const calls: SpyFlowServiceCalls = {
    submit: [],
    enterAnalysis: [],
    returnFromAnalysis: [],
    completeRecall: [],
    restartAttempt: [],
    startAttempt: [],
    snapshotFromCurrentContext: [],
    updatePlayerConfig: [],
  }

  const service = {
    calls,
    async submit(tabId: string) {
      calls.submit.push({tabId})
    },
    enterAnalysis(tabId: string) {
      calls.enterAnalysis.push({tabId})
    },
    returnFromAnalysis(tabId: string, toMode: WorkbenchMode) {
      calls.returnFromAnalysis.push({tabId, toMode})
    },
    completeRecall(tabId: string) {
      calls.completeRecall.push({tabId})
    },
    restartAttempt(tabId: string) {
      calls.restartAttempt.push({tabId})
    },
    async startAttempt(tabId: string) {
      calls.startAttempt.push({tabId})
    },
    async snapshotFromCurrentContext(tabId: string) {
      calls.snapshotFromCurrentContext.push({tabId})
      return makeTab({
        id: 'tab_snapshot_new',
        taskId: 'task_snapshot_new',
        mode: 'problem',
      })
    },
    updatePlayerConfig(tabId: string, patch: Partial<PlayerConfig>) {
      calls.updatePlayerConfig.push({tabId, patch})
    },
    ...overrides,
  } satisfies SpyWorkbenchFlowService

  return service
}

export function createSpyTabService(): SpyWorkbenchTabService {
  const calls: SpyTabServiceCalls = {
    openGameTab: [],
    openProblemTab: [],
    openTask: [],
    openSnapshotProblemTab: [],
    closeTab: [],
    switchTab: [],
  }
  let tabCounter = 0

  const service = {
    calls,
    async openGameTab(gameId: string) {
      calls.openGameTab.push({gameId})
      return makeTab({
        id: `tab_game_${++tabCounter}`,
        taskId: gameId,
        mode: 'play',
      })
    },
    async openProblemTab(problemId: string, options?: OpenProblemTabOptions) {
      calls.openProblemTab.push({problemId, options})
      return makeTab({
        id: `tab_problem_${++tabCounter}`,
        taskId: problemId,
        mode: 'problem',
        parentTabId: options?.parentTabId,
      })
    },
    async openTask(opts: OpenTaskOptions) {
      calls.openTask.push(opts)
      return makeTab({
        id: `tab_new_${++tabCounter}`,
        taskId: opts.taskId,
        mode: opts.mode ?? 'problem',
        parentTabId: opts.parentTabId,
        playerConfig: opts.playerConfig,
      })
    },
    async openSnapshotProblemTab(problemId: string, options: {parentTabId: string}) {
      calls.openSnapshotProblemTab.push({problemId, options})
      return makeTab({
        id: `tab_snapshot_${++tabCounter}`,
        taskId: problemId,
        mode: 'problem',
        parentTabId: options.parentTabId,
      })
    },
    async closeTab(tabId: string) {
      calls.closeTab.push({tabId})
    },
    switchTab(tabId: string) {
      calls.switchTab.push({tabId})
    },
  } satisfies SpyWorkbenchTabService

  return service
}

// --- SpyReviewService ---

export type SpyReviewServiceCalls = {
  getDueItems: Array<{now?: string}>
  openDueItem: Array<{scheduleId: string}>
  updateScheduleAfterResult: Array<{taskId: string; result: string}>
  addToReviewQueue: Array<{taskId: string}>
  startSession: Array<{runtimeStoreOverride?: ReviewServiceDeps['runtimeStore']}>
  advanceReview: Array<{runtimeStoreOverride?: ReviewServiceDeps['runtimeStore']}>
}

export type SpyReviewService = ReviewService & {
  calls: SpyReviewServiceCalls
}

export function createSpyReviewService(
  overrides: Partial<ReviewService> = {},
): SpyReviewService {
  const calls: SpyReviewServiceCalls = {
    getDueItems: [],
    openDueItem: [],
    updateScheduleAfterResult: [],
    addToReviewQueue: [],
    startSession: [],
    advanceReview: [],
  }

  const service = {
    calls,
    async getDueItems(now?: string) {
      calls.getDueItems.push({now})
      return []
    },
    async openDueItem(scheduleId: string) {
      calls.openDueItem.push({scheduleId})
      return {id: 'tab_new', taskId: 'task_a', mode: 'play'}
    },
    async updateScheduleAfterResult(input: {taskId: string; result: string}) {
      calls.updateScheduleAfterResult.push(input)
    },
    async addToReviewQueue(input: {taskId: string}) {
      calls.addToReviewQueue.push(input)
      return {
        id: 'sched_new',
        taskId: input.taskId,
        dueAt: new Date().toISOString(),
        intervalDays: 1,
        consecutivePassCount: 0,
        totalFailCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    },
    async startSession(runtimeStoreOverride?: ReviewServiceDeps['runtimeStore']) {
      calls.startSession.push({runtimeStoreOverride})
    },
    async advanceReview(runtimeStoreOverride?: ReviewServiceDeps['runtimeStore']) {
      calls.advanceReview.push({runtimeStoreOverride})
    },
    ...overrides,
  } satisfies SpyReviewService

  return service
}

// --- SpyRecallCheckpointService ---

export type SpyRecallCheckpointServiceCalls = {
  shouldTriggerCheckpoint: Array<{recallSessionId: string; moveIndex: number}>
  startCheckpoint: Array<{recallSessionId: string; badMoveId: string}>
  submitUserCorrectionLine: Array<{checkpointId: string; moves: string[]}>
  revealAiCandidateLines: Array<string>
  saveComment: Array<{checkpointId: string; comment: unknown}>
  skipCheckpoint: Array<string>
  resumeRecall: Array<string>
}

export type SpyRecallCheckpointService = RecallCheckpointService & {
  calls: SpyRecallCheckpointServiceCalls
}

export function createSpyRecallCheckpointService(
  overrides: Partial<RecallCheckpointService> = {},
): SpyRecallCheckpointService {
  const calls: SpyRecallCheckpointServiceCalls = {
    shouldTriggerCheckpoint: [],
    startCheckpoint: [],
    submitUserCorrectionLine: [],
    revealAiCandidateLines: [],
    saveComment: [],
    skipCheckpoint: [],
    resumeRecall: [],
  }

  const service = {
    calls,
    async shouldTriggerCheckpoint(input: {recallSessionId: string; moveIndex: number}) {
      calls.shouldTriggerCheckpoint.push(input)
      return null
    },
    async startCheckpoint(input: {recallSessionId: string; badMoveId: string}) {
      calls.startCheckpoint.push(input)
      return {
        id: `cp_${Date.now()}`,
        recallSessionId: input.recallSessionId,
        badMoveId: input.badMoveId,
        status: 'pending_correction',
        userCorrectionLine: [],
        aiCandidateLines: [],
        createdAt: new Date().toISOString(),
      }
    },
    async submitUserCorrectionLine(input: {checkpointId: string; moves: string[]}) {
      calls.submitUserCorrectionLine.push(input)
    },
    async revealAiCandidateLines(checkpointId: string) {
      calls.revealAiCandidateLines.push(checkpointId)
      return []
    },
    async saveComment(input: {checkpointId: string; comment: unknown}) {
      calls.saveComment.push(input)
    },
    async skipCheckpoint(checkpointId: string) {
      calls.skipCheckpoint.push(checkpointId)
    },
    async resumeRecall(checkpointId: string) {
      calls.resumeRecall.push(checkpointId)
    },
    ...overrides,
  } satisfies SpyRecallCheckpointService

  return service
}

// --- SpyTaskImportService ---

export type SpyTaskImportServiceCalls = {
  importFoxGame: Array<{gameId: string}>
  importLocalSgf: Array<{filePath: string; title?: string}>
  import101Problem: Array<{problemId: string}>
  createManualTask: Array<Record<string, unknown>>
  createTaskFromSnapshot: Array<Record<string, unknown>>
  createTaskFromBadMove: Array<{badMoveId: string}>
}

export type SpyTaskImportService = TaskImportService & {
  calls: SpyTaskImportServiceCalls
}

export function createSpyTaskImportService(
  overrides: Partial<TaskImportService> = {},
): SpyTaskImportService {
  const calls: SpyTaskImportServiceCalls = {
    importFoxGame: [],
    importLocalSgf: [],
    import101Problem: [],
    createManualTask: [],
    createTaskFromSnapshot: [],
    createTaskFromBadMove: [],
  }

  const service = {
    calls,
    async importFoxGame(input: {gameId: string}) {
      calls.importFoxGame.push(input)
      return {id: `task_fox_${Date.now()}`}
    },
    async importLocalSgf(input: {filePath: string; title?: string}) {
      calls.importLocalSgf.push(input)
      return {id: `task_local_${Date.now()}`}
    },
    async import101Problem(input: {problemId: string}) {
      calls.import101Problem.push(input)
      return {id: `task_101_${Date.now()}`}
    },
    async createManualTask(input: Record<string, unknown>) {
      calls.createManualTask.push(input)
      return {id: `task_manual_${Date.now()}`, ...input}
    },
    async createTaskFromSnapshot(input: Record<string, unknown>) {
      calls.createTaskFromSnapshot.push(input)
      return {id: `task_snapshot_${Date.now()}`}
    },
    async createTaskFromBadMove(input: {badMoveId: string}) {
      calls.createTaskFromBadMove.push(input)
      return {id: `task_badmove_${Date.now()}`}
    },
    ...overrides,
  } satisfies SpyTaskImportService

  return service
}

// --- Noop legacy controller (shared stub) ---

export function createNoopLegacyController() {
  return {
    showRecallHint() {},
    skipRecallMove() {},
    endRecallSession() {},
    undoProblemMove() {},
    submitProblemAttempt() {},
    exitProblemMode() {},
    advanceReview() {},
  }
}

// --- createSpySnapshotService ---

export function createSpySnapshotService(
  snapshot: Partial<ProblemSnapshotInput> = {},
): SpySnapshotService {
  const calls: SpySnapshotServiceCalls = {
    captureSnapshotInput: [],
    createProblemFromCurrentAnalysisPosition: [],
  }

  const service = {
    calls,
    async captureSnapshotInput(input: Parameters<SnapshotService['captureSnapshotInput']>[0]) {
      calls.captureSnapshotInput.push(input)
      return {
        sourceTaskId: input.sourceTaskId,
        sourceAttemptId: input.sourceAttemptId,
        positionSgf: '(;SZ[19])',
        sideToMove: 'black',
        ...snapshot,
      }
    },
    async createProblemFromCurrentAnalysisPosition(input: ProblemSnapshotInput) {
      calls.createProblemFromCurrentAnalysisPosition.push(input)
      const timestamp = now()
      return {
        id: `problem_${timestamp}`,
        type: 'review_memory',
        positionSgf: input.positionSgf,
        sideToMove: input.sideToMove,
        positionDescription: '',
        taskGoal: '',
        referenceLines: input.referenceLines ?? [],
        passRule: {
          requireNoSevereBadMove: false,
          compareWithReference: false,
        },
        tags: [],
        status: 'active',
        sourceTaskId: input.sourceTaskId,
        sourceAttemptId: input.sourceAttemptId,
        sourceMoveIndex: input.sourceMoveIndex,
        createdAt: timestamp,
        updatedAt: timestamp,
      } satisfies Problem
    },
  } satisfies SpySnapshotService

  return service
}
