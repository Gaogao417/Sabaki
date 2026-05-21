import type { SnapshotService, ProblemSnapshotInput } from '../../../src/modules/training/analysis/snapshotService'
import type { WorkbenchFlowService } from '../../../src/modules/training/workbench/workbenchFlowService'
import type {
  OpenProblemTabOptions,
  OpenTaskOptions,
  WorkbenchTabService,
} from '../../../src/modules/training/workbench/workbenchTabService'
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
