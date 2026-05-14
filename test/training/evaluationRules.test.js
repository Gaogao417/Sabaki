import assert from 'assert'

import {
  evaluateMove,
  classifySeverity,
  evaluateAttempt,
  shouldCreateBadMove,
} from '../../src/modules/training/attempt/evaluationRules.ts'

function makeAttempt(overrides = {}) {
  return {
    id: 'attempt_1',
    taskId: 'task_1',
    startedAt: '2026-01-01T00:00:00.000Z',
    rootPositionSgf: '(;SZ[9])',
    userLine: ['D4', 'Q16'],
    status: 'playing',
    result: 'pending',
    hintLevelUsed: 0,
    recallCompleted: false,
    analysisOpened: false,
    ...overrides,
  }
}

function makeBadMove(overrides = {}) {
  return {
    id: 'bm_1',
    moveEvaluationId: 'eval_1',
    attemptId: 'attempt_1',
    taskId: 'task_1',
    moveIndex: 0,
    severity: 'major',
    punishSide: 'black',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeEval(overrides = {}) {
  return {
    id: 'eval_1',
    attemptId: 'attempt_1',
    moveIndex: 0,
    move: 'D4',
    status: 'evaluated',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

// --- classifySeverity ---

describe('evaluationRules.classifySeverity', () => {
  it('returns "none" when no drops are provided', () => {
    assert.strictEqual(classifySeverity({}), 'none')
  })

  it('returns "none" when drops are 0', () => {
    assert.strictEqual(classifySeverity({ scoreDrop: 0 }), 'none')
  })

  it('classifies minor at >= 2.0 scoreDrop', () => {
    assert.strictEqual(classifySeverity({ scoreDrop: 2.0 }), 'minor')
    assert.strictEqual(classifySeverity({ scoreDrop: 2.5 }), 'minor')
    assert.strictEqual(classifySeverity({ scoreDrop: 1.9 }), 'none')
  })

  it('classifies major at >= 5.0 scoreDrop', () => {
    assert.strictEqual(classifySeverity({ scoreDrop: 5.0 }), 'major')
    assert.strictEqual(classifySeverity({ scoreDrop: 6.0 }), 'major')
    assert.strictEqual(classifySeverity({ scoreDrop: 4.9 }), 'minor')
  })

  it('classifies severe at >= 8.0 scoreDrop', () => {
    assert.strictEqual(classifySeverity({ scoreDrop: 8.0 }), 'severe')
    assert.strictEqual(classifySeverity({ scoreDrop: 15.0 }), 'severe')
    assert.strictEqual(classifySeverity({ scoreDrop: 7.9 }), 'major')
  })

  it('classifies minor via winrateDrop alone', () => {
    assert.strictEqual(classifySeverity({ winrateDrop: 0.05 }), 'minor')
    assert.strictEqual(classifySeverity({ winrateDrop: 0.2 }), 'minor')
    assert.strictEqual(classifySeverity({ winrateDrop: 0.04 }), 'none')
  })

  it('scoreDrop takes precedence over winrateDrop', () => {
    assert.strictEqual(classifySeverity({ scoreDrop: 5.0, winrateDrop: 0.01 }), 'major')
  })

  it('respects custom passRule thresholds', () => {
    assert.strictEqual(
      classifySeverity({ scoreDrop: 3.0, passRule: { scoreDropThreshold: 1.0, requireNoSevereBadMove: true, compareWithReference: false } }),
      'minor',
    )
  })
})

// --- evaluateMove ---

describe('evaluationRules.evaluateMove', () => {
  it('creates pending evaluation when no analysis results', () => {
    const result = evaluateMove({ move: 'D4', moveIndex: 0 })
    assert.strictEqual(result.status, 'pending')
    assert.strictEqual(result.move, 'D4')
    assert.strictEqual(result.moveIndex, 0)
    assert.strictEqual(result.scoreDrop, undefined)
  })

  it('creates evaluated evaluation with score drops', () => {
    const result = evaluateMove({
      beforeEval: { positionKey: 'before', scoreLead: 5.0, winrate: 0.6, candidateMoves: [] },
      afterEval: { positionKey: 'after', scoreLead: 1.0, winrate: 0.5, candidateMoves: [] },
      move: 'D4',
      moveIndex: 3,
    })
    assert.strictEqual(result.status, 'evaluated')
    assert.strictEqual(result.scoreDrop, 4.0)
    assert.strictEqual(result.beforeScoreLead, 5.0)
    assert.strictEqual(result.afterScoreLead, 1.0)
    assert.strictEqual(result.beforeWinrate, 0.6)
    assert.strictEqual(result.afterWinrate, 0.5)
  })

  it('extracts engine suggested move from beforeEval candidates', () => {
    const result = evaluateMove({
      beforeEval: {
        positionKey: 'before',
        scoreLead: 5.0,
        candidateMoves: [{ move: 'Q16', scoreLead: 5.0, pv: ['Q16', 'D4'] }],
      },
      move: 'D4',
      moveIndex: 0,
    })
    assert.strictEqual(result.engineSuggestedMove, 'Q16')
    assert.deepStrictEqual(result.engineSuggestedLine, ['Q16', 'D4'])
  })

  it('generates a unique id', () => {
    const a = evaluateMove({ move: 'D4', moveIndex: 0 })
    const b = evaluateMove({ move: 'Q16', moveIndex: 1 })
    assert.notStrictEqual(a.id, b.id)
  })
})

// --- evaluateAttempt ---

describe('evaluationRules.evaluateAttempt', () => {
  it('returns "abandoned" if attempt is abandoned', () => {
    const result = evaluateAttempt({
      attempt: makeAttempt({ status: 'abandoned' }),
      moveEvaluations: [],
      badMoves: [],
    })
    assert.strictEqual(result, 'abandoned')
  })

  it('returns "pending" if any evaluation is still pending', () => {
    const result = evaluateAttempt({
      attempt: makeAttempt(),
      moveEvaluations: [makeEval({ status: 'pending' })],
      badMoves: [],
    })
    assert.strictEqual(result, 'pending')
  })

  it('returns "pass" when no bad moves', () => {
    const result = evaluateAttempt({
      attempt: makeAttempt(),
      moveEvaluations: [makeEval({ status: 'evaluated' })],
      badMoves: [],
    })
    assert.strictEqual(result, 'pass')
  })

  it('returns "soft_pass" when only minor bad moves', () => {
    const result = evaluateAttempt({
      attempt: makeAttempt(),
      moveEvaluations: [makeEval({ status: 'evaluated' })],
      badMoves: [makeBadMove({ severity: 'minor' })],
    })
    assert.strictEqual(result, 'soft_pass')
  })

  it('returns "soft_pass" when major bad moves', () => {
    const result = evaluateAttempt({
      attempt: makeAttempt(),
      moveEvaluations: [makeEval({ status: 'evaluated' })],
      badMoves: [makeBadMove({ severity: 'major' })],
    })
    assert.strictEqual(result, 'soft_pass')
  })

  it('returns "fail" when severe bad moves (no passRule)', () => {
    const result = evaluateAttempt({
      attempt: makeAttempt(),
      moveEvaluations: [makeEval({ status: 'evaluated' })],
      badMoves: [makeBadMove({ severity: 'severe' })],
    })
    assert.strictEqual(result, 'fail')
  })

  it('returns "fail" when maxBadMoveCount exceeded', () => {
    const result = evaluateAttempt({
      attempt: makeAttempt(),
      moveEvaluations: [makeEval({ status: 'evaluated' })],
      badMoves: [makeBadMove({ severity: 'minor' }), makeBadMove({ severity: 'minor' })],
      problem: {
        id: 'p1',
        type: 'best_move',
        positionSgf: '(;SZ[9])',
        sideToMove: 'black',
        positionDescription: '',
        taskGoal: '',
        referenceLines: [],
        passRule: { maxBadMoveCount: 1, requireNoSevereBadMove: false, compareWithReference: false },
        tags: [],
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    })
    assert.strictEqual(result, 'fail')
  })

  it('returns "fail" when requireNoSevereBadMove and severe exists', () => {
    const result = evaluateAttempt({
      attempt: makeAttempt(),
      moveEvaluations: [makeEval({ status: 'evaluated' })],
      badMoves: [makeBadMove({ severity: 'severe' })],
      problem: {
        id: 'p1',
        type: 'best_move',
        positionSgf: '(;SZ[9])',
        sideToMove: 'black',
        positionDescription: '',
        taskGoal: '',
        referenceLines: [],
        passRule: { requireNoSevereBadMove: true, compareWithReference: false },
        tags: [],
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    })
    assert.strictEqual(result, 'fail')
  })
})

// --- shouldCreateBadMove ---

describe('evaluationRules.shouldCreateBadMove', () => {
  it('returns false for "none"', () => {
    assert.strictEqual(shouldCreateBadMove('none'), false)
  })

  it('returns true for actual severities', () => {
    assert.strictEqual(shouldCreateBadMove('minor'), true)
    assert.strictEqual(shouldCreateBadMove('major'), true)
    assert.strictEqual(shouldCreateBadMove('severe'), true)
  })
})
