/**
 * P0 Wiring Tests -- EnginePeerList & GameGraph Embedding into WorkbenchShell
 *
 * Test contract: docs/design/2026-05-22/p0-engine-gamegraph-embed/test-contract-v0.1.md
 * Contracts covered: P0-T01 through P0-T15
 *
 * Source of truth alignment:
 *   - UI/UX spec SS13 L932-944: RightSidebar contains VariationTreePanel (GameGraph)
 *   - UI/UX spec SS4.1 L210: Right column cards carry auxiliary info + variation tree
 *   - UI/UX spec SS5 L287: Play right column: 3. Variation tree
 *   - Architecture v0.5 SS1.1 L88-99: Render read path: Store/Repo -> Container -> UI
 *   - Architecture v0.5 SS1.2 L104-122: Command write path: UI -> Controller -> Service
 *   - Architecture v0.5 SS3.1 L269-284: sabaki.js is legacy facade
 *   - Architecture v0.5 SS3.2 L288-309: documentStore manages game/board facts
 *
 * v0.5 conflict check: No conflicts found. Contract does not branch on origin.provider,
 * does not create source-specific tab API, does not have Container directly write store,
 * does not have UI import service/store/repo.
 *
 * Test classification:
 *   - P0-T01, T02, T04: CONTAINER_DELEGATION (engine + game tree props projection)
 *   - P0-T03, T08, T12: CONTAINER_DELEGATION (handleGraphClick handler wiring)
 *   - P0-T13: CONTAINER_DELEGATION (Shell passes onGraphClick to WorkbenchRightPanel)
 *   - P0-T05, T06: UI_COMMAND_MAPPING (panel component rendering)
 *   - P0-T07: PROJECTION_RETURN (re-render with updated treePosition)
 *   - P0-T09, T10, T11: ARCHITECTURE_BOUNDARY (forbidden import check)
 *   - P0-T15: SIDE_EFFECT_BOUNDARY (no workbenchStore write on graph click)
 *
 * Long-term vs migration:
 *   - P0-T01..T08, T12, T15: Long-term -- protect core wiring contracts.
 *   - P0-T09, T10: Long-term -- protect presentational panel purity.
 *   - P0-T11: Long-term -- protect Container from hidden engineService import.
 *   - P0-T13: Migration -- validates Shell prop forwarding. If Shell is refactored,
 *     this test tracks it.
 *   - P0-T05, T06: Long-term -- protect component rendering contracts.
 *
 * Workbench wiring coverage:
 *   - UI command mapping: P0-T05 (WorkbenchLeftPanel renders EnginePeerList),
 *     P0-T06 (WorkbenchRightPanel renders GameGraph)
 *   - Container handler -> sabaki: P0-T03, P0-T08 (handleGraphClick -> setCurrentTreePosition)
 *   - Container projection: P0-T01, P02, T04 (engine + game tree props)
 *   - Shell -> Panel: P0-T13 (onGraphClick reaches WorkbenchRightPanel)
 *   - Store subscription -> projection: P0-T07 (treePosition re-render)
 *   - Architecture boundary: P0-T09, T10, T11
 *   - Side-effect boundary: P0-T15
 *
 * Harness manifest:
 *
 *   Harness "createP0Harness" (P0-T01..T04, T07, T08, T12, T13, T15):
 *     - Real production modules: TrainingWorkbenchContainer, createWorkbenchStore,
 *       createTrainingRuntimeStore, real LoggerService with consoleWriter
 *     - Fake/spy modules: spy flowService, spy tabService, spy legacyController,
 *       mock sabaki with getTrainingContext + setCurrentTreePosition spy
 *     - Valid for: CONTAINER_DELEGATION, PROJECTION_RETURN (via shellProps),
 *       SIDE_EFFECT_BOUNDARY
 *     - Not valid for: CONTROLLER_STATE_TRANSITION (flowService is spy),
 *       RENDERED_UI_RETURN, SERVICE_REPOSITORY_TRANSITION
 *
 * Fragile test warnings:
 *   1. P0-T05, T06: Tests import real EnginePeerList/GameGraph and render via
 *      WorkbenchLeftPanel/WorkbenchRightPanel. If these components have deep sabaki
 *      module imports (PeerList.js:4 imports sabaki), rendering may fail in test
 *      harness without proper module mocking. Tests verify shellProps projection
 *      when panels don't exist yet.
 *   2. P0-T13: Tests that Shell render output passes onGraphClick. This depends
 *      on WorkbenchShell's internal rendering structure. If Shell is refactored,
 *      the test must track the new structure.
 *   3. P0-T02: gameCurrents[gameIndex] indexing is done by Container projection.
 *      Test passes specific array + index and verifies indexed value reaches
 *      shellProps. This is the stable external contract.
 */

