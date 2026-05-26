/**
 * Snapshot Null TaskId Wiring Tests (T-SNAPSHOT-FREEPLAY)
 *
 * Proves that snapshot on a default tab with taskId:null does NOT crash.
 * This is the user-facing bug: App.js creates a default free-play tab with
 * taskId:null on startup, and clicking snapshot crashes because
 * snapshotService.captureSnapshotInput calls repository.loadTask(null).
 *
 * Remediation plan source: remediation_plan.md (BUG-2: Snapshot Null TaskId)
 *
 * v0.5 alignment:
 *   - PRD v0.5: default free-play tab is valid (taskId: null)
 *   - Arch v0.5: snapshotService should support parentless snapshots
 *   - Remediation plan BUG-2: make sourceTaskId optional, skip task load when null
 *
 * Test classification:
 *   - T-SNAPSHOT-NULL-1: CRASH_PREVENTION -- snapshotFromCurrentContext does not throw
 *   - T-SNAPSHOT-NULL-2: STATE_ASSERTION -- result includes snapshot task with no parent
 *   - T-SNAPSHOT-NULL-3: SERVICE_INTEGRATION -- tabService.openTask called with new ID
 *
 * Harness manifest:
 *   - Real production modules: createWorkbenchFlowService, createSnapshotService,
 *     createWorkbenchStore, createTrainingRuntimeStore, createLoggerService,
 *     createConsoleWriter, createSpyTabService (from shared spy factory)
 *   - In-memory repository fake (inline) -- only createTask/loadTask needed
 *   - Mock positionSnapshotAdapter -- returns fixed snapshot
 *   - Spy attemptService -- provides createAttempt/freezeAttempt/finalizeAttemptResult
 *   - Spy recallService -- provides createRecallSession/completeRecall
 *   - Spy factory source: workbenchSpyFactories.ts (createSpyTabService),
 *     inline stubs for attemptService and recallService
 *   - Valid for: CRASH_PREVENTION, STATE_ASSERTION, SERVICE_INTEGRATION
 *   - Not valid for: RENDERED_UI_RETURN, REPOSITORY_PERSISTENCE
 *
 * Long-term vs migration:
 *   - All tests are RED until BUG-2 is fixed.
 *   - T-SNAPSHOT-NULL-1 is the critical regression test -- it MUST pass for the fix.
 *   - T-SNAPSHOT-NULL-2 and T-SNAPSHOT-NULL-3 verify the snapshot behavior is correct.
 *
 * Fragile test warnings:
 *   1. The mock positionSnapshotAdapter must satisfy the PositionSnapshotAdapter interface.
 *   2. The in-memory repository must support createTask/loadTask/transaction.
 *   3. Tests rely on workbenchFlowService calling tabService.openTask -- if the flow
 *      changes, the assertion must change too.
 */

import assert from 'assert'

// --- Real production imports ---

import {createWorkbenchFlowService} from '../../../src/modules/training/workbench/workbenchFlowService.ts'
import {createSnapshotService} from '../../../src/modules/training/analysis/snapshotService.ts'
import {createWorkbenchStore} from '../../../src/modules/training/store/workbenchStore.ts'
import {createTrainingRuntimeStore} from '../../../src/modules/training/store/trainingRuntimeStore.ts'
import {createSpyTabService} from '../shared/workbenchSpyFactories.ts'
import {createLoggerService} from '../../../src/modules/logger/LoggerService.js'
import {createConsoleWriter} from '../../../src/modules/logger/consoleWriter.js'

// --- Logger for test harness (real, not mocked) ---

const logger = createLoggerService({writers: [createConsoleWriter()]})

// --- In-memory repository ---

/**
 * Minimal in-memory repository for snapshot flow tests.
 * Only implements methods needed by workbenchFlowService.snapshotFromCurrentContext
 * and snapshotService.captureSnapshotInput.
 */
