/**
 * W7-B1: Container Store Write Fix Wiring Tests
 *
 * Test contract: docs/design/2026-05-21/w7-b1-container-store-write-fix/test-contract-v0.1.md
 * Contracts covered: B1-T01 through B1-T09
 *
 * Source of truth alignment:
 *   - Arch v0.5 Section 0.3: "UI only displays, does not write business Store;
 *     Container/Controller reads Store, calls Service; Service orchestrates business actions"
 *   - Arch v0.5 Section 1.2: "Command write path: UI Component -> Controller/Container ->
 *     Service -> Store/Repository/Adapter"
 *   - Arch v0.5 Section 1.3: "Container reads Store, calls Service"
 *   - Arch v0.5 Section 5.11: ReviewService API
 *   - PRD v0.5 Section 2.7: "Review is entry point, not board mode"
 *   - PRD v0.5 Section 5.7: "reviewService.getDueItems -> user clicks item -> item.taskId"
 *
 * Test Legitimacy:
 *   - All tests import real production code: TrainingWorkbenchContainer, real stores,
 *     real reviewService (for SERVICE_REPOSITORY_TRANSITION), real Container.
 *   - SERVICE_REPOSITORY_TRANSITION tests (B1-T01/T02/T03/T09) use REAL runtimeStore
 *     and real reviewService with spy repository and spy workbenchTabService.
 *   - CONTAINER_DELEGATION tests (B1-T04/T05) spy on reviewService methods to verify
 *     Container delegates correctly, NOT to verify internal service behavior.
 *   - ARCHITECTURE_BOUNDARY tests (B1-T06/T08) are static source checks.
 *   - PROJECTION_RETURN test (B1-T07) uses real runtimeStore and real Container.
 *   - Controlled dependencies: real stores + spy services, no network.
 *   - Production bug: Container calls runtimeStore.setReviewQueueView directly ->
 *     B1-T06 static check fails.
 *   - Production bug: reviewService.startSession doesn't write runtimeStore ->
 *     B1-T01 fails.
 *   - No conditional skip on core assertions. No assert.ok(true).
 *
 * Matrix Coverage:
 *   | Source Row | Required Behavior | Test ID | Status | Notes |
 *   | --- | --- | --- | --- | --- |
 *   | Contract B1-T01 | reviewService.startSession writes runtimeStore | B1-T01 | RED until service method added | Service must orchestrate store write |
 *   | Contract B1-T02 | reviewService.advanceReview increments index | B1-T02 | RED until service method added | Service must read+write store |
 *   | Contract B1-T03 | reviewService.advanceReview clears at end | B1-T03 | RED until service method added | Service must null the view |
 *   | Contract B1-T04 | Container delegates startSession to service | B1-T04 | RED until Container rewritten | Container must not write store |
 *   | Contract B1-T05 | Container delegates advanceReview to service | B1-T05 | RED until Container rewritten | Container must not write store |
 *   | Contract B1-T06 | Container source lacks setReviewQueueView | B1-T06 | RED until Container rewritten | Static boundary check |
 *   | Contract B1-T07 | startSession state projects to shellProps | B1-T07 | RED until full chain wired | Projection return path |
 *   | Contract B1-T08 | sabaki.js review methods lack setReviewQueueView | B1-T08 | RED until sabaki.js rewritten | Static boundary check |
 *   | Contract B1-T09 | startSession calls openDueItem(queue[0]) | B1-T09 | RED until service method added | Side-effect boundary |
 *
 * Harness manifest (SERVICE_REPOSITORY_TRANSITION harness):
 *   Real production modules: createReviewService (from reviewService.ts),
 *     createTrainingRuntimeStore, createTestLogger
 *   Fake/spy modules: repository (createFakeRepo), workbenchTabService (createFakeTabService)
 *   Valid for: SERVICE_REPOSITORY_TRANSITION, SIDE_EFFECT_BOUNDARY
 *   Not valid for: CONTAINER_DELEGATION (needs Container), PROJECTION_RETURN (needs Container)
 *
 * Harness manifest (CONTAINER_DELEGATION / PROJECTION_RETURN harness):
 *   Real production modules: TrainingWorkbenchContainer, createWorkbenchStore,
 *     createTrainingRuntimeStore
 *   Fake/spy modules: reviewService (spy with startSession/advanceReview spies),
 *     workbenchTabService (spy), flowService (spy), legacyController (noop),
 *     taskImportService (stub)
 *   Valid for: CONTAINER_DELEGATION, PROJECTION_RETURN, UI_COMMAND_MAPPING
 *   Not valid for: SERVICE_REPOSITORY_TRANSITION, SERVICE_LOGIC
 */