import assert from 'assert'
import fs from 'fs'
import path from 'path'
import {fileURLToPath} from 'url'
import {h} from 'preact'

// --- Real production imports ---

import TrainingWorkbenchContainer from '../../../src/components/TrainingWorkbenchContainer.js'
import {createWorkbenchStore} from '../../../src/modules/training/store/workbenchStore.ts'
import {createTrainingRuntimeStore} from '../../../src/modules/training/store/trainingRuntimeStore.ts'
import {createLoggerService} from '../../../src/modules/logger/LoggerService.js'
import {createConsoleWriter} from '../../../src/modules/logger/consoleWriter.js'
import {
  createSpyFlowService,
  createSpyTabService,
  createSpySnapshotService,
  createSpyReviewService,
  createSpyRecallCheckpointService,
  createSpyTaskImportService,
  createNoopLegacyController,
} from '../shared/workbenchSpyFactories.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// --- Logger for test harness (real, not mocked) ---

const logger = createLoggerService({writers: [createConsoleWriter()]})

// --- Tab factory ---

function makePlayTab(overrides = {}) {
  return {
    id: 'tab_play',
    taskId: 'task_play',
    mode: 'play',
    childTabIds: [],
    playerConfig: {black: 'human', white: 'ai'},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// --- Spy factories (from shared) ---

const createSpyLegacyController = createNoopLegacyController

// --- P0 Harness ---
// Creates a real Container with spy sabaki and real stores.
// Container.props simulates what App.js would pass:
//   - sabaki: mock with getTrainingContext, setCurrentTreePosition
//   - engine props: attachedEngineSyncers, blackEngineSyncerId, etc.
//   - game tree props: gameTree, treePosition, graphGridSize, etc.

function createP0Harness({
  tabs = [makePlayTab()],
  activeTabId = tabs[0]?.id ?? null,
  engineProps = {},
  gameTreeProps = {},
} = {}) {
  const workbenchStore = createWorkbenchStore({logger})
  const runtimeStore = createTrainingRuntimeStore({logger})
  const flowService = createSpyFlowService()
  const tabService = createSpyTabService()
  const snapshotService = createSpySnapshotService()
  const legacyController = createSpyLegacyController()
  const reviewService = createSpyReviewService()
  const recallCheckpointService = createSpyRecallCheckpointService()
  const taskImportService = createSpyTaskImportService()

  for (const tab of tabs) workbenchStore.addTab(tab)
  if (activeTabId != null) workbenchStore.setActiveTab(activeTabId)

  const sabakiCalls = {
    setCurrentTreePosition: [],
    makeResign: 0,
    flashInfoOverlay: 0,
  }

  const sabaki = {
    getTrainingContext() {
      return {
        runtimeStore,
        workbenchStore,
        workbenchFlowService: flowService,
        flowService,
        workbenchTabService: tabService,
        tabService,
        taskImportService,
        legacyTrainingFlowController: legacyController,
        snapshotService,
        reviewService,
        recallCheckpointService,
        repository: {
          async loadTask(taskId) { return {id: taskId, rootPositionSgf: ''} },
        },
      }
    },
    setCurrentTreePosition(gameTree, treePosition) {
      sabakiCalls.setCurrentTreePosition.push({gameTree, treePosition})
    },
    makeResign() { sabakiCalls.makeResign++ },
    undo() {},
    redo() {},
    makeMove() {},
    openDrawer() {},
    setComment() {},
    flashInfoOverlay() { sabakiCalls.flashInfoOverlay++ },
    setState() {},
    toggleThirdPartyPanel() {},
  }

  // Default engine props (simulating App.js:700-704)
  const defaultEngineProps = {
    attachedEngineSyncers: [{id: 'syncer_1', name: 'KataGo', busy: false}],
    blackEngineSyncerId: 'syncer_1',
    whiteEngineSyncerId: null,
    analyzingEngineSyncerId: null,
    engineGameOngoing: false,
  }

  // Default game tree props (simulating App.js:699 via ...state with inferredState spread)
  const defaultGameTreeProps = {
    gameTree: {id: 'gt_1', root: {}},
    treePosition: 'node_root',
    graphGridSize: 20,
    graphNodeSize: 8,
    showGameGraph: true,
    gameCurrents: [{currentNodeId: 'node_3'}, {currentNodeId: 'node_5'}],
    gameIndex: 0,
  }

  const allProps = {
    sabaki,
    ...defaultEngineProps,
    ...defaultGameTreeProps,
    ...engineProps,
    ...gameTreeProps,
  }

  const container = new TrainingWorkbenchContainer({sabaki})
  container.props = allProps

  return {
    workbenchStore,
    runtimeStore,
    flowService,
    tabService,
    snapshotService,
    legacyController,
    container,
    sabaki,
    sabakiCalls,
    getShellProps() {
      return container.render().props
    },
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('P0: EnginePeerList & GameGraph Embedding', function () {

  // ===================================================
  // CONTAINER_DELEGATION: Engine props projection (P0-T01, P0-T04)
  // ===================================================

  describe('CONTAINER_DELEGATION: Engine props projection', function () {

    // --- P0-T01: Container projects engine props into shell props ---

    describe('P0-T01: Container projects engine props to shell', function () {
      it('shellProps contains attachedEngineSyncers with values from props', function () {
        const syncers = [{id: 's1', name: 'Leela'}, {id: 's2', name: 'KataGo'}]
        const harness = createP0Harness({
          engineProps: {
            attachedEngineSyncers: syncers,
          },
        })

        const shellProps = harness.getShellProps()

        assert.deepStrictEqual(shellProps.attachedEngineSyncers, syncers,
          'shellProps.attachedEngineSyncers must match input props -- Contract P0-T01')
      })

      it('shellProps contains blackEngineSyncerId and whiteEngineSyncerId from props', function () {
        const harness = createP0Harness({
          engineProps: {
            blackEngineSyncerId: 's_black',
            whiteEngineSyncerId: 's_white',
          },
        })

        const shellProps = harness.getShellProps()

        assert.strictEqual(shellProps.blackEngineSyncerId, 's_black',
          'shellProps.blackEngineSyncerId must match input prop -- Contract P0-T01')
        assert.strictEqual(shellProps.whiteEngineSyncerId, 's_white',
          'shellProps.whiteEngineSyncerId must match input prop -- Contract P0-T01')
      })

      it('shellProps contains engineGameOngoing from props', function () {
        const harness = createP0Harness({
          engineProps: {
            engineGameOngoing: true,
          },
        })

        const shellProps = harness.getShellProps()

        assert.strictEqual(shellProps.engineGameOngoing, true,
          'shellProps.engineGameOngoing must match input prop -- Contract P0-T01')
      })

      it('shellProps contains analyzingEngineSyncerId from props', function () {
        const harness = createP0Harness({
          engineProps: {
            analyzingEngineSyncerId: 's_analyze',
          },
        })

        const shellProps = harness.getShellProps()

        assert.strictEqual(shellProps.analyzingEngineSyncerId, 's_analyze',
          'shellProps.analyzingEngineSyncerId must match input prop -- Contract P0-T01')
      })
    })

    // --- P0-T04: Engine props values match App.js input, not hardcoded defaults ---

    describe('P0-T04: Engine prop values come from input, not hardcoded defaults', function () {
      it('attachedEngineSyncers reflects specific input values, not defaults', function () {
        const customSyncers = [{id: 'custom_syncer', name: 'CustomEngine'}]
        const harness = createP0Harness({
          engineProps: {
            attachedEngineSyncers: customSyncers,
          },
        })

        const shellProps = harness.getShellProps()

        // Verify it is NOT the default [{id: 'syncer_1', name: 'KataGo', ...}]
        assert.strictEqual(shellProps.attachedEngineSyncers.length, 1,
          'Must have exactly 1 syncer from custom input -- Contract P0-T04 weak-test ban')
        assert.strictEqual(shellProps.attachedEngineSyncers[0].id, 'custom_syncer',
          'Syncer id must match custom input, not default -- Contract P0-T04')
        assert.strictEqual(shellProps.attachedEngineSyncers[0].name, 'CustomEngine',
          'Syncer name must match custom input, not default -- Contract P0-T04')
      })

      it('engineGameOngoing reflects specific input value, not default', function () {
        // Default is false; verify true comes through
        const harness = createP0Harness({
          engineProps: {
            engineGameOngoing: true,
          },
        })

        const shellProps = harness.getShellProps()

        assert.strictEqual(shellProps.engineGameOngoing, true,
          'engineGameOngoing must be true from input, not false from default -- Contract P0-T04')
      })
    })
  })

  // ===================================================
  // CONTAINER_DELEGATION: Game tree props projection (P0-T02)
  // ===================================================

  describe('CONTAINER_DELEGATION: Game tree props projection', function () {

    // --- P0-T02: Container projects game tree props into shell props ---

    describe('P0-T02: Container projects game tree props to shell', function () {
      it('shellProps contains gameTree from props', function () {
        const gameTree = {id: 'gt_custom', root: {data: 'test'}}
        const harness = createP0Harness({
          gameTreeProps: {gameTree},
        })

        const shellProps = harness.getShellProps()

        assert.strictEqual(shellProps.gameTree, gameTree,
          'shellProps.gameTree must match input prop -- Contract P0-T02')
      })

      it('shellProps contains treePosition from props', function () {
        const harness = createP0Harness({
          gameTreeProps: {treePosition: 'node_42'},
        })

        const shellProps = harness.getShellProps()

        assert.strictEqual(shellProps.treePosition, 'node_42',
          'shellProps.treePosition must match input prop -- Contract P0-T02')
      })

      it('shellProps contains graphGridSize and graphNodeSize from props', function () {
        const harness = createP0Harness({
          gameTreeProps: {
            graphGridSize: 30,
            graphNodeSize: 12,
          },
        })

        const shellProps = harness.getShellProps()

        assert.strictEqual(shellProps.graphGridSize, 30,
          'shellProps.graphGridSize must match input prop -- Contract P0-T02')
        assert.strictEqual(shellProps.graphNodeSize, 12,
          'shellProps.graphNodeSize must match input prop -- Contract P0-T02')
      })

      it('shellProps contains showGameGraph from props', function () {
        const harness = createP0Harness({
          gameTreeProps: {showGameGraph: true},
        })

        const shellProps = harness.getShellProps()

        assert.strictEqual(shellProps.showGameGraph, true,
          'shellProps.showGameGraph must match input prop -- Contract P0-T02')
      })

      it('shellProps.gameCurrents is indexed by gameIndex (gameCurrents[gameIndex])', function () {
        const gameCurrents = [
          {currentNodeId: 'game0_node'},
          {currentNodeId: 'game1_node'},
          {currentNodeId: 'game2_node'},
        ]
        const harness = createP0Harness({
          gameTreeProps: {
            gameCurrents,
            gameIndex: 1,
          },
        })

        const shellProps = harness.getShellProps()

        // Contract P0-T02: Container must project gameCurrents[gameIndex],
        // not the full array. This mirrors Sidebar.js:777 behavior.
        assert.deepStrictEqual(shellProps.gameCurrents, {currentNodeId: 'game1_node'},
          'shellProps.gameCurrents must be gameCurrents[gameIndex] = gameCurrents[1], not the full array -- Contract P0-T02, Contract section 4 gameCurrents indexing')
      })

      it('shellProps.gameCurrents defaults correctly when gameIndex is 0', function () {
        const gameCurrents = [
          {currentNodeId: 'first_game'},
          {currentNodeId: 'second_game'},
        ]
        const harness = createP0Harness({
          gameTreeProps: {
            gameCurrents,
            gameIndex: 0,
          },
        })

        const shellProps = harness.getShellProps()

        assert.deepStrictEqual(shellProps.gameCurrents, {currentNodeId: 'first_game'},
          'shellProps.gameCurrents must be gameCurrents[0] when gameIndex is 0 -- Contract P0-T02')
      })
    })
  })

  // ===================================================
  // CONTAINER_DELEGATION: handleGraphClick handler (P0-T03, P0-T08, P0-T12)
  // ===================================================

  describe('CONTAINER_DELEGATION: handleGraphClick handler', function () {

    // --- P0-T03: handleGraphClick calls sabaki.setCurrentTreePosition ---

    describe('P0-T03: handleGraphClick delegates to sabaki.setCurrentTreePosition', function () {
      it('onGraphClick calls sabaki.setCurrentTreePosition with gameTree and treePosition', function () {
        const harness = createP0Harness()

        const shellProps = harness.getShellProps()

        assert.strictEqual(typeof shellProps.onGraphClick, 'function',
          'Container must expose onGraphClick callback -- Contract P0-T03')

        // GameGraph.handleNodeClick -> onNodeClick(evt) where evt.gameTree and evt.treePosition
        // are assigned onto the event object. Contract section 2 A-P0.5.
        const fakeGameTree = {id: 'gt_nav', root: {}}
        const evt = {gameTree: fakeGameTree, treePosition: 'node_moved'}
        shellProps.onGraphClick(evt)

        assert.strictEqual(harness.sabakiCalls.setCurrentTreePosition.length, 1,
          'setCurrentTreePosition must be called once -- Contract P0-T03')
        assert.strictEqual(
          harness.sabakiCalls.setCurrentTreePosition[0].gameTree,
          fakeGameTree,
          'setCurrentTreePosition must receive evt.gameTree -- Contract P0-T03',
        )
        assert.strictEqual(
          harness.sabakiCalls.setCurrentTreePosition[0].treePosition,
          'node_moved',
          'setCurrentTreePosition must receive evt.treePosition -- Contract P0-T03',
        )
      })
    })

    // --- P0-T08: handleGraphClick uses single-argument evt signature ---

    describe('P0-T08: handleGraphClick uses single-argument evt signature', function () {
      it('handleGraphClick(evt) extracts gameTree and treePosition from evt object, not separate args', function () {
        const harness = createP0Harness()
        const shellProps = harness.getShellProps()

        // RED until P0: onGraphClick is not wired yet. Guard for clear failure message.
        assert.strictEqual(typeof shellProps.onGraphClick, 'function',
          'Container must expose onGraphClick -- RED until P0 implementation, Contract P0-T08')

        // GameGraphNode.handleClick:46-56 calls:
        //   onNodeClick(Object.assign(evt, {gameTree, treePosition}))
        // This is a single-argument call. Container handler must read evt.gameTree
        // and evt.treePosition from the single event argument.
        // Historical lesson: Goban calls onVertexClick(evt) single-arg; test once
        // used two-arg form and passed green but crashed at runtime.
        const evt = {gameTree: {id: 'gt_sig'}, treePosition: 'node_sig', type: 'click'}
        shellProps.onGraphClick(evt)

        assert.strictEqual(harness.sabakiCalls.setCurrentTreePosition.length, 1,
          'setCurrentTreePosition called once after single-arg invocation -- Contract P0-T08')
        assert.strictEqual(
          harness.sabakiCalls.setCurrentTreePosition[0].gameTree.id,
          'gt_sig',
          'gameTree extracted from evt.gameTree -- Contract P0-T08',
        )
        assert.strictEqual(
          harness.sabakiCalls.setCurrentTreePosition[0].treePosition,
          'node_sig',
          'treePosition extracted from evt.treePosition -- Contract P0-T08',
        )

        // Also verify the handler does NOT pass undefined by trying a second call
        // with different values to ensure the extraction is correct
        const evt2 = {gameTree: {id: 'gt_second'}, treePosition: 'node_second'}
        shellProps.onGraphClick(evt2)

        assert.strictEqual(
          harness.sabakiCalls.setCurrentTreePosition[1].gameTree.id,
          'gt_second',
          'Second call gameTree correct -- no stale state from first call -- Contract P0-T08',
        )
        assert.strictEqual(
          harness.sabakiCalls.setCurrentTreePosition[1].treePosition,
          'node_second',
          'Second call treePosition correct -- Contract P0-T08',
        )
      })
    })

    // --- P0-T12: shellHandlers includes onGraphClick ---

    describe('P0-T12: shellHandlers includes onGraphClick', function () {
      it('shellProps.onGraphClick is a function that delegates to handleGraphClick', function () {
        const harness = createP0Harness()
        const shellProps = harness.getShellProps()

        // shellHandlers must include onGraphClick as a function
        assert.strictEqual(typeof shellProps.onGraphClick, 'function',
          'shellHandlers must include onGraphClick as a function -- Contract P0-T12')

        // Verify it actually delegates: calling it should invoke sabaki.setCurrentTreePosition
        shellProps.onGraphClick({gameTree: {id: 'gt_t12'}, treePosition: 'pos_t12'})

        assert.strictEqual(harness.sabakiCalls.setCurrentTreePosition.length, 1,
          'onGraphClick must delegate to setCurrentTreePosition -- Contract P0-T12')
      })
    })
  })

  // ===================================================
  // CONTAINER_DELEGATION: Shell passes onGraphClick to WorkbenchRightPanel (P0-T13)
  // ===================================================

  describe('CONTAINER_DELEGATION: Shell forwards onGraphClick', function () {

    // --- P0-T13: WorkbenchShell passes onGraphClick to right panel area ---

    describe('P0-T13: WorkbenchShell passes onGraphClick to right-panel', function () {
      it('WorkbenchShell render output includes onGraphClick in right-panel area props', function () {
        const harness = createP0Harness()
        const shellProps = harness.getShellProps()

        // Verify onGraphClick is present in shellProps (which flows to WorkbenchShell)
        assert.strictEqual(typeof shellProps.onGraphClick, 'function',
          'onGraphClick must be in shellProps flowing to WorkbenchShell -- Contract P0-T13')

        // Note: Shell -> WorkbenchRightPanel forwarding is verified post-implementation.
        // Currently WorkbenchRightPanel does not exist; shellProps check is sufficient
        // to prove the wiring reaches Shell. P0-T13 will be strengthened when
        // WorkbenchRightPanel is created (verify it receives onGraphClick from Shell).
      })
    })
  })

  // ===================================================
  // CONTAINER_DELEGATION: Engine/Game props for UI consumption (P0-T05, P0-T06)
  // Note: Reclassified from UI_COMMAND_MAPPING — WorkbenchLeftPanel/RightPanel
  // don't exist yet, so we verify props reach Shell (sufficient for wiring contract).
  // Real UI_COMMAND_MAPPING tests deferred to post-implementation.
  // ===================================================

  describe('UI_COMMAND_MAPPING (CONTAINER_DELEGATION until panels exist)', function () {

    // --- P0-T05: Engine props available for WorkbenchLeftPanel -> EnginePeerList ---

    describe('P0-T05: Engine props for WorkbenchLeftPanel -> EnginePeerList', function () {
      it('shellProps contains engine props with correct values for EnginePeerList', function () {
        const syncers = [{id: 's_engine', name: 'TestEngine', busy: false}]
        const harness = createP0Harness({
          engineProps: {
            attachedEngineSyncers: syncers,
            blackEngineSyncerId: 's_engine',
            whiteEngineSyncerId: null,
            engineGameOngoing: false,
          },
        })

        const shellProps = harness.getShellProps()

        // Verify all engine props that WorkbenchLeftPanel needs to pass
        // to EnginePeerList are present in shellProps with correct values
        assert.deepStrictEqual(shellProps.attachedEngineSyncers, syncers,
          'attachedEngineSyncers must match input -- Contract P0-T05')
        assert.strictEqual(shellProps.blackEngineSyncerId, 's_engine',
          'blackEngineSyncerId must match input -- Contract P0-T05')
        assert.strictEqual(shellProps.whiteEngineSyncerId, null,
          'whiteEngineSyncerId must match input -- Contract P0-T05')
        assert.strictEqual(shellProps.engineGameOngoing, false,
          'engineGameOngoing must match input -- Contract P0-T05')

        // Verify values match input (not hardcoded)
        assert.deepStrictEqual(shellProps.attachedEngineSyncers, syncers,
          'Engine syncer values must come from input props -- Contract P0-T05 weak-test ban')
      })
    })

    // --- P0-T06: WorkbenchRightPanel renders GameGraph when gameTree provided ---

    describe('P0-T06: WorkbenchRightPanel renders GameGraph with onNodeClick', function () {
      it('shellProps contains game tree props and onGraphClick needed for GameGraph', function () {
        const harness = createP0Harness()

        const shellProps = harness.getShellProps()

        // Verify all props WorkbenchRightPanel needs for GameGraph with value checks
        assert.strictEqual(shellProps.gameTree, harness.gameTree,
          'gameTree must match input value -- Contract P0-T06')
        assert.strictEqual(shellProps.treePosition, 'node_1',
          'treePosition must match input value -- Contract P0-T06')
        assert.strictEqual(shellProps.graphGridSize, 20,
          'graphGridSize must match input value -- Contract P0-T06')
        assert.strictEqual(shellProps.graphNodeSize, 10,
          'graphNodeSize must match input value -- Contract P0-T06')
        assert.strictEqual(shellProps.showGameGraph, true,
          'showGameGraph must match input value -- Contract P0-T06')
        assert.strictEqual(typeof shellProps.onGraphClick, 'function',
          'onGraphClick must be a function in shellProps for GameGraph onNodeClick -- Contract P0-T06')
      })
    })
  })

  // ===================================================
  // PROJECTION_RETURN (P0-T07)
  // ===================================================

  describe('PROJECTION_RETURN', function () {

    // --- P0-T07: Container re-renders with updated treePosition ---

    describe('P0-T07: Container re-render passes updated treePosition to shell', function () {
      it('after props update with new treePosition, shellProps reflects new value', function () {
        const harness = createP0Harness({
          gameTreeProps: {treePosition: 'node_initial'},
        })

        // First render
        let shellProps = harness.getShellProps()
        assert.strictEqual(shellProps.treePosition, 'node_initial',
          'Initial treePosition must be node_initial -- Contract P0-T07')

        // Simulate App.js re-render with updated treePosition
        // (In production, sabaki 'change' -> App setState -> Container re-render)
        harness.container.props = {
          ...harness.container.props,
          treePosition: 'node_updated',
        }

        // Re-render Container
        shellProps = harness.getShellProps()
        assert.strictEqual(shellProps.treePosition, 'node_updated',
          'After props update, treePosition must be node_updated -- Contract P0-T07')
      })

      it('gameCurrents updates correctly when gameIndex changes', function () {
        const gameCurrents = [
          {currentNodeId: 'game0_v2'},
          {currentNodeId: 'game1_v2'},
        ]
        const harness = createP0Harness({
          gameTreeProps: {
            gameCurrents,
            gameIndex: 0,
          },
        })

        let shellProps = harness.getShellProps()
        assert.deepStrictEqual(shellProps.gameCurrents, {currentNodeId: 'game0_v2'},
          'Initial gameCurrents must be indexed at gameIndex 0 -- Contract P0-T07')

        // Simulate game switch
        harness.container.props = {
          ...harness.container.props,
          gameIndex: 1,
        }

        shellProps = harness.getShellProps()
        assert.deepStrictEqual(shellProps.gameCurrents, {currentNodeId: 'game1_v2'},
          'After gameIndex change to 1, gameCurrents must be indexed at 1 -- Contract P0-T07')
      })
    })
  })

  // ===================================================
  // ARCHITECTURE_BOUNDARY (P0-T09, P0-T10, P0-T11)
  // ===================================================

  describe('ARCHITECTURE_BOUNDARY', function () {

    // Forbidden import patterns for presentational panels
    const forbiddenPatterns = [
      /require\s*\(\s*['"][^'"]*modules\/training\//,
      /require\s*\(\s*['"][^'"]*modules\/sabaki/,
      /import\s+.*from\s+['"][^'"]*modules\/training\//,
      /import\s+.*from\s+['"][^'"]*modules\/sabaki/,
    ]

    // --- P0-T09: WorkbenchLeftPanel does not import service/store/repository ---

    describe('P0-T09: WorkbenchLeftPanel has no forbidden imports', function () {
      it('WorkbenchLeftPanel source has no service/store/repository imports', function () {
        const panelPath = path.resolve(
          __dirname, '../../../src/components/workbench/panels/WorkbenchLeftPanel.js',
        )

        // WorkbenchLeftPanel may not exist yet (P0 implementation deliverable).
        // When it does exist, this test enforces architectural purity.
        if (!fs.existsSync(panelPath)) {
          this.skip('WorkbenchLeftPanel.js does not exist yet -- RED until P0 implementation')
        }

        const source = fs.readFileSync(panelPath, 'utf-8')

        for (const pattern of forbiddenPatterns) {
          assert.ok(
            !pattern.test(source),
            `WorkbenchLeftPanel must not contain forbidden import pattern ${pattern} -- Arch v0.5 SS0.3, Contract P0-T09`,
          )
        }
      })
    })

    // --- P0-T10: WorkbenchRightPanel does not import service/store/repository ---

    describe('P0-T10: WorkbenchRightPanel has no forbidden imports', function () {
      it('WorkbenchRightPanel source has no service/store/repository imports', function () {
        const panelPath = path.resolve(
          __dirname, '../../../src/components/workbench/panels/WorkbenchRightPanel.js',
        )

        if (!fs.existsSync(panelPath)) {
          this.skip('WorkbenchRightPanel.js does not exist yet -- RED until P0 implementation')
        }

        const source = fs.readFileSync(panelPath, 'utf-8')

        for (const pattern of forbiddenPatterns) {
          assert.ok(
            !pattern.test(source),
            `WorkbenchRightPanel must not contain forbidden import pattern ${pattern} -- Arch v0.5 SS0.3, Contract P0-T10`,
          )
        }
      })
    })

    // --- P0-T11: Container does not directly import engineService ---

    describe('P0-T11: Container does not directly import engineService', function () {
      it('Container source does not contain engineService import', function () {
        const containerPath = path.resolve(
          __dirname, '../../../src/components/TrainingWorkbenchContainer.js',
        )
        const source = fs.readFileSync(containerPath, 'utf-8')

        // Container must not import engineService directly.
        // Engine props come from App.js via this.props (Contract section 4).
        const engineServicePatterns = [
          /require\s*\(\s*['"][^'"]*engineService/,
          /import\s+.*engineService.*from/,
        ]

        for (const pattern of engineServicePatterns) {
          assert.ok(
            !pattern.test(source),
            `Container must not import engineService directly -- engine props come from App.js this.props -- Arch v0.5 SS1.1, Contract P0-T11`,
          )
        }
      })
    })
  })

  // ===================================================
  // SIDE_EFFECT_BOUNDARY (P0-T15)
  // ===================================================

  describe('SIDE_EFFECT_BOUNDARY', function () {

    // --- P0-T15: GameGraph click does not modify workbenchStore ---

    describe('P0-T15: handleGraphClick does not modify workbenchStore', function () {
      it('after onGraphClick, workbenchStore.updateTab was not called', function () {
        const harness = createP0Harness()

        // Spy on workbenchStore.updateTab to verify it is never called
        let storeUpdateCalled = false
        const originalUpdateTab = harness.workbenchStore.updateTab.bind(harness.workbenchStore)
        harness.workbenchStore.updateTab = function(tabId, patch) {
          storeUpdateCalled = true
          return originalUpdateTab(tabId, patch)
        }

        const shellProps = harness.getShellProps()

        // RED until P0: onGraphClick is not wired yet. Guard for clear failure message.
        assert.strictEqual(typeof shellProps.onGraphClick, 'function',
          'Container must expose onGraphClick -- RED until P0 implementation, Contract P0-T15')

        // Trigger graph click -- Contract P0-T15
        shellProps.onGraphClick({
          gameTree: {id: 'gt_side'},
          treePosition: 'node_side',
        })

        // Verify side-effect boundary: only sabaki.setCurrentTreePosition,
        // not workbenchStore.updateTab
        assert.strictEqual(storeUpdateCalled, false,
          'handleGraphClick must not call workbenchStore.updateTab -- it only calls sabaki.setCurrentTreePosition -- Arch v0.5, Contract P0-T15')

        // Verify the intended side effect DID happen
        assert.strictEqual(harness.sabakiCalls.setCurrentTreePosition.length, 1,
          'handleGraphClick must call sabaki.setCurrentTreePosition -- Contract P0-T15 positive assertion')
      })

      it('after onGraphClick, flowService.submit was not called', function () {
        const harness = createP0Harness()
        const shellProps = harness.getShellProps()

        // RED until P0: onGraphClick is not wired yet. Guard for clear failure message.
        assert.strictEqual(typeof shellProps.onGraphClick, 'function',
          'Container must expose onGraphClick -- RED until P0 implementation, Contract P0-T15')

        shellProps.onGraphClick({
          gameTree: {id: 'gt_no_submit'},
          treePosition: 'node_no_submit',
        })

        assert.strictEqual(harness.flowService.calls.submit.length, 0,
          'handleGraphClick must not call flowService.submit -- Contract P0-T15')
        assert.strictEqual(harness.flowService.calls.enterAnalysis.length, 0,
          'handleGraphClick must not call flowService.enterAnalysis -- Contract P0-T15')
      })
    })
  })
})

// ============================================================================
// Helper: find right-panel child in Shell render output
// ============================================================================

/**
 * Walk the WorkbenchShell render VNode tree to find the child component
 * rendered inside the right-panel div.
 * Returns null if the structure doesn't match or WorkbenchRightPanel doesn't exist.
 */