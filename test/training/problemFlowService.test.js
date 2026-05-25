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
  })
})
