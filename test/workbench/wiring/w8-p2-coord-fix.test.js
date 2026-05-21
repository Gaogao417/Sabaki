/**
 * W8-P2 GAP-Coord Fix Verification Tests
 *
 * Test contract: docs/design/2026-05-21/w8-p2-container-mode-routing/test-contract-v0.1.md
 * Contracts covered: T2-04, T2-05, T2-06
 *
 * Source of truth alignment:
 *   - PRD v0.5 SS3.3: Recall - user recalls moves sequentially; moves must be
 *     compared in SGF coordinate format for correct isCorrect evaluation.
 *   - Arch v0.5 SS9.5: recall -> recallService.submitRecallMove with SGF userMove
 *   - recallService.ts line 128: `input.userMove === expectedMove` compares against
 *     expectedMoves derived from SGF parsing (e.g. "dd").
 *   - boardInteractionController.ts line 196: currently sends `"3,3"` format,
 *     which is the GAP-Coord bug causing every recall comparison to return isCorrect=false.
 *
 * v0.5 conflict check: No conflicts found. These tests verify the fix for a known
 * GAP (GAP-Coord) that violates the contract between controller and recallService.
 * No origin.provider branching, no source-specific tab API, no container store writes,
 * no UI service/store imports.
 *
 * Test classification:
 *   - T2-04, T2-05, T2-06: SIDE_EFFECT_BOUNDARY (real controller, spy service)
 *
 * Long-term vs migration:
 *   - All three tests are long-term. They protect the coord format contract between
 *     boardInteractionController and recallService.submitRecallMove.
 *   - These tests supplement W8-P1-T11, which verifies submitRecallMove IS called;
 *     T2-04..T2-06 verify the FORMAT of the userMove argument.
 *
 * Workbench wiring coverage:
 *   - Controller -> service: verifies the format of userMove passed to
 *     recallService.submitRecallMove
 *
 * Harness manifest:
 *   - Real production modules: createBoardInteractionController,
 *     resolveBoardInteraction, createBoardInteractionContext, BOARD_INTENTS,
 *     RESOLVE_STATUSES, createLoggerService, createConsoleWriter
 *   - Fake/spy modules: mock executor deps with spy on submitRecallMove
 *   - Valid for: SIDE_EFFECT_BOUNDARY (controller -> service call format)
 *   - Not valid for: CONTAINER_DELEGATION, RENDERED_UI_RETURN, STORE_SUBSCRIPTION
 *
 * Fragile test warnings:
 *   1. Do NOT mock resolveBoardInteraction — the resolver must execute for real so
 *      the controller routing is end-to-end.
 *   2. Assert the userMove string value, not just call count.
 *   3. Tests are expected to FAIL until GAP-Coord is fixed in
 *      boardInteractionController.ts line 196.
 */

import assert from 'assert'

// --- Real production imports ---

import {createBoardInteractionController} from '../../../src/modules/training/workbench/boardInteractionController.ts'
import {createLoggerService} from '../../../src/modules/logger/LoggerService.js'
import {createConsoleWriter} from '../../../src/modules/logger/consoleWriter.js'

// --- Logger for test harness (real, not mocked) ---

const logger = createLoggerService({writers: [createConsoleWriter()]})

// --- Helper Factories ---

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
    activeRecallSessionId: 'rs_recall_test',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Create controller deps with submitRecallMove spy.
 * The spy captures arguments for format verification.
 */
function createCoordTestDeps() {
  const submitRecallMoveCalls = []

  const recallServiceShape = {
    submitRecallMove: async (input) => {
      submitRecallMoveCalls.push({...input})
      return {id: 'ra_coord_test', isCorrect: true, moveNumber: 0}
    },
  }

  const documentStore = {
    playMove: async () => ({}),
  }

  return {
    getPlayServices: () => ({documentStore}),
    getRecallServiceOrStore: () => recallServiceShape,
    getEditWorkspaceContext: () => null,
    getEditWorkspaceDeps: () => ({}),
    getLegacySabaki: () => ({clickVertex: () => {}}),
    getIsMac: () => false,
    _submitRecallMoveCalls: submitRecallMoveCalls,
  }
}

// ===========================================================================
// T2-04, T2-05, T2-06: GAP-Coord — vertex to SGF format verification
// Real boardInteractionController, real resolver, spy submitRecallMove.
// ===========================================================================

