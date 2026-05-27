/**
 * Submit-to-Recall Projection Regression Tests
 *
 * Contract: docs/archive/daily-design/2026-05-26/submit-to-recall-projection/test-contract-v0.2.md
 *
 * Harness manifest:
 * - Real production modules: TrainingWorkbenchContainer, WorkbenchShell,
 *   createWorkbenchFlowService, createAttemptService, createRecallService,
 *   createRecallCheckpointService, createWorkbenchStore,
 *   createTrainingRuntimeStore.
 * - Fake modules: typed in-memory repository constrained by TrainingRepository
 *   surface; tiny unused Sabaki shell methods; typed flow spy only for the
 *   container delegation test.
 * - Not mocked for state-forward/projection/rendered return:
 *   workbenchFlowService, attemptService, recallService, workbenchStore,
 *   runtimeStore, rendered WorkbenchShell/RecallModePanel.
 */

import assert from 'assert'
import fs from 'fs'
import {h} from 'preact'

import TrainingWorkbenchContainer from '../../../src/components/TrainingWorkbenchContainer.js'
import WorkbenchShell from '../../../src/components/WorkbenchShell.js'
import {createAttemptService} from '../../../src/modules/training/attempt/attemptService.ts'
import {createRecallCheckpointService} from '../../../src/modules/training/recall/recallCheckpointService.ts'
import {createRecallService} from '../../../src/modules/training/recall/recallService.ts'
import {createTrainingRuntimeStore} from '../../../src/modules/training/store/trainingRuntimeStore.ts'
import {createWorkbenchStore} from '../../../src/modules/training/store/workbenchStore.ts'
import {createWorkbenchFlowService} from '../../../src/modules/training/workbench/workbenchFlowService.ts'
import {
  createPhase3StrictRecallRepository,
  seedPhase3RecallAttempt,
} from '../../training/phase3TypedFakes.ts'
import {renderToDom} from '../preactTestHelper.js'
import {
  createNoopLegacyController,
  createSpyFlowService,
  createSpyReviewService,
  createSpyTabService,
  createSpyTaskImportService,
} from '../shared/workbenchSpyFactories.ts'

const CONTRACT_PATH = 'docs/archive/daily-design/2026-05-26/submit-to-recall-projection/test-contract-v0.2.md'
const TEST_PATH = 'test/workbench/wiring/submit-to-recall-projection.test.js'

function installSabakiSettingGlobal() {
  globalThis.window.sabaki = {
    setting: {
      get(key) {
        if (key === 'view.show_coordinates') return true
        if (key === 'view.show_next_moves') return false
        if (key === 'view.show_siblings') return false
        if (key === 'view.fuzzy_stone_placement') return false
        if (key === 'view.animate_stone_placement') return false
        return false
      },
    },
  }
}

