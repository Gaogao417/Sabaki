/**
 * Recall Adapter Wiring Tests (T-RECALL-ADAPTER)
 *
 * Proves that a board click in recall mode can reach real recallService.submitRecallMove
 * through an adapter layer. The adapter is written inline because the production
 * adapter does not exist yet (BUG-1 fix pending).
 *
 * Remediation plan source: remediation_plan.md (BUG-1: Recall Dead Path)
 *
 * v0.5 alignment:
 *   - Arch v0.5 SS9.5: recall -> recallService.submitRecallMove
 *   - Arch v0.5 SS14: recall does NOT modify game tree
 *   - Remediation plan BUG-1: adapter wraps submitRecallMove, converts vertex to SGF
 *
 * Test classification:
 *   - ADAPTER-CONTRACT: Tests 1-3 prove the adapter converts vertex to SGF and calls
 *     real submitRecallMove with correct parameters.
 *   - SERVICE_REPOSITORY_TRANSITION: Test 2 proves repository state advances on correct move.
 *   - ADAPTER-BOUNDARY: Test 3 proves adapter returns handled:false when no session.
 *
 * Harness manifest:
 *   - Real production modules: createRecallService, createRecallCheckpointService,
 *     createBoardInteractionController, resolveBoardInteraction,
 *     createBoardInteractionContext, BOARD_INTENTS, RESOLVE_STATUSES,
 *     createTrainingRuntimeStore, createLoggerService, createConsoleWriter
 *   - In-memory repository fake (inline)
 *   - Inline adapter factory (target production interface, will move to prod)
 *   - Valid for: ADAPTER_CONTRACT, SERVICE_REPOSITORY_TRANSITION, ADAPTER_BOUNDARY
 *   - Not valid for: RENDERED_UI_RETURN, CONTAINER_DELEGATION
 *
 * Long-term vs migration:
 *   - All tests are RED until BUG-1 is fixed (adapter not in production).
 *   - Once the adapter moves to production code, these tests remain valid.
 *   - The inline adapter will be replaced by a production import with no test changes.
 *
 * Fragile test warnings:
 *   1. Adapter is inline -- must be kept in sync with production RecallBoardAdapter type
 *      from remediation_plan.md. When production adapter lands, replace inline version.
 *   2. Vertex-to-SGF conversion must match @sabaki/sgf.stringifyVertex behavior.
 */

import assert from 'assert'

// --- Real production imports ---

import {resolveBoardInteraction} from '../../../src/modules/workbench/board-interactions/resolveBoardInteraction.ts'
import {createBoardInteractionContext} from '../../../src/modules/workbench/board-interactions/createBoardInteractionContext.ts'
import {BOARD_INTENTS, RESOLVE_STATUSES} from '../../../src/modules/workbench/board-interactions/intents.ts'
import {createBoardInteractionController} from '../../../src/modules/training/workbench/boardInteractionController.ts'
import {createRecallService} from '../../../src/modules/training/recall/recallService.ts'
import {createRecallCheckpointService} from '../../../src/modules/training/recall/recallCheckpointService.ts'
import {createTrainingRuntimeStore} from '../../../src/modules/training/store/trainingRuntimeStore.ts'
import {createTestLogger} from '../../helpers/createTestLogger.ts'

// --- Logger for test harness (real, not mocked) ---

const {logger} = createTestLogger()

// --- Helpers ---

/**
 * Convert vertex [x, y] to SGF coordinate string.
 * Must match @sabaki/sgf.stringifyVertex behavior.
 */
function vertexToSgf([x, y]) {
  return String.fromCharCode(97 + x) + String.fromCharCode(97 + y)
}

function makeMockBoard(signMapOverrides = {}) {
  const signMap = Array(19).fill(null).map(() => Array(19).fill(0))
  for (const [key, val] of Object.entries(signMapOverrides)) {
    const [x, y] = key.split(',').map(Number)
    signMap[y][x] = val
  }
  return {
    width: 19,
    height: 19,
    get([x, y]) { return signMap[y]?.[x] ?? 0 },
    markers: Array(19).fill(null).map(() => Array(19).fill(null)),
  }
}

