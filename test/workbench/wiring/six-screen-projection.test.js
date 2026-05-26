/**
 * Six-screen Workbench projection anti-fake-green tests.
 *
 * Contract:
 * docs/archive/daily-design/2026-05-26/workbench-six-screen-projection/test-contract-v0.1.md
 *
 * Harness manifest:
 * - Real production modules: TrainingWorkbenchContainer, WorkbenchShell render
 *   path, workbenchStore, trainingRuntimeStore, and production panels reached
 *   through the shell.
 * - Controlled fakes: in-memory repository/dashboard/sync source objects and
 *   tiny Sabaki/service shells. They provide source facts only; they do not
 *   construct final panel props.
 * - Forbidden in this suite: rendering Problem/Recall/Analysis panels directly
 *   with final props, callback-only assertions, data-testid existence-only
 *   assertions, or using window.sabaki.db as the library source path.
 */

import assert from 'assert'
import fs from 'fs'
import path from 'path'
import {fileURLToPath} from 'url'
import {h} from 'preact'

import TrainingWorkbenchContainer from '../../../src/components/TrainingWorkbenchContainer.js'
import {createTrainingRuntimeStore} from '../../../src/modules/training/store/trainingRuntimeStore.ts'
import {createWorkbenchStore} from '../../../src/modules/training/store/workbenchStore.ts'
import {renderToDom} from '../preactTestHelper.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '../../..')
const TEST_PATH = 'test/workbench/wiring/six-screen-projection.test.js'

const now = '2026-05-26T09:13:00.000Z'

const SENTINELS = {
  problemPrompt: 'S6P task prompt ko-shape-742',
  problemGoal: 'S6P goal: punish the cutting point at N17',
  problemPassRule: 'S6P pass rule max drop 2.25 and no severe bad moves',
  problemSide: 'S6P side to move: white',
  problemArea: 'S6P upper-right problem area clamp',
  problemReference: 'S6P ref ladder line A count 7',
  problemScoreLead: 'S6P score lead -4.25',
  problemScoreDrop: '-8.75 from S6P eval',
  problemHint: 'S6P hint used 2 of 9',
  problemAttemptPath: 'S6P attempt path K16 L17 M18',
  problemBadMove: 'S6P severe bad move at M18',
  recallProgress: '6 / 17',
  recallStatus: 'S6P recall status: white to answer after ko threat',
  recallErrors: '4',
  checkpointMove: 'Q16-S6P',
  checkpointSeverity: 'S6P checkpoint severity catastrophic',
  checkpointScoreDrop: '-12.4',
  checkpointCorrection: 'S6P correction Q16 R16 S16 T16',
  checkpointCandidate: 'S6P AI candidate H17 ladder rescue',
  checkpointComment: 'S6P comment: original ignored outside liberty',
  analysisContext: 'S6P analysis from checkpoint chk_s6p_1',
  analysisTree: 'S6P branch tesuji H17 current',
  analysisIssue: 'S6P issue: severe throw-in at Q16',
  analysisReference: 'S6P reference line Q16 R16 S16',
  analysisCorrection: 'S6P correction line H17 H18 J18',
  analysisEngine: 'S6P Engine loading candidate H17',
  analysisEvaluation: 'S6P eval current -3.75 ref +1.50',
  libraryHistory: 'S6P history recent game ko-shape review',
  libraryKifu: 'S6P local kifu imported joseki bundle',
  libraryRecord: 'S6P game record unfinished recall session',
  libraryFox: 'S6P Fox imported game 2026-05-26',
  library101: 'S6P 101 wrong problem ladder',
  libraryLoading: 'S6P sync loading Fox page 2',
  libraryEmpty: 'S6P 101 empty after successful sync',
  libraryError: 'S6P Fox sync auth expired',
  librarySyncing: 'S6P 101 syncing 14 of 32',
}

