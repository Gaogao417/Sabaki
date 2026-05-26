/**
 * Phase 5 Recall Checkpoint UI / Comment Mapping Tests
 *
 * Contract: docs/archive/daily-design/2026-05-25/phase5-checkpoint-ui-comment/test-contract-v0.2.md
 *
 * Harness manifest:
 * - Real production modules: TrainingWorkbenchContainer, WorkbenchShell,
 *   RecallModePanel, RecallCheckpointPanel, RecallRightPanel,
 *   createWorkbenchFlowService, createRecallCheckpointService,
 *   createWorkbenchStore, createTrainingRuntimeStore.
 * - Fake modules: strict in-memory repository bound to the TrainingRepository
 *   surface used by recall checkpoint projection and command services; tiny
 *   unused service stubs.
 * - Not mocked for full-loop coverage: workbenchFlowService,
 *   recallCheckpointService, runtimeStore, workbenchStore, rendered panels.
 */

import assert from 'assert'
import fs from 'fs'
import {h, render} from 'preact'

import TrainingWorkbenchContainer from '../../../src/components/TrainingWorkbenchContainer.js'
import WorkbenchShell from '../../../src/components/WorkbenchShell.js'
import RecallModePanel from '../../../src/components/workbench/panels/RecallModePanel.js'
import {createRecallCheckpointService} from '../../../src/modules/training/recall/recallCheckpointService.ts'
import {createTrainingRuntimeStore} from '../../../src/modules/training/store/trainingRuntimeStore.ts'
import {createWorkbenchStore} from '../../../src/modules/training/store/workbenchStore.ts'
import {createWorkbenchFlowService} from '../../../src/modules/training/workbench/workbenchFlowService.ts'
import {
  createNoopLegacyController,
  createSpyFlowService,
  createSpyRecallCheckpointService,
  createSpyReviewService,
  createSpyTabService,
  createSpyTaskImportService,
} from '../shared/workbenchSpyFactories.ts'
import {renderToDom} from '../preactTestHelper.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function tick() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

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
    id: 'tab_1',
    taskId: 'task_1',
    mode: 'recall',
    recallSubstate: 'checkpoint_ai_revealed',
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
    userAttempts: [{vertex: 'D4', isCorrect: true}],
    showHint: false,
    completed: false,
    ...overrides,
  }
}

function makeActiveCheckpoint(overrides = {}) {
  return {
    id: 'cp_1',
    moveNumber: 23,
    source: 'system',
    sourceLabel: '系统',
    severity: 'severe',
    severityLabel: 'severe bad move',
    summary: '第 23 手，先自己摆修正图',
    status: 'ai_revealed',
    statusLabel: 'AI candidates 已显示，写下你的判断',
    originalLine: ['Q16', 'D4'],
    userCorrectionLine: ['R17', 'D3'],
    aiCandidateLines: [
      {label: 'AI 1', moves: ['R17', 'D3'], source: 'engine'},
      {label: 'AI 2', moves: ['Q17', 'C4'], source: 'engine'},
    ],
    ...overrides,
  }
}

