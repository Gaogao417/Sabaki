/**
 * Snapshot null-task enter-analysis guard.
 *
 * Contract sources:
 * - docs/product/sabaki-training-prd.md: Snapshot is globally discoverable,
 *   but persistence must first project to WorkbenchMode.analysis scratch/current.
 * - docs/ui_ux/workbench-six-screen-migration-wiring-plan.md: Global Snapshot
 *   outside Analysis calls enterAnalysis first; Analysis Snapshot persists.
 *
 * Harness manifest:
 * - Layer: Workbench wiring / container command routing.
 * - Production subject: TrainingWorkbenchContainer snapshot handler and real
 *   workbench/runtime stores.
 * - Real dependencies: TrainingWorkbenchContainer, createWorkbenchStore,
 *   createTrainingRuntimeStore.
 * - Controlled fakes: flowService boundary spy that updates the real store on
 *   enterAnalysis; snapshotFromCurrentContext records calls only.
 * - Mocked dependencies: tiny Sabaki shell and tab/repository shells required
 *   by Container.render().
 * - Primary assertions: a non-analysis tab with taskId:null routes Snapshot to
 *   enterAnalysis, changes the active tab to analysis, initializes analysis
 *   workspace state, and does not call snapshot persistence/openTask.
 * - Expected status before step5.2: RED if Container still sends global
 *   Snapshot directly to snapshotFromCurrentContext.
 */

import assert from 'assert'

import TrainingWorkbenchContainer from '../../../src/components/TrainingWorkbenchContainer.js'
import {createTrainingRuntimeStore} from '../../../src/modules/training/store/trainingRuntimeStore.ts'
import {createWorkbenchStore} from '../../../src/modules/training/store/workbenchStore.ts'

const now = '2026-05-26T00:00:00.000Z'

function installWindowGlobal() {
  if (!globalThis.window) globalThis.window = {}
  globalThis.window.sabaki = {
    setting: {
      get() { return false },
      set() {},
    },
  }
}

