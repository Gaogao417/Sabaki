import assert from 'assert'

import {
  BOARD_INTENTS,
  RESOLVE_STATUSES,
  createBoardInteractionContext,
  resolveBoardInteraction,
} from '../../src/modules/workbench/board-interactions/index.ts'
import {MUTATION_CONTRACTS} from '../../src/modules/workbench/contracts/index.ts'
import {deriveBoardInteractionPolicy} from '../../src/modules/training/workbench/deriveBoardInteractionPolicy.ts'
import {createBoardInteractionController} from '../../src/modules/training/workbench/boardInteractionController.ts'

function makeBoard(signMapOverrides = {}) {
  const signMap = Array.from({length: 19}, () => Array(19).fill(0))
  for (const [key, sign] of Object.entries(signMapOverrides)) {
    const [x, y] = key.split(',').map(Number)
    signMap[y][x] = sign
  }

  return {
    width: 19,
    height: 19,
    get([x, y]) {
      return signMap[y]?.[x] ?? 0
    },
    markers: Array.from({length: 19}, () => Array(19).fill(null)),
  }
}

function makeTab(overrides = {}) {
  return {
    id: 'tab_policy',
    taskId: 'task_policy',
    mode: 'play',
    childTabIds: [],
    createdAt: '2026-05-29T00:00:00.000Z',
    updatedAt: '2026-05-29T00:00:00.000Z',
    ...overrides,
  }
}

describe('board interaction policy derivation', () => {
  it('makes problemAttemptMove a first-class runtime mutation contract', () => {
    assert.strictEqual(
      MUTATION_CONTRACTS.PROBLEM_ATTEMPT_MOVE,
      'problemAttemptMove',
    )
  })

  it('derives Problem board policy and resolver keeps that contract without mode business state', () => {
    const policy = deriveBoardInteractionPolicy({
      tab: makeTab({mode: 'problem'}),
      task: {problemArea: [[3, 3]]},
      selectedTool: 'stone_1',
      treePosition: 'node_problem',
    })

    const context = createBoardInteractionContext({
      state: {mode: 'play', selectedTool: 'stone_1', treePosition: 'node_legacy'},
      board: makeBoard(),
      vertex: [3, 3],
      event: {button: 0},
      policy,
    })
    const result = resolveBoardInteraction(context)

    assert.strictEqual(policy.mutationContract, 'problemAttemptMove')
    assert.deepStrictEqual(policy.allowedVertices, [[3, 3]])
    assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
    assert.strictEqual(result.intent, BOARD_INTENTS.PLAY_STONE)
    assert.strictEqual(result.mutationContract, 'problemAttemptMove')
  })

  it('rejects Problem clicks outside policy.allowedVertices before any executor can write', () => {
    const policy = deriveBoardInteractionPolicy({
      tab: makeTab({mode: 'problem'}),
      task: {problemArea: [[3, 3]]},
      selectedTool: 'stone_1',
    })
    const context = createBoardInteractionContext({
      state: {mode: 'play', selectedTool: 'stone_1', treePosition: 'node_root'},
      board: makeBoard(),
      vertex: [10, 10],
      event: {button: 0},
      policy,
    })

    const result = resolveBoardInteraction(context)

    assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    assert.strictEqual(result.mutationContract, 'problemAttemptMove')
  })

  it('derives explicit checkpointCorrection policy while recall checkpoint is active', () => {
    const policy = deriveBoardInteractionPolicy({
      tab: makeTab({mode: 'recall'}),
      runtimeState: {activeCheckpointId: 'cp_policy'},
      selectedTool: 'stone_1',
      treePosition: 'node_recall',
    })

    const context = createBoardInteractionContext({
      state: {mode: 'recall', selectedTool: 'stone_1', treePosition: 'node_recall'},
      board: makeBoard(),
      vertex: [4, 4],
      event: {button: 0},
      policy,
    })
    const result = resolveBoardInteraction(context)

    assert.strictEqual(policy.mutationContract, 'checkpointCorrection')
    assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
    assert.strictEqual(
      result.intent,
      BOARD_INTENTS.SUBMIT_CHECKPOINT_CORRECTION_MOVE,
    )
    assert.strictEqual(result.mutationContract, 'checkpointCorrection')
  })
})

