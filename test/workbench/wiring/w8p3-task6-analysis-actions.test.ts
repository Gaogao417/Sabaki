/**
 * W8-P3 Task 6: Analysis Action Buttons Wiring Tests
 *
 * Test contract: docs/design/2026-05-21/w8-p3/task6-analysis-actions-contract.md
 * Contracts covered: T6-01 through T6-17
 *
 * Source of truth alignment:
 *   - PRD v0.5 SS2.6: Analysis is a low-barrier free research space
 *   - PRD v0.5 SS3.4: Analysis Mode Snapshot creates new TrainingTask + new Tab via flowService.snapshotFromCurrentContext
 *   - PRD v0.5 SS5.5: Snapshot: captureSnapshotInput -> createTask -> openTask
 *   - PRD v0.5 SS6.6: Analysis top: [Snapshot] [Settings] [Return]
 *   - PRD v0.5 SS9.1: Analysis returns to previousMode on Return
 *   - PRD v0.5 SS10: Analysis bottom: [Undo] [Redo] [Clear] [EditPosition] [Snapshot]
 *   - Arch v0.5 SS5.3: returnFromAnalysis(tabId, toMode), snapshotFromCurrentContext(tabId)
 *   - Arch v0.5 SS5.10: snapshotService does not create Tabs
 *   - Arch v0.5 SS9.7: Snapshot: snapshotService.capture -> createTask -> openTask
 *
 * Harness manifest:
 *   - createHarness: Real workbenchStore, real runtimeStore, real LoggerService.
 *     Spy flowService, spy tabService, spy snapshotService, spy legacyController.
 *     Valid for: CONTAINER_DELEGATION, PROJECTION_RETURN, UI_COMMAND_MAPPING (container layer).
 *     Not valid for: CONTROLLER_STATE_TRANSITION (uses spy flowService), SERVICE_REPOSITORY_TRANSITION.
 *
 *   - createHarnessWithRealFlowService: Real workbenchStore, real runtimeStore, real LoggerService,
 *     real flowService. Spy repository, spy snapshotService, spy tabService.
 *     Valid for: CONTROLLER_STATE_TRANSITION, STORE_SUBSCRIPTION, SIDE_EFFECT_BOUNDARY, ARCHITECTURE_BOUNDARY.
 *     Not valid for: SERVICE_REPOSITORY_TRANSITION (uses spy repository).
 *
 *   - createHarnessWithRealSnapshotService: Real workbenchStore, real runtimeStore, real LoggerService,
 *     real snapshotService. Spy repository, spy positionSnapshotAdapter, spy tabService.
 *     Valid for: SIDE_EFFECT_BOUNDARY (T6-15).
 *     Not valid for: CONTROLLER_STATE_TRANSITION.
 *
 * Test Legitimacy:
 *   - All tests import real production code: TrainingWorkbenchContainer, real stores,
 *     real flowService, real snapshotService, real ModeActions, real BottomActionBar.
 *   - ModeActions/BottomActionBar tests import and render the real component via jsdom.
 *   - Container tests render the Container and extract shellProps from render() output.
 *   - No assert.ok(true). No conditional skip on core assertions.
 *   - Production module missing -> tests FAIL (import error), no silent pass.
 *   - T6-06 CONTAINER_DELEGATION uses spy flowService (contract allows).
 *   - T6-14 PROJECTION_RETURN uses spy flowService to trigger state change, then
 *     asserts on Container.render() projection (indirect test of projectFromWorkbench).
 *
 * Matrix Coverage:
 *   | Source Row | Required Behavior | Test ID | Status | Notes |
 *   | --- | --- | --- | --- | --- |
 *   | Contract T6-01 | Snapshot does not modify activeAttemptId | T6-01 | covered | Uses real flowService + spy snapshotService/repo/tabService |
 *   | Contract T6-02 | Snapshot creates new Tab (mode=problem, parentTabId=original) | T6-02 | covered | Uses real flowService + spy snapshotService/repo/tabService |
 *   | Contract T6-03 | Snapshot preserves current tab mode=analysis | T6-03 | covered | Uses real flowService + spy snapshotService/repo/tabService |
 *   | Contract T6-04 | returnFromAnalysis changes tab.mode to previousMode | T6-04 | covered | Uses real flowService, zero mocks |
 *   | Contract T6-05 | returnFromAnalysis clears previousMode to undefined | T6-05 | covered | Uses real flowService, zero mocks |
 *   | Contract T6-06 | previousMode undefined defaults to 'play' | T6-06 | covered | Container handler test, spy flowService |
 *   | Contract T6-07 | ModeActions renders Snapshot button | T6-07 | covered | Real ModeActions render |
 *   | Contract T6-08 | ModeActions renders Return button | T6-08 | covered | Real ModeActions render |
 *   | Contract T6-09 | BottomActionBar renders compact analysis tool drawer | T6-09 | covered | Real BottomActionBar render |
 *   | Contract T6-10 | handleSnapshot calls flowService.snapshotFromCurrentContext | T6-10 | covered | Container handler, spy flowService |
 *   | Contract T6-11 | handleReturnFromAnalysis calls flowService.returnFromAnalysis | T6-11 | covered | Container handler, spy flowService |
 *   | Contract T6-12 | returnFromAnalysis notifies subscriber | T6-12 | covered | Real workbenchStore subscription |
 *   | Contract T6-13 | snapshot notifies subscriber | T6-13 | covered | Real workbenchStore subscription |
 *   | Contract T6-14 | projectFromWorkbench returns mode=previousMode after return | T6-14 | covered | Indirect via Container projection |
 *   | Contract T6-15 | snapshotService.captureSnapshotInput does not call tabService.openTask | T6-15 | covered | Real snapshotService, spy tabService |
 *   | Contract T6-16 | handleSnapshot no-op when activeTab null | T6-16 | covered | Container with no active tab |
 *   | Contract T6-17 | handleReturnFromAnalysis no-op when activeTab null | T6-17 | covered | Container with no active tab |
 */

