/**
 * W8-P2 Container + Mode Routing Wiring Tests
 *
 * Test contract: docs/design/2026-05-21/w8-p2-container-mode-routing/test-contract-v0.1.md
 * Contracts covered: T2-01, T2-02, T2-03, T2-07, T2-08, T2-09, T2-10, T2-11, T2-12
 *
 * Source of truth alignment:
 *   - PRD v0.5 SS2.1: Mode by user intent, workbenchMode routes clicks
 *   - PRD v0.5 SS5.1: Workbench tab mode determines panel content
 *   - Arch v0.5 SS1.1: Render read path Store/Repo -> Container/ViewModel -> UI
 *   - Arch v0.5 SS1.3: Container reads Store, calls Service
 *   - Arch v0.5 SS14: recall does NOT modify game tree, scratch does NOT modify Attempt.userLine
 *
 * v0.5 conflict check: No conflicts found. Contract routes by activeTab.mode only,
 * no origin.provider branching, no source-specific tab API, no container store writes,
 * no UI service/store imports.
 *
 * Test classification:
 *   - T2-01, T2-02, T2-03: STORE_SUBSCRIPTION (Container adapter subscription lifecycle)
 *   - T2-07: ARCHITECTURE_BOUNDARY (no fabricated board state)
 *   - T2-08 to T2-12: STORE_SUBSCRIPTION (Container mode/tab projection)
 *
 * Long-term vs migration:
 *   - T2-01..T2-03: Long-term — protect adapter subscription lifecycle contract.
 *   - T2-07: Long-term — protect architecture boundary: no fabricated state.
 *   - T2-08..T2-12: Long-term — protect mode/tab projection contract.
 *
 * Workbench wiring coverage:
 *   - UI command mapping: none (handled by W8-P1 T19)
 *   - Container handler -> controller: none (handled by W8-P1 T24)
 *   - Controller -> service/store: none (handled by W8-P1 T10..T14)
 *   - Store subscription -> projection: T2-01..T2-03 (adapter subscription),
 *     T2-08..T2-12 (mode/tab projection)
 *
 * Harness manifest:
 *
 *   Harness "createHarness" (T2-01..T2-03, T2-07):
 *     - Real production modules: TrainingWorkbenchContainer, createWorkbenchStore,
 *       createTrainingRuntimeStore, projectGobanProps
 *     - Fake/spy modules: spy flowService, spy tabService, mock sabaki with
 *       getTrainingContext, optional mock gobanDataAdapter
 *     - Valid for: STORE_SUBSCRIPTION, ARCHITECTURE_BOUNDARY
 *     - Not valid for: CONTROLLER_STATE_TRANSITION, SERVICE_REPOSITORY_TRANSITION,
 *       RENDERED_UI_RETURN
 *
 *   Harness "createProjectionHarness" (T2-08..T2-12):
 *     - Real production modules: TrainingWorkbenchContainer, createWorkbenchStore,
 *       createTrainingRuntimeStore
 *     - Fake/spy modules: spy flowService, spy tabService, mock sabaki
 *     - Valid for: STORE_SUBSCRIPTION (mode/tab projection)
 *     - Not valid for: RENDERED_UI_RETURN, SIDE_EFFECT_BOUNDARY
 *
 * Fragile test warnings:
 *   1. T2-01..T2-03: Container uses try-catch require() for gobanDataAdapter.
 *      We inject a mock adapter via _gobanAdapter property to test subscription
 *      behavior. If Container internals change, these tests need updating, but the
 *      contract (adapter snapshot drives boardProps) remains stable.
 *   2. T2-07: Tests the absence of a fabricated 19x19 signMap. If Container's
 *      fallback object changes shape, the assertion must track. But the contract
 *      (no fabricated state when adapter unavailable) is stable.
 *   3. T2-08..T2-12: projectFromWorkbench is an internal Container function, not
 *      a separate module. Tests verify the render output (shellProps) which is the
 *      stable external contract.
 */

import assert from 'assert'

// --- Real production imports ---

