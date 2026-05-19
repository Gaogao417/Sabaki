/**
 * W2 Shell and Tab Wiring Tests
 *
 * Test contract: docs/design/2026-05-19/workbench-wiring/w2-shell-and-tab-wiring-contract-v0.1.md
 * Contracts covered: W2-T09, W2-T10, W2-T11, W2-T12, W2-T13, W2-T14, W2-T15, W2-T21
 *
 * These tests intentionally stay at the Container boundary:
 *   Store state -> TrainingWorkbenchContainer -> WorkbenchShell props/callbacks
 *
 * They do not re-test workbenchFlowService or workbenchTabService behavior. Those
 * state transitions are covered by w2-shell-tab-state.test.js. Here the only
 * question is whether Container wires the shell callbacks to the correct service
 * method with the active tab id.
 */

import assert from 'assert'

import TrainingWorkbenchContainer from '../../../src/components/TrainingWorkbenchContainer.js'
import {createWorkbenchStore} from '../../../src/modules/training/store/workbenchStore.ts'
import {createTrainingRuntimeStore} from '../../../src/modules/training/store/trainingRuntimeStore.ts'

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
    returnFromAnalysis(tabId, toMode) { calls.returnFromAnalysis.push({tabId, toMode}) },
    completeRecall(tabId) { calls.completeRecall.push({tabId}) },
    async snapshotFromCurrentContext(tabId) { calls.snapshotFromCurrentContext.push({tabId}) },
  }
}

function createSpyTabService() {
  const calls = {
    switchTab: [],
    closeTab: [],
    openTask: [],
  }

  return {
    calls,
    switchTab(tabId) { calls.switchTab.push({tabId}) },
    async closeTab(tabId) { calls.closeTab.push({tabId}) },
    async openTask(opts) { calls.openTask.push(opts) },
  }
}

function createSpyRepository() {
  const calls = {
    createTask: [],
  }

  return {
    calls,
    async createTask(task) {
      calls.createTask.push(task)
      return task
    },
  }
}