function makeTab(overrides = {}) {
  return {
    id: 'tab_s6p',
    taskId: 'task_s6p',
    mode: 'problem',
    activeAttemptId: 'attempt_s6p',
    activeRecallSessionId: undefined,
    childTabIds: [],
    parentTabId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeEvaluation(overrides = {}) {
  return {
    id: 'eval_s6p',
    attemptId: 'attempt_s6p',
    moveIndex: 2,
    move: 'M18',
    beforeScoreLead: 4.5,
    afterScoreLead: -4.25,
    scoreDrop: -8.75,
    engineSuggestedMove: 'N17',
    engineSuggestedLine: ['N17', 'O17', 'P17'],
    status: 'evaluated',
    createdAt: now,
    evaluatedAt: now,
    ...overrides,
  }
}

function createRepository(overrides = {}) {
  const task = {
    id: 'task_s6p',
    title: 'S6P problem title from repository',
    type: 'local_fight',
    positionSgf: '(;SZ[19];B[pd])',
    sideToMove: 'white',
    sideToMoveLabel: SENTINELS.problemSide,
    positionDescription: SENTINELS.problemPrompt,
    taskGoal: SENTINELS.problemGoal,
    problemArea: SENTINELS.problemArea,
    passRule: {
      requireNoSevereBadMove: true,
      maxBadMoveCount: 0,
      scoreDropThreshold: 2.25,
      targetDescription: SENTINELS.problemPassRule,
      compareWithReference: true,
    },
    referenceLines: [
      {
        id: 'ref_s6p_a',
        label: SENTINELS.problemReference,
        moves: ['N17', 'O17', 'P17', 'Q17', 'R17', 'S17', 'T17'],
      },
    ],
    tags: ['s6p'],
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  const badMove = {
    id: 'bad_s6p_1',
    moveEvaluationId: 'eval_s6p',
    attemptId: 'attempt_s6p',
    taskId: 'task_s6p',
    moveIndex: 2,
    severity: 'severe',
    severityLabel: SENTINELS.problemBadMove,
    punishSide: 'white',
    createdAt: now,
  }
  const checkpoint = {
    id: 'chk_s6p_1',
    badMoveId: badMove.id,
    moveNumber: 64,
    source: 'system',
    sourceLabel: 'S6P system checkpoint',
    severity: SENTINELS.checkpointSeverity,
    severityLabel: SENTINELS.checkpointSeverity,
    status: 'ai_revealed',
    originalLine: [SENTINELS.checkpointMove, 'R16-S6P'],
    userCorrectionLine: SENTINELS.checkpointCorrection.split(' ').slice(2),
    aiCandidateLines: [
      {label: SENTINELS.checkpointCandidate, moves: ['H17', 'H18', 'J18']},
    ],
    userCommentId: 'comment_s6p_1',
    summary: 'S6P checkpoint summary move 64',
  }
  const comment = {
    id: 'comment_s6p_1',
    checkpointId: checkpoint.id,
    content: SENTINELS.checkpointComment,
    createdAt: now,
    updatedAt: now,
  }
  const evaluation = makeEvaluation()
  const checkpointEvaluation = makeEvaluation({
    id: 'eval_checkpoint_s6p',
    attemptId: badMove.attemptId,
    moveIndex: badMove.moveIndex,
    move: SENTINELS.checkpointMove,
    beforeScoreLead: 8.65,
    afterScoreLead: -3.75,
    scoreDrop: -12.4,
    scoreDropLabel: SENTINELS.checkpointScoreDrop,
  })
  badMove.moveEvaluationId = checkpointEvaluation.id

  return {
    async loadTask(taskId) {
      return taskId === task.id ? task : null
    },
    async loadBadMove(id) {
      return id === badMove.id ? badMove : null
    },
    async listMoveEvaluationsByAttempt(attemptId) {
      return attemptId === evaluation.attemptId
        ? [evaluation, checkpointEvaluation]
        : []
    },
    async loadRecallCheckpoint(id) {
      return id === checkpoint.id ? checkpoint : null
    },
    async loadMoveComment(id) {
      return id === comment.id ? comment : null
    },
    async loadDashboardProjection() {
      return {
        history: [{id: 'hist_s6p', title: SENTINELS.libraryHistory}],
        kifu: [{id: 'kifu_s6p', title: SENTINELS.libraryKifu}],
        gameRecords: [{id: 'record_s6p', title: SENTINELS.libraryRecord}],
      }
    },
    ...overrides,
  }
}

function createNoopFlowService(overrides = {}) {
  return {
    async submit() {},
    enterAnalysis() {},
    returnFromAnalysis() {},
    completeRecall() {},
    async snapshotFromCurrentContext() {},
    restartAttempt() {},
    updatePlayerConfig() {},
    async submitCheckpointCorrection() {},
    async revealCheckpointAi() {},
    async skipCheckpoint() {},
    async saveCheckpointComment() {},
    async loadDashboardData() {
      return {
        inboxTasks: [{id: 'task_101_s6p', title: SENTINELS.library101}],
        incompleteAttempts: [],
        incompleteRecallSessions: [],
        recentBadMoveTasks: [],
        libraryProjection: {
          history: [{id: 'hist_s6p', title: SENTINELS.libraryHistory}],
          kifu: [{id: 'kifu_s6p', title: SENTINELS.libraryKifu}],
          gameRecords: [{id: 'record_s6p', title: SENTINELS.libraryRecord}],
          oneOhOne: {
            status: 'syncing',
            message: SENTINELS.librarySyncing,
            rows: [{id: '101_s6p', title: SENTINELS.library101}],
          },
          fox: {
            status: 'error',
            message: SENTINELS.libraryError,
            rows: [{id: 'fox_s6p', title: SENTINELS.libraryFox}],
          },
        },
      }
    },
    ...overrides,
  }
}

function createSabaki(context, overrides = {}) {
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
    getTrainingServices() {
      return {}
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
    startProblem: async () => {},
    stopEngineGameTraining: async () => {},
    ...overrides,
  }
}

function installSabakiGlobal() {
  globalThis.window.sabaki = {
    setting: {
      get(key) {
        if (key === 'view.show_coordinates') return true
        if (key === 'view.show_next_moves') return false
        if (key === 'view.show_siblings') return false
        if (key === 'view.fuzzy_stone_placement') return false
        if (key === 'view.animate_stone_placement') return false
        if (key === 'app.zoom_factor') return 1
        return false
      },
      set() {},
    },
    db: {
      async getDashboardSummary() {
        throw new Error('six-screen tests must not depend on window.sabaki.db')
      },
      async getProblemsByStatus() {
        throw new Error('six-screen tests must not depend on window.sabaki.db')
      },
      async getRecentGames() {
        throw new Error('six-screen tests must not depend on window.sabaki.db')
      },
    },
  }
}

function createHarness({
  tab = makeTab(),
  repository = createRepository(),
  runtimeSeed = () => {},
  sabakiProps = {},
  contextOverrides = {},
  containerProps = {},
} = {}) {
  installSabakiGlobal()

  const workbenchStore = createWorkbenchStore()
  const runtimeStore = createTrainingRuntimeStore()
  workbenchStore.addTab(tab)
  workbenchStore.setActiveTab(tab.id)
  runtimeSeed(runtimeStore)

  const flowService = createNoopFlowService()
  const tabService = {
    calls: {openTask: [], switchTab: [], closeTab: []},
    async openTask(input) {
      this.calls.openTask.push(input)
      return makeTab({id: 'tab_opened_s6p', taskId: input.taskId, mode: input.mode || 'problem'})
    },
    switchTab(tabId) {
      this.calls.switchTab.push({tabId})
    },
    async closeTab(tabId) {
      this.calls.closeTab.push({tabId})
    },
    async openAttemptTab() {},
    async openRecallSessionTab() {},
  }
  const context = {
    runtimeStore,
    workbenchStore,
    repository,
    flowService,
    workbenchFlowService: flowService,
    tabService,
    workbenchTabService: tabService,
    taskImportService: {
      async createManualTask() {
        return {id: 'task_manual_s6p'}
      },
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
      async advanceReview() {},
      async updateScheduleAfterResult() {},
      async openDueItem() {},
    },
    analysisProjection: {
      status: SENTINELS.analysisEngine,
      candidates: [{label: SENTINELS.analysisEngine, moves: ['H17']}],
      evaluation: SENTINELS.analysisEvaluation,
    },
    libraryProjection: {
      history: [{id: 'hist_s6p', title: SENTINELS.libraryHistory}],
      kifu: [{id: 'kifu_s6p', title: SENTINELS.libraryKifu}],
      gameRecords: [{id: 'record_s6p', title: SENTINELS.libraryRecord}],
      fox: {
        status: 'loading',
        message: SENTINELS.libraryLoading,
        rows: [{id: 'fox_s6p', title: SENTINELS.libraryFox}],
      },
      oneOhOne: {
        status: 'syncing',
        message: SENTINELS.librarySyncing,
        rows: [{id: '101_s6p', title: SENTINELS.library101}],
      },
      emptyStates: [SENTINELS.libraryEmpty],
      errors: [SENTINELS.libraryError],
    },
    ...contextOverrides,
  }
  const sabaki = createSabaki(context, sabakiProps)
  const container = new TrainingWorkbenchContainer({sabaki, ...containerProps})

  return {
    container,
    context,
    flowService,
    repository,
    runtimeStore,
    sabaki,
    tabService,
    workbenchStore,
    async renderText() {
      await flushPromises()
      const {container: dom} = renderToDom(container.render())
      await flushPromises()
      return normalizeText(dom.textContent)
    },
    getShellProps() {
      return container.render().props
    },
  }
}

function seedProblemRuntime(runtimeStore) {
  runtimeStore.setActiveAttempt('attempt_s6p')
  runtimeStore.upsertPendingMoveEvaluation(makeEvaluation({
    id: 'eval_s6p_pending',
    status: 'pending',
  }))
  runtimeStore.setVisibleBadMoveIds(['bad_s6p_1'])
  runtimeStore.setProblemView({
    taskId: 'task_s6p',
    tabId: 'tab_s6p',
    attemptId: 'attempt_s6p',
    problemId: 'problem_s6p',
    legacyProblemSession: {
      hint: SENTINELS.problemHint,
      hintUsageLabel: SENTINELS.problemHint,
      passRuleSummary: SENTINELS.problemPassRule,
      scoreLeadLabel: SENTINELS.problemScoreLead,
      scoreDropLabel: SENTINELS.problemScoreDrop,
      attemptPathLabel: SENTINELS.problemAttemptPath,
    },
    evalCache: [
      makeEvaluation({id: 'eval_s6p_1', moveIndex: 0, move: 'K16'}),
      makeEvaluation({id: 'eval_s6p_2', moveIndex: 1, move: 'L17'}),
      makeEvaluation({
        id: 'eval_s6p_3',
        moveIndex: 2,
        move: 'M18',
        scoreLeadLabel: SENTINELS.problemScoreLead,
        scoreDropLabel: SENTINELS.problemScoreDrop,
        attemptPathLabel: SENTINELS.problemAttemptPath,
      }),
    ],
    badMoves: [
      {
        moveIndex: 2,
        move: 'M18',
        severity: 'severe',
        scoreDrop: -8.75,
        label: SENTINELS.problemBadMove,
      },
    ],
    submitted: false,
    result: null,
  })
}

function seedRecallRuntime(runtimeStore) {
  runtimeStore.setActiveRecallSession('recall_s6p')
  runtimeStore.setRecallView({
    recallSessionId: 'recall_s6p',
    taskId: 'task_s6p',
    tabId: 'tab_recall_s6p',
    moveIndex: 6,
    expectedMoves: Array.from({length: 17}, (_, index) => ({
      sign: index % 2 === 0 ? 1 : -1,
      vertex: `S6P-${index + 1}`,
    })),
    userAttempts: [
      {vertex: 'D4', isCorrect: true},
      {vertex: 'Q16', isCorrect: false},
      {vertex: 'C3', isCorrect: true},
      {vertex: 'R17', isCorrect: false},
      {vertex: 'K10', isCorrect: false},
      {vertex: 'H17', isCorrect: false},
    ],
    showHint: true,
    completed: false,
    status: SENTINELS.recallStatus,
  })
}

function seedCheckpointRuntime(runtimeStore) {
  seedRecallRuntime(runtimeStore)
  runtimeStore.setActiveCheckpoint('chk_s6p_1')
  runtimeStore.setCorrectionDraft({
    checkpointId: 'chk_s6p_1',
    moves: ['Q16', 'R16', 'S16', 'T16'],
  })
}

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function assertTextIncludes(text, value, message) {
  assert.ok(
    text.includes(value),
    `${message}\nExpected visible text to include: ${value}\nActual text: ${text}`,
  )
}

function assertTextExcludes(text, value, message) {
  assert.ok(
    !text.includes(value),
    `${message}\nExpected visible text to exclude: ${value}\nActual text: ${text}`,
  )
}

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n\r]*/g, '')
}

