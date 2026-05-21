/**
 * W8-P2 Executor Routing Wiring Tests
 *
 * Test contract: docs/design/2026-05-21/w8-p2-executor-routing/test-contract-v0.1.md
 * Contracts covered: T-PLAY-01, T-PLAY-02, T-PLAY-03, T-RECALL-01, T-RECALL-02,
 *                   T-SCRATCH-01, T-SCRATCH-02, T-DEFERRED-01, T-ARCH-01
 *
 * Source of truth alignment:
 *   - PRD v0.5 SS3.1: Play - user move writes to game tree, triggers AI reply
 *   - PRD v0.5 SS3.3: Recall - user recalls moves, writes RecallAttempt, NOT game tree
 *   - PRD v0.5 SS3.4: Analysis - free placement on scratch, NOT game tree or Attempt
 *   - Arch v0.5 SS0.3: Controller only routes; Executor performs writes
 *   - Arch v0.5 SS1.2: Command write path UI -> Controller -> Service -> Store/Repo
 *   - Arch v0.5 SS9.3: play -> documentStore.playMove -> engineReply -> analysis
 *   - Arch v0.5 SS14: Analysis does NOT pollute Attempt; recall does NOT modify game tree
 *   - playInteractionExecutor.js: calls documentStore.playMove, engineService.generateReply,
 *     analysisService.scheduleLiveAnalysis
 *   - recallInteractionExecutor.js: calls trainingStore.submitRecallAnswer, NOT documentStore
 *   - scratchEditInteractionExecutor.js: operates on working position, calls
 *     invalidateEditAnalysis + scheduleEditWorkspaceAnalysis
 *
 * v0.5 conflict check: No conflicts found. Contract tests executor routing from controller
 * through real executors. No origin.provider branching, no source-specific tab API,
 * no container store writes, no UI service/store imports.
 *
 * Test classification:
 *   - T-PLAY-01/02/03: SIDE_EFFECT_BOUNDARY (controller + playInteractionExecutor end-to-end)
 *   - T-RECALL-01/02: SIDE_EFFECT_BOUNDARY (controller + recallInteractionExecutor end-to-end)
 *   - T-SCRATCH-01/02: SIDE_EFFECT_BOUNDARY (controller + scratchEditInteractionExecutor end-to-end)
 *   - T-DEFERRED-01: SIDE_EFFECT_BOUNDARY (controller DEFERRED path)
 *   - T-ARCH-01: ARCHITECTURE_BOUNDARY (source code structural check)
 *
 * Long-term vs migration:
 *   - T-PLAY-01/02/03: Long-term. Protects play executor full chain including
 *     engineService.generateReply and analysisService.scheduleLiveAnalysis.
 *   - T-RECALL-01: Long-term. Protects game tree isolation in recall path.
 *   - T-RECALL-02: Long-term. Protects recall executor output contract.
 *   - T-SCRATCH-01: Long-term. Protects scratch isolation boundary.
 *   - T-SCRATCH-02: Long-term. Protects scratch analysis scheduling via executor.
 *   - T-DEFERRED-01: Long-term. Protects deferred delegation isolation.
 *   - T-ARCH-01: Long-term. Protects executor import structure in controller.
 *
 * Workbench wiring coverage:
 *   - UI command mapping: none (handled by W8-P1 T19)
 *   - Container handler -> controller: none (handled by W8-P1 T24)
 *   - Controller -> executor -> service/store: T-PLAY-01/02/03, T-RECALL-01/02,
 *     T-SCRATCH-01/02, T-DEFERRED-01
 *   - Store subscription -> projection: none (handled by W8-P2 T2-01..T2-03)
 *
 * Test layer ID mapping:
 *
 *   Test ID       | Layer                 | Production Subject              | Real Dependencies                   | Mocked Dependencies                   | Forbidden Mocks              | Primary Assertion                                        | Long-term/Migration
 *   T-PLAY-01     | SIDE_EFFECT_BOUNDARY  | controller + playExecutor       | resolver, contextBuilder, playExec  | documentStore spy, engineService spy, analysisService spy | resolver, playExecutor | engineService.generateReply AND analysisService.scheduleLiveAnalysis called | Long-term
 *   T-PLAY-02     | SIDE_EFFECT_BOUNDARY  | controller + playExecutor       | resolver, contextBuilder, playExec  | documentStore (changed:false), engineService spy, analysisService spy | resolver, playExecutor | engineService NOT called, analysisService NOT called | Long-term
 *   T-PLAY-03     | SIDE_EFFECT_BOUNDARY  | controller + playExecutor       | resolver, contextBuilder, playExec  | documentStore (doublePass:true), engineService spy, analysisService spy | resolver, playExecutor | engineService NOT called; analysisService IS called | Long-term
 *   T-RECALL-01   | SIDE_EFFECT_BOUNDARY  | controller + recallExecutor     | resolver, contextBuilder, recallExec| documentStore spy, trainingStore spy | resolver, recallExecutor | result.handled===true && result.isCorrect===true; documentStore NOT called | Long-term
 *   T-RECALL-02   | SIDE_EFFECT_BOUNDARY  | controller + recallExecutor     | resolver, contextBuilder, recallExec| trainingStore spy (returning {handled,changed,isCorrect}) | resolver, recallExecutor | vertex [3,3] passed through executor; result.handled/changed/isCorrect === true | Long-term
 *   T-SCRATCH-01  | SIDE_EFFECT_BOUNDARY  | controller + scratchExecutor    | resolver, contextBuilder, scratchExec| editWorkspaceContext mock, editWorkspaceDeps spy, documentStore spy, trainingStore spy | resolver, scratchExecutor | result.handled/changed===true, result.snapshot!=null; documentStore/trainingStore NOT called | Long-term
 *   T-SCRATCH-02  | SIDE_EFFECT_BOUNDARY  | controller + scratchExecutor    | resolver, contextBuilder, scratchExec| editWorkspaceContext mock, editWorkspaceDeps spy | resolver, scratchExecutor | result.snapshot.signMap[3][3]!==0; invalidateEditAnalysis AND scheduleEditWorkspaceAnalysis called | Long-term
 *   T-DEFERRED-01 | SIDE_EFFECT_BOUNDARY  | controller                      | resolver, contextBuilder            | legacySabaki spy, documentStore spy, engineService spy, analysisService spy | resolver | legacySabaki.clickVertex called; NO executor/service calls | Long-term
 *   T-ARCH-01     | ARCHITECTURE_BOUNDARY | controller source code          | fs (source read)                    | None                                  | N/A | Source contains executor imports, not direct service calls | Long-term
 *
 * Harness manifest:
 *
 *   Harness "createPlayTestDeps" (T-PLAY-01/02/03):
 *     - Real production modules: resolveBoardInteraction, createBoardInteractionContext,
 *       executePlayInteraction, createBoardInteractionController
 *     - Fake/spy modules: documentStore spy, engineService spy, analysisService spy
 *     - Valid for: SIDE_EFFECT_BOUNDARY (controller -> executor -> service chain)
 *     - Not valid for: CONTAINER_DELEGATION, RENDERED_UI_RETURN, STORE_SUBSCRIPTION
 *
 *   Harness "createRecallTestDeps" (T-RECALL-01/02):
 *     - Real production modules: resolveBoardInteraction, createBoardInteractionContext,
 *       executeRecallInteraction, createBoardInteractionController
 *     - Fake/spy modules: trainingStore spy, documentStore spy
 *     - Valid for: SIDE_EFFECT_BOUNDARY (controller -> executor -> store chain)
 *     - Not valid for: CONTAINER_DELEGATION, RENDERED_UI_RETURN
 *
 *   Harness "createScratchTestDeps" (T-SCRATCH-01/02):
 *     - Real production modules: resolveBoardInteraction, createBoardInteractionContext,
 *       executeScratchEdit, createBoardInteractionController
 *     - Fake/spy modules: editWorkspaceContext mock with currentSnapshot,
 *       editWorkspaceDeps spy, documentStore spy, trainingStore spy
 *     - Valid for: SIDE_EFFECT_BOUNDARY (controller -> executor -> workspace chain)
 *     - Not valid for: CONTAINER_DELEGATION, RENDERED_UI_RETURN
 *
 *   Harness "createDeferredTestDeps" (T-DEFERRED-01):
 *     - Real production modules: resolveBoardInteraction, createBoardInteractionContext,
 *       createBoardInteractionController
 *     - Fake/spy modules: legacySabaki spy, documentStore spy, engineService spy,
 *       analysisService spy
 *     - Valid for: SIDE_EFFECT_BOUNDARY (deferred -> legacy delegation)
 *     - Not valid for: EXECUTOR_ROUTING, STORE_SUBSCRIPTION
 *
 * Fragile test warnings:
 *   1. T-PLAY-01/02/03, T-RECALL-01/02, T-SCRATCH-01/02: Do NOT mock resolveBoardInteraction
 *      or the executors. They must run for real. The whole point is proving the executor path
 *      works end-to-end. If you mock them, the test proves nothing.
 *   2. T-PLAY-01: engineService.generateReply call assertion depends on the executor's
 *      orchestration logic. If the executor changes the order or conditions, this test
 *      will need updating, but the contract (engine reply after changed move) is stable.
 *   3. T-SCRATCH-01/02: editWorkspaceContext mock must provide a valid currentSnapshot with
 *      a signMap. The scratchEdit executor reads signMap to perform stone placement.
 *   4. T-ARCH-01: Source code regex check. If controller refactors (e.g. dynamic import),
 *      the regex may need adjustment, but the architectural constraint (no direct service
 *      calls outside executor invocation) is stable.
 *   5. All tests are expected to be RED until boardInteractionController.ts is updated
 *      to import and call the executors instead of directly calling service/store methods,
 *      AND to return the executor result from handleBoardClick (not `return` undefined).
 */

