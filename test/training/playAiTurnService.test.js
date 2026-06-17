import assert from 'assert'

import {
  createPlayAiTurnService,
} from '../../src/modules/training/workbench/playAiTurnService.ts'
import {
  BOARD_INTENTS,
  RESOLVE_STATUSES,
} from '../../src/modules/workbench/board-interactions/intents.ts'

function createHarness({
  aiMoves = [],
  playMoveResults = [],
  initialLine = [],
  initialActors = [],
  rootPositionSgf = '(;GM[1]SZ[19])',
} = {}) {
  const calls = {
    documentMoves: [],
    aiInputs: [],
    monitorMoves: [],
  }
  const attempt = {
    rootPositionSgf,
    userLine: [...initialLine],
    moveActors: [...initialActors],
  }
  let documentIndex = 0

  const service = createPlayAiTurnService({
    getPlayServices: () => ({
      documentStore: {
        async playMove(vertex, opts) {
          calls.documentMoves.push({vertex, opts})
          const fallback = {
            valid: true,
            changed: true,
            treePosition: `node_${documentIndex + 1}`,
          }
          const result = playMoveResults[documentIndex] ?? fallback
          documentIndex += 1
          return result
        },
      },
      attemptService: {
        async appendMove(attemptId, move, actor) {
          assert.strictEqual(attemptId, 'attempt_1')
          attempt.moveActors.push({moveIndex: attempt.userLine.length, actor})
          attempt.userLine.push(move)
        },
      },
      monitor: {
        async onUserMove(input) {
          calls.monitorMoves.push({...input})
        },
      },
      repository: {
        async loadAttempt() {
          return {
            rootPositionSgf: attempt.rootPositionSgf,
            userLine: [...attempt.userLine],
          }
        },
        async loadTask() {
          return {
            rootPositionSgf,
            sideToMove: 'black',
          }
        },
      },
      aiMoveService: {
        async maybePlayAiMove(input) {
          calls.aiInputs.push({
            treePosition: input.treePosition,
            userLine: [...input.attempt.userLine],
          })
          return aiMoves.length > 0 ? aiMoves.shift() ?? null : null
        },
      },
    }),
  })

  return {service, attempt, calls}
}

function makeTab(overrides = {}) {
  return {
    id: 'tab_1',
    taskId: 'task_1',
    mode: 'play',
    activeAttemptId: 'attempt_1',
    playerConfig: {black: 'ai', white: 'human', ai: {autoPlay: true}},
    ...overrides,
  }
}

function makePlayResult(vertex) {
  return {
    intent: BOARD_INTENTS.PLAY_STONE,
    status: RESOLVE_STATUSES.RESOLVED,
    mutationContract: 'playMove',
    positionSource: {kind: 'game-tree', treePosition: 'node_root'},
    payload: {vertex},
  }
}

