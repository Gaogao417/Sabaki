import assert from 'assert'

import { createSnapshotService } from '../../src/modules/training/analysis/snapshotService.ts'
import { createWorkbenchStore } from '../../src/modules/training/store/workbenchStore.ts'

// --- Fake dependencies ---

function makeTab(overrides = {}) {
  return {
    id: 'tab_1',
    taskId: 'task_1',
    phase: 'analysis',
    childTabIds: [],
    parentTabId: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function createFakeRepo(overrides = {}) {
  const problems = {}
  return {
    problems,
    async loadTask(taskId) {
      if (taskId === 'task_1') {
        return {
          id: 'task_1',
          kind: 'problem',
          source: { kind: 'problem', problemId: 'prob_1' },
          rootPositionSgf: '(;SZ[9]AB[dc]PL[B])',
          sideToMove: 'black',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }
      }
      if (taskId === 'task_game') {
        return {
          id: 'task_game',
          kind: 'game',
          source: { kind: 'game', gameId: 'game_1' },
          rootPositionSgf: '(;SZ[9])',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }
      }
      if (taskId === 'task_snap') {
        return {
          id: 'task_snap',
          kind: 'snapshot_problem',
          source: { kind: 'snapshot_problem', problemId: 'snap_orig' },
          rootPositionSgf: '(;SZ[9])',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }
      }
      return null
    },
    async createProblem(problem) {
      problems[problem.id] = { ...problem }
      return { ...problem }
    },
    ...overrides,
  }
}

function createFakeSnapshotAdapter(overrides = {}) {
  return {
    captureCurrentPosition() {
      return {
        positionSgf: '(;SZ[9]AB[dc]PL[B])',
        sideToMove: 'black',
        treePosition: 'node_5',
        moveNumber: 12,
        positionHash: 'hash_abc123',
      }
    },
    ...overrides,
  }
}

// --- Tests ---

describe('snapshotService', () => {
  let store, repo, adapter, service

  beforeEach(() => {
    store = createWorkbenchStore()
    repo = createFakeRepo()
    adapter = createFakeSnapshotAdapter()
    service = createSnapshotService({
      repository: repo,
      positionSnapshotAdapter: adapter,
      workbenchStore: store,
    })
  })

  describe('captureSnapshotInput', () => {
    it('captures position from adapter and resolves source fields', async () => {
      store.addTab(makeTab({ id: 'tab_1', taskId: 'task_1', phase: 'analysis' }))

      const input = await service.captureSnapshotInput({
        tabId: 'tab_1',
        sourceTaskId: 'task_1',
      })

      assert.strictEqual(input.sourceTaskId, 'task_1')
      assert.strictEqual(input.positionSgf, '(;SZ[9]AB[dc]PL[B])')
      assert.strictEqual(input.sideToMove, 'black')
      assert.strictEqual(input.sourceMoveIndex, 12)
      assert.strictEqual(input.sourceProblemId, 'prob_1')
    })

    it('resolves sourceGameId from game task', async () => {
      store.addTab(makeTab({ id: 'tab_2', taskId: 'task_game', phase: 'analysis' }))

      const input = await service.captureSnapshotInput({
        tabId: 'tab_2',
        sourceTaskId: 'task_game',
      })

      assert.strictEqual(input.sourceGameId, 'game_1')
      assert.strictEqual(input.sourceProblemId, undefined)
    })

    it('resolves sourceProblemId from snapshot_problem task', async () => {
      store.addTab(makeTab({ id: 'tab_3', taskId: 'task_snap', phase: 'analysis' }))

      const input = await service.captureSnapshotInput({
        tabId: 'tab_3',
        sourceTaskId: 'task_snap',
      })

      assert.strictEqual(input.sourceProblemId, 'snap_orig')
      assert.strictEqual(input.sourceGameId, undefined)
    })

    it('throws if tab not found', async () => {
      await assert.rejects(
        () => service.captureSnapshotInput({ tabId: 'missing', sourceTaskId: 'task_1' }),
        /tab not found/,
      )
    })

    // Phase 6 removed the analysis-only restriction.
    // The old test asserted that non-analysis modes throw.
    // New behavior: all modes are allowed — tested in C03-C06 below.

    it('throws if sourceTaskId does not match tab.taskId', async () => {
      store.addTab(makeTab({ id: 'tab_1', taskId: 'task_1', phase: 'analysis' }))

      await assert.rejects(
        () => service.captureSnapshotInput({ tabId: 'tab_1', sourceTaskId: 'task_2' }),
        /sourceTaskId.*does not match.*tab\.taskId/,
      )
    })

    it('throws if task not found', async () => {
      const noTaskService = createSnapshotService({
        repository: {
          async loadTask() { return null },
          async createProblem(p) { return p },
        },
        positionSnapshotAdapter: adapter,
        workbenchStore: store,
      })
      store.addTab(makeTab({ id: 'tab_ghost', taskId: 'task_ghost', phase: 'analysis' }))

      await assert.rejects(
        () => noTaskService.captureSnapshotInput({ tabId: 'tab_ghost', sourceTaskId: 'task_ghost' }),
        /task not found/,
      )
    })

    it('passes sourceAttemptId through', async () => {
      store.addTab(makeTab({ id: 'tab_1', taskId: 'task_1', phase: 'analysis' }))

      const input = await service.captureSnapshotInput({
        tabId: 'tab_1',
        sourceTaskId: 'task_1',
        sourceAttemptId: 'attempt_42',
      })

      assert.strictEqual(input.sourceAttemptId, 'attempt_42')
    })
  })

  describe('createProblemFromCurrentAnalysisPosition', () => {
    it('creates a problem with snapshot traceability fields', async () => {
      const input = {
        sourceTaskId: 'task_1',
        sourceAttemptId: 'attempt_1',
        sourceMoveIndex: 12,
        sourceProblemId: 'prob_1',
        positionSgf: '(;SZ[9]AB[dc]PL[B])',
        sideToMove: 'black',
      }

      const problem = await service.createProblemFromCurrentAnalysisPosition(input)

      assert.strictEqual(problem.type, 'best_move')
      assert.strictEqual(problem.positionSgf, input.positionSgf)
      assert.strictEqual(problem.sideToMove, 'black')
      assert.strictEqual(problem.status, 'inbox')
      assert.strictEqual(problem.sourceTaskId, 'task_1')
      assert.strictEqual(problem.sourceAttemptId, 'attempt_1')
      assert.strictEqual(problem.sourceMoveIndex, 12)
      assert.strictEqual(problem.sourceProblemId, 'prob_1')
      assert.ok(problem.tags.includes('snapshot'))
      assert.ok(problem.id)
      assert.ok(problem.createdAt)
      assert.ok(problem.updatedAt)
    })

    it('persists problem via repository', async () => {
      const input = {
        sourceTaskId: 'task_1',
        positionSgf: '(;SZ[9])',
        sideToMove: 'white',
      }

      const problem = await service.createProblemFromCurrentAnalysisPosition(input)

      assert.ok(repo.problems[problem.id])
      assert.strictEqual(repo.problems[problem.id].positionSgf, '(;SZ[9])')
    })

    it('includes reference lines when provided', async () => {
      const input = {
        sourceTaskId: 'task_1',
        positionSgf: '(;SZ[9])',
        sideToMove: 'black',
        referenceLines: [
          { label: 'AI main', moves: ['D4', 'Q16'], source: 'engine', scoreLead: 3.5 },
        ],
      }

      const problem = await service.createProblemFromCurrentAnalysisPosition(input)

      assert.strictEqual(problem.referenceLines.length, 1)
      assert.strictEqual(problem.referenceLines[0].label, 'AI main')
      assert.deepStrictEqual(problem.referenceLines[0].moves, ['D4', 'Q16'])
    })

    it('sets snapshotReason when provided', async () => {
      const input = {
        sourceTaskId: 'task_1',
        positionSgf: '(;SZ[9])',
        sideToMove: 'black',
        snapshotReason: 'interesting_position',
      }

      const problem = await service.createProblemFromCurrentAnalysisPosition(input)

      assert.strictEqual(problem.parentSnapshotReason, 'interesting_position')
    })

    it('generates unique IDs for each snapshot', async () => {
      const input = {
        sourceTaskId: 'task_1',
        positionSgf: '(;SZ[9])',
        sideToMove: 'black',
      }

      const p1 = await service.createProblemFromCurrentAnalysisPosition(input)
      const p2 = await service.createProblemFromCurrentAnalysisPosition(input)

      assert.notStrictEqual(p1.id, p2.id)
    })

    it('builds default pass rule matching evaluationRules thresholds', async () => {
      const input = {
        sourceTaskId: 'task_1',
        positionSgf: '(;SZ[9])',
        sideToMove: 'black',
      }

      const problem = await service.createProblemFromCurrentAnalysisPosition(input)

      assert.strictEqual(problem.passRule.scoreDropThreshold, 2.0)
      assert.strictEqual(problem.passRule.severeDropThreshold, 8.0)
      assert.strictEqual(problem.passRule.requireNoSevereBadMove, false)
      assert.strictEqual(problem.passRule.compareWithReference, false)
    })

    it('sets positionDescription and taskGoal as strings for user to fill', async () => {
      const input = {
        sourceTaskId: 'task_1',
        positionSgf: '(;SZ[9])',
        sideToMove: 'black',
      }

      const problem = await service.createProblemFromCurrentAnalysisPosition(input)

      assert.strictEqual(typeof problem.positionDescription, 'string')
      assert.strictEqual(typeof problem.taskGoal, 'string')
    })
  })

  describe('captureSnapshotInput + createProblemFromCurrentAnalysisPosition integration', () => {
    it('full flow: capture then create', async () => {
      store.addTab(makeTab({ id: 'tab_1', taskId: 'task_1', phase: 'analysis' }))

      const input = await service.captureSnapshotInput({
        tabId: 'tab_1',
        sourceTaskId: 'task_1',
        sourceAttemptId: 'attempt_1',
      })

      const problem = await service.createProblemFromCurrentAnalysisPosition(input)

      assert.strictEqual(problem.positionSgf, '(;SZ[9]AB[dc]PL[B])')
      assert.strictEqual(problem.sideToMove, 'black')
      assert.strictEqual(problem.sourceTaskId, 'task_1')
      assert.strictEqual(problem.sourceAttemptId, 'attempt_1')
      assert.strictEqual(problem.sourceProblemId, 'prob_1')
      assert.strictEqual(problem.sourceMoveIndex, 12)
    })
  })

  describe('logging', () => {
    it('logs capture and create events', async () => {
      const logs = []
      const loggedService = createSnapshotService({
        repository: repo,
        positionSnapshotAdapter: adapter,
        workbenchStore: store,
        logger: {
          info(channel, message, data) {
            logs.push({ channel, message, data })
          },
        },
      })

      store.addTab(makeTab({ id: 'tab_1', taskId: 'task_1', phase: 'analysis' }))

      const input = await loggedService.captureSnapshotInput({
        tabId: 'tab_1',
        sourceTaskId: 'task_1',
      })
      await loggedService.createProblemFromCurrentAnalysisPosition(input)

      const captureLog = logs.find(l => l.channel === 'snapshot.capture')
      const createLog = logs.find(l => l.channel === 'snapshot.create')

      assert.ok(captureLog, 'should log capture event')
      assert.strictEqual(captureLog.data.tabId, 'tab_1')
      assert.strictEqual(captureLog.data.sourceTaskId, 'task_1')

      assert.ok(createLog, 'should log create event')
      assert.strictEqual(createLog.data.sourceTaskId, 'task_1')
    })
  })

  // --- Phase 6: multi-mode capture (C03-C17) ---

  function makeTabWithOrigin(overrides = {}) {
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

  function createFakeRepoWithOrigin(overrides = {}) {
    return {
      problems: {},
      async loadTask(taskId) {
        if (taskId === 'task_1') {
          return {
            id: 'task_1',
            kind: 'problem',
            source: { kind: 'problem', problemId: 'prob_1' },
            origin: { provider: '101', externalId: 'prob_1' },
            rootPositionSgf: '(;SZ[9]AB[dc]PL[B])',
            sideToMove: 'black',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          }
        }
        if (taskId === 'task_fox') {
          return {
            id: 'task_fox',
            kind: 'game',
            source: { kind: 'game', gameId: 'game_1' },
            origin: { provider: 'fox', externalId: 'game_fox_1' },
            rootPositionSgf: '(;SZ[9])',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          }
        }
        if (taskId === 'task_no_origin') {
          return {
            id: 'task_no_origin',
            kind: 'problem',
            source: { kind: 'problem', problemId: 'prob_no_origin' },
            // No origin field
            rootPositionSgf: '(;SZ[9])',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          }
        }
        if (taskId === 'task_unknown_provider') {
          return {
            id: 'task_unknown_provider',
            origin: { provider: 'weird_provider', externalId: 'ext_99' },
            rootPositionSgf: '(;SZ[9])',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          }
        }
        return null
      },
      async createProblem(problem) {
        this.problems[problem.id] = { ...problem }
        return { ...problem }
      },
      ...overrides,
    }
  }

  describe('Phase 6: multi-mode capture (C03-C17)', () => {
    let multiStore, multiRepo, multiAdapter, multiService

    beforeEach(() => {
      multiStore = createWorkbenchStore()
      multiRepo = createFakeRepoWithOrigin()
      multiAdapter = createFakeSnapshotAdapter()
      multiService = createSnapshotService({
        repository: multiRepo,
        positionSnapshotAdapter: multiAdapter,
        workbenchStore: multiStore,
      })
    })

    describe('C03: captureSnapshotInput succeeds from play mode', () => {
      it('returns valid snapshot input from play tab', async () => {
        multiStore.addTab(makeTabWithOrigin({ id: 'tab_play', taskId: 'task_1', mode: 'play' }))

        const input = await multiService.captureSnapshotInput({
          tabId: 'tab_play',
          sourceTaskId: 'task_1',
        })

        assert.strictEqual(input.sourceTaskId, 'task_1')
        assert.strictEqual(input.positionSgf, '(;SZ[9]AB[dc]PL[B])')
        assert.strictEqual(input.sideToMove, 'black')
      })
    })

    describe('C04: captureSnapshotInput succeeds from problem mode', () => {
      it('returns valid snapshot input from problem tab', async () => {
        multiStore.addTab(makeTabWithOrigin({ id: 'tab_prob', taskId: 'task_1', mode: 'problem' }))

        const input = await multiService.captureSnapshotInput({
          tabId: 'tab_prob',
          sourceTaskId: 'task_1',
        })

        assert.strictEqual(input.sourceTaskId, 'task_1')
        assert.strictEqual(input.positionSgf, '(;SZ[9]AB[dc]PL[B])')
      })
    })

    describe('C05: captureSnapshotInput succeeds from recall mode', () => {
      it('returns valid snapshot input from recall tab', async () => {
        multiStore.addTab(makeTabWithOrigin({ id: 'tab_recall', taskId: 'task_1', mode: 'recall' }))

        const input = await multiService.captureSnapshotInput({
          tabId: 'tab_recall',
          sourceTaskId: 'task_1',
        })

        assert.strictEqual(input.sourceTaskId, 'task_1')
        assert.strictEqual(input.positionSgf, '(;SZ[9]AB[dc]PL[B])')
      })
    })

    describe('C06: captureSnapshotInput still works from analysis mode (regression)', () => {
      it('returns valid snapshot input from analysis tab', async () => {
        multiStore.addTab(makeTabWithOrigin({ id: 'tab_analysis', taskId: 'task_1', mode: 'analysis' }))

        const input = await multiService.captureSnapshotInput({
          tabId: 'tab_analysis',
          sourceTaskId: 'task_1',
        })

        assert.strictEqual(input.sourceTaskId, 'task_1')
        assert.strictEqual(input.positionSgf, '(;SZ[9]AB[dc]PL[B])')
        assert.strictEqual(input.sideToMove, 'black')
      })
    })

    describe('C07: Position fields come from adapter', () => {
      it('returns positionSgf, sideToMove, and sourceMoveIndex from adapter', async () => {
        const customAdapter = {
          captureCurrentPosition() {
            return {
              positionSgf: '(;SZ[19]AB[pd])',
              sideToMove: 'white',
              treePosition: 'node_10',
              moveNumber: 42,
              positionHash: 'hash_custom',
            }
          },
        }
        const customService = createSnapshotService({
          repository: multiRepo,
          positionSnapshotAdapter: customAdapter,
          workbenchStore: multiStore,
        })
        multiStore.addTab(makeTabWithOrigin({ id: 'tab_c7', taskId: 'task_1', mode: 'play' }))

        const input = await customService.captureSnapshotInput({
          tabId: 'tab_c7',
          sourceTaskId: 'task_1',
        })

        assert.strictEqual(input.positionSgf, '(;SZ[19]AB[pd])')
        assert.strictEqual(input.sideToMove, 'white')
        assert.strictEqual(input.sourceMoveIndex, 42)
      })
    })

    describe('C08: Source resolution uses task.origin (not deprecated task.source)', () => {
      it('reads from task.origin.provider for source resolution', async () => {
        // task_1 has origin.provider === '101'
        multiStore.addTab(makeTabWithOrigin({ id: 'tab_c8', taskId: 'task_1', mode: 'play' }))

        const input = await multiService.captureSnapshotInput({
          tabId: 'tab_c8',
          sourceTaskId: 'task_1',
        })

        // sourceProblemId should come from origin.provider === '101', not from task.source.kind
        assert.strictEqual(input.sourceProblemId, 'prob_1')
      })
    })

    describe('C09: sourceGameId set when origin.provider === fox', () => {
      it('sets sourceGameId from task.origin.externalId for fox provider', async () => {
        multiStore.addTab(makeTabWithOrigin({ id: 'tab_fox', taskId: 'task_fox', mode: 'play' }))

        const input = await multiService.captureSnapshotInput({
          tabId: 'tab_fox',
          sourceTaskId: 'task_fox',
        })

        assert.strictEqual(input.sourceGameId, 'game_fox_1')
        assert.strictEqual(input.sourceProblemId, undefined)
      })
    })

    describe('C10: sourceProblemId set when origin.provider === 101', () => {
      it('sets sourceProblemId from task.origin.externalId for 101 provider', async () => {
        multiStore.addTab(makeTabWithOrigin({ id: 'tab_101', taskId: 'task_1', mode: 'play' }))

        const input = await multiService.captureSnapshotInput({
          tabId: 'tab_101',
          sourceTaskId: 'task_1',
        })

        assert.strictEqual(input.sourceProblemId, 'prob_1')
        assert.strictEqual(input.sourceGameId, undefined)
      })
    })

    describe('C11: No sourceGameId/sourceProblemId when origin absent or unrecognized', () => {
      it('omits both fields when task has no origin', async () => {
        multiStore.addTab(makeTabWithOrigin({ id: 'tab_no', taskId: 'task_no_origin', mode: 'play' }))

        const input = await multiService.captureSnapshotInput({
          tabId: 'tab_no',
          sourceTaskId: 'task_no_origin',
        })

        assert.strictEqual(input.sourceGameId, undefined)
        assert.strictEqual(input.sourceProblemId, undefined)
      })

      it('omits both fields when origin.provider is unrecognized', async () => {
        multiStore.addTab(makeTabWithOrigin({ id: 'tab_un', taskId: 'task_unknown_provider', mode: 'play' }))

        const input = await multiService.captureSnapshotInput({
          tabId: 'tab_un',
          sourceTaskId: 'task_unknown_provider',
        })

        assert.strictEqual(input.sourceGameId, undefined)
        assert.strictEqual(input.sourceProblemId, undefined)
      })
    })

    describe('C12: sourceAttemptId pass-through', () => {
      it('passes provided sourceAttemptId to output unchanged', async () => {
        multiStore.addTab(makeTabWithOrigin({ id: 'tab_c12', taskId: 'task_1', mode: 'play' }))

        const input = await multiService.captureSnapshotInput({
          tabId: 'tab_c12',
          sourceTaskId: 'task_1',
          sourceAttemptId: 'attempt_99',
        })

        assert.strictEqual(input.sourceAttemptId, 'attempt_99')
      })
    })

    describe('C13: sourceAttemptId defaults to tab.activeAttemptId', () => {
      it('uses tab.activeAttemptId when sourceAttemptId is not provided', async () => {
        multiStore.addTab(makeTabWithOrigin({
          id: 'tab_c13',
          taskId: 'task_1',
          mode: 'play',
          activeAttemptId: 'att_default',
        }))

        const input = await multiService.captureSnapshotInput({
          tabId: 'tab_c13',
          sourceTaskId: 'task_1',
        })

        assert.strictEqual(input.sourceAttemptId, 'att_default')
      })
    })

    describe('C14: captureSnapshotInput throws when tab not found', () => {
      it('throws with descriptive error for missing tab', async () => {
        await assert.rejects(
          () => multiService.captureSnapshotInput({ tabId: 'missing', sourceTaskId: 'task_1' }),
          /tab not found/,
        )
      })
    })

    describe('C15: captureSnapshotInput throws when sourceTaskId does not match tab.taskId', () => {
      it('throws when sourceTaskId differs from tab.taskId', async () => {
        multiStore.addTab(makeTabWithOrigin({ id: 'tab_c15', taskId: 'task_1', mode: 'play' }))

        await assert.rejects(
          () => multiService.captureSnapshotInput({ tabId: 'tab_c15', sourceTaskId: 'task_wrong' }),
          /sourceTaskId.*does not match.*tab\.taskId/,
        )
      })
    })

    describe('C16: captureSnapshotInput throws when task not found in repository', () => {
      it('throws when repository returns null for the task', async () => {
        const noTaskRepo = createFakeRepoWithOrigin({
          async loadTask() { return null },
        })
        const noTaskService = createSnapshotService({
          repository: noTaskRepo,
          positionSnapshotAdapter: multiAdapter,
          workbenchStore: multiStore,
        })
        multiStore.addTab(makeTabWithOrigin({ id: 'tab_ghost', taskId: 'task_ghost', mode: 'play' }))

        await assert.rejects(
          () => noTaskService.captureSnapshotInput({ tabId: 'tab_ghost', sourceTaskId: 'task_ghost' }),
          /task not found/,
        )
      })
    })

    describe('C17: Logging', () => {
      it('logs capture event with tabId, sourceTaskId, positionHash', async () => {
        const logs = []
        const loggedService = createSnapshotService({
          repository: multiRepo,
          positionSnapshotAdapter: multiAdapter,
          workbenchStore: multiStore,
          logger: {
            info(channel, message, data) {
              logs.push({ channel, message, data })
            },
          },
        })
        multiStore.addTab(makeTabWithOrigin({ id: 'tab_c17', taskId: 'task_1', mode: 'recall' }))

        await loggedService.captureSnapshotInput({
          tabId: 'tab_c17',
          sourceTaskId: 'task_1',
        })

        const captureLog = logs.find(l => l.channel === 'snapshot.capture')
        assert.ok(captureLog, 'should log capture event')
        assert.strictEqual(captureLog.data.tabId, 'tab_c17')
        assert.strictEqual(captureLog.data.sourceTaskId, 'task_1')
        assert.strictEqual(captureLog.data.positionHash, 'hash_abc123')
      })
    })
  })
})