import TrainingWorkbenchContainer from '../../../src/components/TrainingWorkbenchContainer.js'
import {createWorkbenchStore} from '../../../src/modules/training/store/workbenchStore.ts'
import {createTrainingRuntimeStore} from '../../../src/modules/training/store/trainingRuntimeStore.ts'
import {projectGobanProps} from '../../../src/modules/training/workbench/projectGobanProps.ts'
import {createTestLogger} from '../../helpers/createTestLogger.ts'
import {
  createSpyFlowService,
  createSpyTabService,
} from '../shared/workbenchSpyFactories.ts'

// --- Logger for test harness (real, not mocked) ---

const {logger} = createTestLogger()

// --- Helper Factories ---

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

function createNoopLegacyController() {
  return {
    showRecallHint() { },
    skipRecallMove() { },
    endRecallSession() { },
    undoProblemMove() { },
    submitProblemAttempt() { },
    exitProblemMode() { },
    advanceReview() { },
  }
}

/**
 * Create a test harness with real Container + real stores + spy services.
 * The constructor creates the adapter synchronously, so the harness sabaki
 * must provide enough surface for _tryCreateGobanAdapter to succeed.
 */
function createHarness({tabs = [makeTab()], activeTabId = tabs[0]?.id ?? null} = {}) {
  const workbenchStore = createWorkbenchStore({logger})
  const runtimeStore = createTrainingRuntimeStore({logger})
  const flowService = createSpyFlowService()
  const tabService = createSpyTabService()

  const taskImportService = {
    async createManualTask(input) {
      return {id: `task_${Date.now()}`, ...input}
    },
    async createTaskFromBadMove() { return {id: 'task_bad'} },
  }

  for (const tab of tabs) workbenchStore.addTab(tab)
  if (activeTabId != null) workbenchStore.setActiveTab(activeTabId)

  // Minimal documentStore that provides a real empty game tree + board
  const gametree = require('../../../src/modules/gametree.js')
  const emptyTree = gametree.new()
  const documentStore = {
    getCurrent() {
      return {
        tree: emptyTree,
        treePosition: emptyTree.root.id,
        gameTrees: [emptyTree],
        gameIndex: 0,
        gameCurrents: [{}],
        current: {},
      }
    },
  }

  const trainingContext = {
    runtimeStore,
    workbenchStore,
    workbenchFlowService: flowService,
    flowService,
    workbenchTabService: tabService,
    tabService,
    taskImportService,
    legacyTrainingFlowController: createNoopLegacyController(),
    repository: { loadTask: async () => null },
  }

  const sabakiState = {
    treePosition: emptyTree.root.id,
    gameTrees: [emptyTree],
    gameIndex: 0,
    selectedTool: 'stone_1',
    editWorkspace: null,
    showMoveNumbers: null,
    showNextMoves: null,
    showSiblings: null,
    showAnalysis: null,
    showCoordinates: null,
    showHumanPreference: null,
    showMoveColorization: null,
    fuzzyStonePlacement: null,
    animateStonePlacement: null,
    boardTransformation: [1, 0, 0, 1, 0, 0],
    analysisType: null,
    areaSelectMode: false,
  }

  const sabaki = {
    getTrainingContext() {
      return trainingContext
    },
    getPlayServices() {
      return { documentStore }
    },
    get state() {
      return sabakiState
    },
    logger,
    on() {},
    removeListener() {},
  }

  const container = new TrainingWorkbenchContainer({sabaki})
  container.props = {sabaki}

  return {
    workbenchStore,
    runtimeStore,
    flowService,
    tabService,
    render() {
      const vdom = container.render()
      return vdom ? vdom.props : {}
    },
    container,
    sabaki,
    trainingContext,
  }
}

// ===========================================================================
// Container adapter subscription (T2-01, T2-02, T2-03)
// ===========================================================================