import assert from 'assert'
import fs from 'fs'
import path from 'path'

// --- Real production imports (NOT mocked) ---

import {resolveBoardInteraction} from '../../../src/modules/workbench/board-interactions/resolveBoardInteraction.ts'
import {createBoardInteractionContext} from '../../../src/modules/workbench/board-interactions/createBoardInteractionContext.ts'
import {executePlayInteraction} from '../../../src/modules/workbench/board-interactions/executors/playInteractionExecutor.js'
import {executeRecallInteraction} from '../../../src/modules/workbench/board-interactions/executors/recallInteractionExecutor.js'
import {executeScratchEdit} from '../../../src/modules/workbench/board-interactions/executors/scratchEditInteractionExecutor.js'
import {createBoardInteractionController} from '../../../src/modules/training/workbench/boardInteractionController.ts'
import {createLoggerService} from '../../../src/modules/logger/LoggerService.js'
import {createConsoleWriter} from '../../../src/modules/logger/consoleWriter.js'

// --- Logger for test harness (real, not mocked per wiring test rules) ---

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
    mode: 'play',
    childTabIds: [],
    playerConfig: null,
    activeRecallSessionId: 'rs_test',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Create controller deps for play executor tests.
 * The controller must route through executePlayInteraction which calls
 * documentStore.playMove, then conditionally engineService.generateReply
 * and analysisService.scheduleLiveAnalysis.
 *
 * This harness provides spy documentStore, engineService, and analysisService.
 * The controller's getPlayServices must return all three.
 */
