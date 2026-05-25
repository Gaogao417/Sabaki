import assert from 'assert'

import {
  createPhase3EngineService,
  createPhase3MutableAttemptRepository,
} from './phase3TypedFakes.ts'
import { createAiMoveService } from '../../src/modules/training/ai/aiMoveService.ts'
import { createProblemFlowService } from '../../src/modules/training/problem/problemFlowService.ts'
import { createTrainingRuntimeStore } from '../../src/modules/training/store/trainingRuntimeStore.ts'
import { createWorkbenchStore } from '../../src/modules/training/store/workbenchStore.ts'

function makeAttempt(overrides = {}) {
  return {
    id: 'attempt_1',
    taskId: 'task_1',
    startedAt: '2026-01-01T00:00:00.000Z',
    rootPositionSgf: '(;SZ[9])',
    userLine: ['D4'],
    status: 'playing',
    result: 'pending',
    hintLevelUsed: 0,
    recallCompleted: false,
    analysisOpened: false,
    ...overrides,
  }
}

function makeTab(overrides = {}) {
  return {
    id: 'tab_1',
    taskId: 'task_1',
    mode: 'play',
    activeAttemptId: 'attempt_1',
    childTabIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('Phase 3 production wiring regressions', () => {
  it('P3 production AI stale guard uses injected runtime/workbench/repository dependencies', async () => {
    const runtimeStore = createTrainingRuntimeStore()
    const workbenchStore = createWorkbenchStore()
    const attempt = makeAttempt()
    let latestAttempt = attempt
    let resolveEngine
    const enginePromise = new Promise(resolve => {
      resolveEngine = resolve
    })
    const tab = makeTab()
    workbenchStore.addTab(tab)
    workbenchStore.setActiveTab('tab_1')
    runtimeStore.setActiveAttempt('attempt_1')

    const service = createAiMoveService({
      runtimeStore,
      workbenchStore,
      repository: {
        async loadAttempt() {
          return latestAttempt
        },
      },
      engineService: createPhase3EngineService(async () => enginePromise),
    })

    const pending = service.requestAiMove({
      tab,
      attempt,
      task: { rootPositionSgf: '(;SZ[9])' },
      color: 'white',
    })

    latestAttempt = { ...attempt, userLine: ['D4', 'Q16'] }
    resolveEngine({ move: 'C3', candidates: ['C3'] })

    assert.strictEqual(await pending, null)
  })

  it('P3 problem submit finalizes before freeze and remains compatible with frozen guard', async () => {
    const runtimeStore = createTrainingRuntimeStore()
    const repository = createPhase3MutableAttemptRepository(makeAttempt())
    const order = []
    const attemptService = {
      async freezeAttempt(attemptId) {
        order.push('freeze')
        const attempt = await repository.loadAttempt(attemptId)
        await repository.updateAttempt(attemptId, {
          status: 'submitted',
          submittedAt: '2026-01-01T00:00:01.000Z',
        })
        return { ...attempt, status: 'submitted' }
      },
      async finalizeAttemptResult(attemptId, result) {
        order.push('finalize')
        await repository.updateAttempt(attemptId, { result })
      },
      async saveBadMove() {},
    }

    runtimeStore.setProblemView({
      taskId: 'task_1',
      tabId: 'tab_1',
      attemptId: 'attempt_1',
      problemId: 'problem_1',
      legacyProblemSession: { id: 'problem_1', sideToMove: 'black' },
      evalCache: [],
      badMoves: [],
      submitted: false,
      result: null,
    })

    const service = createProblemFlowService({
      runtimeStore,
      repository: {
        ...repository,
        async listBadMovesByAttempt() { return [] },
        async listMoveEvaluationsByAttempt() { return [] },
      },
      attemptService,
      monitor: {},
      problemService: {
        async createPunishmentProblemFromBadMove() {
          throw new Error('unexpected punishment creation')
        },
      },
      reviewService: {
        async updateScheduleAfterResult() {},
      },
    })

    const result = await service.submitActiveProblem()

    assert.deepStrictEqual(order, ['finalize', 'freeze'])
    assert.strictEqual(result.result, 'pass')
    assert.strictEqual(repository.getAttempt().result, 'pass')
    assert.strictEqual(repository.getAttempt().status, 'submitted')
  })

  it('P3 problem undo does not rollback a submitted problemView', async () => {
    const runtimeStore = createTrainingRuntimeStore()
    const repository = createPhase3MutableAttemptRepository(makeAttempt({
      userLine: ['D4', 'Q16'],
      moveActors: [
        { moveIndex: 0, actor: 'human' },
        { moveIndex: 1, actor: 'ai' },
      ],
    }))

    runtimeStore.setProblemView({
      taskId: 'task_1',
      tabId: 'tab_1',
      attemptId: 'attempt_1',
      legacyProblemSession: null,
      evalCache: [
        { moveIndex: 0, move: 'D4', isBadMove: false, severity: 'none' },
        { moveIndex: 1, move: 'Q16', isBadMove: true, severity: 'major' },
      ],
      badMoves: [{ moveIndex: 1, move: 'Q16', severity: 'major' }],
      submitted: true,
      result: 'fail',
    })

    const service = createProblemFlowService({
      runtimeStore,
      repository,
      attemptService: {},
      monitor: {},
      problemService: {},
      reviewService: {},
    })

    assert.strictEqual(await service.undoProblemMove(), null)
    assert.deepStrictEqual(repository.updates, [])
    assert.strictEqual(runtimeStore.getState().problemView.evalCache.length, 2)
  })
})