function createSpyRecallService() {
  const calls = {
    completeRecall: [],
  }

  return {
    calls,
    completeRecall(sessionId) {
      calls.completeRecall.push({sessionId})
    },
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
  const recallService = createSpyRecallService()

  const taskImportService = {
    async createManualTask(input) {
      const task = {id: `task_${Date.now()}`, ...input}
      return task
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
    recallService,
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
  }
}

async function callRequired(props, name) {
  assert.strictEqual(typeof props[name], 'function', `Container must pass ${name} to WorkbenchShell`)
  await props[name]()
}

describe('W2 Container Wiring: flow commands', () => {
  it('wires play ModeActions end and BottomActionBar endAttempt to submit(activeTabId)', async () => {
    const {shellProps, flowService} = createHarness({
      tabs: [makeTab({id: 'tab_play', mode: 'play', activeAttemptId: 'att_1'})],
    })

    await callRequired(shellProps, 'onEnd')
    await callRequired(shellProps, 'onEndAttempt')

    assert.deepStrictEqual(flowService.calls.submit, [
      {tabId: 'tab_play'},
      {tabId: 'tab_play'},
    ])
  })

  it('wires problem submit buttons to submit(activeTabId)', async () => {
    const {shellProps, flowService} = createHarness({
      tabs: [makeTab({id: 'tab_problem', mode: 'problem', activeAttemptId: 'att_1'})],
    })

    await callRequired(shellProps, 'onSubmit')
    await callRequired(shellProps, 'onSubmitAnswer')

    assert.deepStrictEqual(flowService.calls.submit, [
      {tabId: 'tab_problem'},
      {tabId: 'tab_problem'},
    ])
  })

  it('wires analysis entry callbacks to enterAnalysis(activeTabId)', async () => {
    const {shellProps, flowService} = createHarness({
      tabs: [makeTab({id: 'tab_recall', mode: 'recall'})],
    })

    await callRequired(shellProps, 'onAnalysis')
    await callRequired(shellProps, 'onEnterAnalysis')

    assert.deepStrictEqual(flowService.calls.enterAnalysis, [
      {tabId: 'tab_recall'},
      {tabId: 'tab_recall'},
    ])
  })

  it('wires analysis return to returnFromAnalysis(activeTabId, previousMode)', async () => {
    const {shellProps, flowService} = createHarness({
      tabs: [makeTab({id: 'tab_analysis', mode: 'analysis', previousMode: 'recall'})],
    })

    await callRequired(shellProps, 'onReturn')

    assert.deepStrictEqual(flowService.calls.returnFromAnalysis, [
      {tabId: 'tab_analysis', toMode: 'recall'},
    ])
  })

  it('wires snapshot callbacks to snapshotFromCurrentContext(activeTabId)', async () => {
    const {shellProps, flowService} = createHarness({
      tabs: [makeTab({id: 'tab_any', mode: 'analysis'})],
    })

    await callRequired(shellProps, 'onSnapshot')

    assert.deepStrictEqual(flowService.calls.snapshotFromCurrentContext, [
      {tabId: 'tab_any'},
    ])
  })

  it('wires recall end to flowService.completeRecall(activeTabId)', async () => {
    const {shellProps, flowService} = createHarness({
      tabs: [makeTab({id: 'tab_recall', mode: 'recall', activeRecallSessionId: 'rs_1'})],
    })

    await callRequired(shellProps, 'onEnd')

    assert.deepStrictEqual(flowService.calls.completeRecall, [
      {tabId: 'tab_recall'},
    ])
  })
})

describe('W2 Container Wiring: tab commands and projection', () => {
  it('projects workbench tabs into GameTabBar games and activeIndex', () => {
    const {shellProps} = createHarness({
      tabs: [
        makeTab({id: 'tab_a', taskId: 'task_a', mode: 'play'}),
        makeTab({id: 'tab_b', taskId: 'task_b', mode: 'problem'}),
      ],
      activeTabId: 'tab_b',
    })

    assert.deepStrictEqual(shellProps.games, [
      {index: 0, title: 'task_a', active: false},
      {index: 1, title: 'task_b', active: true},
    ])
    assert.strictEqual(shellProps.activeIndex, 1)
    assert.strictEqual(shellProps.mode, 'problem')
  })

  it('maps selected tab index to tab id before calling switchTab', async () => {
    const {shellProps, tabService} = createHarness({
      tabs: [
        makeTab({id: 'tab_a', mode: 'play'}),
        makeTab({id: 'tab_b', mode: 'problem'}),
      ],
      activeTabId: 'tab_a',
    })

    assert.strictEqual(typeof shellProps.onSelectGame, 'function', 'Container must pass onSelectGame')
    shellProps.onSelectGame(1)

    assert.deepStrictEqual(tabService.calls.switchTab, [{tabId: 'tab_b'}])
  })

  it('maps close tab index to tab id before calling closeTab', async () => {
    const {shellProps, tabService} = createHarness({
      tabs: [
        makeTab({id: 'tab_a', mode: 'play'}),
        makeTab({id: 'tab_b', mode: 'problem'}),
      ],
      activeTabId: 'tab_a',
    })

    assert.strictEqual(typeof shellProps.onCloseGame, 'function', 'Container must pass onCloseGame')
    await shellProps.onCloseGame(0)

    assert.deepStrictEqual(tabService.calls.closeTab, [{tabId: 'tab_a'}])
  })

  it('wires add-game to create a manual task and open it in play mode', async () => {
    const {shellProps, tabService} = createHarness()

    await callRequired(shellProps, 'onAddGame')

    assert.strictEqual(tabService.calls.openTask.length, 1)
    assert.strictEqual(tabService.calls.openTask[0].mode, 'play')
  })
})