describe('Workbench six-screen projection anti-fake-green', function () {
  it('S6P-T01: projects problem prompt, goal, pass rule, side, area, and references from repository task data', async function () {
    const harness = createHarness({
      tab: makeTab({mode: 'problem'}),
      runtimeSeed: seedProblemRuntime,
    })

    const text = await harness.renderText()

    assertTextIncludes(text, SENTINELS.problemPrompt,
      'Problem prompt must come from repository task.positionDescription')
    assertTextIncludes(text, SENTINELS.problemGoal,
      'Problem goal must come from repository task.taskGoal')
    assertTextIncludes(text, SENTINELS.problemPassRule,
      'Problem pass-rule summary must come from repository task.passRule')
    assertTextIncludes(text, SENTINELS.problemSide,
      'Problem side-to-move must come from repository task.sideToMove')
    assertTextIncludes(text, SENTINELS.problemArea,
      'Problem area status must come from repository task.problemArea')
    assertTextIncludes(text, SENTINELS.problemReference,
      'Problem references must come from repository task.referenceLines')
    assertTextExcludes(text, '局部战斗中的局面',
      'Sourced problem state must not render the static prompt fallback')
    assertTextExcludes(text, '已收录 3 条参考线',
      'Sourced problem state must not render static reference summary')
  })

  it('S6P-T02: projects problem runtime eval, hint, attempt path, and bad moves from runtime/repository data', async function () {
    const harness = createHarness({
      tab: makeTab({mode: 'problem'}),
      runtimeSeed: seedProblemRuntime,
    })

    const text = await harness.renderText()

    assertTextIncludes(text, SENTINELS.problemScoreLead,
      'Problem score lead must come from MoveEvaluation/runtime projection')
    assertTextIncludes(text, SENTINELS.problemScoreDrop,
      'Problem score drop must come from MoveEvaluation/runtime projection')
    assertTextIncludes(text, SENTINELS.problemHint,
      'Problem hint usage must come from runtime problemView/session')
    assertTextIncludes(text, SENTINELS.problemAttemptPath,
      'Problem attempt path must come from problemView eval/user line data')
    assertTextIncludes(text, SENTINELS.problemBadMove,
      'Problem bad move severity/count must come from visible bad moves')
    assertTextExcludes(text, '3.6',
      'Sourced problem eval must not render hardcoded lead')
    assertTextExcludes(text, '0.0 目',
      'Sourced problem eval must not render hardcoded recent drop')
    assertTextExcludes(text, '1/5',
      'Sourced problem hint must not render hardcoded usage')
    assertTextExcludes(text, '思考中',
      'Sourced problem path must not render fixed sample path rows')
  })

  it('S6P-T03: projects recall progress, current move, errors, status, and checkpoint summary from active recallView', async function () {
    const harness = createHarness({
      tab: makeTab({
        id: 'tab_recall_s6p',
        mode: 'recall',
        activeRecallSessionId: 'recall_s6p',
      }),
      runtimeSeed: seedRecallRuntime,
    })

    const text = await harness.renderText()

    assertTextIncludes(text, SENTINELS.recallProgress,
      'Recall current/total progress must come from active recallView')
    assertTextIncludes(text, SENTINELS.recallErrors,
      'Recall wrong count must come from active recallView.userAttempts')
    assertTextIncludes(text, SENTINELS.recallStatus,
      'Recall status/current side must come from active recallView projection')
    assertTextExcludes(text, '23 / 180',
      'Sourced recall state must not render hardcoded progress')
    assertTextExcludes(text, '22',
      'Sourced recall state must not render hardcoded correct count')
    assertTextExcludes(text, '黑方落子',
      'Sourced recall state must not render hardcoded current side')
    assertTextExcludes(text, '第 18 手',
      'Sourced recall errors must not render the fixed sample error row')
  })

  it('S6P-T04: projects checkpoint fields from active checkpoint, bad move, evaluation, correction draft, AI candidates, and comment', async function () {
    const harness = createHarness({
      tab: makeTab({
        id: 'tab_recall_s6p',
        mode: 'recall',
        activeRecallSessionId: 'recall_s6p',
        recallSubstate: 'checkpoint_ai_revealed',
      }),
      runtimeSeed: seedCheckpointRuntime,
    })

    harness.getShellProps()
    await flushPromises()
    const text = await harness.renderText()

    assertTextIncludes(text, SENTINELS.checkpointMove,
      'Checkpoint original move must come from activeCheckpoint/MoveEvaluation data')
    assertTextIncludes(text, SENTINELS.checkpointScoreDrop,
      'Checkpoint score drop must come from the joined MoveEvaluation/BadMove')
    assertTextIncludes(text, SENTINELS.checkpointSeverity,
      'Checkpoint severity must come from the active checkpoint/BadMove')
    assertTextIncludes(text, SENTINELS.checkpointCorrection,
      'Correction draft must come from runtimeStore.correctionDraft')
    assertTextIncludes(text, SENTINELS.checkpointCandidate,
      'AI candidates must come from checkpoint/analysis projection')
    assertTextIncludes(text, SENTINELS.checkpointComment,
      'Checkpoint comment state/content must come from repository comment data')
    assertTextExcludes(text, 'R10',
      'Sourced checkpoint state must not render hardcoded original move')
    assertTextExcludes(text, '-11.2',
      'Sourced checkpoint state must not render hardcoded score drop')
    assertTextExcludes(text, '已摆 3 手',
      'Sourced checkpoint correction must not render fixed draft length')
  })

  it('S6P-T05: projects analysis tree, issues, reference/correction, AI candidates, and evaluation from analysis context/runtime', async function () {
    const harness = createHarness({
      tab: makeTab({
        mode: 'analysis',
        analysisContext: {
          taskId: 'task_s6p',
          source: SENTINELS.analysisContext,
          attemptId: 'attempt_s6p',
          checkpointId: 'chk_s6p_1',
          positionHash: 'hash_s6p',
        },
      }),
      runtimeSeed(runtimeStore) {
        runtimeStore.setVisibleBadMoveIds(['bad_s6p_1'])
        runtimeStore.upsertPendingMoveEvaluation(makeEvaluation({
          id: 'eval_analysis_s6p',
          status: 'evaluated',
          engineSuggestedLine: ['H17', 'H18', 'J18'],
        }))
      },
      contextOverrides: {
        analysisProjection: {
          contextLabel: SENTINELS.analysisContext,
          treeRows: [{label: SENTINELS.analysisTree}],
          issues: [{label: SENTINELS.analysisIssue}],
          referenceLine: SENTINELS.analysisReference,
          correctionLine: SENTINELS.analysisCorrection,
          engineStatus: SENTINELS.analysisEngine,
          evaluation: SENTINELS.analysisEvaluation,
        },
      },
      containerProps: {
        analysisProjection: {
          contextLabel: SENTINELS.analysisContext,
          treeRows: [{label: SENTINELS.analysisTree}],
          issues: [{label: SENTINELS.analysisIssue}],
          referenceLine: SENTINELS.analysisReference,
          correctionLine: SENTINELS.analysisCorrection,
          engineStatus: SENTINELS.analysisEngine,
          candidates: [{label: SENTINELS.analysisEngine, moves: ['H17']}],
          evaluation: SENTINELS.analysisEvaluation,
        },
      },
    })

    const text = await harness.renderText()

    assertTextIncludes(text, SENTINELS.analysisContext,
      'Analysis source context must come from activeTab.analysisContext')
    assertTextIncludes(text, SENTINELS.analysisTree,
      'Analysis tree rows must come from runtime exploration branch projection')
    assertTextIncludes(text, SENTINELS.analysisIssue,
      'Analysis issue list must come from bad-move/evaluation repository data')
    assertTextIncludes(text, SENTINELS.analysisReference,
      'Analysis reference line must come from analysis source projection')
    assertTextIncludes(text, SENTINELS.analysisCorrection,
      'Analysis correction line must come from checkpoint/correction projection')
    assertTextIncludes(text, SENTINELS.analysisEngine,
      'Analysis AI candidate/status must come from overlay/engine projection')
    assertTextIncludes(text, SENTINELS.analysisEvaluation,
      'Analysis evaluation must come from analysis projection')
    assertTextExcludes(text, '黑 R10',
      'Sourced analysis tree must not render fixed variation rows')
    assertTextExcludes(text, 'Leela Zero (v0.19)',
      'Sourced analysis AI status must not render fixed engine label')
    assertTextExcludes(text, '来自 Recall 修正',
      'Sourced analysis note must not render fixed note tag')
    assertTextExcludes(text, '更新于 10-24',
      'Sourced analysis note must not render fixed date')
  })

  it('S6P-T06: projects library history, kifu, records, 101/Fox rows, and sync states from source props without library mode', async function () {
    const gameTrees = [{
      root: {id: 'root_s6p', data: {GN: [SENTINELS.libraryHistory], PB: ['S6P Black'], PW: ['S6P White'], DT: ['2026-05-26']}},
      get(id) {
        return id === 'root_s6p' ? this.root : null
      },
      getHeight() {
        return 19
      },
    }]
    const harness = createHarness({
      tab: makeTab({mode: 'analysis'}),
      containerProps: {
        gameTrees,
        gameIndex: 0,
        libraryProjection: {
          history: [{id: 'hist_s6p', title: SENTINELS.libraryHistory}],
          kifu: [{id: 'kifu_s6p', title: SENTINELS.libraryKifu}],
          gameRecords: [{id: 'record_s6p', title: SENTINELS.libraryRecord}],
          fox: {
            status: 'error',
            message: SENTINELS.libraryError,
            rows: [{id: 'fox_s6p', title: SENTINELS.libraryFox}],
          },
          oneOhOne: {
            status: 'syncing',
            message: SENTINELS.librarySyncing,
            rows: [{id: '101_s6p', title: SENTINELS.library101}],
          },
          loading: SENTINELS.libraryLoading,
          empty: SENTINELS.libraryEmpty,
        },
      },
    })

    harness.container.state.libraryDrawerType = 'history'
    let text = await harness.renderText()
    assert.strictEqual(harness.getShellProps().mode, 'analysis',
      'Library must remain a surface/drawer, not a fifth Workbench mode')
    assertTextIncludes(text, SENTINELS.libraryHistory,
      'Library history must come from repository/container projection')
    assertTextExcludes(text, '黑方 vs 白方 #1',
      'Sourced library history must not render fixed sample history rows')

    harness.container.state.libraryDrawerType = 'kifu'
    text = await harness.renderText()
    assertTextIncludes(text, SENTINELS.libraryKifu,
      'Library kifu tab must come from repository/container projection')
    assertTextIncludes(text, SENTINELS.libraryLoading,
      'Library loading affordance must come from explicit sync/source state')

    harness.container.state.libraryDrawerType = 'game-records'
    text = await harness.renderText()
    assertTextIncludes(text, SENTINELS.libraryRecord,
      'Library game-records tab must come from repository/container projection')

    harness.container.state.libraryDrawerType = 'problems'
    text = await harness.renderText()
    assertTextIncludes(text, SENTINELS.library101,
      '101 wrong-problem rows must come from sync/repository projection')
    assertTextIncludes(text, SENTINELS.libraryFox,
      'Fox game rows must come from sync/repository projection')
    assertTextIncludes(text, SENTINELS.librarySyncing,
      'Syncing affordance must come from explicit sync source state')
    assertTextIncludes(text, SENTINELS.libraryError,
      'Error affordance must come from explicit sync source state')
    assertTextIncludes(text, SENTINELS.libraryEmpty,
      'Empty affordance must come from explicit empty source state')
    assertTextExcludes(text, '暂无错题',
      'Sourced 101/problem library state must not render static empty copy')
  })

  it('S6P-T07: keeps presentational projection files free of service/store/repository/window source reads', function () {
    const guardedFiles = [
      'src/components/workbench/panels/ProblemModePanel.js',
      'src/components/workbench/panels/ProblemRightPanel.js',
      'src/components/workbench/panels/RecallModePanel.js',
      'src/components/workbench/panels/RecallRightPanel.js',
      'src/components/workbench/panels/AnalysisModePanel.js',
      'src/components/workbench/panels/AnalysisRightPanel.js',
      'src/components/workbench/shared/LibrarySideDrawer.js',
    ]
    const forbidden = [
      'trainingRuntimeStore',
      'workbenchStore',
      'trainingRepository',
      'repository.',
      'loadTask(',
      'loadRecallCheckpoint(',
      'window.sabaki',
      '.db.',
    ]

    for (const relativePath of guardedFiles) {
      const source = stripComments(readRepoFile(relativePath))
      for (const token of forbidden) {
        assert.strictEqual(
          source.includes(token),
          false,
          `${relativePath} must remain presentational and not read ${token}`,
        )
      }
    }
  })

  it('S6P-T08: this suite contains high-entropy sentinels and does not directly render final panel props', function () {
    const source = readRepoFile(TEST_PATH)
    for (const value of Object.values(SENTINELS)) {
      assert.ok(
        source.includes(value),
        `six-screen anti-fake-green tests must keep sentinel ${value}`,
      )
    }

    const stripped = stripComments(source)
    for (const panelName of [
      'ProblemModePanel',
      'ProblemRightPanel',
      'RecallModePanel',
      'RecallRightPanel',
      'AnalysisModePanel',
      'AnalysisRightPanel',
      'LibrarySideDrawer',
    ]) {
      const forbiddenDirectRender = `h(${panelName}`
      assert.strictEqual(
        stripped.includes(forbiddenDirectRender),
        false,
        `Projection tests must not render final panel props directly: ${forbiddenDirectRender}`,
      )
    }

    for (const fallbackLiteral of [
      '局部战斗中的局面',
      '3.6',
      '0.0 目',
      '1/5',
      '23 / 180',
      'R10',
      '-11.2',
      'Leela Zero (v0.19)',
      '黑方 vs 白方 #1',
    ]) {
      assert.ok(
        source.includes(`assertTextExcludes(text, '${fallbackLiteral}'`) ||
          source.includes(`assertTextExcludes(text, "${fallbackLiteral}"`),
        `Fallback literal must have a negative assertion: ${fallbackLiteral}`,
      )
    }
  })
})
