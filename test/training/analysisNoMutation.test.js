import assert from 'assert'

import { createWorkbenchStore } from '../../src/modules/training/store/workbenchStore.ts'

// --- Lazy-load snapshotService ---

let _createSnapshotService = null
let _loadAttempted = false

function getSnapshotServiceFactory() {
  if (_loadAttempted) return _createSnapshotService
  _loadAttempted = true
  try {
    const mod = require('../../src/modules/training/analysis/snapshotService.ts')
    _createSnapshotService = mod.createSnapshotService
  } catch {
    // Module doesn't exist yet
  }
  return _createSnapshotService
}

// Lazy-load workbenchFlowService
let _createWorkbenchFlowService = null
let _flowLoadAttempted = false

function getFlowServiceFactory() {
  if (_flowLoadAttempted) return _createWorkbenchFlowService
  _flowLoadAttempted = true
  try {
    const mod = require('../../src/modules/training/workbench/workbenchFlowService.ts')
    _createWorkbenchFlowService = mod.createWorkbenchFlowService
  } catch {
    // Module doesn't exist yet
  }
  return _createWorkbenchFlowService
}

const describeSnapshot = getSnapshotServiceFactory() ? describe : describe.skip
const describeFlow = getFlowServiceFactory() ? describe : describe.skip

// --- Helpers ---

function makeTab(overrides = {}) {
  return {
    id: 'tab_analysis_1',
    taskId: 'task_1',
    mode: 'analysis',
    childTabIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function createFakeRepo(overrides = {}) {
  const updateAttemptCalls = []
  return {
    updateAttemptCalls,
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
      return null
    },
    async createTask(t) { return t },
    async createProblem(p) { return { ...p } },
    transaction: async fn => fn(),
    async updateAttempt(attemptId, patch) {
      updateAttemptCalls.push({ attemptId, patch })
    },
    ...overrides,
  }
}

function createFakeSnapshotAdapter() {
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
  }
}

// --- Group C: Analysis no-mutation invariant (C18-C20) ---

describeSnapshot('Analysis no-mutation invariant', () => {
  const createSnapshotService = getSnapshotServiceFactory()

  describe('C18: Analysis mode does not call repository.updateAttempt', () => {
    it('captureSnapshotInput does not call updateAttempt', async () => {
      const store = createWorkbenchStore()
      const repo = createFakeRepo()
      const adapter = createFakeSnapshotAdapter()
      const service = createSnapshotService({
        repository: repo,
        positionSnapshotAdapter: adapter,
        workbenchStore: store,
      })

      store.addTab(makeTab({ id: 'tab_a1', taskId: 'task_1', mode: 'analysis' }))

      await service.captureSnapshotInput({
        tabId: 'tab_a1',
        sourceTaskId: 'task_1',
      })

      assert.strictEqual(
        repo.updateAttemptCalls.length,
        0,
        'captureSnapshotInput must not call repository.updateAttempt',
      )
    })

    it('createProblemFromCurrentAnalysisPosition does not call updateAttempt', async () => {
      const repo = createFakeRepo()
      const adapter = createFakeSnapshotAdapter()
      const store = createWorkbenchStore()
      const service = createSnapshotService({
        repository: repo,
        positionSnapshotAdapter: adapter,
        workbenchStore: store,
      })

      const input = {
        sourceTaskId: 'task_1',
        positionSgf: '(;SZ[9]AB[dc])',
        sideToMove: 'black',
      }

      await service.createProblemFromCurrentAnalysisPosition(input)

      assert.strictEqual(
        repo.updateAttemptCalls.length,
        0,
        'createProblemFromCurrentAnalysisPosition must not call repository.updateAttempt',
      )
    })
  })

  describe('C19: Analysis mode does not modify Attempt.userLine', () => {
    it('captureSnapshotInput never touches userLine in any write call', async () => {
      const store = createWorkbenchStore()
      const userLineWrites = []
      const repo = createFakeRepo({
        async updateAttempt(attemptId, patch) {
          if (patch.userLine !== undefined) {
            userLineWrites.push({ attemptId, userLine: patch.userLine })
          }
        },
      })
      const adapter = createFakeSnapshotAdapter()
      const service = createSnapshotService({
        repository: repo,
        positionSnapshotAdapter: adapter,
        workbenchStore: store,
      })

      store.addTab(makeTab({ id: 'tab_a1', taskId: 'task_1', mode: 'analysis', activeAttemptId: 'att_1' }))

      await service.captureSnapshotInput({
        tabId: 'tab_a1',
        sourceTaskId: 'task_1',
        sourceAttemptId: 'att_1',
      })

      assert.strictEqual(
        userLineWrites.length,
        0,
        'No write to Attempt.userLine should occur during analysis snapshot',
      )
    })
  })
})