function createPlayTestDeps(documentStoreResult) {
  const engineCalls = []
  const analysisCalls = []
  const documentStoreCalls = []

  return {
    deps: {
      getPlayServices: () => ({
        documentStore: {
          playMove: async (vertex, opts) => {
            documentStoreCalls.push({vertex, opts})
            return documentStoreResult
          },
        },
        engineService: {
          generateReply: (...args) => engineCalls.push(args),
        },
        analysisService: {
          scheduleLiveAnalysis: (...args) => analysisCalls.push(args),
        },
      }),
      getRecallAdapter: () => ({submitBoardClick: async () => ({handled: false})}),
      getEditWorkspaceContext: () => null,
      getEditWorkspaceDeps: () => ({}),
      getLegacySabaki: () => ({clickVertex: () => {}}),
      getIsMac: () => false,
    },
    engineCalls,
    analysisCalls,
    documentStoreCalls,
  }
}

/**
 * Create controller deps for recall executor tests.
 * The controller must route through executeRecallInteraction which calls
 * trainingStore.submitRecallAnswer and must NOT call documentStore.
 */
function createRecallTestDeps(recallAnswerResult = {handled: true, changed: true, isCorrect: true}) {
  const recallAnswerCalls = []
  const documentStoreCalls = []

  return {
    deps: {
      getPlayServices: () => ({
        documentStore: {
          playMove: async (vertex, opts) => {
            documentStoreCalls.push({vertex, opts})
            return {valid: true, changed: false}
          },
        },
      }),
      getRecallAdapter: () => ({
        submitBoardClick: async (vertex) => {
          recallAnswerCalls.push({vertex})
          return recallAnswerResult
        },
      }),
      getEditWorkspaceContext: () => null,
      getEditWorkspaceDeps: () => ({}),
      getLegacySabaki: () => ({clickVertex: () => {}}),
      getIsMac: () => false,
    },
    recallAnswerCalls,
    documentStoreCalls,
  }
}

/**
 * Create controller deps for scratch executor tests.
 * The controller must route through executeScratchEdit which operates
 * on editWorkspaceContext and must NOT call documentStore or trainingStore.
 */
function createScratchTestDeps() {
  const invalidateCalls = []
  const scheduleCalls = []
  const documentStoreCalls = []
  const recallAnswerCalls = []

  // Mock editWorkspaceContext with a valid currentSnapshot (19x19 empty board).
  // The scratchEdit executor reads signMap to perform stone placement.
  const editWorkspaceContext = {
    activeTab: 'current',
    currentSnapshot: {
      id: 'snap_1',
      role: 'current',
      signMap: Array(19).fill(null).map(() => Array(19).fill(0)),
      nextPlayer: 1,
      width: 19,
      height: 19,
    },
    referenceSnapshot: null,
    currentMarkerMap: Array(19).fill(null).map(() => Array(19).fill(null)),
    referenceMarkerMap: null,
    currentLines: [],
    referenceLines: null,
    lineFirstVertex: null,
  }

  return {
    deps: {
      getPlayServices: () => ({
        documentStore: {
          playMove: async (vertex, opts) => {
            documentStoreCalls.push({vertex, opts})
            return {valid: true, changed: false}
          },
        },
      }),
      getRecallAdapter: () => ({
        submitBoardClick: async (vertex) => {
          recallAnswerCalls.push({vertex})
          return {handled: false, changed: false}
        },
      }),
      getEditWorkspaceContext: () => editWorkspaceContext,
      getEditWorkspaceDeps: () => ({
        invalidateEditAnalysis: () => invalidateCalls.push({}),
        scheduleEditWorkspaceAnalysis: (tab) => scheduleCalls.push({tab}),
      }),
      getLegacySabaki: () => ({clickVertex: () => {}}),
      getIsMac: () => false,
    },
    invalidateCalls,
    scheduleCalls,
    documentStoreCalls,
    recallAnswerCalls,
    editWorkspaceContext,
  }
}