describe('boardInteractionController policy dispatch boundaries', () => {
  it('does not fall back to playMove when Problem executor state is missing', async () => {
    const calls = {documentStore: [], legacy: []}
    const controller = createBoardInteractionController({
      getPlayServices: () => ({
        documentStore: {
          async playMove(vertex, opts) {
            calls.documentStore.push({vertex, opts})
            return {valid: true, changed: true}
          },
        },
      }),
      getRecallAdapter: () => ({async submitBoardClick() {}}),
      getEditWorkspaceContext: () => null,
      getEditWorkspaceDeps: () => ({}),
      getLegacySabaki: () => ({
        clickVertex(vertex, event) {
          calls.legacy.push({vertex, event})
        },
      }),
      getIsMac: () => false,
    })

    const result = await controller.handleBoardClick({
      vertex: [3, 3],
      event: {button: 0, ctrlKey: false, metaKey: false},
      activeTab: makeTab({
        mode: 'problem',
        activeAttemptId: 'stale_attempt',
      }),
      settings: {selectedTool: 'stone_1'},
      board: makeBoard(),
      editWorkspacePresent: false,
      task: {problemArea: [[3, 3]]},
      runtimeState: {},
    })

    assert.deepStrictEqual(calls.documentStore, [])
    assert.deepStrictEqual(calls.legacy, [])
    assert.deepStrictEqual(result, {
      handled: false,
      changed: false,
      reason: 'missing problemFlowService',
    })
  })

  it('routes Analysis play-tool clicks to scratchEdit, never documentStore or Attempt', async () => {
    const calls = {documentStore: [], attempt: [], scratch: []}
    const controller = createBoardInteractionController({
      getPlayServices: () => ({
        documentStore: {
          async playMove(vertex, opts) {
            calls.documentStore.push({vertex, opts})
            return {valid: true, changed: true}
          },
        },
        attemptService: {
          async appendMove(attemptId, move, actor) {
            calls.attempt.push({attemptId, move, actor})
          },
        },
      }),
      getRecallAdapter: () => ({async submitBoardClick() {}}),
      getEditWorkspaceContext: () => ({
        activeTab: 'current',
        currentSnapshot: {
          id: 'snap_current',
          role: 'current',
          width: 19,
          height: 19,
          nextPlayer: 1,
          signMap: Array.from({length: 19}, () => Array(19).fill(0)),
        },
        referenceSnapshot: null,
        currentMarkerMap: Array.from({length: 19}, () => Array(19).fill(null)),
        referenceMarkerMap: null,
        currentLines: [],
        referenceLines: null,
        lineFirstVertex: null,
      }),
      getEditWorkspaceDeps: () => ({
        commitScratchResult(result) {
          calls.scratch.push(result)
        },
      }),
      getLegacySabaki: () => ({clickVertex() {}}),
      getIsMac: () => false,
    })

    await controller.handleBoardClick({
      vertex: [3, 3],
      event: {button: 0, ctrlKey: false, metaKey: false},
      activeTab: makeTab({
        mode: 'analysis',
        activeAttemptId: 'source_attempt',
      }),
      settings: {selectedTool: 'play'},
      board: makeBoard(),
      editWorkspacePresent: true,
      task: null,
      runtimeState: {},
    })

    assert.deepStrictEqual(calls.documentStore, [])
    assert.deepStrictEqual(calls.attempt, [])
    assert.strictEqual(calls.scratch.length, 1)
  })

  it('does not delegate Workbench analysis clicks to legacy SGF edit without editWorkspace', async () => {
    const calls = {documentStore: [], legacy: []}
    const controller = createBoardInteractionController({
      getPlayServices: () => ({
        documentStore: {
          async playMove(vertex, opts) {
            calls.documentStore.push({vertex, opts})
            return {valid: true, changed: true}
          },
        },
      }),
      getRecallAdapter: () => ({async submitBoardClick() {}}),
      getEditWorkspaceContext: () => null,
      getEditWorkspaceDeps: () => ({}),
      getLegacySabaki: () => ({
        clickVertex(vertex, event) {
          calls.legacy.push({vertex, event})
        },
      }),
      getIsMac: () => false,
    })

    await controller.handleBoardClick({
      vertex: [3, 3],
      event: {button: 0, ctrlKey: false, metaKey: false},
      activeTab: makeTab({mode: 'analysis'}),
      settings: {selectedTool: 'play'},
      board: makeBoard(),
      editWorkspacePresent: false,
      task: null,
      runtimeState: {},
    })

    assert.deepStrictEqual(calls.documentStore, [])
    assert.deepStrictEqual(calls.legacy, [])
  })

  it('routes checkpoint correction clicks through the explicit checkpoint adapter, not recall answers', async () => {
    const calls = {recall: [], checkpoint: [], documentStore: []}
    const controller = createBoardInteractionController({
      getPlayServices: () => ({
        documentStore: {
          async playMove(vertex, opts) {
            calls.documentStore.push({vertex, opts})
            return {valid: true, changed: true}
          },
        },
      }),
      getRecallAdapter: () => ({
        async submitBoardClick(vertex) {
          calls.recall.push(vertex)
          return {handled: true, changed: true}
        },
      }),
      getCheckpointCorrectionAdapter: () => ({
        async appendCorrectionMove(vertex) {
          calls.checkpoint.push(vertex)
          return {handled: true, changed: true}
        },
      }),
      getEditWorkspaceContext: () => null,
      getEditWorkspaceDeps: () => ({}),
      getLegacySabaki: () => ({clickVertex() {}}),
      getIsMac: () => false,
    })

    const result = await controller.handleBoardClick({
      vertex: [4, 4],
      event: {button: 0, ctrlKey: false, metaKey: false},
      activeTab: makeTab({
        mode: 'recall',
        activeRecallSessionId: 'rs_policy',
      }),
      settings: {selectedTool: 'stone_1'},
      board: makeBoard(),
      editWorkspacePresent: false,
      task: null,
      runtimeState: {activeCheckpointId: 'cp_policy'},
    })

    assert.deepStrictEqual(result, {handled: true, changed: true})
    assert.deepStrictEqual(calls.checkpoint, [[4, 4]])
    assert.deepStrictEqual(calls.recall, [])
    assert.deepStrictEqual(calls.documentStore, [])
  })

  it('routes Problem AI replies through problemFlowService, never playMove', async () => {
    const calls = {problem: [], documentStore: [], aiInputs: []}
    const controller = createBoardInteractionController({
      getPlayServices: () => ({
        documentStore: {
          async playMove(vertex, opts) {
            calls.documentStore.push({vertex, opts})
            return {valid: true, changed: true}
          },
        },
        problemFlowService: {
          async appendProblemMove(input) {
            calls.problem.push(input)
            return {moveIndex: calls.problem.length - 1}
          },
        },
        repository: {
          async loadAttempt() {
            return {
              rootPositionSgf: '(;SZ[19])',
              userLine: ['dd'],
            }
          },
          async loadTask() {
            return {
              problemArea: [[4, 4]],
              rootPositionSgf: '(;SZ[19])',
              sideToMove: 'black',
            }
          },
        },
        aiMoveService: {
          async maybePlayAiMove(input) {
            calls.aiInputs.push(input)
            return 'ee'
          },
        },
      }),
      getRecallAdapter: () => ({async submitBoardClick() {}}),
      getEditWorkspaceContext: () => null,
      getEditWorkspaceDeps: () => ({}),
      getLegacySabaki: () => ({clickVertex() {}}),
      getIsMac: () => false,
    })

    await controller.handleBoardClick({
      vertex: [3, 3],
      event: {button: 0, ctrlKey: false, metaKey: false},
      activeTab: makeTab({
        mode: 'problem',
        activeAttemptId: 'attempt_policy',
        playerConfig: {
          black: 'human',
          white: 'ai',
          ai: {autoPlay: true},
        },
      }),
      settings: {selectedTool: 'stone_1'},
      board: makeBoard(),
      editWorkspacePresent: false,
      task: {problemArea: [[3, 3], [4, 4]], sideToMove: 'black'},
      runtimeState: {},
    })

    assert.deepStrictEqual(calls.documentStore, [])
    assert.strictEqual(calls.aiInputs.length, 1)
    assert.strictEqual(calls.problem.length, 2)
    assert.strictEqual(calls.problem[0].move, 'dd')
    assert.strictEqual(calls.problem[0].actor, 'human')
    assert.strictEqual(calls.problem[1].move, 'ee')
    assert.strictEqual(calls.problem[1].actor, 'ai')
  })
})
