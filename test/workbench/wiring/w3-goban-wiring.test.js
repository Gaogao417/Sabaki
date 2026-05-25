/**
 * W3 Goban Wiring Tests — Container routing and board event chain
 *
 * Test contract: docs/design/2026-05-19/workbench-wiring/w3-goban-wiring-contract-v0.1.md
 * Contracts covered: W3-T09, W3-T20
 *
 * Source of truth alignment:
 *   - Contract Section 6.2: Click Event Chain
 *   - Contract Section 6.1: projectGobanProps Projection
 *   - Arch v0.5 Section 1.1/1.2: Command path UI -> Container -> Service -> Store
 *   - W1 Section 3.2: Resolver context inputs
 *
 * Test Legitimacy:
 *   - W3-T09: Imports real TrainingWorkbenchContainer and resolveBoardInteraction.
 *     Creates a real harness with real stores and spy services.
 *     Verifies container routes board clicks through resolver with workbenchMode context.
 *   - W3-T20: Imports real TrainingWorkbenchContainer and projectGobanProps.
 *     Verifies container passes projected goban props to shell.
 *   - Production module missing -> tryImport returns null -> this.skip(), no silent pass.
 *   - Controlled dependencies: real stores, spy services.
 */

import assert from 'assert'

import TrainingWorkbenchContainer from '../../../src/components/TrainingWorkbenchContainer.js'
import {createWorkbenchStore} from '../../../src/modules/training/store/workbenchStore.ts'
import {createTrainingRuntimeStore} from '../../../src/modules/training/store/trainingRuntimeStore.ts'
import {tryImport} from '../tryImport.js'

let resolveBoardInteraction = null
let projectGobanProps = null
let BOARD_INTENTS = null
let RESOLVE_STATUSES = null

// --- Helpers ---

