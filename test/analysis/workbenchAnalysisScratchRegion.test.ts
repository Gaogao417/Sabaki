import assert from 'assert'
import fs from 'fs'
import path from 'path'

import {fromDimensions as newBoard} from '@sabaki/go-board'

import {
  createSnapshotFromBoard,
} from '../../src/modules/study.js'
import {
  refreshScratchAnalysis,
  type ScratchAnalysisDeps,
} from '../../src/modules/analysis/scratchAnalysis.ts'
import type {
  EditWorkspaceAnalysisState,
  EngineAnalysis,
  EngineSyncerLike,
  GameTree,
  RunBoardAnalysis,
  RunBoardAnalysisOptions,
  ScratchAnalysisTab,
} from '../../src/modules/analysis/analysisTypes.ts'
import {createWorkbenchStore} from '../../src/modules/training/store/workbenchStore.ts'
import type {TrainingRepository} from '../../src/modules/training/repository/trainingRepository'
import type {SnapshotService} from '../../src/modules/training/analysis/snapshotService'
import type {WorkbenchTabService} from '../../src/modules/training/workbench/workbenchTabService'
import type {
  ModeEnterEffectInput,
  ModeExitEffectInput,
  WorkbenchFlowServiceDeps,
  WorkbenchModeEffects,
} from '../../src/modules/training/workbench/workbenchFlowService'
import {
  createWorkbenchFlowService,
} from '../../src/modules/training/workbench/workbenchFlowService.ts'
import type {
  Problem,
  RecallSession,
  TrainingAttempt,
  TrainingAttemptResult,
  TrainingTask,
  WorkbenchTab,
} from '../../src/modules/training/types'

const NOW = '2026-05-27T00:00:00.000Z'
const REGION_PATH = path.resolve(
  process.cwd(),
  'src/modules/analysis/workbenchAnalysisScratchRegion.ts',
)
const ANALYSIS_INDEX_PATH = path.resolve(process.cwd(), 'src/modules/analysis/index.ts')
const SCRATCH_ANALYSIS_PATH = path.resolve(process.cwd(), 'src/modules/analysis/scratchAnalysis.ts')
const EXPECTED_REGION_TYPE_EXPORTS = [
  'WorkbenchAnalysisScratchAdapter',
  'WorkbenchAnalysisScratchRegion',
  'WorkbenchAnalysisScratchResultInput',
  'WorkbenchAnalysisScratchTarget',
]

type ScratchRegionTarget = {
  kind: 'scratch'
  tabId: string
  workspaceId: string
  generation: number
  targetTab: ScratchAnalysisTab
  status: 'active' | 'inactive'
  sourceMode: 'play' | 'problem' | 'recall'
  reason?: string
}

type ScratchRegionTransitionInput = ModeEnterEffectInput | ModeExitEffectInput

type WorkbenchAnalysisScratchAdapter = {
  createOrStampWorkspace(input: {
    target: ScratchRegionTarget
    transition: ModeEnterEffectInput
  }): void
  scheduleScratchAnalysis(input: {target: ScratchRegionTarget}): void
  clearWorkspace(input: {
    target: ScratchRegionTarget
    transition: ModeExitEffectInput
  }): void
  writeAnalysisResult?(input: {
    target: ScratchRegionTarget
    analysis: EngineAnalysis | null
  }): void
}

type ScratchResultInput = {
  target: ScratchRegionTarget
  analysis: EngineAnalysis | null
  final: boolean
}

type WorkbenchAnalysisScratchRegion = WorkbenchModeEffects & {
  getActiveTarget(tabId: string): ScratchRegionTarget | null
  applyScratchAnalysisResult(input: ScratchResultInput): boolean
}

type ScratchRegionModule = {
  createWorkbenchAnalysisScratchRegion(input: {
    adapter: WorkbenchAnalysisScratchAdapter
  }): WorkbenchAnalysisScratchRegion
}

type ExtendedEditWorkspace = EditWorkspaceAnalysisState & {
  scratchTarget?: ScratchRegionTarget
}

function assertExportsValue(source: string, exportName: string, label: string): void {
  assert.match(
    source,
    new RegExp(`export\\s*\\{[\\s\\S]*\\b${exportName}\\b[\\s\\S]*\\}`),
    `${label} must re-export ${exportName}`,
  )
}

