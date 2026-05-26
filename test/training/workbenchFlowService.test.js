import assert from 'assert'

import {createAttemptService} from '../../src/modules/training/attempt/attemptService.ts'
import {createRecallCheckpointService} from '../../src/modules/training/recall/recallCheckpointService.ts'
import {createRecallService} from '../../src/modules/training/recall/recallService.ts'
import {createTrainingRuntimeStore} from '../../src/modules/training/store/trainingRuntimeStore.ts'
import {createWorkbenchStore} from '../../src/modules/training/store/workbenchStore.ts'
import {createTestLogger} from '../helpers/createTestLogger.ts'
import {
  createPhase3StrictRecallRepository,
  createPhase3SubmitOrderDeps,
  seedPhase3RecallAttempt,
} from './phase3TypedFakes.ts'

const {createWorkbenchFlowService} = require('../../src/modules/training/workbench/workbenchFlowService.ts')

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

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function getTab(store, tabId) {
  return store.getState().tabs.find(t => t.id === tabId)
}

function createModeEffectsSpy() {
  const calls = {
    enterAnalysis: [],
    exitAnalysis: [],
  }

  return {
    calls,
    modeEffects: {
      enterAnalysis(input) {
        calls.enterAnalysis.push(clone(input))
      },
      exitAnalysis(input) {
        calls.exitAnalysis.push(clone(input))
      },
    },
  }
}

/**
 * @param {Partial<ReturnType<typeof import('../../src/modules/training/workbench/workbenchFlowService').createWorkbenchFlowService>['deps']>} [overrides]
 */
