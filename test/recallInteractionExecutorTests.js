import assert from 'assert'

import {
  BOARD_INTENTS,
  RESOLVE_STATUSES,
  executeRecallInteraction,
  executeBoardInteraction,
} from '../src/modules/workbench/board-interactions/index.ts'

import {MUTATION_CONTRACTS} from '../src/modules/workbench/contracts/index.ts'

// --- Helpers ---

function resolvedRecallResult(vertex, overrides = {}) {
  return {
    intent: BOARD_INTENTS.SUBMIT_RECALL_ANSWER,
    status: RESOLVE_STATUSES.RESOLVED,
    mutationContract: MUTATION_CONTRACTS.RECALL_ANSWER,
    positionSource: {kind: 'game-tree', treePosition: 'node-1'},
    payload: {vertex},
    ...overrides,
  }
}

function trackAdapter(answerResult = {handled: true, changed: true, isCorrect: true, completed: false, recallMoveIndex: 1, attempt: {moveNumber: 0, isCorrect: true}}) {
  let calls = {submitBoardClick: []}
  return {
    adapter: {
      async submitBoardClick(vertex) {
        calls.submitBoardClick.push({vertex})
        return answerResult
      },
    },
    calls,
  }
}

// --- recallInteractionExecutor tests ---

describe('executeRecallInteraction', () => {
  describe('valid submit-recall-answer', () => {
    it('calls adapter.submitBoardClick(vertex)', async () => {
      let {adapter, calls} = trackAdapter()
      let result = resolvedRecallResult([3, 3])

      let exec = await executeRecallInteraction(result, {}, {adapter})

      assert.equal(exec.handled, true)
      assert.equal(exec.changed, true)
      assert.equal(calls.submitBoardClick.length, 1)
      assert.deepEqual(calls.submitBoardClick[0].vertex, [3, 3])
    })

    it('returns isCorrect, completed, recallMoveIndex, attempt from adapter', async () => {
      let answerResult = {
        handled: true,
        changed: true,
        isCorrect: true,
        completed: false,
        recallMoveIndex: 1,
        attempt: {moveNumber: 0, expectedMove: 'dd', userMove: 'dd', isCorrect: true, hintLevelUsed: 0},
      }
      let {adapter} = trackAdapter(answerResult)

      let exec = await executeRecallInteraction(resolvedRecallResult([3, 3]), {}, {adapter})

      assert.equal(exec.isCorrect, true)
      assert.equal(exec.completed, false)
      assert.equal(exec.recallMoveIndex, 1)
      assert.deepEqual(exec.attempt, answerResult.attempt)
    })

    it('returns wrong answer result from adapter', async () => {
      let answerResult = {
        handled: true,
        changed: false,
        isCorrect: false,
        completed: false,
        recallMoveIndex: 0,
        reason: undefined,
        attempt: {moveNumber: 0, expectedMove: 'dd', userMove: 'pp', isCorrect: false, hintLevelUsed: 0},
      }
      let {adapter} = trackAdapter(answerResult)

      let exec = await executeRecallInteraction(resolvedRecallResult([3, 15]), {}, {adapter})

      assert.equal(exec.isCorrect, false)
      assert.equal(exec.changed, false)
      assert.equal(exec.recallMoveIndex, 0)
    })
  })

  describe('rejection', () => {
    it('wrong intent is rejected without side effects', async () => {
      let {adapter, calls} = trackAdapter()
      let result = resolvedRecallResult([3, 3], {intent: BOARD_INTENTS.PLAY_STONE})

      let exec = await executeRecallInteraction(result, {}, {adapter})

      assert.equal(exec.handled, false)
      assert.equal(exec.changed, false)
      assert.equal(calls.submitBoardClick.length, 0)
    })

    it('wrong contract is rejected without side effects', async () => {
      let {adapter, calls} = trackAdapter()
      let result = resolvedRecallResult([3, 3], {mutationContract: MUTATION_CONTRACTS.PLAY_MOVE})

      let exec = await executeRecallInteraction(result, {}, {adapter})

      assert.equal(exec.handled, false)
      assert.equal(calls.submitBoardClick.length, 0)
    })

    it('deferred status is rejected', async () => {
      let {adapter, calls} = trackAdapter()
      let result = {
        intent: BOARD_INTENTS.SUBMIT_RECALL_ANSWER,
        status: RESOLVE_STATUSES.DEFERRED,
        mutationContract: MUTATION_CONTRACTS.RECALL_ANSWER,
        positionSource: null,
        reason: 'deferred',
      }

      let exec = await executeRecallInteraction(result, {}, {adapter})

      assert.equal(exec.handled, false)
      assert.equal(calls.submitBoardClick.length, 0)
    })

    it('rejected status is rejected', async () => {
      let {adapter, calls} = trackAdapter()
      let result = {
        intent: BOARD_INTENTS.SUBMIT_RECALL_ANSWER,
        status: RESOLVE_STATUSES.REJECTED,
        mutationContract: MUTATION_CONTRACTS.RECALL_ANSWER,
        positionSource: {kind: 'game-tree', treePosition: 'n1'},
        reason: 'occupied point',
      }

      let exec = await executeRecallInteraction(result, {}, {adapter})

      assert.equal(exec.handled, false)
      assert.equal(calls.submitBoardClick.length, 0)
    })
  })

  describe('isolation', () => {
    it('does not call documentStore, engineService, or analysisService', async () => {
      let {adapter, calls} = trackAdapter()

      let exec = await executeRecallInteraction(
        resolvedRecallResult([3, 3]),
        {},
        {adapter},
      )

      assert.equal(exec.handled, true)
      assert.equal(calls.submitBoardClick.length, 1)
      // No other service calls exist on adapter
    })
  })
})

// --- Router integration tests ---

describe('executeBoardInteraction (router) recallAnswer handling', () => {
  it('routes recallAnswer to recall executor', async () => {
    let {adapter, calls} = trackAdapter()
    let result = resolvedRecallResult([3, 3])

    let exec = await executeBoardInteraction(result, {}, {adapter})

    assert.equal(exec.handled, true)
    assert.equal(calls.submitBoardClick.length, 1)
  })

  it('playMove still does not go through sync router', () => {
    let result = {
      intent: BOARD_INTENTS.PLAY_STONE,
      status: RESOLVE_STATUSES.RESOLVED,
      mutationContract: MUTATION_CONTRACTS.PLAY_MOVE,
      positionSource: {kind: 'game-tree', treePosition: 'node-1'},
      payload: {vertex: [3, 3]},
    }

    let exec = executeBoardInteraction(result, {})

    assert.equal(exec.handled, false)
    assert.ok(exec.reason.includes('unsupported contract'))
  })
})