function assertExportsType(source: string, exportName: string, label: string): void {
  const declarationPattern = new RegExp(
    `export\\s+(?:type|interface)\\s+${exportName}\\b`,
  )
  const reexportPattern = new RegExp(
    `export\\s+type\\s*\\{[\\s\\S]*\\b${exportName}\\b[\\s\\S]*\\}`,
  )
  assert.ok(
    declarationPattern.test(source) || reexportPattern.test(source),
    `${label} must export typed contract ${exportName}`,
  )
}

function clone<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function makeSnapshot(nextPlayer: 1 | -1 = 1) {
  return createSnapshotFromBoard(newBoard(9, 9), nextPlayer)
}

function makeAnalysis(label: string): EngineAnalysis {
  return {
    sign: label.includes('white') ? -1 : 1,
    variations: [],
    ownership: Array.from({length: 9}, () => Array(9).fill(label.length / 100)),
    winrate: 50 + label.length,
    scoreLead: label.length,
    humanPolicyMap: null,
  }
}

function makeSyncer(id = 'syncer-1'): EngineSyncerLike {
  return {
    id,
    commands: [],
    treePosition: 'root',
    analysis: null,
    engine: {path: '/tmp/fake-engine'},
    on() {},
    removeListener() {},
    queueCommand() {},
    sendAbort() {},
  }
}

function makeWorkspace(
  overrides: Partial<ExtendedEditWorkspace> = {},
): ExtendedEditWorkspace {
  return {
    activeTab: 'current',
    currentSnapshot: makeSnapshot(1),
    referenceSnapshot: makeSnapshot(-1),
    currentAnalysis: null,
    referenceAnalysis: null,
    currentOwnership: null,
    referenceOwnership: null,
    analysisPending: false,
    ...overrides,
  }
}

function makeTarget(
  overrides: Partial<ScratchRegionTarget> = {},
): ScratchRegionTarget {
  return {
    kind: 'scratch',
    tabId: 'tab_1',
    workspaceId: 'workspace_1',
    generation: 1,
    targetTab: 'current',
    status: 'active',
    sourceMode: 'play',
    reason: 'manual',
    ...overrides,
  }
}

function createScratchAnalysisHarness(input?: {
  workspace?: ExtendedEditWorkspace | null
  syncerId?: string
  runBoardAnalysis?: RunBoardAnalysis
}) {
  const state: {
    editWorkspace?: ExtendedEditWorkspace | null
    analysis: EngineAnalysis | null
    analysisTreePosition: string | null
    gameTrees: unknown[]
    treePosition: string
  } = {
    editWorkspace: input?.workspace ?? makeWorkspace(),
    analysis: null,
    analysisTreePosition: null,
    gameTrees: [{id: 'source-tree'}],
    treePosition: 'source-node',
  }
  const patches: Record<string, unknown>[] = []
  const runOptions: RunBoardAnalysisOptions[] = []

  const defaultRunBoardAnalysis: RunBoardAnalysis = async (options) => {
    runOptions.push(options)
    return makeAnalysis(`result-${options.requestGroup}-${options.analysisSource}`)
  }

  const deps = {
    getState(): {editWorkspace?: EditWorkspaceAnalysisState} & Record<string, unknown> {
      return state
    },
    setState(patch: Record<string, unknown>): void {
      patches.push(clone(patch))
      Object.assign(state, patch)
    },
    getSyncer(): EngineSyncerLike | null {
      return makeSyncer(input?.syncerId ?? `syncer-${Date.now()}-${Math.random()}`)
    },
    engineSupportsOwnership(): boolean {
      return true
    },
    runBoardAnalysis: input?.runBoardAnalysis ?? defaultRunBoardAnalysis,
    getSourceTree(): GameTree | null {
      return null
    },
  } satisfies ScratchAnalysisDeps

  return {state, patches, runOptions, deps}
}

function describeForbiddenAnalysisPatches(
  patches: Array<Record<string, unknown>>,
): string[] {
  const editWorkspaceKeys = [
    'currentAnalysis',
    'currentOwnership',
    'referenceAnalysis',
    'referenceOwnership',
  ]
  const writes: string[] = []

  patches.forEach((patch, index) => {
    if (
      Object.prototype.hasOwnProperty.call(patch, 'analysis') &&
      patch.analysis != null
    ) {
      writes.push(`patch[${index}].analysis`)
    }
    if (
      Object.prototype.hasOwnProperty.call(patch, 'analysisTreePosition') &&
      patch.analysisTreePosition != null
    ) {
      writes.push(`patch[${index}].analysisTreePosition`)
    }

    const editWorkspace = patch.editWorkspace
    if (editWorkspace == null || typeof editWorkspace !== 'object') return

    for (const key of editWorkspaceKeys) {
      const value = (editWorkspace as Record<string, unknown>)[key]
      if (value != null) writes.push(`patch[${index}].editWorkspace.${key}`)
    }
  })

  return writes
}