function createStrictCheckpointRepository(options = {}) {
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
        createdAt: '2026-05-26T00:00:00.000Z',
      },
    },
    checkpoints: {
      cp_1: {
        id: 'cp_1',
        recallSessionId: 'rs_1',
        badMoveId: 'bm_1',
        status: 'ai_revealed',
        userCorrectionLine: ['R17', 'D3'],
        aiCandidateLines: [
          {label: 'AI 1', moves: ['R17', 'D3'], source: 'engine'},
          {label: 'AI 2', moves: ['Q17', 'C4'], source: 'engine'},
        ],
        createdAt: '2026-05-26T00:00:00.000Z',
      },
    },
    badMoves: {
      bm_1: {
        id: 'bm_1',
        moveEvaluationId: 'eval_1',
        attemptId: 'attempt_1',
        taskId: 'task_1',
        moveIndex: 41,
        severity: 'severe',
        punishSide: 'black',
        createdAt: '2026-05-26T00:00:00.000Z',
      },
    },
    evaluations: [
      {
        id: 'eval_1',
        attemptId: 'attempt_1',
        moveIndex: 41,
        move: 'K10',
        engineSuggestedLine: ['M12', 'N13'],
        afterScoreLead: 4.2,
        afterWinrate: 0.64,
        status: 'evaluated',
        createdAt: '2026-05-26T00:00:00.000Z',
      },
    ],
    comments: [],
  }

  if (options.checkpointPatch) {
    store.checkpoints.cp_1 = {
      ...store.checkpoints.cp_1,
      ...clone(options.checkpointPatch),
    }
  }

  const calls = []
  const readCalls = []
  const protectedAttemptWrites = []
  const protectedAttemptFields = new Set(['userLine', 'result', 'status'])
  let releaseCreateMoveComment = null
  const createMoveCommentGate = options.holdCreateMoveComment
    ? new Promise(resolve => { releaseCreateMoveComment = resolve })
    : null

  return {
    store,
    calls,
    readCalls,
    protectedAttemptWrites,
    releaseCreateMoveComment,

    async loadTask(taskId) {
      readCalls.push(['loadTask', taskId])
      return {id: taskId, rootPositionSgf: '(;SZ[19])'}
    },
    async loadAttempt(attemptId) {
      readCalls.push(['loadAttempt', attemptId])
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
      readCalls.push(['loadRecallSession', sessionId])
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
      readCalls.push(['loadRecallCheckpoint', checkpointId])
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
      readCalls.push(['listCheckpointsByRecallSession', recallSessionId])
      return Object.values(store.checkpoints)
        .filter(checkpoint => checkpoint.recallSessionId === recallSessionId)
        .map(clone)
    },
    async loadBadMove(badMoveId) {
      readCalls.push(['loadBadMove', badMoveId])
      return clone(store.badMoves[badMoveId]) || null
    },
    async updateBadMove(badMoveId, patch) {
      calls.push(['updateBadMove', badMoveId, clone(patch)])
      store.badMoves[badMoveId] = {...store.badMoves[badMoveId], ...clone(patch)}
    },
    async listBadMovesByAttempt(attemptId) {
      readCalls.push(['listBadMovesByAttempt', attemptId])
      return Object.values(store.badMoves)
        .filter(badMove => badMove.attemptId === attemptId)
        .map(clone)
    },
    async listMoveEvaluationsByAttempt(attemptId) {
      readCalls.push(['listMoveEvaluationsByAttempt', attemptId])
      return store.evaluations
        .filter(evaluation => evaluation.attemptId === attemptId)
        .map(clone)
    },
    async createMoveComment(comment) {
      calls.push(['createMoveComment', clone(comment)])
      if (createMoveCommentGate) await createMoveCommentGate
      store.comments.push(clone(comment))
      return clone(comment)
    },
    async loadMoveComment(commentId) {
      readCalls.push(['loadMoveComment', commentId])
      return clone(store.comments.find(comment => comment.id === commentId)) || null
    },
    async transaction(fn) {
      return fn()
    },
    async listIncompleteAttempts() { return [] },
    async listIncompleteRecallSessions() { return [] },
  }
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

