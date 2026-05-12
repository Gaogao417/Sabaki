import assert from 'assert'

import {createTrainingStore} from '../src/modules/training/trainingStore.js'

// --- Helpers ---

function createMockSabaki(overrides = {}) {
  let state = {
    recallSession: {id: 'test-session', gameId: 'test-game', mode: 'full_game', startMove: 0},
    recallMoveIndex: 0,
    recallExpectedMoves: [{sign: 1, vertex: 'dd'}],
    recallUserAttempts: [],
    recallShowHint: false,
    recallCompleted: false,
    gameTrees: [null],
    gameIndex: 0,
    gameCurrents: [{}],
    treePosition: 'root',
    ...overrides.state,
  }

  let tree = {
    navigate: () => ({id: 'next-node'}),
    root: {id: 'root'},
    get: () => ({id: 'root', data: {}, children: []}),
  }

  if (state.gameTrees[0] == null) {
    state.gameTrees[0] = tree
  }

  let calls = {
    setState: [],
    setCurrentTreePosition: [],
    setMode: [],
    db: {saveRecallSession: [], saveRecallAttempts: []},
    loadGameTrees: [],
  }

  return {
    state,
    calls,
    setState(patch) {
      calls.setState.push(patch)
      Object.assign(state, patch)
    },
    setCurrentTreePosition(t, nodeId) {
      calls.setCurrentTreePosition.push({tree: t, nodeId})
    },
    setMode(mode) {
      calls.setMode.push(mode)
      state.mode = mode
    },
    db: {
      async getGame(id) {
        return overrides.dbGetGame ?? null
      },
      async saveRecallSession(session) {
        calls.db.saveRecallSession.push(session)
        return {...session, id: session.id ?? 'new-session'}
      },
      async saveRecallAttempts(attempts) {
        calls.db.saveRecallAttempts.push(attempts)
      },
    },
    async loadGameTrees(trees, opts) {
      calls.loadGameTrees.push({trees, opts})
    },
  }
}

function createTrainingStoreWithMock(sabakiOverrides = {}) {
  let sabaki = createMockSabaki(sabakiOverrides)
  let store = createTrainingStore(sabaki, {
    applogger: null,
    playErrorSound: () => {},
    db: sabaki.db,
  })
  return {sabaki, store}
}

// --- trainingStore tests ---

