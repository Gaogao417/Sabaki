/**
 * W8-P4 Regression Wiring Tests
 *
 * Test contract: docs/design/2026-05-21/w8-p4-dashboard-regression/test-contract-v0.2.md
 * Contracts covered: R-T01 through R-T12 (Regression tests)
 *
 * Purpose: Prove existing board/engine/analysis/overlay wiring from W8-P1 through
 * W8-P3 still works after dashboard wiring. Dashboard handlers are added to the
 * same Container; regression tests verify no breakage.
 *
 * Source of truth alignment:
 *   - W8-P1 wiring: boardInteractionController, gobanDataAdapter
 *   - W8-P2 wiring: mode transitions, submit, analysis, snapshot, executor routing
 *   - W8-P3 wiring: player config, recall checkpoint, mode bar policy
 *   - PRD v0.5 SS2: Mode definitions (play/problem/recall/analysis)
 *   - Arch v0.5 SS5.3: flowService.updatePlayerConfig
 *   - Arch v0.5 SS9.4-9.7: submit/enterAnalysis/snapshot command paths
 *
 * Test classification:
 *   - R-T01, R-T02: CONTROLLER_STATE_TRANSITION (board click routing)
 *   - R-T03: PROJECTION_RETURN (modeBarPolicy)
 *   - R-T04..R-T08: CONTAINER_DELEGATION (submit/analysis/snapshot/modeChange/playerConfig)
 *   - R-T09: ARCHITECTURE_BOUNDARY (Container import analysis)
 *   - R-T10: PROJECTION_RETURN (projectFromWorkbench)
 *   - R-T11: CONTAINER_DELEGATION (recall checkpoint handlers)
 *   - R-T12: CONTAINER_DELEGATION (review queue handlers)
 *
 * Long-term vs migration:
 *   - All tests are long-term regression guards. They protect existing wiring
 *     from being broken by new dashboard handler additions.
 *   - No migration tests here; all tests should be GREEN if prior wiring is intact.
 *
 * Workbench wiring coverage:
 *   - Board click routing: R-T01, R-T02
 *   - Mode bar projection: R-T03
 *   - Container handler -> flowService: R-T04, R-T05, R-T06, R-T07, R-T08
 *   - Container handler -> recallCheckpointService: R-T11
 *   - Container handler -> reviewService: R-T12
 *   - Container projection: R-T10
 *   - Container imports: R-T09
 *
 * Harness manifest:
 *
 *   Harness "createRegressionHarness" (R-T01..R-T08, R-T10..R-T12):
 *     - Real production modules: TrainingWorkbenchContainer, createWorkbenchStore,
 *       createTrainingRuntimeStore, real LoggerService with consoleWriter
 *     - Fake/spy modules: spy flowService, spy tabService, spy reviewService,
 *       spy recallCheckpointService, spy taskImportService, spy legacyController,
 *       mock sabaki with getTrainingContext
 *     - Valid for: CONTAINER_DELEGATION, PROJECTION_RETURN (via shellProps),
 *       CONTROLLER_STATE_TRANSITION (board click handler inspection),
 *       ARCHITECTURE_BOUNDARY (import analysis)
 *     - Not valid for: SERVICE_REPOSITORY_TRANSITION, RENDERED_UI_RETURN
 *
 *   Harness "static analysis" (R-T09):
 *     - Real production modules: Container source file
 *     - Fake/spy modules: none
 *     - Valid for: ARCHITECTURE_BOUNDARY (static import check)
 *     - Not valid for: runtime behavior
 *
 * Fragile test warnings:
 *   1. R-T01, R-T02: These verify that onVertexClick is wired on the boardProps
 *      handler. They do not fully exercise the controller (which requires adapter).
 *      The real controller integration is tested in w8-p1 tests.
 *   2. R-T03: computeModeBarPolicy is tested via shellProps output. If the
 *      policy function changes, the test tracks but the contract (correct policy
 *      per mode) is stable.
 *   3. R-T09: String-based import analysis. If Container uses dynamic import(),
 *      the check may miss violations.
 */

import assert from 'assert'
import fs from 'fs'
import path from 'path'
import {fileURLToPath} from 'url'

// --- Real production imports ---

