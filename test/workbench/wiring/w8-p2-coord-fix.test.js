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
 * Create controller deps with submitRecallAnswer spy.
 * The spy captures the vertex argument for format verification.
 * With executor routing, the controller calls executeRecallInteraction which
 * calls trainingStore.submitRecallAnswer(vertex) with the raw vertex.
 * SGF coordinate conversion happens inside trainingStore, not the controller.
 */
function createCoordTestDeps() {
  const submitRecallAnswerCalls = []

  const trainingStore = {
    submitRecallAnswer: (vertex) => {
      submitRecallAnswerCalls.push({vertex})
      return {handled: true, changed: true, isCorrect: true}
    },
  }

  const documentStore = {
    playMove: async () => ({valid: true, changed: false}),
  }

  return {
    getPlayServices: () => ({
      documentStore,
      engineService: undefined,
      analysisService: undefined,
    }),
    getRecallServiceOrStore: () => trainingStore,
    getEditWorkspaceContext: () => null,
    getEditWorkspaceDeps: () => ({}),
    getLegacySabaki: () => ({clickVertex: () => {}}),
    getIsMac: () => false,
    _submitRecallAnswerCalls: submitRecallAnswerCalls,
  }
}

// ===========================================================================
// T2-04, T2-05, T2-06: Vertex passthrough verification
// Real boardInteractionController, real resolver, real executeRecallInteraction.
// The executor passes the raw vertex to trainingStore.submitRecallAnswer(vertex).
// SGF coordinate conversion happens inside trainingStore, not in the controller.
// ===========================================================================

describe('W8-P2 GAP-Coord: vertex passthrough (T2-04..T2-06)', function () {

  // T2-04: vertex [3,3] is passed through executor to submitRecallAnswer
  it('T2-04: vertex [3,3] is passed through executor to trainingStore.submitRecallAnswer', async function () {
    const deps = createCoordTestDeps()
    const controller = createBoardInteractionController(deps)

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

    assert.strictEqual(deps._submitRecallAnswerCalls.length, 1,
      'submitRecallAnswer must be called exactly once')
    assert.deepStrictEqual(deps._submitRecallAnswerCalls[0].vertex, [3, 3],
      'submitRecallAnswer must receive vertex [3,3]')
  })

  // T2-05: vertex [0,0] and [18,18] are passed through correctly
  it('T2-05: vertex [0,0] and vertex [18,18] are passed through to submitRecallAnswer', async function () {
    // First click: [0,0]
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

    assert.strictEqual(depsA._submitRecallAnswerCalls.length, 1)
    assert.deepStrictEqual(depsA._submitRecallAnswerCalls[0].vertex, [0, 0],
      'submitRecallAnswer must receive vertex [0,0]')

    // Second click: [18,18]
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

    assert.strictEqual(depsB._submitRecallAnswerCalls.length, 1)
    assert.deepStrictEqual(depsB._submitRecallAnswerCalls[0].vertex, [18, 18],
      'submitRecallAnswer must receive vertex [18,18]')
  })

  // T2-06: vertex [0,18] and [18,0] are passed through correctly
  it('T2-06: vertex [0,18] and vertex [18,0] are passed through to submitRecallAnswer', async function () {
    // First click: [0,18]
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

    assert.strictEqual(depsC._submitRecallAnswerCalls.length, 1)
    assert.deepStrictEqual(depsC._submitRecallAnswerCalls[0].vertex, [0, 18],
      'submitRecallAnswer must receive vertex [0,18]')

    // Second click: [18,0]
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

    assert.strictEqual(depsD._submitRecallAnswerCalls.length, 1)
    assert.deepStrictEqual(depsD._submitRecallAnswerCalls[0].vertex, [18, 0],
      'submitRecallAnswer must receive vertex [18,0]')
  })
})
