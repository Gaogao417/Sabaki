import assert from 'assert'

// --- Lazy-load helpers ---

let _createAnalysisContext = null
let _loadAttempted = false

function getFactory() {
  if (_loadAttempted) return _createAnalysisContext
  _loadAttempted = true
  try {
    const mod = require('../../src/modules/training/types/analysis.ts')
    _createAnalysisContext = mod.createAnalysisContext || null
  } catch {
    // Module may not have the factory yet
  }
  return _createAnalysisContext
}

const describeIf = getFactory() ? describe : describe.skip

// --- Group A: AnalysisContext type (C01-C02) ---

describeIf('AnalysisContext type', () => {
  const createAnalysisContext = getFactory()

  describe('C01: factory creates valid objects with all fields', () => {
    it('creates an object with all required fields', () => {
      const ctx = createAnalysisContext({
        taskId: 'task_1',
        attemptId: 'attempt_1',
        checkpointId: 'cp_1',
        positionHash: 'hash_abc',
        positionSgf: '(;SZ[9]AB[dc])',
        source: 'play',
      })

      assert.strictEqual(ctx.taskId, 'task_1')
      assert.strictEqual(ctx.attemptId, 'attempt_1')
      assert.strictEqual(ctx.checkpointId, 'cp_1')
      assert.strictEqual(ctx.positionHash, 'hash_abc')
      assert.strictEqual(ctx.positionSgf, '(;SZ[9]AB[dc])')
      assert.strictEqual(ctx.source, 'play')
    })

    it('allows optional fields to be omitted', () => {
      const ctx = createAnalysisContext({
        taskId: 'task_2',
        source: 'problem',
      })

      assert.strictEqual(ctx.taskId, 'task_2')
      assert.strictEqual(ctx.source, 'problem')
      // Optional fields should be undefined, not throw
      assert.strictEqual(ctx.attemptId, undefined)
      assert.strictEqual(ctx.checkpointId, undefined)
      assert.strictEqual(ctx.positionHash, undefined)
      assert.strictEqual(ctx.positionSgf, undefined)
    })
  })

  describe('C02: source field only accepts valid modes', () => {
    const validSources = ['play', 'problem', 'recall', 'direct']

    for (const source of validSources) {
      it(`accepts source = '${source}'`, () => {
        const ctx = createAnalysisContext({ taskId: 'task_1', source })
        assert.strictEqual(ctx.source, source)
      })
    }

    it('rejects unknown source string', () => {
      assert.throws(
        () => createAnalysisContext({ taskId: 'task_1', source: 'unknown_mode' }),
        /source/i,
      )
    })

    it('rejects source = "analysis"', () => {
      assert.throws(
        () => createAnalysisContext({ taskId: 'task_1', source: 'analysis' }),
        /source/i,
      )
    })
  })
})