describe('playAiTurnService', () => {
  it('commits an AI first move at attempt start through the Play command path', async () => {
    const {service, attempt, calls} = createHarness({
      aiMoves: ['dd', null],
      playMoveResults: [
        {valid: true, changed: true, treePosition: 'node_ai_first'},
      ],
    })

    await service.playAiIfTurn({
      tab: makeTab(),
      task: {rootPositionSgf: '(;GM[1]SZ[19])', sideToMove: 'black'},
      positionSource: {kind: 'game-tree', treePosition: 'node_root'},
      treePosition: 'node_root',
    })

    assert.deepStrictEqual(
      calls.documentMoves.map(call => call.vertex),
      [[3, 3]],
    )
    assert.deepStrictEqual(attempt.userLine, ['dd'])
    assert.deepStrictEqual(
      attempt.moveActors.map(actor => actor.actor),
      ['ai'],
    )
    assert.deepStrictEqual(
      calls.monitorMoves.map(call => ({moveIndex: call.moveIndex, move: call.move})),
      [{moveIndex: 0, move: 'dd'}],
    )
    assert.deepStrictEqual(calls.aiInputs[0], {
      treePosition: 'node_root',
      userLine: [],
    })
  })

  it('converts real engine GTP coordinates with Sabaki board orientation', async () => {
    const {service, attempt, calls} = createHarness({
      aiMoves: ['D16', null],
      playMoveResults: [
        {valid: true, changed: true, treePosition: 'node_ai_first'},
      ],
    })

    await service.playAiIfTurn({
      tab: makeTab(),
      task: {rootPositionSgf: '(;GM[1]SZ[19])', sideToMove: 'black'},
      positionSource: {kind: 'game-tree', treePosition: 'node_root'},
      treePosition: 'node_root',
    })

    assert.deepStrictEqual(
      calls.documentMoves.map(call => call.vertex),
      [[3, 3]],
    )
    assert.deepStrictEqual(attempt.userLine, ['dd'])
    assert.deepStrictEqual(
      calls.monitorMoves.map(call => ({moveIndex: call.moveIndex, move: call.move})),
      [{moveIndex: 0, move: 'dd'}],
    )
  })

  it('keeps alternating Play AI replies in the same owner path after a human move', async () => {
    const {service, attempt, calls} = createHarness({
      initialLine: ['dd'],
      initialActors: [{moveIndex: 0, actor: 'ai'}],
      aiMoves: ['dp', null],
      playMoveResults: [
        {valid: true, changed: true, treePosition: 'node_human'},
        {valid: true, changed: true, treePosition: 'node_ai_reply'},
      ],
    })

    await service.commitMove({
      result: makePlayResult([16, 16]),
      tab: makeTab({playerConfig: {black: 'ai', white: 'human', ai: {autoPlay: true}}}),
      task: {rootPositionSgf: '(;GM[1]SZ[19])', sideToMove: 'black'},
      actor: 'human',
      move: 'qq',
    })

    assert.deepStrictEqual(
      calls.documentMoves.map(call => call.vertex),
      [[16, 16], [3, 15]],
    )
    assert.deepStrictEqual(attempt.userLine, ['dd', 'qq', 'dp'])
    assert.deepStrictEqual(
      attempt.moveActors.map(actor => actor.actor),
      ['ai', 'human', 'ai'],
    )
    assert.deepStrictEqual(
      calls.monitorMoves.map(call => ({moveIndex: call.moveIndex, move: call.move})),
      [
        {moveIndex: 1, move: 'qq'},
        {moveIndex: 2, move: 'dp'},
      ],
    )
    assert.deepStrictEqual(
      calls.aiInputs.map(input => input.userLine),
      [['dd', 'qq']],
    )
  })

  it('smoke: AI-first human-vs-AI play can reach five committed moves', async () => {
    const {service, attempt, calls} = createHarness({
      aiMoves: ['dd', 'dp', 'pq'],
      playMoveResults: [
        {valid: true, changed: true, treePosition: 'node_1_ai'},
        {valid: true, changed: true, treePosition: 'node_2_human'},
        {valid: true, changed: true, treePosition: 'node_3_ai'},
        {valid: true, changed: true, treePosition: 'node_4_human'},
        {valid: true, changed: true, treePosition: 'node_5_ai'},
      ],
    })
    const tab = makeTab({
      playerConfig: {black: 'ai', white: 'human', ai: {autoPlay: true}},
    })
    const task = {rootPositionSgf: '(;GM[1]SZ[19])', sideToMove: 'black'}

    await service.playAiIfTurn({
      tab,
      task,
      positionSource: {kind: 'game-tree', treePosition: 'node_root'},
      treePosition: 'node_root',
    })
    await service.commitMove({
      result: makePlayResult([16, 16]),
      tab,
      task,
      actor: 'human',
      move: 'qq',
    })
    await service.commitMove({
      result: makePlayResult([15, 3]),
      tab,
      task,
      actor: 'human',
      move: 'pd',
    })

    assert.deepStrictEqual(attempt.userLine, ['dd', 'qq', 'dp', 'pd', 'pq'])
    assert.deepStrictEqual(
      attempt.moveActors.map(actor => actor.actor),
      ['ai', 'human', 'ai', 'human', 'ai'],
    )
    assert.deepStrictEqual(
      calls.monitorMoves.map(call => ({moveIndex: call.moveIndex, move: call.move})),
      [
        {moveIndex: 0, move: 'dd'},
        {moveIndex: 1, move: 'qq'},
        {moveIndex: 2, move: 'dp'},
        {moveIndex: 3, move: 'pd'},
        {moveIndex: 4, move: 'pq'},
      ],
    )
    assert.deepStrictEqual(
      calls.aiInputs.map(input => ({treePosition: input.treePosition, userLine: input.userLine})),
      [
        {treePosition: 'node_root', userLine: []},
        {treePosition: 'node_2_human', userLine: ['dd', 'qq']},
        {treePosition: 'node_4_human', userLine: ['dd', 'qq', 'dp', 'pd']},
      ],
    )
  })

  it('smoke: human-first human-vs-AI play can reach five committed moves', async () => {
    const {service, attempt, calls} = createHarness({
      aiMoves: ['qq', 'pq', null],
      playMoveResults: [
        {valid: true, changed: true, treePosition: 'node_1_human'},
        {valid: true, changed: true, treePosition: 'node_2_ai'},
        {valid: true, changed: true, treePosition: 'node_3_human'},
        {valid: true, changed: true, treePosition: 'node_4_ai'},
        {valid: true, changed: true, treePosition: 'node_5_human'},
      ],
    })
    const tab = makeTab({
      playerConfig: {black: 'human', white: 'ai', ai: {autoPlay: true}},
    })
    const task = {rootPositionSgf: '(;GM[1]SZ[19])', sideToMove: 'black'}

    await service.commitMove({
      result: makePlayResult([3, 3]),
      tab,
      task,
      actor: 'human',
      move: 'dd',
    })
    await service.commitMove({
      result: makePlayResult([3, 15]),
      tab,
      task,
      actor: 'human',
      move: 'dp',
    })
    await service.commitMove({
      result: makePlayResult([15, 3]),
      tab,
      task,
      actor: 'human',
      move: 'pd',
    })

    assert.deepStrictEqual(attempt.userLine, ['dd', 'qq', 'dp', 'pq', 'pd'])
    assert.deepStrictEqual(
      attempt.moveActors.map(actor => actor.actor),
      ['human', 'ai', 'human', 'ai', 'human'],
    )
    assert.deepStrictEqual(
      calls.documentMoves.map(call => call.vertex),
      [[3, 3], [16, 16], [3, 15], [15, 16], [15, 3]],
    )
    assert.deepStrictEqual(
      calls.aiInputs.map(input => ({treePosition: input.treePosition, userLine: input.userLine})),
      [
        {treePosition: 'node_1_human', userLine: ['dd']},
        {treePosition: 'node_3_human', userLine: ['dd', 'qq', 'dp']},
        {treePosition: 'node_5_human', userLine: ['dd', 'qq', 'dp', 'pq', 'pd']},
      ],
    )
  })

  it('AI-vs-AI play without an explicit limit starts from the board-derived limit instead of zero moves', async () => {
    const {service, attempt, calls} = createHarness({
      rootPositionSgf: '(;GM[1]SZ[3])',
      aiMoves: ['aa', 'bb', null],
      playMoveResults: [
        {valid: true, changed: true, treePosition: 'node_ai_1'},
        {valid: true, changed: true, treePosition: 'node_ai_2'},
      ],
    })
    const tab = makeTab({
      playerConfig: {black: 'ai', white: 'ai', ai: {autoPlay: true}},
    })
    const task = {rootPositionSgf: '(;GM[1]SZ[3])', sideToMove: 'black'}

    await service.playAiIfTurn({
      tab,
      task,
      positionSource: {kind: 'game-tree', treePosition: 'node_root'},
      treePosition: 'node_root',
    })

    assert.deepStrictEqual(
      calls.documentMoves.map(call => call.vertex),
      [[0, 0], [1, 1]],
    )
    assert.deepStrictEqual(attempt.userLine, ['aa', 'bb'])
    assert.deepStrictEqual(
      attempt.moveActors.map(actor => actor.actor),
      ['ai', 'ai'],
    )
    assert.deepStrictEqual(
      calls.aiInputs.map(input => ({treePosition: input.treePosition, userLine: input.userLine})),
      [
        {treePosition: 'node_root', userLine: []},
        {treePosition: 'node_ai_1', userLine: ['aa']},
        {treePosition: 'node_ai_2', userLine: ['aa', 'bb']},
      ],
    )
  })
})