/**
 * Create controller deps for deferred tests.
 * All service/store deps are spies to verify nothing is called.
 */
function createDeferredTestDeps() {
  const legacyClickCalls = []
  const documentStoreCalls = []
  const engineCalls = []
  const analysisCalls = []
  const recallAnswerCalls = []
  const invalidateCalls = []
  const scheduleCalls = []

  return {
    deps: {
      getPlayServices: () => ({
        documentStore: {
          playMove: async (vertex, opts) => {
            documentStoreCalls.push({vertex, opts})
            return {valid: true, changed: true, treePosition: 'node_2'}
          },
        },
        engineService: {
          generateReply: (...args) => engineCalls.push(args),
        },
        analysisService: {
          scheduleLiveAnalysis: (...args) => analysisCalls.push(args),
        },
      }),
      getRecallAdapter: () => ({
        submitBoardClick: async (vertex) => {
          recallAnswerCalls.push({vertex})
          return {handled: false, changed: false}
        },
      }),
      getEditWorkspaceContext: () => null,
      getEditWorkspaceDeps: () => ({
        invalidateEditAnalysis: () => invalidateCalls.push({}),
        scheduleEditWorkspaceAnalysis: (tab) => scheduleCalls.push({tab}),
      }),
      getLegacySabaki: () => ({
        clickVertex: (vertex, opts) => legacyClickCalls.push({vertex, opts}),
      }),
      getIsMac: () => false,
    },
    legacyClickCalls,
    documentStoreCalls,
    engineCalls,
    analysisCalls,
    recallAnswerCalls,
    invalidateCalls,
    scheduleCalls,
  }
}

// ===========================================================================
// T-PLAY-01/02/03: Play executor routing
// Real controller, real resolver, real playInteractionExecutor.
// Only service deps are spied.
// ===========================================================================

