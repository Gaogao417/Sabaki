/**
 * W8-P3 Task 4 Wiring Tests -- Play/Problem Action Buttons
 *
 * Test contract: docs/design/2026-05-21/w8-p3/task4-play-problem-actions-contract.md
 * Contracts covered: T4-01 through T4-20, T4-GAP (21 test rows)
 *
 * Source of truth alignment:
 *   - PRD v0.5 SS2.2: Play Mode: Submit ends current game
 *   - PRD v0.5 SS2.4: Problem Mode: Submit submits answer
 *   - PRD v0.5 SS3.4: Analysis Mode: can enter from Play/Problem
 *   - PRD v0.5 SS5.5: Snapshot: captureSnapshotInput -> createTask -> openTask
 *   - PRD v0.5 SS6.6: Play top: [New Game] [Settings] [End] [Resign]
 *   - PRD v0.5 SS6.6: Problem top: [Submit Answer] [Abandon] [Settings] [Enter Analysis]
 *   - PRD v0.5 SS10: Play bottom: [Undo] [Pass] [Resign] [End] [Mark Doubtful]
 *   - PRD v0.5 SS10: Problem bottom: [Undo] [Redo] [Pass] [Hint] [Submit Answer] [Abandon]
 *   - Arch v0.5 SS5.3: MODE_TRANSITIONS: play/problem -> ['submit','enterAnalysis']
 *   - Arch v0.5 SS9.4: submit: freezeAttempt -> evaluate -> finalize -> createRecallSession -> updateTab({mode:'recall'})
 *   - Arch v0.5 SS9.6: enterAnalysis -> store.updateTab({mode:'analysis', previousMode, analysisContext})
 *   - Arch v0.5 SS9.7: Snapshot: snapshotService.capture -> createTask -> tabService.openTask
 *
 * v0.5 conflict check: No conflicts found. Contract does not branch on origin.provider,
 * does not create source-specific tab API, does not have Container directly write store,
 * does not have UI import service/store/repo.
 *
 * Test classification:
 *   - T4-01, T4-02, T4-03, T4-17, T4-18, T4-GAP: CONTAINER_DELEGATION
 *   - T4-04, T4-05, T4-06, T4-07, T4-16: CONTROLLER_STATE_TRANSITION
 *   - T4-08, T4-09: PROJECTION_RETURN (tested via Container.render shellProps)
 *   - T4-10, T4-19: STORE_SUBSCRIPTION
 *   - T4-11, T4-12, T4-13, T4-14: UI_COMMAND_MAPPING
 *   - T4-15: ARCHITECTURE_BOUNDARY
 *   - T4-20: SIDE_EFFECT_BOUNDARY
 *
 * Long-term vs migration:
 *   - T4-01..T4-10, T4-15..T4-20: Long-term -- protect core wiring contracts.
 *   - T4-11..T4-14: Long-term -- protect UI button rendering contracts.
 *   - T4-GAP: Resolved -- onAbandonAnswer is now wired in Container to handleAbandon (no-op stub).
 *
 * Workbench wiring coverage:
 *   - UI command mapping: T4-11..T4-14 (button rendering + callback wiring)
 *   - Container handler -> flowService: T4-01..T4-03, T4-17, T4-18
 *   - flowService -> store: T4-04..T4-07, T4-16
 *   - Store subscription -> projection: T4-08..T4-10, T4-19
 *   - Architecture boundary: T4-15
 *   - Side-effect boundary: T4-20
 *
 * Harness manifest:
 *
 *   Harness "createDelegationHarness" (T4-01..T4-03, T4-08, T4-09, T4-10, T4-15, T4-17..T4-19, T4-GAP):
 *     - Real production modules: TrainingWorkbenchContainer, createWorkbenchStore,
 *       createTrainingRuntimeStore, real LoggerService with consoleWriter
 *     - Fake/spy modules: spy flowService, spy tabService, spy legacyController,
 *       mock sabaki with getTrainingContext
 *     - Valid for: CONTAINER_DELEGATION, PROJECTION_RETURN (via shellProps),
 *       STORE_SUBSCRIPTION (subscription setup), ARCHITECTURE_BOUNDARY
 *     - Not valid for: CONTROLLER_STATE_TRANSITION (flowService is spy),
 *       SERVICE_REPOSITORY_TRANSITION, RENDERED_UI_RETURN
 *
 *   Harness "createTransitionHarness" (T4-04..T4-07, T4-16):
 *     - Real production modules: createWorkbenchStore, createTrainingRuntimeStore,
 *       createWorkbenchFlowService, real LoggerService with consoleWriter
 *     - Fake/spy modules: spy repository, spy attemptService, spy recallService,
 *       spy snapshotService, spy tabService
 *     - Valid for: CONTROLLER_STATE_TRANSITION
 *     - Not valid for: CONTAINER_DELEGATION (no Container), RENDERED_UI_RETURN
 *
 *   Harness "createSnapshotHarness" (T4-20):
 *     - Real production modules: createSnapshotService, createWorkbenchStore,
 *       real LoggerService with consoleWriter
 *     - Fake/spy modules: spy repository, spy positionSnapshotAdapter
 *     - Valid for: SIDE_EFFECT_BOUNDARY
 *     - Not valid for: CONTROLLER_STATE_TRANSITION, RENDERED_UI_RETURN
 *
 * Fragile test warnings:
 *   1. T4-08, T4-09: projectFromWorkbench is an internal Container function (L517-546),
 *      not a separate module. Tests verify render output (shellProps) which is the stable
 *      external contract. If Container projection changes, tests must track but the
 *      contract (shellProps.mode reflects activeTab.mode) is stable.
 *   2. T4-GAP: Tests for the absence of onAbandonAnswer in shellHandlers. This test
 *      verifies the GAP exists; once the GAP is fixed, this test should be replaced
 *      with a test asserting the handler is wired correctly.
 *   3. T4-17: handleResign/handleAbandon are no-op stubs that console.warn. Tests verify
 *      flowService is not called. If these are implemented later, tests must be updated.
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
import {
  createWorkbenchFlowService,
  InvalidModeTransitionError,
} from '../../../src/modules/training/workbench/workbenchFlowService.ts'
import {createLoggerService} from '../../../src/modules/logger/LoggerService.js'
import {createConsoleWriter} from '../../../src/modules/logger/consoleWriter.js'
import {renderToDom} from '../preactTestHelper.js'
import {
  createSpyFlowService,
  createSpySnapshotService,
  createSpyTabService,
} from '../shared/workbenchSpyFactories.ts'

// UI components for UI_COMMAND_MAPPING tests
import ModeActions from '../../../src/components/workbench/shell/ModeActions.js'
import BottomActionBar from '../../../src/components/workbench/shell/BottomActionBar.js'

// snapshotService for T4-20
import {createSnapshotService} from '../../../src/modules/training/analysis/snapshotService.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// --- Logger for test harness (real, not mocked) ---

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

// --- Spy factories ---

function createSpyLegacyController() {
  const calls = {
    showRecallHint: [],
    skipRecallMove: [],
    endRecallSession: [],
    undoProblemMove: [],
    submitProblemAttempt: [],
    exitProblemMode: [],
    advanceReview: [],
  }
  return {
    calls,
    showRecallHint() { calls.showRecallHint.push({}) },
    skipRecallMove() { calls.skipRecallMove.push({}) },
    endRecallSession() { calls.endRecallSession.push({}) },
    undoProblemMove() { calls.undoProblemMove.push({}) },
    submitProblemAttempt() { calls.submitProblemAttempt.push({}) },
    exitProblemMode() { calls.exitProblemMode.push({}) },
    advanceReview() { calls.advanceReview.push({}) },
  }
}

function createSpyReviewService() {
  const calls = {startSession: [], advanceReview: [], updateScheduleAfterResult: []}
  return {
    calls,
    async startSession() { calls.startSession.push({}) },
    async advanceReview() { calls.advanceReview.push({}) },
    async updateScheduleAfterResult(input) { calls.updateScheduleAfterResult.push(input) },
  }
}

function createSpyRecallCheckpointService() {
  const calls = {submitUserCorrectionLine: [], revealAiCandidateLines: [], skipCheckpoint: [], saveComment: [], resumeRecall: []}
  return {
    calls,
    async submitUserCorrectionLine(input) { calls.submitUserCorrectionLine.push(input) },
    async revealAiCandidateLines(id) { calls.revealAiCandidateLines.push(id) },
    async skipCheckpoint(id) { calls.skipCheckpoint.push(id) },
    async saveComment(input) { calls.saveComment.push(input) },
    async resumeRecall(id) { calls.resumeRecall.push(id) },
  }
}

function createSpyTaskImportService() {
  return {
    async createManualTask(input) {
      return {id: `task_manual_${Date.now()}`, ...input}
    },
    async createTaskFromBadMove(input) {
      return {id: `task_badmove_${Date.now()}`}
    },
  }
}

// --- Delegation Harness ---
// Uses spy flowService to verify Container handler -> flowService delegation.

function createDelegationHarness({
  tabs = [makePlayTab()],
  activeTabId = tabs[0]?.id ?? null,
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

  const trainingContext = {
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
    snapshotService,
    legacyController,
    container,
    sabaki,
    trainingContext,
    getShellProps() {
      return container.render().props
    },
  }
}

// --- Transition Harness ---
// Uses real workbenchFlowService + real workbenchStore to verify state transitions.

function createTransitionHarness({
  tabs = [makePlayTab()],
  activeTabId = tabs[0]?.id ?? null,
} = {}) {
  const workbenchStore = createWorkbenchStore({logger})
  const runtimeStore = createTrainingRuntimeStore({logger})
  const tabService = createSpyTabService()
  const snapshotService = createSpySnapshotService()

  const spyRepository = {
    async loadTask(taskId) { return {id: taskId, rootPositionSgf: ''} },
    async listMoveEvaluationsByAttempt() { return [] },
    async listBadMovesByAttempt() { return [] },
    async createTask(task) { return task },
    async transaction(fn) { return fn() },
  }

  const spyAttemptService = {
    async createAttempt(input) { return {id: 'att_new'} },
    async freezeAttempt() {},
    async finalizeAttemptResult() {},
  }

  const spyRecallService = {
    async createRecallSession() { return {id: 'rs_new'} },
    async completeRecall() {},
  }

  const realFlowService = createWorkbenchFlowService({
    workbenchStore,
    repository: spyRepository,
    attemptService: spyAttemptService,
    recallService: spyRecallService,
    snapshotService,
    tabService,
    runtimeStore,
    logger,
  })

  for (const tab of tabs) workbenchStore.addTab(tab)
  if (activeTabId != null) workbenchStore.setActiveTab(activeTabId)

  return {
    workbenchStore,
    runtimeStore,
    flowService: realFlowService,
    tabService,
    snapshotService,
    repository: spyRepository,
    attemptService: spyAttemptService,
    recallService: spyRecallService,
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('W8-P3 Task 4: Play/Problem Action Buttons Wiring', function () {

  // ===================================================
  // CONTAINER_DELEGATION (T4-01, T4-02, T4-03, T4-17, T4-18, T4-GAP)
  // ===================================================

  describe('CONTAINER_DELEGATION', function () {

    // --- T4-01: handleSubmit calls flowService.submit(activeTab.id) ---

    describe('T4-01: handleSubmit delegates to flowService.submit', function () {
      it('onEnd (play) calls flowService.submit with activeTab.id', async function () {
        const harness = createDelegationHarness({
          tabs: [makePlayTab({id: 'tab_p1'})],
        })

        const shellProps = harness.getShellProps()

        assert.strictEqual(typeof shellProps.onEnd, 'function',
          'Container must expose onEnd callback')

        await shellProps.onEnd()

        assert.deepStrictEqual(harness.flowService.calls.submit, [
          {tabId: 'tab_p1'},
        ], 'flowService.submit must be called with active tab id -- Contract T4-01')
      })

      it('onSubmit (problem) calls flowService.submit with activeTab.id', async function () {
        const harness = createDelegationHarness({
          tabs: [makeProblemTab({id: 'tab_pr1'})],
        })

        const shellProps = harness.getShellProps()

        assert.strictEqual(typeof shellProps.onSubmit, 'function',
          'Container must expose onSubmit callback')

        await shellProps.onSubmit()

        assert.deepStrictEqual(harness.flowService.calls.submit, [
          {tabId: 'tab_pr1'},
        ], 'flowService.submit must be called with active tab id -- Contract T4-01')
      })

      it('onEndAttempt (play bottom) calls flowService.submit with activeTab.id', async function () {
        const harness = createDelegationHarness({
          tabs: [makePlayTab({id: 'tab_p1e'})],
        })

        const shellProps = harness.getShellProps()

        assert.strictEqual(typeof shellProps.onEndAttempt, 'function',
          'Container must expose onEndAttempt callback -- Contract T4-01, A-4.1b')

        await shellProps.onEndAttempt()

        assert.deepStrictEqual(harness.flowService.calls.submit, [
          {tabId: 'tab_p1e'},
        ], 'flowService.submit must be called via onEndAttempt -- Contract T4-01')
      })

      it('onSubmitAnswer (problem bottom) calls flowService.submit with activeTab.id', async function () {
        const harness = createDelegationHarness({
          tabs: [makeProblemTab({id: 'tab_pr1s'})],
        })

        const shellProps = harness.getShellProps()

        assert.strictEqual(typeof shellProps.onSubmitAnswer, 'function',
          'Container must expose onSubmitAnswer callback -- Contract T4-01, A-4.1d')

        await shellProps.onSubmitAnswer()

        assert.deepStrictEqual(harness.flowService.calls.submit, [
          {tabId: 'tab_pr1s'},
        ], 'flowService.submit must be called via onSubmitAnswer -- Contract T4-01')
      })
    })

    // --- T4-02: handleEnterAnalysis calls flowService.enterAnalysis(activeTab.id) ---

    describe('T4-02: handleEnterAnalysis delegates to flowService.enterAnalysis', function () {
      it('onAnalysis (problem) calls flowService.enterAnalysis with activeTab.id', function () {
        const harness = createDelegationHarness({
          tabs: [makeProblemTab({id: 'tab_pr2'})],
        })

        const shellProps = harness.getShellProps()

        assert.strictEqual(typeof shellProps.onAnalysis, 'function',
          'Container must expose onAnalysis callback')

        shellProps.onAnalysis()

        assert.deepStrictEqual(harness.flowService.calls.enterAnalysis, [
          {tabId: 'tab_pr2'},
        ], 'flowService.enterAnalysis must be called with active tab id -- Contract T4-02')
      })
    })

    // --- T4-03: handleSnapshot calls flowService.snapshotFromCurrentContext(activeTab.id) ---

    describe('T4-03: handleSnapshot delegates to flowService.snapshotFromCurrentContext', function () {
      it('onSnapshot calls flowService.snapshotFromCurrentContext with activeTab.id', async function () {
        const harness = createDelegationHarness({
          tabs: [makePlayTab({id: 'tab_snap'})],
        })

        const shellProps = harness.getShellProps()

        assert.strictEqual(typeof shellProps.onSnapshot, 'function',
          'Container must expose onSnapshot callback')

        await shellProps.onSnapshot()

        assert.deepStrictEqual(harness.flowService.calls.snapshotFromCurrentContext, [
          {tabId: 'tab_snap'},
        ], 'flowService.snapshotFromCurrentContext must be called with active tab id -- Contract T4-03')
      })
    })

    // --- T4-17: handleResign/handleAbandon are no-op ---

    describe('T4-17: handleResign/handleAbandon are no-op', function () {
      it('onResign does not call any flowService method -- GAP-01', function () {
        const harness = createDelegationHarness({
          tabs: [makePlayTab({id: 'tab_resign'})],
        })

        const shellProps = harness.getShellProps()

        assert.strictEqual(typeof shellProps.onResign, 'function',
          'Container must expose onResign callback')

        shellProps.onResign()

        // Verify no flowService methods were called
        assert.strictEqual(harness.flowService.calls.submit.length, 0,
          'handleResign must not call flowService.submit -- GAP-01')
        assert.strictEqual(harness.flowService.calls.enterAnalysis.length, 0,
          'handleResign must not call flowService.enterAnalysis')
        assert.strictEqual(harness.flowService.calls.snapshotFromCurrentContext.length, 0,
          'handleResign must not call flowService.snapshotFromCurrentContext')
      })

      it('onAbandon does not call any flowService method -- GAP-02', function () {
        const harness = createDelegationHarness({
          tabs: [makeProblemTab({id: 'tab_abandon'})],
        })

        const shellProps = harness.getShellProps()

        assert.strictEqual(typeof shellProps.onAbandon, 'function',
          'Container must expose onAbandon callback')

        shellProps.onAbandon()

        assert.strictEqual(harness.flowService.calls.submit.length, 0,
          'handleAbandon must not call flowService.submit -- GAP-02')
        assert.strictEqual(harness.flowService.calls.enterAnalysis.length, 0,
          'handleAbandon must not call flowService.enterAnalysis')
        assert.strictEqual(harness.flowService.calls.snapshotFromCurrentContext.length, 0,
          'handleAbandon must not call flowService.snapshotFromCurrentContext')
      })
    })

    // --- T4-18: handlers do not call flowService when activeTab is null ---

    describe('T4-18: handlers guard against null activeTab', function () {
      it('onSubmit does not call flowService.submit when no activeTab', async function () {
        const harness = createDelegationHarness({
          tabs: [makePlayTab({id: 'tab_18'})],
          activeTabId: null,
        })

        const shellProps = harness.getShellProps()

        await shellProps.onSubmit()

        assert.strictEqual(harness.flowService.calls.submit.length, 0,
          'handleSubmit must not call flowService.submit when activeTab is null -- Contract T4-18')
      })

      it('onAnalysis does not call flowService.enterAnalysis when no activeTab', function () {
        const harness = createDelegationHarness({
          tabs: [makePlayTab({id: 'tab_18b'})],
          activeTabId: null,
        })

        const shellProps = harness.getShellProps()

        shellProps.onAnalysis()

        assert.strictEqual(harness.flowService.calls.enterAnalysis.length, 0,
          'handleEnterAnalysis must not call flowService.enterAnalysis when activeTab is null -- Contract T4-18')
      })

      it('onSnapshot does not call flowService.snapshotFromCurrentContext when no activeTab', async function () {
        const harness = createDelegationHarness({
          tabs: [makePlayTab({id: 'tab_18c'})],
          activeTabId: null,
        })

        const shellProps = harness.getShellProps()

        await shellProps.onSnapshot()

        assert.strictEqual(harness.flowService.calls.snapshotFromCurrentContext.length, 0,
          'handleSnapshot must not call flowService.snapshotFromCurrentContext when activeTab is null -- Contract T4-18')
      })
    })

    // --- T4-GAP: onAbandonAnswer is now wired (was previously a GAP) ---

    describe('T4-GAP: onAbandonAnswer is wired', function () {
      it('shellHandlers contains onAbandonAnswer key that delegates to handleAbandon', function () {
        const harness = createDelegationHarness({
          tabs: [makeProblemTab({id: 'tab_gap'})],
        })

        const shellProps = harness.getShellProps()

        // Previously a GAP: onAbandonAnswer was not wired. Now it delegates to handleAbandon.
        assert.strictEqual(typeof shellProps.onAbandonAnswer, 'function',
          'shellHandlers must have onAbandonAnswer wired as a function')

        // handleAbandon is a no-op stub that does not call flowService
        shellProps.onAbandonAnswer()

        assert.strictEqual(harness.flowService.calls.submit.length, 0,
          'onAbandonAnswer must not call flowService.submit -- GAP-02: handleAbandon is no-op')
      })
    })
  })

  // ===================================================
  // CONTROLLER_STATE_TRANSITION (T4-04, T4-05, T4-06, T4-07, T4-16)
  // ===================================================

  describe('CONTROLLER_STATE_TRANSITION', function () {

    // --- T4-04: submit changes tab.mode to 'recall' ---

    describe('T4-04: submit transitions mode to recall', function () {
      it('real flowService.submit changes play tab mode to recall', async function () {
        const harness = createTransitionHarness({
          tabs: [makePlayTab({id: 'tab_t4', activeAttemptId: 'att_t4'})],
        })

        // Before: mode is play
        assert.strictEqual(harness.workbenchStore.getState().tabs[0].mode, 'play')

        await harness.flowService.submit('tab_t4')

        const tab = harness.workbenchStore.getState().tabs[0]
        assert.strictEqual(tab.mode, 'recall',
          'After submit from play, tab.mode must be recall -- Arch v0.5 SS9.4, Contract T4-04')
      })

      it('real flowService.submit changes problem tab mode to recall', async function () {
        const harness = createTransitionHarness({
          tabs: [makeProblemTab({id: 'tab_t4p', activeAttemptId: 'att_t4p'})],
        })

        assert.strictEqual(harness.workbenchStore.getState().tabs[0].mode, 'problem')

        await harness.flowService.submit('tab_t4p')

        const tab = harness.workbenchStore.getState().tabs[0]
        assert.strictEqual(tab.mode, 'recall',
          'After submit from problem, tab.mode must be recall -- Arch v0.5 SS9.4, Contract T4-04')
      })
    })

    // --- T4-05: enterAnalysis sets mode, previousMode, analysisContext ---

    describe('T4-05: enterAnalysis sets mode, previousMode, analysisContext', function () {
      it('real flowService.enterAnalysis from problem sets all three fields', function () {
        const harness = createTransitionHarness({
          tabs: [makeProblemTab({id: 'tab_t5', taskId: 'task_t5', activeAttemptId: 'att_t5'})],
        })

        // Before
        const before = harness.workbenchStore.getState().tabs[0]
        assert.strictEqual(before.mode, 'problem')
        assert.strictEqual(before.previousMode, undefined)

        harness.flowService.enterAnalysis('tab_t5')

        const tab = harness.workbenchStore.getState().tabs[0]
        assert.strictEqual(tab.mode, 'analysis',
          'After enterAnalysis, tab.mode must be analysis -- Arch v0.5 SS9.6, Contract T4-05')
        assert.strictEqual(tab.previousMode, 'problem',
          'After enterAnalysis from problem, tab.previousMode must be problem -- Arch v0.5 SS9.6')
        assert.ok(tab.analysisContext,
          'analysisContext must be set after enterAnalysis -- Arch v0.5 SS9.6')
        assert.strictEqual(tab.analysisContext.source, 'problem',
          'analysisContext.source must be "problem" -- Arch v0.5 SS9.6')
        assert.strictEqual(tab.analysisContext.taskId, 'task_t5',
          'analysisContext.taskId must match original taskId -- Arch v0.5 SS9.6')
        assert.strictEqual(tab.analysisContext.attemptId, 'att_t5',
          'analysisContext.attemptId must match original activeAttemptId -- Arch v0.5 SS9.6')
      })

      it('real flowService.enterAnalysis from play sets correct fields', function () {
        const harness = createTransitionHarness({
          tabs: [makePlayTab({id: 'tab_t5p', taskId: 'task_t5p'})],
        })

        harness.flowService.enterAnalysis('tab_t5p')

        const tab = harness.workbenchStore.getState().tabs[0]
        assert.strictEqual(tab.mode, 'analysis')
        assert.strictEqual(tab.previousMode, 'play',
          'After enterAnalysis from play, previousMode must be play -- Contract T4-05')
        assert.strictEqual(tab.analysisContext.source, 'play',
          'analysisContext.source must be "play" -- Contract T4-05')
      })
    })

    // --- T4-06: snapshot creates new tab with mode=problem, parentTabId=original ---

    describe('T4-06: snapshot creates new tab (mode=problem, parentTabId set)', function () {
      it('real flowService.snapshotFromCurrentContext creates new tab', async function () {
        const harness = createTransitionHarness({
          tabs: [makePlayTab({id: 'tab_snap_src', taskId: 'task_snap'})],
        })

        // Before: only one tab
        assert.strictEqual(harness.workbenchStore.getState().tabs.length, 1)

        const newTab = await harness.flowService.snapshotFromCurrentContext('tab_snap_src')

        // Verify snapshotService was called
        assert.strictEqual(harness.snapshotService.calls.captureSnapshotInput.length, 1,
          'snapshotService.captureSnapshotInput must be called once')
        assert.strictEqual(harness.snapshotService.calls.captureSnapshotInput[0].tabId, 'tab_snap_src')

        // Verify tabService.openTask was called
        assert.strictEqual(harness.tabService.calls.openTask.length, 1,
          'tabService.openTask must be called once -- Arch v0.5 SS9.7')
        assert.strictEqual(harness.tabService.calls.openTask[0].taskId, newTab.taskId,
          'tabService.openTask must use the created task id')
        assert.strictEqual(harness.tabService.calls.openTask[0].mode, 'problem',
          'tabService.openTask mode must be "problem" -- Arch v0.5 SS9.7, Contract T4-06')
        assert.strictEqual(harness.tabService.calls.openTask[0].parentTabId, 'tab_snap_src',
          'tabService.openTask parentTabId must be original tab id -- Contract T4-06')
      })
    })

    // --- T4-07: snapshot does not modify current tab mode ---

    describe('T4-07: snapshot preserves current tab mode', function () {
      it('after snapshot, original tab mode is unchanged', async function () {
        const harness = createTransitionHarness({
          tabs: [makeProblemTab({id: 'tab_snap_orig', taskId: 'task_snap_orig'})],
        })

        assert.strictEqual(harness.workbenchStore.getState().tabs[0].mode, 'problem')

        await harness.flowService.snapshotFromCurrentContext('tab_snap_orig')

        const originalTab = harness.workbenchStore.getState().tabs.find(t => t.id === 'tab_snap_orig')
        assert.strictEqual(originalTab.mode, 'problem',
          'After snapshot, original tab mode must still be problem -- Contract T4-07')
      })
    })

    // --- T4-16: submit without active attempt does not crash, direct mode->recall ---

    describe('T4-16: submit without active attempt transitions directly to recall', function () {
      it('real flowService.submit with no activeAttemptId changes mode to recall', async function () {
        const harness = createTransitionHarness({
          tabs: [makePlayTab({id: 'tab_no_att', activeAttemptId: undefined})],
        })

        // Before: mode is play, no active attempt
        const before = harness.workbenchStore.getState().tabs[0]
        assert.strictEqual(before.mode, 'play')
        assert.strictEqual(before.activeAttemptId, undefined)

        // Must not throw
        await harness.flowService.submit('tab_no_att')

        const tab = harness.workbenchStore.getState().tabs[0]
        assert.strictEqual(tab.mode, 'recall',
          'After submit without active attempt, tab.mode must be recall -- Contract T4-16, Arch v0.5 SS9.4')
      })
    })
  })

  // ===================================================
  // PROJECTION_RETURN (T4-08, T4-09)
  // ===================================================

  describe('PROJECTION_RETURN', function () {
    // projectFromWorkbench is a private function in Container.js (L517-546).
    // Tests verify projection through Container.render() shellProps output,
    // which is the stable external contract.

    // --- T4-08: projectFromWorkbench returns mode='recall' after submit ---

    describe('T4-08: projection returns mode=recall after submit', function () {
      it('shellProps.mode equals recall after store update to recall', function () {
        const harness = createDelegationHarness({
          tabs: [makePlayTab({id: 'tab_proj_1'})],
        })

        // Simulate what flowService.submit does: update tab mode to recall
        harness.workbenchStore.updateTab('tab_proj_1', {mode: 'recall'})

        // Re-render Container to pick up the new state
        const shellProps = harness.getShellProps()

        assert.strictEqual(shellProps.mode, 'recall',
          'shellProps.mode must be "recall" after tab.mode changes to recall -- Contract T4-08')
      })
    })

    // --- T4-09: projectFromWorkbench returns mode='analysis' after enterAnalysis ---

    describe('T4-09: projection returns mode=analysis after enterAnalysis', function () {
      it('shellProps.mode equals analysis after store update to analysis', function () {
        const harness = createDelegationHarness({
          tabs: [makeProblemTab({id: 'tab_proj_2'})],
        })

        // Simulate what flowService.enterAnalysis does
        harness.workbenchStore.updateTab('tab_proj_2', {
          mode: 'analysis',
          previousMode: 'problem',
          analysisContext: {taskId: 'task_problem', source: 'problem'},
        })

        // Re-render Container to pick up the new state
        const shellProps = harness.getShellProps()

        assert.strictEqual(shellProps.mode, 'analysis',
          'shellProps.mode must be "analysis" after tab.mode changes to analysis -- Contract T4-09')
      })
    })
  })

  // ===================================================
  // STORE_SUBSCRIPTION (T4-10, T4-19)
  // ===================================================

  describe('STORE_SUBSCRIPTION', function () {

    // --- T4-10: subscriber receives notification after submit/enterAnalysis/snapshot ---

    describe('T4-10: workbenchStore subscriber notified after state changes', function () {
      it('subscriber called after flowService.submit changes tab mode', async function () {
        const harness = createTransitionHarness({
          tabs: [makePlayTab({id: 'tab_sub_1', activeAttemptId: 'att_sub'})],
        })

        let notified = false
        const unsub = harness.workbenchStore.subscribe(() => { notified = true })

        try {
          await harness.flowService.submit('tab_sub_1')

          assert.strictEqual(notified, true,
            'Subscriber must be notified after submit changes tab mode -- Contract T4-10')
        } finally {
          unsub()
        }
      })

      it('subscriber called after flowService.enterAnalysis changes tab mode', function () {
        const harness = createTransitionHarness({
          tabs: [makeProblemTab({id: 'tab_sub_2'})],
        })

        let notified = false
        const unsub = harness.workbenchStore.subscribe(() => { notified = true })

        try {
          harness.flowService.enterAnalysis('tab_sub_2')

          assert.strictEqual(notified, true,
            'Subscriber must be notified after enterAnalysis changes tab mode -- Contract T4-10')
        } finally {
          unsub()
        }
      })

      it('subscriber called after snapshot creates new tab', async function () {
        // Use a real flowService harness with a tabService that writes to
        // the real workbenchStore (mirrors T5-11 pattern). This ensures the
        // subscriber is actually triggered by the snapshot -> openTask flow.
        const workbenchStore = createWorkbenchStore({logger})
        const runtimeStore = createTrainingRuntimeStore({logger})

        workbenchStore.addTab(makePlayTab({id: 'tab_sub_3', taskId: 'task_sub_3'}))
        workbenchStore.setActiveTab('tab_sub_3')

        const snapshotService = createSpySnapshotService()

        const spyRepository = {
          async loadTask(taskId) { return {id: taskId, rootPositionSgf: ''} },
          async listMoveEvaluationsByAttempt() { return [] },
          async listBadMovesByAttempt() { return [] },
          async createTask(task) { return task },
          async transaction(fn) { return fn() },
        }

        const spyAttemptService = {
          async createAttempt(input) { return {id: 'att_new'} },
          async freezeAttempt() {},
          async finalizeAttemptResult() {},
        }

        const spyRecallService = {
          async createRecallSession() { return {id: 'rs_new'} },
          async completeRecall() {},
        }

        // tabService.openTask writes the new tab into the real workbenchStore,
        // triggering subscriber notification -- same pattern as T5-11.
        let openTaskCounter = 0
        const tabService = {
          calls: {switchTab: [], closeTab: [], openTask: []},
          switchTab(tabId) { this.calls.switchTab.push({tabId}) },
          async closeTab(tabId) { this.calls.closeTab.push({tabId}) },
          async openTask(opts) {
            openTaskCounter++
            this.calls.openTask.push(opts)
            const newTab = {
              id: `tab_snap_${openTaskCounter}`,
              taskId: opts.taskId,
              mode: opts.mode || 'problem',
              parentTabId: opts.parentTabId || null,
              childTabIds: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
            workbenchStore.addTab(newTab)
            return newTab
          },
        }

        const realFlowService = createWorkbenchFlowService({
          workbenchStore,
          repository: spyRepository,
          attemptService: spyAttemptService,
          recallService: spyRecallService,
          snapshotService,
          tabService,
          runtimeStore,
          logger,
        })

        let notified = false
        const unsub = workbenchStore.subscribe(() => { notified = true })

        try {
          await realFlowService.snapshotFromCurrentContext('tab_sub_3')

          assert.strictEqual(notified, true,
            'Subscriber must be notified after snapshot creates new tab via tabService.openTask writing to workbenchStore -- Contract T4-10')
        } finally {
          unsub()
        }
      })
    })

    // --- T4-19: enterAnalysis saves previousMode, subscriber notification triggers correct projection ---

    describe('T4-19: previousMode preserved through subscription', function () {
      it('after enterAnalysis + re-render, shellProps shows previousMode and analysis mode', function () {
        const harness = createDelegationHarness({
          tabs: [makeProblemTab({id: 'tab_t19'})],
        })

        // Simulate what flowService.enterAnalysis does
        harness.workbenchStore.updateTab('tab_t19', {
          mode: 'analysis',
          previousMode: 'problem',
          analysisContext: {taskId: 'task_problem', source: 'problem'},
        })

        // Container re-renders (subscriber triggers forceUpdate)
        const shellProps = harness.getShellProps()

        assert.strictEqual(shellProps.mode, 'analysis',
          'Projection must show mode=analysis -- Contract T4-19')
        assert.strictEqual(shellProps.previousMode, 'problem',
          'Projection must show previousMode=problem -- Contract T4-19')
      })
    })
  })

  // ===================================================
  // UI_COMMAND_MAPPING (T4-11, T4-12, T4-13, T4-14)
  // ===================================================

  describe('UI_COMMAND_MAPPING', function () {

    // --- T4-11: ModeActions play renders onEnd button ---

    describe('T4-11: ModeActions play renders onEnd button', function () {
      it('play mode renders button with data-testid="mode-action-end"', function () {
        const {getByTestId} = renderToDom(
          h(ModeActions, {
            mode: 'play',
            onNewGame: () => {},
            onSettings: () => {},
            onEnd: () => {},
            onResign: () => {},
          })
        )

        const endBtn = getByTestId('mode-action-end')
        assert.ok(endBtn, 'ModeActions play must render button with data-testid="mode-action-end" -- Contract T4-11')
      })

      it('clicking mode-action-end fires onEnd callback', function () {
        let endCalled = false
        const {getByTestId, fireEvent} = renderToDom(
          h(ModeActions, {
            mode: 'play',
            onNewGame: () => {},
            onSettings: () => {},
            onEnd: () => { endCalled = true },
            onResign: () => {},
          })
        )

        const endBtn = getByTestId('mode-action-end')
        // ModeActions.js:66 calls callbacks[btn.callback]() where btn.callback='onEnd'
        fireEvent.click(endBtn)

        assert.strictEqual(endCalled, true,
          'Clicking mode-action-end must fire onEnd callback -- Contract T4-11')
      })
    })

    // --- T4-12: ModeActions problem renders onSubmit + onAnalysis buttons ---

    describe('T4-12: ModeActions problem renders onSubmit + onAnalysis buttons', function () {
      it('problem mode renders buttons with data-testid "mode-action-submit" and "mode-action-analysis"', function () {
        const {getByTestId} = renderToDom(
          h(ModeActions, {
            mode: 'problem',
            onSubmit: () => {},
            onAbandon: () => {},
            onSettings: () => {},
            onAnalysis: () => {},
          })
        )

        const submitBtn = getByTestId('mode-action-submit')
        assert.ok(submitBtn, 'ModeActions problem must render mode-action-submit -- Contract T4-12')

        const analysisBtn = getByTestId('mode-action-analysis')
        assert.ok(analysisBtn, 'ModeActions problem must render mode-action-analysis -- Contract T4-12')
      })
    })

    // --- T4-13: BottomActionBar play renders onResign + onEndAttempt buttons ---

    describe('T4-13: BottomActionBar play renders onResign + onEndAttempt', function () {
      it('play mode renders buttons with data-testid "action-resign" and "action-end-attempt"', function () {
        const {getByTestId} = renderToDom(
          h(BottomActionBar, {
            mode: 'play',
            onUndo: () => {},
            onPass: () => {},
            onResign: () => {},
            onEndAttempt: () => {},
            onMarkDoubtful: () => {},
            onSelect: () => {},
            onHandShape: () => {},
            onZoomIn: () => {},
            onZoomOut: () => {},
            onFullscreen: () => {},
          })
        )

        const resignBtn = getByTestId('action-resign')
        assert.ok(resignBtn, 'BottomActionBar play must render action-resign -- Contract T4-13')

        const endAttemptBtn = getByTestId('action-end-attempt')
        assert.ok(endAttemptBtn, 'BottomActionBar play must render action-end-attempt -- Contract T4-13')
      })

      it('clicking action-resign fires onResign callback', function () {
        let resignCalled = false
        const {getByTestId, fireEvent} = renderToDom(
          h(BottomActionBar, {
            mode: 'play',
            onUndo: () => {},
            onPass: () => {},
            onResign: () => { resignCalled = true },
            onEndAttempt: () => {},
            onMarkDoubtful: () => {},
            onSelect: () => {},
            onHandShape: () => {},
            onZoomIn: () => {},
            onZoomOut: () => {},
            onFullscreen: () => {},
          })
        )

        // BottomActionBar.js:117-119 calls callbacks[btn.callback]() where btn.callback='onResign'
        const resignBtn = getByTestId('action-resign')
        fireEvent.click(resignBtn)

        assert.strictEqual(resignCalled, true,
          'Clicking action-resign must fire onResign callback -- Contract T4-13')
      })
    })

    // --- T4-14: BottomActionBar problem renders onSubmitAnswer button ---

    describe('T4-14: BottomActionBar problem renders onSubmitAnswer', function () {
      it('problem mode renders button with data-testid "action-submit-answer"', function () {
        const {getByTestId} = renderToDom(
          h(BottomActionBar, {
            mode: 'problem',
            onUndo: () => {},
            onRedo: () => {},
            onPass: () => {},
            onRequestHint: () => {},
            onSubmitAnswer: () => {},
            onAbandonAnswer: () => {},
            onSelect: () => {},
            onHandShape: () => {},
            onZoomIn: () => {},
            onZoomOut: () => {},
            onFullscreen: () => {},
          })
        )

        const submitAnswerBtn = getByTestId('action-submit-answer')
        assert.ok(submitAnswerBtn, 'BottomActionBar problem must render action-submit-answer -- Contract T4-14')
      })

      it('clicking action-submit-answer fires onSubmitAnswer callback', function () {
        let submitCalled = false
        const {getByTestId, fireEvent} = renderToDom(
          h(BottomActionBar, {
            mode: 'problem',
            onUndo: () => {},
            onRedo: () => {},
            onPass: () => {},
            onRequestHint: () => {},
            onSubmitAnswer: () => { submitCalled = true },
            onAbandonAnswer: () => {},
            onSelect: () => {},
            onHandShape: () => {},
            onZoomIn: () => {},
            onZoomOut: () => {},
            onFullscreen: () => {},
          })
        )

        // BottomActionBar.js:117-119 calls callbacks[btn.callback]() where btn.callback='onSubmitAnswer'
        const submitAnswerBtn = getByTestId('action-submit-answer')
        fireEvent.click(submitAnswerBtn)

        assert.strictEqual(submitCalled, true,
          'Clicking action-submit-answer must fire onSubmitAnswer callback -- Contract T4-14')
      })
    })
  })

  // ===================================================
  // ARCHITECTURE_BOUNDARY (T4-15)
  // ===================================================

  describe('ARCHITECTURE_BOUNDARY', function () {

    // --- T4-15: Container handler does not directly call workbenchStore.updateTab ---

    describe('T4-15: Container handlers do not directly call workbenchStore.updateTab', function () {
      it('Container source does not contain workbenchStore.updateTab', function () {
        const containerPath = path.resolve(
          __dirname, '../../../src/components/TrainingWorkbenchContainer.js',
        )
        const source = fs.readFileSync(containerPath, 'utf-8')

        assert.ok(
          !source.includes('workbenchStore.updateTab'),
          'Container must not call workbenchStore.updateTab directly -- Arch v0.5: Container calls flowService, flowService calls store. Contract T4-15',
        )
      })

      it('handlers only delegate to flowService, not store', async function () {
        const harness = createDelegationHarness({
          tabs: [makePlayTab({id: 'tab_boundary'})],
        })

        // Spy on workbenchStore.updateTab to verify it is never called by Container handlers
        let storeUpdateCalled = false
        const originalUpdateTab = harness.workbenchStore.updateTab.bind(harness.workbenchStore)
        harness.workbenchStore.updateTab = function(tabId, patch) {
          storeUpdateCalled = true
          return originalUpdateTab(tabId, patch)
        }

        const shellProps = harness.getShellProps()

        // Trigger all action handlers
        await shellProps.onSubmit()
        shellProps.onAnalysis()
        // Note: onSnapshot calls spy flowService (which does not call store)
        await shellProps.onSnapshot()

        // The spy flowService does NOT call workbenchStore.updateTab.
        // If Container had direct store calls, storeUpdateCalled would be true.
        assert.strictEqual(storeUpdateCalled, false,
          'Container handlers must not directly call workbenchStore.updateTab -- Arch v0.5, Contract T4-15')
      })
    })
  })

  // ===================================================
  // SIDE_EFFECT_BOUNDARY (T4-20)
  // ===================================================

  describe('SIDE_EFFECT_BOUNDARY', function () {

    // --- T4-20: snapshotService does not directly call tabService.openTask ---

    describe('T4-20: snapshotService does not call tabService.openTask', function () {
      it('snapshotService.captureSnapshotInput returns data without calling tabService', async function () {
        const workbenchStore = createWorkbenchStore({logger})
        workbenchStore.addTab(makePlayTab({id: 'tab_se', taskId: 'task_se'}))

        const spyRepository = {
          async loadTask(taskId) {
            return {id: taskId, rootPositionSgf: '', origin: {provider: 'local'}}
          },
        }

        const spyPositionSnapshotAdapter = {
          captureCurrentPosition() {
            return {
              positionSgf: '(;SZ[19])',
              sideToMove: 'black',
              positionHash: 'hash_123',
              moveNumber: 5,
            }
          },
        }

        // Track if tabService.openTask is called
        let tabServiceCalled = false
        const spyTabService = {
          async openTask() {
            tabServiceCalled = true
            return {id: 'tab_fake'}
          },
        }

        const realSnapshotService = createSnapshotService({
          repository: spyRepository,
          positionSnapshotAdapter: spyPositionSnapshotAdapter,
          workbenchStore,
          logger,
        })

        // Call captureSnapshotInput
        const result = await realSnapshotService.captureSnapshotInput({
          tabId: 'tab_se',
          sourceTaskId: 'task_se',
        })

        // Verify snapshotService returns data
        assert.ok(result, 'captureSnapshotInput must return a result')
        assert.ok(result.positionSgf, 'Result must contain positionSgf')
        assert.strictEqual(result.sourceTaskId, 'task_se')

        // Verify snapshotService did NOT call tabService.openTask
        assert.strictEqual(tabServiceCalled, false,
          'snapshotService.captureSnapshotInput must NOT call tabService.openTask -- Arch v0.5 SS9.7: flowService orchestrates tab creation, not snapshotService. Contract T4-20')
      })
    })
  })
})
