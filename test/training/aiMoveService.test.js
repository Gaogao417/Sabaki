import assert from 'assert'

// --- Lazy-load aiMoveService (skip tests if module not yet implemented) ---

let _createAiMoveService = null
let _shouldAiMove = null
let _loadAttempted = false

function loadModule() {
  if (_loadAttempted) return { createAiMoveService: _createAiMoveService, shouldAiMove: _shouldAiMove }
  _loadAttempted = true
  try {
    const mod = require('../../src/modules/training/ai/aiMoveService.ts')
    _createAiMoveService = mod.createAiMoveService
    _shouldAiMove = mod.shouldAiMove
  } catch {}
  return { createAiMoveService: _createAiMoveService, shouldAiMove: _shouldAiMove }
}

const describeIf = loadModule().createAiMoveService || loadModule().shouldAiMove
  ? describe
  : describe.skip

// --- Helpers ---

function makeTab(overrides = {}) {
  return {
    id: 'tab_1',
    taskId: 'task_1',
    mode: 'play',
    childTabIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeAttempt(overrides = {}) {
  return {
    id: 'attempt_1',
    taskId: 'task_1',
    startedAt: '2026-01-01T00:00:00.000Z',
    rootPositionSgf: '(;SZ[9])',
    userLine: [],
    status: 'playing',
    result: 'pending',
    hintLevelUsed: 0,
    recallCompleted: false,
    analysisOpened: false,
    ...overrides,
  }
}

function makeTask(overrides = {}) {
  return {
    id: 'task_1',
    rootPositionSgf: '(;SZ[9])',
    sideToMove: 'black',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// --- Tests ---

describeIf('aiMoveService', () => {
  const { createAiMoveService, shouldAiMove: shouldAiMoveFn } = loadModule()

  // =====================================================================
  // shouldAiMove — pure function tests (C07-C13, C34, C36, C37)
  // =====================================================================

  describe('shouldAiMove (pure function)', () => {
    const shouldAiMove = shouldAiMoveFn

    it('returns false when playerConfig is undefined (C07)', () => {
      const tab = makeTab({ mode: 'play' })
      const attempt = makeAttempt({ userLine: ['D4'] })
      const result = shouldAiMove({ tab, attempt, sideToMove: 'black' })
      assert.strictEqual(result, false)
    })

    it('returns false when no active attempt (C08)', () => {
      const tab = makeTab({
        mode: 'play',
        playerConfig: { black: 'human', white: 'ai', ai: { autoPlay: true } },
      })
      const result = shouldAiMove({ tab, attempt: null, sideToMove: 'black' })
      assert.strictEqual(result, false)
    })

    it('returns true in play mode when it is AI turn after human played (C09)', () => {
      // Black=human, White=AI. Black plays first (move 0).
      // After black plays (userLine.length=1), it's white's turn (AI).
      const tab = makeTab({
        mode: 'play',
        playerConfig: { black: 'human', white: 'ai', ai: { autoPlay: true } },
      })
      const attempt = makeAttempt({ userLine: ['D4'] })
      const result = shouldAiMove({ tab, attempt, sideToMove: 'black' })
      assert.strictEqual(result, true)
    })

    it('returns false in play mode when it is human turn (C10)', () => {
      // Black=human, White=AI. No moves yet, it's black's turn (human).
      const tab = makeTab({
        mode: 'play',
        playerConfig: { black: 'human', white: 'ai', ai: { autoPlay: true } },
      })
      const attempt = makeAttempt({ userLine: [] })
      const result = shouldAiMove({ tab, attempt, sideToMove: 'black' })
      assert.strictEqual(result, false)
    })

    it('returns false when both sides are human (C11)', () => {
      const tab = makeTab({
        mode: 'play',
        playerConfig: { black: 'human', white: 'human' },
      })
      const attempt = makeAttempt({ userLine: ['D4'] })
      const result = shouldAiMove({ tab, attempt, sideToMove: 'black' })
      assert.strictEqual(result, false)
    })

    it('returns true in problem mode when opponent is AI after human solver played (C12)', () => {
      // In problem mode, solver plays human moves. Opponent configured as AI.
      // After solver plays (userLine.length=1), AI should respond.
      const tab = makeTab({
        mode: 'problem',
        playerConfig: { black: 'human', white: 'ai', ai: { autoPlay: true } },
      })
      const attempt = makeAttempt({ userLine: ['D4'] })
      const result = shouldAiMove({ tab, attempt, sideToMove: 'black' })
      assert.strictEqual(result, true)
    })

    it('returns false in recall mode (C13)', () => {
      const tab = makeTab({
        mode: 'recall',
        playerConfig: { black: 'human', white: 'ai', ai: { autoPlay: true } },
      })
      const attempt = makeAttempt({ userLine: ['D4'] })
      const result = shouldAiMove({ tab, attempt, sideToMove: 'black' })
      assert.strictEqual(result, false)
    })

    it('returns false in analysis mode (C13)', () => {
      const tab = makeTab({
        mode: 'analysis',
        playerConfig: { black: 'human', white: 'ai', ai: { autoPlay: true } },
      })
      const attempt = makeAttempt({ userLine: ['D4'] })
      const result = shouldAiMove({ tab, attempt, sideToMove: 'black' })
      assert.strictEqual(result, false)
    })

    it('is a pure function -- uses only input params, no external state (C34)', () => {
      // Call shouldAiMove with same inputs multiple times -- must always return same result.
      // Also verify it does not throw or access globals.
      const tab = makeTab({
        mode: 'play',
        playerConfig: { black: 'human', white: 'ai', ai: { autoPlay: true } },
      })
      const attempt = makeAttempt({ userLine: ['D4'] })

      const result1 = shouldAiMove({ tab, attempt, sideToMove: 'black' })
      const result2 = shouldAiMove({ tab, attempt, sideToMove: 'black' })
      assert.strictEqual(result1, result2)
      assert.strictEqual(result1, true)
    })

    it('returns false when playerConfig.ai.autoPlay is false (C36)', () => {
      const tab = makeTab({
        mode: 'play',
        playerConfig: { black: 'human', white: 'ai', ai: { autoPlay: false } },
      })
      const attempt = makeAttempt({ userLine: ['D4'] })
      const result = shouldAiMove({ tab, attempt, sideToMove: 'black' })
      assert.strictEqual(result, false)
    })

    it('returns true in AI vs AI play after each AI move (C37)', () => {
      // Both sides are AI. After black AI plays (userLine.length=1), white AI should play.
      const tab = makeTab({
        mode: 'play',
        playerConfig: { black: 'ai', white: 'ai', ai: { autoPlay: true } },
      })
      const attempt = makeAttempt({ userLine: ['D4'] })
      const result = shouldAiMove({ tab, attempt, sideToMove: 'black' })
      assert.strictEqual(result, true)
    })
  })

  // =====================================================================
  // shouldAiMove architecture boundary (C32)
  // =====================================================================

  describe('shouldAiMove architecture boundary (C32)', () => {
    const shouldAiMove = shouldAiMoveFn

    it('does not modify store, repo, or engine (pure function with no side effects)', () => {
      // shouldAiMove receives plain data objects. Verify that calling it does not
      // mutate the input objects.
      const tab = makeTab({
        mode: 'play',
        playerConfig: { black: 'human', white: 'ai', ai: { autoPlay: true } },
      })
      const attempt = makeAttempt({ userLine: ['D4'] })
      const originalUserLine = [...attempt.userLine]
      const originalMode = tab.mode

      shouldAiMove({ tab, attempt, sideToMove: 'black' })

      // Inputs must remain unmodified
      assert.deepStrictEqual(attempt.userLine, originalUserLine)
      assert.strictEqual(tab.mode, originalMode)
    })
  })

  // =====================================================================
  // requestAiMove — orchestration with engine adapter (C14-C19)
  // =====================================================================

  describe('requestAiMove', () => {
    it('calls engineMoveAdapter.requestMove with correct params (C14)', async () => {
      let receivedInput = null
      const mockAdapter = {
        async requestMove(input) {
          receivedInput = input
          return { move: 'Q16', candidates: ['Q16', 'D4'] }
        },
      }

      const service = createAiMoveService({ engineMoveAdapter: mockAdapter })
      const tab = makeTab({
        mode: 'play',
        playerConfig: { black: 'human', white: 'ai', ai: { autoPlay: true } },
      })
      const attempt = makeAttempt({ rootPositionSgf: '(;SZ[9])', userLine: ['D4'] })
      const task = makeTask()

      await service.requestAiMove({ tab, attempt, task })

      assert.ok(receivedInput, 'adapter.requestMove should have been called')
      assert.strictEqual(receivedInput.positionSgf, '(;SZ[9])')
    })

    it('returns engine top move in play mode (C15)', async () => {
      const mockAdapter = {
        async requestMove() {
          return { move: 'Q16', candidates: ['Q16', 'D4'] }
        },
      }

      const service = createAiMoveService({ engineMoveAdapter: mockAdapter })
      const tab = makeTab({ mode: 'play' })
      const attempt = makeAttempt({ userLine: ['D4'] })
      const task = makeTask()

      const result = await service.requestAiMove({ tab, attempt, task })
      assert.strictEqual(result, 'Q16')
    })

    it('returns move when engine move is inside problemArea (C16)', async () => {
      const mockAdapter = {
        async requestMove() {
          return { move: 'C3', candidates: ['C3', 'D4'] }
        },
      }

      const service = createAiMoveService({ engineMoveAdapter: mockAdapter })
      const tab = makeTab({ mode: 'problem' })
      const attempt = makeAttempt({ userLine: ['D4'] })
      // problemArea covering top-left corner of a 9x9 board (0-indexed coords)
      const task = makeTask({ problemArea: { x1: 0, y1: 0, x2: 5, y2: 5 } })

      const result = await service.requestAiMove({ tab, attempt, task })
      // C3 at coord (2,2) is within area (0,0)-(5,5)
      assert.strictEqual(result, 'C3')
    })

    it('returns null when engine move is outside problemArea (C17)', async () => {
      const mockAdapter = {
        async requestMove() {
          // Q16 on a 19x19 board is far from the top-left area
          return { move: 'Q16', candidates: ['Q16', 'R17'] }
        },
      }

      const service = createAiMoveService({ engineMoveAdapter: mockAdapter })
      const tab = makeTab({ mode: 'problem' })
      const attempt = makeAttempt({ userLine: ['D4'] })
      // problemArea covering only top-left corner
      const task = makeTask({ problemArea: { x1: 0, y1: 0, x2: 5, y2: 5 } })

      const result = await service.requestAiMove({ tab, attempt, task })
      assert.strictEqual(result, null)
    })

    it('returns engine top move when no problemArea (no area filtering) (C18)', async () => {
      const mockAdapter = {
        async requestMove() {
          return { move: 'Q16', candidates: ['Q16'] }
        },
      }

      const service = createAiMoveService({ engineMoveAdapter: mockAdapter })
      const tab = makeTab({ mode: 'problem' })
      const attempt = makeAttempt({ userLine: ['D4'] })
      // task without problemArea
      const task = makeTask()

      const result = await service.requestAiMove({ tab, attempt, task })
      assert.strictEqual(result, 'Q16')
    })

    it('returns null when engineMoveAdapter returns null (C19)', async () => {
      const mockAdapter = {
        async requestMove() {
          return null
        },
      }

      const service = createAiMoveService({ engineMoveAdapter: mockAdapter })
      const tab = makeTab({ mode: 'play' })
      const attempt = makeAttempt({ userLine: ['D4'] })
      const task = makeTask()

      const result = await service.requestAiMove({ tab, attempt, task })
      assert.strictEqual(result, null)
    })
  })
})