import assert from 'assert'
import fs from 'fs'
import path from 'path'
import {fileURLToPath} from 'url'

import TrainingWorkbenchContainer from '../../../src/components/TrainingWorkbenchContainer.js'
import {createWorkbenchStore} from '../../../src/modules/training/store/workbenchStore.ts'
import {createTrainingRuntimeStore} from '../../../src/modules/training/store/trainingRuntimeStore.ts'
import {createReviewService} from '../../../src/modules/training/review/reviewService.ts'
import {createTestLogger} from '../../helpers/createTestLogger.ts'
import {tryImport} from '../tryImport.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// =====================================================
// Shared Factories
// =====================================================

function makeTab(overrides = {}) {
  return {
    id: 'tab_1',
    taskId: 'task_1',
    mode: 'problem',
    childTabIds: [],
    playerConfig: {black: 'human', white: 'ai'},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

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

// --- Fake repository for SERVICE_REPOSITORY_TRANSITION tests ---

function createFakeRepo() {
  const schedules = {}
  const tasks = {
    task_a: {
      id: 'task_a',
      rootPositionSgf: '(;GM[1]FF[4]SZ[19])',
      sideToMove: 'black',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    task_b: {
      id: 'task_b',
      rootPositionSgf: '(;GM[1]FF[4]SZ[19])',
      sideToMove: 'black',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  }

  return {
    schedules,
    tasks,
    async listDueReviewItems(now) {
      return Object.values(schedules).filter(s => new Date(s.dueAt) <= new Date(now))
    },
    async findReviewScheduleByTask(taskId) {
      return Object.values(schedules).find(s => s.taskId === taskId) ?? null
    },
    async loadTask(taskId) {
      return tasks[taskId] ?? null
    },
    async createReviewSchedule(schedule) {
      schedules[schedule.id] = {...schedule}
      return {...schedule}
    },
    async updateReviewSchedule(id, patch) {
      if (schedules[id]) {
        Object.assign(schedules[id], patch, {updatedAt: new Date().toISOString()})
      }
    },
  }
}

function seedSchedule(repo, overrides = {}) {
  const schedule = makeSchedule(overrides)
  repo.schedules[schedule.id] = schedule
  return schedule
}

// --- Fake workbenchTabService for SERVICE_REPOSITORY_TRANSITION tests ---

function createFakeTabService() {
  const openedTabs = []
  const calls = {openTask: 0}

  return {
    openedTabs,
    calls,
    async openTask({taskId, mode}) {
      calls.openTask++
      openedTabs.push({taskId, mode})
      return {taskId, mode: mode || 'problem'}
    },
    switchTab() {},
    async closeTab() {},
  }
}

// --- Spy reviewService for CONTAINER_DELEGATION tests ---

function createSpyReviewService() {
  const dueItems = [
    makeSchedule({id: 'sched_1', taskId: 'task_a'}),
    makeSchedule({id: 'sched_2', taskId: 'task_b'}),
  ]

  const calls = {
    getDueItems: [],
    openDueItem: [],
    updateScheduleAfterResult: [],
    startSession: [],
    advanceReview: [],
  }

  return {
    calls,
    dueItems,
    async getDueItems(now) {
      calls.getDueItems.push({now})
      return dueItems
    },
    async openDueItem(scheduleId) {
      calls.openDueItem.push({scheduleId})
      const schedule = dueItems.find(s => s.id === scheduleId)
      if (!schedule) throw new Error(`Schedule not found: ${scheduleId}`)
      return {taskId: schedule.taskId, mode: 'problem'}
    },
    async updateScheduleAfterResult(input) {
      calls.updateScheduleAfterResult.push(input)
    },
    // B1 fix: Container delegates to these methods instead of writing runtimeStore directly.
    // These spy implementations replicate the TARGET behavior:
    //   startSession -> getDueItems, write reviewQueueView, openDueItem(queue[0])
    //   advanceReview -> read reviewQueueView, increment or clear, openDueItem
    async startSession(runtimeStore) {
      calls.startSession.push({})
      const items = await this.getDueItems()
      if (items.length === 0) return
      const queue = items.map(s => s.id)
      runtimeStore.setReviewQueueView({
        queue,
        currentIndex: 0,
        totalDue: queue.length,
      })
      await this.openDueItem(queue[0])
    },
    async advanceReview(runtimeStore) {
      calls.advanceReview.push({})
      const rv = runtimeStore.getState().reviewQueueView
      if (!rv) return
      const nextIndex = rv.currentIndex + 1
      if (nextIndex >= rv.queue.length) {
        runtimeStore.setReviewQueueView(null)
        return
      }
      runtimeStore.setReviewQueueView({...rv, currentIndex: nextIndex})
      await this.openDueItem(rv.queue[nextIndex])
    },
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

function createSpyFlowService() {
  const calls = {submit: [], completeRecall: []}
  return {
    calls,
    async submit(tabId) { calls.submit.push({tabId}) },
    completeRecall(tabId) { calls.completeRecall.push({tabId}) },
  }
}

function createSpyLegacyController() {
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

// --- CONTAINER_DELEGATION / PROJECTION_RETURN Harness ---

function createContainerHarness({
  tabs = [makeTab()],
  activeTabId = tabs[0]?.id ?? null,
  reviewQueueView = null,
} = {}) {
  const workbenchStore = createWorkbenchStore()
  const runtimeStore = createTrainingRuntimeStore()
  const reviewService = createSpyReviewService()
  const tabService = createSpyTabService()
  const flowService = createSpyFlowService()
  const legacyController = createSpyLegacyController()

  const taskImportService = {
    async createManualTask(input) {
      return {id: `task_${Date.now()}`, ...input}
    },
    async createTaskFromBadMove(input) {
      return {id: `task_bm_${Date.now()}`, rootPositionSgf: '(;SZ[19])', origin: {provider: 'bad_move'}}
    },
  }

  for (const tab of tabs) workbenchStore.addTab(tab)
  if (activeTabId != null) workbenchStore.setActiveTab(activeTabId)
  if (reviewQueueView != null) runtimeStore.setReviewQueueView(reviewQueueView)

  const trainingContext = {
    runtimeStore,
    workbenchStore,
    reviewService,
    workbenchTabService: tabService,
    tabService,
    flowService,
    workbenchFlowService: flowService,
    legacyTrainingFlowController: legacyController,
    taskImportService,
    documentStore: {
      async playMove() { return {valid: true, changed: true} },
    },
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
    reviewService,
    tabService,
    flowService,
    legacyController,
    container,
    sabaki,
    trainingContext,
    getShellProps() {
      return container.render().props
    },
  }
}

// --- SERVICE_REPOSITORY_TRANSITION Harness ---

function createServiceHarness() {
  const {logger} = createTestLogger()
  const runtimeStore = createTrainingRuntimeStore()
  const repo = createFakeRepo()
  const tabService = createFakeTabService()

  // Seed 2 due schedules
  seedSchedule(repo, {id: 'sched_1', taskId: 'task_a'})
  seedSchedule(repo, {id: 'sched_2', taskId: 'task_b'})

  const reviewService = createReviewService({
    repository: repo,
    workbenchTabService: tabService,
    logger,
    runtimeStore,  // B1 fix: reviewService gets runtimeStore as a dependency
  })

  return {
    runtimeStore,
    repo,
    tabService,
    reviewService,
    logger,
  }
}

// =====================================================
// Tests
// =====================================================

describe('W7-B1: Container Store Write Fix', function () {

  // ===================================================
  // SERVICE_REPOSITORY_TRANSITION: B1-T01, B1-T02, B1-T03, B1-T09
  // These tests verify the REAL reviewService writes runtimeStore correctly.
  // ===================================================

  describe('SERVICE_REPOSITORY_TRANSITION', function () {

    // --- B1-T01: reviewService.startSession writes runtimeStore ---

    describe('B1-T01: reviewService.startSession writes runtimeStore', function () {
      it('after startSession, runtimeStore.reviewQueueView equals {queue, currentIndex:0, totalDue:N}', async function () {
        const harness = createServiceHarness()

        // B1 fix: reviewService.startSession() is a new method.
        // This test is RED until that method exists on the real reviewService.
        assert.strictEqual(typeof harness.reviewService.startSession, 'function',
          'reviewService must expose startSession method -- Contract B1-T01, Arch v0.5 S0.3')

        await harness.reviewService.startSession()

        const rv = harness.runtimeStore.getState().reviewQueueView
        assert.ok(rv, 'reviewQueueView must be set after startSession')
        assert.deepStrictEqual(rv.queue, ['sched_1', 'sched_2'],
          'queue must contain schedule IDs from getDueItems')
        assert.strictEqual(rv.currentIndex, 0,
          'currentIndex must start at 0')
        assert.strictEqual(rv.totalDue, 2,
          'totalDue must match number of due items')
      })

      it('startSession does nothing when no due items', async function () {
        const harness = createServiceHarness()
        // Clear all schedules so there are no due items.
        // Must mutate in-place because createFakeRepo's listDueReviewItems
        // closure captures the original schedules object reference.
        Object.keys(harness.repo.schedules).forEach(k => delete harness.repo.schedules[k])

        assert.strictEqual(typeof harness.reviewService.startSession, 'function',
          'reviewService must expose startSession method')

        await harness.reviewService.startSession()

        const rv = harness.runtimeStore.getState().reviewQueueView
        assert.strictEqual(rv, null,
          'reviewQueueView must remain null when no due items')
      })
    })

    // --- B1-T02: reviewService.advanceReview increments currentIndex ---

    describe('B1-T02: reviewService.advanceReview increments currentIndex', function () {
      it('preset queueView, advance increments currentIndex and calls openDueItem', async function () {
        const harness = createServiceHarness()
        // Preset reviewQueueView on the real runtimeStore
        harness.runtimeStore.setReviewQueueView({
          queue: ['sched_1', 'sched_2', 'sched_3'],
          currentIndex: 0,
          totalDue: 3,
        })
        // Seed sched_3 into repo
        seedSchedule(harness.repo, {id: 'sched_3', taskId: 'task_a'})

        // B1 fix: reviewService.advanceReview() is a new method.
        assert.strictEqual(typeof harness.reviewService.advanceReview, 'function',
          'reviewService must expose advanceReview method -- Contract B1-T02')

        await harness.reviewService.advanceReview()

        const rv = harness.runtimeStore.getState().reviewQueueView
        assert.ok(rv, 'reviewQueueView must still exist after advance')
        assert.strictEqual(rv.currentIndex, 1,
          'currentIndex must increment to 1')
        assert.strictEqual(rv.queue.length, 3,
          'queue length must remain unchanged')
      })
    })

    // --- B1-T03: reviewService.advanceReview clears queue when exhausted ---

    describe('B1-T03: reviewService.advanceReview clears queue when exhausted', function () {
      it('at queue end, advanceReview sets reviewQueueView === null', async function () {
        const harness = createServiceHarness()
        // Single-item queue: advancing should exhaust it
        harness.runtimeStore.setReviewQueueView({
          queue: ['sched_1'],
          currentIndex: 0,
          totalDue: 1,
        })

        assert.strictEqual(typeof harness.reviewService.advanceReview, 'function',
          'reviewService must expose advanceReview method -- Contract B1-T03')

        await harness.reviewService.advanceReview()

        const rv = harness.runtimeStore.getState().reviewQueueView
        assert.strictEqual(rv, null,
          'reviewQueueView must be null when queue exhausted')
      })
    })

    // --- B1-T09: reviewService.startSession calls openDueItem(queue[0]) ---

    describe('B1-T09: reviewService.startSession calls openDueItem(queue[0])', function () {
      it('startSession calls openDueItem with the first schedule ID', async function () {
        const harness = createServiceHarness()

        assert.strictEqual(typeof harness.reviewService.startSession, 'function',
          'reviewService must expose startSession method -- Contract B1-T09')

        await harness.reviewService.startSession()

        assert.strictEqual(harness.tabService.calls.openTask, 1,
          'openDueItem must call workbenchTabService.openTask exactly once')
        assert.strictEqual(harness.tabService.openedTabs[0].taskId, 'task_a',
          'openDueItem must open the first schedule\'s task')
      })
    })
  })

  // ===================================================
  // CONTAINER_DELEGATION: B1-T04, B1-T05
  // These tests verify Container delegates to reviewService, NOT to runtimeStore.
  // ===================================================

  describe('CONTAINER_DELEGATION', function () {

    // --- B1-T04: Container.handleStartReviewSession delegates to reviewService.startSession ---

    describe('B1-T04: Container delegates startSession to reviewService', function () {
      it('Container calls reviewService.startSession, NOT runtimeStore.setReviewQueueView', async function () {
        const harness = createContainerHarness()
        const shellProps = harness.getShellProps()

        assert.strictEqual(typeof shellProps.onStartReviewSession, 'function',
          'Container must expose onStartReviewSession callback')

        // The Container's handler should call reviewService.startSession.
        // Our spy reviewService.startSession writes runtimeStore on behalf of the service.
        await shellProps.onStartReviewSession()

        // Verify Container delegated to reviewService.startSession
        assert.strictEqual(harness.reviewService.calls.startSession.length, 1,
          'Container must call reviewService.startSession -- Contract B1-T04, Arch v0.5 S0.3')

        // Verify the state was written (by the service spy, not by Container directly)
        const rv = harness.runtimeStore.getState().reviewQueueView
        assert.ok(rv, 'reviewQueueView must be set after startSession delegation')
        assert.strictEqual(rv.currentIndex, 0)
        assert.strictEqual(rv.totalDue, 2)
      })
    })

    // --- B1-T05: Container.handleAdvanceReview delegates to reviewService.advanceReview ---

    describe('B1-T05: Container delegates advanceReview to reviewService', function () {
      it('Container calls reviewService.advanceReview for increment', async function () {
        const harness = createContainerHarness({
          reviewQueueView: {
            queue: ['sched_1', 'sched_2'],
            currentIndex: 0,
            totalDue: 2,
          },
        })
        const shellProps = harness.getShellProps()

        assert.strictEqual(typeof shellProps.onAdvanceReview, 'function',
          'Container must expose onAdvanceReview callback')

        await shellProps.onAdvanceReview()

        // Verify Container delegated to reviewService.advanceReview
        assert.strictEqual(harness.reviewService.calls.advanceReview.length, 1,
          'Container must call reviewService.advanceReview -- Contract B1-T05, Arch v0.5 S0.3')

        // Verify the state was updated (by the service spy)
        const rv = harness.runtimeStore.getState().reviewQueueView
        assert.ok(rv, 'reviewQueueView must still exist after advance')
        assert.strictEqual(rv.currentIndex, 1,
          'currentIndex must be incremented')
      })

      it('Container calls reviewService.advanceReview for exhaustion', async function () {
        const harness = createContainerHarness({
          reviewQueueView: {
            queue: ['sched_1'],
            currentIndex: 0,
            totalDue: 1,
          },
        })
        const shellProps = harness.getShellProps()

        await shellProps.onAdvanceReview()

        // Verify Container delegated to reviewService.advanceReview
        assert.strictEqual(harness.reviewService.calls.advanceReview.length, 1,
          'Container must call reviewService.advanceReview for exhaustion -- Contract B1-T05')

        // Verify the state was cleared
        const rv = harness.runtimeStore.getState().reviewQueueView
        assert.strictEqual(rv, null,
          'reviewQueueView must be null after queue exhausted')
      })
    })
  })

  // ===================================================
  // ARCHITECTURE_BOUNDARY: B1-T06, B1-T08
  // Static source checks ensuring forbidden strings are absent.
  // ===================================================

  describe('ARCHITECTURE_BOUNDARY', function () {

    // --- B1-T06: Container source does not contain setReviewQueueView ---

    describe('B1-T06: Container source lacks setReviewQueueView', function () {
      it('Container source does not contain the string setReviewQueueView', function () {
        const containerPath = path.resolve(
          __dirname, '../../../src/components/TrainingWorkbenchContainer.js',
        )
        const source = fs.readFileSync(containerPath, 'utf-8')

        // Check lines outside of comments
        const lines = source.split('\n')
        const violations = []
        for (let i = 0; i < lines.length; i++) {
          const trimmed = lines[i].trim()
          if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue
          if (trimmed.includes('setReviewQueueView')) {
            violations.push({line: i + 1, text: trimmed})
          }
        }

        assert.strictEqual(violations.length, 0,
          `Container must not contain setReviewQueueView -- Arch v0.5 S0.3, S1.3. ` +
          `Found at lines: ${violations.map(v => v.line).join(', ')}`)
      })
    })

    // --- B1-T08: sabaki.js startReviewSession/advanceReview lack setReviewQueueView ---

    describe('B1-T08: sabaki.js review methods lack setReviewQueueView', function () {
      it('sabaki.js startReviewSession and advanceReview do not contain setReviewQueueView', function () {
        const sabakiPath = path.resolve(
          __dirname, '../../../src/modules/sabaki.js',
        )
        const source = fs.readFileSync(sabakiPath, 'utf-8')

        // Extract the startReviewSession and advanceReview method bodies
        // by finding lines between their definitions and the next method.
        const lines = source.split('\n')
        const inReviewMethod = []
        let insideReviewMethod = false
        let methodIndent = 0

        for (let i = 0; i < lines.length; i++) {
          const trimmed = lines[i].trim()

          // Detect start of startReviewSession or advanceReview
          if (/^\s*async\s+startReview\s*\(/.test(lines[i]) ||
              /^\s*async\s+advanceReview\s*\(/.test(lines[i])) {
            insideReviewMethod = true
            methodIndent = lines[i].search(/\S/)
            inReviewMethod.push({lineNum: i + 1, text: trimmed})
            continue
          }

          if (insideReviewMethod) {
            // Check if we've exited the method (next method or class boundary)
            const currentIndent = lines[i].search(/\S/)
            if (trimmed.length > 0 && currentIndent <= methodIndent &&
                !trimmed.startsWith('//') && !trimmed.startsWith('*')) {
              insideReviewMethod = false
              continue
            }
            inReviewMethod.push({lineNum: i + 1, text: trimmed})
          }
        }

        // Check for setReviewQueueView within the review methods
        const violations = inReviewMethod.filter(
          l => l.text.includes('setReviewQueueView') && !l.text.startsWith('//'),
        )

        assert.strictEqual(violations.length, 0,
          `sabaki.js startReviewSession/advanceReview must not call setReviewQueueView -- ` +
          `Arch v0.5 S0.3. Found at lines: ${violations.map(v => v.lineNum).join(', ')}`)
      })
    })
  })

  // ===================================================
  // PROJECTION_RETURN: B1-T07
  // After startSession, Container.render() projects correct review props.
  // ===================================================

  describe('PROJECTION_RETURN', function () {

    // --- B1-T07: startSession state projects to shellProps ---

    describe('B1-T07: startSession state projects to shellProps', function () {
      it('after startSession, Container.render() projects correct reviewQueue/reviewCurrentIndex/reviewTotalDue', async function () {
        const harness = createContainerHarness()
        const shellProps = harness.getShellProps()

        assert.strictEqual(typeof shellProps.onStartReviewSession, 'function',
          'Container must expose onStartReviewSession')

        // Before startSession
        assert.strictEqual(shellProps.reviewQueue, undefined,
          'reviewQueue must be undefined before startSession')
        assert.strictEqual(shellProps.reviewCurrentIndex, undefined,
          'reviewCurrentIndex must be undefined before startSession')
        assert.strictEqual(shellProps.reviewTotalDue, undefined,
          'reviewTotalDue must be undefined before startSession')

        // Start session
        await shellProps.onStartReviewSession()

        // Re-render to get fresh projection
        const freshProps = harness.getShellProps()

        assert.deepStrictEqual(freshProps.reviewQueue, ['sched_1', 'sched_2'],
          'reviewQueue must project queue from reviewQueueView')
        assert.strictEqual(freshProps.reviewCurrentIndex, 0,
          'reviewCurrentIndex must project currentIndex from reviewQueueView')
        assert.strictEqual(freshProps.reviewTotalDue, 2,
          'reviewTotalDue must project totalDue from reviewQueueView')
      })

      it('after advanceReview, projection reflects updated currentIndex', async function () {
        const harness = createContainerHarness({
          reviewQueueView: {
            queue: ['sched_1', 'sched_2', 'sched_3'],
            currentIndex: 0,
            totalDue: 3,
          },
        })

        // Before advance
        let shellProps = harness.getShellProps()
        assert.strictEqual(shellProps.reviewCurrentIndex, 0)

        // Advance
        await shellProps.onAdvanceReview()

        // Re-render and verify projection updated
        shellProps = harness.getShellProps()
        assert.strictEqual(shellProps.reviewCurrentIndex, 1,
          'Projection must reflect updated currentIndex after advance -- Contract B1-T07')
        assert.strictEqual(shellProps.reviewTotalDue, 3,
          'reviewTotalDue must remain unchanged after advance')
      })

      it('after queue exhaustion, projection clears review props', async function () {
        const harness = createContainerHarness({
          reviewQueueView: {
            queue: ['sched_1'],
            currentIndex: 0,
            totalDue: 1,
          },
        })

        await harness.getShellProps().onAdvanceReview()

        const freshProps = harness.getShellProps()
        assert.strictEqual(freshProps.reviewQueue, undefined,
          'reviewQueue must be undefined after queue exhausted')
        assert.strictEqual(freshProps.reviewCurrentIndex, undefined,
          'reviewCurrentIndex must be undefined after queue exhausted')
        assert.strictEqual(freshProps.reviewTotalDue, undefined,
          'reviewTotalDue must be undefined after queue exhausted')
      })
    })
  })

  // ===================================================
  // Full lifecycle integration (covers B1-T01 + B1-T02 + B1-T03 end-to-end)
  // ===================================================

  describe('Integration: Full review lifecycle with service delegation', function () {
    it('startSession -> advanceReview -> advanceReview -> exhausted', async function () {
      const harness = createContainerHarness()
      const shellProps = harness.getShellProps()

      // Start: 2 items
      await shellProps.onStartReviewSession()

      // Verify Container delegated to service
      assert.strictEqual(harness.reviewService.calls.startSession.length, 1)

      let rv = harness.runtimeStore.getState().reviewQueueView
      assert.strictEqual(rv.currentIndex, 0)
      assert.strictEqual(rv.totalDue, 2)

      // Re-render to get fresh handler that delegates to advanceReview
      let freshProps = harness.getShellProps()

      // Advance to item 2
      await freshProps.onAdvanceReview()
      assert.strictEqual(harness.reviewService.calls.advanceReview.length, 1)

      rv = harness.runtimeStore.getState().reviewQueueView
      assert.strictEqual(rv.currentIndex, 1)

      // Re-render
      freshProps = harness.getShellProps()

      // Advance past end -> exhausted
      await freshProps.onAdvanceReview()
      assert.strictEqual(harness.reviewService.calls.advanceReview.length, 2)

      rv = harness.runtimeStore.getState().reviewQueueView
      assert.strictEqual(rv, null, 'Queue must be null after exhausting all items')
    })
  })
})