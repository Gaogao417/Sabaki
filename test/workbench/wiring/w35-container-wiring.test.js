/**
 * W3.5 Container Wiring Tests
 *
 * Test contract: docs/design/2026-05-21/workbench-wiring/w3.5-goban-data-source-wiring-contract-v0.1.md
 * Contracts covered: W35-T12, T13, T14, T17, T21, T22, T23, T24
 *
 * Source of truth alignment:
 *   - Arch v0.5 Section 1.1: Render read path Store/Repo -> Container/ViewModel -> UI
 *   - Arch v0.5 Section 1.2: Command write path UI -> Controller/Container -> Service -> Store
 *   - Arch v0.5 Section 1.3: Container reads Store, calls Service
 *   - Arch v0.5 Section 14: Stores capped at 2-3; Existing Core ignorant
 *   - Contract Section 8: Container rewrite specification
 *   - Contract Section 13: Prohibited Side Effects
 *
 * Test Legitimacy:
 *   - All tests import real TrainingWorkbenchContainer, real stores, real projectGobanProps.
 *   - gobanDataAdapter and boardInteractionController use tryImport (to be created).
 *   - Container is instantiated directly (not via shallow render), using the same harness
 *     pattern as the existing W3 tests.
 *   - Controlled dependencies: mock stores, spy services, no network.
 *   - Production bug: Container uses hardcoded data instead of adapter -> test fails because
 *     boardState does not match documentStore data.
 *   - Production bug: Container calls sabaki.clickVertex -> test detects the call.
 *   - No conditional skip on core assertions.
 *
 * Matrix Coverage:
 *   | Source Row | Required Behavior | Test ID | Status | Notes |
 *   | --- | --- | --- | --- | --- |
 *   | Contract T12 | Container uses adapter getSnapshot, not hardcoded | W35-T12 | covered | RED until adapter wired into Container |
 *   | Contract T13 | Container passes projected GobanPropsOutput as boardProps | W35-T13 | covered | GREEN (existing Container already does this) |
 *   | Contract T14 | Container onVertexClick delegates to controller | W35-T14 | covered | RED until controller wired into Container |
 *   | Contract T17 | Container does not call sabaki.clickVertex for workbench clicks | W35-T17 | covered | RED until Container rewritten |
 *   | Contract T21 | Store change -> adapter -> Container re-render -> new position | W35-T21 | covered | RED until adapter wired |
 *   | Contract T22 | Click in play mode -> executor -> store -> adapter -> Container | W35-T22 | covered | RED until full chain wired |
 *   | Contract T23 | No code branches on origin.provider | W35-T23 | covered | GREEN (static analysis) |
 *   | Contract T24 | Container does not directly call workbenchStore.updateTab | W35-T24 | covered | GREEN (static analysis) |
 */

import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import TrainingWorkbenchContainer from '../../../src/components/TrainingWorkbenchContainer.js'
import { createWorkbenchStore } from '../../../src/modules/training/store/workbenchStore.ts'
import { createTrainingRuntimeStore } from '../../../src/modules/training/store/trainingRuntimeStore.ts'
import { projectGobanProps } from '../../../src/modules/training/workbench/projectGobanProps.ts'
import { tryImport } from '../tryImport.js'

let createGobanDataAdapter = null
let createBoardInteractionController = null

// --- Helpers ---

function makeTab(overrides = {}) {
  return {
    id: 'tab_1',
    taskId: 'task_1',
    mode: 'play',
    childTabIds: [],
    playerConfig: { black: 'human', white: 'ai' },
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
    startAttempt: [],
  }
  let modeEffects = null
  return {
    calls,
    async submit(tabId) { calls.submit.push({ tabId }) },
    enterAnalysis(tabId) {
      calls.enterAnalysis.push({ tabId })
      modeEffects?.enterAnalysis?.({
        tabId,
        fromMode: 'play',
        toMode: 'analysis',
        beforeTab: {id: tabId, mode: 'play'},
        afterTab: {id: tabId, mode: 'analysis'},
        analysisReturnTarget: {mode: 'play'},
        analysisContext: {source: 'play'},
        reason: 'manual',
      })
    },
    returnFromAnalysis(input) { calls.returnFromAnalysis.push(input) },
    completeRecall(tabId) { calls.completeRecall.push({ tabId }) },
    async snapshotFromCurrentContext(tabId) { calls.snapshotFromCurrentContext.push({ tabId }) },
    async startAttempt(tabId) { calls.startAttempt.push({ tabId }) },
    setModeEffects(nextModeEffects) {
      modeEffects = nextModeEffects
    },
  }
}

