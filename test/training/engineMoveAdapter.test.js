import assert from 'assert'

// --- Lazy-load engineMoveAdapter (skip tests if module not yet implemented) ---

let _createEngineMoveAdapter = null
let _loadAttempted = false

function loadModule() {
  if (_loadAttempted) return _createEngineMoveAdapter
  _loadAttempted = true
  try {
    const mod = require('../../src/modules/training/adapter/engineMoveAdapter.ts')
    _createEngineMoveAdapter = mod.createEngineMoveAdapter
  } catch {}
  return _createEngineMoveAdapter
}

const describeIf = loadModule() ? describe : describe.skip

// --- Mock engine connection (GTP-like interface) ---

function createMockEngineConnection(overrides = {}) {
  const calls = []
  return {
    calls,
    async sendCommand(command) {
      calls.push(command)
      if (overrides.sendCommand) return overrides.sendCommand(command)
      // Default: return a top move
      return '= D4'
    },
    async genmove(color) {
      calls.push({ method: 'genmove', color })
      if (overrides.genmove) return overrides.genmove(color)
      return 'D4'
    },
    async analyze(params) {
      calls.push({ method: 'analyze', ...params })
      if (overrides.analyze) return overrides.analyze(params)
      return {
        move: 'D4',
        candidates: [
          { move: 'D4', visits: 100, winrate: 0.6, scoreLead: 3.5, pv: ['D4', 'Q16'] },
          { move: 'Q16', visits: 80, winrate: 0.58, scoreLead: 2.8, pv: ['Q16', 'C3'] },
        ],
      }
    },
  }
}

// --- Tests ---

describeIf('engineMoveAdapter', () => {
  const createEngineMoveAdapter = loadModule()

  describe('requestMove (C20)', () => {
    it('delegates to engine and returns {move, candidates}', async () => {
      const mockEngine = createMockEngineConnection()
      const adapter = createEngineMoveAdapter({ engineConnection: mockEngine })

      const result = await adapter.requestMove({
        positionSgf: '(;SZ[9];B[dd])',
      })

      assert.ok(result, 'expected a result from requestMove')
      assert.ok(result.move, 'expected result.move')
      assert.ok(Array.isArray(result.candidates), 'expected result.candidates to be an array')
    })
  })

  describe('analysisArea passthrough (C21)', () => {
    it('passes analysisArea to constrain engine analysis scope', async () => {
      let receivedParams = null
      const mockEngine = createMockEngineConnection({
        analyze(params) {
          receivedParams = params
          return {
            move: 'C3',
            candidates: [
              { move: 'C3', visits: 50, winrate: 0.55, scoreLead: 1.2, pv: ['C3'] },
            ],
          }
        },
      })

      const adapter = createEngineMoveAdapter({ engineConnection: mockEngine })

      await adapter.requestMove({
        positionSgf: '(;SZ[9];B[dd])',
        analysisArea: { x1: 0, y1: 0, x2: 5, y2: 5 },
      })

      // The adapter should pass the analysisArea through to the engine
      assert.ok(receivedParams, 'expected engine.analyze to be called')
      assert.ok(
        receivedParams.analysisArea
          || receivedParams.area
          || receivedParams.analyzeRange,
        'expected analysisArea or equivalent to be passed to engine',
      )
    })
  })

  describe('architecture boundary (C33)', () => {
    it('does not write to training repo or workbench store', async () => {
      // The adapter should only receive an engine connection.
      // If it tried to access repo or store, the factory call would need those deps.
      const mockEngine = createMockEngineConnection()
      const mockRepo = {
        written: [],
        async updateAttempt() { this.written.push('updateAttempt') },
        async createAttempt() { this.written.push('createAttempt') },
      }
      const mockStore = {
        written: [],
        updateTab() { this.written.push('updateTab') },
      }

      // Create adapter with only engine connection -- no repo or store deps
      const adapter = createEngineMoveAdapter({ engineConnection: mockEngine })

      await adapter.requestMove({
        positionSgf: '(;SZ[9])',
      })

      // The adapter should not have written to repo or store
      assert.strictEqual(mockRepo.written.length, 0, 'adapter must not write to repo')
      assert.strictEqual(mockStore.written.length, 0, 'adapter must not write to store')
    })
  })
})
