import assert from 'assert'

import {
  createWorkbenchPhaseService,
  VALID_PHASE_TRANSITIONS,
  PHASE_TRANSITION_RESULT,
  InvalidPhaseTransitionError,
} from '../../src/modules/training/workbench/workbenchPhaseService.ts'
import {createWorkbenchStore} from '../../src/modules/training/store/workbenchStore.ts'
import {createTestLogger} from '../helpers/createTestLogger.ts'

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

// --- Tests ---

describe('workbenchPhaseService', () => {
  let store, service

  beforeEach(() => {
    store = createWorkbenchStore()
    const taskImportCalls = {createTaskFromSnapshot: []}
    const tabCalls = {openProblemTab: [], openTask: [], openSnapshotProblemTab: []}
    service = createWorkbenchPhaseService({
      workbenchStore: store,
      repository: {
        loadTask: async () => ({ id: 'task_1', kind: 'problem', source: { kind: 'problem', problemId: 'p1' } }),
        createTask: async t => t,
        transaction: async fn => fn(),
      },
      snapshotService: {
        captureSnapshotInput: async () => ({
          sourceTaskId: 'task_1',
          positionSgf: '(;SZ[9])',
          sideToMove: 'black',
        }),
        createProblemFromCurrentAnalysisPosition: async (input) => ({
          id: 'snap_1',
          type: 'best_move',
          positionSgf: input.positionSgf,
          sideToMove: input.sideToMove,
          status: 'inbox',
          tags: ['snapshot'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      },
      taskImportService: {
        async createTaskFromSnapshot(input) {
          taskImportCalls.createTaskFromSnapshot.push(input)
          return {
            id: 'task_snap_1',
            rootPositionSgf: input.positionSgf,
            sideToMove: input.sideToMove,
            origin: {provider: 'snapshot', parentTaskId: input.parentTaskId},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        },
      },
      tabService: {
        calls: tabCalls,
        openProblemTab: async (opts) => {
          tabCalls.openProblemTab.push(opts)
          return {
            id: 'tab_snap_1',
            taskId: opts.taskId,
            mode: 'problem',
            parentTabId: opts.parentTabId,
            childTabIds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        },
        openTask: async (opts) => {
          tabCalls.openTask.push(opts)
          return {
            id: 'tab_snap_1',
            taskId: opts.taskId,
            mode: opts.mode,
            parentTabId: opts.parentTabId,
            childTabIds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        },
        openSnapshotProblemTab: async (problemId, opts) => {
          tabCalls.openSnapshotProblemTab.push({problemId, opts})
          return {
            id: 'tab_snap_1',
            taskId: 'task_snap_1',
            mode: 'play',
            parentTabId: opts?.parentTabId,
            childTabIds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        },
      },
    })
  })

  describe('valid transitions (table-driven)', () => {
    const validCases = [
      {from: 'play', transition: 'submit', expected: 'recall'},
      {from: 'recall', transition: 'complete', expected: 'analysis'},
      {from: 'recall', transition: 'restart', expected: 'play'},
      {from: 'analysis', transition: 'restart', expected: 'play'},
    ]

    for (const {from, transition, expected} of validCases) {
      it(`${from} --${transition}--> ${expected}`, () => {
        store.addTab(makeTab({id: 'tab_1', mode: from}))
        service.transition('tab_1', transition)
        const tab = store.getState().tabs.find(t => t.id === 'tab_1')
        assert.strictEqual(tab.mode, expected)
      })
    }
  })

  describe('invalid transitions (table-driven)', () => {
    const allModes = ['play', 'recall', 'analysis']
    const allTransitions = ['submit', 'complete', 'restart', 'snapshot']

    const invalidCases = []
    for (const from of allModes) {
      for (const t of allTransitions) {
        if (!VALID_PHASE_TRANSITIONS[from].includes(t)) {
          invalidCases.push({from, transition: t})
        }
      }
    }

    for (const {from, transition} of invalidCases) {
      it(`${from} --${transition}--> REJECTED`, () => {
        store.addTab(makeTab({id: 'tab_1', mode: from}))
        assert.throws(
          () => service.transition('tab_1', transition),
          (err) =>
            err instanceof InvalidPhaseTransitionError &&
            err.from === from &&
            err.transition === transition,
        )
      })
    }
  })

  it('transition on nonexistent tab throws', () => {
    assert.throws(
      () => service.transition('no_such_tab', 'submit'),
      /tab not found/,
    )
  })

  it('getMode returns null for nonexistent tab', () => {
    assert.strictEqual(service.getMode('no_such_tab'), null)
  })

  it('getValidTransitions returns correct list', () => {
    store.addTab(makeTab({id: 'tab_1', mode: 'play'}))
    assert.deepStrictEqual(service.getValidTransitions('tab_1'), ['submit'])
  })

  it('getValidTransitions returns empty for nonexistent tab', () => {
    assert.deepStrictEqual(service.getValidTransitions('no_such_tab'), [])
  })

  it('full lifecycle: play -> recall -> analysis -> play', () => {
    store.addTab(makeTab({id: 'tab_1', mode: 'play'}))

    service.transition('tab_1', 'submit')
    let tab = store.getState().tabs.find(t => t.id === 'tab_1')
    assert.strictEqual(tab.mode, 'recall')

    service.transition('tab_1', 'complete')
    tab = store.getState().tabs.find(t => t.id === 'tab_1')
    assert.strictEqual(tab.mode, 'analysis')

    service.transition('tab_1', 'restart')
    tab = store.getState().tabs.find(t => t.id === 'tab_1')
    assert.strictEqual(tab.mode, 'play')
  })

  it('invalid transition does not mutate mode', () => {
    store.addTab(makeTab({id: 'tab_1', mode: 'play'}))
    try {
      service.transition('tab_1', 'complete')
    } catch {}
    const tab = store.getState().tabs.find(t => t.id === 'tab_1')
    assert.strictEqual(tab.mode, 'play')
  })

  it('logs rejected transitions when logger provided', () => {
    const {logger, logs} = createTestLogger()
    const loggedService = createWorkbenchPhaseService({
      workbenchStore: store,
      repository: { loadTask: async () => null, createTask: async t => t, transaction: async fn => fn() },
      snapshotService: { captureSnapshotInput: async () => ({}), createProblemFromCurrentAnalysisPosition: async () => ({}) },
      tabService: { openSnapshotProblemTab: async () => ({}) },
      logger,
    })
    store.addTab(makeTab({id: 'tab_1', mode: 'play'}))
    try {
      loggedService.transition('tab_1', 'complete')
    } catch {}
    assert.strictEqual(logs.length, 1)
    assert.strictEqual(logs[0].channel, 'phase.transition.rejected')
    assert.strictEqual(logs[0].data.from, 'play')
    assert.strictEqual(logs[0].data.transition, 'complete')
  })

  // --- snapshot behavior ---

  describe('snapshot transition', () => {
    it('does not change current tab mode', () => {
      store.addTab(makeTab({id: 'tab_1', mode: 'analysis'}))
      service.transition('tab_1', 'snapshot')
      const tab = store.getState().tabs.find(t => t.id === 'tab_1')
      assert.strictEqual(tab.mode, 'analysis')
    })

    it('logs snapshot event', () => {
      const {logger, logs} = createTestLogger()
      const loggedService = createWorkbenchPhaseService({
        workbenchStore: store,
        repository: { loadTask: async () => null, createTask: async t => t, transaction: async fn => fn() },
        snapshotService: { captureSnapshotInput: async () => ({}), createProblemFromCurrentAnalysisPosition: async () => ({}) },
        tabService: { openSnapshotProblemTab: async () => ({}) },
        logger,
      })
      store.addTab(makeTab({id: 'tab_1', mode: 'analysis'}))
      loggedService.transition('tab_1', 'snapshot')
      assert.strictEqual(logs.length, 1)
      assert.strictEqual(logs[0].channel, 'phase.snapshot')
    })
  })

  // --- problem mode is valid but has no transitions in legacy service ---

  it('throws if tab has problem mode (unknown to legacy phaseService)', () => {
    store.addTab(makeTab({id: 'tab_1', mode: 'problem'}))
    assert.throws(
      () => service.transition('tab_1', 'submit'),
      /unknown phase/,
    )
  })

  it('getValidTransitions returns empty for problem mode', () => {
    store.addTab(makeTab({id: 'tab_1', mode: 'problem'}))
    assert.deepStrictEqual(service.getValidTransitions('tab_1'), [])
  })

  // --- updatedAt ---

  it('updates tab updatedAt after transition', () => {
    store.addTab(makeTab({
      id: 'tab_1',
      mode: 'play',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }))
    service.transition('tab_1', 'submit')
    const tab = store.getState().tabs.find(t => t.id === 'tab_1')
    assert.notStrictEqual(tab.updatedAt, '2026-01-01T00:00:00.000Z')
  })

  // --- snapshotFromAnalysis ---

  describe('snapshotFromAnalysis', () => {
    it('passes tab.taskId to captureSnapshotInput', async () => {
      const calls = []
      const spyService = createWorkbenchPhaseService({
        workbenchStore: store,
        repository: {
          loadTask: async () => ({ id: 'task_1', kind: 'problem', source: { kind: 'problem', problemId: 'p1' } }),
          createTask: async t => t,
          transaction: async fn => fn(),
        },
        snapshotService: {
          captureSnapshotInput: async input => {
            calls.push({ method: 'captureSnapshotInput', input })
            return { sourceTaskId: input.sourceTaskId, sourceAttemptId: input.sourceAttemptId, positionSgf: '(;SZ[9])', sideToMove: 'black' }
          },
          createProblemFromCurrentAnalysisPosition: async input => ({
            id: 'snap_1', positionSgf: input.positionSgf, sideToMove: input.sideToMove, status: 'inbox', tags: ['snapshot'],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          }),
        },
        taskImportService: {
          createTaskFromSnapshot: async input => ({
            id: 'task_snap_1',
            rootPositionSgf: input.positionSgf,
            sideToMove: input.sideToMove,
            origin: {provider: 'snapshot', parentTaskId: input.parentTaskId},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        },
        tabService: {
          openProblemTab: async opts => ({
            id: 'tab_snap_1', taskId: opts.taskId, mode: 'problem', parentTabId: opts.parentTabId, childTabIds: [],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          }),
          openTask: async opts => ({
            id: 'tab_snap_1', taskId: opts.taskId, mode: opts.mode, parentTabId: opts.parentTabId, childTabIds: [],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          }),
          openSnapshotProblemTab: async (problemId, opts) => ({
            id: 'tab_snap_1', taskId: 'task_snap_1', mode: 'play', parentTabId: opts?.parentTabId, childTabIds: [],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          }),
        },
      })

      store.addTab(makeTab({ id: 'tab_1', taskId: 'task_1', mode: 'analysis' }))
      await spyService.snapshotFromAnalysis('tab_1')

      assert.strictEqual(calls.length, 1)
      assert.strictEqual(calls[0].method, 'captureSnapshotInput')
      assert.strictEqual(calls[0].input.tabId, 'tab_1')
      assert.strictEqual(calls[0].input.sourceTaskId, 'task_1')
    })

    it('keeps original tab in analysis mode', async () => {
      store.addTab(makeTab({ id: 'tab_1', taskId: 'task_1', mode: 'analysis' }))

      await service.snapshotFromAnalysis('tab_1')

      const tab = store.getState().tabs.find(t => t.id === 'tab_1')
      assert.strictEqual(tab.mode, 'analysis')
    })

    it('returns new tab with problem mode', async () => {
      store.addTab(makeTab({ id: 'tab_1', taskId: 'task_1', mode: 'analysis' }))

      const newTab = await service.snapshotFromAnalysis('tab_1')

      assert.strictEqual(newTab.mode, 'problem')
      assert.strictEqual(newTab.parentTabId, 'tab_1')
    })

    it('P2-T03: creates snapshot task through taskImportService and opens it through openProblemTab', async () => {
      const calls = {
        createProblemFromCurrentAnalysisPosition: [],
        createTaskFromSnapshot: [],
        openProblemTab: [],
        openTask: [],
        openSnapshotProblemTab: [],
        createTask: [],
      }
      const spyService = createWorkbenchPhaseService({
        workbenchStore: store,
        repository: {
          loadTask: async () => ({ id: 'task_1', rootPositionSgf: '(;SZ[9])' }),
          createTask: async t => {
            calls.createTask.push(t)
            return t
          },
          transaction: async fn => fn(),
        },
        snapshotService: {
          captureSnapshotInput: async input => ({
            parentTaskId: input.sourceTaskId,
            positionSgf: '(;SZ[9])',
            sideToMove: 'black',
            moveIndex: 7,
          }),
          createProblemFromCurrentAnalysisPosition: async input => {
            calls.createProblemFromCurrentAnalysisPosition.push(input)
            return {id: 'legacy_problem'}
          },
        },
        taskImportService: {
          createTaskFromSnapshot: async input => {
            calls.createTaskFromSnapshot.push(input)
            return {
              id: 'task_snapshot_p2',
              rootPositionSgf: input.positionSgf,
              sideToMove: input.sideToMove,
              origin: {provider: 'snapshot', parentTaskId: input.parentTaskId},
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          },
        },
        tabService: {
          openProblemTab: async opts => {
            calls.openProblemTab.push(opts)
            return {
              id: 'tab_snapshot_p2',
              taskId: opts.taskId,
              mode: 'problem',
              parentTabId: opts.parentTabId,
              childTabIds: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          },
          openTask: async opts => {
            calls.openTask.push(opts)
            return {
              id: 'tab_snapshot_p2',
              taskId: opts.taskId,
              mode: opts.mode,
              parentTabId: opts.parentTabId,
              childTabIds: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          },
          openSnapshotProblemTab: async (problemId, opts) => {
            calls.openSnapshotProblemTab.push({problemId, opts})
            return {}
          },
        },
      })

      store.addTab(makeTab({ id: 'tab_1', taskId: 'task_1', mode: 'analysis' }))

      const newTab = await spyService.snapshotFromAnalysis('tab_1')

      assert.deepStrictEqual(calls.createTaskFromSnapshot, [{
        parentTaskId: 'task_1',
        positionSgf: '(;SZ[9])',
        sideToMove: 'black',
        moveIndex: 7,
      }])
      assert.deepStrictEqual(calls.openProblemTab, [{
        taskId: 'task_snapshot_p2',
        parentTabId: 'tab_1',
      }])
      assert.deepStrictEqual(calls.openTask, [])
      assert.strictEqual(calls.createProblemFromCurrentAnalysisPosition.length, 0)
      assert.strictEqual(calls.createTask.length, 0)
      assert.strictEqual(calls.openSnapshotProblemTab.length, 0)
      assert.strictEqual(newTab.id, 'tab_snapshot_p2')
    })

    it('throws if tab not found', async () => {
      await assert.rejects(
        () => service.snapshotFromAnalysis('nonexistent'),
        /tab not found/,
      )
    })

    it('throws if tab is not in analysis mode', async () => {
      store.addTab(makeTab({ id: 'tab_1', mode: 'play' }))

      await assert.rejects(
        () => service.snapshotFromAnalysis('tab_1'),
        /analysis/,
      )
    })

    it('throws if task not found', async () => {
      const failService = createWorkbenchPhaseService({
        workbenchStore: store,
        repository: {
          loadTask: async () => null,
        },
        snapshotService: { captureSnapshotInput: async () => ({}), createProblemFromCurrentAnalysisPosition: async () => ({}) },
        tabService: { openSnapshotProblemTab: async () => ({}) },
      })
      store.addTab(makeTab({ id: 'tab_fail', taskId: 'task_missing', mode: 'analysis' }))

      await assert.rejects(
        () => failService.snapshotFromAnalysis('tab_fail'),
        /task not found/,
      )
    })
  })
})

describe('VALID_PHASE_TRANSITIONS constants', () => {
  it('covers all three legacy phases', () => {
    assert.ok('play' in VALID_PHASE_TRANSITIONS)
    assert.ok('recall' in VALID_PHASE_TRANSITIONS)
    assert.ok('analysis' in VALID_PHASE_TRANSITIONS)
  })

  it('snapshot is only valid from analysis', () => {
    assert.ok(VALID_PHASE_TRANSITIONS.analysis.includes('snapshot'))
    assert.ok(!VALID_PHASE_TRANSITIONS.play.includes('snapshot'))
    assert.ok(!VALID_PHASE_TRANSITIONS.recall.includes('snapshot'))
  })
})

describe('PHASE_TRANSITION_RESULT constants', () => {
  it('maps every valid transition (except snapshot) to a result phase', () => {
    for (const phase of Object.keys(VALID_PHASE_TRANSITIONS)) {
      for (const t of VALID_PHASE_TRANSITIONS[phase]) {
        if (t === 'snapshot') continue
        const key = `${phase}:${t}`
        assert.ok(key in PHASE_TRANSITION_RESULT, `Missing result for ${key}`)
      }
    }
  })
})
