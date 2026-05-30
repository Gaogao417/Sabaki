/**
 * W3.5 Board Interaction Controller Wiring Tests
 *
 * Test contract: docs/design/2026-05-21/workbench-wiring/w3.5-goban-data-source-wiring-contract-v0.1.md
 * Contracts covered: W35-T07, T08, T09, T10, T11, T18, T19, T20
 *
 * Source of truth alignment:
 *   - PRD v0.5 Section 3.1: Play mode - user clicks -> free placement
 *   - PRD v0.5 Section 3.3: Recall - click must NOT modify game tree
 *   - PRD v0.5 Section 3.4: Analysis - free play on scratch; must NOT modify Attempt.userLine
 *   - Arch v0.5 Section 1.2: Command write path UI -> Controller -> Service -> Store
 *   - Arch v0.5 Section 9.3: click -> mode controller -> executor -> documentStore -> attemptService
 *   - Contract Section 5: Mutation Contracts table
 *   - Contract Section 7: boardInteractionController specification
 *
 * Test Legitimacy:
 *   - All tests import real production code: resolveBoardInteraction, createBoardInteractionContext,
 *     intents, executors, boardInteractionController.
 *   - Controlled dependencies: mock executor targets with write tracking.
 *   - Production bug: wrong executor receives call -> test fails because documentStore is not called
 *     or recallService is called when it should not be.
 *   - No conditional skip on core assertions.
 *
 * Matrix Coverage:
 *   | Source Row | Required Behavior | Test ID | Status | Notes |
 *   | --- | --- | --- | --- | --- |
 *   | Contract T07 | play-stone routes to playInteractionExecutor -> documentStore | W35-T07 | covered | RED until controller exists |
 *   | Contract T08 | recall-answer routes to recallInteractionExecutor -> recallService | W35-T08 | covered | RED until controller exists |
 *   | Contract T09 | scratchEdit routes to scratchEditInteractionExecutor | W35-T09 | covered | RED until controller exists |
 *   | Contract T10 | deferred routes to legacy sabaki.clickVertex | W35-T10 | covered | RED until controller exists |
 *   | Contract T11 | rejected/noop performs no write | W35-T11 | covered | RED until controller exists |
 *   | Contract T18 | controller deps injected | W35-T18 | covered | RED until controller exists |
 *   | Contract T19 | play executor writes documentStore only | W35-T19 | covered | RED until controller exists |
 *   | Contract T20 | recall executor does NOT write documentStore | W35-T20 | covered | RED until controller exists |
 */

import assert from 'assert'

// Import real production code
import {resolveBoardInteraction} from '../../../src/modules/workbench/board-interactions/resolveBoardInteraction.ts'
import {BOARD_INTENTS, RESOLVE_STATUSES} from '../../../src/modules/workbench/board-interactions/intents.ts'
import {createBoardInteractionContext} from '../../../src/modules/workbench/board-interactions/createBoardInteractionContext.ts'
import {executePlayInteraction} from '../../../src/modules/workbench/board-interactions/executors/playInteractionExecutor.js'
import {executeRecallInteraction} from '../../../src/modules/workbench/board-interactions/executors/recallInteractionExecutor.js'
import {createBoardInteractionController} from '../../../src/modules/training/workbench/boardInteractionController.ts'

// --- Mock Factories ---

function makeMockBoard(signMapOverrides = {}) {
  const signMap = Array(19).fill(null).map(() => Array(19).fill(0))
  for (const [key, val] of Object.entries(signMapOverrides)) {
    const [x, y] = key.split(',').map(Number)
    signMap[y][x] = val
  }
  return {
    width: 19,
    height: 19,
    get: ([x, y]) => signMap[y]?.[x] ?? 0,
    markers: Array(19).fill(null).map(() => Array(19).fill(null)),
  }
}