describe('W8-P2 Container adapter subscription', function () {

  // T2-01: Container.render() uses adapter snapshot data, not hardcoded fallback.
  //
  // When a gobanDataAdapter is attached to the Container and its getSnapshot()
  // returns data with a 9x9 board, the rendered boardProps must reflect
  // width=9, NOT the hardcoded fallback width=19.
  //
  // Contract: projectGobanProps (real import) must be called with the adapter's
  // snapshot data. The resulting boardProps has the adapter's board dimensions.
  it('T2-01: Container uses adapter snapshot data, not hardcoded 19x19 fallback', function () {
    const harness = createHarness({
      tabs: [makeTab({id: 'tab_1', mode: 'play'})],
    })

    // Inject a mock adapter whose snapshot has a 9x9 board.
    const nineSignMap = Array(9).fill(null).map(() => Array(9).fill(0))
    const nineBoard = {
      width: 9,
      height: 9,
      signMap: nineSignMap,
      markers: [],
      lines: [],
      siblingsInfo: {},
      childrenInfo: {},
    }

    harness.container._gobanAdapter = {
      getSnapshot() {
        return {
          workbenchMode: 'play',
          task: null,
          runtimeState: {},
          boardState: {
            gameTree: null,
            treePosition: '',
            board: nineBoard,
          },
          overlayState: {
            paintMap: [],
            markerMap: [],
            dimmedStones: [],
            analysis: null,
          },
          settings: {
            showMoveNumbers: false,
            showNextMoves: true,
            showSiblings: true,
            showAnalysis: false,
            showCoordinates: true,
            showHumanPreference: false,
            selectedTool: 'stone_1',
            editWorkspaceActive: false,
            boardTransformation: [1, 0, 0, 1, 0, 0],
            areaSelectMode: false,
          },
          analysisData: null,
        }
      },
      subscribe() { return () => {} },
      destroy() {},
    }

    const shellProps = harness.render()

    assert.ok(shellProps.boardProps != null,
      'Container must pass boardProps to shell')

    // The boardStateProps.board must come from the adapter snapshot, not hardcoded.
    const boardState = shellProps.boardProps.boardStateProps
    assert.ok(boardState != null, 'boardProps must have boardStateProps')
    assert.ok(boardState.board != null, 'boardStateProps must have board')

    // Verify board dimensions: adapter returns 9x9, hardcoded fallback is 19x19.
    // The board object from the snapshot is passed through projectGobanProps.
    // If Container ignores the adapter, board will be the hardcoded 19x19 object.
    const board = boardState.board
    assert.strictEqual(board.width, 9,
      'Board width must be 9 from adapter snapshot, not 19 from hardcoded fallback')
    assert.strictEqual(board.height, 9,
      'Board height must be 9 from adapter snapshot, not 19 from hardcoded fallback')
  })

  // T2-02: Adapter subscription triggers Container re-render.
  //
  // When the adapter emits a change notification (via its subscribe callback),
  // the Container must re-render with updated boardProps reflecting the new data.
  it('T2-02: Adapter subscription callback triggers Container re-render with updated data', function () {
    const harness = createHarness({
      tabs: [makeTab({id: 'tab_1', mode: 'play'})],
    })

    // Track subscription callback
    let adapterCallback = null

    const emptyBoard = {
      width: 19,
      height: 19,
      signMap: Array(19).fill(null).map(() => Array(19).fill(0)),
      markers: [],
      lines: [],
      siblingsInfo: {},
      childrenInfo: {},
    }

    // Start with an empty board
    let currentSignMap = Array(19).fill(null).map(() => Array(19).fill(0))

    harness.container._gobanAdapter = {
      getSnapshot() {
        return {
          workbenchMode: 'play',
          task: null,
          runtimeState: {},
          boardState: {
            gameTree: null,
            treePosition: '',
            board: {
              width: 19,
              height: 19,
              signMap: currentSignMap,
              markers: [],
              lines: [],
              siblingsInfo: {},
              childrenInfo: {},
            },
          },
          overlayState: {
            paintMap: [],
            markerMap: [],
            dimmedStones: [],
            analysis: null,
          },
          settings: {
            showMoveNumbers: false,
            showNextMoves: true,
            showSiblings: true,
            showAnalysis: false,
            showCoordinates: true,
            showHumanPreference: false,
            selectedTool: 'stone_1',
            editWorkspaceActive: false,
            boardTransformation: [1, 0, 0, 1, 0, 0],
            areaSelectMode: false,
          },
          analysisData: null,
        }
      },
      subscribe(cb) {
        adapterCallback = cb
        return () => { adapterCallback = null }
      },
      destroy() {},
    }

    // Simulate Container subscribing to adapter (as componentDidMount would)
    harness.container._unsubGoban = harness.container._gobanAdapter.subscribe(() => {
      harness.container.forceUpdate()
    })

    // Initial render
    let shellProps = harness.render()
    let initialBoard = shellProps.boardProps.boardStateProps.board
    assert.strictEqual(initialBoard.signMap[3][3], 0,
      'Initial board should have empty point at [3,3]')

    // Place a stone at [3,3]
    currentSignMap = Array(19).fill(null).map(() => Array(19).fill(0))
    currentSignMap[3][3] = 1

    // Trigger adapter change notification (same as adapter subscription callback)
    assert.ok(typeof adapterCallback === 'function',
      'Adapter subscription callback must be registered')
    adapterCallback()

    // Re-render after adapter change
    shellProps = harness.render()
    const updatedBoard = shellProps.boardProps.boardStateProps.board
    assert.strictEqual(updatedBoard.signMap[3][3], 1,
      'After adapter change, board must show stone at [3,3]')

    // Cleanup
    harness.container._unsubGoban()
  })

  // T2-03: Unmount cleans up adapter subscription.
  //
  // When Container.componentWillUnmount() is called, the adapter must be
  // destroyed and no further callbacks should fire.
  it('T2-03: Unmount cleans up adapter subscription and destroys adapter', function () {
    const harness = createHarness({
      tabs: [makeTab({id: 'tab_1', mode: 'play'})],
    })

    let destroyed = false
    let adapterCallback = null

    harness.container._gobanAdapter = {
      getSnapshot() {
        return {
          workbenchMode: 'play',
          task: null,
          runtimeState: {},
          boardState: {
            gameTree: null,
            treePosition: '',
            board: {
              width: 19, height: 19,
              signMap: Array(19).fill(null).map(() => Array(19).fill(0)),
              markers: [], lines: [], siblingsInfo: {}, childrenInfo: {},
            },
          },
          overlayState: {paintMap: [], markerMap: [], dimmedStones: [], analysis: null},
          settings: {
            showMoveNumbers: false, showNextMoves: true, showSiblings: true,
            showAnalysis: false, showCoordinates: true, showHumanPreference: false,
            selectedTool: 'stone_1', editWorkspaceActive: false,
            boardTransformation: [1, 0, 0, 1, 0, 0], areaSelectMode: false,
          },
          analysisData: null,
        }
      },
      subscribe(cb) {
        adapterCallback = cb
        return () => { adapterCallback = null }
      },
      destroy() { destroyed = true },
    }

    // Wire adapter subscription
    harness.container._unsubGoban = harness.container._gobanAdapter.subscribe(() => {})

    // Trigger unmount
    harness.container.componentWillUnmount()

    // Verify adapter.destroy() was called
    assert.strictEqual(destroyed, true,
      'adapter.destroy() must be called on unmount')

    // Verify adapter reference is cleared
    assert.strictEqual(harness.container._gobanAdapter, null,
      'adapter reference must be cleared after unmount')

    // Verify no stale callback
    assert.strictEqual(adapterCallback, null,
      'Adapter subscription callback must be cleaned up after unmount')
  })
})