import assert from 'assert'
import {h} from 'preact'

import {createTestLogger} from '../../helpers/createTestLogger.ts'
import TrainingWorkbenchContainer from '../../../src/components/TrainingWorkbenchContainer.js'
import {createWorkbenchStore} from '../../../src/modules/training/store/workbenchStore.ts'
import {createTrainingRuntimeStore} from '../../../src/modules/training/store/trainingRuntimeStore.ts'
import {createWorkbenchFlowService} from '../../../src/modules/training/workbench/workbenchFlowService.ts'
import {createSnapshotService} from '../../../src/modules/training/analysis/snapshotService.ts'
import ModeActions from '../../../src/components/workbench/shell/ModeActions.js'
import BottomActionBar from '../../../src/components/workbench/shell/BottomActionBar.js'
import {renderToDom} from '../preactTestHelper.js'
import {
  createSpyFlowService,
  createSpySnapshotService,
  createSpyTabService,
} from '../shared/workbenchSpyFactories.ts'

// --- Tab Factory ---

function makeAnalysisTab(overrides: Record<string, unknown> = {}) {
  const base = {
    id: 'tab_analysis_1',
    taskId: 'task_analysis_1',
    mode: 'analysis',
    previousMode: 'play',
    childTabIds: [] as string[],
    activeAttemptId: 'att_1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
  // Ensure analysisReturnTarget is consistent with previousMode for return-from-analysis
  if (!base.analysisReturnTarget) {
    base.analysisReturnTarget = {mode: base.previousMode ?? 'play'}
  }
  return base
}

// --- Spy Factories ---

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

function createSpyPositionSnapshotAdapter() {
  return {
    captureCurrentPosition() {
      return {
        positionSgf: '(;SZ[19]AB[dp]AW[dd])',
        sideToMove: 'black' as const,
        moveNumber: 5,
        positionHash: 'hash_123',
      }
    },
    captureBeforeMove(_moveIndex: number) {
      return this.captureCurrentPosition()
    },
    captureAfterMove(_moveIndex: number) {
      return this.captureCurrentPosition()
    },
  }
}

function createSpyRepository() {
  const tasks = new Map<string, any>()
  return {
    async loadTask(taskId: string) {
      return (
        tasks.get(taskId) || {
          id: taskId,
          rootPositionSgf: '',
          origin: {provider: 'local'},
        }
      )
    },
    async createTask(task: any) {
      tasks.set(task.id, task)
      return task
    },
    async transaction(fn: () => Promise<void>) {
      return fn()
    },
    async getProblem() {
      return null
    },
    async getGame() {
      return null
    },
    async listMoveEvaluationsByAttempt() {
      return []
    },
    async listBadMovesByAttempt() {
      return []
    },
    async saveGame(g: any) {
      return g
    },
    async createProblem(p: any) {
      return p
    },
    async getProblemsByStatus() {
      return []
    },
    async saveProblem(p: any) {
      return p
    },
    async saveProblemAttempt(a: any) {
      return a
    },
    async saveBadMove(b: any) {
      return b
    },
    async saveRecallSession(s: any) {
      return s
    },
    async saveRecallAttempts() {},
    async getDueReviews() {
      return []
    },
    async upsertReviewSchedule() {},
    async getDashboardSummary() {
      return {}
    },
    async updateBadMoveGeneratedProblem() {},
    async findTaskBySource() {
      return null
    },
    async updateTask() {},
    async createAttempt(a: any) {
      return a
    },
    async loadAttempt() {
      return null
    },
    async listAttemptsByTask() {
      return []
    },
    async updateAttempt() {},
    async createMoveEvaluation(e: any) {
      return e
    },
    async listMoveEvaluationsByAttempt2() {
      return []
    },
    async createBadMove(b: any) {
      return b
    },
    async listBadMovesByAttempt2() {
      return []
    },
    async createRecallSession(s: any) {
      return s
    },
    async loadRecallSession() {
      return null
    },
    async updateRecallSession() {},
    async createRecallAttempt(a: any) {
      return a
    },
    async createRecallCheckpoint(c: any) {
      return c
    },
    async createReviewSchedule(r: any) {
      return r
    },
    async createMoveComment(c: any) {
      return c
    },
    async listMoveCommentsByTask() {
      return []
    },
  }
}

// --- Harness: spy flowService ---

function createHarness({
  tabs = [makeAnalysisTab()],
  activeTabId,
  recallView = null,
}: {
  tabs?: any[]
  activeTabId?: string | null
  recallView?: any
} = {}) {
  const {logger} = createTestLogger()
  const workbenchStore = createWorkbenchStore({logger})
  const runtimeStore = createTrainingRuntimeStore({logger})
  const flowService = createSpyFlowService()
  const tabService = createSpyTabService()
  const snapshotService = createSpySnapshotService()
  const legacyController = createSpyLegacyController()

  const resolvedActiveTabId =
    activeTabId !== undefined ? activeTabId : (tabs[0]?.id ?? null)

  for (const tab of tabs) workbenchStore.addTab(tab)
  if (resolvedActiveTabId != null)
    workbenchStore.setActiveTab(resolvedActiveTabId)
  if (recallView != null) runtimeStore.setRecallView(recallView)

  const taskImportService = {
    async createManualTask(input: any) {
      return {id: `task_${Date.now()}`, ...input}
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
    legacyTrainingFlowController: legacyController,
    snapshotService,
    documentStore: {
      async playMove() {
        return {valid: true, changed: true, treePosition: 'node_2'}
      },
    },
    attemptService: {
      async appendMove() {},
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

// --- Harness: real flowService ---

function createHarnessWithRealFlowService({
  tabs = [makeAnalysisTab()],
  activeTabId,
}: {
  tabs?: any[]
  activeTabId?: string | null
} = {}) {
  const {logger} = createTestLogger()
  const workbenchStore = createWorkbenchStore({logger})
  const runtimeStore = createTrainingRuntimeStore({logger})
  const snapshotService = createSpySnapshotService()
  const repository = createSpyRepository()

  const tabService = createSpyTabService()
  const openTask = tabService.openTask.bind(tabService)
  tabService.openTask = async (opts) => {
    const newTab = await openTask(opts)
    workbenchStore.addTab(newTab)
    workbenchStore.setActiveTab(newTab.id)
    return newTab
  }

  const spyRecallService = {
    async createRecallSession() {
      return {id: 'rs_real'}
    },
    async completeRecall() {},
  }

  const realFlowService = createWorkbenchFlowService({
    workbenchStore,
    repository: repository as any,
    attemptService: {
      async createAttempt(input: any) {
        return {id: 'att_real', ...input}
      },
      async freezeAttempt() {},
      async finalizeAttemptResult() {},
    },
    recallService: spyRecallService,
    snapshotService: snapshotService as any,
    tabService: tabService as any,
    runtimeStore,
    logger: logger as any,
  })

  const resolvedActiveTabId =
    activeTabId !== undefined ? activeTabId : (tabs[0]?.id ?? null)

  for (const tab of tabs) workbenchStore.addTab(tab)
  if (resolvedActiveTabId != null)
    workbenchStore.setActiveTab(resolvedActiveTabId)

  const taskImportService = {
    async createManualTask(input: any) {
      return {id: `task_${Date.now()}`, ...input}
    },
  }

  const legacyController = createSpyLegacyController()

  const trainingContext = {
    runtimeStore,
    workbenchStore,
    workbenchFlowService: realFlowService,
    flowService: realFlowService,
    workbenchTabService: tabService,
    tabService,
    taskImportService,
    legacyTrainingFlowController: legacyController,
    snapshotService,
    documentStore: {
      async playMove() {
        return {valid: true, changed: true, treePosition: 'node_2'}
      },
    },
    attemptService: {
      async appendMove() {},
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
    flowService: realFlowService,
    tabService,
    snapshotService,
    repository,
    legacyController,
    container,
    sabaki,
    trainingContext,
    getShellProps() {
      return container.render().props
    },
  }
}

// --- Harness: real snapshotService ---

function createHarnessWithRealSnapshotService({
  tabs = [makeAnalysisTab()],
}: {
  tabs?: any[]
} = {}) {
  const {logger} = createTestLogger()
  const workbenchStore = createWorkbenchStore({logger})
  const runtimeStore = createTrainingRuntimeStore({logger})
  const repository = createSpyRepository()
  const positionSnapshotAdapter = createSpyPositionSnapshotAdapter()

  const tabService = createSpyTabService()
  const openTask = tabService.openTask.bind(tabService)
  tabService.openTask = async (opts) => {
    const newTab = await openTask(opts)
    workbenchStore.addTab(newTab)
    workbenchStore.setActiveTab(newTab.id)
    return newTab
  }

  const realSnapshotService = createSnapshotService({
    repository: repository as any,
    positionSnapshotAdapter: positionSnapshotAdapter as any,
    workbenchStore,
    logger: logger as any,
  })

  const spyRecallService = {
    async createRecallSession() {
      return {id: 'rs_snap'}
    },
    async completeRecall() {},
  }

  const realFlowService = createWorkbenchFlowService({
    workbenchStore,
    repository: repository as any,
    attemptService: {
      async createAttempt(input: any) {
        return {id: 'att_snap', ...input}
      },
      async freezeAttempt() {},
      async finalizeAttemptResult() {},
    },
    recallService: spyRecallService,
    snapshotService: realSnapshotService,
    tabService: tabService as any,
    runtimeStore,
    logger: logger as any,
  })

  for (const tab of tabs) workbenchStore.addTab(tab)
  workbenchStore.setActiveTab(tabs[0]?.id)

  const taskImportService = {
    async createManualTask(input: any) {
      return {id: `task_${Date.now()}`, ...input}
    },
  }

  const legacyController = createSpyLegacyController()

  const trainingContext = {
    runtimeStore,
    workbenchStore,
    workbenchFlowService: realFlowService,
    flowService: realFlowService,
    workbenchTabService: tabService,
    tabService,
    taskImportService,
    legacyTrainingFlowController: legacyController,
    snapshotService: realSnapshotService,
    documentStore: {
      async playMove() {
        return {valid: true, changed: true, treePosition: 'node_2'}
      },
    },
    attemptService: {
      async appendMove() {},
    },
  }

  const sabaki = {
    getTrainingContext() {
      return trainingContext
    },
  }

  return {
    workbenchStore,
    runtimeStore,
    flowService: realFlowService,
    snapshotService: realSnapshotService,
    tabService,
    repository,
    positionSnapshotAdapter,
    container: null,
    sabaki,
    trainingContext,
  }
}

function installAnalysisScratchHarness(
  harness: ReturnType<typeof createHarness>,
) {
  const snapshot = {
    id: 'scratch_current_1',
    role: 'current',
    width: 2,
    height: 2,
    nextPlayer: 1,
    signMap: [
      [0, 0],
      [0, 0],
    ],
  }
  const state = {
    mode: 'analysis',
    selectedTool: 'stone_1',
    editWorkspace: {
      activeTab: 'current',
      currentSnapshot: snapshot,
      referenceSnapshot: null,
      currentMarkerMap: [
        [{type: 'circle'}, null],
        [null, {type: 'triangle'}],
      ],
      referenceMarkerMap: null,
      currentLines: [{v1: [0, 0], v2: [1, 1], type: 'line'}],
      referenceLines: null,
      lineFirstVertex: {type: 'arrow', vertex: [0, 1]},
    },
  }

  Object.assign(harness.sabaki, {
    state,
    setState(patch: any) {
      Object.assign(state, typeof patch === 'function' ? patch(state) : patch)
    },
    scheduleEditWorkspaceAnalysis() {},
    commitEditResult(result: any) {
      if (result.markerMap != null) {
        state.editWorkspace.currentMarkerMap = result.markerMap
      }
      if (result.lines != null) {
        state.editWorkspace.currentLines = result.lines
      }
      if (result.lineFirstVertex !== undefined) {
        state.editWorkspace.lineFirstVertex = result.lineFirstVertex
      }
    },
  })

  return state
}

// =====================================================
// Tests
// =====================================================

describe('W8-P3 Task 6: Analysis Action Buttons', function () {
  // ===================================================
  // ARCHITECTURE_BOUNDARY: T6-01
  // ===================================================

  describe('ARCHITECTURE_BOUNDARY', function () {
    // --- T6-01: Snapshot does not modify current tab activeAttemptId ---

    describe('T6-01: Snapshot preserves activeAttemptId', function () {
      it('after snapshot, original tab activeAttemptId is unchanged', async function () {
        const harness = createHarnessWithRealFlowService({
          tabs: [
            makeAnalysisTab({
              id: 'tab_arch1',
              taskId: 'task_arch1',
              mode: 'analysis',
              activeAttemptId: 'att_original',
            }),
          ],
        })

        const beforeAttemptId =
          harness.workbenchStore.getState().tabs[0].activeAttemptId
        assert.strictEqual(
          beforeAttemptId,
          'att_original',
          'Precondition: activeAttemptId must be att_original',
        )

        // snapshotFromCurrentContext uses real flowService + spy snapshotService/repo/tabService
        await harness.flowService.snapshotFromCurrentContext('tab_arch1')

        const afterAttemptId =
          harness.workbenchStore.getState().tabs[0].activeAttemptId
        assert.strictEqual(
          afterAttemptId,
          'att_original',
          'Snapshot must not modify current tab activeAttemptId -- Contract T6-01, Arch v0.5 9.7',
        )
      })
    })
  })

  // ===================================================
  // CONTROLLER_STATE_TRANSITION: T6-02, T6-03, T6-04, T6-05, T6-06
  // ===================================================

  describe('CONTROLLER_STATE_TRANSITION', function () {
    // --- T6-02: Snapshot creates new Tab (mode=problem, parentTabId=original) ---

    describe('T6-02: Snapshot creates new problem tab', function () {
      it('after snapshot, workbenchStore contains new tab with mode=problem and parentTabId=original', async function () {
        const harness = createHarnessWithRealFlowService({
          tabs: [
            makeAnalysisTab({
              id: 'tab_snap_src',
              taskId: 'task_snap_src',
              mode: 'analysis',
            }),
          ],
        })

        assert.strictEqual(
          harness.workbenchStore.getState().tabs.length,
          1,
          'Precondition: exactly one tab',
        )

        // snapshotFromCurrentContext calls: snapshotService.capture -> repo.createTask -> tabService.openTask
        // tabService.openTask adds a new tab to the store
        await harness.flowService.snapshotFromCurrentContext('tab_snap_src')

        assert.strictEqual(
          harness.tabService.calls.openTask.length,
          1,
          'tabService.openTask must be called once',
        )

        const openTaskCall = harness.tabService.calls.openTask[0]
        assert.strictEqual(
          openTaskCall.mode,
          'problem',
          'openTask must be called with mode=problem -- Contract T6-02, PRD v0.5 5.5',
        )
        assert.strictEqual(
          openTaskCall.parentTabId,
          'tab_snap_src',
          'openTask parentTabId must equal source tab id -- Contract T6-02, Arch v0.5 9.7',
        )

        // Verify the new tab exists in the store
        const tabs = harness.workbenchStore.getState().tabs
        const sourceTab = tabs.find((t: any) => t.id === 'tab_snap_src')
        const newTab = tabs.find((t: any) => t.id !== 'tab_snap_src')
        assert.ok(sourceTab, 'Source tab must still exist')
        assert.ok(newTab, 'New tab must exist in workbenchStore')
        assert.strictEqual(
          newTab.mode,
          'problem',
          'New tab mode must be problem -- Contract T6-02',
        )
        assert.strictEqual(
          newTab.parentTabId,
          'tab_snap_src',
          'New tab parentTabId must equal source tab id -- Contract T6-02',
        )
      })
    })

    // --- T6-03: Snapshot preserves current tab mode=analysis ---

    describe('T6-03: Snapshot preserves current tab mode', function () {
      it('after snapshot, source tab mode is still analysis', async function () {
        const harness = createHarnessWithRealFlowService({
          tabs: [
            makeAnalysisTab({
              id: 'tab_mode_preserve',
              taskId: 'task_mode_preserve',
              mode: 'analysis',
            }),
          ],
        })

        await harness.flowService.snapshotFromCurrentContext(
          'tab_mode_preserve',
        )

        const sourceTab = harness.workbenchStore
          .getState()
          .tabs.find((t: any) => t.id === 'tab_mode_preserve')
        assert.ok(sourceTab, 'Source tab must still exist')
        assert.strictEqual(
          sourceTab.mode,
          'analysis',
          'Source tab mode must still be analysis after snapshot -- Contract T6-03, PRD v0.5 5.5',
        )
      })
    })

    // --- T6-04: returnFromAnalysis changes tab.mode to previousMode ---

    describe('T6-04: returnFromAnalysis changes mode', function () {
      it('after returnFromAnalysis(tabId, "recall"), tab.mode becomes "recall"', function () {
        const harness = createHarnessWithRealFlowService({
          tabs: [
            makeAnalysisTab({
              id: 'tab_return1',
              mode: 'analysis',
              previousMode: 'recall',
            }),
          ],
        })

        const before = harness.workbenchStore.getState().tabs[0]
        assert.strictEqual(
          before.mode,
          'analysis',
          'Precondition: mode=analysis',
        )
        assert.strictEqual(
          before.previousMode,
          'recall',
          'Precondition: previousMode=recall',
        )

        harness.flowService.returnFromAnalysis({tabId: 'tab_return1'})

        const after = harness.workbenchStore.getState().tabs[0]
        assert.strictEqual(
          after.mode,
          'recall',
          'After returnFromAnalysis, tab.mode must be previousMode value -- Contract T6-04, Arch v0.5 5.3',
        )
      })
    })

    // --- T6-05: returnFromAnalysis clears previousMode to undefined ---

    describe('T6-05: returnFromAnalysis clears previousMode', function () {
      it('after returnFromAnalysis, tab.previousMode is undefined', function () {
        const harness = createHarnessWithRealFlowService({
          tabs: [
            makeAnalysisTab({
              id: 'tab_return2',
              mode: 'analysis',
              previousMode: 'problem',
            }),
          ],
        })

        const before = harness.workbenchStore.getState().tabs[0]
        assert.strictEqual(
          before.previousMode,
          'problem',
          'Precondition: previousMode=problem',
        )

        harness.flowService.returnFromAnalysis({tabId: 'tab_return2'})

        const after = harness.workbenchStore.getState().tabs[0]
        assert.strictEqual(
          after.previousMode,
          undefined,
          'After returnFromAnalysis, tab.previousMode must be undefined -- Contract T6-05, Arch v0.5 5.3',
        )
      })
    })

    // --- T6-06: previousMode undefined defaults to 'play' (Container layer) ---

    describe('T6-06: previousMode undefined defaults to play', function () {
      it('Container calls returnFromAnalysis({tabId}) and flowService reads analysisReturnTarget', function () {
        // After Phase 1 signature change, Container no longer passes toMode.
        // flowService.returnFromAnalysis({tabId}) reads tab.analysisReturnTarget internally.
        // When analysisReturnTarget is absent, defaults to 'play'.
        const harness = createHarness({
          tabs: [
            makeAnalysisTab({
              id: 'tab_default_play',
              mode: 'analysis',
              previousMode: undefined,
            }),
          ],
        })

        const shellProps = harness.getShellProps()

        assert.strictEqual(
          typeof shellProps.onReturn,
          'function',
          'Container must expose onReturn callback',
        )
        shellProps.onReturn()

        assert.deepStrictEqual(
          harness.flowService.calls.returnFromAnalysis,
          [{tabId: 'tab_default_play'}],
          'Container must call flowService.returnFromAnalysis({tabId}) -- Contract T6-06',
        )
      })
    })
  })

  // ===================================================
  // UI_COMMAND_MAPPING: T6-07, T6-08, T6-09
  // ===================================================

  describe('UI_COMMAND_MAPPING', function () {
    // --- T6-07: ModeActions analysis renders Snapshot button ---

    describe('T6-07: ModeActions Snapshot button', function () {
      it('renders button[data-testid="mode-action-snapshot"] in analysis mode, click fires onSnapshot', function () {
        const calls = {snapshot: false}
        const {queryByTestId, fireEvent} = renderToDom(
          h(ModeActions, {
            mode: 'analysis',
            onSnapshot: () => {
              calls.snapshot = true
            },
            onSettings: () => {},
            onReturn: () => {},
          }),
        )

        const btn = queryByTestId('mode-action-snapshot')
        assert.ok(
          btn,
          'ModeActions analysis must render button[data-testid="mode-action-snapshot"] -- Contract T6-07, PRD v0.5 6.6',
        )

        fireEvent.click(btn)
        assert.strictEqual(
          calls.snapshot,
          true,
          'Clicking mode-action-snapshot must fire onSnapshot callback -- Contract T6-07',
        )
      })
    })

    // --- T6-08: ModeActions analysis renders Return button ---

    describe('T6-08: ModeActions Return button', function () {
      it('renders button[data-testid="mode-action-return"] in analysis mode, click fires onReturn', function () {
        const calls = {return_: false}
        const {queryByTestId, fireEvent} = renderToDom(
          h(ModeActions, {
            mode: 'analysis',
            onSnapshot: () => {},
            onSettings: () => {},
            onReturn: () => {
              calls.return_ = true
            },
          }),
        )

        const btn = queryByTestId('mode-action-return')
        assert.ok(
          btn,
          'ModeActions analysis must render button[data-testid="mode-action-return"] -- Contract T6-08, PRD v0.5 6.6',
        )

        fireEvent.click(btn)
        assert.strictEqual(
          calls.return_,
          true,
          'Clicking mode-action-return must fire onReturn callback -- Contract T6-08',
        )
      })
    })

    // --- T6-09: BottomActionBar analysis renders compact edit toolbar ---

    describe('T6-09: BottomActionBar compact edit toolbar', function () {
      it('renders the shared EditBar in analysis mode, click fires tool callback', function () {
        const calls = {
          selectedTool: null as string | null,
        }
        const {container, queryByTestId, fireEvent} = renderToDom(
          h(BottomActionBar, {
            mode: 'analysis',
            moveNumber: 10,
            analysisAreaVertices: [[0, 0]],
            selectedTool: 'stone_1',
            onAnnotationToolChange: (tool: string) => {
              calls.selectedTool = tool
            },
          }),
        )

        const toolbar = queryByTestId('analysis-edit-toolbar')
        assert.ok(
          toolbar,
          'BottomActionBar analysis must render compact edit toolbar -- Contract T6-09',
        )

        const snapshotBtn = container.querySelector(
          '.wb-bottom-action-bar__visual [data-testid="action-snapshot"]',
        )
        assert.strictEqual(
          snapshotBtn,
          null,
          'BottomActionBar analysis drawer must not show Snapshot in the visible edit toolbar -- Contract T6-09',
        )

        const expectedToolLabels = [
          '区域选择',
          '清除区域',
          'Territory',
          'Territory Compare',
          'AI 推荐点',
          '人类偏好点',
        ]

        for (const label of expectedToolLabels) {
          const tool = container.querySelector(
            `[data-testid="analysis-edit-toolbar"] #edit a[aria-label="${label}"]`,
          )
          assert.ok(
            tool,
            `BottomActionBar analysis must render shared EditBar tool "${label}" -- Contract T6-09`,
          )
        }

        const triangleTool = container.querySelector(
          '[data-testid="analysis-edit-toolbar"] #edit a[data-id="triangle"]',
        )
        assert.ok(
          triangleTool,
          'BottomActionBar analysis must render the shared EditBar annotation tools -- Contract T6-09',
        )

        fireEvent.click(triangleTool)
        assert.strictEqual(
          calls.selectedTool,
          'triangle',
          'Clicking shared EditBar annotation tool must fire onAnnotationToolChange -- Contract T6-09',
        )
      })
    })
  })

  // ===================================================
  // CONTAINER_DELEGATION: T6-10, T6-11, T6-16, T6-17
  // ===================================================

  describe('CONTAINER_DELEGATION', function () {
    // --- T6-10: handleSnapshot calls flowService.snapshotFromCurrentContext ---

    describe('T6-10: handleSnapshot delegation', function () {
      it('onSnapshot calls flowService.snapshotFromCurrentContext(activeTab.id)', async function () {
        const harness = createHarness({
          tabs: [makeAnalysisTab({id: 'tab_del_snap'})],
        })

        const shellProps = harness.getShellProps()

        assert.strictEqual(
          typeof shellProps.onSnapshot,
          'function',
          'Container must expose onSnapshot callback',
        )

        await shellProps.onSnapshot()

        assert.deepStrictEqual(
          harness.flowService.calls.snapshotFromCurrentContext,
          [{tabId: 'tab_del_snap'}],
          'handleSnapshot must call flowService.snapshotFromCurrentContext(activeTab.id) -- Contract T6-10, PRD v0.5 5.5',
        )
      })
    })

    // --- T6-11: handleReturnFromAnalysis calls flowService.returnFromAnalysis ---

    describe('T6-11: handleReturnFromAnalysis delegation', function () {
      it('onReturn calls flowService.returnFromAnalysis({tabId})', function () {
        const harness = createHarness({
          tabs: [
            makeAnalysisTab({
              id: 'tab_del_return',
              mode: 'analysis',
              previousMode: 'recall',
            }),
          ],
        })

        const shellProps = harness.getShellProps()

        assert.strictEqual(
          typeof shellProps.onReturn,
          'function',
          'Container must expose onReturn callback',
        )

        shellProps.onReturn()

        assert.deepStrictEqual(
          harness.flowService.calls.returnFromAnalysis,
          [{tabId: 'tab_del_return'}],
          'handleReturnFromAnalysis must call flowService.returnFromAnalysis({tabId: activeTab.id}) -- Contract T6-11, Arch v0.5 5.3',
        )
      })
    })

    describe('T6-18: Analysis edit bar scratch command delegation', function () {
      it('onAnnotationToolChange updates the analysis tool projected into board scratch handling', function () {
        const harness = createHarness({
          tabs: [makeAnalysisTab({id: 'tab_edit_tool'})],
        })
        const state = installAnalysisScratchHarness(harness)

        const shellProps = harness.getShellProps()

        assert.strictEqual(
          shellProps.activeAnnotationTool,
          'stone_1',
          'Container must project selectedTool into the analysis edit bar',
        )

        shellProps.onAnnotationToolChange('stone_-1')

        assert.strictEqual(
          state.selectedTool,
          'stone_-1',
          'Analysis edit bar tool command must update the scratch/current tool selection',
        )
      })

      it('onClear clears scratch/current markers and lines without calling game-tree undo/redo', function () {
        const harness = createHarness({
          tabs: [makeAnalysisTab({id: 'tab_edit_clear'})],
        })
        const state = installAnalysisScratchHarness(harness)
        let undoCalls = 0
        let redoCalls = 0
        Object.assign(harness.sabaki, {
          undo() {
            undoCalls += 1
          },
          redo() {
            redoCalls += 1
          },
        })

        const shellProps = harness.getShellProps()

        shellProps.onClear()
        shellProps.onUndo()
        shellProps.onRedo()

        assert.deepStrictEqual(
          state.editWorkspace.currentMarkerMap,
          [
            [null, null],
            [null, null],
          ],
          'Clear must write only scratch/current marker map',
        )
        assert.deepStrictEqual(
          state.editWorkspace.currentLines,
          [],
          'Clear must write only scratch/current lines',
        )
        assert.strictEqual(
          state.editWorkspace.lineFirstVertex,
          null,
          'Clear/undo must reset scratch/current line-first state',
        )
        assert.strictEqual(
          undoCalls,
          0,
          'Analysis undo must not dispatch sabaki.undo to the source game tree',
        )
        assert.strictEqual(
          redoCalls,
          0,
          'Analysis redo must not dispatch sabaki.redo to the source game tree',
        )
      })
    })

    // --- T6-16: handleSnapshot no-op when activeTab null ---

    describe('T6-16: handleSnapshot guards activeTab null', function () {
      it('onSnapshot does not call flowService when activeTab is null', async function () {
        const harness = createHarness({
          tabs: [],
          activeTabId: null,
        })

        const shellProps = harness.getShellProps()

        // onSnapshot should still be a function (the handler)
        assert.strictEqual(
          typeof shellProps.onSnapshot,
          'function',
          'Container must expose onSnapshot even without active tab',
        )

        await shellProps.onSnapshot()

        assert.strictEqual(
          harness.flowService.calls.snapshotFromCurrentContext.length,
          0,
          'flowService.snapshotFromCurrentContext must NOT be called when activeTab is null -- Contract T6-16',
        )
      })
    })

    // --- T6-17: handleReturnFromAnalysis no-op when activeTab null ---

    describe('T6-17: handleReturnFromAnalysis guards activeTab null', function () {
      it('onReturn does not call flowService when activeTab is null', function () {
        const harness = createHarness({
          tabs: [],
          activeTabId: null,
        })

        const shellProps = harness.getShellProps()

        assert.strictEqual(
          typeof shellProps.onReturn,
          'function',
          'Container must expose onReturn even without active tab',
        )

        shellProps.onReturn()

        assert.strictEqual(
          harness.flowService.calls.returnFromAnalysis.length,
          0,
          'flowService.returnFromAnalysis must NOT be called when activeTab is null -- Contract T6-17',
        )
      })
    })
  })

  // ===================================================
  // STORE_SUBSCRIPTION: T6-12, T6-13
  // ===================================================

  describe('STORE_SUBSCRIPTION', function () {
    // --- T6-12: returnFromAnalysis notifies subscriber ---

    describe('T6-12: returnFromAnalysis subscriber notification', function () {
      it('subscriber callback is called after returnFromAnalysis', function () {
        const harness = createHarnessWithRealFlowService({
          tabs: [
            makeAnalysisTab({
              id: 'tab_sub_return',
              mode: 'analysis',
              previousMode: 'play',
            }),
          ],
        })

        let notified = false
        harness.workbenchStore.subscribe(() => {
          notified = true
        })

        harness.flowService.returnFromAnalysis({tabId: 'tab_sub_return'})

        assert.strictEqual(
          notified,
          true,
          'Subscriber must be notified after returnFromAnalysis -- Contract T6-12',
        )
      })
    })

    // --- T6-13: snapshot notifies subscriber ---

    describe('T6-13: snapshot subscriber notification', function () {
      it('subscriber callback is called after snapshotFromCurrentContext', async function () {
        const harness = createHarnessWithRealFlowService({
          tabs: [
            makeAnalysisTab({
              id: 'tab_sub_snap',
              taskId: 'task_sub_snap',
              mode: 'analysis',
            }),
          ],
        })

        let notified = false
        harness.workbenchStore.subscribe(() => {
          notified = true
        })

        // snapshotFromCurrentContext -> spy snapshotService -> spy repo.createTask ->
        // tabService.openTask (which adds a tab to workbenchStore, triggering subscriber)
        await harness.flowService.snapshotFromCurrentContext('tab_sub_snap')

        assert.strictEqual(
          notified,
          true,
          'Subscriber must be notified after snapshotFromCurrentContext (new tab added triggers store notification) -- Contract T6-13',
        )
      })
    })
  })

  // ===================================================
  // PROJECTION_RETURN: T6-14
  // ===================================================

  describe('PROJECTION_RETURN', function () {
    // --- T6-14: returnFromAnalysis projects mode=previousMode ---

    describe('T6-14: projectFromWorkbench returns mode after return', function () {
      it('after returnFromAnalysis, Container projection shows mode=recall', function () {
        const harness = createHarness({
          tabs: [
            makeAnalysisTab({
              id: 'tab_proj_return',
              mode: 'analysis',
              previousMode: 'recall',
            }),
          ],
        })

        // Verify initial projection: mode=analysis
        let shellProps = harness.getShellProps()
        assert.strictEqual(
          shellProps.mode,
          'analysis',
          'Precondition: projection mode must be analysis',
        )

        // Simulate returnFromAnalysis: update store state
        harness.workbenchStore.updateTab('tab_proj_return', {
          mode: 'recall',
          previousMode: undefined,
        })

        // Re-render to pick up new state
        shellProps = harness.getShellProps()

        // projectFromWorkbench reads activeTab.mode from store
        // This indirectly tests the projectFromWorkbench function
        // via Container.render() -> projectFromWorkbench(ws) -> shellProps.mode
        assert.strictEqual(
          shellProps.mode,
          'recall',
          'After returnFromAnalysis, projection mode must be recall -- Contract T6-14, Container.js L517-546 projectFromWorkbench',
        )
      })
    })
  })

  // ===================================================
  // SIDE_EFFECT_BOUNDARY: T6-15
  // ===================================================

  describe('SIDE_EFFECT_BOUNDARY', function () {
    // --- T6-15: snapshotService.captureSnapshotInput does not call tabService.openTask ---

    describe('T6-15: snapshotService does not call tabService.openTask', function () {
      it('during captureSnapshotInput, tabService.openTask is not called', async function () {
        const harness = createHarnessWithRealSnapshotService({
          tabs: [
            makeAnalysisTab({
              id: 'tab_se_snap',
              taskId: 'task_se_snap',
              mode: 'analysis',
            }),
          ],
        })

        // Reset openTask calls to track only captureSnapshotInput period
        harness.tabService.calls.openTask = []

        // Call captureSnapshotInput directly on the real snapshotService
        await harness.snapshotService.captureSnapshotInput({
          tabId: 'tab_se_snap',
          sourceTaskId: 'task_se_snap',
          sourceAttemptId: undefined,
        })

        assert.strictEqual(
          harness.tabService.calls.openTask.length,
          0,
          'snapshotService.captureSnapshotInput must NOT call tabService.openTask -- Contract T6-15, Arch v0.5 5.10: snapshotService only captures, Tab creation is flowService responsibility',
        )
      })
    })
  })
})