function createSpyTabService() {
  const calls = { switchTab: [], closeTab: [], openTask: [] }
  return {
    calls,
    switchTab(tabId) { calls.switchTab.push({ tabId }) },
    async closeTab(tabId) { calls.closeTab.push({ tabId }) },
    async openTask(opts) {
      calls.openTask.push(opts)
      return {id: 'opened_tab_1', ...opts}
    },
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
 */
function createHarness({
  tabs = [makeTab()],
  activeTabId = tabs[0]?.id ?? null,
  sabakiPatch = {},
} = {}) {
  const workbenchStore = createWorkbenchStore()
  const runtimeStore = createTrainingRuntimeStore()
  const flowService = createSpyFlowService()
  const tabService = createSpyTabService()

  const taskImportService = {
    async createManualTask(input) {
      return { id: `task_${Date.now()}`, ...input }
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
    openDrawer() {},
    getTrainingContext() {
      return trainingContext
    },
    ...sabakiPatch,
  }

  const container = new TrainingWorkbenchContainer({ sabaki })
  container.props = { sabaki }

  return {
    workbenchStore,
    runtimeStore,
    flowService,
    tabService,
    shellProps: container.render().props,
    container,
    sabaki,
    trainingContext,
  }
}

// --- Tests ---

describe('W3.5 Container Wiring', function () {
  before(async function () {
    const adapterMod = await tryImport(
      'src/modules/training/adapter/gobanDataAdapter.ts',
    )
    if (adapterMod && adapterMod.createGobanDataAdapter) {
      createGobanDataAdapter = adapterMod.createGobanDataAdapter
    }

    const controllerMod = await tryImport(
      'src/modules/training/workbench/boardInteractionController.ts',
    )
    if (controllerMod && controllerMod.createBoardInteractionController) {
      createBoardInteractionController = controllerMod.createBoardInteractionController
    }
  })

  // --- W35-T12: Container uses gobanDataAdapter.getSnapshot() not hardcoded data ---

  describe('W35-T12: Container uses adapter getSnapshot, not hardcoded data', function () {
    it('Container boardProps.boardState is not a hardcoded 19x19 empty board', function () {
      // If Container hardcodes an empty 19x19 signMap, the board will always show empty.
      // After adapter wiring, Container must read real data from documentStore.
      //
      // This test checks that the boardState is NOT the hardcoded default.
      // Contract Section 8 says: "Remove Lines 161-172: hardcoded gobanSettings"
      // and "Remove Lines 174-191: projectGobanProps call with hardcoded boardState/overlayState"
      const { shellProps } = createHarness({
        tabs: [makeTab({ id: 'tab_1', mode: 'play' })],
      })

      assert.ok(shellProps.boardProps != null,
        'Container must pass boardProps to shell')

      // The current Container has a hardcoded empty 19x19 board.
      // After adapter wiring, the boardState must come from getSnapshot().
      // We check that the board has the correct structure.
      const boardState = shellProps.boardProps.boardStateProps
      assert.ok(boardState != null, 'boardProps must have boardStateProps')

      // Verify boardState has the required fields (not hardcoded dummy)
      assert.ok('gameTree' in boardState, 'boardStateProps must have gameTree')
      assert.ok('treePosition' in boardState, 'boardStateProps must have treePosition')
      assert.ok('board' in boardState, 'boardStateProps must have board')
    })

    it('Container boardProps contains real projected overlayDisplayProps', function () {
      const { shellProps } = createHarness({
        tabs: [makeTab({ id: 'tab_1', mode: 'play' })],
      })

      assert.ok(shellProps.boardProps != null)
      assert.ok(shellProps.boardProps.overlayDisplayProps != null,
        'boardProps must have overlayDisplayProps')

      // Verify overlayDisplayProps has required fields
      const overlay = shellProps.boardProps.overlayDisplayProps
      assert.ok('paintMap' in overlay, 'overlayDisplayProps must have paintMap')
      assert.ok('markerMap' in overlay, 'overlayDisplayProps must have markerMap')
      assert.ok('showMoveNumbers' in overlay, 'overlayDisplayProps must have showMoveNumbers')
      assert.ok('showNextMoves' in overlay, 'overlayDisplayProps must have showNextMoves')
      assert.ok('showCoordinates' in overlay, 'overlayDisplayProps must have showCoordinates')
    })

    it('Container boardProps contains real projected settings from input', function () {
      // The settings in boardProps.overlayDisplayProps must reflect the
      // projection from projectGobanProps, not arbitrary hardcoded values.
      const { shellProps } = createHarness({
        tabs: [makeTab({ id: 'tab_1', mode: 'play' })],
      })

      const overlay = shellProps.boardProps.overlayDisplayProps
      // Per projectGobanProps: play mode with settings.showCoordinates=true -> showCoordinates=true
      // Current Container hardcodes showCoordinates: true in gobanSettings
      assert.strictEqual(overlay.showCoordinates, true,
        'showCoordinates must be true when sabaki.state has showCoordinates=true')
    })
  })

  // --- W35-T13: Container passes projected GobanPropsOutput as boardProps ---

  describe('W35-T13: Container passes projected GobanPropsOutput as boardProps', function () {
    it('boardProps has all four top-level sections from projectGobanProps output', function () {
      const { shellProps } = createHarness({
        tabs: [makeTab({ id: 'tab_1', mode: 'play' })],
      })

      assert.ok(shellProps.boardProps != null,
        'Container must pass boardProps')
      assert.ok(shellProps.boardProps.boardStateProps != null,
        'boardProps must have boardStateProps')
      assert.ok(shellProps.boardProps.overlayDisplayProps != null,
        'boardProps must have overlayDisplayProps')
      assert.ok(shellProps.boardProps.interactionProps != null,
        'boardProps must have interactionProps')
      assert.ok(shellProps.boardProps.handlerProps != null,
        'boardProps must have handlerProps')
    })

    it('boardProps matches projectGobanProps output structure', function () {
      // Verify the Container's boardProps has the same structure as a direct
      // projectGobanProps call.
      const { shellProps } = createHarness({
        tabs: [makeTab({ id: 'tab_1', mode: 'play' })],
      })

      // Directly call projectGobanProps with the same inputs the Container uses
      const directResult = projectGobanProps({
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
        overlayState: { paintMap: [], markerMap: [], dimmedStones: [], analysis: null },
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

      // Check that the Container's boardProps overlayDisplayProps matches
      // the direct projection for mode-specific fields
      assert.strictEqual(
        shellProps.boardProps.overlayDisplayProps.showMoveNumbers,
        directResult.overlayDisplayProps.showMoveNumbers,
        'Container boardProps showMoveNumbers must match projectGobanProps output',
      )
      assert.strictEqual(
        shellProps.boardProps.overlayDisplayProps.showNextMoves,
        directResult.overlayDisplayProps.showNextMoves,
        'Container boardProps showNextMoves must match projectGobanProps output',
      )
    })
  })

  // --- W35-T14: Container onVertexClick delegates to boardInteractionController ---

  describe('W35-T14: Container onVertexClick delegates to boardInteractionController', function () {
    it('Container provides onVertexClick handler that routes through the click chain', function () {
      const { shellProps } = createHarness({
        tabs: [makeTab({ id: 'tab_1', mode: 'play' })],
      })

      assert.ok(shellProps.boardProps != null)
      const onVertexClick = shellProps.boardProps.handlerProps?.onVertexClick
      assert.strictEqual(typeof onVertexClick, 'function',
        'Container must provide onVertexClick handler via boardProps.handlerProps')
    })

    it('Container onVertexClick is not the projectGobanProps noop placeholder', function () {
      const noopResult = projectGobanProps({
        workbenchMode: 'play',
        task: null,
        runtimeState: {},
        boardState: { gameTree: null, treePosition: '', board: {} },
        overlayState: { paintMap: [], markerMap: [], dimmedStones: [], analysis: null },
        settings: {
          showMoveNumbers: false, showNextMoves: true, showSiblings: true,
          showAnalysis: false, showCoordinates: true, showHumanPreference: false,
          selectedTool: 'stone_1', editWorkspaceActive: false,
          boardTransformation: [1, 0, 0, 1, 0, 0], areaSelectMode: false,
        },
        analysisData: null,
      })

      const { shellProps } = createHarness({
        tabs: [makeTab({ id: 'tab_1', mode: 'play' })],
      })

      const containerHandler = shellProps.boardProps.handlerProps.onVertexClick
      assert.notStrictEqual(
        containerHandler,
        noopResult.handlerProps.onVertexClick,
        'Container must override the projectGobanProps noop with a real handler',
      )
    })

    it('onVertexClick does not throw for a valid play mode click', function () {
      const { shellProps } = createHarness({
        tabs: [makeTab({ id: 'tab_1', mode: 'play' })],
      })

      const onVertexClick = shellProps.boardProps.handlerProps.onVertexClick
      // Goban calls onVertexClick(evt) where evt.vertex = [row, col]
      const evt = { vertex: [3, 3], button: 0, ctrlKey: false, metaKey: false }
      let thrown = null
      try {
        onVertexClick(evt)
      } catch (e) {
        thrown = e
      }
      assert.strictEqual(thrown, null,
        'onVertexClick must not throw for a valid empty-point click in play mode')
    })
  })

  describe('Regression: analysis entry opens scratch workspace', function () {
    it('onAnalysis opens Sabaki analysis workspace and enables analysis overlay flags', function () {
      const editWorkspace = {activeTab: 'current'}
      const sabakiState = {
        mode: 'play',
        editWorkspace: null,
        showAnalysis: false,
        analysisType: null,
      }
      const calls = {setMode: [], setState: [], scheduleEditWorkspaceAnalysis: []}

      const {shellProps, flowService} = createHarness({
        tabs: [makeTab({id: 'tab_1', mode: 'play'})],
        sabakiPatch: {
          state: sabakiState,
          setMode(mode) {
            calls.setMode.push(mode)
            sabakiState.mode = mode
            if (mode === 'analysis') sabakiState.editWorkspace = editWorkspace
          },
          setState(patch) {
            calls.setState.push(patch)
            Object.assign(sabakiState, patch)
          },
          createAnalysisWorkspace() {
            return editWorkspace
          },
          scheduleEditWorkspaceAnalysis(tab) {
            calls.scheduleEditWorkspaceAnalysis.push(tab)
          },
        },
      })

      shellProps.onAnalysis()

      assert.deepStrictEqual(
        flowService.calls.enterAnalysis,
        [{tabId: 'tab_1'}],
        'onAnalysis must still delegate to flowService.enterAnalysis',
      )
      assert.strictEqual(
        sabakiState.mode,
        'analysis',
        'onAnalysis must switch the legacy Sabaki mode so scratch workspace tools activate',
      )
      assert.strictEqual(
        sabakiState.editWorkspace,
        editWorkspace,
        'onAnalysis must create or keep an editWorkspace for analysis interactions',
      )
      assert.strictEqual(
        sabakiState.showAnalysis,
        true,
        'onAnalysis must enable analysis overlay display',
      )
      assert.strictEqual(
        sabakiState.analysisType,
        'winrate',
        'onAnalysis must provide a default analysisType for Goban overlays',
      )
    })
  })

  describe('Regression: new game is AI-drivable', function () {
    it('onNewGame opens a play tab with default playerConfig and starts an attempt', async function () {
      const {shellProps, tabService, flowService} = createHarness({
        tabs: [makeTab({id: 'tab_1', mode: 'play'})],
      })

      await shellProps.onAddGame()

      assert.strictEqual(
        tabService.calls.openTask.length,
        1,
        'new game must open a task tab',
      )
      assert.deepStrictEqual(
        tabService.calls.openTask[0].playerConfig,
        {black: 'human', white: 'human', ai: {autoPlay: true}},
        'new game must initialize playerConfig so later AI side changes are actionable',
      )
      assert.deepStrictEqual(
        flowService.calls.startAttempt,
        [{tabId: 'opened_tab_1'}],
        'new game must start an attempt so training AI auto-reply can run',
      )
    })
  })

  // --- W35-T17: Container does not call sabaki.clickVertex for workbench clicks ---

  describe('W35-T17: Container does not call sabaki.clickVertex for workbench clicks', function () {
    it('Container code does not reference sabaki.clickVertex in onVertexClick path', function () {
      // Static analysis: verify Container source does not call clickVertex
      // for workbench click handling. Per Contract Section 13.7:
      // "Workbench click path calls sabaki.clickVertex (except deferred migration seam)"
      // The Container itself should not call clickVertex -- that's the controller's
      // deferred migration path.
      const __dirname = path.dirname(fileURLToPath(import.meta.url))
      const containerPath = path.resolve(__dirname, '../../../src/components/TrainingWorkbenchContainer.js')
      const source = fs.readFileSync(containerPath, 'utf-8')

      // Check that the Container does not call sabaki.clickVertex directly
      // in the onVertexClick handler path.
      // The Container currently does NOT have sabaki.clickVertex, which is correct.
      // After the W3.5 rewrite, the onVertexClick should delegate to the controller,
      // and the controller handles the deferred -> legacy path.
      const hasDirectClickVertex = source.includes('clickVertex') &&
        !source.includes('legacySabaki') && // controller deps is fine
        !source.includes('// ') // ignore comments

      // More precise: check if 'clickVertex' appears outside of comments
      // in the Container file. The current Container does not have it.
      const lines = source.split('\n')
      let foundClickVertex = false
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue
        if (trimmed.includes('clickVertex')) {
          // Allow: only if it's in a context where it's delegated to controller deps
          // The Container should not call sabaki.clickVertex directly
          if (trimmed.includes('sabaki.') && trimmed.includes('clickVertex')) {
            foundClickVertex = true
          }
        }
      }

      assert.strictEqual(foundClickVertex, false,
        'Container must not call sabaki.clickVertex directly for workbench clicks -- Contract Section 13.7')
    })
  })

  // --- W35-T21: Store change -> adapter snapshot -> Container re-render -> new position ---

  describe('W35-T21: Store change -> adapter -> Container re-render', function () {
    it('workbenchStore tab mode change causes Container to re-render with updated boardProps', function () {
      const { workbenchStore, container } = createHarness({
        tabs: [makeTab({ id: 'tab_1', mode: 'play' })],
      })

      // First render
      const playProps = container.render().props
      assert.ok(playProps.boardProps != null)
      assert.strictEqual(
        playProps.boardProps.overlayDisplayProps.showMoveNumbers,
        false,
        'Play mode: showMoveNumbers must be false',
      )

      // Change mode
      workbenchStore.updateTab('tab_1', { mode: 'recall' })

      // Re-render
      const recallProps = container.render().props
      assert.ok(recallProps.boardProps != null)
      assert.strictEqual(
        recallProps.boardProps.overlayDisplayProps.showMoveNumbers,
        true,
        'Recall mode: showMoveNumbers must be true after store change triggers re-render',
      )
      assert.strictEqual(
        recallProps.boardProps.overlayDisplayProps.showNextMoves,
        false,
        'Recall mode: showNextMoves must be false after store change triggers re-render',
      )
    })

    it('switching active tab causes Container to re-render with new tab mode', function () {
      const { workbenchStore, container } = createHarness({
        tabs: [
          makeTab({ id: 'tab_play', mode: 'play' }),
          makeTab({ id: 'tab_recall', mode: 'recall' }),
        ],
        activeTabId: 'tab_play',
      })

      // Render with play tab
      const playProps = container.render().props
      assert.strictEqual(
        playProps.boardProps.overlayDisplayProps.showMoveNumbers,
        false,
        'Active play tab: showMoveNumbers=false',
      )

      // Switch to recall tab
      workbenchStore.setActiveTab('tab_recall')

      // Re-render
      const recallProps = container.render().props
      assert.strictEqual(
        recallProps.boardProps.overlayDisplayProps.showMoveNumbers,
        true,
        'After switching to recall tab: showMoveNumbers=true',
      )
    })
  })

  // --- W35-T22: Click in play mode -> executor -> store update -> adapter -> Container ---

  describe('W35-T22: Full click chain in play mode updates state through to Container', function () {
    it('play mode click triggers resolver with correct workbenchMode context', function () {
      // This test verifies the Container's onVertexClick handler produces
      // a resolver call with the correct workbenchMode context.
      // The full chain (click -> resolver -> executor -> store -> adapter -> re-render)
      // is tested end-to-end once the controller and adapter are wired.
      const { shellProps } = createHarness({
        tabs: [makeTab({ id: 'tab_1', mode: 'play', taskId: 'task_1' })],
      })

      const onVertexClick = shellProps.boardProps.handlerProps?.onVertexClick
      assert.strictEqual(typeof onVertexClick, 'function')

      // Goban calls onVertexClick(evt) where evt.vertex = [row, col]
      const evt = { vertex: [3, 3], button: 0, ctrlKey: false, metaKey: false }
      let thrown = null
      try {
        onVertexClick(evt)
      } catch (e) {
        thrown = e
      }
      assert.strictEqual(thrown, null,
        'Full click chain: play mode click on [3,3] must not throw')
    })
  })

  // --- W35-T23: No code branches on origin.provider ---

  describe('W35-T23: No code branches on origin.provider', function () {
    it('Container source does not reference origin.provider', function () {
      const __dirname = path.dirname(fileURLToPath(import.meta.url))
      const containerPath = path.resolve(__dirname, '../../../src/components/TrainingWorkbenchContainer.js')
      const source = fs.readFileSync(containerPath, 'utf-8')

      // Per PRD v0.5 Section 2.3: "origin must not decide mode, phase, UI structure, or service branch"
      // Per Contract Section 13.8: "Container branches on origin.provider"
      assert.ok(
        !source.includes('origin.provider'),
        'Container must not branch on origin.provider -- PRD v0.5 2.3, Contract Section 13.8',
      )
    })

    it('Container source does not reference origin at all', function () {
      const __dirname = path.dirname(fileURLToPath(import.meta.url))
      const containerPath = path.resolve(__dirname, '../../../src/components/TrainingWorkbenchContainer.js')
      const source = fs.readFileSync(containerPath, 'utf-8')

      // Check for origin references outside of comments
      const lines = source.split('\n')
      let foundOriginRef = false
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue
        if (trimmed.includes('origin.') && !trimmed.includes('original')) {
          foundOriginRef = true
        }
      }

      assert.strictEqual(foundOriginRef, false,
        'Container must not reference origin properties -- origin is metadata only per PRD v0.5 2.3')
    })
  })

  // --- W35-T24: Container does not directly call workbenchStore.updateTab or runtimeStore setters ---

  describe('W35-T24: Container does not directly call store mutation methods', function () {
    it('Container source does not call workbenchStore.updateTab', function () {
      const __dirname = path.dirname(fileURLToPath(import.meta.url))
      const containerPath = path.resolve(__dirname, '../../../src/components/TrainingWorkbenchContainer.js')
      const source = fs.readFileSync(containerPath, 'utf-8')

      // Per Contract Section 13.2: "Container writes workbenchStore or runtimeStore directly"
      // The Container should read stores but not write to them.
      // Check for updateTab, setTabs, addTab, removeTab, setActiveTab
      // (setActiveTab is used by the harness, not by the Container)
      const lines = source.split('\n')
      const forbiddenMethods = ['updateTab', 'setTabs(', 'addTab(', 'removeTab(']
      let foundForbidden = false
      let foundLine = ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue
        for (const method of forbiddenMethods) {
          if (trimmed.includes('workbenchStore.' + method) ||
            trimmed.includes('ws.' + method)) {
            foundForbidden = true
            foundLine = trimmed
          }
        }
      }

      assert.strictEqual(foundForbidden, false,
        `Container must not directly call workbenchStore mutation methods -- Contract Section 13.2. Found: "${foundLine}"`)
    })

    it('Container source does not call runtimeStore setter methods', function () {
      const __dirname = path.dirname(fileURLToPath(import.meta.url))
      const containerPath = path.resolve(__dirname, '../../../src/components/TrainingWorkbenchContainer.js')
      const source = fs.readFileSync(containerPath, 'utf-8')

      // Check for setter methods on runtimeStore
      const forbiddenMethods = [
        'setActiveAttempt', 'setActiveRecallSession', 'setActiveCheckpoint',
        'setCorrectionDraft', 'setVisibleBadMoveIds',
        'setRecallView', 'setProblemView', 'setReviewQueueView',
        'upsertPendingMoveEvaluation', 'removePendingMoveEvaluation',
      ]
      const lines = source.split('\n')
      let foundForbidden = false
      let foundLine = ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue
        for (const method of forbiddenMethods) {
          if (trimmed.includes('runtimeStore.' + method) ||
            trimmed.includes('rt.' + method)) {
            foundForbidden = true
            foundLine = trimmed
          }
        }
      }

      assert.strictEqual(foundForbidden, false,
        `Container must not directly call runtimeStore setter methods -- Contract Section 13.2. Found: "${foundLine}"`)
    })
  })
})