describe('W8-P2 GAP-Coord: vertex to SGF format (T2-04..T2-06)', function () {
  const deps = createCoordTestDeps()
  const controller = createBoardInteractionController(deps)

  // T2-04: vertex [3,3] -> SGF "dd"
  // boardInteractionController.ts line 196 currently has:
  //   const userMove = `${vertex[0]},${vertex[1]}`  // WRONG: produces "3,3"
  // Contract requires: String.fromCharCode(97 + vertex[0]) + String.fromCharCode(97 + vertex[1])
  //   which produces "dd" for vertex [3,3].
  // recallService.ts line 128 compares input.userMove === expectedMove where
  //   expectedMoves are SGF coords extracted via extractMovesFromSgf (e.g. "dd").
  // This test is RED until GAP-Coord is fixed.
  it('T2-04: vertex [3,3] produces userMove="dd" (SGF format, not "3,3")', async function () {
    await controller.handleBoardClick({
      vertex: [3, 3],
      event: {button: 0, ctrlKey: false, metaKey: false},
      activeTab: makeTab({mode: 'recall', activeRecallSessionId: 'rs_44'}),
      settings: {selectedTool: 'stone_1'},
      board: makeMockBoard(),
      editWorkspacePresent: false,
      task: null,
      runtimeState: {},
    })

    assert.strictEqual(deps._submitRecallMoveCalls.length, 1,
      'submitRecallMove must be called exactly once')
    const call = deps._submitRecallMoveCalls[0]
    assert.strictEqual(call.recallSessionId, 'rs_44',
      'recallSessionId must match activeTab.activeRecallSessionId')
    // Contract T2-04: userMove must be "dd" (SGF format)
    // This assertion will FAIL until GAP-Coord is fixed.
    // Current implementation produces "3,3"; expected is "dd".
    assert.strictEqual(call.userMove, 'dd',
      'userMove for vertex [3,3] must be SGF "dd", not comma-separated "3,3"')
  })

  // T2-05: vertex [0,0] -> "aa", vertex [18,18] -> "ss"
  it('T2-05: vertex [0,0] produces "aa" and vertex [18,18] produces "ss"', async function () {
    // First click: [0,0] -> "aa"
    const depsA = createCoordTestDeps()
    const controllerA = createBoardInteractionController(depsA)

    await controllerA.handleBoardClick({
      vertex: [0, 0],
      event: {button: 0, ctrlKey: false, metaKey: false},
      activeTab: makeTab({mode: 'recall', activeRecallSessionId: 'rs_aa'}),
      settings: {selectedTool: 'stone_1'},
      board: makeMockBoard(),
      editWorkspacePresent: false,
      task: null,
      runtimeState: {},
    })

    assert.strictEqual(depsA._submitRecallMoveCalls.length, 1)
    assert.strictEqual(depsA._submitRecallMoveCalls[0].userMove, 'aa',
      'userMove for vertex [0,0] must be SGF "aa"')

    // Second click: [18,18] -> "ss"
    const depsB = createCoordTestDeps()
    const controllerB = createBoardInteractionController(depsB)

    await controllerB.handleBoardClick({
      vertex: [18, 18],
      event: {button: 0, ctrlKey: false, metaKey: false},
      activeTab: makeTab({mode: 'recall', activeRecallSessionId: 'rs_ss'}),
      settings: {selectedTool: 'stone_1'},
      board: makeMockBoard(),
      editWorkspacePresent: false,
      task: null,
      runtimeState: {},
    })

    assert.strictEqual(depsB._submitRecallMoveCalls.length, 1)
    assert.strictEqual(depsB._submitRecallMoveCalls[0].userMove, 'ss',
      'userMove for vertex [18,18] must be SGF "ss"')
  })

  // T2-06: vertex [0,18] -> "as", vertex [18,0] -> "sa"
  it('T2-06: vertex [0,18] produces "as" and vertex [18,0] produces "sa"', async function () {
    // First click: [0,18] -> "as"
    const depsC = createCoordTestDeps()
    const controllerC = createBoardInteractionController(depsC)

    await controllerC.handleBoardClick({
      vertex: [0, 18],
      event: {button: 0, ctrlKey: false, metaKey: false},
      activeTab: makeTab({mode: 'recall', activeRecallSessionId: 'rs_as'}),
      settings: {selectedTool: 'stone_1'},
      board: makeMockBoard(),
      editWorkspacePresent: false,
      task: null,
      runtimeState: {},
    })

    assert.strictEqual(depsC._submitRecallMoveCalls.length, 1)
    assert.strictEqual(depsC._submitRecallMoveCalls[0].userMove, 'as',
      'userMove for vertex [0,18] must be SGF "as"')

    // Second click: [18,0] -> "sa"
    const depsD = createCoordTestDeps()
    const controllerD = createBoardInteractionController(depsD)

    await controllerD.handleBoardClick({
      vertex: [18, 0],
      event: {button: 0, ctrlKey: false, metaKey: false},
      activeTab: makeTab({mode: 'recall', activeRecallSessionId: 'rs_sa'}),
      settings: {selectedTool: 'stone_1'},
      board: makeMockBoard(),
      editWorkspacePresent: false,
      task: null,
      runtimeState: {},
    })

    assert.strictEqual(depsD._submitRecallMoveCalls.length, 1)
    assert.strictEqual(depsD._submitRecallMoveCalls[0].userMove, 'sa',
      'userMove for vertex [18,0] must be SGF "sa"')
  })
})
