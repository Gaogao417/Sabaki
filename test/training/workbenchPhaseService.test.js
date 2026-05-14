import assert from 'assert'

import {
  createWorkbenchPhaseService,
  VALID_PHASE_TRANSITIONS,
  PHASE_TRANSITION_RESULT,
  InvalidPhaseTransitionError,
} from '../../src/modules/training/workbench/workbenchPhaseService.ts'
import {createWorkbenchStore} from '../../src/modules/training/store/workbenchStore.ts'

function makeTab(overrides = {}) {
  return {
    id: 'tab_1',
    taskId: 'task_1',
    phase: 'play',
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
    service = createWorkbenchPhaseService({
      workbenchStore: store,
      repository: {
        loadTask: async () => ({ id: 'task_1', kind: 'problem', source: { kind: 'problem', problemId: 'p1' } }),
        createTask: async t => t,
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
      tabService: {
        openSnapshotProblemTab: async (problemId, opts) => ({
          id: 'tab_snap_1',
          taskId: 'task_snap_1',
          phase: 'play',
          parentTabId: opts?.parentTabId,
          childTabIds: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
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
        store.addTab(makeTab({id: 'tab_1', phase: from}))
        service.transition('tab_1', transition)
        assert.strictEqual(service.getPhase('tab_1'), expected)
      })
    }
  })

  describe('invalid transitions (table-driven)', () => {
    const allPhases = ['play', 'recall', 'analysis']
    const allTransitions = ['submit', 'complete', 'restart', 'snapshot']

    const invalidCases = []
    for (const from of allPhases) {
      for (const t of allTransitions) {
        if (!VALID_PHASE_TRANSITIONS[from].includes(t)) {
          invalidCases.push({from, transition: t})
        }
      }
    }

    for (const {from, transition} of invalidCases) {
      it(`${from} --${transition}--> REJECTED`, () => {
        store.addTab(makeTab({id: 'tab_1', phase: from}))
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

  it('getPhase returns null for nonexistent tab', () => {
    assert.strictEqual(service.getPhase('no_such_tab'), null)
  })

  it('getValidTransitions returns correct list', () => {
    store.addTab(makeTab({id: 'tab_1', phase: 'play'}))
    assert.deepStrictEqual(service.getValidTransitions('tab_1'), ['submit'])
  })

  it('getValidTransitions returns empty for nonexistent tab', () => {
    assert.deepStrictEqual(service.getValidTransitions('no_such_tab'), [])
  })

  it('full lifecycle: play -> recall -> analysis -> play', () => {
    store.addTab(makeTab({id: 'tab_1', phase: 'play'}))

    service.transition('tab_1', 'submit')
    assert.strictEqual(service.getPhase('tab_1'), 'recall')

    service.transition('tab_1', 'complete')
    assert.strictEqual(service.getPhase('tab_1'), 'analysis')

    service.transition('tab_1', 'restart')
    assert.strictEqual(service.getPhase('tab_1'), 'play')
  })

  it('invalid transition does not mutate phase', () => {
    store.addTab(makeTab({id: 'tab_1', phase: 'play'}))
    try {
      service.transition('tab_1', 'complete')
    } catch {}
    assert.strictEqual(service.getPhase('tab_1'), 'play')
  })

  it('logs rejected transitions when logger provided', () => {
    const logs = []
    const loggedService = createWorkbenchPhaseService({
      workbenchStore: store,
      repository: { loadTask: async () => null, createTask: async t => t },
      snapshotService: { captureSnapshotInput: async () => ({}), createProblemFromCurrentAnalysisPosition: async () => ({}) },
      tabService: { openSnapshotProblemTab: async () => ({}) },
      logger: {
        info(channel, message, data) {
          logs.push({channel, message, data})
        },
      },
    })
    store.addTab(makeTab({id: 'tab_1', phase: 'play'}))
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
    it('does not change current tab phase', () => {
      store.addTab(makeTab({id: 'tab_1', phase: 'analysis'}))
      service.transition('tab_1', 'snapshot')
      assert.strictEqual(service.getPhase('tab_1'), 'analysis')
    })

    it('logs snapshot event', () => {
      const logs = []
      const loggedService = createWorkbenchPhaseService({
        workbenchStore: store,
        repository: { loadTask: async () => null, createTask: async t => t },
        snapshotService: { captureSnapshotInput: async () => ({}), createProblemFromCurrentAnalysisPosition: async () => ({}) },
        tabService: { openSnapshotProblemTab: async () => ({}) },
        logger: {
          info(channel, message, data) {
            logs.push({channel, message, data})
          },
        },
      })
      store.addTab(makeTab({id: 'tab_1', phase: 'analysis'}))
      loggedService.transition('tab_1', 'snapshot')
      assert.strictEqual(logs.length, 1)
      assert.strictEqual(logs[0].channel, 'phase.snapshot')
    })
  })

  // --- unknown phase guard ---

  it('throws if tab has unknown phase', () => {
    store.addTab(makeTab({id: 'tab_1', phase: 'problem'}))
    assert.throws(
      () => service.transition('tab_1', 'submit'),
      /unknown phase/,
    )
  })

  it('getValidTransitions returns empty for unknown phase', () => {
    store.addTab(makeTab({id: 'tab_1', phase: 'problem'}))
    assert.deepStrictEqual(service.getValidTransitions('tab_1'), [])
  })

  // --- updatedAt ---

  it('updates tab updatedAt after transition', () => {
    store.addTab(makeTab({
      id: 'tab_1',
      phase: 'play',
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
        tabService: {
          openSnapshotProblemTab: async (problemId, opts) => ({
            id: 'tab_snap_1', taskId: 'task_snap_1', phase: 'play', parentTabId: opts?.parentTabId, childTabIds: [],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          }),
        },
      })

      store.addTab(makeTab({ id: 'tab_1', taskId: 'task_1', phase: 'analysis' }))
      await spyService.snapshotFromAnalysis('tab_1')

      assert.strictEqual(calls.length, 1)
      assert.strictEqual(calls[0].method, 'captureSnapshotInput')
      assert.strictEqual(calls[0].input.tabId, 'tab_1')
      assert.strictEqual(calls[0].input.sourceTaskId, 'task_1')
    })

    it('calls createTask with kind=snapshot_problem and correct source', async () => {
      const calls = []
      const spyService = createWorkbenchPhaseService({
        workbenchStore: store,
        repository: {
          loadTask: async () => ({ id: 'task_1', kind: 'problem', source: { kind: 'problem', problemId: 'p1' } }),
          createTask: async task => {
            calls.push({ method: 'createTask', task })
            return task
          },
        },
        snapshotService: {
          captureSnapshotInput: async () => ({ sourceTaskId: 'task_1', positionSgf: '(;SZ[9]AB[dc])', sideToMove: 'black' }),
          createProblemFromCurrentAnalysisPosition: async () => ({
            id: 'snap_prob_1', positionSgf: '(;SZ[9]AB[dc])', sideToMove: 'black', status: 'inbox',
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          }),
        },
        tabService: {
          openSnapshotProblemTab: async (problemId, opts) => ({
            id: 'tab_snap_1', taskId: 'task_snap_1', phase: 'play', parentTabId: opts?.parentTabId, childTabIds: [],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          }),
        },
      })

      store.addTab(makeTab({ id: 'tab_1', taskId: 'task_1', phase: 'analysis' }))
      await spyService.snapshotFromAnalysis('tab_1')

      const createCall = calls.find(c => c.method === 'createTask')
      assert.ok(createCall, 'should call createTask')
      assert.strictEqual(createCall.task.kind, 'snapshot_problem')
      assert.strictEqual(createCall.task.source.kind, 'snapshot_problem')
      assert.strictEqual(createCall.task.source.problemId, 'snap_prob_1')
      assert.strictEqual(createCall.task.source.parentTaskId, 'task_1')
    })

    it('calls openSnapshotProblemTab with correct problemId and parentTabId', async () => {
      const calls = []
      const spyService = createWorkbenchPhaseService({
        workbenchStore: store,
        repository: {
          loadTask: async () => ({ id: 'task_1', kind: 'problem', source: { kind: 'problem', problemId: 'p1' } }),
          createTask: async t => t,
        },
        snapshotService: {
          captureSnapshotInput: async () => ({ sourceTaskId: 'task_1', positionSgf: '(;SZ[9])', sideToMove: 'black' }),
          createProblemFromCurrentAnalysisPosition: async () => ({
            id: 'snap_prob_42', positionSgf: '(;SZ[9])', sideToMove: 'black', status: 'inbox',
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          }),
        },
        tabService: {
          openSnapshotProblemTab: async (problemId, opts) => {
            calls.push({ problemId, opts })
            return {
              id: 'tab_snap_1', taskId: 'task_snap_1', phase: 'play', parentTabId: opts?.parentTabId, childTabIds: [],
              createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            }
          },
        },
      })

      store.addTab(makeTab({ id: 'tab_1', taskId: 'task_1', phase: 'analysis' }))
      await spyService.snapshotFromAnalysis('tab_1')

      assert.strictEqual(calls.length, 1)
      assert.strictEqual(calls[0].problemId, 'snap_prob_42')
      assert.strictEqual(calls[0].opts.parentTabId, 'tab_1')
    })

    it('keeps original tab in analysis phase', async () => {
      store.addTab(makeTab({ id: 'tab_1', taskId: 'task_1', phase: 'analysis' }))

      await service.snapshotFromAnalysis('tab_1')

      assert.strictEqual(service.getPhase('tab_1'), 'analysis')
    })

    it('returns new tab with play phase', async () => {
      store.addTab(makeTab({ id: 'tab_1', taskId: 'task_1', phase: 'analysis' }))

      const newTab = await service.snapshotFromAnalysis('tab_1')

      assert.strictEqual(newTab.phase, 'play')
      assert.strictEqual(newTab.parentTabId, 'tab_1')
    })

    it('throws if tab not found', async () => {
      await assert.rejects(
        () => service.snapshotFromAnalysis('nonexistent'),
        /tab not found/,
      )
    })

    it('throws if tab is not in analysis phase', async () => {
      store.addTab(makeTab({ id: 'tab_1', phase: 'play' }))

      await assert.rejects(
        () => service.snapshotFromAnalysis('tab_1'),
        /must be in analysis phase/,
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
      store.addTab(makeTab({ id: 'tab_fail', taskId: 'task_missing', phase: 'analysis' }))

      await assert.rejects(
        () => failService.snapshotFromAnalysis('tab_fail'),
        /task not found/,
      )
    })
  })
})

describe('VALID_PHASE_TRANSITIONS constants', () => {
  it('covers all three phases', () => {
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
