import type { SnapshotService, ProblemSnapshotInput } from '../../../src/modules/training/analysis/snapshotService'
import type { WorkbenchFlowService } from '../../../src/modules/training/workbench/workbenchFlowService'
import type {
  OpenProblemTabOptions,
  OpenTaskOptions,
  WorkbenchTabService,
} from '../../../src/modules/training/workbench/workbenchTabService'
import type { ReviewService, ReviewServiceDeps } from '../../../src/modules/training/review/reviewService'
import type { RecallService } from '../../../src/modules/training/recall/recallService'
import type { RecallCheckpointService } from '../../../src/modules/training/recall/recallCheckpointService'
import type { TaskImportService } from '../../../src/modules/training/import/taskImportService'
import type {
  PlayerConfig,
  Problem,
  RecallAttempt,
  RecallSession,
  WorkbenchMode,
  WorkbenchTab,
} from '../../../src/modules/training/types/index'
import type { BoardInteractionControllerDeps } from '../../../src/modules/training/workbench/boardInteractionController'

type Call<T = Record<string, unknown>> = T

export type SpyFlowServiceCalls = {
  submit: Array<Call<{tabId: string}>>
  enterAnalysis: Array<Call<{tabId: string}>>
  returnFromAnalysis: Array<Call<{tabId: string}>>
  completeRecall: Array<Call<{tabId: string}>>
  restartAttempt: Array<Call<{tabId: string}>>
  startAttempt: Array<Call<{tabId: string}>>
  snapshotFromCurrentContext: Array<Call<{tabId: string}>>
  updatePlayerConfig: Array<Call<{tabId: string; patch: Partial<PlayerConfig>}>>
  loadDashboardData: Array<Call<{}>>
}

export type SpyWorkbenchFlowService = WorkbenchFlowService & {
  calls: SpyFlowServiceCalls
}