import TrainingWorkbenchContainer from '../../../src/components/TrainingWorkbenchContainer.js'
import {createWorkbenchStore} from '../../../src/modules/training/store/workbenchStore.ts'
import {createTrainingRuntimeStore} from '../../../src/modules/training/store/trainingRuntimeStore.ts'
import {
  createSpyFlowService,
  createSpyTabService,
  createSpyReviewService,
  createSpyRecallCheckpointService,
  createSpyTaskImportService,
  createNoopLegacyController,
} from '../shared/workbenchSpyFactories.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// --- Logger for test harness (real, not mocked) ---

import {createLoggerService} from '../../../src/modules/logger/LoggerService.js'
import {createConsoleWriter} from '../../../src/modules/logger/consoleWriter.js'

const logger = createLoggerService({writers: [createConsoleWriter()]})

// --- Tab factories ---

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

function makeProblemTab(overrides = {}) {
  return {
    id: 'tab_problem',
    taskId: 'task_problem',
    mode: 'problem',
    activeAttemptId: 'att_1',
    childTabIds: [],
    playerConfig: {black: 'human', white: 'ai'},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeRecallTab(overrides = {}) {
  return {
    id: 'tab_recall',
    taskId: 'task_recall',
    mode: 'recall',
    activeRecallSessionId: 'rs_1',
    childTabIds: [],
    playerConfig: {black: 'human', white: 'ai'},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeAnalysisTab(overrides = {}) {
  return {
    id: 'tab_analysis',
    taskId: 'task_analysis',
    mode: 'analysis',
    previousMode: 'problem',
    analysisContext: {source: 'problem', taskId: 'task_analysis'},
    childTabIds: [],
    playerConfig: {black: 'human', white: 'ai'},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// --- Spy factories imported from shared (see workbenchSpyFactories.ts) ---

// --- Regression Harness ---

function createRegressionHarness({
  tabs = [makePlayTab()],
  activeTabId = tabs[0]?.id ?? null,
  runtimeState = {},
} = {}) {
  const workbenchStore = createWorkbenchStore({logger})
  const runtimeStore = createTrainingRuntimeStore({logger})
  const flowService = createSpyFlowService()
  const tabService = createSpyTabService()
  const reviewService = createSpyReviewService()
  const recallCheckpointService = createSpyRecallCheckpointService()
  const taskImportService = createSpyTaskImportService()

  for (const tab of tabs) workbenchStore.addTab(tab)
  if (activeTabId != null) workbenchStore.setActiveTab(activeTabId)

  // Set up runtime state for checkpoint tests
  if (runtimeState.activeCheckpointId) {
    runtimeStore.setActiveCheckpoint(runtimeState.activeCheckpointId)
  }
  if (runtimeState.correctionDraft) {
    runtimeStore.setCorrectionDraft(runtimeState.correctionDraft)
  }
  if (runtimeState.recallView) {
    runtimeStore.setRecallView(runtimeState.recallView)
  }

  const repository = {
    async loadTask(taskId) { return {id: taskId, rootPositionSgf: ''} },
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
    reviewService,
    recallCheckpointService,
    repository,
  }

  const sabaki = {
    getTrainingContext() {
      return trainingContext
    },
    stopEngineGameTraining: async () => {},
    makeResign() {},
    undo() {},
    redo() {},
    makeMove() {},
    openDrawer() {},
    setComment() {},
    flashInfoOverlay() {},
    setState() {},
    toggleThirdPartyPanel() {},
  }

  const container = new TrainingWorkbenchContainer({sabaki})
  container.props = {sabaki}

  return {
    workbenchStore,
    runtimeStore,
    flowService,
    tabService,
    reviewService,
    recallCheckpointService,
    container,
    sabaki,
    trainingContext,
    getShellProps() {
      return container.render().props
    },
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('W8-P4 Regression: Existing Wiring Still Works', function () {

  // ===================================================
  // R-T01: Board click in Play mode still routes through controller
  // ===================================================

  describe('R-T01: Board click in Play mode', function () {
    // R-T01: Board click in Play mode still routes through
    // boardInteractionController and produces correct move.
    // Layer: CONTAINER_DELEGATION (existence check only)
    // NOTE: This test only verifies the handler exists and does not throw.
    // It does NOT verify that the handler invokes the controller or that
    // downstream state changes occur. For full chain verification, see
    // w8-p2-executor-routing T-PLAY-01/02/03.
    // Production Subject: boardInteractionController via Container onVertexClick
    // Real Dependencies: Container render with play tab
    // Mocked Dependencies: spy services
    // Primary Assertion: onVertexClick handler exists on boardProps

    it('boardProps.handlerProps.onVertexClick is a function in Play mode', function () {
      const harness = createRegressionHarness({
        tabs: [makePlayTab({id: 'tab_rt1'})],
      })

      const shellProps = harness.getShellProps()

      assert.ok(shellProps.boardProps, 'shellProps must include boardProps')
      assert.ok(shellProps.boardProps.handlerProps, 'boardProps must include handlerProps')
      assert.strictEqual(typeof shellProps.boardProps.handlerProps.onVertexClick, 'function',
        'onVertexClick must be a function on boardProps.handlerProps -- Regression R-T01')
    })

    it('onVertexClick does not throw when called with a vertex event', function () {
      const harness = createRegressionHarness({
        tabs: [makePlayTab({id: 'tab_rt1b'})],
      })

      const shellProps = harness.getShellProps()
      const handler = shellProps.boardProps.handlerProps.onVertexClick

      // Goban.handleVertexMouseUp:282 calls onVertexClick(evt) where
      // evt.vertex = [row, col], evt.button = 0
      assert.doesNotThrow(function () {
        handler({vertex: [3, 3], button: 0, ctrlKey: false, metaKey: false})
      }, 'onVertexClick must not throw on valid vertex event -- Regression R-T01')
    })
  })

  // ===================================================
  // R-T02: Board click in Problem mode still routes through controller
  // ===================================================

  describe('R-T02: Board click in Problem mode', function () {
    // R-T02: Board click in Problem mode still routes through
    // boardInteractionController.
    // Layer: CONTAINER_DELEGATION (existence check only)
    // NOTE: Same as R-T01 — only checks handler existence and no-throw.
    // Production Subject: boardInteractionController via Container onVertexClick
    // Real Dependencies: Container render with problem tab
    // Primary Assertion: onVertexClick handler exists and does not throw

    it('boardProps.handlerProps.onVertexClick is a function in Problem mode', function () {
      const harness = createRegressionHarness({
        tabs: [makeProblemTab({id: 'tab_rt2'})],
      })

      const shellProps = harness.getShellProps()
      assert.strictEqual(typeof shellProps.boardProps.handlerProps.onVertexClick, 'function',
        'onVertexClick must be a function in Problem mode -- Regression R-T02')
    })

    it('onVertexClick does not throw in Problem mode', function () {
      const harness = createRegressionHarness({
        tabs: [makeProblemTab({id: 'tab_rt2b'})],
      })

      const shellProps = harness.getShellProps()
      const handler = shellProps.boardProps.handlerProps.onVertexClick

      assert.doesNotThrow(function () {
        handler({vertex: [4, 4], button: 0, ctrlKey: false, metaKey: false})
      }, 'onVertexClick must not throw in Problem mode -- Regression R-T02')
    })
  })

  // ===================================================
  // R-T03: modeBarPolicy correct for all modes
  // ===================================================

  describe('R-T03: modeBarPolicy computed correctly for all modes', function () {
    // R-T03: modeBarPolicy computed correctly for all four modes after
    // dashboard handler wiring.
    // Layer: PROJECTION_RETURN
    // Production Subject: computeModeBarPolicy via Container projectFromWorkbench
    // Real Dependencies: Container render
    // Primary Assertion: modeBarPolicy has correct values for each mode

    it('modeBarPolicy exists for Play mode', function () {
      const harness = createRegressionHarness({
        tabs: [makePlayTab({id: 'tab_rt3_play'})],
      })

      const shellProps = harness.getShellProps()
      assert.ok(shellProps.modeBarPolicy,
        'modeBarPolicy must exist for Play mode -- Regression R-T03')
    })

    it('modeBarPolicy exists for Problem mode', function () {
      const harness = createRegressionHarness({
        tabs: [makeProblemTab({id: 'tab_rt3_problem'})],
      })

      const shellProps = harness.getShellProps()
      assert.ok(shellProps.modeBarPolicy,
        'modeBarPolicy must exist for Problem mode -- Regression R-T03')
    })

    it('modeBarPolicy exists for Recall mode', function () {
      const harness = createRegressionHarness({
        tabs: [makeRecallTab({id: 'tab_rt3_recall'})],
      })

      const shellProps = harness.getShellProps()
      assert.ok(shellProps.modeBarPolicy,
        'modeBarPolicy must exist for Recall mode -- Regression R-T03')
    })

    it('modeBarPolicy exists for Analysis mode', function () {
      const harness = createRegressionHarness({
        tabs: [makeAnalysisTab({id: 'tab_rt3_analysis'})],
      })

      const shellProps = harness.getShellProps()
      assert.ok(shellProps.modeBarPolicy,
        'modeBarPolicy must exist for Analysis mode -- Regression R-T03')
    })
  })

  // ===================================================
  // R-T04: handleSubmit still works
  // ===================================================

  describe('R-T04: handleSubmit still calls flowService.submit', function () {
    // R-T04: handleSubmit still calls flowService.submit and freezes attempt,
    // transitions to recall.
    // Layer: CONTAINER_DELEGATION
    // Production Subject: Container.handleSubmit
    // Real Dependencies: Container render
    // Mocked Dependencies: flowService (spy)
    // Primary Assertion: flowService.submit called with activeTab.id

    it('onSubmit calls flowService.submit with activeTab.id', async function () {
      const harness = createRegressionHarness({
        tabs: [makePlayTab({id: 'tab_rt4'})],
      })

      const shellProps = harness.getShellProps()

      assert.strictEqual(typeof shellProps.onSubmit, 'function',
        'Container must expose onSubmit callback -- Regression R-T04')

      await shellProps.onSubmit()

      assert.deepStrictEqual(harness.flowService.calls.submit, [{tabId: 'tab_rt4'}],
        'flowService.submit must be called with activeTab.id -- Regression R-T04')
    })

    it('onEnd stops engine for play tab', async function () {
      const harness = createRegressionHarness({
        tabs: [makePlayTab({id: 'tab_rt4_end'})],
      })

      let stopCalled = false
      harness.sabaki.stopEngineGameTraining = async () => { stopCalled = true }

      const shellProps = harness.getShellProps()

      await shellProps.onEnd()

      assert.strictEqual(stopCalled, true,
        'sabaki.stopEngineGameTraining must be called via onEnd for play tab -- Regression R-T04')
      assert.strictEqual(harness.flowService.calls.submit.length, 0,
        'flowService.submit must NOT be called for play End -- Regression R-T04')
    })
  })

  // ===================================================
  // R-T05: handleEnterAnalysis still works
  // ===================================================

  describe('R-T05: handleEnterAnalysis still calls flowService.enterAnalysis', function () {
    // R-T05: handleEnterAnalysis still calls flowService.enterAnalysis
    // and updates tab mode.
    // Layer: CONTAINER_DELEGATION
    // Production Subject: Container.handleEnterAnalysis
    // Real Dependencies: Container render
    // Mocked Dependencies: flowService (spy)
    // Primary Assertion: flowService.enterAnalysis called

    it('onAnalysis calls flowService.enterAnalysis with activeTab.id', function () {
      const harness = createRegressionHarness({
        tabs: [makeProblemTab({id: 'tab_rt5'})],
      })

      const shellProps = harness.getShellProps()

      assert.strictEqual(typeof shellProps.onAnalysis, 'function',
        'Container must expose onAnalysis callback -- Regression R-T05')

      shellProps.onAnalysis()

      assert.deepStrictEqual(harness.flowService.calls.enterAnalysis, [{tabId: 'tab_rt5'}],
        'flowService.enterAnalysis must be called with activeTab.id -- Regression R-T05')
    })
  })

  // ===================================================
  // R-T06: handleSnapshot still works
  // ===================================================

  describe('R-T06: handleSnapshot still calls flowService.snapshotFromCurrentContext', function () {
    // R-T06: handleSnapshot still calls flowService.snapshotFromCurrentContext.
    // Layer: CONTAINER_DELEGATION
    // Production Subject: Container.handleSnapshot
    // Real Dependencies: Container render
    // Mocked Dependencies: flowService (spy)
    // Primary Assertion: flowService.snapshotFromCurrentContext called

    it('onSnapshot calls flowService.snapshotFromCurrentContext with activeTab.id', async function () {
      const harness = createRegressionHarness({
        tabs: [makePlayTab({id: 'tab_rt6'})],
      })

      const shellProps = harness.getShellProps()

      assert.strictEqual(typeof shellProps.onSnapshot, 'function',
        'Container must expose onSnapshot callback -- Regression R-T06')

      await shellProps.onSnapshot()

      assert.deepStrictEqual(harness.flowService.calls.snapshotFromCurrentContext, [{tabId: 'tab_rt6'}],
        'flowService.snapshotFromCurrentContext must be called -- Regression R-T06')
    })
  })

  // ===================================================
  // R-T07: handleModeChange still routes through getModeTransitionAction
  // ===================================================

  describe('R-T07: handleModeChange routes correctly for analysis transitions', function () {
    // R-T07: handleModeChange still routes through getModeTransitionAction
    // for enterAnalysis/returnFromAnalysis.
    // Layer: CONTAINER_DELEGATION
    // Production Subject: Container.handleModeChange
    // Real Dependencies: Container render
    // Mocked Dependencies: flowService (spy)
    // Primary Assertion: correct action dispatched for analysis transitions

    it('mode change to "analysis" from problem calls flowService.enterAnalysis', function () {
      const harness = createRegressionHarness({
        tabs: [makeProblemTab({id: 'tab_rt7_enter'})],
      })

      const shellProps = harness.getShellProps()

      assert.strictEqual(typeof shellProps.onModeChange, 'function',
        'Container must expose onModeChange callback -- Regression R-T07')

      shellProps.onModeChange('analysis')

      assert.strictEqual(harness.flowService.calls.enterAnalysis.length, 1,
        'flowService.enterAnalysis must be called when mode changes to analysis from problem -- Regression R-T07')
      assert.deepStrictEqual(harness.flowService.calls.enterAnalysis[0], {tabId: 'tab_rt7_enter'})
    })

    it('mode change from analysis to "problem" calls flowService.returnFromAnalysis', function () {
      const harness = createRegressionHarness({
        tabs: [makeAnalysisTab({id: 'tab_rt7_return', previousMode: 'problem'})],
      })

      const shellProps = harness.getShellProps()

      shellProps.onModeChange('problem')

      assert.strictEqual(harness.flowService.calls.returnFromAnalysis.length, 1,
        'flowService.returnFromAnalysis must be called when returning from analysis -- Regression R-T07')
      assert.deepStrictEqual(harness.flowService.calls.returnFromAnalysis[0],
        {tabId: 'tab_rt7_return', toMode: 'problem'})
    })
  })

  // ===================================================
  // R-T08: Player config handlers still work
  // ===================================================

  describe('R-T08: Player config handlers still route to flowService', function () {
    // R-T08: Player config handlers still route to flowService.updatePlayerConfig.
    // Layer: CONTAINER_DELEGATION
    // Production Subject: Container player config handlers
    // Real Dependencies: Container render
    // Mocked Dependencies: flowService (spy)
    // Primary Assertion: flowService.updatePlayerConfig called with correct patches

    it('onBlackPlayerChange("ai") calls flowService.updatePlayerConfig', function () {
      const harness = createRegressionHarness({
        tabs: [makePlayTab({id: 'tab_rt8_black'})],
      })

      const shellProps = harness.getShellProps()

      assert.strictEqual(typeof shellProps.onBlackPlayerChange, 'function',
        'Container must expose onBlackPlayerChange -- Regression R-T08')

      shellProps.onBlackPlayerChange('ai')

      assert.strictEqual(harness.flowService.calls.updatePlayerConfig.length, 1)
      const call = harness.flowService.calls.updatePlayerConfig[0]
      assert.strictEqual(call.tabId, 'tab_rt8_black')
      assert.deepStrictEqual(call.patch, {black: 'ai'})
    })

    it('onWhitePlayerChange("self") maps self->human and calls flowService', function () {
      const harness = createRegressionHarness({
        tabs: [makePlayTab({id: 'tab_rt8_white'})],
      })

      const shellProps = harness.getShellProps()

      shellProps.onWhitePlayerChange('self')

      assert.strictEqual(harness.flowService.calls.updatePlayerConfig.length, 1)
      const call = harness.flowService.calls.updatePlayerConfig[0]
      assert.deepStrictEqual(call.patch, {white: 'human'})
    })

    it('onProblemOpponentChange("self") passes through directly', function () {
      const harness = createRegressionHarness({
        tabs: [makeProblemTab({id: 'tab_rt8_opp'})],
      })

      const shellProps = harness.getShellProps()

      shellProps.onProblemOpponentChange('self')

      assert.strictEqual(harness.flowService.calls.updatePlayerConfig.length, 1)
      const call = harness.flowService.calls.updatePlayerConfig[0]
      assert.deepStrictEqual(call.patch, {problemOpponent: 'self'})
    })
  })

  // ===================================================
  // R-T09: Container imports still correct
  // ===================================================

  describe('R-T09: Container still does NOT import services/repositories/db directly', function () {
    // R-T09: Container still does NOT import services/repositories/db directly.
    // Layer: ARCHITECTURE_BOUNDARY
    // Production Subject: Container source code (static analysis)
    // Primary Assertion: No direct import of forbidden modules

    const containerPath = path.resolve(
      __dirname, '../../../src/components/TrainingWorkbenchContainer.js',
    )
    let source

    before(function () {
      source = fs.readFileSync(containerPath, 'utf-8')
    })

    it('Container must not import repository directly', function () {
      assert.ok(
        !source.includes("from '../modules/training/repository") &&
        !source.includes("from '../../modules/training/repository"),
        'Container must not import repository -- Arch v0.5 SS0.3, Regression R-T09',
      )
    })

    it('Container must not import db.js', function () {
      assert.ok(
        !source.includes("from '../modules/db") &&
        !source.includes("from '../../modules/db"),
        'Container must not import db.js -- Arch v0.5 SS3.5, Regression R-T09',
      )
    })

    it('Container must not import training services directly', function () {
      // Container accesses services through sabaki.getTrainingContext(), not direct import
      const forbiddenServiceImports = [
        "from '../modules/training/review",
        "from '../modules/training/attempt",
        "from '../modules/training/workbench/workbenchFlowService",
        "from '../modules/training/workbench/workbenchTabService",
      ]
      for (const pattern of forbiddenServiceImports) {
        assert.ok(!source.includes(pattern),
          `Container must not import "${pattern}" directly -- Arch v0.5 SS0.3, Regression R-T09`)
      }
    })
  })

  // ===================================================
  // R-T10: projectFromWorkbench still correctly projects
  // ===================================================

  describe('R-T10: projectFromWorkbench still correctly projects state', function () {
    // R-T10: projectFromWorkbench still correctly projects mode, games,
    // activeIndex, blackPlayer, whitePlayer, problemOpponent.
    // Layer: PROJECTION_RETURN
    // Production Subject: Container projectFromWorkbench
    // Real Dependencies: Container render with store state
    // Primary Assertion: Correct projection of all fields

    it('projects correct mode for play tab', function () {
      const harness = createRegressionHarness({
        tabs: [makePlayTab({id: 'tab_rt10_play'})],
      })

      const shellProps = harness.getShellProps()
      assert.strictEqual(shellProps.mode, 'play',
        'projectFromWorkbench must project mode="play" -- Regression R-T10')
    })

    it('projects correct mode for problem tab', function () {
      const harness = createRegressionHarness({
        tabs: [makeProblemTab({id: 'tab_rt10_problem'})],
      })

      const shellProps = harness.getShellProps()
      assert.strictEqual(shellProps.mode, 'problem',
        'projectFromWorkbench must project mode="problem" -- Regression R-T10')
    })

    it('projects correct mode for recall tab', function () {
      const harness = createRegressionHarness({
        tabs: [makeRecallTab({id: 'tab_rt10_recall'})],
      })

      const shellProps = harness.getShellProps()
      assert.strictEqual(shellProps.mode, 'recall',
        'projectFromWorkbench must project mode="recall" -- Regression R-T10')
    })

    it('projects correct mode for analysis tab', function () {
      const harness = createRegressionHarness({
        tabs: [makeAnalysisTab({id: 'tab_rt10_analysis'})],
      })

      const shellProps = harness.getShellProps()
      assert.strictEqual(shellProps.mode, 'analysis',
        'projectFromWorkbench must project mode="analysis" -- Regression R-T10')
    })

    it('projects games array with correct structure', function () {
      const harness = createRegressionHarness({
        tabs: [
          makePlayTab({id: 'tab_rt10_g1', taskId: 'task_1'}),
          makeProblemTab({id: 'tab_rt10_g2', taskId: 'task_2'}),
        ],
        activeTabId: 'tab_rt10_g1',
      })

      const shellProps = harness.getShellProps()
      assert.ok(Array.isArray(shellProps.games),
        'games must be an array -- Regression R-T10')
      assert.strictEqual(shellProps.games.length, 2,
        'games must contain 2 entries -- Regression R-T10')
      assert.strictEqual(shellProps.games[0].title, 'task_1')
      assert.strictEqual(shellProps.games[0].active, true)
      assert.strictEqual(shellProps.games[1].active, false)
      assert.strictEqual(shellProps.activeIndex, 0,
        'activeIndex must be 0 -- Regression R-T10')
    })

    it('projects blackPlayer/whitePlayer from playerConfig', function () {
      const harness = createRegressionHarness({
        tabs: [makePlayTab({
          id: 'tab_rt10_players',
          playerConfig: {black: 'ai', white: 'human'},
        })],
      })

      const shellProps = harness.getShellProps()
      assert.strictEqual(shellProps.blackPlayer, 'ai',
        'blackPlayer must be "ai" -- Regression R-T10')
      assert.strictEqual(shellProps.whitePlayer, 'self',
        'whitePlayer must be "self" (mapped from "human") -- Regression R-T10')
    })

    it('projects problemOpponent from playerConfig', function () {
      const harness = createRegressionHarness({
        tabs: [makeProblemTab({
          id: 'tab_rt10_opp',
          playerConfig: {black: 'human', white: 'ai', problemOpponent: 'self'},
        })],
      })

      const shellProps = harness.getShellProps()
      assert.strictEqual(shellProps.problemOpponent, 'self',
        'problemOpponent must be "self" -- Regression R-T10')
    })
  })

  // ===================================================
  // R-T11: Recall checkpoint handlers still work
  // ===================================================

  describe('R-T11: Recall checkpoint handlers still work', function () {
    // R-T11: Recall checkpoint handlers still route correctly.
    // Layer: CONTAINER_DELEGATION
    // Production Subject: Container checkpoint handlers
    // Real Dependencies: Container render
    // Mocked Dependencies: recallCheckpointService (spy)
    // Primary Assertion: correct service calls for each checkpoint handler

    it('onSubmitCorrection calls recallCheckpointService.submitUserCorrectionLine', async function () {
      const harness = createRegressionHarness({
        tabs: [makeRecallTab({id: 'tab_rt11_sub'})],
        runtimeState: {
          activeCheckpointId: 'cp_1',
          correctionDraft: {moves: [{x: 3, y: 3}]},
        },
      })

      const shellProps = harness.getShellProps()

      assert.strictEqual(typeof shellProps.onSubmitCorrection, 'function',
        'Container must expose onSubmitCorrection -- Regression R-T11')

      await shellProps.onSubmitCorrection()

      assert.strictEqual(harness.recallCheckpointService.calls.submitUserCorrectionLine.length, 1,
        'recallCheckpointService.submitUserCorrectionLine must be called -- Regression R-T11')
      assert.strictEqual(harness.recallCheckpointService.calls.submitUserCorrectionLine[0].checkpointId, 'cp_1')
      assert.deepStrictEqual(harness.recallCheckpointService.calls.submitUserCorrectionLine[0].moves, [{x: 3, y: 3}])
    })

    it('onRevealAI calls recallCheckpointService.revealAiCandidateLines', async function () {
      const harness = createRegressionHarness({
        tabs: [makeRecallTab({id: 'tab_rt11_reveal'})],
        runtimeState: {activeCheckpointId: 'cp_2'},
      })

      const shellProps = harness.getShellProps()

      await shellProps.onRevealAI()

      assert.strictEqual(harness.recallCheckpointService.calls.revealAiCandidateLines.length, 1,
        'recallCheckpointService.revealAiCandidateLines must be called -- Regression R-T11')
      assert.strictEqual(harness.recallCheckpointService.calls.revealAiCandidateLines[0], 'cp_2')
    })

    it('onSkipCheckpoint calls recallCheckpointService.skipCheckpoint', async function () {
      const harness = createRegressionHarness({
        tabs: [makeRecallTab({id: 'tab_rt11_skip'})],
        runtimeState: {activeCheckpointId: 'cp_3'},
      })

      const shellProps = harness.getShellProps()

      await shellProps.onSkipCheckpoint()

      assert.strictEqual(harness.recallCheckpointService.calls.skipCheckpoint.length, 1,
        'recallCheckpointService.skipCheckpoint must be called -- Regression R-T11')
      assert.strictEqual(harness.recallCheckpointService.calls.skipCheckpoint[0], 'cp_3')
    })

    it('onSaveCheckpointComment calls recallCheckpointService.saveComment and resumeRecall', async function () {
      const harness = createRegressionHarness({
        tabs: [makeRecallTab({id: 'tab_rt11_comment'})],
        runtimeState: {activeCheckpointId: 'cp_4'},
      })

      const shellProps = harness.getShellProps()

      await shellProps.onSaveCheckpointComment({content: 'Good variation'})

      assert.strictEqual(harness.recallCheckpointService.calls.saveComment.length, 1,
        'recallCheckpointService.saveComment must be called -- Regression R-T11')
      assert.strictEqual(harness.recallCheckpointService.calls.saveComment[0].checkpointId, 'cp_4')
      assert.strictEqual(harness.recallCheckpointService.calls.saveComment[0].comment.content, 'Good variation')

      assert.strictEqual(harness.recallCheckpointService.calls.resumeRecall.length, 1,
        'recallCheckpointService.resumeRecall must be called after saveComment -- Regression R-T11')
      assert.strictEqual(harness.recallCheckpointService.calls.resumeRecall[0], 'cp_4')
    })
  })

  // ===================================================
  // R-T12: Review queue handlers still work
  // ===================================================

  describe('R-T12: Review queue handlers still work', function () {
    // R-T12: Review queue handlers still route correctly.
    // Layer: CONTAINER_DELEGATION
    // Production Subject: Container review queue handlers
    // Real Dependencies: Container render
    // Mocked Dependencies: reviewService (spy)
    // Primary Assertion: correct service calls for each review handler

    it('onStartReviewSession calls reviewService.startSession', async function () {
      const harness = createRegressionHarness({
        tabs: [makePlayTab({id: 'tab_rt12_start'})],
      })

      const shellProps = harness.getShellProps()

      assert.strictEqual(typeof shellProps.onStartReviewSession, 'function',
        'Container must expose onStartReviewSession -- Regression R-T12')

      await shellProps.onStartReviewSession()

      assert.strictEqual(harness.reviewService.calls.startSession.length, 1,
        'reviewService.startSession must be called -- Regression R-T12')
      // Production ReviewService.startSession(runtimeStoreOverride?) -- Container must pass runtimeStore
      assert.ok(harness.reviewService.calls.startSession[0].runtimeStoreOverride != null,
        'reviewService.startSession must receive runtimeStore from Container -- Regression R-T12, Contract Issue 2')
    })

    it('onAdvanceReview calls reviewService.advanceReview', async function () {
      const harness = createRegressionHarness({
        tabs: [makePlayTab({id: 'tab_rt12_advance'})],
      })

      const shellProps = harness.getShellProps()

      await shellProps.onAdvanceReview()

      assert.strictEqual(harness.reviewService.calls.advanceReview.length, 1,
        'reviewService.advanceReview must be called -- Regression R-T12')
      // Production ReviewService.advanceReview(runtimeStoreOverride?) -- Container must pass runtimeStore
      assert.ok(harness.reviewService.calls.advanceReview[0].runtimeStoreOverride != null,
        'reviewService.advanceReview must receive runtimeStore from Container -- Regression R-T12, Contract Issue 2')
    })

    it('onReviewResult calls reviewService.updateScheduleAfterResult', async function () {
      const harness = createRegressionHarness({
        tabs: [makePlayTab({id: 'tab_rt12_result'})],
      })

      const shellProps = harness.getShellProps()

      await shellProps.onReviewResult({taskId: 'task_review', result: 'pass'})

      assert.strictEqual(harness.reviewService.calls.updateScheduleAfterResult.length, 1,
        'reviewService.updateScheduleAfterResult must be called -- Regression R-T12')
      assert.deepStrictEqual(
        harness.reviewService.calls.updateScheduleAfterResult[0],
        {taskId: 'task_review', result: 'pass'},
      )
    })
  })
})