describe('W8-P2 Executor Routing: Play (T-PLAY-01..T-PLAY-03)', function () {

  // T-PLAY-01: Play executor full path
  //
  // Contract Section 4.1: Play full chain
  //   resolveBoardInteraction -> RESOLVED, intent=play-stone, mutationContract=playMove
  //   -> executePlayInteraction(result, {player}, {documentStore, engineService, analysisService})
  //      -> documentStore.playMove -> {valid:true, changed:true, treePosition:'node_2'}
  //      -> engineService.generateReply(treePosition, player)  (because changed && !doublePass)
  //      -> analysisService.scheduleLiveAnalysis(treePosition)  (because changed)
  //
  // This CANNOT be satisfied by calling documentStore.playMove alone; only the
  // play executor orchestrates these follow-up calls.
  //
  // RED until boardInteractionController.ts calls executePlayInteraction instead
  // of directly calling documentStore.playMove.
  it('T-PLAY-01: play executor calls engineService.generateReply AND analysisService.scheduleLiveAnalysis after changed move', async function () {
    const harness = createPlayTestDeps({
      valid: true,
      changed: true,
      treePosition: 'node_2',
    })
    const controller = createBoardInteractionController(harness.deps)

    await controller.handleBoardClick({
      vertex: [3, 3],
      event: {button: 0, ctrlKey: false, metaKey: false},
      activeTab: makeTab({mode: 'play'}),
      settings: {selectedTool: 'stone_1'},
      board: makeMockBoard(),
      editWorkspacePresent: false,
      task: null,
      runtimeState: {},
    })

    // documentStore.playMove must have been called
    assert.strictEqual(harness.documentStoreCalls.length, 1,
      'documentStore.playMove must be called exactly once')
    assert.deepStrictEqual(harness.documentStoreCalls[0].vertex, [3, 3])

    // engineService.generateReply must be called with treePosition
    // Contract SS9.3: engine reply after changed move
    assert.strictEqual(harness.engineCalls.length, 1,
      'engineService.generateReply must be called exactly once after changed move. ' +
      'Contract Section 4.1: executePlayInteraction orchestrates engineReply.')
    assert.strictEqual(harness.engineCalls[0][0], 'node_2',
      'engineService.generateReply must receive treePosition "node_2"')

    // analysisService.scheduleLiveAnalysis must be called
    assert.strictEqual(harness.analysisCalls.length, 1,
      'analysisService.scheduleLiveAnalysis must be called exactly once after changed move. ' +
      'Contract Section 4.1: executePlayInteraction orchestrates live analysis.')
    assert.strictEqual(harness.analysisCalls[0][0], 'node_2',
      'analysisService.scheduleLiveAnalysis must receive treePosition "node_2"')
  })

  // T-PLAY-02: Play executor -- unchanged move
  //
  // Contract Section 4.1: when documentStore.playMove returns {valid:true, changed:false},
  // engineService.generateReply must NOT be called (no move to reply to) and
  // analysisService.scheduleLiveAnalysis must NOT be called (no state change to analyze).
  //
  // RED until boardInteractionController.ts calls executePlayInteraction.
  it('T-PLAY-02: play executor does NOT call engine or analysis when move unchanged', async function () {
    const harness = createPlayTestDeps({
      valid: true,
      changed: false,
    })
    const controller = createBoardInteractionController(harness.deps)

    await controller.handleBoardClick({
      vertex: [3, 3],
      event: {button: 0, ctrlKey: false, metaKey: false},
      activeTab: makeTab({mode: 'play'}),
      settings: {selectedTool: 'stone_1'},
      board: makeMockBoard(),
      editWorkspacePresent: false,
      task: null,
      runtimeState: {},
    })

    assert.strictEqual(harness.engineCalls.length, 0,
      'engineService.generateReply must NOT be called for unchanged move')
    assert.strictEqual(harness.analysisCalls.length, 0,
      'analysisService.scheduleLiveAnalysis must NOT be called for unchanged move')
  })

  // T-PLAY-03: Play executor -- double pass
  //
  // Contract Section 4.1: when documentStore.playMove returns
  // {valid:true, changed:true, treePosition:'node_2', doublePass:true},
  // engineService.generateReply must NOT be called (game ends on double pass),
  // but analysisService.scheduleLiveAnalysis MUST be called (state changed).
  //
  // RED until boardInteractionController.ts calls executePlayInteraction.
  it('T-PLAY-03: play executor skips engine but calls analysis on double pass', async function () {
    const harness = createPlayTestDeps({
      valid: true,
      changed: true,
      treePosition: 'node_2',
      doublePass: true,
    })
    const controller = createBoardInteractionController(harness.deps)

    await controller.handleBoardClick({
      vertex: [3, 3],
      event: {button: 0, ctrlKey: false, metaKey: false},
      activeTab: makeTab({mode: 'play'}),
      settings: {selectedTool: 'stone_1'},
      board: makeMockBoard(),
      editWorkspacePresent: false,
      task: null,
      runtimeState: {},
    })

    // engineService must NOT be called on double pass
    assert.strictEqual(harness.engineCalls.length, 0,
      'engineService.generateReply must NOT be called on double pass')

    // analysisService must still be called (state changed)
    assert.strictEqual(harness.analysisCalls.length, 1,
      'analysisService.scheduleLiveAnalysis must be called on double pass (state changed)')
    assert.strictEqual(harness.analysisCalls[0][0], 'node_2',
      'analysisService.scheduleLiveAnalysis must receive treePosition "node_2"')
  })
})

// ===========================================================================
// T-RECALL-01/02: Recall executor routing
// Real controller, real resolver, real recallInteractionExecutor.
// =============================================================================