export type SpyTabServiceCalls = {
  openGameTab: Array<Call<{gameId: string}>>
  openProblemTab: Array<Call<{problemId: string; options?: OpenProblemTabOptions}>>
  openTask: OpenTaskOptions[]
  openSnapshotProblemTab: Array<Call<{problemId: string; options: {parentTabId: string}}>>
  openAttemptTab: Array<Call<{attemptId: string}>>
  openRecallSessionTab: Array<Call<{sessionId: string}>>
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
    loadDashboardData: [],
  }

  const service = {
    calls,
    async submit(tabId: string) {
      calls.submit.push({tabId})
    },
    enterAnalysis(tabId: string) {
      calls.enterAnalysis.push({tabId})
    },
    returnFromAnalysis(input: {tabId: string}) {
      calls.returnFromAnalysis.push({tabId: input.tabId})
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
    async loadDashboardData() {
      calls.loadDashboardData.push({})
      return {
        inboxTasks: [],
        incompleteAttempts: [],
        incompleteRecallSessions: [],
        recentBadMoveTasks: [],
      }
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
    openAttemptTab: [],
    openRecallSessionTab: [],
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
    async openAttemptTab(attemptId: string) {
      calls.openAttemptTab.push({attemptId})
      return makeTab({
        id: `tab_attempt_${++tabCounter}`,
        taskId: 'task_from_attempt',
        mode: 'play',
      })
    },
    async openRecallSessionTab(sessionId: string) {
      calls.openRecallSessionTab.push({sessionId})
      return makeTab({
        id: `tab_recall_${++tabCounter}`,
        taskId: 'task_from_session',
        mode: 'recall',
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
      return [{
        id: 'sched_spy_default',
        taskId: 'task_spy_due',
        dueAt: new Date().toISOString(),
        intervalDays: 1,
        consecutivePassCount: 0,
        totalFailCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }]
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

// --- SpyRecallService ---

export type SpyRecallServiceCalls = {
  createRecallFromAttempt: Array<{attemptId: string}>
  createRecallFromGame: Array<{taskId: string; gameId: string; startMove?: number; endMove?: number}>
  submitRecallMove: Array<{recallSessionId: string; userMove: string}>
  completeRecall: Array<{recallSessionId: string}>
}

export type SpyRecallService = RecallService & {
  calls: SpyRecallServiceCalls
}

export function createSpyRecallService(
  overrides: Partial<RecallService> = {},
): SpyRecallService {
  const calls: SpyRecallServiceCalls = {
    createRecallFromAttempt: [],
    createRecallFromGame: [],
    submitRecallMove: [],
    completeRecall: [],
  }

  const service = {
    calls,
    async createRecallFromAttempt(attemptId: string): Promise<RecallSession> {
      calls.createRecallFromAttempt.push({attemptId})
      return {
        id: `rs_${Date.now()}`,
        taskId: 'task_spy',
        type: 'line_recall',
        source: {kind: 'attempt', attemptId},
        expectedMoves: [],
        currentMoveIndex: 0,
        completed: false,
        createdAt: now(),
      }
    },
    async createRecallFromGame(input: {
      taskId: string
      gameId: string
      startMove?: number
      endMove?: number
    }): Promise<RecallSession> {
      calls.createRecallFromGame.push(input)
      return {
        id: `rs_game_${Date.now()}`,
        taskId: input.taskId,
        type: 'line_recall',
        source: {kind: 'game', gameId: input.gameId, startMove: input.startMove, endMove: input.endMove},
        expectedMoves: [],
        currentMoveIndex: 0,
        completed: false,
        createdAt: now(),
      }
    },
    async submitRecallMove(input: {
      recallSessionId: string
      userMove: string
    }): Promise<RecallAttempt> {
      calls.submitRecallMove.push(input)
      return {
        id: `ra_${Date.now()}`,
        recallSessionId: input.recallSessionId,
        moveNumber: calls.submitRecallMove.length - 1,
        expectedMove: input.userMove,
        userMove: input.userMove,
        isCorrect: true,
        hintLevelUsed: 0,
        createdAt: now(),
      }
    },
    async completeRecall(recallSessionId: string): Promise<void> {
      calls.completeRecall.push({recallSessionId})
    },
    ...overrides,
  } satisfies SpyRecallService

  return service
}

// --- SpyRecallAdapter (wraps recall for board interaction controller) ---

export type RecallAdapterResult = {
  handled: boolean
  changed: boolean
  isCorrect?: boolean
  completed?: boolean
  recallMoveIndex?: number
  attempt?: unknown
  reason?: string
}

export type SpyRecallAdapterCalls = {
  submitBoardClick: Array<{vertex: [number, number]}>
}

export type SpyRecallAdapter = {
  submitBoardClick(vertex: [number, number]): Promise<RecallAdapterResult>
  calls: SpyRecallAdapterCalls
}

export function createSpyRecallAdapter(
  defaultResult: Partial<RecallAdapterResult> = {},
): SpyRecallAdapter {
  const calls: SpyRecallAdapterCalls = {
    submitBoardClick: [],
  }

  return {
    calls,
    async submitBoardClick(vertex: [number, number]) {
      calls.submitBoardClick.push({vertex})
      return {
        handled: true,
        changed: true,
        isCorrect: true,
        ...defaultResult,
      }
    },
  }
}

// --- SpyDocumentStore ---

export type SpyDocumentStoreCalls = {
  playMove: Array<{vertex: [number, number]; opts?: unknown}>
}

export type SpyDocumentStore = {
  playMove(vertex: [number, number], opts?: unknown): Promise<{valid: boolean; changed: boolean; treePosition?: string}>
  calls: SpyDocumentStoreCalls
}

export function createSpyDocumentStore(
  defaultResult: {valid: boolean; changed: boolean; treePosition?: string} = {valid: true, changed: true, treePosition: 'node_2'},
): SpyDocumentStore {
  const calls: SpyDocumentStoreCalls = {
    playMove: [],
  }

  return {
    calls,
    async playMove(vertex: [number, number], opts?: unknown) {
      calls.playMove.push({vertex, opts})
      return defaultResult
    },
  }
}

// --- Shared controller deps factories ---

export type SpyControllerDeps = BoardInteractionControllerDeps & {
  _calls: {
    documentStorePlayMove: Array<{vertex: [number, number]; opts?: unknown}>
    recallSubmitBoardClick: Array<{vertex: [number, number]}>
    legacyClickVertex: Array<{vertex: [number, number]; opts?: unknown}>
    editAnalysisInvalidate: Array<Record<string, unknown>>
    editAnalysisSchedule: Array<Record<string, unknown>>
  }
  _documentStore: ReturnType<typeof createSpyDocumentStore>
  _recallAdapter: SpyRecallAdapter
  _legacySabaki: {clickVertex(vertex: [number, number], opts?: unknown): void}
}

export function createControllerDeps(options: {
  playMoveResult?: {valid: boolean; changed: boolean; treePosition?: string}
  recallAdapterResult?: Partial<RecallAdapterResult>
  editWorkspaceContext?: unknown
} = {}): SpyControllerDeps {
  const {
    playMoveResult = {valid: true, changed: true, treePosition: 'node_2'},
    recallAdapterResult = {handled: true, changed: true, isCorrect: true},
    editWorkspaceContext = null,
  } = options

  const calls: SpyControllerDeps['_calls'] = {
    documentStorePlayMove: [],
    recallSubmitBoardClick: [],
    legacyClickVertex: [],
    editAnalysisInvalidate: [],
    editAnalysisSchedule: [],
  }

  const documentStore: SpyDocumentStore = {
    calls: {playMove: []},
    async playMove(vertex, opts) {
      calls.documentStorePlayMove.push({vertex, opts})
      return playMoveResult
    },
  }

  const recallAdapter: SpyRecallAdapter = {
    calls: {submitBoardClick: []},
    async submitBoardClick(vertex) {
      calls.recallSubmitBoardClick.push({vertex})
      return {handled: true, changed: true, isCorrect: true, ...recallAdapterResult}
    },
  }

  const editWorkspaceDeps = {
    invalidateEditAnalysis: () => { calls.editAnalysisInvalidate.push({}) },
    scheduleEditWorkspaceAnalysis: () => { calls.editAnalysisSchedule.push({}) },
  }

  const legacySabaki = {
    clickVertex: (vertex: [number, number], opts?: unknown) => {
      calls.legacyClickVertex.push({vertex, opts})
    },
  }

  return {
    getPlayServices: () => ({
      documentStore,
      engineService: undefined,
      analysisService: undefined,
    }),
    getRecallAdapter: () => recallAdapter,
    getEditWorkspaceContext: () => editWorkspaceContext,
    getEditWorkspaceDeps: () => editWorkspaceDeps,
    getLegacySabaki: () => legacySabaki,
    getIsMac: () => false,
    _calls: calls,
    _documentStore: documentStore,
    _recallAdapter: recallAdapter,
    _legacySabaki: legacySabaki,
  }
}

export function createPlayControllerDeps(
  playMoveResult: {valid: boolean; changed: boolean; treePosition?: string} = {valid: true, changed: true},
) {
  const documentStore = createSpyDocumentStore(playMoveResult)
  const engineCalls: unknown[][] = []
  const analysisCalls: unknown[][] = []

  return {
    deps: {
      getPlayServices: () => ({
        documentStore,
        engineService: {
          generateReply: (...args: unknown[]) => engineCalls.push(args),
        },
        analysisService: {
          scheduleLiveAnalysis: (...args: unknown[]) => analysisCalls.push(args),
        },
      }),
      getRecallAdapter: () => createSpyRecallAdapter({handled: false, changed: false}),
      getEditWorkspaceContext: () => null,
      getEditWorkspaceDeps: () => ({}),
      getLegacySabaki: () => ({clickVertex: () => {}}),
      getIsMac: () => false,
    } satisfies BoardInteractionControllerDeps,
    documentStore,
    engineCalls,
    analysisCalls,
  }
}

export function createRecallControllerDeps(
  recallResult: Partial<RecallAdapterResult> = {handled: true, changed: true, isCorrect: true},
) {
  const recallAdapter = createSpyRecallAdapter(recallResult)
  const documentStore = createSpyDocumentStore({valid: true, changed: false})

  return {
    deps: {
      getPlayServices: () => ({documentStore}),
      getRecallAdapter: () => recallAdapter,
      getEditWorkspaceContext: () => null,
      getEditWorkspaceDeps: () => ({}),
      getLegacySabaki: () => ({clickVertex: () => {}}),
      getIsMac: () => false,
    } satisfies BoardInteractionControllerDeps,
    recallAdapter,
    documentStore,
  }
}

export function createScratchControllerDeps() {
  const invalidateCalls: Record<string, unknown>[] = []
  const scheduleCalls: Record<string, unknown>[] = []

  const editWorkspaceContext = {
    activeTab: 'current',
    currentSnapshot: {
      id: 'snap_1',
      role: 'current',
      signMap: Array(19).fill(null).map(() => Array(19).fill(0)),
      nextPlayer: 1,
      width: 19,
      height: 19,
    },
    referenceSnapshot: null,
    currentMarkerMap: Array(19).fill(null).map(() => Array(19).fill(null)),
    referenceMarkerMap: null,
    currentLines: [],
    referenceLines: null,
    lineFirstVertex: null,
  }

  const documentStore = createSpyDocumentStore({valid: true, changed: false})
  const recallAdapter = createSpyRecallAdapter({handled: false, changed: false})

  return {
    deps: {
      getPlayServices: () => ({documentStore}),
      getRecallAdapter: () => recallAdapter,
      getEditWorkspaceContext: () => editWorkspaceContext,
      getEditWorkspaceDeps: () => ({
        invalidateEditAnalysis: () => invalidateCalls.push({}),
        scheduleEditWorkspaceAnalysis: (tab: unknown) => scheduleCalls.push({tab}),
      }),
      getLegacySabaki: () => ({clickVertex: () => {}}),
      getIsMac: () => false,
    } satisfies BoardInteractionControllerDeps,
    documentStore,
    recallAdapter,
    editWorkspaceContext,
    invalidateCalls,
    scheduleCalls,
  }
}

// --- WorkbenchFlowService integration test harness ---

import type { TrainingRepository } from '../../../src/modules/training/repository/trainingRepository'
import { createWorkbenchFlowService } from '../../../src/modules/training/workbench/workbenchFlowService'
import type { WorkbenchStore, WorkbenchStoreState } from '../../../src/modules/training/store/workbenchStore'
import type { TrainingRuntimeStore } from '../../../src/modules/training/store/trainingRuntimeStore'
import type { TrainingTask } from '../../../src/modules/training/types/index'

export type InMemoryRepositoryData = {
  tasks: Map<string, TrainingTask>
  recallSessions: Map<string, Record<string, unknown>>
  recallAttempts: Record<string, unknown>[]
  checkpoints: Map<string, Record<string, unknown>>
}

function createInMemoryRepository(seed?: Partial<InMemoryRepositoryData>): TrainingRepository & {data: InMemoryRepository; calls: string[]} {
  const data: InMemoryRepositoryData = {
    tasks: new Map(seed?.tasks?.entries() ?? []),
    recallSessions: new Map(seed?.recallSessions?.entries() ?? []),
    recallAttempts: [...(seed?.recallAttempts ?? [])],
    checkpoints: new Map(seed?.checkpoints?.entries() ?? []),
  }
  const calls: string[] = []

  return {
    data,
    calls,
    async saveGame(game) { calls.push('saveGame'); return game },
    async getGame(id) { return null },
    async getRecentGames(limit?) { return [] },
    async saveRecallSession(session) { calls.push('saveRecallSession'); return session },
    async saveRecallAttempts(attempts) { calls.push('saveRecallAttempts') },
    async saveProblem(problem) { calls.push('saveProblem'); return problem },
    async getProblem(id) { return null },
    async getProblemsByStatus(status, limit?) { return [] },
    async saveProblemAttempt(attempt) { calls.push('saveProblemAttempt'); return attempt },
    async saveBadMove(badMove) { calls.push('saveBadMove'); return badMove },
    async updateBadMoveGeneratedProblem(badMoveId, problemId) { calls.push('updateBadMoveGeneratedProblem') },
    async getDueReviews() { return [] },
    async upsertReviewSchedule(item) { calls.push('upsertReviewSchedule') },
    async getDashboardSummary() { calls.push('getDashboardSummary'); return {} },
    async createTask(task) { calls.push('createTask'); data.tasks.set(task.id, task); return task },
    async loadTask(taskId) { return data.tasks.get(taskId) ?? null },
    async findTaskBySource(source) { return null },
    async updateTask(taskId, patch) { calls.push('updateTask'); const t = data.tasks.get(taskId); if (t) Object.assign(t, patch) },
    async createAttempt(attempt) { calls.push('createAttempt'); return attempt },
    async loadAttempt(attemptId) { return null },
    async listAttemptsByTask(taskId) { return [] },
    async updateAttempt(attemptId, patch) { calls.push('updateAttempt') },
    async createMoveEvaluation(evaluation) { calls.push('createMoveEvaluation'); return evaluation },
    async updateMoveEvaluation(evaluationId, patch) { calls.push('updateMoveEvaluation') },
    async listMoveEvaluationsByAttempt(attemptId) { return [] },
    async createBadMove(badMove) { calls.push('createBadMove'); return badMove },
    async loadBadMove(badMoveId) { return null },
    async listBadMovesByAttempt(attemptId) { return [] },
    async listBadMovesByTask(taskId) { return [] },
    async markBadMoveAsNotBad(badMoveId) { calls.push('markBadMoveAsNotBad') },
    async updateBadMove(badMoveId, patch) { calls.push('updateBadMove') },
    async createRecallSession(session) { calls.push('createRecallSession'); data.recallSessions.set(session.id as string, session as Record<string, unknown>); return session },
    async loadRecallSession(sessionId) { return (data.recallSessions.get(sessionId) ?? null) as any },
    async updateRecallSession(sessionId, patch) { calls.push('updateRecallSession'); const s = data.recallSessions.get(sessionId); if (s) Object.assign(s, patch) },
    async createRecallAttempt(attempt) { calls.push('createRecallAttempt'); data.recallAttempts.push(attempt as Record<string, unknown>); return attempt },
    async listRecallAttempts(sessionId) { return data.recallAttempts.filter(a => (a as any).recallSessionId === sessionId) as any[] },
    async createRecallCheckpoint(checkpoint) { calls.push('createRecallCheckpoint'); data.checkpoints.set(checkpoint.id as string, checkpoint as Record<string, unknown>); return checkpoint },
    async loadRecallCheckpoint(checkpointId) { return (data.checkpoints.get(checkpointId) ?? null) as any },
    async updateRecallCheckpoint(checkpointId, patch) { calls.push('updateRecallCheckpoint'); const c = data.checkpoints.get(checkpointId); if (c) Object.assign(c, patch) },
    async listCheckpointsByRecallSession(sessionId) { return [...data.checkpoints.values()].filter(c => (c as any).recallSessionId === sessionId) as any[] },
    async createProblem(problem) { calls.push('createProblem'); return problem },
    async loadProblem(problemId) { return null },
    async updateProblem(problemId, patch) { calls.push('updateProblem') },
    async archiveProblem(problemId) { calls.push('archiveProblem') },
    async createMoveComment(comment) { calls.push('createMoveComment'); return comment },
    async loadMoveComment(commentId) { return null },
    async updateMoveComment(commentId, patch) { calls.push('updateMoveComment') },
    async createReviewSchedule(schedule) { calls.push('createReviewSchedule'); return schedule },
    async findReviewScheduleByItem(itemId, itemType) { return null },
    async findReviewScheduleByTask(taskId) { return null },
    async listDueReviewItems(now) { return [] },
    async updateReviewSchedule(id, patch) { calls.push('updateReviewSchedule') },
    async listIncompleteAttempts() { return [] },
    async listIncompleteRecallSessions() { return [] },
    async listExpiredPendingMoveEvaluations(now) { return [] },
    async transaction<T>(fn: () => Promise<T>) { return fn() },
  } as any
}

function createInMemoryWorkbenchStore(initialState?: Partial<WorkbenchStoreState>): WorkbenchStore {
  const state: WorkbenchStoreState = {
    tabs: initialState?.tabs ?? [],
    activeTabId: initialState?.activeTabId ?? null,
    ...initialState,
  } as WorkbenchStoreState
  const listeners: Array<() => void> = []

  return {
    getState() { return state },
    subscribe(listener) { listeners.push(listener); return () => { const i = listeners.indexOf(listener); if (i >= 0) listeners.splice(i, 1) } },
    setTabs(tabs) { state.tabs = tabs; listeners.forEach(l => l()) },
    addTab(tab) { state.tabs = [...state.tabs, tab]; listeners.forEach(l => l()) },
    updateTab(tabId, patch) { state.tabs = state.tabs.map(t => t.id === tabId ? {...t, ...patch} : t); listeners.forEach(l => l()) },
    removeTab(tabId) { state.tabs = state.tabs.filter(t => t.id !== tabId); listeners.forEach(l => l()) },
    setActiveTab(tabId) { state.activeTabId = tabId; listeners.forEach(l => l()) },
  }
}

export type WorkbenchFlowServiceTestHarness = {
  flowService: WorkbenchFlowService
  repository: ReturnType<typeof createInMemoryRepository>
  workbenchStore: WorkbenchStore
  snapshotService: SpySnapshotService
  runtimeStore: TrainingRuntimeStore
  tabService: SpyWorkbenchTabService
}

export function createWorkbenchFlowServiceTestHarness(
  options: {
    initialTabs?: WorkbenchTab[]
    initialActiveTabId?: string | null
    seedTasks?: TrainingTask[]
    seedRecallSessions?: Array<[string, Record<string, unknown>]>
  } = {},
): WorkbenchFlowServiceTestHarness {
  const {createTrainingRuntimeStore} = require('../../../src/modules/training/store/trainingRuntimeStore.ts')
  const snapshotService = createSpySnapshotService()
  const tabService = createSpyTabService()
  const repository = createInMemoryRepository({
    tasks: new Map((options.seedTasks ?? []).map(t => [t.id, t])),
    recallSessions: new Map(options.seedRecallSessions ?? []),
  })
  const workbenchStore = createInMemoryWorkbenchStore({
    tabs: options.initialTabs ?? [],
    activeTabId: options.initialActiveTabId ?? null,
  })
  const runtimeStore = createTrainingRuntimeStore()

  const flowService = createWorkbenchFlowService({
    workbenchStore,
    repository,
    attemptService: {
      async createAttempt(input) { return {id: `attempt_${Date.now()}`} },
      async freezeAttempt(attemptId) {},
      async finalizeAttemptResult(attemptId, result) {},
    },
    recallService: {
      async createRecallSession(input) { return {id: `rs_${Date.now()}`} },
      async completeRecall(recallSessionId) {},
    },
    snapshotService,
    tabService,
  })

  return {flowService, repository, workbenchStore, snapshotService, runtimeStore, tabService}
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