function makeTab(overrides = {}) {
  return {
    id: 'tab_1',
    taskId: 'task_1',
    mode: 'play',
    childTabIds: [],
    playerConfig: {black: 'human', white: 'ai'},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Create controller deps with write-tracking spies.
 * Each executor target is a spy that records calls.
 */
function createControllerDeps(options = {}) {
  const {
    playMoveResult = {valid: true, changed: true, treePosition: 'node_2'},
    recallAnswerResult = {handled: true, changed: true, isCorrect: true},
    playServicesPatch = {},
  } = options

  const calls = {
    documentStorePlayMove: [],
    recallSubmitBoardClick: [],
    legacyClickVertex: [],
    editWorkspaceOps: [],
    editAnalysisInvalidate: [],
    editAnalysisSchedule: [],
    scratchCommits: [],
    problemAppendMove: [],
    attemptAppendMove: [],
    monitorUserMove: [],
    aiMoveRequest: [],
  }

  const documentStore = {
    playMove: async (vertex, opts) => {
      calls.documentStorePlayMove.push({vertex, opts})
      return playMoveResult
    },
  }

  const recallAdapter = {
    async submitBoardClick(vertex) {
      calls.recallSubmitBoardClick.push({vertex})
      return recallAnswerResult
    },
  }

  const editWorkspaceContext = {
    activeTab: 'current',
    currentSnapshot: {
      id: 'snap_1',
      signMap: Array(19).fill(null).map(() => Array(19).fill(0)),
      nextPlayer: 1,
      height: 19,
      width: 19,
    },
    referenceSnapshot: null,
    currentMarkerMap: Array(19).fill(null).map(() => Array(19).fill(null)),
    referenceMarkerMap: null,
    currentLines: [],
    referenceLines: [],
    lineFirstVertex: null,
  }

  const editWorkspaceDeps = {
    invalidateEditAnalysis: () => { calls.editAnalysisInvalidate.push({}) },
    scheduleEditWorkspaceAnalysis: () => { calls.editAnalysisSchedule.push({}) },
    commitScratchResult: (result) => { calls.scratchCommits.push(result) },
  }

  const legacySabaki = {
    clickVertex: (vertex, opts) => {
      calls.legacyClickVertex.push({vertex, opts})
    },
  }

  const defaultPlayServices = {
    documentStore,
    problemFlowService: {
      async appendProblemMove(input) {
        calls.problemAppendMove.push(input)
        return {moveIndex: calls.problemAppendMove.length - 1, evalCache: [], badMoves: []}
      },
    },
    ...playServicesPatch,
  }

  return {
    getPlayServices: () => defaultPlayServices,
    getRecallAdapter: () => recallAdapter,
    getEditWorkspaceContext: () => editWorkspaceContext,
    getEditWorkspaceDeps: () => editWorkspaceDeps,
    getLegacySabaki: () => legacySabaki,
    getIsMac: () => false,
    // Expose spies for assertions
    _calls: calls,
    _documentStore: documentStore,
    _recallAdapter: recallAdapter,
    _legacySabaki: legacySabaki,
  }
}

/**
 * Build a ResolverInput directly from mode/vertex/event for executor-level tests.
 * This uses the real createBoardInteractionContext to produce the context,
 * then calls resolveBoardInteraction, to produce a BoardInteractionResult.
 */
function resolveClick({
  workbenchMode = 'play',
  vertex = [3, 3],
  event = {button: 0, ctrlKey: false, metaKey: false},
  selectedTool = 'stone_1',
  editWorkspacePresent = false,
  playerConfig = null,
  problemArea = null,
  board = makeMockBoard(),
}) {
  // state.mode must match the workspace kind derivation in workspaceDefaults.ts:
  //   'play' -> PLAY -> playMove
  //   'recall' -> RECALL -> recallAnswer
  //   'analysis' + editWorkspace -> SCRATCH_ANALYSIS -> scratchEdit
  const state = {
    mode: workbenchMode,
    selectedTool,
    treePosition: 'node_root',
    editWorkspace: editWorkspacePresent ? {activeTab: 'current'} : null,
  }

  const context = createBoardInteractionContext({
    state,
    board,
    vertex,
    event,
    isMac: false,
    workbenchMode,
    tabId: 'tab_1',
    taskId: 'task_1',
    playerConfig,
    problemArea,
  })

  return resolveBoardInteraction(context)
}

// --- Tests ---

describe('W3.5 boardInteractionController', function () {

  function createController(deps) {
    return createBoardInteractionController(deps)
  }

  // --- W35-T18: controller receives deps via injection, not direct imports ---

  describe('W35-T18: controller receives deps via injection', function () {
    it('createBoardInteractionController accepts deps object without importing stores directly', function () {
      const deps = createControllerDeps()

      let controller
      assert.doesNotThrow(() => {
        controller = createBoardInteractionController(deps)
      }, 'createBoardInteractionController must accept deps without importing sabaki.js or stores')

      assert.ok(controller, 'must return a controller object')
      assert.strictEqual(typeof controller.handleBoardClick, 'function',
        'controller must have handleBoardClick method')
    })
  })

  // --- W35-T07: handleBoardClick routes play-stone to playInteractionExecutor ---

  describe('W35-T07: play-stone routes to playInteractionExecutor -> documentStore', function () {
    it('click in play mode on empty point calls documentStore.playMove with correct vertex', async function () {
      const deps = createControllerDeps()
      const controller = createController(deps)

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

      // Main assertion: documentStore.playMove was called with the clicked vertex
      assert.strictEqual(deps._calls.documentStorePlayMove.length, 1,
        'documentStore.playMove must be called exactly once for play-stone')
      assert.deepStrictEqual(
        deps._calls.documentStorePlayMove[0].vertex,
        [3, 3],
        'documentStore.playMove must receive the clicked vertex [3,3]',
      )
    })

    it('click in problem mode on valid point calls problemFlowService, not documentStore.playMove', async function () {
      const deps = createControllerDeps()
      const controller = createController(deps)

      await controller.handleBoardClick({
        vertex: [3, 3],
        event: {button: 0, ctrlKey: false, metaKey: false},
        activeTab: makeTab({mode: 'problem'}),
        settings: {selectedTool: 'stone_1'},
        board: makeMockBoard(),
        editWorkspacePresent: false,
        task: {problemArea: {vertices: [[3, 3], [3, 15], [15, 15], [15, 3]]}},
        runtimeState: {},
      })

      assert.strictEqual(deps._calls.problemAppendMove.length, 1,
        'problemFlowService.appendProblemMove must be called for problem mode play-stone')
      assert.strictEqual(deps._calls.documentStorePlayMove.length, 0,
        'problem mode attempt moves must not write directly to documentStore.playMove')
      assert.deepStrictEqual(
        deps._calls.problemAppendMove[0].vertex,
        [3, 3],
        'vertex must be [3,3]',
      )
      assert.strictEqual(
        deps._calls.problemAppendMove[0].move,
        'dd',
        'move must be converted to SGF vertex string',
      )
    })

    it('click in play mode appends human move to active attempt and notifies monitor', async function () {
      const attempt = {rootPositionSgf: '(;SZ[19])', userLine: []}
      const deps = createControllerDeps({
        playServicesPatch: {
          attemptService: {
            appendMove: async (attemptId, move, actor) => {
              deps._calls.attemptAppendMove.push({attemptId, move, actor})
              attempt.userLine.push(move)
            },
          },
          monitor: {
            onUserMove: async (input) => {
              deps._calls.monitorUserMove.push(input)
            },
          },
          repository: {
            loadAttempt: async () => ({...attempt, userLine: [...attempt.userLine]}),
          },
        },
      })
      const controller = createController(deps)

      await controller.handleBoardClick({
        vertex: [3, 3],
        event: {button: 0, ctrlKey: false, metaKey: false},
        activeTab: makeTab({mode: 'play', activeAttemptId: 'attempt_1'}),
        settings: {selectedTool: 'stone_1'},
        board: makeMockBoard(),
        editWorkspacePresent: false,
        task: null,
        runtimeState: {},
      })

      assert.deepStrictEqual(deps._calls.attemptAppendMove, [
        {attemptId: 'attempt_1', move: 'dd', actor: 'human'},
      ])
      assert.strictEqual(deps._calls.monitorUserMove.length, 1)
      assert.strictEqual(deps._calls.monitorUserMove[0].moveIndex, 0)
      assert.strictEqual(deps._calls.monitorUserMove[0].move, 'dd')
    })

    it('click in play mode applies AI reply through documentStore and appends it to attempt', async function () {
      const attempt = {rootPositionSgf: '(;SZ[19])', userLine: []}
      const deps = createControllerDeps({
        playServicesPatch: {
          attemptService: {
            appendMove: async (attemptId, move, actor) => {
              deps._calls.attemptAppendMove.push({attemptId, move, actor})
              attempt.userLine.push(move)
            },
          },
          monitor: {
            onUserMove: async (input) => {
              deps._calls.monitorUserMove.push(input)
            },
          },
          repository: {
            loadAttempt: async () => ({...attempt, userLine: [...attempt.userLine]}),
            loadTask: async () => ({
              rootPositionSgf: '(;SZ[19])',
              sideToMove: 'black',
            }),
          },
          aiMoveService: {
            maybePlayAiMove: async (input) => {
              deps._calls.aiMoveRequest.push(input)
              return 'qq'
            },
          },
        },
      })
      const controller = createController(deps)

      await controller.handleBoardClick({
        vertex: [3, 3],
        event: {button: 0, ctrlKey: false, metaKey: false},
        activeTab: makeTab({
          mode: 'play',
          activeAttemptId: 'attempt_1',
          playerConfig: {black: 'human', white: 'ai', ai: {autoPlay: true}},
        }),
        settings: {selectedTool: 'stone_1'},
        board: makeMockBoard(),
        editWorkspacePresent: false,
        task: null,
        runtimeState: {},
      })

      assert.deepStrictEqual(
        deps._calls.documentStorePlayMove.map(call => call.vertex),
        [[3, 3], [16, 16]],
      )
      assert.deepStrictEqual(
        deps._calls.attemptAppendMove.map(call => ({move: call.move, actor: call.actor})),
        [{move: 'dd', actor: 'human'}, {move: 'qq', actor: 'ai'}],
      )
      assert.deepStrictEqual(
        deps._calls.monitorUserMove.map(call => call.move),
        ['dd', 'qq'],
        'monitor must evaluate every changed Play commit, including AI replies',
      )
      assert.strictEqual(deps._calls.aiMoveRequest.length, 2)
      assert.deepStrictEqual(deps._calls.aiMoveRequest[0].attempt.userLine, ['dd'])
      assert.strictEqual(
        deps._calls.aiMoveRequest[0].treePosition,
        'node_2',
        'AI request must use the post-human-move treePosition',
      )
      assert.deepStrictEqual(deps._calls.aiMoveRequest[1].attempt.userLine, ['dd', 'qq'])
    })
  })

  // --- W35-T08: handleBoardClick routes recall-answer to recallInteractionExecutor ---

  describe('W35-T08: recall-answer routes to recallInteractionExecutor -> recallService', function () {
    it('click in recall mode on empty point calls adapter.submitBoardClick with vertex', async function () {
      const deps = createControllerDeps()
      const controller = createController(deps)

      await controller.handleBoardClick({
        vertex: [5, 5],
        event: {button: 0, ctrlKey: false, metaKey: false},
        activeTab: makeTab({mode: 'recall'}),
        settings: {selectedTool: 'stone_1'},
        board: makeMockBoard(),
        editWorkspacePresent: false,
        task: null,
        runtimeState: {},
      })

      // Main assertion: recall service received the answer
      assert.strictEqual(deps._calls.recallSubmitBoardClick.length, 1,
        'adapter.submitBoardClick must be called for recall-answer')
      assert.deepStrictEqual(
        deps._calls.recallSubmitBoardClick[0].vertex,
        [5, 5],
        'recallService must receive the clicked vertex [5,5]',
      )
    })
  })

  // --- W35-T09: handleBoardClick routes scratchEdit to scratchEditInteractionExecutor ---

  describe('W35-T09: scratchEdit routes to scratchEditInteractionExecutor', function () {
    it('click in analysis mode with editWorkspace calls scratchEdit operations', async function () {
      const deps = createControllerDeps()
      const controller = createController(deps)

      const result = await controller.handleBoardClick({
        vertex: [10, 10],
        event: {button: 0, ctrlKey: false, metaKey: false},
        activeTab: makeTab({mode: 'analysis'}),
        settings: {selectedTool: 'stone_1'},
        board: makeMockBoard(),
        editWorkspacePresent: true,
        task: null,
        runtimeState: {},
      })

      // For a stone_1 tool on an empty point, the scratch edit executor
      // should place a stone. The editWorkspaceDeps methods should be called
      // (invalidateEditAnalysis, scheduleEditWorkspaceAnalysis).
      assert.ok(
        deps._calls.editAnalysisInvalidate.length > 0 || deps._calls.editAnalysisSchedule.length > 0,
        'scratch edit must trigger edit analysis invalidation or scheduling',
      )
      assert.strictEqual(
        deps._calls.scratchCommits.length,
        1,
        'scratch edit result must be committed back to editWorkspace',
      )
      assert.strictEqual(
        deps._calls.scratchCommits[0],
        result,
        'controller must commit the exact scratch executor result returned to the caller',
      )
    })
  })

  // --- W35-T10: Workbench analysis without editWorkspace is read-only ---

  describe('W35-T10: analysis without editWorkspace is read-only', function () {
    it('click in analysis mode without editWorkspace does not call legacy sabaki.clickVertex', async function () {
      const deps = createControllerDeps()
      const controller = createController(deps)

      await controller.handleBoardClick({
        vertex: [7, 7],
        event: {button: 0, ctrlKey: false, metaKey: false},
        activeTab: makeTab({mode: 'analysis'}),
        settings: {selectedTool: 'stone_1'},
        board: makeMockBoard(),
        editWorkspacePresent: false,
        task: null,
        runtimeState: {},
      })

      assert.strictEqual(deps._calls.legacyClickVertex.length, 0,
        'Workbench analysis without editWorkspace must not fall back to legacy SGF edit')
    })
  })

  // --- W35-T11: handleBoardClick with rejected/noop performs no write ---

  describe('W35-T11: rejected/noop performs no write', function () {
    it('click on occupied point in play mode performs no write', async function () {
      const board = makeMockBoard({'3,3': 1}) // Black stone at [3,3]
      const deps = createControllerDeps()
      const controller = createController(deps)

      await controller.handleBoardClick({
        vertex: [3, 3],
        event: {button: 0, ctrlKey: false, metaKey: false},
        activeTab: makeTab({mode: 'play'}),
        settings: {selectedTool: 'stone_1'},
        board,
        editWorkspacePresent: false,
        task: null,
        runtimeState: {},
      })

      assert.strictEqual(deps._calls.documentStorePlayMove.length, 0,
        'No write to documentStore for occupied point')
      assert.strictEqual(deps._calls.recallSubmitBoardClick.length, 0,
        'No write to recallService for occupied point')
      assert.strictEqual(deps._calls.legacyClickVertex.length, 0,
        'No legacy click for occupied point in play mode')
    })

    it('click in play mode on AI turn performs no write', async function () {
      const deps = createControllerDeps()
      const controller = createController(deps)

      await controller.handleBoardClick({
        vertex: [3, 3],
        event: {button: 0, ctrlKey: false, metaKey: false},
        activeTab: makeTab({
          mode: 'play',
          playerConfig: {black: 'human', white: 'ai', currentSide: 'ai'},
        }),
        settings: {selectedTool: 'stone_1'},
        board: makeMockBoard(),
        editWorkspacePresent: false,
        task: null,
        runtimeState: {},
      })

      assert.strictEqual(deps._calls.documentStorePlayMove.length, 0,
        'No write to documentStore during AI turn')
    })

    it('click in problem mode outside problemArea performs no write', async function () {
      const deps = createControllerDeps()
      const controller = createController(deps)

      await controller.handleBoardClick({
        vertex: [0, 0], // Outside the problemArea
        event: {button: 0, ctrlKey: false, metaKey: false},
        activeTab: makeTab({mode: 'problem'}),
        settings: {selectedTool: 'stone_1'},
        board: makeMockBoard(),
        editWorkspacePresent: false,
        task: {problemArea: {vertices: [[3, 3], [3, 15], [15, 15], [15, 3]]}},
        runtimeState: {},
      })

      assert.strictEqual(deps._calls.documentStorePlayMove.length, 0,
        'No write to documentStore for vertex outside problemArea')
      assert.strictEqual(deps._calls.problemAppendMove.length, 0,
        'No write to problemFlowService for vertex outside problemArea')
    })

    it('right-click in play mode on empty point is deferred to legacy, not play move', async function () {
      // Right-click in play mode returns DEFERRED (legacy-play-right-click)
      const deps = createControllerDeps()
      const controller = createController(deps)

      await controller.handleBoardClick({
        vertex: [3, 3],
        event: {button: 2, ctrlKey: false, metaKey: false},
        activeTab: makeTab({mode: 'play'}),
        settings: {selectedTool: 'stone_1'},
        board: makeMockBoard(),
        editWorkspacePresent: false,
        task: null,
        runtimeState: {},
      })

      // Right-click is deferred to legacy, not playMove
      assert.strictEqual(deps._calls.documentStorePlayMove.length, 0,
        'Right-click in play mode must not call documentStore.playMove')
      assert.strictEqual(deps._calls.legacyClickVertex.length, 1,
        'Right-click in play mode must call legacy sabaki.clickVertex')
    })
  })

  // --- W35-T19: playInteractionExecutor writes to documentStore but NOT editWorkspace or recallService ---

  describe('W35-T19: play executor writes documentStore only', function () {
    it('play-stone execution writes to documentStore but not recallService or editWorkspace', async function () {
      const deps = createControllerDeps()
      const controller = createController(deps)

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

      // Positive: documentStore was written
      assert.ok(deps._calls.documentStorePlayMove.length >= 1,
        'play executor must write to documentStore')

      // Negative: recallService was NOT written
      assert.strictEqual(deps._calls.recallSubmitBoardClick.length, 0,
        'play executor must NOT write to recallAdapter')

      // Negative: editWorkspace was NOT modified
      assert.strictEqual(deps._calls.editAnalysisInvalidate.length, 0,
        'play executor must NOT invalidate edit analysis')
    })
  })

  // --- W35-T20: recallInteractionExecutor does NOT write to documentStore or game tree ---

  describe('W35-T20: recall executor does NOT write to documentStore', function () {
    it('recall-answer execution does not call documentStore.playMove', async function () {
      const deps = createControllerDeps()
      const controller = createController(deps)

      await controller.handleBoardClick({
        vertex: [5, 5],
        event: {button: 0, ctrlKey: false, metaKey: false},
        activeTab: makeTab({mode: 'recall'}),
        settings: {selectedTool: 'stone_1'},
        board: makeMockBoard(),
        editWorkspacePresent: false,
        task: null,
        runtimeState: {},
      })

      // Positive: recallService was called
      assert.ok(deps._calls.recallSubmitBoardClick.length >= 1,
        'recall executor must call recallAdapter')

      // Negative: documentStore was NOT written
      assert.strictEqual(deps._calls.documentStorePlayMove.length, 0,
        'recall executor must NOT write to documentStore -- PRD v0.5 3.3: click must NOT modify game tree')
    })

    it('recall executor does not call legacy sabaki.clickVertex', async function () {
      const deps = createControllerDeps()
      const controller = createController(deps)

      await controller.handleBoardClick({
        vertex: [5, 5],
        event: {button: 0, ctrlKey: false, metaKey: false},
        activeTab: makeTab({mode: 'recall'}),
        settings: {selectedTool: 'stone_1'},
        board: makeMockBoard(),
        editWorkspacePresent: false,
        task: null,
        runtimeState: {},
      })

      assert.strictEqual(deps._calls.legacyClickVertex.length, 0,
        'recall executor must NOT call legacy sabaki.clickVertex')
    })
  })
})

// --- Executor-level unit tests (using real executors + real resolver) ---

describe('W3.5 executor side-effect verification (real executor + resolver)', function () {
  // These tests verify executor behavior directly with the real resolver,
  // independent of the controller wrapper. They prove the executor contracts
  // at the production code level.

  // W35-T19 verified via real executor: play writes to documentStore only
  describe('real playInteractionExecutor side effects', function () {
    it('executePlayInteraction calls documentStore.playMove with correct vertex', async function () {
      const playMoveCalls = []
      const mockDocumentStore = {
        playMove: async (vertex) => {
          playMoveCalls.push({vertex})
          return {valid: true, changed: true, treePosition: 'node_2'}
        },
      }

      const result = resolveClick({
        workbenchMode: 'play',
        vertex: [3, 3],
      })

      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.strictEqual(result.intent, BOARD_INTENTS.PLAY_STONE)

      const execResult = await executePlayInteraction(
        result,
        {player: 1},
        {documentStore: mockDocumentStore},
      )

      assert.strictEqual(execResult.handled, true, 'executor must handle play-stone')
      assert.strictEqual(execResult.changed, true, 'executor must report change')
      assert.strictEqual(playMoveCalls.length, 1,
        'documentStore.playMove must be called once')
      assert.deepStrictEqual(playMoveCalls[0].vertex, [3, 3],
        'documentStore.playMove must receive vertex [3,3]')
    })
  })

  // W35-T20 verified via real executor: recall does NOT write documentStore
  describe('real recallInteractionExecutor side effects', function () {
    it('executeRecallInteraction calls adapter.submitBoardClick, not documentStore', async function () {
      const recallCalls = []
      const mockAdapter = {
        async submitBoardClick(vertex) {
          recallCalls.push({vertex})
          return {handled: true, changed: true, isCorrect: true}
        },
      }

      const result = resolveClick({
        workbenchMode: 'recall',
        vertex: [5, 5],
      })

      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.strictEqual(result.intent, BOARD_INTENTS.SUBMIT_RECALL_ANSWER)

      const execResult = await executeRecallInteraction(
        result,
        {},
        {adapter: mockAdapter},
      )

      assert.strictEqual(execResult.handled, true, 'executor must handle recall-answer')
      assert.strictEqual(recallCalls.length, 1,
        'adapter.submitBoardClick must be called once')
      assert.deepStrictEqual(recallCalls[0].vertex, [5, 5],
        'recall service must receive vertex [5,5]')

      // The executor function signature does not even accept documentStore,
      // proving structurally that recall cannot write to the game tree.
      // The executor imports only RESOLVE_STATUSES from intents.ts.
    })
  })

  // W35-T07: resolver produces correct intent for play mode
  describe('real resolver produces correct intent for each mode', function () {
    it('play mode empty-point left-click produces PLAY_STONE with playMove mutationContract', function () {
      const result = resolveClick({
        workbenchMode: 'play',
        vertex: [3, 3],
      })

      assert.strictEqual(result.intent, BOARD_INTENTS.PLAY_STONE)
      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.strictEqual(result.mutationContract, 'playMove',
        'Play mode click must have mutationContract=playMove per Contract Section 5')
    })

    it('recall mode empty-point left-click produces SUBMIT_RECALL_ANSWER with recallAnswer contract', function () {
      const result = resolveClick({
        workbenchMode: 'recall',
        vertex: [5, 5],
      })

      assert.strictEqual(result.intent, BOARD_INTENTS.SUBMIT_RECALL_ANSWER)
      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.strictEqual(result.mutationContract, 'recallAnswer',
        'Recall mode click must have mutationContract=recallAnswer per Contract Section 5')
    })

    it('analysis mode with editWorkspace and stone_1 tool produces PLACE_BLACK_STONE with scratchEdit contract', function () {
      const result = resolveClick({
        workbenchMode: 'analysis',
        vertex: [10, 10],
        selectedTool: 'stone_1',
        editWorkspacePresent: true,
      })

      assert.strictEqual(result.intent, BOARD_INTENTS.PLACE_BLACK_STONE)
      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.strictEqual(result.mutationContract, 'scratchEdit',
        'Analysis with editWorkspace must have mutationContract=scratchEdit per Contract Section 5')
    })

    it('analysis mode without editWorkspace produces DEFERRED status', function () {
      const result = resolveClick({
        workbenchMode: 'analysis',
        vertex: [7, 7],
        selectedTool: 'stone_1',
        editWorkspacePresent: false,
      })

      assert.strictEqual(result.status, RESOLVE_STATUSES.DEFERRED,
        'Analysis without editWorkspace must produce DEFERRED status per Contract Section 5')
    })

    it('play mode AI turn produces REJECTED status (noop)', function () {
      const result = resolveClick({
        workbenchMode: 'play',
        vertex: [3, 3],
        playerConfig: {currentSide: 'ai'},
      })

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED,
        'Play mode AI turn must produce REJECTED status')
      assert.strictEqual(result.intent, BOARD_INTENTS.NOOP)
    })
  })
})