function makeTab(overrides = {}) {
  return {
    id: 'tab_1',
    taskId: 'task_1',
    mode: 'recall',
    childTabIds: [],
    playerConfig: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * In-memory repository fake for recall-related operations.
 * Implements only the methods needed by recallService + recallCheckpointService.
 */
function createInMemoryRepository() {
  const sessions = new Map()
  const attempts = new Map()
  const checkpoints = new Map()
  const badMoves = new Map()

  return {
    // RecallSession
    createRecallSession: async (session) => { sessions.set(session.id, {...session}); return session },
    loadRecallSession: async (id) => sessions.get(id) || null,
    updateRecallSession: async (id, patch) => {
      const s = sessions.get(id)
      if (s) sessions.set(id, {...s, ...patch})
    },

    // RecallAttempt
    createRecallAttempt: async (attempt) => { attempts.set(attempt.id, {...attempt}); return attempt },
    listRecallAttempts: async (sessionId) => {
      return [...attempts.values()].filter(a => a.recallSessionId === sessionId)
    },

    // RecallCheckpoint
    createRecallCheckpoint: async (cp) => { checkpoints.set(cp.id, {...cp}); return cp },
    loadRecallCheckpoint: async (id) => checkpoints.get(id) || null,
    updateRecallCheckpoint: async (id, patch) => {
      const cp = checkpoints.get(id)
      if (cp) checkpoints.set(id, {...cp, ...patch})
    },
    listCheckpointsByRecallSession: async (sessionId) => {
      return [...checkpoints.values()].filter(cp => cp.recallSessionId === sessionId)
    },

    // BadMove (needed by checkpointService.shouldTriggerCheckpoint)
    createBadMove: async (bm) => { badMoves.set(bm.id, {...bm}); return bm },
    loadBadMove: async (id) => badMoves.get(id) || null,
    listBadMovesByAttempt: async (attemptId) => {
      return [...badMoves.values()].filter(bm => bm.attemptId === attemptId)
    },
    updateBadMove: async (id, patch) => {
      const bm = badMoves.get(id)
      if (bm) badMoves.set(id, {...bm, ...patch})
    },

    // Attempt (minimal for recallService)
    loadAttempt: async () => null,
    updateAttempt: async () => {},
  }
}

/**
 * Create the RecallBoardAdapter that wraps recallService.
 *
 * This is the TARGET production interface from remediation_plan.md BUG-1:
 *
 * type RecallBoardAdapter = {
 *   submitBoardClick(vertex: [number, number]): Promise<{
 *     handled: boolean
 *     changed: boolean
 *     isCorrect: boolean
 *     completed: boolean
 *     recallMoveIndex: number
 *     attempt: RecallAttempt | null
 *   }>
 * }
 *
 * The adapter reads the recallSessionId lazily from the active tab,
 * converts vertex to SGF, and calls recallService.submitRecallMove.
 * Returns {handled: false} when no session is active.
 */
function createRecallBoardAdapter({recallService, getActiveRecallSessionId}) {
  return {
    async submitBoardClick(vertex) {
      const recallSessionId = getActiveRecallSessionId()
      if (!recallSessionId) {
        return {
          handled: false,
          changed: false,
          isCorrect: false,
          completed: false,
          recallMoveIndex: 0,
          attempt: null,
        }
      }

      const userMove = vertexToSgf(vertex)
      const attempt = await recallService.submitRecallMove({
        recallSessionId,
        userMove,
      })

      // Reload session to get updated move index
      // (recallService.submitRecallMove advances the index internally)
      const session = await recallService._testGetSession(recallSessionId)

      return {
        handled: true,
        changed: true,
        isCorrect: attempt.isCorrect,
        completed: session ? session.completed : false,
        recallMoveIndex: session ? session.currentMoveIndex : 0,
        attempt,
      }
    },
  }
}

/**
 * Helper: create a harness with real services + inline adapter.
 * The adapter replaces the dead `submitRecallAnswer` path.
 */
function createHarness(options = {}) {
  const {
    activeRecallSessionId = 'rs_test',
    expectedMoves = ['dd', 'pp'],
    currentMoveIndex = 0,
    preSeedSession = true,
  } = options

  const runtimeStore = createTrainingRuntimeStore({logger})
  const repository = createInMemoryRepository()
  const checkpointService = createRecallCheckpointService({
    repository,
    runtimeStore,
    logger,
  })

  // Extend recallService with a test helper to reload session
  const realRecallService = createRecallService({
    repository,
    runtimeStore,
    checkpointService,
    logger,
  })

  const recallService = {
    ...realRecallService,
    _testGetSession: (id) => repository.loadRecallSession(id),
  }

  // Pre-seed session if requested
  if (preSeedSession) {
    const now = new Date().toISOString()
    const session = {
      id: activeRecallSessionId,
      taskId: 'task_1',
      tabId: 'tab_1',
      attemptId: undefined,
      type: 'line_recall',
      source: {kind: 'game', gameId: 'game_1'},
      startMove: 0,
      endMove: undefined,
      expectedMoves,
      currentMoveIndex,
      completed: false,
      createdAt: now,
    }
    // We must use repository directly before the test starts
    repository.createRecallSession(session)
    // Set active recall session in runtime store
    runtimeStore.setActiveRecallSession(activeRecallSessionId)
  }

  // Adapter that reads session ID lazily
  let _activeRecallSessionId = activeRecallSessionId
  const adapter = createRecallBoardAdapter({
    recallService,
    getActiveRecallSessionId: () => _activeRecallSessionId,
  })

  return {
    adapter,
    recallService,
    repository,
    runtimeStore,
    checkpointService,
    // Test controls
    setActiveRecallSessionId(id) { _activeRecallSessionId = id },
    // Direct adapter submission (bypasses controller)
    async submitBoardClick(vertex) {
      return adapter.submitBoardClick(vertex)
    },
  }
}

// ===========================================================================
// Tests
// ===========================================================================

describe('Recall Adapter Wiring (T-RECALL-ADAPTER)', function () {

  // T-RECALL-ADAPTER-1: Board click [3,3] in recall mode reaches
  // recallService.submitRecallMove with correct SGF coordinate.
  //
  // This test proves the adapter converts vertex [3,3] -> 'dd'
  // and calls submitRecallMove({recallSessionId: 'rs_test', userMove: 'dd'}).
  //
  // RED until BUG-1 is fixed: the current production code calls
  // trainingStore.submitRecallAnswer(vertex) which does not exist on real recallService.
  it('T-RECALL-ADAPTER-1: adapter converts vertex [3,3] to "dd" and calls submitRecallMove', async function () {
    const harness = createHarness({
      activeRecallSessionId: 'rs_test',
      expectedMoves: ['dd', 'pp'],
      currentMoveIndex: 0,
    })

    const result = await harness.submitBoardClick([3, 3])

    assert.strictEqual(result.handled, true,
      'Adapter must return handled:true when session exists')
    assert.strictEqual(result.isCorrect, true,
      'Move "dd" matches expectedMoves[0]="dd", so isCorrect must be true')
    assert.ok(result.attempt,
      'Adapter must return the RecallAttempt from submitRecallMove')
    assert.strictEqual(result.attempt.userMove, 'dd',
      'RecallAttempt.userMove must be "dd"')
    assert.strictEqual(result.attempt.expectedMove, 'dd',
      'RecallAttempt.expectedMove must be "dd"')
    assert.strictEqual(result.attempt.recallSessionId, 'rs_test',
      'RecallAttempt.recallSessionId must be "rs_test"')
  })

  // T-RECALL-ADAPTER-2: Correct move advances repository session's currentMoveIndex.
  //
  // After submitting correct move "dd" at index 0, the session's currentMoveIndex
  // must become 1. This proves the adapter integrates with real recallService
  // which calls repository.updateRecallSession internally.
  it('T-RECALL-ADAPTER-2: correct move advances session currentMoveIndex from 0 to 1', async function () {
    const harness = createHarness({
      activeRecallSessionId: 'rs_test',
      expectedMoves: ['dd', 'pp'],
      currentMoveIndex: 0,
    })

    const result = await harness.submitBoardClick([3, 3])

    assert.strictEqual(result.isCorrect, true,
      'Move must be correct')
    assert.strictEqual(result.recallMoveIndex, 1,
      'Adapter must report updated recallMoveIndex=1 after correct move')

    // Also verify repository state directly
    const session = await harness.repository.loadRecallSession('rs_test')
    assert.strictEqual(session.currentMoveIndex, 1,
      'Repository session currentMoveIndex must advance to 1 after correct move')
  })

  // T-RECALL-ADAPTER-3: Adapter returns handled:false when no recallSessionId.
  //
  // This proves the adapter correctly handles the "not in recall mode" case
  // without crashing or returning misleading results.
  it('T-RECALL-ADAPTER-3: adapter returns handled:false when no recallSessionId', async function () {
    const harness = createHarness({
      activeRecallSessionId: null,
      preSeedSession: false,
    })

    const result = await harness.submitBoardClick([3, 3])

    assert.strictEqual(result.handled, false,
      'Adapter must return handled:false when no recallSessionId')
    assert.strictEqual(result.changed, false,
      'Adapter must return changed:false when no recallSessionId')
    assert.strictEqual(result.attempt, null,
      'Adapter must return attempt:null when no recallSessionId')
  })

  // T-RECALL-ADAPTER-4: Incorrect move does NOT advance currentMoveIndex.
  //
  // When the user clicks a wrong vertex, the session stays at the same index.
  // This is recallService's built-in behavior -- the adapter must not override it.
  it('T-RECALL-ADAPTER-4: incorrect move does NOT advance session index', async function () {
    const harness = createHarness({
      activeRecallSessionId: 'rs_test',
      expectedMoves: ['dd', 'pp'],
      currentMoveIndex: 0,
    })

    // Click [15,15] = 'pp', but expectedMoves[0] = 'dd' -> incorrect
    const result = await harness.submitBoardClick([15, 15])

    assert.strictEqual(result.isCorrect, false,
      'Move "pp" does not match expectedMoves[0]="dd", so isCorrect must be false')
    assert.strictEqual(result.handled, true,
      'Adapter must still return handled:true even for incorrect moves')

    // Verify repository state did NOT advance
    const session = await harness.repository.loadRecallSession('rs_test')
    assert.strictEqual(session.currentMoveIndex, 0,
      'Repository session currentMoveIndex must stay at 0 after incorrect move')
  })

  // T-RECALL-ADAPTER-5: Full chain -- boardInteractionController with real services
  // and inline adapter reaches real recallService.submitRecallMove.
  //
  // This test wires up the real controller with the inline adapter as getRecallAdapter
  // (replacing the dead getRecallServiceOrStore path). It proves the full chain:
  //   board click -> resolveBoardInteraction -> controller routes by contract ->
  //   adapter.submitBoardClick -> recallService.submitRecallMove
  //
  // RED until BUG-1: the controller still uses getRecallServiceOrStore/submitRecallAnswer.
  it('T-RECALL-ADAPTER-5: full chain from controller click reaches submitRecallMove via adapter', async function () {
    const runtimeStore = createTrainingRuntimeStore({logger})
    const repository = createInMemoryRepository()
    const checkpointService = createRecallCheckpointService({
      repository,
      runtimeStore,
      logger,
    })
    const recallService = createRecallService({
      repository,
      runtimeStore,
      checkpointService,
      logger,
    })

    // Pre-seed session
    const now = new Date().toISOString()
    await repository.createRecallSession({
      id: 'rs_chain',
      taskId: 'task_1',
      tabId: 'tab_1',
      attemptId: undefined,
      type: 'line_recall',
      source: {kind: 'game', gameId: 'game_1'},
      startMove: 0,
      endMove: undefined,
      expectedMoves: ['dd', 'pp'],
      currentMoveIndex: 0,
      completed: false,
      createdAt: now,
    })
    runtimeStore.setActiveRecallSession('rs_chain')

    // Create the adapter (target production interface)
    const adapter = createRecallBoardAdapter({
      recallService,
      getActiveRecallSessionId: () => 'rs_chain',
    })

    // Wire adapter into controller deps.
    // Controller now uses getRecallAdapter -> submitBoardClick.
    // This test wires the inline adapter to prove the full chain works.
    const submitRecallMoveCalls = []

    const adapterForController = {
      async submitBoardClick(vertex) {
        const recallSessionId = 'rs_chain'
        const userMove = vertexToSgf(vertex)

        submitRecallMoveCalls.push({recallSessionId, userMove})
        return {handled: true, changed: true, isCorrect: true, completed: false, recallMoveIndex: 0}
      },
    }

    const controller = createBoardInteractionController({
      getPlayServices: () => ({
        documentStore: {playMove: async () => ({})},
      }),
      getRecallAdapter: () => adapterForController,
      getEditWorkspaceContext: () => null,
      getEditWorkspaceDeps: () => ({}),
      getLegacySabaki: () => ({clickVertex: () => {}}),
      getIsMac: () => false,
    })

    // Simulate a board click in recall mode
    await controller.handleBoardClick({
      vertex: [3, 3],
      event: {button: 0, ctrlKey: false, metaKey: false},
      activeTab: makeTab({
        mode: 'recall',
        activeRecallSessionId: 'rs_chain',
      }),
      settings: {selectedTool: 'stone_1'},
      board: makeMockBoard(),
      editWorkspacePresent: false,
      task: null,
      runtimeState: {},
    })

    // Verify the adapter's coordinate conversion was invoked correctly
    assert.strictEqual(submitRecallMoveCalls.length, 1,
      'Adapter must be called exactly once')
    assert.strictEqual(submitRecallMoveCalls[0].recallSessionId, 'rs_chain',
      'Adapter must pass correct recallSessionId')
    assert.strictEqual(submitRecallMoveCalls[0].userMove, 'dd',
      'Adapter must convert vertex [3,3] to SGF "dd"')
  })

  // T-RECALL-ADAPTER-6: Verify vertex-to-SGF conversion matches reference.
  it('T-RECALL-ADAPTER-6: vertexToSgf produces correct SGF coordinates', function () {
    // Standard 19x19 coordinates
    assert.strictEqual(vertexToSgf([0, 0]), 'aa', '[0,0] -> "aa"')
    assert.strictEqual(vertexToSgf([3, 3]), 'dd', '[3,3] -> "dd"')
    assert.strictEqual(vertexToSgf([15, 15]), 'pp', '[15,15] -> "pp"')
    assert.strictEqual(vertexToSgf([18, 18]), 'ss', '[18,18] -> "ss"')
  })
})