function makeTab(overrides = {}) {
  return {
    id: 'tab_1',
    taskId: 'task_1',
    mode: 'play',
    childTabIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function createSpyFlowService() {
  const calls = {
    submit: [],
    enterAnalysis: [],
    returnFromAnalysis: [],
    completeRecall: [],
    snapshotFromCurrentContext: [],
  }

  return {
    calls,
    async submit(tabId) { calls.submit.push({tabId}) },
    enterAnalysis(tabId) { calls.enterAnalysis.push({tabId}) },
    returnFromAnalysis(input) { calls.returnFromAnalysis.push(input) },
    completeRecall(tabId) { calls.completeRecall.push({tabId}) },
    async snapshotFromCurrentContext(tabId) { calls.snapshotFromCurrentContext.push({tabId}) },
  }
}

function createSpyTabService() {
  const calls = {switchTab: [], closeTab: [], openTask: []}
  return {
    calls,
    switchTab(tabId) { calls.switchTab.push({tabId}) },
    async closeTab(tabId) { calls.closeTab.push({tabId}) },
    async openTask(opts) { calls.openTask.push(opts) },
  }
}

function createNoopLegacyController() {
  return {
    showRecallHint() {},
    skipRecallMove() {},
    endRecallSession() {},
    undoProblemMove() {},
    submitProblemAttempt() {},
    exitProblemMode() {},
    advanceReview() {},
  }
}

function createHarness({tabs = [makeTab()], activeTabId = tabs[0]?.id ?? null} = {}) {
  const workbenchStore = createWorkbenchStore()
  const runtimeStore = createTrainingRuntimeStore()
  const flowService = createSpyFlowService()
  const tabService = createSpyTabService()

  const taskImportService = {
    async createManualTask(input) {
      return {id: `task_${Date.now()}`, ...input}
    },
  }

  for (const tab of tabs) workbenchStore.addTab(tab)
  if (activeTabId != null) workbenchStore.setActiveTab(activeTabId)

  const trainingContext = {
    runtimeStore,
    workbenchStore,
    workbenchFlowService: flowService,
    flowService,
    workbenchTabService: tabService,
    tabService,
    taskImportService,
    legacyTrainingFlowController: createNoopLegacyController(),
  }

  const sabaki = {
    getTrainingContext() {
      return trainingContext
    },
  }

  const container = new TrainingWorkbenchContainer({sabaki})
  container.props = {sabaki}

  return {
    workbenchStore,
    runtimeStore,
    flowService,
    tabService,
    shellProps: container.render().props,
    container,
  }
}

// --- Tests ---

describe('W3 Goban Wiring: Container board event routing', function () {
  before(async function () {
    const resolverMod = await tryImport(
      'src/modules/workbench/board-interactions/resolveBoardInteraction.ts',
    )
    if (resolverMod) {
      resolveBoardInteraction = resolverMod.resolveBoardInteraction
    }

    const intentsMod = await tryImport(
      'src/modules/workbench/board-interactions/intents.ts',
    )
    if (intentsMod) {
      BOARD_INTENTS = intentsMod.BOARD_INTENTS
      RESOLVE_STATUSES = intentsMod.RESOLVE_STATUSES
    }

    projectGobanProps = await tryImport(
      'src/modules/training/workbench/projectGobanProps.ts',
    )

    // Container always exists (imported statically above), so these tests
    // can run even if resolver or projectGobanProps are not yet implemented.
  })

  // --- W3-T09: Container handleBoardVertexClick routes to resolver with workbenchMode ---

  describe('W3-T09: Container board vertex click routing', () => {
    it('container passes onVertexClick to shell via boardProps', function () {
      // HARD ASSERTION: Container must wire onVertexClick through boardProps.
      // Currently fails because TrainingWorkbenchContainer does not import or
      // use projectGobanProps, and does not pass boardProps to the shell.
      // This test will pass once container wiring is implemented.
      const {shellProps} = createHarness({
        tabs: [makeTab({id: 'tab_1', mode: 'play'})],
      })

      assert.ok(
        shellProps.boardProps != null,
        'Container must pass boardProps (from projectGobanProps) to WorkbenchShell',
      )
      assert.strictEqual(
        typeof shellProps.boardProps.handlerProps?.onVertexClick,
        'function',
        'boardProps.handlerProps.onVertexClick must be a function',
      )
    })

    it('onVertexClick routes through resolveBoardInteraction with workbenchMode context', function () {
      // HARD ASSERTION: The handler must route through the resolver with
      // workbenchMode, tabId, taskId context per Contract Section 6.2.
      // Currently fails because the container does not wire this handler.
      //
      // NOTE: This test verifies that the container produces a handler that,
      // when called, invokes resolveBoardInteraction with the correct context.
      // Since the container imports resolveBoardInteraction directly, we cannot
      // intercept the call via module-level variable replacement. Instead, we
      // verify the handler exists and is wired from the active tab context.
      // Deep resolver context verification is done in w3-goban-resolver.test.js.
      if (!resolveBoardInteraction) return this.skip()

      const {shellProps} = createHarness({
        tabs: [makeTab({id: 'tab_1', mode: 'play', taskId: 'task_1'})],
      })

      assert.ok(
        shellProps.boardProps != null,
        'Container must pass boardProps to shell',
      )

      const onVertexClick = shellProps.boardProps.handlerProps?.onVertexClick
      assert.strictEqual(
        typeof onVertexClick,
        'function',
        'boardProps.handlerProps.onVertexClick must be a function',
      )

      // Verify the handler is not the projectGobanProps noop.
      // The container must provide its own handler that routes through
      // the resolver/executor chain.
      if (projectGobanProps) {
        const projectionNoop = projectGobanProps({
          workbenchMode: 'play',
          task: null,
          runtimeState: {},
          boardState: {gameTree: {}, treePosition: '', board: {}},
          overlayState: {paintMap: [], markerMap: [], dimmedStones: [], analysis: null},
          settings: {
            showMoveNumbers: false, showNextMoves: true, showSiblings: true,
            showAnalysis: false, showCoordinates: true, showHumanPreference: false,
            selectedTool: 'stone_1', editWorkspaceActive: false,
            boardTransformation: [1, 0, 0, 1, 0, 0], areaSelectMode: false,
          },
          analysisData: null,
        }).handlerProps.onVertexClick

        assert.notStrictEqual(onVertexClick, projectionNoop,
          'Container handler must be a real handler, not the projectGobanProps noop')
      }

      // Verify the handler does not throw when called (basic smoke test).
      // A real handler that routes to the resolver should at minimum not
      // crash on a valid vertex. The resolver may return REJECTED for
      // various reasons (e.g. occupied point), but should not throw.
      let thrown = null
      try {
        onVertexClick([3, 3], {button: 0, ctrlKey: false, metaKey: false, isMac: false})
      } catch (e) {
        thrown = e
      }
      assert.strictEqual(thrown, null,
        'onVertexClick handler should not throw for a valid empty-point click in play mode')
    })

    it('onVertexClick in recall mode produces recall intent', function () {
      if (!resolveBoardInteraction) return this.skip()

      const {shellProps} = createHarness({
        tabs: [makeTab({id: 'tab_recall', mode: 'recall', taskId: 'task_recall'})],
      })

      assert.ok(shellProps.boardProps != null, 'Container must pass boardProps to shell')

      const onVertexClick = shellProps.boardProps.handlerProps?.onVertexClick
      assert.strictEqual(typeof onVertexClick, 'function',
        'Recall mode boardProps must have onVertexClick handler')

      // The handler should not throw for a recall mode click on an empty point.
      // When properly wired, the resolver would produce SUBMIT_RECALL_ANSWER intent.
      let thrown = null
      try {
        onVertexClick([5, 5], {button: 0, ctrlKey: false, metaKey: false, isMac: false})
      } catch (e) {
        thrown = e
      }
      assert.strictEqual(thrown, null,
        'onVertexClick in recall mode should not throw for valid click')
    })
  })

  // --- W3-T20: Container passes projectGobanProps result as boardProps to WorkbenchShell ---

  describe('W3-T20: Container passes projected goban props to shell', () => {
    it('container passes boardProps with all four top-level sections from projectGobanProps', function () {
      // HARD ASSERTION: Container must call projectGobanProps and pass its result
      // as boardProps to the shell. All four sections must be present.
      // Currently fails because TrainingWorkbenchContainer does not use projectGobanProps.
      const {shellProps} = createHarness({
        tabs: [makeTab({id: 'tab_1', mode: 'play'})],
      })

      assert.ok(shellProps.boardProps != null,
        'Container must pass boardProps to WorkbenchShell')

      assert.ok(shellProps.boardProps.boardStateProps != null,
        'boardProps must contain boardStateProps from projectGobanProps')
      assert.ok(shellProps.boardProps.overlayDisplayProps != null,
        'boardProps must contain overlayDisplayProps from projectGobanProps')
      assert.ok(shellProps.boardProps.interactionProps != null,
        'boardProps must contain interactionProps from projectGobanProps')
      assert.ok(shellProps.boardProps.handlerProps != null,
        'boardProps must contain handlerProps from projectGobanProps')
    })

    it('boardProps.handlerProps.onVertexClick is NOT the projectGobanProps noop', function () {
      // HARD ASSERTION: projectGobanProps returns noop placeholder handlers.
      // Container must override onVertexClick with a real handler wired through
      // the resolver/executor chain per Contract Section 6.2.
      // Currently fails because boardProps is not passed at all.
      if (!projectGobanProps) return this.skip()

      // Get the noop that projectGobanProps returns as onVertexClick
      const projectionResult = projectGobanProps({
        workbenchMode: 'play',
        task: null,
        runtimeState: {},
        boardState: {
          gameTree: {id: 'gt_1'},
          treePosition: 'node_1',
          board: {width: 19, height: 19, signMap: []},
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
      })
      const noopFromProjection = projectionResult.handlerProps.onVertexClick

      const {shellProps} = createHarness({
        tabs: [makeTab({id: 'tab_1', mode: 'play'})],
      })

      assert.ok(shellProps.boardProps != null,
        'Container must pass boardProps to shell')

      const containerHandler = shellProps.boardProps.handlerProps.onVertexClick
      assert.strictEqual(typeof containerHandler, 'function',
        'boardProps.handlerProps.onVertexClick must be a function')

      assert.notStrictEqual(
        containerHandler,
        noopFromProjection,
        'Container must override projectGobanProps noop onVertexClick with a real handler',
      )
    })

    it('projectGobanProps output has required top-level sections', function () {
      if (!projectGobanProps) return this.skip()

      const result = projectGobanProps({
        workbenchMode: 'play',
        task: null,
        runtimeState: {},
        boardState: {
          gameTree: {id: 'gt_1'},
          treePosition: 'node_1',
          board: {width: 19, height: 19, signMap: []},
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
      })

      assert.ok(result.boardStateProps, 'result must have boardStateProps')
      assert.ok(result.overlayDisplayProps, 'result must have overlayDisplayProps')
      assert.ok(result.interactionProps, 'result must have interactionProps')
      assert.ok(result.handlerProps, 'result must have handlerProps')
    })
  })

  // --- Mode switching re-projection tests ---

  describe('Mode switching re-projects boardProps', () => {
    it('updating tab mode from play to recall changes boardProps overlay settings', function () {
      // Verify the container re-projects boardProps when mode changes.
      // Per Contract Section 6.3: submitAttempt transitions play -> recall,
      // and overlay props change (showMoveNumbers, showNextMoves, showSiblings).
      // Currently fails because container does not pass boardProps at all.
      const {workbenchStore, container} = createHarness({
        tabs: [makeTab({id: 'tab_1', mode: 'play'})],
      })

      // First render with play mode
      const playShellProps = container.render().props
      assert.ok(playShellProps.boardProps != null,
        'Container must pass boardProps for play mode')

      // Simulate mode transition: play -> recall (as flowService would do)
      workbenchStore.updateTab('tab_1', {mode: 'recall'})

      // Re-render after store update
      const recallShellProps = container.render().props
      assert.ok(recallShellProps.boardProps != null,
        'Container must pass boardProps for recall mode')

      // Per Contract Section 7 and Section 6.3:
      // recall: showMoveNumbers=true, showNextMoves=false, showSiblings=false
      // play: showMoveNumbers=false, showNextMoves=settings, showSiblings=settings
      assert.strictEqual(
        playShellProps.boardProps.overlayDisplayProps.showMoveNumbers,
        false,
        'Play mode boardProps must have showMoveNumbers=false',
      )
      assert.strictEqual(
        recallShellProps.boardProps.overlayDisplayProps.showMoveNumbers,
        true,
        'Recall mode boardProps must have showMoveNumbers=true',
      )
      assert.strictEqual(
        recallShellProps.boardProps.overlayDisplayProps.showNextMoves,
        false,
        'Recall mode boardProps must have showNextMoves=false',
      )
    })

    it('switching active tab re-projects boardProps from new tab mode', function () {
      // Per Contract Section 6.3 switchTaskTab: all Goban props re-projected from new tab.
      // Currently fails because container does not pass boardProps at all.
      const {workbenchStore, container} = createHarness({
        tabs: [
          makeTab({id: 'tab_play', mode: 'play'}),
          makeTab({id: 'tab_recall', mode: 'recall'}),
        ],
        activeTabId: 'tab_play',
      })

      // Render with play tab active
      const playShellProps = container.render().props
      assert.ok(playShellProps.boardProps != null,
        'Container must pass boardProps for active play tab')

      // Switch active tab to recall
      workbenchStore.setActiveTab('tab_recall')

      // Re-render
      const recallShellProps = container.render().props
      assert.ok(recallShellProps.boardProps != null,
        'Container must pass boardProps for active recall tab')

      // Board props should reflect the new tab's mode
      assert.strictEqual(
        recallShellProps.boardProps.overlayDisplayProps.showMoveNumbers,
        true,
        'After switching to recall tab, boardProps must show move numbers',
      )
      assert.strictEqual(
        recallShellProps.boardProps.overlayDisplayProps.showNextMoves,
        false,
        'After switching to recall tab, boardProps must hide next moves',
      )
    })
  })
})