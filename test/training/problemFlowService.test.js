import assert from 'assert'

import { createProblemFlowService } from '../../src/modules/training/problem/problemFlowService.ts'
import { createTrainingRuntimeStore } from '../../src/modules/training/store/trainingRuntimeStore.ts'
import { createPhase3MutableAttemptRepository } from './phase3TypedFakes.ts'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

describe('problemFlowService', () => {
  it('P3-T07 undoProblemMove rolls back runtime cache and mutable Attempt line', async () => {
    const runtimeStore = createTrainingRuntimeStore()
    const repository = createPhase3MutableAttemptRepository({
      id: 'attempt_1',
      taskId: 'task_1',
      startedAt: '2026-01-01T00:00:00.000Z',
      rootPositionSgf: '(;SZ[9])',
      userLine: ['D4', 'Q16'],
      moveActors: [
        { moveIndex: 0, actor: 'human' },
        { moveIndex: 1, actor: 'ai' },
      ],
      status: 'playing',
      result: 'pending',
      hintLevelUsed: 0,
      recallCompleted: false,
      analysisOpened: false,
    })

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
      submitted: false,
      result: null,
    })

    const service = createProblemFlowService({
      runtimeStore,
      repository,
      attemptService: {},
      monitor: {},
      problemService: {},
      reviewService: {},
    })

    const result = await service.undoProblemMove()

    assert.deepStrictEqual(result.userLine, ['D4'])
    assert.deepStrictEqual(runtimeStore.getState().problemView.evalCache, [
      { moveIndex: 0, move: 'D4', isBadMove: false, severity: 'none' },
    ])
    assert.deepStrictEqual(runtimeStore.getState().problemView.badMoves, [])
    assert.deepStrictEqual(clone(repository.updates), [
      {
        id: 'attempt_1',
        patch: {
          userLine: ['D4'],
          moveActors: [{ moveIndex: 0, actor: 'human' }],
        },
      },
    ])

    const latestAttempt = await repository.loadAttempt('attempt_1')
    assert.strictEqual(
      runtimeStore.getState().problemView.evalCache.length,
      latestAttempt.userLine.length,
    )
    assert.strictEqual(
      latestAttempt.moveActors.length,
      latestAttempt.userLine.length,
    )
    assert.ok(
      runtimeStore
        .getState()
        .problemView
        .badMoves
        .every(move => move.moveIndex < latestAttempt.userLine.length),
      'bad move cache must not reference undone moves',
    )
  })

  it('records AI problem replies as attempt AI actors without touching recall/game-tree state', async () => {
    const runtimeStore = createTrainingRuntimeStore()
    const repository = createPhase3MutableAttemptRepository({
      id: 'attempt_ai',
      taskId: 'task_ai',
      startedAt: '2026-01-01T00:00:00.000Z',
      rootPositionSgf: '(;SZ[9])',
      userLine: ['dd'],
      moveActors: [{ moveIndex: 0, actor: 'human' }],
      status: 'playing',
      result: 'pending',
      hintLevelUsed: 0,
      recallCompleted: false,
      analysisOpened: false,
    })

    runtimeStore.setProblemView({
      taskId: 'task_ai',
      tabId: 'tab_ai',
      attemptId: 'attempt_ai',
      legacyProblemSession: null,
      evalCache: [
        { moveIndex: 0, move: 'dd', isBadMove: false, severity: 'none' },
      ],
      badMoves: [],
      submitted: false,
      result: null,
    })

    const service = createProblemFlowService({
      runtimeStore,
      repository,
      attemptService: {
        async appendMove(attemptId, move, actor) {
          const attempt = await repository.loadAttempt(attemptId)
          await repository.updateAttempt(attemptId, {
            userLine: [...attempt.userLine, move],
            moveActors: [
              ...(attempt.moveActors || []),
              {moveIndex: attempt.userLine.length, actor},
            ],
          })
        },
      },
      monitor: {async onUserMove() {}},
      problemService: {},
      reviewService: {},
    })

    await service.appendProblemMove({
      move: 'ee',
      vertex: [4, 4],
      playerSign: -1,
      preMoveAnalysis: null,
      actor: 'ai',
    })

    const latestAttempt = await repository.loadAttempt('attempt_ai')
    assert.deepStrictEqual(latestAttempt.userLine, ['dd', 'ee'])
    assert.deepStrictEqual(latestAttempt.moveActors, [
      {moveIndex: 0, actor: 'human'},
      {moveIndex: 1, actor: 'ai'},
    ])
    assert.strictEqual(runtimeStore.getState().recallView, null)
    assert.strictEqual(runtimeStore.getState().activeRecallSessionId, undefined)
    assert.strictEqual(runtimeStore.getState().problemView.evalCache.length, 2)
  })

  it('abandons the active problem attempt without submitting or creating recall work', async () => {
    const runtimeStore = createTrainingRuntimeStore()
    const repository = createPhase3MutableAttemptRepository({
      id: 'attempt_abandon',
      taskId: 'task_abandon',
      startedAt: '2026-01-01T00:00:00.000Z',
      rootPositionSgf: '(;SZ[9])',
      userLine: ['D4'],
      status: 'playing',
      result: 'pending',
      hintLevelUsed: 0,
      recallCompleted: false,
      analysisOpened: false,
    })
    const reviewCalls = []

    runtimeStore.setProblemView({
      taskId: 'task_abandon',
      tabId: 'tab_abandon',
      attemptId: 'attempt_abandon',
      problemId: 'problem_abandon',
      legacyProblemSession: {id: 'legacy_problem', sideToMove: 'black'},
      evalCache: [
        { moveIndex: 0, move: 'D4', isBadMove: false, severity: 'none' },
      ],
      badMoves: [],
      submitted: false,
      result: null,
    })

    const service = createProblemFlowService({
      runtimeStore,
      repository,
      attemptService: {
        async finalizeAttemptResult(attemptId, result) {
          await repository.updateAttempt(attemptId, {
            result,
            status: 'abandoned',
          })
        },
      },
      monitor: {},
      problemService: {},
      reviewService: {
        async updateScheduleAfterResult(input) {
          reviewCalls.push(input)
        },
      },
    })

    const result = await service.abandonActiveProblem()

    assert.strictEqual(result.attempt.id, 'attempt_abandon')
    assert.strictEqual(result.attempt.result, 'abandoned')
    assert.strictEqual(result.attempt.status, 'abandoned')
    assert.strictEqual(runtimeStore.getState().problemView, null)
    assert.deepStrictEqual(reviewCalls, [
      {taskId: 'problem_abandon', result: 'abandoned'},
    ])
    assert.deepStrictEqual(clone(repository.updates), [
      {
        id: 'attempt_abandon',
        patch: {
          result: 'abandoned',
          status: 'abandoned',
        },
      },
    ])
  })
})