function makeWorkbenchTab(overrides: Partial<WorkbenchTab> = {}): WorkbenchTab {
  return {
    id: 'tab_1',
    taskId: 'task_1',
    mode: 'play',
    childTabIds: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makeTask(overrides: Partial<TrainingTask> = {}): TrainingTask {
  return {
    id: 'task_1',
    rootPositionSgf: '(;SZ[9])',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function createNoopRepository(): TrainingRepository {
  const tasks = new Map<string, TrainingTask>([['task_1', makeTask()]])
  const attempts = new Map<string, TrainingAttempt>()
  const problems = new Map<string, Problem>()
  const sessions = new Map<string, RecallSession>()

  return {
    async saveGame(game) { return game },
    async getGame() { return null },
    async getRecentGames() { return [] },
    async saveRecallSession(session) { return session },
    async saveRecallAttempts() {},
    async saveProblem(problem) { return problem },
    async getProblem() { return null },
    async getProblemsByStatus() { return [] },
    async saveProblemAttempt(attempt) { return attempt },
    async saveBadMove(badMove) { return badMove },
    async updateBadMoveGeneratedProblem() {},
    async getDueReviews() { return [] },
    async upsertReviewSchedule() {},
    async getDashboardSummary() { return {} },
    async createTask(task) {
      tasks.set(task.id, clone(task))
      return clone(task)
    },
    async loadTask(taskId) {
      return clone(tasks.get(taskId) ?? null)
    },
    async findTaskBySource() { return null },
    async listTasksByStatus() { return Array.from(tasks.values()).map(clone) },
    async listTasksByOriginProvider() { return [] },
    async updateTask(taskId, patch) {
      const task = tasks.get(taskId)
      if (task) tasks.set(taskId, {...task, ...clone(patch)})
    },
    async createAttempt(attempt) {
      attempts.set(attempt.id, clone(attempt))
      return clone(attempt)
    },
    async loadAttempt(attemptId) { return clone(attempts.get(attemptId) ?? null) },
    async listAttemptsByTask(taskId) {
      return Array.from(attempts.values()).filter(a => a.taskId === taskId).map(clone)
    },
    async updateAttempt(attemptId, patch) {
      const attempt = attempts.get(attemptId)
      if (attempt) attempts.set(attemptId, {...attempt, ...clone(patch)})
    },
    async createMoveEvaluation(evaluation) { return evaluation },
    async updateMoveEvaluation() {},
    async listMoveEvaluationsByAttempt() { return [] },
    async createBadMove(badMove) { return badMove },
    async loadBadMove() { return null },
    async listBadMovesByAttempt() { return [] },
    async listBadMovesByTask() { return [] },
    async markBadMoveAsNotBad() {},
    async updateBadMove() {},
    async createRecallSession(session) {
      sessions.set(session.id, clone(session))
      return clone(session)
    },
    async loadRecallSession(sessionId) { return clone(sessions.get(sessionId) ?? null) },
    async updateRecallSession(sessionId, patch) {
      const session = sessions.get(sessionId)
      if (session) sessions.set(sessionId, {...session, ...clone(patch)})
    },
    async createRecallAttempt(attempt) { return attempt },
    async listRecallAttempts() { return [] },
    async createRecallCheckpoint(checkpoint) { return checkpoint },
    async loadRecallCheckpoint() { return null },
    async updateRecallCheckpoint() {},
    async listCheckpointsByRecallSession() { return [] },
    async createProblem(problem) {
      problems.set(problem.id, clone(problem))
      return clone(problem)
    },
    async loadProblem(problemId) { return clone(problems.get(problemId) ?? null) },
    async updateProblem(problemId, patch) {
      const problem = problems.get(problemId)
      if (problem) problems.set(problemId, {...problem, ...clone(patch)})
    },
    async archiveProblem() {},
    async createMoveComment(comment) { return comment },
    async loadMoveComment() { return null },
    async updateMoveComment() {},
    async createReviewSchedule(schedule) { return schedule },
    async findReviewScheduleByItem() { return null },
    async findReviewScheduleByTask() { return null },
    async listDueReviewItems() { return [] },
    async updateReviewSchedule() {},
    async listIncompleteAttempts() { return [] },
    async listIncompleteRecallSessions() { return [] },
    async listExpiredPendingMoveEvaluations() { return [] },
    async transaction<T>(fn: () => Promise<T>): Promise<T> { return fn() },
  } satisfies TrainingRepository
}

function createNoopSnapshotService(): SnapshotService {
  return {
    async captureSnapshotInput() {
      return {
        positionSgf: '(;SZ[9])',
        sideToMove: 'black',
      }
    },
    async createProblemFromCurrentAnalysisPosition(input) {
      return {
        id: 'problem_1',
        type: 'best_move',
        positionSgf: input.positionSgf,
        sideToMove: input.sideToMove,
        referenceLines: [],
        passRule: {
          scoreDropThreshold: 2,
          severeDropThreshold: 8,
          requireNoSevereBadMove: false,
          compareWithReference: false,
        },
        status: 'inbox',
        createdAt: NOW,
        updatedAt: NOW,
      }
    },
  } satisfies SnapshotService
}

function createNoopTabService(): WorkbenchTabService {
  return {
    async openGameTab() { return makeWorkbenchTab() },
    async openProblemTab() { return makeWorkbenchTab({mode: 'problem'}) },
    async openTask() { return makeWorkbenchTab() },
    async openSnapshotProblemTab() { return makeWorkbenchTab({mode: 'problem'}) },
    async openAttemptTab() { return makeWorkbenchTab() },
    async openRecallSessionTab() { return makeWorkbenchTab({mode: 'recall'}) },
    async closeTab() {},
    switchTab() {},
  } satisfies WorkbenchTabService
}

function createFlowDeps(input: {
  tab: WorkbenchTab
  modeEffects: WorkbenchModeEffects
}): WorkbenchFlowServiceDeps {
  const workbenchStore = createWorkbenchStore()
  workbenchStore.addTab(input.tab)
  workbenchStore.setActiveTab(input.tab.id)

  return {
    workbenchStore,
    repository: createNoopRepository(),
    attemptService: {
      async createAttempt() { return {id: 'attempt_1'} },
      async freezeAttempt() {},
      async finalizeAttemptResult(
        _attemptId: string,
        _result: TrainingAttemptResult,
      ) {},
    },
    recallService: {
      async completeRecall() {},
    },
    snapshotService: createNoopSnapshotService(),
    tabService: createNoopTabService(),
    modeEffects: input.modeEffects,
  } satisfies WorkbenchFlowServiceDeps
}

function createAdapterHarness() {
  const calls: {
    createOrStampWorkspace: Array<{
      target: ScratchRegionTarget
      transition: ModeEnterEffectInput
    }>
    scheduleScratchAnalysis: Array<{target: ScratchRegionTarget}>
    clearWorkspace: Array<{
      target: ScratchRegionTarget
      transition: ModeExitEffectInput
    }>
    writeAnalysisResult: Array<{
      target: ScratchRegionTarget
      analysis: EngineAnalysis | null
    }>
  } = {
    createOrStampWorkspace: [],
    scheduleScratchAnalysis: [],
    clearWorkspace: [],
    writeAnalysisResult: [],
  }

  const adapter = {
    createOrStampWorkspace(input) {
      calls.createOrStampWorkspace.push(clone(input))
    },
    scheduleScratchAnalysis(input) {
      calls.scheduleScratchAnalysis.push(clone(input))
    },
    clearWorkspace(input) {
      calls.clearWorkspace.push(clone(input))
    },
    writeAnalysisResult(input) {
      calls.writeAnalysisResult.push(clone(input))
    },
  } satisfies WorkbenchAnalysisScratchAdapter

  return {adapter, calls}
}

async function loadScratchRegionModule(): Promise<ScratchRegionModule> {
  const mod = await import('../../src/modules/analysis/workbenchAnalysisScratchRegion.ts')
  const maybeFactory = (mod as Record<string, unknown>).createWorkbenchAnalysisScratchRegion
  assert.strictEqual(
    typeof maybeFactory,
    'function',
    'SCR-T01: analysis scratch region must export createWorkbenchAnalysisScratchRegion()',
  )
  return mod as ScratchRegionModule
}

function makeEnterInput(overrides: Partial<ModeEnterEffectInput> = {}): ModeEnterEffectInput {
  const beforeTab = makeWorkbenchTab({mode: 'play'})
  const afterTab = {
    ...beforeTab,
    mode: 'analysis' as const,
    previousMode: 'play' as const,
    analysisReturnTarget: {mode: 'play' as const},
    analysisContext: {taskId: beforeTab.taskId, source: 'play'},
  }

  return {
    tabId: beforeTab.id,
    fromMode: 'play',
    toMode: 'analysis',
    beforeTab,
    afterTab,
    analysisReturnTarget: {mode: 'play'},
    analysisContext: {taskId: beforeTab.taskId, source: 'play'},
    reason: 'manual',
    ...overrides,
  }
}

function makeExitInput(
  beforeTab: WorkbenchTab = makeWorkbenchTab({
    mode: 'analysis',
    previousMode: 'play',
    analysisReturnTarget: {mode: 'play'},
    analysisContext: {taskId: 'task_1', source: 'play'},
  }),
  overrides: Partial<ModeExitEffectInput> = {},
): ModeExitEffectInput {
  const afterTab = {
    ...beforeTab,
    mode: 'play' as const,
    previousMode: undefined,
    analysisReturnTarget: undefined,
  }

  return {
    tabId: beforeTab.id,
    fromMode: 'analysis',
    toMode: 'play',
    beforeTab,
    afterTab,
    analysisReturnTarget: {mode: 'play'},
    reason: 'return',
    ...overrides,
  }
}

describe('workbench analysis scratch region contract', () => {
  describe('SCR-T01/SCR-T08 architecture boundary', () => {
    it('exports a scratch-region owner from the analysis module surface', async () => {
      assert.ok(
        fs.existsSync(REGION_PATH),
        'SCR-T01: src/modules/analysis/workbenchAnalysisScratchRegion.ts must exist',
      )

      const regionSource = fs.readFileSync(REGION_PATH, 'utf8')
      const indexSource = fs.readFileSync(ANALYSIS_INDEX_PATH, 'utf8')

      assert.match(
        regionSource,
        /createWorkbenchAnalysisScratchRegion/,
        'SCR-T01: scratch region module must expose a production factory',
      )
      assertExportsValue(
        indexSource,
        'createWorkbenchAnalysisScratchRegion',
        'SCR-T01: src/modules/analysis/index.ts',
      )
      for (const exportName of EXPECTED_REGION_TYPE_EXPORTS) {
        assertExportsType(regionSource, exportName, 'SCR-T01: scratch region module')
        assertExportsType(indexSource, exportName, 'SCR-T01: src/modules/analysis/index.ts')
      }

      const mod = await loadScratchRegionModule()
      assert.strictEqual(typeof mod.createWorkbenchAnalysisScratchRegion, 'function')
    })

    it('does not import parent runtime/store/repository/document owners or direct mode writers', () => {
      assert.ok(
        fs.existsSync(REGION_PATH),
        'SCR-T08: scratch region source must exist before boundary scan can pass',
      )
      const source = fs.readFileSync(REGION_PATH, 'utf8')
      const forbidden = [
        'window.sabaki',
        'trainingRuntimeStore',
        'TrainingRepository',
        'documentStore',
        'overlayStore',
        'workbenchStore.updateTab',
        'setMode(',
        'openGameTab',
        'openProblemTab',
        'openSnapshotProblemTab',
        'origin.provider',
        'source_kind',
        'source.kind',
      ]

      for (const token of forbidden) {
        assert.ok(
          !source.includes(token),
          `SCR-T08: scratch region must not contain forbidden boundary token "${token}"`,
        )
      }
    })
  })

  describe('SCR-T02/SCR-T03 scratch target lifecycle', () => {
    it('enterAnalysis creates one active target and delegates workspace setup without mutating WorkbenchTab', async () => {
      const mod = await loadScratchRegionModule()
      const {adapter, calls} = createAdapterHarness()
      const region = mod.createWorkbenchAnalysisScratchRegion({adapter})
      const input = makeEnterInput()
      const afterTabBefore = clone(input.afterTab)

      await region.enterAnalysis(input)

      const active = region.getActiveTarget(input.tabId)
      assert.ok(active, 'SCR-T02: enterAnalysis must create an active scratch target')
      assert.strictEqual(active.kind, 'scratch')
      assert.strictEqual(active.tabId, input.tabId)
      assert.strictEqual(active.targetTab, 'current')
      assert.strictEqual(active.status, 'active')
      assert.strictEqual(active.sourceMode, 'play')
      assert.strictEqual(active.reason, 'manual')
      assert.ok(active.workspaceId, 'SCR-T02: target must carry workspaceId')
      assert.ok(active.generation > 0, 'SCR-T02: target generation must increment')
      assert.strictEqual(calls.createOrStampWorkspace.length, 1)
      assert.strictEqual(calls.scheduleScratchAnalysis.length, 1)
      assert.deepStrictEqual(
        calls.createOrStampWorkspace[0].target,
        active,
        'SCR-T02: createOrStampWorkspace must receive the active target',
      )
      assert.deepStrictEqual(
        calls.createOrStampWorkspace[0].transition,
        clone(input),
        'SCR-T02: createOrStampWorkspace must receive the upstream enter transition object',
      )
      assert.deepStrictEqual(
        calls.scheduleScratchAnalysis[0].target,
        active,
        'SCR-T02: scheduleScratchAnalysis must receive the active target',
      )
      assert.deepStrictEqual(
        input.afterTab,
        afterTabBefore,
        'SCR-T02: child region must not mutate WorkbenchTab parent state',
      )
    })

    it('exitAnalysis invalidates target, clears through adapter, and rejects late old results', async () => {
      const mod = await loadScratchRegionModule()
      const {adapter, calls} = createAdapterHarness()
      const region = mod.createWorkbenchAnalysisScratchRegion({adapter})
      const enterInput = makeEnterInput()

      await region.enterAnalysis(enterInput)
      const oldTarget = region.getActiveTarget(enterInput.tabId)
      assert.ok(oldTarget, 'SCR-T03 setup: active target should exist after enter')
      const expectedOldTarget = clone(oldTarget)

      const exitInput = makeExitInput(enterInput.afterTab)
      await region.exitAnalysis(exitInput)

      assert.strictEqual(calls.clearWorkspace.length, 1)
      assert.deepStrictEqual(
        calls.clearWorkspace[0].target,
        expectedOldTarget,
        'SCR-T03: clearWorkspace must receive the old active target',
      )
      assert.deepStrictEqual(
        calls.clearWorkspace[0].transition,
        clone(exitInput),
        'SCR-T03: clearWorkspace must receive the upstream exit transition object',
      )
      const activeAfterExit = region.getActiveTarget(enterInput.tabId)
      assert.ok(
        activeAfterExit == null || activeAfterExit.status === 'inactive',
        'SCR-T03: exitAnalysis must invalidate the active scratch target',
      )

      const accepted = region.applyScratchAnalysisResult({
        target: expectedOldTarget,
        analysis: makeAnalysis('late-old-target'),
        final: true,
      })
      assert.strictEqual(accepted, false)
      assert.strictEqual(
        calls.writeAnalysisResult.length,
        0,
        'SCR-T03: late result for an old target must not recreate or write editWorkspace',
      )
    })
  })

  describe('SCR-T04/SCR-T05/SCR-T06 scratch analysis write-back', () => {
    it('SCR-T05A keeps current and reference legacy analysis keys isolated', async () => {
      const currentResult = makeAnalysis('current-black')
      const referenceResult = makeAnalysis('reference-white')
      let callIndex = 0
      const runBoardAnalysis: RunBoardAnalysis = async (options) => {
        callIndex += 1
        return callIndex === 1 ? currentResult : referenceResult
      }
      const harness = createScratchAnalysisHarness({
        workspace: makeWorkspace(),
        syncerId: 'syncer-t05a',
        runBoardAnalysis,
      })

      await refreshScratchAnalysis(harness.deps, 'current')
      assert.strictEqual(harness.state.editWorkspace?.currentAnalysis, currentResult)
      assert.deepStrictEqual(harness.state.editWorkspace?.currentOwnership, currentResult.ownership)
      assert.strictEqual(harness.state.editWorkspace?.referenceAnalysis, null)
      assert.strictEqual(harness.state.editWorkspace?.referenceOwnership, null)
      assert.strictEqual(harness.state.editWorkspace?.analysisPending, false)

      await refreshScratchAnalysis(harness.deps, 'reference')
      assert.strictEqual(harness.state.editWorkspace?.currentAnalysis, currentResult)
      assert.deepStrictEqual(harness.state.editWorkspace?.currentOwnership, currentResult.ownership)
      assert.strictEqual(harness.state.editWorkspace?.referenceAnalysis, referenceResult)
      assert.deepStrictEqual(harness.state.editWorkspace?.referenceOwnership, referenceResult.ownership)
      assert.strictEqual(harness.state.editWorkspace?.analysisPending, false)
    })

    it('SCR-T06A requests scratch-analysis group/source and writes only editWorkspace state', async () => {
      const harness = createScratchAnalysisHarness({
        workspace: makeWorkspace(),
        syncerId: 'syncer-t06a',
      })

      await refreshScratchAnalysis(harness.deps, 'current')

      assert.strictEqual(harness.runOptions.length, 1)
      assert.strictEqual(harness.runOptions[0].requestGroup, 'scratch-analysis')
      assert.strictEqual(harness.runOptions[0].analysisSource, 'scratch-analysis')
      assert.notStrictEqual(harness.state.editWorkspace?.currentAnalysis, null)
      assert.strictEqual(harness.state.analysis, null)
      assert.strictEqual(harness.state.analysisTreePosition, null)
      assert.deepStrictEqual(harness.state.gameTrees, [{id: 'source-tree'}])
      assert.strictEqual(harness.state.treePosition, 'source-node')
    })

    it('SCR-T06B carries explicit target metadata on scratch analysis requests', async () => {
      const activeTarget = makeTarget({
        tabId: 'tab_1',
        workspaceId: 'workspace_request_target',
        generation: 7,
        targetTab: 'current',
      })
      const harness = createScratchAnalysisHarness({
        workspace: makeWorkspace({scratchTarget: activeTarget}),
        syncerId: 'syncer-t06b',
      })

      await refreshScratchAnalysis(harness.deps, 'current')

      const request = harness.runOptions[0] as RunBoardAnalysisOptions & {
        scratchTarget?: ScratchRegionTarget
        target?: ScratchRegionTarget
      }
      const target = request.scratchTarget ?? request.target
      assert.deepStrictEqual(
        target,
        activeTarget,
        'SCR-T06B: scratch analysis request must carry {tabId, workspaceId, generation, targetTab}',
      )
    })

    it('SCR-T04/SCR-T05B ignores stale target update/final after workspace generation changes', async () => {
      const oldTarget = makeTarget({
        workspaceId: 'workspace_old',
        generation: 1,
        targetTab: 'current',
      })
      const newTarget = makeTarget({
        workspaceId: 'workspace_new',
        generation: 2,
        targetTab: 'current',
      })
      const staleAnalysis = makeAnalysis('stale-old-target')
      let capturedOptions: RunBoardAnalysisOptions | null = null
      let stalePatchStart = -1
      let harness: ReturnType<typeof createScratchAnalysisHarness> | null = null
      let stateRef: ReturnType<typeof createScratchAnalysisHarness>['state'] | null = null

      const runBoardAnalysis: RunBoardAnalysis = async (options) => {
        capturedOptions = options
        assert.ok(harness, 'test setup requires patch harness')
        assert.ok(stateRef?.editWorkspace, 'test setup requires editWorkspace')
        stateRef.editWorkspace = makeWorkspace({scratchTarget: newTarget})
        stalePatchStart = harness.patches.length
        options.onAnalysisUpdate?.(staleAnalysis)
        return staleAnalysis
      }

      harness = createScratchAnalysisHarness({
        workspace: makeWorkspace({scratchTarget: oldTarget}),
        syncerId: 'syncer-t04',
        runBoardAnalysis,
      })
      stateRef = harness.state

      await refreshScratchAnalysis(harness.deps, 'current')

      assert.ok(capturedOptions, 'SCR-T04 setup: runBoardAnalysis should be invoked')
      assert.ok(stalePatchStart >= 0, 'SCR-T04 setup: stale patch boundary should be captured')
      const stalePatches = harness.patches.slice(stalePatchStart)
      assert.deepStrictEqual(
        describeForbiddenAnalysisPatches(stalePatches),
        [],
        'SCR-T04/SCR-T05B: stale update/final must not write editWorkspace or global analysis result fields',
      )
      assert.strictEqual(
        harness.state.editWorkspace?.scratchTarget?.workspaceId,
        newTarget.workspaceId,
      )
      assert.strictEqual(
        harness.state.editWorkspace?.currentAnalysis,
        null,
        'SCR-T04: stale old workspace update/final must not write currentAnalysis into the new workspace',
      )
      assert.strictEqual(harness.state.editWorkspace?.currentOwnership, null)
      assert.strictEqual(harness.state.analysis, null)
      assert.strictEqual(harness.state.analysisTreePosition, null)
      assert.deepStrictEqual(harness.state.gameTrees, [{id: 'source-tree'}])
      assert.deepStrictEqual(
        describeForbiddenAnalysisPatches(stalePatches),
        [],
        'SCR-T04/SCR-T05B: stale zero-write guarantee must hold after final state assertions',
      )
    })
  })

  describe('SCR-T07 real flow modeEffects seam', () => {
    it('real flow enter/return transitions drive injected scratch region outcomes', async () => {
      const mod = await loadScratchRegionModule()
      const {adapter, calls} = createAdapterHarness()
      const region = mod.createWorkbenchAnalysisScratchRegion({adapter})
      const deps = createFlowDeps({
        tab: makeWorkbenchTab({mode: 'play'}),
        modeEffects: region,
      })
      const flow = createWorkbenchFlowService(deps)

      flow.enterAnalysis('tab_1', {reason: 'manual'})

      const analysisTab = deps.workbenchStore.getState().tabs[0]
      assert.strictEqual(analysisTab.mode, 'analysis')
      assert.deepStrictEqual(analysisTab.analysisReturnTarget, {mode: 'play'})
      const active = region.getActiveTarget('tab_1')
      assert.ok(active, 'SCR-T07: injected scratch region must own an active target after real flow enter')
      assert.strictEqual(active.workspaceId, calls.createOrStampWorkspace[0].target.workspaceId)

      flow.returnFromAnalysis({tabId: 'tab_1', reason: 'return'})

      const returnedTab = deps.workbenchStore.getState().tabs[0]
      assert.strictEqual(returnedTab.mode, 'play')
      assert.strictEqual(returnedTab.analysisReturnTarget, undefined)
      assert.strictEqual(calls.clearWorkspace.length, 1)
      const activeAfterReturn = region.getActiveTarget('tab_1')
      assert.ok(
        activeAfterReturn == null || activeAfterReturn.status === 'inactive',
        'SCR-T07: returnFromAnalysis must invalidate scratch target through injected region',
      )
    })
  })

  describe('SCR-T10 mutation boundary source scan', () => {
    it('scratch modules do not write attempts, repository facts, SGF tree/history/current node, or global analysis state', () => {
      const sources: Array<[string, string]> = [
        ['scratchAnalysis.ts', fs.readFileSync(SCRATCH_ANALYSIS_PATH, 'utf8')],
      ]
      if (fs.existsSync(REGION_PATH)) {
        sources.push(['workbenchAnalysisScratchRegion.ts', fs.readFileSync(REGION_PATH, 'utf8')])
      }

      const forbiddenPatterns: Array<[RegExp, string]> = [
        [
          /\b(?:createAttempt|updateAttempt)\b|\bAttempt\.userLine\b|\b(?:attempt|trainingAttempt)\.(?:userLine|result|status)\s*=|\b(?:attempt|trainingAttempt)\s*:\s*\{[^}]*\b(?:userLine|result|status)\s*:/i,
          'Attempt fact write',
        ],
        [/\bcreateProblem\b|\bupdateProblem\b|\bupsertReviewSchedule\b|\brepository\./, 'repository/review write'],
        [/\bdocumentStore\b|\bsetState\(\s*\{\s*gameTrees\s*:|\bsetState\(\s*\{\s*treePosition\s*:|\bsetCurrentTreePosition\b|\bhistory\s*:|\bcurrentNode\b/, 'SGF tree/history/current-node write'],
        [/\bsetState\(\s*\{\s*analysis\s*:/, 'global analysis write'],
        [/\bSBKV\b|\bSBKS\b/, 'SGF analysis property write'],
      ]

      for (const [label, source] of sources) {
        for (const [pattern, description] of forbiddenPatterns) {
          assert.ok(
            !pattern.test(source),
            `SCR-T10: ${label} must not contain ${description}`,
          )
        }
      }
    })
  })
})
