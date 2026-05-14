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
    service = createWorkbenchPhaseService({workbenchStore: store})
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