describe('W8-P2 Executor Routing: Recall (T-RECALL-01..T-RECALL-02)', function () {

  // T-RECALL-01: Recall game tree protection + return value contract
  //
  // Contract Section 4.2: Recall path writes to trainingStore.submitRecallAnswer,
  // NOT to documentStore.playMove. This is Arch v0.5 SS14 protection.
  //
  // Additionally, the controller must return the executor's result object with
  // {handled: true, isCorrect: true} so that upstream callers can react to the
  // recall outcome. The defective controller returns undefined because it does
  // `return` without forwarding the executor result (line 205).
  //
  // RED until boardInteractionController.ts calls executeRecallInteraction AND
  // returns its result.
  it('T-RECALL-01: recall executor does NOT call documentStore.playMove and returns {handled:true, isCorrect}', async function () {
    const harness = createRecallTestDeps()
    const controller = createBoardInteractionController(harness.deps)

    const result = await controller.handleBoardClick({
      vertex: [5, 5],
      event: {button: 0, ctrlKey: false, metaKey: false},
      activeTab: makeTab({mode: 'recall', activeRecallSessionId: 'rs_123'}),
      settings: {selectedTool: 'stone_1'},
      board: makeMockBoard(),
      editWorkspacePresent: false,
      task: null,
      runtimeState: {},
    })

    // Return value must reflect executor output, not undefined.
    // The defective controller does `return` without the executor result.
    assert.ok(result != null,
      'handleBoardClick must return the executor result object, not undefined. ' +
      'Contract Section 4.2: controller forwards executeRecallInteraction return value.')
    assert.strictEqual(result.handled, true,
      'Recall result.handled must be true. ' +
      'Contract Section 4.2: executeRecallInteraction returns {handled:true} on success.')
    assert.strictEqual(result.isCorrect, true,
      'Recall result.isCorrect must be true (from adapter.submitBoardClick). ' +
      'Contract Section 4.2: executor forwards isCorrect from store.')

    assert.strictEqual(harness.documentStoreCalls.length, 0,
      'documentStore.playMove must NOT be called for recall. ' +
      'Arch v0.5 SS14: recall does NOT modify game tree. ' +
      'Contract Section 6.4: recall path must not write to game tree.')
  })

  // T-RECALL-02: Recall executor correct output + return value
  //
  // Contract Section 4.2: executeRecallInteraction(result, {}, {trainingStore})
  //   -> trainingStore.submitRecallAnswer(vertex) -> {handled:true, changed:true, isCorrect:true}
  // The vertex must be passed through correctly to the executor.
  //
  // The controller must return the executor's result with {handled:true, changed:true,
  // isCorrect:true}. The defective controller returns undefined.
  //
  // RED until boardInteractionController.ts calls executeRecallInteraction AND
  // returns its result.
  it('T-RECALL-02: recall executor passes vertex [3,3] and returns {handled:true, changed:true, isCorrect:true}', async function () {
    const harness = createRecallTestDeps({
      handled: true,
      changed: true,
      isCorrect: true,
    })
    const controller = createBoardInteractionController(harness.deps)

    const result = await controller.handleBoardClick({
      vertex: [3, 3],
      event: {button: 0, ctrlKey: false, metaKey: false},
      activeTab: makeTab({mode: 'recall', activeRecallSessionId: 'rs_456'}),
      settings: {selectedTool: 'stone_1'},
      board: makeMockBoard(),
      editWorkspacePresent: false,
      task: null,
      runtimeState: {},
    })

    // trainingStore.submitRecallAnswer must have been called with vertex [3,3]
    // Contract Section 4.2: executeRecallInteraction passes vertex through
    assert.strictEqual(harness.recallAnswerCalls.length, 1,
      'adapter.submitBoardClick must be called exactly once')
    assert.deepStrictEqual(harness.recallAnswerCalls[0].vertex, [3, 3],
      'submitBoardClick must receive vertex [3,3] from the executor')

    // Return value must reflect executor output, not undefined.
    // The defective controller does `return` without the executor result (line 205).
    assert.ok(result != null,
      'handleBoardClick must return the executor result object, not undefined. ' +
      'Contract Section 4.2: controller forwards executeRecallInteraction return value.')
    assert.strictEqual(result.handled, true,
      'Recall result.handled must be true. ' +
      'Contract Section 4.2: executor returns {handled:true}.')
    assert.strictEqual(result.changed, true,
      'Recall result.changed must be true. ' +
      'Contract Section 4.2: executor returns {changed:true}.')
    assert.strictEqual(result.isCorrect, true,
      'Recall result.isCorrect must be true. ' +
      'Contract Section 4.2: executor forwards isCorrect from store.')
  })
})

// ===========================================================================
// T-SCRATCH-01/02: Scratch executor routing
// Real controller, real resolver, real scratchEditInteractionExecutor.
// ==========================================================================

