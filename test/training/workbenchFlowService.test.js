import assert from 'assert'

import {createWorkbenchStore} from '../../src/modules/training/store/workbenchStore.ts'

// --- Helpers ---

function makeTab(overrides = {}) {
  return {
    id: 'tab_1',
    taskId: 'task_1',
    mode: 'play',
    childTabIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeTask(overrides = {}) {
  return {
    id: 'task_1',
    rootPositionSgf: '(;SZ[19])',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function createMockDeps(overrides = {}) {
  const store = createWorkbenchStore()
  const logs = []

  return {
    store,
    logs,
    workbenchStore: store,
    repository: {
      loadTask: async id => overrides.tasks?.[id] ?? makeTask({id}),
      createTask: async t => t,
      transaction: async fn => fn(),
      createRecallSession: async s => ({...s, id: 'rs_1'}),
      ...overrides.repository,
    },
    attemptService: {
      createAttempt: async input => ({id: 'attempt_1', ...input}),
      freezeAttempt: async () => {},
      ...overrides.attemptService,
    },
    recallService: {
      createRecallSession: async input => ({id: 'rs_1', ...input}),
      ...overrides.recallService,
    },
    snapshotService: {
      captureSnapshotInput: async input => ({
        sourceTaskId: input?.sourceTaskId ?? 'task_1',
        positionSgf: '(;SZ[9]AB[dc])',
        sideToMove: 'black',
      }),
      ...overrides.snapshotService,
    },
    tabService: {
      openTask: async opts => ({
        id: 'tab_snap_1',
        taskId: 'task_snap_1',
        mode: 'problem',
        parentTabId: opts?.parentTabId,
        childTabIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      ...overrides.tabService,
    },
    logger: {
      info(channel, message, data) {
        logs.push({channel, message, data})
      },
    },
  }
}

// Lazy-load the module; return null if not yet implemented.
let _createWorkbenchFlowService = null
let _loadAttempted = false

function getFlowServiceFactory() {
  if (_loadAttempted) return _createWorkbenchFlowService
  _loadAttempted = true
  try {
    // Dynamic import is not available in CJS/mocha without top-level await.
    // Use require via tsx instead.
    const mod = require('../../src/modules/training/workbench/workbenchFlowService.ts')
    _createWorkbenchFlowService = mod.createWorkbenchFlowService
  } catch {
    // Module doesn't exist yet — tests serve as spec.
  }
  return _createWorkbenchFlowService
}

// Skip all tests if module not yet implemented.
const describeIf = getFlowServiceFactory() ? describe : describe.skip

// --- Tests ---

describeIf('workbenchFlowService', () => {
  const createWorkbenchFlowService = getFlowServiceFactory()

  describe('submit — play/problem → recall', () => {
    it('transitions play mode tab to recall', () => {
      const deps = createMockDeps()
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'play'}))

      service.submit('tab_1')

      const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
      assert.strictEqual(tab.mode, 'recall')
    })

    it('transitions problem mode tab to recall', () => {
      const deps = createMockDeps()
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'problem'}))

      service.submit('tab_1')

      const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
      assert.strictEqual(tab.mode, 'recall')
    })

    it('freezes attempt before creating recall session', async () => {
      const order = []
      const deps = createMockDeps({
        attemptService: {
          freezeAttempt: async id => { order.push('freeze') },
        },
        recallService: {
          createRecallSession: async input => { order.push('recall'); return {id: 'rs_1'} },
        },
      })
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'play', activeAttemptId: 'att_1'}))

      await service.submit('tab_1')

      assert.deepStrictEqual(order, ['freeze', 'recall'])
    })

    it('sets activeRecallSessionId on tab', async () => {
      const deps = createMockDeps()
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'play', activeAttemptId: 'att_1'}))

      await service.submit('tab_1')

      const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
      assert.ok(tab.activeRecallSessionId)
    })
  })

  // --- Phase 3: enhanced submit with evaluation flow (C22-C31, C38, C39) ---

  describe('submit — evaluation and finalization (C22-C31, C38, C39)', () => {
    function createEvalMockDeps(overrides = {}) {
      const frozenAttempts = {}
      const finalizedResults = {}
      const createdRecallSessions = []
      const logs = []

      return {
        frozenAttempts,
        finalizedResults,
        createdRecallSessions,
        logs,
        store: createWorkbenchStore(),
        workbenchStore: undefined, // set below
        repository: {
          loadTask: async id => overrides.tasks?.[id] ?? makeTask({id}),
          createTask: async t => t,
          transaction: async fn => fn(),
          async listMoveEvaluationsByAttempt(attemptId) {
            return overrides.evaluations ?? []
          },
          async listBadMovesByAttempt(attemptId) {
            return overrides.badMoves ?? []
          },
          async updateAttempt(id, patch) {
            if (patch.status === 'submitted') {
              frozenAttempts[id] = true
            }
            if (patch.result) {
              finalizedResults[id] = patch.result
            }
          },
          ...overrides.repository,
        },
        attemptService: {
          createAttempt: async input => ({id: 'attempt_1', ...input}),
          async freezeAttempt(attemptId) {
            frozenAttempts[attemptId] = true
          },
          async finalizeAttemptResult(attemptId, result) {
            finalizedResults[attemptId] = result
          },
          ...overrides.attemptService,
        },
        recallService: {
          async createRecallSession(input) {
            createdRecallSessions.push({...input})
            return {id: 'rs_1', ...input}
          },
          ...overrides.recallService,
        },
        evaluationRules: {
          evaluateAttempt: overrides.evaluateAttempt ?? (() => 'pass'),
        },
        snapshotService: {
          captureSnapshotInput: async input => ({
            sourceTaskId: input?.sourceTaskId ?? 'task_1',
            positionSgf: '(;SZ[9]AB[dc])',
            sideToMove: 'black',
          }),
        },
        tabService: {
          openTask: async opts => ({
            id: 'tab_snap_1',
            taskId: 'task_snap_1',
            mode: 'problem',
            parentTabId: opts?.parentTabId,
            childTabIds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        },
        runtimeStore: overrides.runtimeStore,
        logger: {
          info(channel, message, data) {
            logs.push({channel, message, data})
          },
        },
      }
    }

    it('submit full flow: status submitted, result finalized, recall created, tab mode recall (C22)', async () => {
      const deps = createEvalMockDeps()
      deps.workbenchStore = deps.store
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'play', activeAttemptId: 'att_1'}))

      await service.submit('tab_1')

      const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
      assert.strictEqual(tab.mode, 'recall')
      assert.ok(deps.frozenAttempts['att_1'], 'attempt should be frozen')
      assert.ok(deps.createdRecallSessions.length >= 1, 'recall session should be created')
    })

    it('submit sets attempt status to submitted (C23)', async () => {
      let frozenStatus = null
      const deps = createEvalMockDeps({
        attemptService: {
          async freezeAttempt(attemptId) {
            frozenStatus = 'submitted'
          },
          async finalizeAttemptResult() {},
        },
      })
      deps.workbenchStore = deps.store
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'play', activeAttemptId: 'att_1'}))

      await service.submit('tab_1')

      assert.strictEqual(frozenStatus, 'submitted')
    })

    it('submit determines result from evaluation data (C24)', async () => {
      let receivedResult = null
      const deps = createEvalMockDeps({
        evaluateAttempt: () => 'soft_pass',
        attemptService: {
          async freezeAttempt() {},
          async finalizeAttemptResult(attemptId, result) {
            receivedResult = result
          },
        },
      })
      deps.workbenchStore = deps.store
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'play', activeAttemptId: 'att_1'}))

      await service.submit('tab_1')

      assert.strictEqual(receivedResult, 'soft_pass')
    })

    it('submit creates recall session with attemptId pointing to frozen attempt (C25)', async () => {
      const deps = createEvalMockDeps()
      deps.workbenchStore = deps.store
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'play', activeAttemptId: 'att_1'}))

      await service.submit('tab_1')

      assert.ok(deps.createdRecallSessions.length >= 1)
      const session = deps.createdRecallSessions[0]
      assert.strictEqual(session.attemptId, 'att_1')
    })

    it('submit sets tab.activeRecallSessionId (C26)', async () => {
      const deps = createEvalMockDeps()
      deps.workbenchStore = deps.store
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'play', activeAttemptId: 'att_1'}))

      await service.submit('tab_1')

      const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
      assert.ok(tab.activeRecallSessionId)
    })

    it('submit is no-op when activeAttemptId is not set (C27)', async () => {
      const deps = createEvalMockDeps()
      deps.workbenchStore = deps.store
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'play'}))

      // Should not throw -- mode transition still happens
      await service.submit('tab_1')

      const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
      assert.strictEqual(tab.mode, 'recall')
      assert.strictEqual(deps.createdRecallSessions.length, 0, 'no recall session without attempt')
    })

    it('submit finalizes pass when no bad moves (C28)', async () => {
      let receivedResult = null
      const deps = createEvalMockDeps({
        evaluateAttempt: () => 'pass',
        badMoves: [],
        attemptService: {
          async freezeAttempt() {},
          async finalizeAttemptResult(attemptId, result) {
            receivedResult = result
          },
        },
      })
      deps.workbenchStore = deps.store
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'play', activeAttemptId: 'att_1'}))

      await service.submit('tab_1')

      assert.strictEqual(receivedResult, 'pass')
    })

    it('submit finalizes fail when severe bad moves (C29)', async () => {
      let receivedResult = null
      const deps = createEvalMockDeps({
        evaluateAttempt: () => 'fail',
        attemptService: {
          async freezeAttempt() {},
          async finalizeAttemptResult(attemptId, result) {
            receivedResult = result
          },
        },
      })
      deps.workbenchStore = deps.store
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'play', activeAttemptId: 'att_1'}))

      await service.submit('tab_1')

      assert.strictEqual(receivedResult, 'fail')
    })

    it('submit finalizes soft_pass when only minor bad moves (C30)', async () => {
      let receivedResult = null
      const deps = createEvalMockDeps({
        evaluateAttempt: () => 'soft_pass',
        attemptService: {
          async freezeAttempt() {},
          async finalizeAttemptResult(attemptId, result) {
            receivedResult = result
          },
        },
      })
      deps.workbenchStore = deps.store
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'play', activeAttemptId: 'att_1'}))

      await service.submit('tab_1')

      assert.strictEqual(receivedResult, 'soft_pass')
    })

    it('submit clears problemView and activates recall in runtime store (C31)', async () => {
      const { createTrainingRuntimeStore } = require('../../src/modules/training/store/trainingRuntimeStore.ts')
      const runtimeStore = createTrainingRuntimeStore()
      runtimeStore.setProblemView({
        taskId: 'task_1',
        attemptId: 'att_1',
        evalCache: [],
        badMoves: [],
        submitted: false,
        result: null,
        legacyProblemSession: null,
      })

      const deps = createEvalMockDeps({ runtimeStore })
      deps.workbenchStore = deps.store
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'play', activeAttemptId: 'att_1'}))

      await service.submit('tab_1')

      assert.strictEqual(runtimeStore.getState().problemView, null, 'problemView should be cleared')
      assert.ok(runtimeStore.getState().activeRecallSessionId, 'activeRecallSessionId should be set')
    })

    it('submit writes attempt result to persistence (C38)', async () => {
      const persistedResults = {}
      const deps = createEvalMockDeps({
        evaluateAttempt: () => 'pass',
        attemptService: {
          async freezeAttempt() {},
          async finalizeAttemptResult(attemptId, result) {
            persistedResults[attemptId] = result
          },
        },
      })
      deps.workbenchStore = deps.store
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'play', activeAttemptId: 'att_1'}))

      await service.submit('tab_1')

      assert.strictEqual(persistedResults['att_1'], 'pass')
    })

    it('submit ordering: freeze before recall creation (C39)', async () => {
      let freezeCalled = false
      let recallCreatedBeforeFreeze = false

      const deps = createEvalMockDeps({
        attemptService: {
          async freezeAttempt() {
            freezeCalled = true
          },
          async finalizeAttemptResult() {},
        },
        recallService: {
          async createRecallSession(input) {
            if (!freezeCalled) {
              recallCreatedBeforeFreeze = true
            }
            return {id: 'rs_1', ...input}
          },
        },
      })
      deps.workbenchStore = deps.store
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'play', activeAttemptId: 'att_1'}))

      await service.submit('tab_1')

      assert.strictEqual(recallCreatedBeforeFreeze, false, 'recall must not be created before freeze')
      assert.strictEqual(freezeCalled, true, 'freeze must have been called')
    })
  })

  describe('enterAnalysis — any mode → analysis', () => {
    const sourceModes = ['play', 'problem', 'recall']

    for (const from of sourceModes) {
      it(`transitions from ${from} to analysis`, () => {
        const deps = createMockDeps()
        const service = createWorkbenchFlowService(deps)
        deps.store.addTab(makeTab({id: 'tab_1', mode: from}))

        service.enterAnalysis('tab_1')

        const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
        assert.strictEqual(tab.mode, 'analysis')
      })
    }

    it('stores previous mode so returnFromAnalysis can restore it', () => {
      const deps = createMockDeps()
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'problem'}))

      service.enterAnalysis('tab_1')

      const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
      assert.strictEqual(tab.previousMode, 'problem')
    })
  })

  describe('returnFromAnalysis — analysis → previous mode', () => {
    it('restores mode to the specified toMode', () => {
      const deps = createMockDeps()
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'analysis', previousMode: 'recall'}))

      service.returnFromAnalysis('tab_1', 'recall')

      const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
      assert.strictEqual(tab.mode, 'recall')
    })

    it('clears previousMode', () => {
      const deps = createMockDeps()
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'analysis', previousMode: 'play'}))

      service.returnFromAnalysis('tab_1', 'play')

      const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
      assert.strictEqual(tab.previousMode, undefined)
    })
  })

  describe('completeRecall — recall → analysis or end', () => {
    it('transitions recall to analysis', () => {
      const deps = createMockDeps()
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'recall'}))

      service.completeRecall('tab_1')

      const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
      assert.strictEqual(tab.mode, 'analysis')
    })
  })

  describe('restartAttempt — reset to play/problem', () => {
    it('resets mode to play from recall', () => {
      const deps = createMockDeps()
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'recall', previousMode: 'play'}))

      service.restartAttempt('tab_1')

      const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
      assert.strictEqual(tab.mode, 'play')
    })

    it('resets mode to problem from analysis', () => {
      const deps = createMockDeps()
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'analysis', previousMode: 'problem'}))

      service.restartAttempt('tab_1')

      const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
      assert.strictEqual(tab.mode, 'problem')
    })
  })

  describe('snapshotFromCurrentContext — any mode → new tab', () => {
    const allModes = ['play', 'problem', 'recall', 'analysis']

    for (const mode of allModes) {
      it(`works from ${mode} mode, original tab unchanged`, async () => {
        const deps = createMockDeps()
        const service = createWorkbenchFlowService(deps)
        deps.store.addTab(makeTab({id: 'tab_1', mode}))

        await service.snapshotFromCurrentContext('tab_1')

        const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
        assert.strictEqual(tab.mode, mode)
      })
    }

    it('creates a new child tab', async () => {
      const deps = createMockDeps()
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'play'}))

      const newTab = await service.snapshotFromCurrentContext('tab_1')

      assert.ok(newTab)
      assert.strictEqual(newTab.parentTabId, 'tab_1')
    })
  })

  describe('startAttempt', () => {
    it('creates attempt and sets activeAttemptId on tab', async () => {
      const deps = createMockDeps()
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'play'}))

      await service.startAttempt('tab_1')

      const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
      assert.strictEqual(tab.activeAttemptId, 'attempt_1')
    })
  })

  describe('invalid transitions', () => {
    const invalidCases = [
      {from: 'recall', method: 'submit'},
      {from: 'analysis', method: 'submit'},
      {from: 'analysis', method: 'completeRecall'},
      {from: 'play', method: 'returnFromAnalysis'},
      {from: 'problem', method: 'returnFromAnalysis'},
      {from: 'recall', method: 'returnFromAnalysis'},
      {from: 'analysis', method: 'enterAnalysis'},
    ]

    for (const {from, method} of invalidCases) {
      it(`${method} from ${from} is rejected`, () => {
        const deps = createMockDeps()
        const service = createWorkbenchFlowService(deps)
        deps.store.addTab(makeTab({id: 'tab_1', mode: from}))

        assert.throws(
          () => service[method]('tab_1'),
        )
      })
    }

    it('rejected transition does not modify tab mode', () => {
      const deps = createMockDeps()
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'recall'}))

      try { service.submit('tab_1') } catch {}

      const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
      assert.strictEqual(tab.mode, 'recall')
    })
  })

  describe('play and problem share same transitions', () => {
    const sharedTransitions = ['submit', 'enterAnalysis']

    for (const mode of ['play', 'problem']) {
      for (const method of sharedTransitions) {
        it(`${method} is valid from ${mode}`, () => {
          const deps = createMockDeps()
          const service = createWorkbenchFlowService(deps)
          deps.store.addTab(makeTab({id: 'tab_1', mode}))

          // Should not throw
          service[method]('tab_1')
        })
      }
    }
  })

  describe('tab updatedAt changes after transition', () => {
    it('updates updatedAt after submit', () => {
      const deps = createMockDeps()
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({
        id: 'tab_1',
        mode: 'play',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }))

      service.submit('tab_1')

      const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
      assert.notStrictEqual(tab.updatedAt, '2026-01-01T00:00:00.000Z')
    })
  })

  describe('logging', () => {
    it('logs rejected transitions when logger provided', () => {
      const deps = createMockDeps()
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'recall'}))

      try { service.submit('tab_1') } catch {}

      assert.ok(deps.logs.length >= 1)
      assert.ok(deps.logs.some(l => l.channel.includes('reject') || l.channel.includes('invalid')))
    })
  })

  describe('nonexistent tab', () => {
    it('throws on submit with nonexistent tab', () => {
      const deps = createMockDeps()
      const service = createWorkbenchFlowService(deps)

      assert.throws(
        () => service.submit('no_such_tab'),
        /tab not found/,
      )
    })
  })
})

