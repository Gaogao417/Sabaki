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

    it('throws if tab is not in analysis phase', async () => {
      store.addTab(makeTab({ id: 'tab_play', phase: 'play' }))

      await assert.rejects(
        () => service.captureSnapshotInput({ tabId: 'tab_play', sourceTaskId: 'task_1' }),
        /must be in analysis phase/,
      )
    })

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
})