describe('trainingStore', () => {
  describe('submitRecallAnswer — correct answer', () => {
    it('records correct attempt and advances recallMoveIndex', () => {
      let {sabaki, store} = createTrainingStoreWithMock({
        state: {
          recallExpectedMoves: [{sign: 1, vertex: 'dd'}],
        },
      })

      // [3,3] = "dd" in SGF coordinates
      let result = store.submitRecallAnswer([3, 3])

      assert.equal(result.handled, true)
      assert.equal(result.changed, true)
      assert.equal(result.isCorrect, true)
      assert.equal(result.recallMoveIndex, 1)
      assert.ok(result.attempt)
      assert.equal(result.attempt.isCorrect, true)
      assert.equal(result.attempt.expectedMove, 'dd')
      assert.equal(result.attempt.userMove, 'dd')
    })

    it('clears hint on correct answer', () => {
      let {sabaki, store} = createTrainingStoreWithMock({
        state: {
          recallShowHint: true,
          recallExpectedMoves: [{sign: 1, vertex: 'dd'}],
        },
      })

      let result = store.submitRecallAnswer([3, 3])

      assert.equal(result.handled, true)
      assert.equal(result.attempt.hintLevelUsed, 1)
      // State should have recallShowHint cleared in one of the patches
      let hintPatch = sabaki.calls.setState.find(p => 'recallShowHint' in p)
      assert.equal(hintPatch.recallShowHint, false)
    })

    it('navigates tree forward on correct answer', () => {
      let {sabaki, store} = createTrainingStoreWithMock({
        state: {
          recallExpectedMoves: [{sign: 1, vertex: 'dd'}],
        },
      })

      store.submitRecallAnswer([3, 3])

      assert.equal(sabaki.calls.setCurrentTreePosition.length, 1)
    })

    it('does not mutate game tree nodes', () => {
      let {sabaki, store} = createTrainingStoreWithMock({
        state: {
          recallExpectedMoves: [{sign: 1, vertex: 'dd'}],
        },
      })

      store.submitRecallAnswer([3, 3])

      // Only setCurrentTreePosition should be called — no tree mutation methods
      assert.equal(sabaki.calls.setCurrentTreePosition.length, 1)
      // No edit workspace changes
      let allPatches = sabaki.calls.setState
      for (let patch of allPatches) {
        assert.equal(patch.editWorkspace, undefined, 'editWorkspace should not be touched')
      }
    })

    it('marks completed when last move is answered correctly', () => {
      let {sabaki, store} = createTrainingStoreWithMock({
        state: {
          recallExpectedMoves: [{sign: 1, vertex: 'dd'}],
        },
      })

      let result = store.submitRecallAnswer([3, 3])

      assert.equal(result.completed, true)
      let lastPatch = sabaki.calls.setState[sabaki.calls.setState.length - 1]
      assert.equal(lastPatch.recallCompleted, true)
    })
  })

  describe('submitRecallAnswer — wrong answer', () => {
    it('records wrong attempt without advancing progress', () => {
      let {sabaki, store} = createTrainingStoreWithMock({
        state: {
          recallExpectedMoves: [{sign: 1, vertex: 'dd'}],
        },
      })

      // [0, 0] = "aa" — wrong
      let result = store.submitRecallAnswer([0, 0])

      assert.equal(result.handled, true)
      assert.equal(result.changed, false)
      assert.equal(result.isCorrect, false)
      assert.equal(result.recallMoveIndex, 0)
      assert.ok(result.attempt)
      assert.equal(result.attempt.isCorrect, false)
      assert.equal(result.attempt.userMove, 'aa')
    })

    it('does not navigate tree forward on wrong answer', () => {
      let {sabaki, store} = createTrainingStoreWithMock({
        state: {
          recallExpectedMoves: [{sign: 1, vertex: 'dd'}],
        },
      })

      store.submitRecallAnswer([0, 0])

      assert.equal(sabaki.calls.setCurrentTreePosition.length, 0)
    })

    it('does not change editWorkspace on wrong answer', () => {
      let {sabaki, store} = createTrainingStoreWithMock({
        state: {
          recallExpectedMoves: [{sign: 1, vertex: 'dd'}],
        },
      })

      store.submitRecallAnswer([0, 0])

      for (let patch of sabaki.calls.setState) {
        assert.equal(patch.editWorkspace, undefined)
      }
    })
  })

  describe('submitRecallAnswer — pass move', () => {
    it('handles expected pass move correctly', () => {
      let {sabaki, store} = createTrainingStoreWithMock({
        state: {
          recallExpectedMoves: [{sign: 1, vertex: null}],
        },
      })

      let result = store.submitRecallAnswer([0, 0])

      assert.equal(result.handled, true)
      assert.equal(result.changed, true)
      assert.equal(result.isCorrect, true)
      assert.equal(result.attempt.expectedMove, 'pass')
      assert.equal(result.attempt.userMove, 'pass')
    })
  })

  describe('submitRecallAnswer — edge cases', () => {
    it('returns handled:false when no active session', () => {
      let {store} = createTrainingStoreWithMock({
        state: {recallSession: null},
      })

      let result = store.submitRecallAnswer([3, 3])

      assert.equal(result.handled, false)
    })

    it('returns handled:false when already completed', () => {
      let {store} = createTrainingStoreWithMock({
        state: {recallCompleted: true},
      })

      let result = store.submitRecallAnswer([3, 3])

      assert.equal(result.handled, false)
    })

    it('returns handled:false when no expected move at index', () => {
      let {store} = createTrainingStoreWithMock({
        state: {
          recallMoveIndex: 5,
          recallExpectedMoves: [{sign: 1, vertex: 'dd'}],
        },
      })

      let result = store.submitRecallAnswer([3, 3])

      assert.equal(result.handled, false)
    })
  })

  describe('skipRecallMove', () => {
    it('records skip as wrong, advances index, clears hint', () => {
      let {sabaki, store} = createTrainingStoreWithMock({
        state: {
          recallShowHint: true,
          recallExpectedMoves: [{sign: 1, vertex: 'dd'}, {sign: -1, vertex: 'pp'}],
        },
      })

      store.skipRecallMove()

      // Should record a wrong attempt with userMove: 'skip'
      let attempts = sabaki.state.recallUserAttempts
      assert.equal(attempts.length, 1)
      assert.equal(attempts[0].isCorrect, false)
      assert.equal(attempts[0].userMove, 'skip')
      assert.equal(attempts[0].expectedMove, 'dd')

      // Should advance index
      assert.equal(sabaki.state.recallMoveIndex, 1)

      // Should clear hint
      let lastPatch = sabaki.calls.setState[sabaki.calls.setState.length - 1]
      assert.equal(lastPatch.recallShowHint, false)

      // Should navigate tree
      assert.equal(sabaki.calls.setCurrentTreePosition.length, 1)
    })
  })

  describe('showRecallHint', () => {
    it('sets recallShowHint to true', () => {
      let {sabaki, store} = createTrainingStoreWithMock()

      store.showRecallHint()

      let lastPatch = sabaki.calls.setState[sabaki.calls.setState.length - 1]
      assert.equal(lastPatch.recallShowHint, true)
    })
  })

  describe('endRecallSession', () => {
    it('saves session and attempts with sessionId, switches to analysis mode', async () => {
      let {sabaki, store} = createTrainingStoreWithMock({
        state: {
          recallUserAttempts: [
            {moveNumber: 0, expectedMove: 'dd', userMove: 'dd', isCorrect: true, hintLevelUsed: 0},
          ],
        },
      })

      await store.endRecallSession()

      // Should save session
      assert.equal(sabaki.calls.db.saveRecallSession.length, 1)
      let savedSession = sabaki.calls.db.saveRecallSession[0]
      assert.ok(savedSession.completedAt)

      // Should save attempts with sessionId
      assert.equal(sabaki.calls.db.saveRecallAttempts.length, 1)
      let savedAttempts = sabaki.calls.db.saveRecallAttempts[0]
      assert.equal(savedAttempts.length, 1)
      assert.equal(savedAttempts[0].sessionId, 'test-session')

      // Should switch to analysis mode
      assert.equal(sabaki.calls.setMode.length, 1)
      assert.equal(sabaki.calls.setMode[0], 'analysis')
    })

    it('does nothing when no active session', async () => {
      let {sabaki, store} = createTrainingStoreWithMock({
        state: {recallSession: null},
      })

      await store.endRecallSession()

      assert.equal(sabaki.calls.db.saveRecallSession.length, 0)
      assert.equal(sabaki.calls.setMode.length, 0)
    })
  })
})