function createMockDeps(overrides = {}) {
  const store = createWorkbenchStore()
  const {logger, logs} = createTestLogger()

  return {
    store,
    logs,
    workbenchStore: store,
    repository: {
      loadTask: async id => overrides.tasks?.[id] ?? makeTask({id}),
      createTask: async t => t,
      transaction: async fn => fn(),
      createRecallSession: async s => ({...s, id: 'rs_1'}),
      loadRecallSession: async id => ({id, recallPolicy: 'fullLine', expectedMoveIndexes: []}),
      ...overrides.repository,
    },
    attemptService: {
      createAttempt: async input => ({id: 'attempt_1', ...input}),
      freezeAttempt: async () => {},
      finalizeAttemptResult: async () => {},
      ...overrides.attemptService,
    },
    recallService: {
      createRecallSession: async input => ({id: 'rs_1', ...input}),
      createRecallFromAttempt: async input => ({id: 'rs_1', recallPolicy: 'fullLine', ...input}),
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
    modeEffects: overrides.modeEffects,
    logger,
  }
}

function createSnapshotGuardDeps(overrides = {}) {
  const modeEffects = createModeEffectsSpy()
  const persistenceCalls = {
    loadTask: [],
    captureSnapshotInput: [],
    transaction: [],
    createTask: [],
    openTask: [],
  }
  const deps = createMockDeps({
    modeEffects: modeEffects.modeEffects,
    repository: {
      async loadTask(id) {
        persistenceCalls.loadTask.push(id)
        if (id == null) {
          throw new Error('repository.loadTask(null/undefined) must not run for snapshot guard')
        }
        return makeTask({id})
      },
      async createTask(task) {
        persistenceCalls.createTask.push(clone(task))
        throw new Error('snapshot guard must not create a task before Analysis')
      },
      async transaction(fn) {
        persistenceCalls.transaction.push('transaction')
        return fn()
      },
      ...overrides.repository,
    },
    snapshotService: {
      async captureSnapshotInput(input) {
        persistenceCalls.captureSnapshotInput.push(clone(input))
        throw new Error('snapshot guard must not capture non-analysis context directly')
      },
      ...overrides.snapshotService,
    },
    tabService: {
      async openTask(opts) {
        persistenceCalls.openTask.push(clone(opts))
        throw new Error('snapshot guard must not open a child tab before Analysis')
      },
      ...overrides.tabService,
    },
    ...overrides,
  })

  return {
    deps,
    effectCalls: modeEffects.calls,
    persistenceCalls,
  }
}

// --- Tests ---

describe('workbenchFlowService', () => {
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

    it('routes active problem submit through problemFlowService before recall creation', async () => {
      const workbenchStore = createWorkbenchStore()
      const runtimeStore = createTrainingRuntimeStore()
      const calls = []
      const service = createWorkbenchFlowService({
        workbenchStore,
        runtimeStore,
        repository: {
          listMoveEvaluationsByAttempt: async () => {
            throw new Error('generic evaluation path must not run for problem submit')
          },
          listBadMovesByAttempt: async () => {
            throw new Error('generic bad-move path must not run for problem submit')
          },
        },
        attemptService: {
          createAttempt: async input => ({id: 'unused', ...input}),
          freezeAttempt: async () => {
            throw new Error('generic freeze path must not run for problem submit')
          },
          finalizeAttemptResult: async () => {
            throw new Error('generic finalize path must not run for problem submit')
          },
        },
        recallService: {
          createRecallFromAttempt: async attemptId => {
            calls.push(['createRecallFromAttempt', attemptId])
            return {
              id: 'recall_problem',
              taskId: 'task_problem',
              tabId: 'tab_problem',
              expectedMoves: ['D4'],
              currentMoveIndex: 0,
              completed: false,
            }
          },
          completeRecall: async () => {},
        },
        snapshotService: {},
        tabService: {},
        problemFlowService: {
          appendProblemMove: async () => null,
          undoProblemMove: async () => null,
          submitActiveProblem: async () => {
            calls.push(['submitActiveProblem'])
            return {
              attempt: {id: 'attempt_problem'},
              result: 'pass',
              generatedPunishmentProblemIds: [],
            }
          },
          abandonActiveProblem: async () => null,
        },
      })
      workbenchStore.addTab(makeTab({
        id: 'tab_problem',
        taskId: 'task_problem',
        mode: 'problem',
        activeAttemptId: 'attempt_problem',
      }))
      runtimeStore.setProblemView({
        taskId: 'task_problem',
        tabId: 'tab_problem',
        attemptId: 'attempt_problem',
        legacyProblemSession: null,
        evalCache: [],
        badMoves: [],
        submitted: false,
        result: null,
      })

      await service.submit('tab_problem')

      assert.deepStrictEqual(calls, [
        ['submitActiveProblem'],
        ['createRecallFromAttempt', 'attempt_problem'],
      ])
      assert.strictEqual(getTab(workbenchStore, 'tab_problem').mode, 'recall')
      assert.strictEqual(
        getTab(workbenchStore, 'tab_problem').activeRecallSessionId,
        'recall_problem',
      )
      assert.strictEqual(runtimeStore.getState().problemView, null)
      assert.strictEqual(
        runtimeStore.getState().activeRecallSessionId,
        'recall_problem',
      )
    })

    it('freezes attempt before creating recall session', async () => {
      const order = []
      const deps = createMockDeps({
        attemptService: {
          freezeAttempt: async id => { order.push('freeze') },
        },
        recallService: {
          createRecallFromAttempt: undefined,
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

  describe('problem commands', () => {
    it('routes problem undo through problemFlowService without changing tab mode', async () => {
      const workbenchStore = createWorkbenchStore()
      const service = createWorkbenchFlowService({
        workbenchStore,
        repository: {},
        attemptService: {
          createAttempt: async input => ({id: 'unused', ...input}),
          freezeAttempt: async () => {},
          finalizeAttemptResult: async () => {},
        },
        recallService: {completeRecall: async () => {}},
        snapshotService: {},
        tabService: {},
        problemFlowService: {
          appendProblemMove: async () => null,
          submitActiveProblem: async () => null,
          abandonActiveProblem: async () => null,
          undoProblemMove: async () => ({
            evalCache: [],
            badMoves: [],
            userLine: ['D4'],
          }),
        },
      })
      workbenchStore.addTab(makeTab({
        id: 'tab_problem_undo',
        mode: 'problem',
        activeAttemptId: 'attempt_problem_undo',
      }))

      const result = await service.undoProblemMove('tab_problem_undo')

      assert.deepStrictEqual(result.userLine, ['D4'])
      assert.strictEqual(getTab(workbenchStore, 'tab_problem_undo').mode, 'problem')
    })

    it('abandons a problem through problemFlowService without creating recall', async () => {
      const workbenchStore = createWorkbenchStore()
      const runtimeStore = createTrainingRuntimeStore()
      const calls = []
      const service = createWorkbenchFlowService({
        workbenchStore,
        runtimeStore,
        repository: {},
        attemptService: {
          createAttempt: async input => ({id: 'unused', ...input}),
          freezeAttempt: async () => {
            calls.push('freezeAttempt')
          },
          finalizeAttemptResult: async () => {
            calls.push('finalizeAttemptResult')
          },
        },
        recallService: {
          createRecallFromAttempt: async () => {
            calls.push('createRecallFromAttempt')
            return {id: 'unexpected_recall'}
          },
          completeRecall: async () => {},
        },
        snapshotService: {},
        tabService: {},
        problemFlowService: {
          appendProblemMove: async () => null,
          undoProblemMove: async () => null,
          submitActiveProblem: async () => null,
          abandonActiveProblem: async () => {
            calls.push('abandonActiveProblem')
            runtimeStore.setProblemView(null)
            return {attempt: {id: 'attempt_problem_abandon'}}
          },
        },
      })
      workbenchStore.addTab(makeTab({
        id: 'tab_problem_abandon',
        mode: 'problem',
        activeAttemptId: 'attempt_problem_abandon',
      }))
      runtimeStore.setProblemView({
        taskId: 'task_problem',
        tabId: 'tab_problem_abandon',
        attemptId: 'attempt_problem_abandon',
        legacyProblemSession: null,
        evalCache: [],
        badMoves: [],
        submitted: false,
        result: null,
      })

      await service.abandonProblem('tab_problem_abandon')

      assert.deepStrictEqual(calls, ['abandonActiveProblem'])
      assert.strictEqual(getTab(workbenchStore, 'tab_problem_abandon').mode, 'play')
      assert.strictEqual(
        getTab(workbenchStore, 'tab_problem_abandon').activeAttemptId,
        undefined,
      )
      assert.strictEqual(runtimeStore.getState().problemView, null)
      assert.strictEqual(runtimeStore.getState().activeRecallSessionId, undefined)
    })
  })

  describe('submit — real recall surface hydration', () => {
    it('hydrates an active recall projection from the created RecallSession without caller seeding', async () => {
      const workbenchStore = createWorkbenchStore()
      const runtimeStore = createTrainingRuntimeStore()
      const repository = createPhase3StrictRecallRepository()
      const attempt = seedPhase3RecallAttempt(repository, {
        id: 'attempt_s2r_1',
        taskId: 'task_s2r_1',
        tabId: 'tab_s2r_1',
        status: 'playing',
        userLine: ['D4', 'Q16', 'C3'],
      })

      workbenchStore.addTab(makeTab({
        id: 'tab_s2r_1',
        taskId: attempt.taskId,
        mode: 'problem',
        activeAttemptId: attempt.id,
      }))
      workbenchStore.setActiveTab('tab_s2r_1')

      const checkpointService = createRecallCheckpointService({
        repository,
        runtimeStore,
      })
      const service = createWorkbenchFlowService({
        workbenchStore,
        repository,
        runtimeStore,
        attemptService: createAttemptService({repository, runtimeStore}),
        recallService: createRecallService({
          repository,
          runtimeStore,
          checkpointService,
        }),
        recallCheckpointService: checkpointService,
        snapshotService: {
          async captureSnapshotInput() {
            return {
              sourceTaskId: attempt.taskId,
              positionSgf: '(;SZ[19])',
              sideToMove: 'black',
            }
          },
          async createProblemFromCurrentAnalysisPosition() {
            return {id: 'unused_snapshot_problem'}
          },
        },
        tabService: {
          async openTask() { throw new Error('not used') },
          closeTab() {},
          switchTab() {},
        },
      })

      await service.submit('tab_s2r_1')

      const tab = workbenchStore.getState().tabs.find(t => t.id === 'tab_s2r_1')
      const runtime = runtimeStore.getState()
      const sessions = Object.values(repository.store.sessions)

      assert.strictEqual(sessions.length, 1)
      assert.strictEqual(tab.mode, 'recall')
      assert.strictEqual(tab.recallSubstate, 'normal')
      assert.strictEqual(tab.activeRecallSessionId, sessions[0].id)
      assert.strictEqual(runtime.activeRecallSessionId, sessions[0].id)
      assert.ok(runtime.recallView, 'submit must hydrate a transient active recall projection')
      assert.strictEqual(runtime.recallView.recallSessionId, sessions[0].id)
      assert.strictEqual(runtime.recallView.moveIndex, 0)
      assert.strictEqual(runtime.recallView.expectedMoves.length, attempt.userLine.length)
      assert.strictEqual(runtime.recallView.completed, false)
    })
  })

  // --- Phase 3: enhanced submit with evaluation flow (C22-C31, C38, C39) ---

  describe('submit — evaluation and finalization (C22-C31, C38, C39)', () => {
    function createEvalMockDeps(overrides = {}) {
      const frozenAttempts = {}
      const finalizedResults = {}
      const createdRecallSessions = []
      const {logger, logs} = createTestLogger()

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
        logger,
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

    it('P3-T08 submit ordering: finalize result before freeze, then create recall (C39)', async () => {
      const deps = createPhase3SubmitOrderDeps({makeDeps: createEvalMockDeps})
      deps.workbenchStore = deps.store
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'play', activeAttemptId: 'att_1'}))

      await service.submit('tab_1')

      assert.deepStrictEqual(deps.phase3Order, ['finalize', 'freeze', 'recall'])
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

  // ================================================================
  // step3.2.tests: ModeEnterEffect / ModeExitEffect orchestration
  // Contract:
  // docs/archive/daily-design/2026-05-26/workbench-mode-effects/test-contract-v0.1.md
  //
  // Harness manifest:
  // - Production subject: createWorkbenchFlowService + real workbenchStore.
  // - Injected ports: modeEffects enterAnalysis/exitAnalysis spies only record
  //   immutable input snapshots; they do not mutate asserted store state.
  // - Guarded ports: snapshotService/repository/tabService throw if non-analysis
  //   Snapshot tries to persist directly.
  // - Not mocked: resolver/store transition behavior.
  // - Rejected fake greens: callback-only assertions, UI-layer mocks,
  //   reverse-contract tests, or hand-mutating the final asserted tab state.
  // ================================================================

  describe('step3.2 ModeEnterEffect / ModeExitEffect orchestration', () => {
    it('enterAnalysis triggers injected ModeEnterEffect with before/after tabs and return target', () => {
      const modeEffects = createModeEffectsSpy()
      const deps = createMockDeps({modeEffects: modeEffects.modeEffects})
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({
        id: 'tab_enter_effect',
        taskId: 'task_effect',
        mode: 'problem',
        activeAttemptId: 'attempt_effect',
        currentTreePosition: 'node_problem_12',
      }))

      service.enterAnalysis('tab_enter_effect', {reason: 'manual'})

      const afterTab = getTab(deps.store, 'tab_enter_effect')
      assert.strictEqual(afterTab.mode, 'analysis')
      assert.strictEqual(modeEffects.calls.enterAnalysis.length, 1,
        'flow service must call the injected ModeEnterEffect exactly once')

      const effectInput = modeEffects.calls.enterAnalysis[0]
      assert.strictEqual(effectInput.tabId, 'tab_enter_effect')
      assert.strictEqual(effectInput.fromMode, 'problem')
      assert.strictEqual(effectInput.toMode, 'analysis')
      assert.strictEqual(effectInput.reason, 'manual')
      assert.strictEqual(effectInput.beforeTab.mode, 'problem')
      assert.strictEqual(effectInput.beforeTab.currentTreePosition, 'node_problem_12')
      assert.strictEqual(effectInput.afterTab.mode, 'analysis')
      assert.deepStrictEqual(effectInput.afterTab, clone(afterTab),
        'effect afterTab must reflect the real stored tab after transition')
      assert.deepStrictEqual(effectInput.analysisReturnTarget, {
        mode: 'problem',
        treePosition: 'node_problem_12',
      })
      assert.strictEqual(effectInput.analysisContext.taskId, 'task_effect')
      assert.strictEqual(effectInput.analysisContext.source, 'problem')
      assert.strictEqual(effectInput.analysisContext.attemptId, 'attempt_effect')
      assert.deepStrictEqual(modeEffects.calls.exitAnalysis, [])
    })

    it('returnFromAnalysis triggers injected ModeExitEffect with restored target state', () => {
      const modeEffects = createModeEffectsSpy()
      const deps = createMockDeps({modeEffects: modeEffects.modeEffects})
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({
        id: 'tab_exit_effect',
        taskId: 'task_effect',
        mode: 'analysis',
        previousMode: 'recall',
        recallSubstate: 'checkpoint_ai_revealed',
        currentTreePosition: 'analysis_node',
        activeAttemptId: 'attempt_effect',
        activeRecallSessionId: 'recall_effect',
        analysisReturnTarget: {
          mode: 'recall',
          recallSubstate: 'normal',
          treePosition: 'recall_node_7',
          moveIndex: 7,
        },
        analysisContext: {
          taskId: 'task_effect',
          source: 'recall',
          attemptId: 'attempt_effect',
        },
      }))

      service.returnFromAnalysis({tabId: 'tab_exit_effect', reason: 'return'})

      const afterTab = getTab(deps.store, 'tab_exit_effect')
      assert.strictEqual(afterTab.mode, 'recall')
      assert.strictEqual(afterTab.recallSubstate, 'normal')
      assert.strictEqual(afterTab.currentTreePosition, 'recall_node_7')
      assert.strictEqual(afterTab.analysisReturnTarget, undefined)
      assert.strictEqual(modeEffects.calls.exitAnalysis.length, 1,
        'flow service must call the injected ModeExitEffect exactly once')

      const effectInput = modeEffects.calls.exitAnalysis[0]
      assert.strictEqual(effectInput.tabId, 'tab_exit_effect')
      assert.strictEqual(effectInput.fromMode, 'analysis')
      assert.strictEqual(effectInput.toMode, 'recall')
      assert.strictEqual(effectInput.reason, 'return')
      assert.strictEqual(effectInput.beforeTab.mode, 'analysis')
      assert.strictEqual(effectInput.beforeTab.analysisReturnTarget.moveIndex, 7)
      assert.deepStrictEqual(effectInput.afterTab, clone(afterTab),
        'effect afterTab must reflect the real restored tab')
      assert.deepStrictEqual(effectInput.analysisReturnTarget, {
        mode: 'recall',
        recallSubstate: 'normal',
        treePosition: 'recall_node_7',
        moveIndex: 7,
      })
      assert.deepStrictEqual(modeEffects.calls.enterAnalysis, [])
    })

    for (const mode of ['play', 'problem', 'recall']) {
      it(`non-analysis Snapshot from ${mode} enters Analysis first and does not persist directly`, async () => {
        const {deps, effectCalls, persistenceCalls} = createSnapshotGuardDeps()
        const service = createWorkbenchFlowService(deps)
        deps.store.addTab(makeTab({
          id: `tab_snapshot_guard_${mode}`,
          taskId: `task_snapshot_guard_${mode}`,
          mode,
          activeAttemptId: mode === 'play' || mode === 'problem' ? 'attempt_guard' : undefined,
          activeRecallSessionId: mode === 'recall' ? 'recall_guard' : undefined,
          recallSubstate: mode === 'recall' ? 'normal' : undefined,
          currentTreePosition: `${mode}_node_5`,
        }))

        await service.snapshotFromCurrentContext(`tab_snapshot_guard_${mode}`)

        const tab = getTab(deps.store, `tab_snapshot_guard_${mode}`)
        assert.strictEqual(tab.mode, 'analysis',
          'non-analysis Snapshot must first enter Analysis scratch/current')
        assert.strictEqual(effectCalls.enterAnalysis.length, 1,
          'snapshot guard must route through ModeEnterEffect')
        assert.strictEqual(effectCalls.enterAnalysis[0].reason, 'snapshot')
        assert.strictEqual(effectCalls.enterAnalysis[0].fromMode, mode)
        assert.deepStrictEqual(persistenceCalls.captureSnapshotInput, [],
          'non-analysis Snapshot must not call snapshotService directly')
        assert.deepStrictEqual(persistenceCalls.createTask, [],
          'non-analysis Snapshot must not create a task before Analysis')
        assert.deepStrictEqual(persistenceCalls.openTask, [],
          'non-analysis Snapshot must not open a child tab before Analysis')
      })
    }

    it('null task/free-play Snapshot guard does not loadTask(null) or persist a direct snapshot', async () => {
      const {deps, effectCalls, persistenceCalls} = createSnapshotGuardDeps()
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({
        id: 'tab_free_play_snapshot_guard',
        taskId: null,
        mode: 'play',
        currentTreePosition: 'free_play_node',
      }))

      await service.snapshotFromCurrentContext('tab_free_play_snapshot_guard')

      const tab = getTab(deps.store, 'tab_free_play_snapshot_guard')
      assert.strictEqual(tab.mode, 'analysis')
      assert.strictEqual(tab.analysisContext.taskId, null,
        'free-play analysis context must preserve the absent source task without loading it')
      assert.strictEqual(effectCalls.enterAnalysis.length, 1)
      assert.strictEqual(effectCalls.enterAnalysis[0].reason, 'snapshot')
      assert.deepStrictEqual(persistenceCalls.loadTask, [],
        'snapshot guard must not call repository.loadTask(null/undefined)')
      assert.deepStrictEqual(persistenceCalls.captureSnapshotInput, [])
      assert.deepStrictEqual(persistenceCalls.transaction, [])
      assert.deepStrictEqual(persistenceCalls.createTask, [])
      assert.deepStrictEqual(persistenceCalls.openTask, [])
    })

    it('enterAnalysis/returnFromAnalysis do not pollute attempt, recall, or source tree state', () => {
      const modeEffects = createModeEffectsSpy()
      const runtimeStore = createTrainingRuntimeStore()
      runtimeStore.setActiveAttempt('attempt_readonly')
      runtimeStore.setActiveRecallSession('recall_readonly')
      runtimeStore.setActiveCheckpoint('checkpoint_readonly')
      runtimeStore.setProblemView({
        taskId: 'task_readonly',
        tabId: 'tab_readonly',
        attemptId: 'attempt_readonly',
        legacyProblemSession: null,
        evalCache: [],
        badMoves: [],
        submitted: false,
        result: null,
      })
      runtimeStore.setRecallView({
        recallSessionId: 'recall_readonly',
        taskId: 'task_readonly',
        tabId: 'tab_readonly',
        moveIndex: 4,
        expectedMoves: [{sign: 1, vertex: 'D4'}],
        userAttempts: [{vertex: 'Q16', isCorrect: false}],
        showHint: true,
        completed: false,
      })
      runtimeStore.setCorrectionDraft({
        checkpointId: 'checkpoint_readonly',
        moves: ['C3', 'D16'],
      })
      const runtimeBefore = clone(runtimeStore.getState())
      const forbiddenCalls = []
      const deps = createMockDeps({
        runtimeStore,
        modeEffects: modeEffects.modeEffects,
        attemptService: {
          createAttempt: async input => {
            forbiddenCalls.push(['createAttempt', input])
            throw new Error('mode effects must not create attempts')
          },
          freezeAttempt: async id => {
            forbiddenCalls.push(['freezeAttempt', id])
            throw new Error('mode effects must not freeze attempts')
          },
          finalizeAttemptResult: async (id, result) => {
            forbiddenCalls.push(['finalizeAttemptResult', id, result])
            throw new Error('mode effects must not finalize attempts')
          },
        },
        recallService: {
          createRecallFromAttempt: async id => {
            forbiddenCalls.push(['createRecallFromAttempt', id])
            throw new Error('mode effects must not create recall')
          },
          createRecallSession: async input => {
            forbiddenCalls.push(['createRecallSession', input])
            throw new Error('mode effects must not create recall')
          },
          completeRecall: async id => {
            forbiddenCalls.push(['completeRecall', id])
            throw new Error('mode effects must not complete recall')
          },
        },
        repository: {
          async loadTask(id) { return makeTask({id}) },
          async createTask(task) {
            forbiddenCalls.push(['createTask', task])
            throw new Error('mode effects must not create tasks')
          },
          async updateAttempt(id, patch) {
            forbiddenCalls.push(['updateAttempt', id, patch])
            throw new Error('mode effects must not update attempts')
          },
          async transaction(fn) { return fn() },
        },
      })
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({
        id: 'tab_readonly',
        taskId: 'task_readonly',
        mode: 'recall',
        recallSubstate: 'checkpoint_correction',
        activeAttemptId: 'attempt_readonly',
        activeRecallSessionId: 'recall_readonly',
        currentTreePosition: 'recall_source_node',
      }))

      service.enterAnalysis('tab_readonly', {reason: 'manual'})
      service.returnFromAnalysis({tabId: 'tab_readonly', reason: 'return'})

      const tab = getTab(deps.store, 'tab_readonly')
      assert.strictEqual(tab.mode, 'recall')
      assert.strictEqual(tab.recallSubstate, 'checkpoint_correction')
      assert.strictEqual(tab.activeAttemptId, 'attempt_readonly')
      assert.strictEqual(tab.activeRecallSessionId, 'recall_readonly')
      assert.strictEqual(tab.currentTreePosition, 'recall_source_node')
      assert.deepStrictEqual(runtimeStore.getState(), runtimeBefore,
        'mode enter/exit must not mutate problem, recall, checkpoint, or attempt runtime facts')
      assert.deepStrictEqual(forbiddenCalls, [],
        'mode enter/exit must not call attempt/recall/source persistence services')
      assert.strictEqual(modeEffects.calls.enterAnalysis.length, 1)
      assert.strictEqual(modeEffects.calls.exitAnalysis.length, 1)
    })
  })

  describe('returnFromAnalysis — analysis → previous mode', () => {
    it('restores mode from analysisReturnTarget', () => {
      const deps = createMockDeps()
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'analysis', analysisReturnTarget: {mode: 'recall', recallSubstate: 'normal'}}))

      service.returnFromAnalysis({tabId: 'tab_1'})

      const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
      assert.strictEqual(tab.mode, 'recall')
    })

    it('clears analysisReturnTarget', () => {
      const deps = createMockDeps()
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'analysis', analysisReturnTarget: {mode: 'play'}}))

      service.returnFromAnalysis({tabId: 'tab_1'})

      const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
      assert.strictEqual(tab.analysisReturnTarget, undefined)
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

  describe('snapshotFromCurrentContext — analysis → new tab', () => {
    it('works from analysis mode, original tab unchanged', async () => {
      const deps = createMockDeps()
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'analysis'}))

      await service.snapshotFromCurrentContext('tab_1')

      const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
      assert.strictEqual(tab.mode, 'analysis')
    })

    for (const mode of ['play', 'problem', 'recall']) {
      it(`enters analysis first from ${mode} mode and does not persist directly`, async () => {
        const {deps, effectCalls, persistenceCalls} = createSnapshotGuardDeps()
        const service = createWorkbenchFlowService(deps)
        deps.store.addTab(makeTab({
          id: 'tab_1',
          mode,
          activeRecallSessionId: mode === 'recall' ? 'recall_snapshot' : undefined,
        }))

        await service.snapshotFromCurrentContext('tab_1')

        const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
        assert.strictEqual(tab.mode, 'analysis')
        assert.strictEqual(effectCalls.enterAnalysis.length, 1)
        assert.strictEqual(effectCalls.enterAnalysis[0].reason, 'snapshot')
        assert.deepStrictEqual(persistenceCalls.captureSnapshotInput, [])
        assert.deepStrictEqual(persistenceCalls.createTask, [])
        assert.deepStrictEqual(persistenceCalls.openTask, [])
      })
    }

    it('creates a new child tab', async () => {
      const deps = createMockDeps()
      const service = createWorkbenchFlowService(deps)
      deps.store.addTab(makeTab({id: 'tab_1', mode: 'analysis'}))

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
          () => {
            if (method === 'returnFromAnalysis') {
              service[method]({tabId: 'tab_1'})
            } else {
              service[method]('tab_1')
            }
          },
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

  // --- Phase 6: End-to-end Snapshot integration (C21-C30) ---

  describe('Phase 6: snapshotFromCurrentContext E2E (C21-C30)', () => {
    function createE2EMockDeps(overrides = {}) {
      const store = createWorkbenchStore()
      const createdTasks = []
      const transactionFns = []
      const {logger, logs} = createTestLogger()

      return {
        store,
        createdTasks,
        transactionFns,
        logs,
        workbenchStore: store,
        repository: {
          loadTask: async id => overrides.tasks?.[id] ?? makeTask({id}),
          createTask: async t => {
            createdTasks.push({...t})
            return t
          },
          transaction: async fn => {
            transactionFns.push(fn)
            return fn()
          },
          ...overrides.repository,
        },
        attemptService: {
          createAttempt: async input => ({id: 'attempt_1', ...input}),
          freezeAttempt: async () => {},
          finalizeAttemptResult: async () => {},
        },
        recallService: {
          createRecallSession: async input => ({id: 'rs_1', ...input}),
        },
        snapshotService: {
          captureSnapshotInput: async input => ({
            sourceTaskId: input?.sourceTaskId ?? 'task_1',
            sourceAttemptId: input?.sourceAttemptId,
            positionSgf: '(;SZ[9]AB[dc])',
            sideToMove: 'black',
            sourceMoveIndex: 12,
          }),
          ...overrides.snapshotService,
        },
        tabService: {
          openTask: async opts => ({
            id: 'tab_snap_1',
            taskId: createdTasks.length > 0 ? createdTasks[createdTasks.length - 1].id : 'task_snap_1',
            mode: 'problem',
            parentTabId: opts?.parentTabId,
            childTabIds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
          ...overrides.tabService,
        },
        logger,
      }
    }

    describe('C21-C24: snapshotFromCurrentContext uses Analysis scratch/current guard', () => {
      it('C24: creates TrainingTask and new tab from analysis mode, original tab unchanged', async () => {
        const deps = createE2EMockDeps()
        const service = createWorkbenchFlowService(deps)
        deps.store.addTab(makeTab({id: 'tab_orig', mode: 'analysis', taskId: 'task_1'}))

        const newTab = await service.snapshotFromCurrentContext('tab_orig')

        // New tab created
        assert.ok(newTab, 'should return a new tab')
        assert.strictEqual(newTab.parentTabId, 'tab_orig')

        // A task was created
        assert.ok(deps.createdTasks.length >= 1, 'should create at least one task')

        // Original tab mode preserved
        const origTab = deps.store.getState().tabs.find(t => t.id === 'tab_orig')
        assert.strictEqual(origTab.mode, 'analysis', 'original tab should remain in analysis mode')
      })

      for (const {mode, label} of [
        {mode: 'play', label: 'C21'},
        {mode: 'problem', label: 'C22'},
        {mode: 'recall', label: 'C23'},
      ]) {
        it(`${label}: enters Analysis first from ${mode} mode without creating a task`, async () => {
          const {deps, effectCalls, persistenceCalls} = createSnapshotGuardDeps()
          const service = createWorkbenchFlowService(deps)
          deps.store.addTab(makeTab({
            id: 'tab_orig',
            mode,
            taskId: 'task_1',
            activeRecallSessionId: mode === 'recall' ? 'recall_snapshot' : undefined,
          }))

          await service.snapshotFromCurrentContext('tab_orig')

          assert.strictEqual(effectCalls.enterAnalysis.length, 1,
            'non-analysis Snapshot must call the injected ModeEnterEffect')
          assert.strictEqual(effectCalls.enterAnalysis[0].reason, 'snapshot')
          assert.deepStrictEqual(persistenceCalls.captureSnapshotInput, [],
            'should not capture snapshot input before Analysis')
          assert.deepStrictEqual(persistenceCalls.createTask, [],
            'should not create a task before Analysis')
          assert.deepStrictEqual(persistenceCalls.openTask, [],
            'should not open a child tab before Analysis')

          const origTab = deps.store.getState().tabs.find(t => t.id === 'tab_orig')
          assert.strictEqual(origTab.mode, 'analysis', `original tab should enter analysis from ${mode} mode`)
        })
      }
    })

    describe('C25: task has origin.provider === snapshot', () => {
      it('created task origin.provider is "snapshot"', async () => {
        const deps = createE2EMockDeps()
        const service = createWorkbenchFlowService(deps)
        deps.store.addTab(makeTab({id: 'tab_1', mode: 'analysis', taskId: 'task_1'}))

        await service.snapshotFromCurrentContext('tab_1')

        assert.ok(deps.createdTasks.length >= 1, 'should create a task')
        const task = deps.createdTasks[deps.createdTasks.length - 1]
        assert.ok(task.origin, 'task should have origin')
        assert.strictEqual(task.origin.provider, 'snapshot')
      })
    })

    describe('C26: task has origin.parentTaskId === tab.taskId', () => {
      it('created task origin.parentTaskId matches original tab taskId', async () => {
        const deps = createE2EMockDeps()
        const service = createWorkbenchFlowService(deps)
        deps.store.addTab(makeTab({id: 'tab_1', mode: 'analysis', taskId: 'task_parent'}))

        await service.snapshotFromCurrentContext('tab_1')

        const task = deps.createdTasks[deps.createdTasks.length - 1]
        assert.ok(task.origin, 'task should have origin')
        assert.strictEqual(task.origin.parentTaskId, 'task_parent')
      })
    })

    describe('C27: task has origin.parentAttemptId when tab has activeAttemptId', () => {
      it('sets parentAttemptId from tab.activeAttemptId', async () => {
        const deps = createE2EMockDeps()
        const service = createWorkbenchFlowService(deps)
        deps.store.addTab(makeTab({
          id: 'tab_1',
          mode: 'analysis',
          taskId: 'task_1',
          activeAttemptId: 'att_42',
        }))

        await service.snapshotFromCurrentContext('tab_1')

        const task = deps.createdTasks[deps.createdTasks.length - 1]
        assert.strictEqual(task.origin.parentAttemptId, 'att_42')
      })

      it('omits parentAttemptId when tab has no activeAttemptId', async () => {
        const deps = createE2EMockDeps()
        const service = createWorkbenchFlowService(deps)
        deps.store.addTab(makeTab({id: 'tab_1', mode: 'analysis', taskId: 'task_1'}))

        await service.snapshotFromCurrentContext('tab_1')

        const task = deps.createdTasks[deps.createdTasks.length - 1]
        // parentAttemptId should be undefined when tab has no activeAttemptId
        assert.strictEqual(task.origin.parentAttemptId, undefined)
      })
    })

    describe('C28: new tab has parentTabId', () => {
      it('returned tab has parentTabId set to original tab id', async () => {
        const deps = createE2EMockDeps()
        const service = createWorkbenchFlowService(deps)
        deps.store.addTab(makeTab({id: 'tab_original', mode: 'analysis', taskId: 'task_1'}))

        const newTab = await service.snapshotFromCurrentContext('tab_original')

        assert.strictEqual(newTab.parentTabId, 'tab_original')
      })
    })

    describe('C29: new tab has mode === problem', () => {
      it('returned tab has mode set to "problem"', async () => {
        const deps = createE2EMockDeps()
        const service = createWorkbenchFlowService(deps)
        deps.store.addTab(makeTab({id: 'tab_1', mode: 'analysis', taskId: 'task_1'}))

        const newTab = await service.snapshotFromCurrentContext('tab_1')

        assert.strictEqual(newTab.mode, 'problem')
      })
    })

    describe('C30: repository.transaction called', () => {
      it('task creation is wrapped in a transaction', async () => {
        const deps = createE2EMockDeps()
        const service = createWorkbenchFlowService(deps)
        deps.store.addTab(makeTab({id: 'tab_1', mode: 'analysis', taskId: 'task_1'}))

        await service.snapshotFromCurrentContext('tab_1')

        assert.ok(
          deps.transactionFns.length >= 1,
          'repository.transaction should be called at least once',
        )
      })
    })
  })

  // ================================================================
  // Phase 1 Gap tests: recallSubstate, analysisReturnTarget, enterRecall
  // Contract: docs/design/2026-05-25/phase1-gaps/test-contract-v0.1.md
  //
  // Harness manifest:
  // - Real production modules: createWorkbenchFlowService, createWorkbenchStore
  // - Fake/spy modules: attemptService, recallService, repository, snapshotService, tabService
  // - Mock Contract Source: satisfies production interfaces via createMockDeps pattern
  // - Valid for: SERVICE_REPOSITORY_TRANSITION
  // - Not valid for: CONTROLLER_STATE_TRANSITION (use modeTransitions.test.js), RENDERED_UI_RETURN
  // ================================================================

  describe('Phase 1 Gaps: recallSubstate and analysisReturnTarget', () => {

    // ============================================================
    // P1G-T26: submit sets tab.recallSubstate='normal'
    // Contract Section 6: "submit: play/problem -> recall"
    // Contract Section 9 row P1G-T26
    // ============================================================
    describe('P1G-T26: submit sets recallSubstate to normal', () => {
      it('sets recallSubstate="normal" after submit from play', async () => {
        const deps = createMockDeps()
        deps.workbenchStore = deps.store
        const service = createWorkbenchFlowService(deps)
        deps.store.addTab(makeTab({id: 'tab_1', mode: 'play', activeAttemptId: 'att_1'}))

        await service.submit('tab_1')

        const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
        assert.strictEqual(tab.recallSubstate, 'normal',
          'submit must set tab.recallSubstate to "normal"')
      })

      it('sets recallSubstate="normal" after submit from problem', async () => {
        const deps = createMockDeps()
        deps.workbenchStore = deps.store
        const service = createWorkbenchFlowService(deps)
        deps.store.addTab(makeTab({id: 'tab_1', mode: 'problem', activeAttemptId: 'att_1'}))

        await service.submit('tab_1')

        const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
        assert.strictEqual(tab.recallSubstate, 'normal',
          'submit from problem must set tab.recallSubstate to "normal"')
      })
    })

    // ============================================================
    // P1G-T27: enterAnalysis saves analysisReturnTarget
    // Contract Section 6: "enterAnalysis: ... -> analysis"
    // Contract Section 9 row P1G-T27
    // ============================================================
    describe('P1G-T27: enterAnalysis saves analysisReturnTarget', () => {
      it('saves analysisReturnTarget with current mode', () => {
        const deps = createMockDeps()
        deps.workbenchStore = deps.store
        const service = createWorkbenchFlowService(deps)
        deps.store.addTab(makeTab({id: 'tab_1', mode: 'problem'}))

        service.enterAnalysis('tab_1')

        const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
        assert.ok(tab.analysisReturnTarget, 'tab should have analysisReturnTarget set')
        assert.strictEqual(tab.analysisReturnTarget.mode, 'problem',
          'analysisReturnTarget.mode should be the original mode')
      })

      it('saves analysisReturnTarget with recallSubstate when entering from recall', () => {
        const deps = createMockDeps()
        deps.workbenchStore = deps.store
        const service = createWorkbenchFlowService(deps)
        deps.store.addTab(makeTab({id: 'tab_1', mode: 'recall', recallSubstate: 'normal'}))

        service.enterAnalysis('tab_1')

        const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
        assert.ok(tab.analysisReturnTarget, 'tab should have analysisReturnTarget set')
        assert.strictEqual(tab.analysisReturnTarget.recallSubstate, 'normal',
          'analysisReturnTarget.recallSubstate should preserve the recall substate')
      })

      it('saves analysisReturnTarget with currentTreePosition', () => {
        const deps = createMockDeps()
        deps.workbenchStore = deps.store
        const service = createWorkbenchFlowService(deps)
        deps.store.addTab(makeTab({id: 'tab_1', mode: 'play', currentTreePosition: 'pos_42'}))

        service.enterAnalysis('tab_1')

        const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
        assert.strictEqual(tab.analysisReturnTarget.treePosition, 'pos_42',
          'analysisReturnTarget.treePosition should preserve currentTreePosition')
      })
    })

    // ============================================================
    // P1G-T29: returnFromAnalysis restores mode, recallSubstate,
    //          currentTreePosition, and clears analysisReturnTarget
    // Contract Section 6: "returnFromAnalysis: analysis -> previous mode"
    // Contract Section 9 row P1G-T29
    // ============================================================
    describe('P1G-T29: returnFromAnalysis restores all saved state', () => {
      it('restores mode from analysisReturnTarget', () => {
        const deps = createMockDeps()
        deps.workbenchStore = deps.store
        const service = createWorkbenchFlowService(deps)
        deps.store.addTab(makeTab({
          id: 'tab_1',
          mode: 'analysis',
          analysisReturnTarget: {
            mode: 'recall',
            recallSubstate: 'normal',
            treePosition: 'pos_10',
            moveIndex: 5,
          },
        }))

        service.returnFromAnalysis({tabId: 'tab_1'})

        const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
        assert.strictEqual(tab.mode, 'recall',
          'mode should be restored to analysisReturnTarget.mode')
      })

      it('restores recallSubstate from analysisReturnTarget', () => {
        const deps = createMockDeps()
        deps.workbenchStore = deps.store
        const service = createWorkbenchFlowService(deps)
        deps.store.addTab(makeTab({
          id: 'tab_1',
          mode: 'analysis',
          analysisReturnTarget: {
            mode: 'recall',
            recallSubstate: 'normal',
            treePosition: 'pos_10',
            moveIndex: 5,
          },
        }))

        service.returnFromAnalysis({tabId: 'tab_1'})

        const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
        assert.strictEqual(tab.recallSubstate, 'normal',
          'recallSubstate should be restored from analysisReturnTarget')
      })

      it('restores currentTreePosition from analysisReturnTarget', () => {
        const deps = createMockDeps()
        deps.workbenchStore = deps.store
        const service = createWorkbenchFlowService(deps)
        deps.store.addTab(makeTab({
          id: 'tab_1',
          mode: 'analysis',
          analysisReturnTarget: {
            mode: 'play',
            treePosition: 'pos_42',
            moveIndex: 15,
          },
        }))

        service.returnFromAnalysis({tabId: 'tab_1'})

        const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
        assert.strictEqual(tab.currentTreePosition, 'pos_42',
          'currentTreePosition should be restored from analysisReturnTarget')
      })

      it('clears analysisReturnTarget after restoration', () => {
        const deps = createMockDeps()
        deps.workbenchStore = deps.store
        const service = createWorkbenchFlowService(deps)
        deps.store.addTab(makeTab({
          id: 'tab_1',
          mode: 'analysis',
          analysisReturnTarget: {
            mode: 'play',
            treePosition: 'pos_1',
          },
        }))

        service.returnFromAnalysis({tabId: 'tab_1'})

        const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
        assert.strictEqual(tab.analysisReturnTarget, undefined,
          'analysisReturnTarget should be cleared after return')
      })
    })

    // ============================================================
    // P1G-T30: returnFromAnalysis throws when no analysisReturnTarget
    // Contract Section 6: "returnFromAnalysis: analysis (no target) => disallowed"
    // Contract Section 9 row P1G-T30
    // ============================================================
    describe('P1G-T30: returnFromAnalysis throws without target', () => {
      it('throws when analysisReturnTarget is not set', () => {
        const deps = createMockDeps()
        deps.workbenchStore = deps.store
        const service = createWorkbenchFlowService(deps)
        deps.store.addTab(makeTab({id: 'tab_1', mode: 'analysis'}))

        assert.throws(
          () => service.returnFromAnalysis({tabId: 'tab_1'}),
          /InvalidModeTransitionError|analysis.*target|return.*target/i,
          'returnFromAnalysis without target must throw',
        )
      })
    })

    // ============================================================
    // P1G-T32: enterRecall creates RecallSession and sets tab state
    // Contract Section 5 Gap 5: enterRecall API
    // Contract Section 9 row P1G-T32
    // ============================================================
    describe('P1G-T32: enterRecall creates RecallSession and sets tab state', () => {
      it('creates a recall session', async () => {
        const createdSessions = []
        const deps = createMockDeps({
          recallService: {
            createRecallFromAttempt: undefined,
            createRecallSession: async input => {
              createdSessions.push({...input})
              return {id: 'rs_new', ...input}
            },
          },
        })
        deps.workbenchStore = deps.store
        const service = createWorkbenchFlowService(deps)
        deps.store.addTab(makeTab({id: 'tab_1', mode: 'play', activeAttemptId: 'att_1'}))

        await service.enterRecall({tabId: 'tab_1', attemptId: 'att_1'})

        assert.ok(createdSessions.length >= 1, 'recallService should create a session')
      })

      it('sets tab mode to recall', async () => {
        const deps = createMockDeps()
        deps.workbenchStore = deps.store
        const service = createWorkbenchFlowService(deps)
        deps.store.addTab(makeTab({id: 'tab_1', mode: 'play', activeAttemptId: 'att_1'}))

        await service.enterRecall({tabId: 'tab_1', attemptId: 'att_1'})

        const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
        assert.strictEqual(tab.mode, 'recall',
          'enterRecall must set tab.mode to "recall"')
      })

      it('sets tab recallSubstate to normal', async () => {
        const deps = createMockDeps()
        deps.workbenchStore = deps.store
        const service = createWorkbenchFlowService(deps)
        deps.store.addTab(makeTab({id: 'tab_1', mode: 'play', activeAttemptId: 'att_1'}))

        await service.enterRecall({tabId: 'tab_1', attemptId: 'att_1'})

        const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
        assert.strictEqual(tab.recallSubstate, 'normal',
          'enterRecall must set tab.recallSubstate to "normal"')
      })

      it('sets tab activeRecallSessionId', async () => {
        const deps = createMockDeps()
        deps.workbenchStore = deps.store
        const service = createWorkbenchFlowService(deps)
        deps.store.addTab(makeTab({id: 'tab_1', mode: 'play', activeAttemptId: 'att_1'}))

        await service.enterRecall({tabId: 'tab_1', attemptId: 'att_1'})

        const tab = deps.store.getState().tabs.find(t => t.id === 'tab_1')
        assert.ok(tab.activeRecallSessionId,
          'enterRecall must set tab.activeRecallSessionId')
      })
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