function makeTab(overrides = {}) {
  return {
    id: 'tab_default',
    taskId: null,
    mode: 'play',
    childTabIds: [],
    parentTabId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function createHarness({tab = makeTab()} = {}) {
  installWindowGlobal()

  const calls = {
    enterAnalysis: [],
    snapshotFromCurrentContext: [],
    openTask: [],
    createAnalysisWorkspace: 0,
    scheduleEditWorkspaceAnalysis: [],
  }
  const workbenchStore = createWorkbenchStore()
  const runtimeStore = createTrainingRuntimeStore()
  workbenchStore.addTab(tab)
  workbenchStore.setActiveTab(tab.id)

  const flowService = {
    enterAnalysis(tabId, options = {}) {
      calls.enterAnalysis.push({tabId, options})
      const current = workbenchStore.getState().tabs.find(item => item.id === tabId)
      workbenchStore.updateTab(tabId, {
        mode: 'analysis',
        analysisReturnTarget: current ? {mode: current.mode} : undefined,
      })
      sabaki.setState({
        mode: 'analysis',
        editWorkspace: sabaki.createAnalysisWorkspace(),
        analysisType: 'full',
      })
    },
    async snapshotFromCurrentContext(tabId) {
      calls.snapshotFromCurrentContext.push({tabId})
      return makeTab({
        id: 'tab_snapshot_child',
        taskId: 'task_snapshot_child',
        mode: 'problem',
        parentTabId: tabId,
      })
    },
    async submit() {},
    returnFromAnalysis() {},
    completeRecall() {},
    restartAttempt() {},
    async startAttempt() {},
    updatePlayerConfig() {},
    async submitCheckpointCorrection() {},
    async revealCheckpointAi() { return [] },
    async skipCheckpoint() {},
    async saveCheckpointComment() {},
    async loadDashboardData() {
      return {
        inboxTasks: [],
        incompleteAttempts: [],
        incompleteRecallSessions: [],
        recentBadMoveTasks: [],
      }
    },
  }

  const tabService = {
    async openTask(input) {
      calls.openTask.push(input)
      return makeTab({id: 'tab_opened', taskId: input.taskId, mode: input.mode || 'play'})
    },
    switchTab() {},
    closeTab() {},
  }

  const context = {
    runtimeStore,
    workbenchStore,
    flowService,
    workbenchFlowService: flowService,
    tabService,
    workbenchTabService: tabService,
    repository: {},
    taskImportService: {
      async createManualTask() { return {id: 'task_manual'} },
    },
    legacyTrainingFlowController: {
      showRecallHint() {},
      skipRecallMove() {},
      undoProblemMove() {},
      submitProblemAttempt() {},
      exitProblemMode() {},
    },
    reviewService: {
      async getDueItems() { return [] },
      async startSession() {},
      async updateScheduleAfterResult() {},
      async openDueItem() {},
    },
  }

  const sabaki = {
    state: {
      mode: tab.mode,
      treePosition: '',
      gameTrees: [],
      gameIndex: 0,
      editWorkspace: null,
      analysisType: null,
      selectedTool: 'play',
      boardTransformation: [1, 0, 0, 1, 0, 0],
    },
    getTrainingContext() {
      return context
    },
    getPlayServices() {
      return {documentStore: null}
    },
    getOverlayStore() {
      return {getState: () => ({territoryEnabled: false, territoryCompareEnabled: false})}
    },
    getTrainingServices() {
      return {}
    },
    setMode(mode) {
      this.state.mode = mode
    },
    setState(patch) {
      Object.assign(this.state, typeof patch === 'function' ? patch(this.state) : patch)
    },
    createAnalysisWorkspace() {
      calls.createAnalysisWorkspace += 1
      return {
        activeTab: 'current',
        currentSnapshot: {id: 'snap_current_null_task', role: 'current'},
        referenceSnapshot: null,
      }
    },
    scheduleEditWorkspaceAnalysis(...args) {
      calls.scheduleEditWorkspaceAnalysis.push(args)
    },
    openDrawer() {},
    flashInfoOverlay() {},
    makeResign() {},
    makeMove() {},
    undo() {},
    redo() {},
    setComment() {},
    clearAnalysisArea() {},
    commitEditResult() {},
    toggleThirdPartyPanel() {},
    setCurrentTreePosition() {},
    startProblem: async () => {},
    stopEngineGameTraining: async () => {},
  }

  const container = new TrainingWorkbenchContainer({sabaki})

  return {
    calls,
    container,
    runtimeStore,
    sabaki,
    workbenchStore,
  }
}

describe('Snapshot null-task enter-analysis guard', function () {
  for (const mode of ['play', 'problem', 'recall']) {
    it(`routes ${mode} Snapshot through enterAnalysis without creating a snapshot task`, async function () {
      const harness = createHarness({
        tab: makeTab({id: `tab_${mode}`, taskId: null, mode}),
      })

      const shellProps = harness.container.render().props
      await shellProps.onSnapshot()

      assert.deepStrictEqual(
        harness.calls.enterAnalysis,
        [{tabId: `tab_${mode}`, options: {reason: 'snapshot'}}],
        'global Snapshot from non-analysis must enter Analysis first',
      )
      assert.deepStrictEqual(
        harness.calls.snapshotFromCurrentContext,
        [],
        'non-analysis Snapshot must not persist directly from a null-task tab',
      )
      assert.deepStrictEqual(
        harness.calls.openTask,
        [],
        'non-analysis Snapshot must not open a snapshot child tab before Analysis',
      )

      const activeTab = harness.workbenchStore.getState().tabs.find(
        item => item.id === `tab_${mode}`,
      )
      assert.strictEqual(activeTab.mode, 'analysis')
      assert.strictEqual(activeTab.analysisReturnTarget.mode, mode)
      assert.strictEqual(harness.sabaki.state.mode, 'analysis')
      assert.ok(
        harness.sabaki.state.editWorkspace,
        'enter-analysis guard must initialize an analysis scratch workspace',
      )
    })
  }

  it('keeps direct snapshot persistence scoped to already-analysis tabs', async function () {
    const harness = createHarness({
      tab: makeTab({id: 'tab_analysis', taskId: 'task_analysis', mode: 'analysis'}),
    })

    const shellProps = harness.container.render().props
    await shellProps.onSnapshot()

    assert.deepStrictEqual(harness.calls.enterAnalysis, [])
    assert.deepStrictEqual(
      harness.calls.snapshotFromCurrentContext,
      [{tabId: 'tab_analysis'}],
      'already-analysis Snapshot may call the persistence flow',
    )
  })
})