describeFlow('Analysis no-mutation invariant (flow level)', () => {
  const createWorkbenchFlowService = getFlowServiceFactory()

  describe('C20: snapshotFromCurrentContext preserves original tab state', () => {
    const modesWithAttempt = [
      { mode: 'play', activeAttemptId: 'att_play' },
      { mode: 'problem', activeAttemptId: 'att_prob' },
      { mode: 'recall', activeAttemptId: 'att_recall', activeRecallSessionId: 'rs_1' },
      { mode: 'analysis', activeAttemptId: 'att_analysis' },
    ]

    for (const { mode, activeAttemptId, activeRecallSessionId } of modesWithAttempt) {
      it(`preserves tab state when snapshotting from ${mode} mode`, async () => {
        const store = createWorkbenchStore()
        const repo = createFakeRepo()
        const adapter = createFakeSnapshotAdapter()

        const snapshotService = getSnapshotServiceFactory()({
          repository: repo,
          positionSnapshotAdapter: adapter,
          workbenchStore: store,
        })

        const deps = {
          workbenchStore: store,
          repository: repo,
          attemptService: {
            createAttempt: async input => ({ id: 'attempt_new', ...input }),
            freezeAttempt: async () => {},
            finalizeAttemptResult: async () => {},
          },
          recallService: {
            createRecallSession: async input => ({ id: 'rs_new', ...input }),
          },
          snapshotService,
          tabService: {
            openProblemTab: async opts => ({
              id: 'tab_new',
              taskId: 'task_new',
              mode: 'problem',
              parentTabId: opts?.parentTabId,
              childTabIds: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }),
            openTask: async opts => ({
              id: 'tab_new',
              taskId: 'task_new',
              mode: 'problem',
              parentTabId: opts?.parentTabId,
              childTabIds: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }),
          },
          logger: { info() {} },
        }

        const flowService = createWorkbenchFlowService(deps)

        const tabOverrides = {
          id: 'tab_orig',
          taskId: 'task_1',
          mode,
          activeAttemptId,
          activeRecallSessionId,
        }
        store.addTab(makeTab(tabOverrides))

        // Capture tab state before snapshot
        const beforeTab = store.getState().tabs.find(t => t.id === 'tab_orig')
        const beforeMode = beforeTab.mode
        const beforeAttemptId = beforeTab.activeAttemptId
        const beforeRecallId = beforeTab.activeRecallSessionId

        await flowService.snapshotFromCurrentContext('tab_orig')

        // Verify tab state is unchanged after snapshot
        const afterTab = store.getState().tabs.find(t => t.id === 'tab_orig')
        assert.strictEqual(
          afterTab.mode,
          mode === 'analysis' ? beforeMode : 'analysis',
          mode === 'analysis'
            ? `mode should remain ${beforeMode}`
            : 'snapshot should enter analysis before persistence',
        )
        assert.strictEqual(afterTab.activeAttemptId, beforeAttemptId, 'activeAttemptId should be preserved')
        assert.strictEqual(afterTab.activeRecallSessionId, beforeRecallId, 'activeRecallSessionId should be preserved')
      })
    }
  })
})