function createInMemoryRepository() {
  const tasks = new Map()
  const sessions = new Map()
  const attempts = new Map()
  const recallSessions = new Map()

  return {
    // Task
    createTask: async (task) => { tasks.set(task.id, {...task}); return task },
    loadTask: async (taskId) => tasks.get(taskId) || null,
    findTaskBySource: async () => null,
    updateTask: async () => {},

    // Attempt (needed by flowService.submit)
    createAttempt: async (a) => { attempts.set(a.id, {...a}); return a },
    loadAttempt: async (id) => attempts.get(id) || null,
    listAttemptsByTask: async () => [],
    updateAttempt: async () => {},
    listIncompleteAttempts: async () => [],

    // MoveEvaluation
    listMoveEvaluationsByAttempt: async () => [],

    // BadMove
    listBadMovesByAttempt: async () => [],

    // Recall
    createRecallSession: async (s) => { recallSessions.set(s.id, {...s}); return s },
    loadRecallSession: async () => null,
    updateRecallSession: async () => {},
    createRecallAttempt: async (a) => a,
    listRecallAttempts: async () => [],
    listIncompleteRecallSessions: async () => [],

    // Transaction (passthrough for in-memory)
    transaction: async (fn) => fn(),

    // Review
    listDueReviewItems: async () => [],
    listTasksByStatus: async () => [],
    listTasksByOriginProvider: async () => [],

    // Legacy
    saveGame: async () => ({}),
    getGame: async () => null,
    getRecentGames: async () => [],
    saveRecallSession: async (s) => s,
    saveRecallAttempts: async () => {},
    saveProblem: async (p) => p,
    getProblem: async () => null,
    getProblemsByStatus: async () => [],
    saveProblemAttempt: async (a) => a,
    saveBadMove: async (b) => b,
    updateBadMoveGeneratedProblem: async () => {},
    getDueReviews: async () => [],
    upsertReviewSchedule: async () => {},
    getDashboardSummary: async () => ({}),
    createReviewSchedule: async (s) => s,
    findReviewScheduleByItem: async () => null,
    findReviewScheduleByTask: async () => null,
    updateReviewSchedule: async () => {},
    createMoveEvaluation: async (e) => e,
    updateMoveEvaluation: async () => {},
    createBadMove: async (b) => b,
    loadBadMove: async () => null,
    listBadMovesByTask: async () => [],
    markBadMoveAsNotBad: async () => {},
    updateBadMove: async () => {},
    createRecallCheckpoint: async (c) => c,
    loadRecallCheckpoint: async () => null,
    updateRecallCheckpoint: async () => {},
    listCheckpointsByRecallSession: async () => [],
    createProblem: async (p) => p,
    loadProblem: async () => null,
    updateProblem: async () => {},
    archiveProblem: async () => {},
    createMoveComment: async (c) => c,
    loadMoveComment: async () => null,
    updateMoveComment: async () => {},
    listExpiredPendingMoveEvaluations: async () => [],
  }
}

// --- Mock positionSnapshotAdapter ---

/**
 * Fixed positionSnapshotAdapter that returns a predictable snapshot.
 * Satisfies the PositionSnapshotAdapter interface from production.
 */
function createMockPositionSnapshotAdapter() {
  return {
    captureCurrentPosition() {
      return {
        positionSgf: '(;SZ[19]PL[B])',
        sideToMove: 'black',
        treePosition: 'node_root',
        moveNumber: 0,
        positionHash: 'test_hash_0',
      }
    },
    captureBeforeMove(moveIndex) {
      return this.captureCurrentPosition()
    },
    captureAfterMove(moveIndex) {
      return this.captureCurrentPosition()
    },
  }
}

// --- Spy attemptService ---

/**
 * Minimal spy for attemptService dependencies used by workbenchFlowService.
 * Records calls, returns plausible defaults.
 */
function createSpyAttemptService() {
  const calls = {
    createAttempt: [],
    freezeAttempt: [],
    finalizeAttemptResult: [],
  }

  return {
    calls,
    async createAttempt(input) {
      calls.createAttempt.push(input)
      return {id: `att_${Date.now()}`}
    },
    async freezeAttempt(attemptId) {
      calls.freezeAttempt.push({attemptId})
    },
    async finalizeAttemptResult(attemptId, result) {
      calls.finalizeAttemptResult.push({attemptId, result})
    },
  }
}

// --- Spy recallService for flow deps ---

/**
 * Minimal spy for recallService dependencies used by workbenchFlowService.
 * Provides createRecallSession and completeRecall.
 */
function createSpyRecallServiceForFlow() {
  const calls = {
    createRecallSession: [],
    completeRecall: [],
  }

  return {
    calls,
    async createRecallSession(input) {
      calls.createRecallSession.push(input)
      return {id: `rs_${Date.now()}`}
    },
    async completeRecall(recallSessionId) {
      calls.completeRecall.push({recallSessionId})
    },
  }
}

// --- Harness ---

/**
 * Create test harness with real services and a tab that has taskId: null.
 */
function createHarness(options = {}) {
  const {
    tabId = 'tab_default',
    taskId = null,
    mode = 'play',
  } = options

  const workbenchStore = createWorkbenchStore({logger})
  const runtimeStore = createTrainingRuntimeStore({logger})
  const repository = createInMemoryRepository()
  const positionSnapshotAdapter = createMockPositionSnapshotAdapter()
  const tabService = createSpyTabService()
  const attemptService = createSpyAttemptService()
  const spyRecallService = createSpyRecallServiceForFlow()

  const snapshotService = createSnapshotService({
    repository,
    positionSnapshotAdapter,
    workbenchStore,
    logger,
  })

  const flowService = createWorkbenchFlowService({
    workbenchStore,
    repository,
    attemptService,
    recallService: spyRecallService,
    snapshotService,
    tabService,
    runtimeStore,
    logger,
  })

  // Add tab with taskId: null (default free-play tab)
  const now = new Date().toISOString()
  workbenchStore.addTab({
    id: tabId,
    taskId,
    mode,
    childTabIds: [],
    createdAt: now,
    updatedAt: now,
  })
  workbenchStore.setActiveTab(tabId)

  return {
    flowService,
    workbenchStore,
    runtimeStore,
    repository,
    tabService,
    attemptService,
    spyRecallService,
    snapshotService,
  }
}