describe('W8-P2 Executor Routing: Scratch (T-SCRATCH-01..T-SCRATCH-02)', function () {

  // T-SCRATCH-01: Scratch isolation boundary + return value
  //
  // Contract Section 4.3: Scratch executor operates on editWorkspaceContext,
  // NOT on documentStore or trainingStore. Arch v0.5 SS14 protection.
  //
  // The controller must return the executor's result with {handled:true, changed:true,
  // snapshot: {..., signMap}}. The defective controller returns undefined because it
  // does `return` without forwarding the executor result (line 219).
  //
  // RED until boardInteractionController.ts calls executeScratchEdit AND returns its result.
  it('T-SCRATCH-01: scratch executor does NOT call documentStore/trainingStore and returns {handled:true, changed:true, snapshot}', async function () {
    const harness = createScratchTestDeps()
    const controller = createBoardInteractionController(harness.deps)

    // mode=analysis, editWorkspacePresent=true, selectedTool=stone_1
    // -> resolver returns RESOLVED, intent=place-black-stone, mutationContract=scratchEdit
    const result = await controller.handleBoardClick({
      vertex: [3, 3],
      event: {button: 0, ctrlKey: false, metaKey: false},
      activeTab: makeTab({mode: 'analysis'}),
      settings: {selectedTool: 'stone_1'},
      board: makeMockBoard(),
      editWorkspacePresent: true,
      task: null,
      runtimeState: {},
    })

    // Return value must reflect executor output, not undefined.
    // The defective controller does `return` without the executor result.
    assert.ok(result != null,
      'handleBoardClick must return the executor result object, not undefined. ' +
      'Contract Section 4.3: controller forwards executeScratchEdit return value.')
    assert.strictEqual(result.handled, true,
      'Scratch result.handled must be true. ' +
      'Contract Section 4.3: executeScratchEdit returns {handled:true} on success.')
    assert.strictEqual(result.changed, true,
      'Scratch result.changed must be true (stone placed at empty intersection). ' +
      'Contract Section 4.3: executeScratchEdit returns {changed:true} when board state changes.')
    assert.ok(result.snapshot != null,
      'Scratch result.snapshot must be present. ' +
      'Contract Section 4.3: executeScratchEdit returns updated snapshot with signMap.')

    // documentStore must NOT be called
    assert.strictEqual(harness.documentStoreCalls.length, 0,
      'documentStore.playMove must NOT be called for scratch edit. ' +
      'Arch v0.5 SS14: scratch does NOT write to game tree.')

    // trainingStore must NOT be called
    assert.strictEqual(harness.recallAnswerCalls.length, 0,
      'adapter.submitBoardClick must NOT be called for scratch edit. ' +
      'Arch v0.5 SS14: scratch does NOT modify Attempt.')
  })

  // T-SCRATCH-02: Scratch analysis scheduling + snapshot return value
  //
  // Contract Section 4.3: executeScratchEdit(result, editWorkspaceContext, editWorkspaceDeps)
  //   -> places stone on snapshot (signMap[3][3] becomes non-zero for black stone)
  //   -> invalidateEditAnalysis()
  //   -> scheduleEditWorkspaceAnalysis(tab)
  //
  // The controller must return the executor's result including snapshot with the placed
  // stone. The defective controller returns undefined (line 219).
  //
  // RED until boardInteractionController.ts calls executeScratchEdit AND returns its result.
  it('T-SCRATCH-02: scratch executor returns snapshot with placed stone and calls analysis deps', async function () {
    const harness = createScratchTestDeps()
    const controller = createBoardInteractionController(harness.deps)

    const result = await controller.handleBoardClick({
      vertex: [3, 3],
      event: {button: 0, ctrlKey: false, metaKey: false},
      activeTab: makeTab({mode: 'analysis'}),
      settings: {selectedTool: 'stone_1'},
      board: makeMockBoard(),
      editWorkspacePresent: true,
      task: null,
      runtimeState: {},
    })

    // Return value must reflect executor output with placed stone in snapshot.
    // The defective controller returns undefined; result.snapshot would be undefined
    // and result.snapshot.signMap[3][3] would throw TypeError.
    assert.ok(result != null,
      'handleBoardClick must return the executor result object, not undefined.')
    assert.ok(result.snapshot != null,
      'Result must include snapshot from executeScratchEdit.')
    assert.notStrictEqual(result.snapshot.signMap[3][3], 0,
      'snapshot.signMap[3][3] must be non-zero after placing a black stone at [3,3]. ' +
      'Contract Section 4.3: executeScratchEdit places stone and returns updated signMap.')

    // Contract Section 4.3: scratch executor must trigger edit analysis invalidation
    assert.ok(harness.invalidateCalls.length >= 1,
      'invalidateEditAnalysis must be called at least once via executeScratchEdit. ' +
      `Got ${harness.invalidateCalls.length} calls.`)

    // Contract Section 4.3: scratch executor must schedule workspace analysis
    assert.ok(harness.scheduleCalls.length >= 1,
      'scheduleEditWorkspaceAnalysis must be called at least once via executeScratchEdit. ' +
      `Got ${harness.scheduleCalls.length} calls.`)
  })
})

// ===========================================================================
// T-DEFERRED-01: Deferred clean delegation
// Real controller, real resolver.
// ==========================================================================

describe('W8-P2 Executor Routing: Deferred (T-DEFERRED-01)', function () {

  // T-DEFERRED-01: Deferred clean delegation
  //
  // Contract Section 4.4: When resolver returns DEFERRED (e.g. analysis without
  // editWorkspace), controller must delegate to legacySabaki.clickVertex and
  // must NOT call any executor, documentStore, engineService, analysisService,
  // or trainingStore.
  it('T-DEFERRED-01: deferred routes to legacySabaki.clickVertex, no executors or services called', async function () {
    const harness = createDeferredTestDeps()
    const controller = createBoardInteractionController(harness.deps)

    // analysis without editWorkspace -> resolver returns DEFERRED
    await controller.handleBoardClick({
      vertex: [3, 3],
      event: {button: 0, ctrlKey: false, metaKey: false},
      activeTab: makeTab({mode: 'analysis'}),
      settings: {selectedTool: 'stone_1'},
      board: makeMockBoard(),
      editWorkspacePresent: false,
      task: null,
      runtimeState: {},
    })

    // legacySabaki.clickVertex must be called
    assert.strictEqual(harness.legacyClickCalls.length, 1,
      'legacySabaki.clickVertex must be called exactly once for deferred')
    assert.deepStrictEqual(harness.legacyClickCalls[0].vertex, [3, 3])

    // NO executor/service calls
    assert.strictEqual(harness.documentStoreCalls.length, 0,
      'documentStore.playMove must NOT be called for deferred')
    assert.strictEqual(harness.engineCalls.length, 0,
      'engineService.generateReply must NOT be called for deferred')
    assert.strictEqual(harness.analysisCalls.length, 0,
      'analysisService.scheduleLiveAnalysis must NOT be called for deferred')
    assert.strictEqual(harness.recallAnswerCalls.length, 0,
      'adapter.submitBoardClick must NOT be called for deferred')
    assert.strictEqual(harness.invalidateCalls.length, 0,
      'invalidateEditAnalysis must NOT be called for deferred')
    assert.strictEqual(harness.scheduleCalls.length, 0,
      'scheduleEditWorkspaceAnalysis must NOT be called for deferred')
  })
})

