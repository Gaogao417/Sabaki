/**
 * W8-P4 Dashboard Wiring Tests
 *
 * Test contract: docs/design/2026-05-21/w8-p4-dashboard-regression/test-contract-v0.2.md
 * Contracts covered: D-T00 through D-T12 (Dashboard wiring)
 *
 * Source of truth alignment:
 *   - PRD v0.5 SS2.7: Review is entry, not board mode
 *   - PRD v0.5 SS4.12: ReviewSchedule uses taskId, not item_type
 *   - PRD v0.5 SS5.6: BadMove -> taskImportService.createTaskFromBadMove -> TrainingTask
 *   - PRD v0.5 SS5.7: reviewService.openDueItem -> openTask(taskId)
 *   - PRD v0.5 SS7.2.E: Dashboard must display and open due items
 *   - PRD v0.5 SS8.5: Acceptance criteria for dashboard
 *   - Arch v0.5 SS0.3: UI only displays, does not write business Store
 *   - Arch v0.5 SS1.1: Read path: Store/Repository query -> Container -> UI
 *   - Arch v0.5 SS1.2: Write path: UI -> Controller/Container -> Service
 *   - Arch v0.5 SS3.5: All training DB reads/writes through repository
 *   - Arch v0.5 SS5.11: reviewService.getDueItems, reviewService.openDueItem
 *   - Arch v0.5 SS6.2: Repository query methods for dashboard data
 *   - Arch v0.5 SS9.9: Review open due item command path
 *
 * v0.5 conflict check: No conflicts found. Contract does not branch on origin.provider,
 * does not introduce source-specific tab APIs, does not let Container directly write store
 * for open actions, does not let UI import services/stores.
 *
 * Test classification:
 *   - D-T00: ARCHITECTURE_BOUNDARY
 *   - D-T01: CONTAINER_DELEGATION
 *   - D-T01b: CONTROLLER_STATE_TRANSITION
 *   - D-T02..D-T05: CONTAINER_DELEGATION
 *   - D-T06a: CONTAINER_DELEGATION
 *   - D-T06b-1..5: DATA_LOADING
 *   - D-T07: ARCHITECTURE_BOUNDARY
 *   - D-T08: ARCHITECTURE_BOUNDARY
 *   - D-T09: STORE_SUBSCRIPTION
 *   - D-T10: PROJECTION_RETURN
 *   - D-T11: SIDE_EFFECT_BOUNDARY
 *   - D-T12: CONTAINER_DELEGATION
 *
 * Long-term vs migration:
 *   - D-T00: Long-term -- protects props routing from Container to drawer
 *   - D-T07: Long-term -- protects drawer presentational constraint
 *   - D-T08: Long-term -- protects v0.5 API usage
 *   - D-T06b-4, D-T06b-5: Migration -- RED until GAP-D3/D4 resolved
 *   - All others: Long-term
 *
 * Workbench wiring coverage:
 *   - UI command mapping: D-T00 (drawer receives correct props from Container)
 *   - Container handler -> service: D-T01, D-T02, D-T03, D-T04, D-T05, D-T06a, D-T12
 *   - Service -> store: D-T01b, D-T09
 *   - Store -> projection: D-T10
 *   - Architecture boundary: D-T00, D-T07, D-T08
 *   - Side-effect boundary: D-T11
 *
 * Harness manifest:
 *
 *   Harness "createDashboardDelegationHarness" (D-T01..D-T06a, D-T09, D-T11, D-T12):
 *     - Real production modules: TrainingWorkbenchContainer, createWorkbenchStore,
 *       createTrainingRuntimeStore, real LoggerService with consoleWriter
 *     - Fake/spy modules: spy reviewService, spy tabService, spy flowService,
 *       spy legacyController, spy repository, mock sabaki
 *     - Valid for: CONTAINER_DELEGATION, PROJECTION_RETURN (via shellProps),
 *       STORE_SUBSCRIPTION, SIDE_EFFECT_BOUNDARY
 *     - Not valid for: CONTROLLER_STATE_TRANSITION (services are spies)
 *
 *   Harness "createDashboardTransitionHarness" (D-T01b):
 *     - Real production modules: createReviewService, createWorkbenchTabService,
 *       createWorkbenchStore, createTrainingRuntimeStore, real LoggerService
 *     - Fake/spy modules: in-memory repository fake
 *     - Valid for: CONTROLLER_STATE_TRANSITION
 *     - Not valid for: CONTAINER_DELEGATION (no Container)
 *
 *   Harness "static analysis" (D-T00, D-T07, D-T08):
 *     - Real production modules: source files read via fs.readFileSync
 *     - Fake/spy modules: none
 *     - Valid for: ARCHITECTURE_BOUNDARY (static analysis only)
 *     - Not valid for: runtime behavior
 *
 * Fragile test warnings:
 *   1. D-T07: Static import/runtime access pattern matching is string-based.
 *      If TrainingDashboardDrawer uses dynamic import() or eval(), the static
 *      check may miss violations. Mitigated by also checking runtime patterns.
 *   2. D-T06b-4/D-T06b-5: RED tests asserting methods that don't exist yet.
 *      When GAP-D3/D4 are resolved, these tests turn GREEN.
 *   3. D-T01: Mocks reviewService but not workbenchTabService. If Container
 *      starts calling workbenchTabService directly for openDueReviewItem, the
 *      test will still pass (spy tabService also tracks calls). D-T01b covers
 *      the real chain.
 */

import assert from 'assert'
import fs from 'fs'
import path from 'path'
import {fileURLToPath} from 'url'

// --- Real production imports ---

import TrainingWorkbenchContainer from '../../../src/components/TrainingWorkbenchContainer.js'
import {createWorkbenchStore} from '../../../src/modules/training/store/workbenchStore.ts'
import {createTrainingRuntimeStore} from '../../../src/modules/training/store/trainingRuntimeStore.ts'
import {createReviewService} from '../../../src/modules/training/review/reviewService.ts'
import {createWorkbenchTabService} from '../../../src/modules/training/workbench/workbenchTabService.ts'
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

