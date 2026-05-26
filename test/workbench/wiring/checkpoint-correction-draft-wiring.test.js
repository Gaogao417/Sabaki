import assert from 'assert'

import TrainingWorkbenchContainer from '../../../src/components/TrainingWorkbenchContainer.js'
import {createWorkbenchStore} from '../../../src/modules/training/store/workbenchStore.ts'
import {createTrainingRuntimeStore} from '../../../src/modules/training/store/trainingRuntimeStore.ts'

function makeRecallTab(overrides = {}) {
  return {
    id: 'tab_checkpoint',
    taskId: 'task_checkpoint',
    mode: 'recall',
    recallSubstate: 'checkpoint_correction',
    activeRecallSessionId: 'rs_checkpoint',
    childTabIds: [],
    createdAt: '2026-05-26T00:00:00.000Z',
    updatedAt: '2026-05-26T00:00:00.000Z',
    ...overrides,
  }
}

function makeRecallView(overrides = {}) {
  return {
    recallSessionId: 'rs_checkpoint',
    taskId: 'task_checkpoint',
    tabId: 'tab_checkpoint',
    moveIndex: 0,
    expectedMoves: [
      {sign: 1, vertex: 'dd'},
      {sign: -1, vertex: 'pp'},
    ],
    userAttempts: [],
    showHint: false,
    completed: false,
    ...overrides,
  }
}

function createHarness({
  tab = makeRecallTab(),
  recallView = makeRecallView(),
  activeCheckpointId = 'cp_checkpoint',
  correctionDraft = {checkpointId: activeCheckpointId, moves: []},
} = {}) {
  const workbenchStore = createWorkbenchStore()
  const runtimeStore = createTrainingRuntimeStore()
  const documentStoreCalls = []
  const recallServiceCalls = []

  workbenchStore.addTab(tab)
  workbenchStore.setActiveTab(tab.id)
  runtimeStore.setActiveRecallSession(tab.activeRecallSessionId)
  runtimeStore.setRecallView(recallView)
  runtimeStore.setActiveCheckpoint(activeCheckpointId)
  runtimeStore.setCorrectionDraft(correctionDraft)

  const trainingContext = {
    workbenchStore,
    runtimeStore,
    flowService: {
      setModeEffects() {},
      completeRecall() {},
      enterAnalysis() {},
      returnFromAnalysis() {},
      async submitCheckpointCorrection() {},
      async revealCheckpointAi() { return [] },
      async skipCheckpoint() {},
      async saveCheckpointComment() {},
    },
    tabService: {},
    legacyTrainingFlowController: {
      showRecallHint() {},
      skipRecallMove() {},
    },
    repository: {
      async loadTask() { return null },
      async loadRecallSession(id) {
        return {
          id,
          currentMoveIndex: runtimeStore.getState().recallView?.moveIndex ?? 0,
          completed: false,
        }
      },
    },
    recallService: {
      async submitRecallMove(input) {
        recallServiceCalls.push(input)
        throw new Error('checkpoint correction clicks must not submit recall answers')
      },
    },
  }

  const sabaki = {
    state: {selectedTool: 'stone_1'},
    getTrainingContext() {
      return trainingContext
    },
    getPlayServices() {
      return {
        documentStore: {
          async playMove(vertex, options) {
            documentStoreCalls.push({vertex, options})
            return {changed: true}
          },
        },
      }
    },
    getOverlayStore() {
      return {getState: () => ({territoryEnabled: false, territoryCompareEnabled: false})}
    },
    flashInfoOverlay() {},
    setState() {},
    setMode() {},
  }

  const container = new TrainingWorkbenchContainer({sabaki})
  container.props = {sabaki}
  container._gobanAdapter = null

  return {
    container,
    runtimeStore,
    workbenchStore,
    documentStoreCalls,
    recallServiceCalls,
    getShellProps() {
      return container.render().props
    },
  }
}

function makeBoard() {
  return {
    width: 19,
    height: 19,
    markers: Array.from({length: 19}, () => Array.from({length: 19}, () => null)),
    get() { return 0 },
  }
}

function flushAsyncBoardClick() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

describe('checkpoint correction draft board wiring', function () {
  it('routes recall board clicks to correctionDraft while a checkpoint is active', async function () {
    const harness = createHarness()
    const shellProps = harness.getShellProps()

    shellProps.boardProps.handlerProps.onVertexClick({
      vertex: [3, 3],
      button: 0,
      ctrlKey: false,
      metaKey: false,
    })
    await flushAsyncBoardClick()

    assert.deepStrictEqual(harness.runtimeStore.getState().correctionDraft, {
      checkpointId: 'cp_checkpoint',
      moves: ['dd'],
      source: {
        kind: 'recall-checkpoint',
        recallSessionId: 'rs_checkpoint',
      },
    })
    assert.deepStrictEqual(harness.recallServiceCalls, [],
      'checkpoint correction click must not submit a formal recall answer')
    assert.deepStrictEqual(harness.documentStoreCalls, [],
      'checkpoint correction click must not write the game tree')
    assert.strictEqual(harness.workbenchStore.getState().tabs[0].mode, 'recall')
  })

  it('projects correctionDraft moves into the recall board source without changing mode', function () {
    const harness = createHarness({
      recallView: makeRecallView({
        moveIndex: 0,
        expectedMoves: [
          {sign: -1, vertex: 'dd'},
          {sign: 1, vertex: 'pp'},
        ],
      }),
      correctionDraft: {
        checkpointId: 'cp_checkpoint',
        moves: ['dd', 'Q16'],
      },
    })

    harness.container._gobanAdapter = {
      getSnapshot() {
        return {
          workbenchMode: 'recall',
          task: null,
          runtimeState: harness.runtimeStore.getState(),
          boardState: {
            gameTree: null,
            treePosition: 'node_root',
            board: makeBoard(),
          },
          overlayState: {
            paintMap: [],
            markerMap: [],
            dimmedStones: [],
            analysis: null,
          },
          settings: {
            showMoveNumbers: false,
            showNextMoves: false,
            showSiblings: false,
            showAnalysis: false,
            showCoordinates: true,
            showHumanPreference: false,
            selectedTool: 'stone_1',
            editWorkspaceActive: false,
            boardTransformation: [1, 0, 0, 1, 0, 0],
            areaSelectMode: false,
          },
          analysisData: null,
        }
      },
      subscribe() { return () => {} },
      destroy() {},
    }

    const shellProps = harness.getShellProps()
    const board = shellProps.boardProps.boardStateProps.board

    assert.strictEqual(shellProps.mode, 'recall')
    assert.strictEqual(shellProps.recallSubstate, 'checkpoint_correction')
    assert.strictEqual(board.get([3, 3]), -1)
    assert.strictEqual(board.get([15, 15]), 1)
  })
})