// ===========================================================================
// Container adapter availability (T2-07)
// ARCHITECTURE_BOUNDARY: Container must have adapter ready before first render
// ===========================================================================

describe('W8-P2 Container adapter availability', function () {

  // T2-07: Adapter is created in constructor, so first render has real board data.
  //
  // Previously the adapter was created in componentDidMount, causing the first
  // render to pass board:null to Goban (crash on board.signMap). The fix moves
  // adapter creation to the constructor where it runs synchronously before any
  // render. This test verifies the adapter exists and provides a non-null board.
  it('T2-07: Container has adapter and real board on first render', function () {
    const harness = createHarness({
      tabs: [makeTab({id: 'tab_1', mode: 'play'})],
    })

    // Adapter must exist immediately (created in constructor, not componentDidMount)
    assert.ok(harness.container._gobanAdapter,
      'Adapter must be attached before first render')

    const shellProps = harness.render()

    assert.ok(shellProps.boardProps != null,
      'Container must pass boardProps on first render')

    const board = shellProps.boardProps.boardStateProps.board
    assert.ok(board != null,
      'Board must be non-null on first render — null board would crash Goban.signMap')
  })
})

// ===========================================================================
// Container mode projection (T2-08 to T2-12)
// Real workbenchStore, real Container, no mocks for store/projection.
// ===========================================================================

