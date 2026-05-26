/**
 * Phase 5 Recall Checkpoint Command Path Tests
 *
 * Contract: docs/archive/daily-design/2026-05-25/phase5-checkpoint-command-path/test-contract-v0.2.md
 *
 * Harness manifest:
 * - Real production modules: createWorkbenchFlowService, createRecallCheckpointService,
 *   createWorkbenchStore, createTrainingRuntimeStore, TrainingWorkbenchContainer,
 *   WorkbenchShell, RecallModePanel.
 * - Fake modules: strict in-memory repository bound to the TrainingRepository surface
 *   used by recallCheckpointService/workbenchFlowService; tiny unused service stubs.
 * - Not mocked for state-forward coverage: workbenchFlowService, recallCheckpointService.
 */

import assert from 'assert'
import fs from 'fs'
import {h, render} from 'preact'

import TrainingWorkbenchContainer from '../../../src/components/TrainingWorkbenchContainer.js'
import {createRecallCheckpointService} from '../../../src/modules/training/recall/recallCheckpointService.ts'
import {createTrainingRuntimeStore} from '../../../src/modules/training/store/trainingRuntimeStore.ts'
import {createWorkbenchStore} from '../../../src/modules/training/store/workbenchStore.ts'
import {createWorkbenchFlowService} from '../../../src/modules/training/workbench/workbenchFlowService.ts'
import {renderToDom} from '../preactTestHelper.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function makeTab(overrides = {}) {
  const now = '2026-05-25T00:00:00.000Z'
  return {
    id: 'tab_1',
    taskId: 'task_1',
    mode: 'recall',
    recallSubstate: 'checkpoint_correction',
    activeRecallSessionId: 'rs_1',
    activeAttemptId: 'attempt_1',
    childTabIds: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeRecallView(overrides = {}) {
  return {
    recallSessionId: 'rs_1',
    taskId: 'task_1',
    tabId: 'tab_1',
    moveIndex: 1,
    expectedMoves: ['D4', 'Q16', 'C3'],
    userAttempts: [{isCorrect: true}],
    showHint: false,
    completed: false,
    ...overrides,
  }
}

function createStrictCheckpointRepository() {
  const store = {
    attempts: {
      attempt_1: {
        id: 'attempt_1',
        taskId: 'task_1',
        tabId: 'tab_1',
        userLine: ['D4', 'Q16', 'C3'],
        result: 'pending',
        status: 'submitted',
      },
    },
    recallSessions: {
      rs_1: {
        id: 'rs_1',
        taskId: 'task_1',
        tabId: 'tab_1',
        attemptId: 'attempt_1',
        expectedMoves: ['D4', 'Q16', 'C3'],
        currentMoveIndex: 1,
        completed: false,
        createdAt: '2026-05-25T00:00:00.000Z',
      },
    },
    checkpoints: {
      cp_1: {
        id: 'cp_1',
        recallSessionId: 'rs_1',
        badMoveId: 'bm_1',
        status: 'pending_correction',
        userCorrectionLine: [],
        aiCandidateLines: [],
        createdAt: '2026-05-25T00:00:00.000Z',
      },
    },
    badMoves: {
      bm_1: {
        id: 'bm_1',
        moveEvaluationId: 'eval_1',
        attemptId: 'attempt_1',
        taskId: 'task_1',
        moveIndex: 1,
        severity: 'major',
        punishSide: 'black',
        createdAt: '2026-05-25T00:00:00.000Z',
      },
    },
    evaluations: [
      {
        id: 'eval_1',
        attemptId: 'attempt_1',
        moveIndex: 1,
        move: 'Q16',
        engineSuggestedLine: ['R17', 'D3'],
        afterScoreLead: 4.2,
        afterWinrate: 0.64,
        status: 'evaluated',
        createdAt: '2026-05-25T00:00:00.000Z',
      },
    ],
    comments: [],
  }

  const calls = []
  const protectedAttemptWrites = []
  const protectedAttemptFields = new Set(['userLine', 'result', 'status'])

  return {
    store,
    calls,
    protectedAttemptWrites,

    async loadTask(taskId) {
      return {id: taskId, rootPositionSgf: '(;SZ[19])'}
    },
    async loadAttempt(attemptId) {
      return clone(store.attempts[attemptId]) || null
    },
    async updateAttempt(attemptId, patch) {
      calls.push(['updateAttempt', attemptId, clone(patch)])
      const protectedFields = Object.keys(patch).filter(key => protectedAttemptFields.has(key))
      if (protectedFields.length > 0) {
        protectedAttemptWrites.push({attemptId, patch: clone(patch), protectedFields})
        throw new Error(`protected Attempt write: ${protectedFields.join(',')}`)
      }
      store.attempts[attemptId] = {...store.attempts[attemptId], ...clone(patch)}
    },
    async loadRecallSession(sessionId) {
      return clone(store.recallSessions[sessionId]) || null
    },
    async updateRecallSession(sessionId, patch) {
      calls.push(['updateRecallSession', sessionId, clone(patch)])
      store.recallSessions[sessionId] = {...store.recallSessions[sessionId], ...clone(patch)}
    },
    async createRecallSession(session) {
      calls.push(['createRecallSession', clone(session)])
      store.recallSessions[session.id] = clone(session)
      return clone(session)
    },
    async loadRecallCheckpoint(checkpointId) {
      return clone(store.checkpoints[checkpointId]) || null
    },
    async createRecallCheckpoint(checkpoint) {
      calls.push(['createRecallCheckpoint', clone(checkpoint)])
      store.checkpoints[checkpoint.id] = clone(checkpoint)
      return clone(checkpoint)
    },
    async updateRecallCheckpoint(checkpointId, patch) {
      calls.push(['updateRecallCheckpoint', checkpointId, clone(patch)])
      store.checkpoints[checkpointId] = {...store.checkpoints[checkpointId], ...clone(patch)}
    },
    async listCheckpointsByRecallSession(recallSessionId) {
      return Object.values(store.checkpoints)
        .filter(checkpoint => checkpoint.recallSessionId === recallSessionId)
        .map(clone)
    },
    async loadBadMove(badMoveId) {
      return clone(store.badMoves[badMoveId]) || null
    },
    async updateBadMove(badMoveId, patch) {
      calls.push(['updateBadMove', badMoveId, clone(patch)])
      store.badMoves[badMoveId] = {...store.badMoves[badMoveId], ...clone(patch)}
    },
    async listBadMovesByAttempt(attemptId) {
      return Object.values(store.badMoves)
        .filter(badMove => badMove.attemptId === attemptId)
        .map(clone)
    },
    async listMoveEvaluationsByAttempt(attemptId) {
      return store.evaluations
        .filter(evaluation => evaluation.attemptId === attemptId)
        .map(clone)
    },
    async createMoveComment(comment) {
      calls.push(['createMoveComment', clone(comment)])
      store.comments.push(clone(comment))
      return clone(comment)
    },
    async transaction(fn) {
      return fn()
    },
    async listIncompleteAttempts() { return [] },
    async listIncompleteRecallSessions() { return [] },
  }
}

function createHarness(options = {}) {
  const workbenchStore = createWorkbenchStore()
  const runtimeStore = createTrainingRuntimeStore()
  const repository = createStrictCheckpointRepository()
  const tab = makeTab(options.tab)

  if (options.checkpointPatch) {
    repository.store.checkpoints.cp_1 = {
      ...repository.store.checkpoints.cp_1,
      ...clone(options.checkpointPatch),
    }
  }

  workbenchStore.addTab(tab)
  workbenchStore.setActiveTab(tab.id)
  runtimeStore.setActiveCheckpoint('cp_1')
  runtimeStore.setCorrectionDraft({checkpointId: 'cp_1', moves: ['R17', 'D3']})
  runtimeStore.setRecallView(makeRecallView())

  const recallCheckpointService = createRecallCheckpointService({
    repository,
    runtimeStore,
  })

  const tabSubstates = []
  workbenchStore.subscribe(() => {
    const active = workbenchStore.getState().tabs.find(item => item.id === tab.id)
    tabSubstates.push(active?.recallSubstate)
  })

  const flowService = createWorkbenchFlowService({
    workbenchStore,
    repository,
    attemptService: {
      async createAttempt() { return {id: 'attempt_new'} },
      async freezeAttempt() {},
      async finalizeAttemptResult() {},
    },
    recallService: {
      async createRecallFromAttempt() { return {id: 'rs_new'} },
      async completeRecall() {},
    },
    recallCheckpointService,
    snapshotService: {
      async captureSnapshotInput() { return {positionSgf: '(;SZ[19])', sideToMove: 1} },
      async createProblemFromCurrentAnalysisPosition() { return {positionSgf: '(;SZ[19])', sideToMove: 1} },
    },
    tabService: {
      async openTask() { return makeTab({id: 'tab_new', mode: 'problem'}) },
      switchTab() {},
      closeTab() {},
    },
    runtimeStore,
  })

  return {flowService, repository, runtimeStore, workbenchStore, recallCheckpointService, tabSubstates}
}

function makeBoardProps() {
  const noop = () => {}
  return {
    boardStateProps: {
      gameTree: null,
      treePosition: '',
      board: {
        width: 9,
        height: 9,
        signMap: Array(9).fill(null).map(() => Array(9).fill(0)),
        markers: Array(9).fill(null).map(() => Array(9).fill(null)),
        lines: [],
      },
    },
    overlayDisplayProps: {
      paintMap: [],
      markerMap: [],
      dimmedStones: [],
      analysis: null,
      showMoveNumbers: false,
      showNextMoves: false,
      showSiblings: false,
      crosshair: false,
      overlayGhostStoneMap: null,
      showCoordinates: true,
      showMoveColorization: false,
      fuzzyStonePlacement: false,
      animateStonePlacement: false,
      highlightVertices: [],
      analysisType: '',
      showHumanPreference: false,
    },
    interactionProps: {
      dragMode: false,
      drawLineMode: null,
      areaSelectMode: false,
      transformation: [1, 0, 0, 1, 0, 0],
    },
    handlerProps: {
      onVertexClick: noop,
      onLineDraw: noop,
      onAreaSelect: noop,
      onStoneDragEnd: null,
      onPlayVariationMoves: null,
    },
  }
}

function assertNoProtectedAttemptWrites(repository) {
  assert.deepStrictEqual(
    repository.protectedAttemptWrites,
    [],
    'checkpoint commands must not issue protected updateAttempt({userLine/result/status}) patches',
  )
}

describe('Phase 5 checkpoint command path', function () {
  it('P5CP-T02: submit correction then reveal AI through real flow and service', async function () {
    const {flowService, repository, runtimeStore, workbenchStore} = createHarness()

    assert.strictEqual(typeof flowService.submitCheckpointCorrection, 'function')
    assert.strictEqual(typeof flowService.revealCheckpointAi, 'function')

    await flowService.submitCheckpointCorrection('tab_1')

    assert.deepStrictEqual(repository.store.checkpoints.cp_1.userCorrectionLine, ['R17', 'D3'])
    assert.strictEqual(runtimeStore.getState().correctionDraft, undefined)
    assert.strictEqual(workbenchStore.getState().tabs[0].mode, 'recall')
    assert.strictEqual(workbenchStore.getState().tabs[0].recallSubstate, 'checkpoint_correction')

    const lines = await flowService.revealCheckpointAi('tab_1')

    assert.strictEqual(repository.store.checkpoints.cp_1.status, 'ai_revealed')
    assert.deepStrictEqual(lines.map(line => line.moves), [['R17', 'D3']])
    assert.strictEqual(workbenchStore.getState().tabs[0].mode, 'recall')
    assert.strictEqual(workbenchStore.getState().tabs[0].recallSubstate, 'checkpoint_ai_revealed')
    assertNoProtectedAttemptWrites(repository)
  })

  it('P5CP-T03: save comment proves commentCheckpoint then resumeRecall transitions', async function () {
    const {flowService, repository, runtimeStore, workbenchStore, tabSubstates} = createHarness({
      tab: {recallSubstate: 'checkpoint_ai_revealed'},
      checkpointPatch: {
        status: 'ai_revealed',
        userCorrectionLine: ['R17', 'D3'],
        aiCandidateLines: [{label: 'AI recommended', moves: ['R17', 'D3'], source: 'engine'}],
      },
    })

    assert.strictEqual(typeof flowService.saveCheckpointComment, 'function')

    await flowService.saveCheckpointComment({tabId: 'tab_1', content: 'Better shape at R17.'})

    assert.deepStrictEqual(
      tabSubstates.filter(Boolean),
      ['checkpoint_commenting', 'normal'],
      'atomic save must apply commentCheckpoint before resumeRecall',
    )
    assert.strictEqual(repository.store.comments.length, 1)
    assert.deepStrictEqual(repository.store.comments[0].target, {kind: 'checkpoint', checkpointId: 'cp_1'})
    assert.strictEqual(repository.store.comments[0].content, 'Better shape at R17.')
    assert.strictEqual(repository.store.checkpoints.cp_1.status, 'commented')
    assert.ok(repository.store.checkpoints.cp_1.completedAt)
    assert.strictEqual(repository.store.recallSessions.rs_1.currentMoveIndex, 2)
    assert.strictEqual(runtimeStore.getState().activeCheckpointId, undefined)
    assert.strictEqual(workbenchStore.getState().tabs[0].mode, 'recall')
    assert.strictEqual(workbenchStore.getState().tabs[0].recallSubstate, 'normal')
    assertNoProtectedAttemptWrites(repository)
  })

  it('P5CP-T04: skip checkpoint advances recall and returns to normal substate', async function () {
    const {flowService, repository, runtimeStore, workbenchStore} = createHarness()

    assert.strictEqual(typeof flowService.skipCheckpoint, 'function')

    await flowService.skipCheckpoint('tab_1')

    assert.strictEqual(repository.store.checkpoints.cp_1.status, 'skipped')
    assert.ok(repository.store.checkpoints.cp_1.completedAt)
    assert.strictEqual(repository.store.recallSessions.rs_1.currentMoveIndex, 2)
    assert.strictEqual(runtimeStore.getState().activeCheckpointId, undefined)
    assert.strictEqual(runtimeStore.getState().correctionDraft, undefined)
    assert.strictEqual(workbenchStore.getState().tabs[0].mode, 'recall')
    assert.strictEqual(workbenchStore.getState().tabs[0].recallSubstate, 'normal')
    assertNoProtectedAttemptWrites(repository)
  })

  it('P5CP-T05: rendered skip control runs the full command path and re-renders progress surface', async function () {
    const {flowService, repository, runtimeStore, workbenchStore} = createHarness()
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
    const trainingContext = {
      runtimeStore,
      workbenchStore,
      flowService,
      workbenchFlowService: flowService,
      tabService: {switchTab() {}, closeTab() {}, async openTask() { return makeTab({id: 'tab_new'}) }},
      workbenchTabService: {switchTab() {}, closeTab() {}, async openTask() { return makeTab({id: 'tab_new'}) }},
      legacyTrainingFlowController: {
        showRecallHint() {},
        skipRecallMove() {},
        exitProblemMode() {},
        undoProblemMove() {},
      },
      taskImportService: {async createManualTask() { return {id: 'task_new'} }},
      reviewService: {async updateScheduleAfterResult() {}},
      repository,
    }
    const sabaki = {
      state: {},
      getTrainingContext() { return trainingContext },
      getPlayServices() { return {documentStore: null} },
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

    const containerInstance = new TrainingWorkbenchContainer({sabaki})
    containerInstance.props = {sabaki}
    const renderShell = () => {
      const shellVNode = containerInstance.render()
      return h(shellVNode.type, {...shellVNode.props, boardProps: makeBoardProps()})
    }

    const {container, queryByTestId, getByText, fireEvent} = renderToDom(renderShell())

    assert.ok(queryByTestId('submit-correction-btn'), 'active checkpoint controls should render before skip')

    fireEvent.click(getByText('跳过 checkpoint'))
    await new Promise(resolve => setTimeout(resolve, 0))
    render(renderShell(), container)

    assert.strictEqual(repository.store.checkpoints.cp_1.status, 'skipped')
    assert.strictEqual(workbenchStore.getState().tabs[0].recallSubstate, 'normal')
    assert.strictEqual(runtimeStore.getState().activeCheckpointId, undefined)
    assert.strictEqual(queryByTestId('submit-correction-btn'), null,
      'checkpoint controls should disappear after active checkpoint is cleared')
    assertNoProtectedAttemptWrites(repository)
  })

  it('P5CP-T07: checkpoint command ownership and boundary remain isolated', function () {
    const containerSource = fs.readFileSync('src/components/TrainingWorkbenchContainer.js', 'utf8')
    const flowSource = fs.readFileSync('src/modules/training/workbench/workbenchFlowService.ts', 'utf8')
    const transitionSource = fs.readFileSync('src/modules/training/workbench/modeTransitions.ts', 'utf8')
    const tabTypeSource = fs.readFileSync('src/modules/training/types/tab.ts', 'utf8')
    const recallPanelSource = fs.readFileSync('src/components/workbench/panels/RecallModePanel.js', 'utf8')
    const checkpointPanelSource = fs.readFileSync('src/components/workbench/panels/RecallCheckpointPanel.js', 'utf8')

    assert.ok(
      !containerSource.includes('recallCheckpointService'),
      'Container must not look up or call recallCheckpointService for checkpoint commands',
    )
    assert.ok(
      !containerSource.includes('checkpointService'),
      'Container must not look up or call checkpointService for checkpoint commands',
    )

    for (const commandName of [
      'submitCheckpointCorrection',
      'revealCheckpointAi',
      'skipCheckpoint',
      'saveCheckpointComment',
    ]) {
      assert.ok(
        flowSource.includes(commandName),
        `workbenchFlowService must own checkpoint command ${commandName}`,
      )
    }

    for (const panelSource of [recallPanelSource, checkpointPanelSource]) {
      for (const forbidden of [
        'recallCheckpointService',
        'checkpointService',
        'runtimeStore',
        'workbenchStore',
        'repository',
        'sabaki',
      ]) {
        assert.ok(!panelSource.includes(forbidden),
          `presentational checkpoint panels must not depend on ${forbidden}`)
      }
    }

    assert.match(tabTypeSource, /WorkbenchMode = 'play' \| 'problem' \| 'recall' \| 'analysis'/)
    assert.ok(!tabTypeSource.includes("'checkpoint'"), 'checkpoint must not become a WorkbenchMode')

    for (const forbiddenImport of ['Service', 'Store', 'repository', 'db', 'engine']) {
      assert.ok(
        !transitionSource.includes(forbiddenImport),
        `modeTransitions.ts must remain pure and not import/use ${forbiddenImport}`,
      )
    }
  })
})