function makeTab(overrides = {}) {
  const now = '2026-05-26T00:00:00.000Z'
  return {
    id: 'tab_s2r_1',
    taskId: 'task_s2r_1',
    mode: 'problem',
    activeAttemptId: 'attempt_s2r_1',
    childTabIds: [],
    parentTabId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeSabaki(context, overrides = {}) {
  return {
    state: {
      mode: 'play',
      treePosition: '',
      gameTrees: [],
      gameIndex: 0,
      selectedTool: 'stone_1',
      editWorkspace: null,
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
    setMode(mode) {
      this.state.mode = mode
    },
    setState(patch) {
      Object.assign(this.state, typeof patch === 'function' ? patch(this.state) : patch)
    },
    scheduleEditWorkspaceAnalysis() {},
    createAnalysisWorkspace() {
      return {}
    },
    openDrawer() {},
    flashInfoOverlay() {},
    makeResign() {},
    undo() {},
    redo() {},
    makeMove() {},
    setComment() {},
    clearAnalysisArea() {},
    commitEditResult() {},
    toggleThirdPartyPanel() {},
    setCurrentTreePosition() {},
    stopEngineGameTraining: async () => {},
    startProblem: async () => {},
    ...overrides,
  }
}

function createRealSubmitHarness({mode = 'problem'} = {}) {
  installSabakiSettingGlobal()

  const workbenchStore = createWorkbenchStore()
  const runtimeStore = createTrainingRuntimeStore()
  const repository = createPhase3StrictRecallRepository()
  const attempt = seedPhase3RecallAttempt(repository, {
    id: 'attempt_s2r_1',
    taskId: 'task_s2r_1',
    tabId: 'tab_s2r_1',
    status: 'playing',
    userLine: ['D4', 'Q16', 'C3'],
  })

  workbenchStore.addTab(makeTab({
    mode,
    activeAttemptId: attempt.id,
    taskId: attempt.taskId,
  }))
  workbenchStore.setActiveTab('tab_s2r_1')

  const checkpointService = createRecallCheckpointService({
    repository,
    runtimeStore,
  })
  const tabService = createSpyTabService()
  const flowService = createWorkbenchFlowService({
    workbenchStore,
    repository,
    runtimeStore,
    attemptService: createAttemptService({repository, runtimeStore}),
    recallService: createRecallService({
      repository,
      runtimeStore,
      checkpointService,
    }),
    recallCheckpointService: checkpointService,
    snapshotService: {
      async captureSnapshotInput() {
        return {
          sourceTaskId: attempt.taskId,
          positionSgf: '(;SZ[19])',
          sideToMove: 'black',
        }
      },
      async createProblemFromCurrentAnalysisPosition() {
        return {id: 'unused_snapshot_problem'}
      },
    },
    tabService,
  })

  const context = {
    runtimeStore,
    workbenchStore,
    repository,
    flowService,
    tabService,
    workbenchFlowService: flowService,
    workbenchTabService: tabService,
    legacyTrainingFlowController: createNoopLegacyController(),
    reviewService: createSpyReviewService(),
    taskImportService: createSpyTaskImportService(),
    recallCheckpointService: checkpointService,
  }
  const sabaki = makeSabaki(context)
  const container = new TrainingWorkbenchContainer({sabaki})

  return {
    attempt,
    container,
    flowService,
    repository,
    runtimeStore,
    sabaki,
    workbenchStore,
    getShellProps() {
      return container.render().props
    },
    renderShellVNode() {
      return container.render()
    },
  }
}

function createDelegationHarness() {
  installSabakiSettingGlobal()

  const workbenchStore = createWorkbenchStore()
  const runtimeStore = createTrainingRuntimeStore()
  const repository = createPhase3StrictRecallRepository()
  workbenchStore.addTab(makeTab())
  workbenchStore.setActiveTab('tab_s2r_1')

  const flowService = createSpyFlowService()
  const tabService = createSpyTabService()
  const context = {
    runtimeStore,
    workbenchStore,
    repository,
    flowService,
    tabService,
    workbenchFlowService: flowService,
    workbenchTabService: tabService,
    legacyTrainingFlowController: createNoopLegacyController(),
    reviewService: createSpyReviewService(),
    taskImportService: createSpyTaskImportService(),
    recallCheckpointService: createRecallCheckpointService({repository, runtimeStore}),
  }
  const sabaki = makeSabaki(context)
  const container = new TrainingWorkbenchContainer({sabaki})

  return {
    container,
    flowService,
    getShellProps() {
      return container.render().props
    },
  }
}

function stripCommentsAndStrings(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n\r]*/g, '')
    .replace(/(['"`])(?:\\[\s\S]|(?!\1)[\s\S])*\1/g, '')
}

function extractFunctionSource(source, functionName) {
  const start = source.indexOf(`function ${functionName}`)
  if (start < 0) throw new Error(`function ${functionName} not found`)

  const open = source.indexOf('{', start)
  if (open < 0) throw new Error(`function ${functionName} has no body`)

  let depth = 0
  for (let index = open; index < source.length; index++) {
    const char = source[index]
    if (char === '{') depth += 1
    if (char === '}') depth -= 1
    if (depth === 0) return source.slice(start, index + 1)
  }

  throw new Error(`function ${functionName} body is not balanced`)
}

describe('submit-to-recall projection regression', function () {
  it('S2R-T01: visible Problem submit controls emit semantic callbacks without payload requirements', function () {
    let topSubmitCalls = 0
    let leftSubmitCalls = 0

    const {getByTestId, fireEvent} = renderToDom(h(WorkbenchShell, {
      mode: 'problem',
      onSubmit() {
        topSubmitCalls += 1
      },
      onSubmitAnswer() {
        leftSubmitCalls += 1
      },
      games: [{index: 0, title: 'task_s2r_1', active: true}],
      activeIndex: 0,
    }))

    fireEvent.click(getByTestId('mode-action-submit'))
    fireEvent.click(getByTestId('submit-answer-btn'))

    assert.strictEqual(topSubmitCalls, 1)
    assert.strictEqual(leftSubmitCalls, 1)
  })

  it('S2R-T02: Container delegates submit callbacks to flowService.submit(activeTab.id)', async function () {
    const harness = createDelegationHarness()
    const shellProps = harness.getShellProps()

    await shellProps.onSubmit()
    await shellProps.onSubmitAnswer()

    assert.deepStrictEqual(harness.flowService.calls.submit, [
      {tabId: 'tab_s2r_1'},
      {tabId: 'tab_s2r_1'},
    ])
  })

  it('S2R-T04: real submit notifies Container subscribers and changes projected mode outcome', async function () {
    const harness = createRealSubmitHarness()
    let forceUpdateCount = 0
    const projectedDuringForceUpdate = []
    const originalForceUpdate = harness.container.forceUpdate.bind(harness.container)
    harness.container.forceUpdate = function forceUpdate() {
      forceUpdateCount += 1
      projectedDuringForceUpdate.push(this.render().props)
      return originalForceUpdate()
    }

    const before = harness.getShellProps()
    assert.strictEqual(before.mode, 'problem')

    await before.onSubmitAnswer()

    const after = harness.getShellProps()
    assert.ok(forceUpdateCount > 0, 'real store updates must notify the Container subscription')
    assert.strictEqual(after.mode, 'recall')
    assert.ok(
      projectedDuringForceUpdate.some(props =>
        props.mode === 'recall' &&
        props.state === 'active' &&
        props.recallSession?.active === true &&
        props.totalMoves === harness.attempt.userLine.length
      ),
      'subscription-driven forceUpdate must observe active Recall surface props',
    )
  })

  it('S2R-T05: real submit projects active Recall props without caller-seeded recall state', async function () {
    const harness = createRealSubmitHarness()
    const before = harness.getShellProps()
    assert.strictEqual(before.mode, 'problem')

    await before.onSubmitAnswer()

    const shellProps = harness.getShellProps()
    const session = Object.values(harness.repository.store.sessions)[0]

    assert.strictEqual(shellProps.mode, 'recall')
    assert.strictEqual(shellProps.state, 'active')
    assert.strictEqual(shellProps.currentMove, 0)
    assert.strictEqual(shellProps.totalMoves, harness.attempt.userLine.length)
    assert.strictEqual(shellProps.progress, 0)
    assert.strictEqual(shellProps.recallSession?.active, true)
    assert.strictEqual(harness.runtimeStore.getState().activeRecallSessionId, session.id)
  })

  it('S2R-T06: rendered Shell selects Recall panel with active progress after real submit', async function () {
    const harness = createRealSubmitHarness()

    await harness.getShellProps().onSubmitAnswer()

    const {container, queryByTestId} = renderToDom(harness.renderShellVNode())
    assert.strictEqual(container.querySelector('[data-mode="recall"]') != null, true)
    assert.strictEqual(queryByTestId('recall-mode-panel') != null, true)
    assert.strictEqual(container.textContent.includes('暂无回忆任务'), false)
    assert.strictEqual(container.textContent.includes(`0 / ${harness.attempt.userLine.length}`), true)
  })

  it('S2R-T08: stale recall projection is not treated as the active Recall surface', async function () {
    const harness = createRealSubmitHarness()

    await harness.getShellProps().onSubmitAnswer()

    const runtime = harness.runtimeStore.getState()
    assert.ok(runtime.recallView, 'real submit should create an active projection before stale mismatch is tested')
    harness.workbenchStore.updateTab('tab_s2r_1', {activeRecallSessionId: 'rs_other'})

    const shellProps = harness.getShellProps()
    assert.notStrictEqual(shellProps.recallSession?.active, true)
    assert.notStrictEqual(shellProps.state, 'active')
  })

  it('S2R-T07: regression suite does not manually seed the submit-to-recall success path', function () {
    const stripped = stripCommentsAndStrings(fs.readFileSync(TEST_PATH, 'utf8'))
    assert.strictEqual(/setRecallView\s*\(/.test(stripped), false)
    assert.strictEqual(/props\s*\.\s*mode/.test(stripped), false)
    assert.strictEqual(
      /updateTab\s*\([\s\S]{0,120}mode\s*:/.test(stripped),
      false,
      'success-path tests must not force recall mode via workbenchStore.updateTab',
    )
  })

  it('S2R-T09: touched submit-to-recall files keep presentational and source-specific API boundaries', function () {
    const files = [
      'src/components/WorkbenchShell.js',
      'src/components/workbench/panels/RecallModePanel.js',
      'src/components/TrainingWorkbenchContainer.js',
    ]
    const forbidden = [
      'openLegacyGameTab',
      'openLegacyProblemTab',
      'openSnapshotProblemTab',
      'origin.provider',
      'source_kind',
      'sourceKind',
      'source.kind',
    ]

    for (const file of files) {
      const source = stripCommentsAndStrings(fs.readFileSync(file, 'utf8'))
      for (const token of forbidden) {
        assert.strictEqual(source.includes(token), false, `${file} must not add ${token}`)
      }
    }

    const flowSource = stripCommentsAndStrings(fs.readFileSync('src/modules/training/workbench/workbenchFlowService.ts', 'utf8'))
    const submitSource = extractFunctionSource(flowSource, 'submit')
    for (const token of [...forbidden, 'snapshotService']) {
      assert.strictEqual(
        submitSource.includes(token),
        false,
        `workbenchFlowService.submit must not add source-specific branching: ${token}`,
      )
    }

    const shellSource = stripCommentsAndStrings(fs.readFileSync('src/components/WorkbenchShell.js', 'utf8'))
    const recallPanelSource = stripCommentsAndStrings(fs.readFileSync('src/components/workbench/panels/RecallModePanel.js', 'utf8'))
    for (const token of ['recallService', 'runtimeStore', 'repository', 'window.sabaki']) {
      assert.strictEqual(shellSource.includes(token), false, `WorkbenchShell must remain presentational: ${token}`)
      assert.strictEqual(recallPanelSource.includes(token), false, `RecallModePanel must remain presentational: ${token}`)
    }

    assert.ok(fs.readFileSync(CONTRACT_PATH, 'utf8').includes('S2R-T09'))
  })
})
