import assert from 'assert'

import { createTrainingRepository } from '../../src/modules/training/repository/trainingRepository.ts'
import { createPhase3FrozenAttemptDb } from './phase3TypedFakes.ts'

describe('trainingRepository frozen Attempt guard', () => {
  it('P3-T04 rejects protected field writes after Attempt is frozen', async () => {
    const db = createPhase3FrozenAttemptDb({
      id: 'attempt_1',
      taskId: 'task_1',
      startedAt: '2026-01-01T00:00:00.000Z',
      rootPositionSgf: '(;SZ[9])',
      userLine: ['D4'],
      moveActors: [{ moveIndex: 0, actor: 'human' }],
      status: 'submitted',
      result: 'pass',
      hintLevelUsed: 0,
      recallCompleted: false,
      analysisOpened: false,
    })
    const repo = createTrainingRepository(db)

    await assert.rejects(
      () => repo.updateAttempt('attempt_1', { userLine: ['Q16'] }),
      /frozen Attempt protected fields/,
    )
    await assert.rejects(
      () => repo.updateAttempt('attempt_1', { moveActors: [] }),
      /frozen Attempt protected fields/,
    )
    await assert.rejects(
      () => repo.updateAttempt('attempt_1', { result: 'fail' }),
      /frozen Attempt protected fields/,
    )
    await assert.rejects(
      () => repo.updateAttempt('attempt_1', { status: 'analyzing' }),
      /frozen Attempt protected fields/,
    )

    assert.deepStrictEqual(db.calls, [])
  })
})