// --- Pure logic: inferDefaultMode ---

let _inferDefaultMode = null
let _inferLoadAttempted = false

function getInferDefaultMode() {
  if (_inferLoadAttempted) return _inferDefaultMode
  _inferLoadAttempted = true
  try {
    const mod = require('../../src/modules/training/workbench/workbenchTabService.ts')
    _inferDefaultMode = mod.inferDefaultMode
  } catch {}
  if (!_inferDefaultMode) {
    try {
      const mod = require('../../src/modules/training/workbench/workbenchUiPolicy.ts')
      _inferDefaultMode = mod.inferDefaultMode
    } catch {}
  }
  return _inferDefaultMode
}

const describeInfer = getInferDefaultMode() ? describe : describe.skip

describeInfer('inferDefaultMode (pure logic)', () => {
  const inferDefaultMode = getInferDefaultMode()

  it('returns "problem" for task with prompt', () => {
    assert.strictEqual(inferDefaultMode(makeTask({prompt: 'Find the best move'})), 'problem')
  })

  it('returns "problem" for task with goal', () => {
    assert.strictEqual(inferDefaultMode(makeTask({goal: 'Kill the group'})), 'problem')
  })

  it('returns "problem" for task with passRule', () => {
    assert.strictEqual(inferDefaultMode(makeTask({passRule: {allowed: false}})), 'problem')
  })

  it('returns "problem" for task with referenceLines', () => {
    assert.strictEqual(inferDefaultMode(makeTask({referenceLines: [{moves: []}]})), 'problem')
  })

  it('returns "play" for task with no problem-indicator fields', () => {
    assert.strictEqual(inferDefaultMode(makeTask()), 'play')
  })

  it('returns "play" for task with only title and tags', () => {
    assert.strictEqual(inferDefaultMode(makeTask({title: 'My Game', tags: ['fuseki']})), 'play')
  })
})