// ===========================================================================
// T-ARCH-01: Architecture boundary check
// Source code structural verification.
// ===========================================================================

describe('W8-P2 Executor Routing: Architecture (T-ARCH-01)', function () {

  // T-ARCH-01: Source code structural check
  //
  // Contract Section 6: Controller must NOT directly call documentStore.playMove,
  // submitRecallMove/submitRecallAnswer, or invalidateEditAnalysis.
  // All writes must go through executors.
  //
  // Contract Section 3: Target implementation imports and calls:
  //   - executePlayInteraction
  //   - executeRecallInteraction
  //   - executeScratchEdit
  //
  // This test reads the source file and checks the structural constraints.
  // RED until boardInteractionController.ts imports the executors.
  it('T-ARCH-01: controller imports executors and does NOT directly call service methods', function () {
    const controllerPath = path.resolve(
      __dirname,
      '../../../src/modules/training/workbench/boardInteractionController.ts'
    )
    const source = fs.readFileSync(controllerPath, 'utf8')

    // MUST contain executor imports
    assert.ok(
      source.includes('executePlayInteraction'),
      'boardInteractionController must import executePlayInteraction. ' +
      'Contract Section 3: playMove path must go through executePlayInteraction.'
    )
    assert.ok(
      source.includes('executeRecallInteraction'),
      'boardInteractionController must import executeRecallInteraction. ' +
      'Contract Section 3: recallAnswer path must go through executeRecallInteraction.'
    )
    assert.ok(
      source.includes('executeScratchEdit'),
      'boardInteractionController must import executeScratchEdit. ' +
      'Contract Section 3: scratchEdit path must go through executeScratchEdit.'
    )

    // MUST NOT contain direct service calls as execution statements.
    // We check for these patterns OUTSIDE of import/type declarations and comments.
    //
    // "documentStore.playMove(" as a direct call (not via executor)
    // Pattern: NOT preceded by "import" and is used as a function call
    const directPlayMoveCall = source.match(/\bdocumentStore\.playMove\s*\(/g)
    if (directPlayMoveCall) {
      // If there are matches, verify they are only in comments, type declarations, or import statements.
      // A direct call looks like: deps.getPlayServices().documentStore.playMove(vertex, ...)
      // An executor call looks like: executePlayInteraction(result, ctx, {documentStore, ...})
      // We check if the documentStore.playMove call is inside the controller function body
      // (not in a type definition or comment).
      //
      // Strategy: check if the source contains the pattern as an execution statement
      // (i.e. not preceded by // or * or inside a type block).
      // A simple heuristic: if documentStore.playMove appears outside of the executor import
      // and is called with await or as a statement, it is a direct call.
      //
      // For robustness, we check for the pattern "documentStore.playMove(vertex" which would
      // indicate a direct execution call.
      assert.ok(
        !source.match(/\bdocumentStore\.playMove\s*\(\s*vertex/),
        'boardInteractionController must NOT directly call documentStore.playMove(vertex, ...). ' +
        'Contract Section 6.1: play writes must go through executePlayInteraction.'
      )
    }

    // "submitRecallMove(" or "submitRecallAnswer(" as direct method calls (with preceding dot)
    // The regex requires a preceding dot to distinguish from type declarations.
    assert.ok(
      !source.match(/\.submitRecallAnswer\s*\(\s*vertex/),
      'boardInteractionController must NOT directly call .submitRecallAnswer(vertex). ' +
      'Contract Section 6.2: recall writes must go through executeRecallInteraction.'
    )
    assert.ok(
      !source.match(/\.submitRecallMove\s*\(\s*\{/),
      'boardInteractionController must NOT directly call .submitRecallMove({...}). ' +
      'Contract Section 6.2: recall writes must go through executeRecallInteraction.'
    )

    // "invalidateEditAnalysis()" as direct call outside of executor
    assert.ok(
      !source.match(/\binvalidateEditAnalysis\s*\(\s*\)/),
      'boardInteractionController must NOT directly call invalidateEditAnalysis(). ' +
      'Contract Section 6.3: scratch writes must go through executeScratchEdit.'
    )
  })
})