function createHarness(options = {}) {
  const workbenchStore = createWorkbenchStore()
  const runtimeStore = createTrainingRuntimeStore()
  const repository = createStrictCheckpointRepository(options.repository)
  const tab = makeTab(options.tab)

  workbenchStore.addTab(tab)
  workbenchStore.setActiveTab(tab.id)
  runtimeStore.setActiveCheckpoint('cp_1')
  runtimeStore.setRecallView(makeRecallView())

  const recallCheckpointService = createRecallCheckpointService({
    repository,
    runtimeStore,
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
    forbiddenCalls: [],
    state: {},
    getTrainingContext() { return trainingContext },
    getPlayServices() { return {documentStore: null} },
    stopEngineGameTraining: async () => {},
    makeResign() {},
    undo() {},
    redo() {},
    makeMove() { this.forbiddenCalls.push(['makeMove', Array.from(arguments)]) },
    openDrawer() {},
    setComment() { this.forbiddenCalls.push(['setComment', Array.from(arguments)]) },
    flashInfoOverlay() {},
    setState(patch) {
      this.forbiddenCalls.push(['setState', clone(patch)])
      this.state = {...this.state, ...patch}
    },
    toggleThirdPartyPanel() {},
  }

  const containerInstance = new TrainingWorkbenchContainer({sabaki})
  containerInstance.props = {sabaki}
  containerInstance.forceUpdate = () => {}

  function renderShellVNode() {
    const shellVNode = containerInstance.render()
    return h(shellVNode.type, {...shellVNode.props, boardProps: makeBoardProps()})
  }

  return {
    repository,
    runtimeStore,
    workbenchStore,
    flowService,
    sabaki,
    trainingContext,
    containerInstance,
    getShellProps() {
      return containerInstance.render().props
    },
    renderShellVNode,
  }
}

function createContainerDelegationHarness() {
  const workbenchStore = createWorkbenchStore()
  const runtimeStore = createTrainingRuntimeStore()
  const flowService = createSpyFlowService()
  const tabService = createSpyTabService()
  const recallCheckpointService = createSpyRecallCheckpointService()
  const taskImportService = createSpyTaskImportService()
  const reviewService = createSpyReviewService()
  const tab = makeTab({id: 'tab_delegate', recallSubstate: 'checkpoint_ai_revealed'})

  workbenchStore.addTab(tab)
  workbenchStore.setActiveTab(tab.id)
  runtimeStore.setActiveCheckpoint('cp_delegate')
  runtimeStore.setRecallView(makeRecallView())

  const repository = {
    async loadTask(taskId) { return {id: taskId, rootPositionSgf: ''} },
    async loadRecallCheckpoint() { return null },
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

  return {
    flowService,
    recallCheckpointService,
    getShellProps() {
      return containerInstance.render().props
    },
  }
}

function assertNoProtectedAttemptWrites(repository) {
  assert.deepStrictEqual(
    repository.protectedAttemptWrites,
    [],
    'visible checkpoint comment path must not write Attempt userLine/result/status',
  )
}

function assertNoForbiddenWrites(repository) {
  const writeCalls = repository.calls.filter(([name]) => [
    'createRecallCheckpoint',
    'updateRecallCheckpoint',
    'updateRecallSession',
    'createMoveComment',
    'updateAttempt',
    'updateBadMove',
    'createRecallSession',
    'createProblemAttempt',
    'saveProblemAttempt',
    'saveGame',
  ].includes(name))
  assert.deepStrictEqual(
    writeCalls.map(([name]) => name).sort(),
    ['createMoveComment', 'updateRecallCheckpoint', 'updateRecallCheckpoint', 'updateRecallSession'].sort(),
    'visible checkpoint comment path must only write MoveComment, RecallCheckpoint, and RecallSession',
  )
}

function assertNoForbiddenSabakiWrites(sabaki) {
  assert.deepStrictEqual(
    sabaki.forbiddenCalls,
    [],
    'checkpoint comment UI loop must not write SGF/game-tree/scratch through Sabaki globals',
  )
}

describe('Phase 5 checkpoint UI / comment mapping', function () {
  beforeEach(function () {
    installSabakiSettingGlobal()
  })

  it('P5S2-T01: checkpoint correction state renders current checkpoint without revealing AI', function () {
    const activeCheckpoint = makeActiveCheckpoint({
      status: 'pending_correction',
      statusLabel: '先自己摆修正图',
      userCorrectionLine: [],
      aiCandidateLines: [],
    })

    const {container, queryByTestId, getByText} = renderToDom(
      h(RecallModePanel, {
        recallOriginalLine: false,
        recallSubstate: 'checkpoint_correction',
        activeCheckpointId: activeCheckpoint.id,
        activeCheckpoint,
        canSubmitCorrection: true,
        canRevealAi: false,
        checkpoints: [activeCheckpoint],
      }),
    )

    assert.ok(container.textContent.includes('系统'), 'current checkpoint should show source')
    assert.ok(container.textContent.includes('23'), 'current checkpoint should show moveNumber')
    assert.ok(container.textContent.includes('先自己摆修正图'), 'current checkpoint should show correction status')
    assert.ok(!container.textContent.includes('AI 1'), 'AI candidates must stay hidden before reveal')
    assert.strictEqual(getByText('查看 AI').disabled, true, 'reveal should be disabled/weak before correction is submitted')
  })

  it('P5S2-T02: Container projects active checkpoint read model into Shell props', async function () {
    const harness = createHarness({
      tab: {recallSubstate: 'checkpoint_ai_revealed'},
    })

    harness.getShellProps()
    await tick()
    const shellProps = harness.getShellProps()

    assert.strictEqual(shellProps.mode, 'recall')
    assert.strictEqual(shellProps.recallOriginalLine, false)
    assert.strictEqual(shellProps.recallSubstate, 'checkpoint_ai_revealed')
    assert.strictEqual(shellProps.activeCheckpointId, 'cp_1')
    assert.ok(shellProps.activeCheckpoint, 'active checkpoint projection should be present')
    assert.strictEqual(shellProps.activeCheckpoint.id, 'cp_1')
    assert.strictEqual(shellProps.activeCheckpoint.moveNumber, 41)
    assert.strictEqual(shellProps.activeCheckpoint.severityLabel, 'severe')
    assert.deepStrictEqual(shellProps.activeCheckpoint.originalLine, ['K10'])
    assert.deepStrictEqual(shellProps.activeCheckpoint.userCorrectionLine, ['R17', 'D3'])
    assert.deepStrictEqual(shellProps.activeCheckpoint.aiCandidateLines.map(line => line.moves), [['R17', 'D3'], ['Q17', 'C4']])
    assert.strictEqual(shellProps.canEditCheckpointComment, true)
    assert.deepStrictEqual(harness.repository.calls, [], 'checkpoint projection must be read-only')
    assert.deepStrictEqual(
      harness.repository.readCalls.filter(([name]) => [
        'loadRecallCheckpoint',
        'loadBadMove',
        'listMoveEvaluationsByAttempt',
      ].includes(name)),
      [
        ['loadRecallCheckpoint', 'cp_1'],
        ['loadBadMove', 'bm_1'],
        ['listMoveEvaluationsByAttempt', 'attempt_1'],
      ],
      'checkpoint projection must read checkpoint, bad move, and move evaluation read model',
    )
  })

  it('P5S2-T03: revealed checkpoint renders comparison and visible comment editor in Recall UI', function () {
    const activeCheckpoint = makeActiveCheckpoint()

    const {container, queryByTestId} = renderToDom(
      h(WorkbenchShell, {
        mode: 'recall',
        boardProps: makeBoardProps(),
        recallOriginalLine: false,
        recallSubstate: 'checkpoint_ai_revealed',
        activeCheckpointId: activeCheckpoint.id,
        activeCheckpoint,
        canEditCheckpointComment: true,
      }),
    )

    assert.ok(container.textContent.includes('原线'), 'recall surface should show original line label')
    assert.ok(container.textContent.includes('Q16'), 'recall surface should show original line moves')
    assert.ok(container.textContent.includes('R17'), 'recall surface should show correction/AI moves')
    assert.ok(container.textContent.includes('AI 1'), 'recall surface should show AI candidate labels after reveal')
    assert.ok(queryByTestId('checkpoint-comment-input'), 'revealed checkpoint should show a comment editor')
    assert.ok(queryByTestId('save-checkpoint-comment-btn'), 'revealed checkpoint should show a save comment control')
  })

  it('P5S2-T04: visible comment save control sends trimmed content payload', function () {
    const calls = []
    const activeCheckpoint = makeActiveCheckpoint()
    const {getByTestId, fireEvent} = renderToDom(
      h(WorkbenchShell, {
        mode: 'recall',
        boardProps: makeBoardProps(),
        recallOriginalLine: false,
        recallSubstate: 'checkpoint_ai_revealed',
        activeCheckpointId: activeCheckpoint.id,
        activeCheckpoint,
        canEditCheckpointComment: true,
        onSaveCheckpointComment: payload => calls.push(payload),
      }),
    )

    fireEvent.input(getByTestId('checkpoint-comment-input'), '  Better shape at R17.  ')
    fireEvent.click(getByTestId('save-checkpoint-comment-btn'))

    assert.deepStrictEqual(calls, [{content: 'Better shape at R17.'}])
  })

  it('P5S2-T05: Container save callback delegates once to typed flowService spy', async function () {
    const harness = createContainerDelegationHarness()
    const shellProps = harness.getShellProps()

    assert.strictEqual(typeof shellProps.onSaveCheckpointComment, 'function')

    await shellProps.onSaveCheckpointComment({content: 'Good variation'})

    assert.deepStrictEqual(harness.flowService.calls.saveCheckpointComment, [{
      tabId: 'tab_delegate',
      content: 'Good variation',
    }])
    assert.strictEqual(harness.recallCheckpointService.calls.saveComment.length, 0)
    assert.strictEqual(harness.recallCheckpointService.calls.resumeRecall.length, 0)
  })

  it('P5S2-T06a: visible submit correction reloads checkpoint projection and enables reveal', async function () {
    const harness = createHarness({
      tab: {recallSubstate: 'checkpoint_correction'},
      repository: {
        checkpointPatch: {
          status: 'pending_correction',
          userCorrectionLine: [],
          aiCandidateLines: [],
        },
      },
    })
    harness.runtimeStore.setCorrectionDraft({checkpointId: 'cp_1', moves: ['R17', 'D3']})
    harness.getShellProps()
    await tick()
    const {container, getByText, fireEvent} = renderToDom(harness.renderShellVNode())

    assert.strictEqual(getByText('查看 AI').disabled, true, 'reveal starts disabled before correction submit')

    fireEvent.click(getByText('提交修正图'))
    await tick()
    render(harness.renderShellVNode(), container)
    await tick()
    await tick()
    render(harness.renderShellVNode(), container)

    assert.deepStrictEqual(harness.repository.store.checkpoints.cp_1.userCorrectionLine, ['R17', 'D3'])
    assert.strictEqual(
      getByText('查看 AI').disabled,
      false,
      'reveal should become enabled after submit correction reloads checkpoint read model',
    )
  })

  it('P5S2-T06/T07: visible save uses real flow/service/store loop and returns to normal Recall UI', async function () {
    const harness = createHarness({
      tab: {recallSubstate: 'checkpoint_ai_revealed'},
      repository: {holdCreateMoveComment: true},
    })

    harness.getShellProps()
    await tick()
    const {container, getByTestId, queryByTestId, fireEvent} = renderToDom(harness.renderShellVNode())

    fireEvent.input(getByTestId('checkpoint-comment-input'), '  Better shape at R17.  ')
    fireEvent.click(getByTestId('save-checkpoint-comment-btn'))
    await tick()
    await tick()
    render(harness.renderShellVNode(), container)

    assert.strictEqual(
      harness.workbenchStore.getState().tabs[0].recallSubstate,
      'checkpoint_commenting',
      'visible save should pass through checkpoint_commenting while the repository save is in flight',
    )
    assert.ok(container.textContent.includes('保存中'), 'UI should expose a saving/commenting state')
    assert.strictEqual(getByTestId('save-checkpoint-comment-btn').disabled, true)
    fireEvent.click(getByTestId('save-checkpoint-comment-btn'))
    await tick()
    assert.strictEqual(
      harness.repository.calls.filter(([name]) => name === 'createMoveComment').length,
      1,
      'saving state must prevent duplicate comment writes',
    )

    harness.repository.releaseCreateMoveComment()
    await tick()
    await tick()
    render(harness.renderShellVNode(), container)

    assert.strictEqual(harness.repository.store.comments.length, 1)
    assert.deepStrictEqual(harness.repository.store.comments[0].target, {kind: 'checkpoint', checkpointId: 'cp_1'})
    assert.strictEqual(harness.repository.store.comments[0].content, 'Better shape at R17.')
    assert.strictEqual(harness.repository.store.checkpoints.cp_1.status, 'commented')
    assert.strictEqual(harness.repository.store.recallSessions.rs_1.currentMoveIndex, 2)
    assert.strictEqual(harness.runtimeStore.getState().activeCheckpointId, undefined)
    assert.strictEqual(harness.workbenchStore.getState().tabs[0].mode, 'recall')
    assert.strictEqual(harness.workbenchStore.getState().tabs[0].recallSubstate, 'normal')
    assert.strictEqual(queryByTestId('checkpoint-comment-input'), null, 'checkpoint editor should hide after resume')
    assertNoProtectedAttemptWrites(harness.repository)
    assertNoForbiddenWrites(harness.repository)
    assertNoForbiddenSabakiWrites(harness.sabaki)
  })

  it('P5S2-T08: checkpoint UI boundary remains presentational and recall-owned', function () {
    const panelPaths = [
      'src/components/workbench/panels/RecallModePanel.js',
      'src/components/workbench/panels/RecallCheckpointPanel.js',
      'src/components/workbench/panels/RecallRightPanel.js',
    ]

    for (const panelPath of panelPaths) {
      const source = fs.readFileSync(panelPath, 'utf8')
      const importLines = source.split('\n').filter(line => /^\s*import\s/.test(line))
      for (const forbidden of ['Service', 'Store', 'repository', 'sabaki', 'window']) {
        assert.ok(
          importLines.every(line => !line.includes(forbidden)),
          `${panelPath} must not import ${forbidden}`,
        )
      }
      assert.ok(!source.includes('window.sabaki'), `${panelPath} must not read hidden sabaki global`)
    }

    const containerSource = fs.readFileSync('src/components/TrainingWorkbenchContainer.js', 'utf8')
    const saveHandlerMatch = containerSource.match(/async function handleSaveCheckpointComment\([^]*?\n    \}/)
    assert.ok(saveHandlerMatch, 'Container save checkpoint comment handler should exist')
    assert.ok(saveHandlerMatch[0].includes('flowService.saveCheckpointComment'))
    for (const forbidden of ['repository.', 'runtimeStore.', 'workbenchStore.', 'window.sabaki', 'snapshotService']) {
      assert.ok(!saveHandlerMatch[0].includes(forbidden), `save handler must not use ${forbidden}`)
    }

    const rightModeSource = fs.readFileSync('src/components/workbench/shell/RightModePanel.js', 'utf8')
    const shellSource = fs.readFileSync('src/components/WorkbenchShell.js', 'utf8')
    for (const forbidden of ['openGameTab', 'openProblemTab', 'openSnapshotProblemTab']) {
      assert.ok(!shellSource.includes(forbidden), `WorkbenchShell checkpoint UI must not depend on ${forbidden}`)
    }

    const recallBranch = rightModeSource.match(/case 'recall':[^\n]*\n([^]*?)\n\s*break/)
    assert.ok(recallBranch, 'RightModePanel recall branch should exist')
    assert.ok(!recallBranch[1].includes('AnalysisRightPanel'), 'Recall checkpoint comment UI must not be wired through AnalysisRightPanel')
  })
})