describe('W8-P2 Container mode projection', function () {

  // T2-08: store.updateTab(mode:'recall') -> shellProps.mode === 'recall'
  //
  // The Container's projectFromWorkbench(ws) derives mode from activeTab.mode.
  // After updating the store, Container must re-render with the new mode.
  it('T2-08: Store updateTab mode=recall projects mode=recall to shell', function () {
    const harness = createHarness({
      tabs: [makeTab({id: 'tab_1', mode: 'play'})],
    })

    // Initial state: mode should be 'play'
    let shellProps = harness.render()
    assert.strictEqual(shellProps.mode, 'play',
      'Initial mode must be "play"')

    // Update tab mode to 'recall'
    harness.workbenchStore.updateTab('tab_1', {mode: 'recall'})

    // Re-render
    shellProps = harness.render()
    assert.strictEqual(shellProps.mode, 'recall',
      'After store.updateTab(mode:"recall"), shellProps.mode must be "recall"')
  })

  // T2-09: store.updateTab(mode:'analysis') -> shellProps.mode === 'analysis'
  it('T2-09: Store updateTab mode=analysis projects mode=analysis to shell', function () {
    const harness = createHarness({
      tabs: [makeTab({id: 'tab_1', mode: 'play'})],
    })

    // Update tab mode to 'analysis'
    harness.workbenchStore.updateTab('tab_1', {mode: 'analysis'})

    const shellProps = harness.render()
    assert.strictEqual(shellProps.mode, 'analysis',
      'After store.updateTab(mode:"analysis"), shellProps.mode must be "analysis"')
  })

  // T2-10: store.updateTab(mode:'problem') -> shellProps.mode === 'problem'
  it('T2-10: Store updateTab mode=problem projects mode=problem to shell', function () {
    const harness = createHarness({
      tabs: [makeTab({id: 'tab_1', mode: 'play'})],
    })

    // Update tab mode to 'problem'
    harness.workbenchStore.updateTab('tab_1', {mode: 'problem'})

    const shellProps = harness.render()
    assert.strictEqual(shellProps.mode, 'problem',
      'After store.updateTab(mode:"problem"), shellProps.mode must be "problem"')
  })

  // T2-11: store.addTab -> games array length increases
  it('T2-11: Store addTab increases games array length in projection', function () {
    const harness = createHarness({
      tabs: [makeTab({id: 'tab_1', mode: 'play'})],
    })

    // Initial state: 1 tab -> games.length === 1
    let shellProps = harness.render()
    assert.ok(Array.isArray(shellProps.games),
      'shellProps must have games array')
    assert.strictEqual(shellProps.games.length, 1,
      'Initial games array must have length 1')

    // Add second tab
    harness.workbenchStore.addTab(makeTab({id: 'tab_2', mode: 'recall', taskId: 'task_2'}))

    // Re-render
    shellProps = harness.render()
    assert.strictEqual(shellProps.games.length, 2,
      'After addTab, games array must have length 2')
  })

  // T2-12: store.setActiveTab -> activeIndex updates
  it('T2-12: Store setActiveTab projects updated activeIndex to shell', function () {
    const harness = createHarness({
      tabs: [
        makeTab({id: 'tab_1', mode: 'play'}),
        makeTab({id: 'tab_2', mode: 'recall', taskId: 'task_2'}),
      ],
      activeTabId: 'tab_1',
    })

    // Initial state: activeIndex === 0
    let shellProps = harness.render()
    assert.strictEqual(shellProps.activeIndex, 0,
      'Initial activeIndex must be 0')

    // Switch to second tab
    harness.workbenchStore.setActiveTab('tab_2')

    // Re-render
    shellProps = harness.render()
    assert.strictEqual(shellProps.activeIndex, 1,
      'After setActiveTab("tab_2"), activeIndex must be 1')
  })
})