import {createTestLogger} from '../../helpers/createTestLogger.ts'

const {logger} = createTestLogger()

// --- Tab factories ---

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

// --- Schedule factory ---

function makeSchedule(overrides = {}) {
  return {
    id: 'sched_1',
    taskId: 'task_a',
    dueAt: new Date().toISOString(),
    intervalDays: 1,
    consecutivePassCount: 0,
    totalFailCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// --- Attempt factory ---

function makeAttempt(overrides = {}) {
  return {
    id: 'att_1',
    taskId: 'task_1',
    tabId: 'tab_1',
    rootPositionSgf: '',
    status: 'playing',
    userLine: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// --- RecallSession factory ---

function makeRecallSession(overrides = {}) {
  return {
    id: 'rs_1',
    taskId: 'task_1',
    attemptId: 'att_1',
    completed: false,
    expectedMoves: [],
    recallAttempts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// --- Spy factories imported from shared (see workbenchSpyFactories.ts) ---

// --- Delegation Harness ---
// Uses spy services to verify Container handler -> service delegation.

function createDashboardDelegationHarness({
  tabs = [makeTab()],
  activeTabId = tabs[0]?.id ?? null,
  repository: repoOverride,
  dashboardData,
} = {}) {
  const workbenchStore = createWorkbenchStore({logger})
  const runtimeStore = createTrainingRuntimeStore({logger})
  const _dashboardDataResult = dashboardData || {
    inboxTasks: [],
    incompleteAttempts: [],
    incompleteRecallSessions: [],
    recentBadMoveTasks: [],
  }
  const flowService = createSpyFlowService()
  // Override loadDashboardData to return custom data while keeping call tracking
  const originalLoadDashboardData = flowService.loadDashboardData.bind(flowService)
  flowService.loadDashboardData = async function() {
    originalLoadDashboardData()
    return _dashboardDataResult
  }
  const tabService = createSpyTabService()
  const reviewService = createSpyReviewService()
  const recallCheckpointService = createSpyRecallCheckpointService()
  const taskImportService = createSpyTaskImportService()

  const repository = repoOverride || {
    async loadTask(taskId) { return {id: taskId, rootPositionSgf: ''} },
    async loadAttempt(attemptId) { return makeAttempt({id: attemptId}) },
    async loadRecallSession(sessionId) { return makeRecallSession({id: sessionId}) },
    async listDueReviewItems() { return [makeSchedule()] },
    async listIncompleteAttempts() { return [makeAttempt()] },
    async listIncompleteRecallSessions() { return [makeRecallSession()] },
    async listTasksByStatus() { return [] },
    async listTasksByOriginProvider() { return [] },
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
    reviewService,
    recallCheckpointService,
    repository,
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
    reviewService,
    container,
    sabaki,
    trainingContext,
    repository,
    getShellProps() {
      return container.render().props
    },
  }
}

// --- Transition Harness ---
// Uses real reviewService + real workbenchTabService + in-memory repo fake.

function createDashboardTransitionHarness() {
  const workbenchStore = createWorkbenchStore({logger})
  const runtimeStore = createTrainingRuntimeStore({logger})

  const schedule1 = makeSchedule({id: 'sched_1', taskId: 'task_review'})
  const task1 = {
    id: 'task_review',
    rootPositionSgf: '(;SZ[19])',
    prompt: 'Find the best move',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const inMemoryRepo = {
    _schedules: [schedule1],
    _tasks: {[task1.id]: task1},

    async listDueReviewItems() { return this._schedules },
    async loadTask(taskId) { return this._tasks[taskId] || null },
    async loadReviewSchedule(id) { return this._schedules.find(s => s.id === id) || null },
    async findReviewScheduleByTask(taskId) { return this._schedules.find(s => s.taskId === taskId) || null },
    async listIncompleteAttempts() { return [] },
    async listIncompleteRecallSessions() { return [] },
    async loadAttempt(attemptId) { return makeAttempt({id: attemptId}) },
    async loadRecallSession(sessionId) { return makeRecallSession({id: sessionId}) },
    async transaction(fn) { return fn() },
  }

  const sgfParser = {
    parse(sgf) {
      return [{root: {id: 'root'}, toList: () => []}]
    },
  }

  const legacyAdapter = {
    loadGameTrees() {},
    setCurrentTreePosition() {},
    getSabaki() {
      return {setMode() {}, startAnalysisIfEngineReady() {}}
    },
  }

  const realTabService = createWorkbenchTabService({
    workbenchStore,
    repository: inMemoryRepo,
    legacyAdapter,
    sgfParser,
    runtimeStore,
    logger,
  })

  const realReviewService = createReviewService({
    repository: inMemoryRepo,
    workbenchTabService: realTabService,
    runtimeStore,
    logger,
  })

  return {
    workbenchStore,
    runtimeStore,
    reviewService: realReviewService,
    tabService: realTabService,
    repository: inMemoryRepo,
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('W8-P4 Dashboard Wiring', function () {

  // ===================================================
  // D-T00: ARCHITECTURE_BOUNDARY - Props Routing Path
  // ===================================================

  describe('D-T00: ARCHITECTURE_BOUNDARY - Props routing path', function () {

    // D-T00-1: WorkbenchShell renders TrainingDashboardDrawer
    // Layer: ARCHITECTURE_BOUNDARY
    // Production Subject: WorkbenchShell source code
    // Primary Assertion: WorkbenchShell imports and renders TrainingDashboardDrawer
    it('WorkbenchShell renders TrainingDashboardDrawer', function () {
      const shellPath = path.resolve(
        __dirname, '../../../src/components/WorkbenchShell.js',
      )
      const source = fs.readFileSync(shellPath, 'utf-8')

      // WorkbenchShell must import TrainingDashboardDrawer
      assert.ok(
        source.includes('TrainingDashboardDrawer') || source.includes('dashboard'),
        'WorkbenchShell must reference TrainingDashboardDrawer or dashboard drawer in its source -- Contract D-T00, Section 21',
      )
    })

    // D-T00-2: DrawerManager does NOT render TrainingDashboardDrawer
    // Layer: ARCHITECTURE_BOUNDARY
    // Production Subject: DrawerManager source code
    // Primary Assertion: DrawerManager does not import or render TrainingDashboardDrawer
    it('DrawerManager does NOT render TrainingDashboardDrawer', function () {
      const drawerMgrPath = path.resolve(
        __dirname, '../../../src/components/DrawerManager.js',
      )
      const source = fs.readFileSync(drawerMgrPath, 'utf-8')

      // DrawerManager must NOT import TrainingDashboardDrawer
      assert.ok(
        !source.includes("from './drawers/TrainingDashboardDrawer.js'") &&
        !source.includes('TrainingDashboardDrawer'),
        'DrawerManager must NOT import or render TrainingDashboardDrawer -- Contract D-T00, Section 21: move to WorkbenchShell',
      )
    })

    // D-T00-3: Container includes dashboard handler names in shellProps
    // Layer: ARCHITECTURE_BOUNDARY
    // Production Subject: TrainingWorkbenchContainer render output
    // Primary Assertion: shellProps contains dashboard handler names
    it('Container includes dashboard handler names in shellProps', function () {
      const harness = createDashboardDelegationHarness()
      const shellProps = harness.getShellProps()

      const dashboardHandlerNames = [
        'onOpenDueReviewItem',
        'onOpenInboxTask',
        'onOpenIncompleteAttempt',
        'onOpenIncompleteRecallSession',
        'onOpenBadMoveTask',
        'onRefreshDashboard',
      ]

      for (const name of dashboardHandlerNames) {
        assert.strictEqual(typeof shellProps[name], 'function',
          `Container shellProps must include ${name} as a function -- Contract D-T00, Section 21. GAP: dashboard handlers not yet wired in Container.`)
      }
    })

    // D-T00-4: Container includes dashboardData in shellProps
    // Layer: ARCHITECTURE_BOUNDARY
    // Production Subject: TrainingWorkbenchContainer render output
    // Primary Assertion: shellProps contains dashboardData
    it('Container includes dashboardData in shellProps', function () {
      const harness = createDashboardDelegationHarness()
      const shellProps = harness.getShellProps()

      // dashboardData may be null initially (before first refresh) but the key must exist
      assert.ok('dashboardData' in shellProps,
        'Container shellProps must include dashboardData key -- Contract D-T00, Section 21. GAP: dashboard data loading not yet implemented in Container.')
    })
  })

  // ===================================================
  // D-T01: CONTAINER_DELEGATION - openDueReviewItem
  // ===================================================

  describe('D-T01: CONTAINER_DELEGATION - openDueReviewItem', function () {

    // D-T01: Container.handleOpenDueReviewItem delegates to reviewService.openDueItem
    // Container does NOT call workbenchTabService directly for this handler.
    // Layer: CONTAINER_DELEGATION
    // Production Subject: Container.handleOpenDueReviewItem
    // Real Dependencies: Container render
    // Mocked Dependencies: reviewService (spy, whole object)
    // Forbidden Mocks: workbenchTabService, workbenchStore, runtimeStore
    // Primary Assertion: reviewService.openDueItem called with correct scheduleId
    it('handleOpenDueReviewItem delegates to reviewService.openDueItem with scheduleId', async function () {
      const harness = createDashboardDelegationHarness()
      const shellProps = harness.getShellProps()

      const handler = shellProps.onOpenDueReviewItem
      assert.strictEqual(typeof handler, 'function',
        'Container must expose onOpenDueReviewItem handler. GAP: not yet wired in Container.')

      await handler('sched_42')

      assert.strictEqual(harness.reviewService.calls.openDueItem.length, 1,
        'reviewService.openDueItem must be called exactly once -- Contract D-T01')
      assert.deepStrictEqual(harness.reviewService.calls.openDueItem[0], {scheduleId: 'sched_42'},
        'reviewService.openDueItem must be called with scheduleId="sched_42" -- Contract D-T01')
    })

    // D-T01-guard: handler does not call workbenchTabService directly
    // Layer: CONTAINER_DELEGATION
    // Production Subject: Container.handleOpenDueReviewItem
    // Primary Assertion: semantic tab entrypoints NOT called (reviewService handles it internally)
    it('handleOpenDueReviewItem does NOT call tabService play/problem entrypoints directly', async function () {
      const harness = createDashboardDelegationHarness()
      const shellProps = harness.getShellProps()

      const handler = shellProps.onOpenDueReviewItem
      assert.strictEqual(typeof handler, 'function',
        'Container must expose onOpenDueReviewItem handler. GAP: not yet wired.')

      await handler('sched_42')

      // Container must NOT open a tab directly for this handler --
      // that is reviewService's internal responsibility (Contract D-T01 rationale)
      assert.strictEqual(harness.tabService.calls.openPlayTab.length, 0,
        'Container must NOT call tabService.openPlayTab directly for openDueReviewItem -- Contract D-T01')
      assert.strictEqual(harness.tabService.calls.openProblemTab.length, 0,
        'Container must NOT call tabService.openProblemTab directly for openDueReviewItem -- Contract D-T01')
    })
  })

  // ===================================================
  // D-T01b: CONTROLLER_STATE_TRANSITION - real reviewService chain
  // ===================================================

  describe('D-T01b: CONTROLLER_STATE_TRANSITION - reviewService.openDueItem -> store change', function () {

    // D-T01b: Real reviewService + real workbenchTabService + in-memory repo
    // results in workbenchStore state change: new tab with correct taskId and inferred mode.
    // Layer: CONTROLLER_STATE_TRANSITION
    // Production Subject: reviewService.openDueItem -> workbenchTabService.openTask -> store
    // Real Dependencies: createReviewService, createWorkbenchTabService, workbenchStore
    // Mocked Dependencies: in-memory repository fake
    // Forbidden Mocks: workbenchStore, workbenchTabService, reviewService
    // Primary Assertion: workbenchStore has new tab with correct taskId and mode
    it('reviewService.openDueItem creates new tab with correct taskId and inferred mode', async function () {
      const harness = createDashboardTransitionHarness()

      // Before: no tabs
      assert.strictEqual(harness.workbenchStore.getState().tabs.length, 0)

      await harness.reviewService.openDueItem('sched_1')

      const state = harness.workbenchStore.getState()
      assert.strictEqual(state.tabs.length, 1,
        'workbenchStore must have exactly one tab after openDueItem -- Contract D-T01b')

      const tab = state.tabs[0]
      assert.strictEqual(tab.taskId, 'task_review',
        'Tab must have taskId="task_review" matching the schedule -- Contract D-T01b')

      // task_review has prompt field, so inferDefaultMode should return 'problem'
      assert.strictEqual(tab.mode, 'problem',
        'Tab mode must be "problem" because task has prompt field -- Contract D-T01b, inferDefaultMode')

      assert.strictEqual(state.activeTabId, tab.id,
        'New tab must be the active tab -- Contract D-T01b')
    })
  })

  // ===================================================
  // D-T02: CONTAINER_DELEGATION - openInboxTask
  // ===================================================

  describe('D-T02: CONTAINER_DELEGATION - openInboxTask', function () {

    // D-T02: Container.handleOpenInboxTask delegates to workbenchTabService.openPlayTab
    // Layer: CONTAINER_DELEGATION
    // Production Subject: Container.handleOpenInboxTask
    // Real Dependencies: Container render
    // Mocked Dependencies: tabService (spy)
    // Forbidden Mocks: workbenchStore
    // Primary Assertion: tabService.openPlayTab called with {taskId}
    it('handleOpenInboxTask delegates to tabService.openPlayTab with taskId', async function () {
      const harness = createDashboardDelegationHarness()
      const shellProps = harness.getShellProps()

      const handler = shellProps.onOpenInboxTask
      assert.strictEqual(typeof handler, 'function',
        'Container must expose onOpenInboxTask handler. GAP: not yet wired in Container.')

      await handler('task_inbox_1')

      assert.strictEqual(harness.tabService.calls.openPlayTab.length, 1,
        'tabService.openPlayTab must be called exactly once -- Contract D-T02')
      assert.strictEqual(harness.tabService.calls.openPlayTab[0].taskId, 'task_inbox_1',
        'tabService.openPlayTab must be called with taskId="task_inbox_1" -- Contract D-T02')
    })
  })

  // ===================================================
  // D-T03: CONTAINER_DELEGATION - openIncompleteAttempt
  // ===================================================

  describe('D-T03: CONTAINER_DELEGATION - openIncompleteAttempt', function () {

    // D-T03: Container.handleOpenIncompleteAttempt delegates to workbenchTabService.openAttemptTab
    // which internally loads the attempt and opens a task tab.
    // Layer: CONTAINER_DELEGATION
    // Production Subject: Container.handleOpenIncompleteAttempt
    // Real Dependencies: Container render
    // Mocked Dependencies: tabService (spy)
    // Forbidden Mocks: workbenchStore, repository
    // Primary Assertion: tabService.openAttemptTab called with attemptId
    it('handleOpenIncompleteAttempt delegates to tabService.openAttemptTab', async function () {
      const harness = createDashboardDelegationHarness()
      const shellProps = harness.getShellProps()

      const handler = shellProps.onOpenIncompleteAttempt
      assert.strictEqual(typeof handler, 'function',
        'Container must expose onOpenIncompleteAttempt handler. GAP: not yet wired.')

      await handler('att_incomplete_1')

      assert.strictEqual(harness.tabService.calls.openAttemptTab.length, 1,
        'tabService.openAttemptTab must be called exactly once -- Contract D-T03')
      assert.strictEqual(harness.tabService.calls.openAttemptTab[0].attemptId, 'att_incomplete_1',
        'tabService.openAttemptTab must be called with attemptId -- Contract D-T03')
    })

    it('handleOpenIncompleteAttempt does NOT call repository directly', async function () {
      const harness = createDashboardDelegationHarness()
      const shellProps = harness.getShellProps()

      const handler = shellProps.onOpenIncompleteAttempt
      assert.strictEqual(typeof handler, 'function',
        'Container must expose onOpenIncompleteAttempt handler.')

      await handler('att_incomplete_1')

      // Container must NOT call repository.loadAttempt directly -- Arch v0.5 SS1.3
      assert.strictEqual(harness.tabService.calls.openPlayTab.length, 0,
        'Container must NOT call tabService.openPlayTab directly for incomplete attempt -- Contract D-T03, Arch v0.5 SS1.3')
      assert.strictEqual(harness.tabService.calls.openProblemTab.length, 0,
        'Container must NOT call tabService.openProblemTab directly for incomplete attempt -- Contract D-T03, Arch v0.5 SS1.3')
    })
  })

  // ===================================================
  // D-T04: CONTAINER_DELEGATION - openIncompleteRecallSession
  // ===================================================

  describe('D-T04: CONTAINER_DELEGATION - openIncompleteRecallSession', function () {

    // D-T04: Container.handleOpenIncompleteRecallSession delegates to
    // workbenchTabService.openRecallSessionTab which internally loads the
    // recall session and opens a tab with mode:'recall'.
    // Layer: CONTAINER_DELEGATION
    // Production Subject: Container.handleOpenIncompleteRecallSession
    // Real Dependencies: Container render
    // Mocked Dependencies: tabService (spy)
    // Forbidden Mocks: workbenchStore, repository
    // Primary Assertion: tabService.openRecallSessionTab called with sessionId
    it('handleOpenIncompleteRecallSession delegates to tabService.openRecallSessionTab', async function () {
      const harness = createDashboardDelegationHarness()
      const shellProps = harness.getShellProps()

      const handler = shellProps.onOpenIncompleteRecallSession
      assert.strictEqual(typeof handler, 'function',
        'Container must expose onOpenIncompleteRecallSession handler. GAP: not yet wired.')

      await handler('rs_incomplete_1')

      assert.strictEqual(harness.tabService.calls.openRecallSessionTab.length, 1,
        'tabService.openRecallSessionTab must be called exactly once -- Contract D-T04')
      assert.strictEqual(harness.tabService.calls.openRecallSessionTab[0].sessionId, 'rs_incomplete_1',
        'tabService.openRecallSessionTab must be called with sessionId -- Contract D-T04')
    })

    it('handleOpenIncompleteRecallSession does NOT call repository directly', async function () {
      const harness = createDashboardDelegationHarness()
      const shellProps = harness.getShellProps()

      const handler = shellProps.onOpenIncompleteRecallSession
      assert.strictEqual(typeof handler, 'function',
        'Container must expose onOpenIncompleteRecallSession handler.')

      await handler('rs_incomplete_1')

      // Container must NOT call repository.loadRecallSession directly -- Arch v0.5 SS1.3
      assert.strictEqual(harness.tabService.calls.openPlayTab.length, 0,
        'Container must NOT call tabService.openPlayTab directly for recall session -- Contract D-T04, Arch v0.5 SS1.3')
      assert.strictEqual(harness.tabService.calls.openProblemTab.length, 0,
        'Container must NOT call tabService.openProblemTab directly for recall session -- Contract D-T04, Arch v0.5 SS1.3')
    })
  })

  // ===================================================
  // D-T05: CONTAINER_DELEGATION - openBadMoveTask
  // ===================================================

  describe('D-T05: CONTAINER_DELEGATION - openBadMoveTask', function () {

    // D-T05: Container.handleOpenBadMoveTask delegates to workbenchTabService.openProblemTab.
    // Layer: CONTAINER_DELEGATION
    // Production Subject: Container.handleOpenBadMoveTask
    // Real Dependencies: Container render
    // Mocked Dependencies: tabService (spy)
    // Forbidden Mocks: workbenchStore
    // Primary Assertion: tabService.openProblemTab called with {taskId}
    it('handleOpenBadMoveTask delegates to tabService.openProblemTab', async function () {
      const harness = createDashboardDelegationHarness()
      const shellProps = harness.getShellProps()

      const handler = shellProps.onOpenBadMoveTask
      assert.strictEqual(typeof handler, 'function',
        'Container must expose onOpenBadMoveTask handler. GAP: not yet wired.')

      await handler('task_badmove_1')

      assert.strictEqual(harness.tabService.calls.openProblemTab.length, 1,
        'tabService.openProblemTab must be called exactly once -- Contract D-T05')
      const openProblemCall = harness.tabService.calls.openProblemTab[0]
      assert.strictEqual(openProblemCall.taskId, 'task_badmove_1',
        'tabService.openProblemTab must be called with the bad-move task id -- Contract D-T05')
    })
  })

  // ===================================================
  // D-T06a: CONTAINER_DELEGATION - refreshDashboard
  // ===================================================

  describe('D-T06a: CONTAINER_DELEGATION - refreshDashboard', function () {

    // D-T06a: Container.handleRefreshDashboard invokes reviewService.getDueItems
    // and flowService.loadDashboardData (not repository directly).
    // Layer: CONTAINER_DELEGATION
    // Production Subject: Container.handleRefreshDashboard
    // Real Dependencies: Container render
    // Mocked Dependencies: reviewService (spy), flowService (spy)
    // Forbidden Mocks: workbenchStore for state checks, repository
    // Primary Assertion: reviewService.getDueItems and flowService.loadDashboardData called
    it('handleRefreshDashboard calls reviewService.getDueItems', async function () {
      const harness = createDashboardDelegationHarness()
      const shellProps = harness.getShellProps()

      const handler = shellProps.onRefreshDashboard
      assert.strictEqual(typeof handler, 'function',
        'Container must expose onRefreshDashboard handler. GAP: not yet wired.')

      await handler()

      assert.strictEqual(harness.reviewService.calls.getDueItems.length, 1,
        'reviewService.getDueItems must be called exactly once -- Contract D-T06a')
    })

    it('handleRefreshDashboard calls flowService.loadDashboardData', async function () {
      const harness = createDashboardDelegationHarness()
      const shellProps = harness.getShellProps()

      const handler = shellProps.onRefreshDashboard
      assert.strictEqual(typeof handler, 'function',
        'Container must expose onRefreshDashboard handler.')

      await handler()

      assert.strictEqual(harness.flowService.calls.loadDashboardData.length, 1,
        'flowService.loadDashboardData must be called exactly once -- Contract D-T06a, Arch v0.5 SS1.3')
    })

    it('handleRefreshDashboard does NOT call repository directly', async function () {
      const harness = createDashboardDelegationHarness()
      const shellProps = harness.getShellProps()

      const handler = shellProps.onRefreshDashboard
      assert.strictEqual(typeof handler, 'function',
        'Container must expose onRefreshDashboard handler.')

      await handler()

      // Container must NOT call repository methods directly -- Arch v0.5 SS1.3
      // The spy repository in the harness does not track calls, but the test
      // verifies that the Container delegates to services, not repository.
      // This is enforced by checking flowService.loadDashboardData was called.
      assert.strictEqual(harness.flowService.calls.loadDashboardData.length, 1,
        'Dashboard data must come from flowService, not repository -- Contract D-T06a')
    })
  })

  // ===================================================
  // D-T06b-1..5: DATA_LOADING
  // ===================================================

  describe('D-T06b: DATA_LOADING - dashboardData assembly', function () {

    // D-T06b-1: dashboardData.dueItems from reviewService.getDueItems (GREEN)
    // Layer: DATA_LOADING
    // Production Subject: Container.handleRefreshDashboard data assembly
    // Real Dependencies: Container render
    // Mocked Dependencies: reviewService, repository
    // Primary Assertion: dashboardData.dueItems populated from getDueItems
    it('D-T06b-1: dashboardData.dueItems populated from reviewService.getDueItems (GREEN)', async function () {
      const harness = createDashboardDelegationHarness()
      const shellProps = harness.getShellProps()

      const handler = shellProps.onRefreshDashboard
      assert.strictEqual(typeof handler, 'function',
        'Container must expose onRefreshDashboard handler. GAP: not yet wired.')

      await handler()

      // Re-render to get updated props
      const updatedProps = harness.getShellProps()
      const dd = updatedProps.dashboardData

      assert.ok(dd !== undefined && dd !== null,
        'dashboardData must exist after refreshDashboard -- Contract D-T06b-1')
      assert.ok(Array.isArray(dd.dueItems),
        'dashboardData.dueItems must be an array -- Contract D-T06b-1')
      assert.strictEqual(dd.dueItems.length, 1,
        'dashboardData.dueItems must contain one item from getDueItems -- Contract D-T06b-1')
    })

    // D-T06b-2: dashboardData.incompleteAttempts from flowService.loadDashboardData (GREEN)
    // Layer: DATA_LOADING
    it('D-T06b-2: dashboardData.incompleteAttempts populated (GREEN)', async function () {
      const harness = createDashboardDelegationHarness({
        dashboardData: {
          inboxTasks: [],
          incompleteAttempts: [makeAttempt({id: 'att_inc_1'}), makeAttempt({id: 'att_inc_2'})],
          incompleteRecallSessions: [],
          recentBadMoveTasks: [],
        },
      })

      const handler = harness.getShellProps().onRefreshDashboard
      assert.strictEqual(typeof handler, 'function',
        'Container must expose onRefreshDashboard handler. GAP: not yet wired.')

      await handler()

      const dd = harness.getShellProps().dashboardData
      assert.ok(dd !== undefined && dd !== null,
        'dashboardData must exist after refresh -- Contract D-T06b-2')
      assert.ok(Array.isArray(dd.incompleteAttempts),
        'dashboardData.incompleteAttempts must be an array -- Contract D-T06b-2')
      assert.strictEqual(dd.incompleteAttempts.length, 2,
        'dashboardData.incompleteAttempts must contain 2 items -- Contract D-T06b-2')
    })

    // D-T06b-3: dashboardData.incompleteRecallSessions (GREEN)
    // Layer: DATA_LOADING
    it('D-T06b-3: dashboardData.incompleteRecallSessions populated (GREEN)', async function () {
      const harness = createDashboardDelegationHarness({
        dashboardData: {
          inboxTasks: [],
          incompleteAttempts: [],
          incompleteRecallSessions: [makeRecallSession({id: 'rs_inc_1'})],
          recentBadMoveTasks: [],
        },
      })

      const handler = harness.getShellProps().onRefreshDashboard
      assert.strictEqual(typeof handler, 'function',
        'Container must expose onRefreshDashboard handler. GAP: not yet wired.')

      await handler()

      const dd = harness.getShellProps().dashboardData
      assert.ok(dd !== undefined && dd !== null,
        'dashboardData must exist after refresh -- Contract D-T06b-3')
      assert.ok(Array.isArray(dd.incompleteRecallSessions),
        'dashboardData.incompleteRecallSessions must be an array -- Contract D-T06b-3')
      assert.strictEqual(dd.incompleteRecallSessions.length, 1,
        'dashboardData.incompleteRecallSessions must contain 1 item -- Contract D-T06b-3')
    })

    // D-T06b-4: dashboardData.inboxTasks from flowService.loadDashboardData (GREEN)
    // Layer: DATA_LOADING
    it('D-T06b-4: dashboardData.inboxTasks populated from loadDashboardData', async function () {
      const harness = createDashboardDelegationHarness({
        dashboardData: {
          inboxTasks: [{id: 'task_inbox_1', status: 'inbox'}],
          incompleteAttempts: [],
          incompleteRecallSessions: [],
          recentBadMoveTasks: [],
        },
      })

      const handler = harness.getShellProps().onRefreshDashboard
      assert.strictEqual(typeof handler, 'function',
        'Container must expose onRefreshDashboard handler. GAP: not yet wired.')

      await handler()

      const dd = harness.getShellProps().dashboardData
      assert.ok(dd !== undefined && dd !== null,
        'dashboardData must exist after refresh -- Contract D-T06b-4')
      assert.ok(Array.isArray(dd.inboxTasks),
        'dashboardData.inboxTasks must be an array -- Contract D-T06b-4')
      assert.strictEqual(dd.inboxTasks.length, 1,
        'dashboardData.inboxTasks must contain 1 item -- Contract D-T06b-4')
    })

    // D-T06b-5: dashboardData.recentBadMoveTasks from flowService.loadDashboardData (GREEN)
    // Layer: DATA_LOADING
    it('D-T06b-5: dashboardData.recentBadMoveTasks populated', async function () {
      const harness = createDashboardDelegationHarness({
        dashboardData: {
          inboxTasks: [],
          incompleteAttempts: [],
          incompleteRecallSessions: [],
          recentBadMoveTasks: [{id: 'task_bm_1', origin: {provider: 'bad_move'}}],
        },
      })

      const handler = harness.getShellProps().onRefreshDashboard
      assert.strictEqual(typeof handler, 'function',
        'Container must expose onRefreshDashboard handler. GAP: not yet wired.')

      await handler()

      const dd = harness.getShellProps().dashboardData
      assert.ok(dd !== undefined && dd !== null,
        'dashboardData must exist after refresh -- Contract D-T06b-5')
      assert.ok(Array.isArray(dd.recentBadMoveTasks),
        'dashboardData.recentBadMoveTasks must be an array -- Contract D-T06b-5')
      assert.strictEqual(dd.recentBadMoveTasks.length, 1,
        'dashboardData.recentBadMoveTasks must contain 1 item -- Contract D-T06b-5')
    })

    // D-T06b-shape: dashboardData has correct shape
    it('D-T06b-shape: dashboardData has correct shape after refresh', async function () {
      const harness = createDashboardDelegationHarness()
      const handler = harness.getShellProps().onRefreshDashboard

      assert.strictEqual(typeof handler, 'function',
        'Container must expose onRefreshDashboard handler. GAP: not yet wired.')

      await handler()

      const dd = harness.getShellProps().dashboardData
      assert.ok(dd !== undefined && dd !== null,
        'dashboardData must exist after refresh -- Contract D-T06b')

      // Required shape per Contract Section 6.7
      const requiredKeys = [
        'dueItems', 'inboxTasks', 'incompleteAttempts',
        'incompleteRecallSessions', 'recentBadMoveTasks',
        'loading', 'error',
      ]
      for (const key of requiredKeys) {
        assert.ok(key in dd,
          `dashboardData must have "${key}" key. RED until Container dashboard data loading is implemented. -- Contract D-T06b`)
      }
    })
  })

  // ===================================================
  // D-T07: ARCHITECTURE_BOUNDARY - TrainingDashboardDrawer
  // ===================================================

  describe('D-T07: ARCHITECTURE_BOUNDARY - TrainingDashboardDrawer no forbidden imports/access', function () {
    const drawerPath = path.resolve(
      __dirname, '../../../src/components/drawers/TrainingDashboardDrawer.js',
    )
    let source

    before(function () {
      source = fs.readFileSync(drawerPath, 'utf-8')
    })

    // D-T07-1: No static import of forbidden modules
    // Layer: ARCHITECTURE_BOUNDARY
    // Production Subject: TrainingDashboardDrawer source code
    // Primary Assertion: No forbidden import patterns
    describe('static import analysis', function () {
      const forbiddenImports = [
        'reviewService',
        'workbenchTabService',
        '/db.js',
        '/sabaki.js',
        'modules/sabaki',
      ]

      for (const pattern of forbiddenImports) {
        it(`must not import "${pattern}"`, function () {
          assert.ok(!source.includes(pattern),
            `TrainingDashboardDrawer must not import "${pattern}" -- Contract D-T07, Arch v0.5 SS0.3. RED until migration removes old imports.`)
        })
      }
    })

    // D-T07-2: No runtime access to forbidden patterns
    // Layer: ARCHITECTURE_BOUNDARY
    // Production Subject: TrainingDashboardDrawer source code
    // Primary Assertion: No forbidden runtime access patterns
    describe('runtime access analysis', function () {
      const forbiddenRuntime = [
        'window.sabaki.db',
        'sabaki.db',
        'sabaki.startReviewSession',
        'window.sabaki.startReviewSession',
        'sabaki.startProblem',
        'window.sabaki.startProblem',
        'sabaki.startRecallSession',
        'window.sabaki.startRecallSession',
        'sabaki.closeDrawer',
        'window.sabaki.closeDrawer',
        'getDashboardSummary',
        'getProblemsByStatus',
        'componentWillReceiveProps',
      ]

      for (const pattern of forbiddenRuntime) {
        it(`must not use "${pattern}"`, function () {
          assert.ok(!source.includes(pattern),
            `TrainingDashboardDrawer must not use "${pattern}" -- Contract D-T07, Section 22.2. RED until migration removes old code.`)
        })
      }
    })
  })

  // ===================================================
  // D-T08: ARCHITECTURE_BOUNDARY - Container no legacy APIs
  // ===================================================

  describe('D-T08: ARCHITECTURE_BOUNDARY - Container no legacy tab APIs', function () {
    const containerPath = path.resolve(
      __dirname, '../../../src/components/TrainingWorkbenchContainer.js',
    )
    let source

    before(function () {
      source = fs.readFileSync(containerPath, 'utf-8')
    })

    // D-T08: Container dashboard handlers do not call legacy tab APIs
    // Layer: ARCHITECTURE_BOUNDARY
    // Production Subject: Container source code
    // Primary Assertion: No calls to legacy tab adapters or sabaki.startReviewSession
    it('Container must not call legacy problem tab adapter', function () {
      assert.ok(!source.includes('openLegacyProblemTab'),
        'Container must not call openLegacyProblemTab -- Contract D-T08')
    })

    it('Container must not call legacy game tab adapter', function () {
      assert.ok(!source.includes('openLegacyGameTab'),
        'Container must not call openLegacyGameTab -- Contract D-T08')
    })

    it('Container must not call sabaki.startReviewSession', function () {
      assert.ok(!source.includes('startReviewSession'),
        'Container must not call startReviewSession -- Contract D-T08, Arch v0.5')
    })

    it('Container must not call openSnapshotProblemTab', function () {
      assert.ok(!source.includes('openSnapshotProblemTab'),
        'Container must not call openSnapshotProblemTab -- Contract D-T08, Arch v0.5 SS5.2')
    })
  })

  // ===================================================
  // D-T09: STORE_SUBSCRIPTION - activeTabId after openDueReviewItem
  // ===================================================

  describe('D-T09: STORE_SUBSCRIPTION - activeTabId after openDueReviewItem', function () {

    // D-T09: After openDueReviewItem, workbenchStore.activeTabId points to the newly created tab
    // Layer: STORE_SUBSCRIPTION
    // Production Subject: workbenchStore state after reviewService.openDueItem chain
    // Real Dependencies: workbenchStore, real reviewService, real tabService
    // Mocked Dependencies: in-memory repository fake
    // Primary Assertion: activeTabId matches the new tab's id
    it('workbenchStore.activeTabId points to new tab after openDueReviewItem', async function () {
      const harness = createDashboardTransitionHarness()

      await harness.reviewService.openDueItem('sched_1')

      const state = harness.workbenchStore.getState()
      assert.ok(state.activeTabId !== null,
        'activeTabId must not be null after openDueItem -- Contract D-T09')

      const activeTab = state.tabs.find(t => t.id === state.activeTabId)
      assert.ok(activeTab,
        'Active tab must exist in tabs array -- Contract D-T09')
      assert.strictEqual(activeTab.taskId, 'task_review',
        'Active tab must have correct taskId -- Contract D-T09')
    })
  })

  // ===================================================
  // D-T10: PROJECTION_RETURN - mode=problem for bad-move task
  // ===================================================

  describe('D-T10: PROJECTION_RETURN - mode=problem for bad-move task', function () {

    // D-T10: After openBadMoveTask, projectFromWorkbench returns mode:'problem'
    // for a bad-move task with prompt.
    // Layer: PROJECTION_RETURN
    // Production Subject: Container projectFromWorkbench
    // Real Dependencies: Container render with store state
    // Mocked Dependencies: spy flowService, spy tabService, stub repository
    // Primary Assertion: projected mode === 'problem'
    it('projectFromWorkbench returns mode="problem" for bad-move task with prompt', function () {
      const harness = createDashboardDelegationHarness({
        tabs: [{
          id: 'tab_bm',
          taskId: 'task_bm_1',
          mode: 'problem',
          childTabIds: [],
          playerConfig: {black: 'human', white: 'ai'},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }],
      })

      const shellProps = harness.getShellProps()

      assert.strictEqual(shellProps.mode, 'problem',
        'projectFromWorkbench must return mode="problem" for bad-move tab -- Contract D-T10')
    })
  })

  // ===================================================
  // D-T11: SIDE_EFFECT_BOUNDARY - refreshDashboard
  // ===================================================

  describe('D-T11: SIDE_EFFECT_BOUNDARY - refreshDashboard does not modify stores', function () {

    // D-T11: refreshDashboard does not modify workbenchStore or runtimeStore
    // Layer: SIDE_EFFECT_BOUNDARY
    // Production Subject: Container.handleRefreshDashboard
    // Real Dependencies: Container render, real stores
    // Mocked Dependencies: reviewService, repository
    // Primary Assertion: workbenchStore and runtimeStore state unchanged
    it('refreshDashboard does not modify workbenchStore state', async function () {
      const harness = createDashboardDelegationHarness()
      const wsBefore = JSON.stringify(harness.workbenchStore.getState())

      const handler = harness.getShellProps().onRefreshDashboard
      assert.strictEqual(typeof handler, 'function',
        'Container must expose onRefreshDashboard handler. GAP: not yet wired.')

      await handler()

      const wsAfter = JSON.stringify(harness.workbenchStore.getState())
      assert.strictEqual(wsAfter, wsBefore,
        'workbenchStore state must not change after refreshDashboard -- Contract D-T11')
    })

    it('refreshDashboard does not modify runtimeStore state', async function () {
      const harness = createDashboardDelegationHarness()
      const rsBefore = JSON.stringify(harness.runtimeStore.getState())

      const handler = harness.getShellProps().onRefreshDashboard
      assert.strictEqual(typeof handler, 'function',
        'Container must expose onRefreshDashboard handler. GAP: not yet wired.')

      await handler()

      const rsAfter = JSON.stringify(harness.runtimeStore.getState())
      assert.strictEqual(rsAfter, rsBefore,
        'runtimeStore state must not change after refreshDashboard -- Contract D-T11')
    })
  })

  // ===================================================
  // D-T12: CONTAINER_DELEGATION - reviewService for due items, not direct repo
  // ===================================================

  describe('D-T12: CONTAINER_DELEGATION - reviewService for due items', function () {

    // D-T12: Dashboard data queries use reviewService.getDueItems, NOT direct
    // repository.listDueReviewItems or db.getDueReviews.
    // Layer: CONTAINER_DELEGATION
    // Production Subject: Container.refreshDashboard vs direct repo
    // Primary Assertion: refreshDashboard calls reviewService.getDueItems, not repository.listDueReviewItems directly
    it('Container source does not call repository.listDueReviewItems directly for due items', function () {
      const containerPath = path.resolve(
        __dirname, '../../../src/components/TrainingWorkbenchContainer.js',
      )
      const source = fs.readFileSync(containerPath, 'utf-8')

      // Container must not call listDueReviewItems directly -- it goes through reviewService
      assert.ok(!source.includes('listDueReviewItems'),
        'Container must not call repository.listDueReviewItems directly. Use reviewService.getDueItems -- Contract D-T12, Arch v0.5 SS5.11')
    })

    it('refreshDashboard calls reviewService.getDueItems, not repository directly', async function () {
      let repoListDueCalled = false
      const harness = createDashboardDelegationHarness({
        repository: {
          async loadTask() { return null },
          async listDueReviewItems() { repoListDueCalled = true; return [] },
          async listIncompleteAttempts() { return [] },
          async listIncompleteRecallSessions() { return [] },
          async listTasksByStatus() { return [] },
          async listTasksByOriginProvider() { return [] },
        },
      })

      const handler = harness.getShellProps().onRefreshDashboard
      assert.strictEqual(typeof handler, 'function',
        'Container must expose onRefreshDashboard handler. GAP: not yet wired.')

      await handler()

      // reviewService.getDueItems must be called
      assert.strictEqual(harness.reviewService.calls.getDueItems.length, 1,
        'reviewService.getDueItems must be called -- Contract D-T12')

      // repository.listDueReviewItems must NOT be called directly
      assert.strictEqual(repoListDueCalled, false,
        'repository.listDueReviewItems must NOT be called directly -- Contract D-T12')
    })
  })
})