// ===========================================================================
// Tests
// ===========================================================================

describe('Snapshot Null TaskId (T-SNAPSHOT-FREEPLAY)', function () {

  // T-SNAPSHOT-NULL-1: snapshotFromCurrentContext on tab with taskId:null does NOT throw.
  //
  // User runtime log confirms crash:
  //   {tabId: 'tab_default_1779373945264', mode: 'recall', taskId: null, attemptId: null}
  //   Error: snapshotService.captureSnapshotInput: task not found (id=null)
  //
  // BUG-2: snapshotService.captureSnapshotInput calls repository.loadTask(null)
  // which throws "task not found (id=null)".
  //
  // RED until BUG-2 is fixed: snapshotService must skip task load when sourceTaskId is null/undefined.
  it('T-SNAPSHOT-NULL-1: snapshotFromCurrentContext on tab with taskId:null does NOT throw', async function () {
    const harness = createHarness({
      tabId: 'tab_default',
      taskId: null,
      mode: 'analysis',
    })

    // This must NOT throw. Use try/catch because assert.doesNotThrow does not
    // catch async rejections properly.
    let result
    let thrown = null
    try {
      result = await harness.flowService.snapshotFromCurrentContext('tab_default')
    } catch (err) {
      thrown = err
    }

    assert.strictEqual(thrown, null,
      `snapshotFromCurrentContext must not throw when tab.taskId is null. Got: ${thrown?.message}`)
    assert.ok(result, 'snapshotFromCurrentContext must return a WorkbenchTab')
  })

  // T-SNAPSHOT-NULL-2: Snapshot task created with origin.parentTaskId undefined.
  //
  // When the source tab has taskId: null, the snapshot task should NOT have
  // a parentTaskId pointing to null. It should be a parentless snapshot.
  //
  // RED until BUG-2 is fixed: workbenchFlowService must pass
  // sourceTaskId: tab.taskId ?? undefined and origin.parentTaskId: tab.taskId ?? undefined.
  it('T-SNAPSHOT-NULL-2: snapshot task has origin.parentTaskId undefined when source tab has taskId null', async function () {
    const harness = createHarness({
      tabId: 'tab_default',
      taskId: null,
      mode: 'analysis',
    })

    const result = await harness.flowService.snapshotFromCurrentContext('tab_default')

    // The new tab should have a taskId that points to the snapshot task
    assert.ok(result.taskId, 'New tab must have a taskId')

    // Verify the snapshot task was created in the repository
    const snapshotTask = await harness.repository.loadTask(result.taskId)
    assert.ok(snapshotTask, 'Snapshot task must exist in repository')

    // The snapshot task's origin must NOT have parentTaskId set to null
    assert.ok(snapshotTask.origin, 'Snapshot task must have an origin')
    assert.strictEqual(snapshotTask.origin.provider, 'snapshot',
      'Origin provider must be "snapshot"')

    // parentTaskId must be undefined (not null) for parentless snapshots
    assert.strictEqual(snapshotTask.origin.parentTaskId, undefined,
      'Snapshot task from null-taskId tab must have origin.parentTaskId undefined')
  })

  // T-SNAPSHOT-NULL-3: tabService.openTask was called with the new snapshot task ID.
  //
  // Verifies the flow service correctly opens a new tab for the snapshot task.
  it('T-SNAPSHOT-NULL-3: tabService.openTask called with new snapshot task ID', async function () {
    const harness = createHarness({
      tabId: 'tab_default',
      taskId: null,
      mode: 'analysis',
    })

    await harness.flowService.snapshotFromCurrentContext('tab_default')

    // tabService.openTask must have been called once
    assert.strictEqual(harness.tabService.calls.openTask.length, 1,
      'tabService.openTask must be called exactly once')

    const openTaskCall = harness.tabService.calls.openTask[0]
    assert.ok(openTaskCall.taskId, 'openTask must receive a taskId')
    assert.strictEqual(openTaskCall.mode, 'problem',
      'Snapshot tab should open in problem mode')
    assert.strictEqual(openTaskCall.parentTabId, 'tab_default',
      'Snapshot tab must reference the source tab as parent')
  })
})
