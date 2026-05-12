import assert from 'assert'
import {fromDimensions as newBoard} from '@sabaki/go-board'

import {
  cloneWorkingPosition,
  createWorkingPosition,
  createWorkingPositionFromBoard,
  createWorkingPositionFromSnapshot,
  eraseWorkingStone,
  placeBlackStone,
  placeWhiteStone,
  setWorkingNextPlayer,
  workingPositionToBoard,
} from '../src/modules/workbench/working-position/index.js'

function emptySignMap(width, height) {
  return Array.from({length: height}, () => Array(width).fill(0))
}

describe('workingPosition', () => {
  describe('createWorkingPosition', () => {
    it('normalizes signMap values to 1/-1/0', () => {
      let position = createWorkingPosition({
        id: 'wp-1',
        width: 2,
        height: 2,
        signMap: [
          [3, -7],
          ['0', 0],
        ],
        nextPlayer: 5,
      })

      assert.deepEqual(position.signMap, [
        [1, -1],
        [0, 0],
      ])
    })

    it('normalizes nextPlayer', () => {
      let pos1 = createWorkingPosition({
        id: 'wp-2',
        width: 3,
        height: 3,
        signMap: emptySignMap(3, 3),
        nextPlayer: -1,
      })
      assert.equal(pos1.nextPlayer, -1)

      let pos2 = createWorkingPosition({
        id: 'wp-3',
        width: 3,
        height: 3,
        signMap: emptySignMap(3, 3),
        nextPlayer: 99,
      })
      assert.equal(pos2.nextPlayer, 1)
    })

    it('copies optional metadata', () => {
      let position = createWorkingPosition({
        id: 'wp-4',
        width: 3,
        height: 3,
        signMap: emptySignMap(3, 3),
        role: 'current',
        komi: 6.5,
        rules: 'Japanese',
        source: {type: 'game-tree-node', id: 'node-1'},
      })

      assert.equal(position.role, 'current')
      assert.equal(position.komi, 6.5)
      assert.equal(position.rules, 'Japanese')
      assert.deepEqual(position.source, {type: 'game-tree-node', id: 'node-1'})
    })

    it('omits metadata when not provided', () => {
      let position = createWorkingPosition({
        id: 'wp-5',
        width: 3,
        height: 3,
        signMap: emptySignMap(3, 3),
      })

      assert.equal('role' in position, false)
      assert.equal('komi' in position, false)
      assert.equal('rules' in position, false)
      assert.equal('source' in position, false)
    })

    it('deep-copies the signMap', () => {
      let signMap = [
        [1, 0],
        [0, -1],
      ]
      let position = createWorkingPosition({
        id: 'wp-6',
        width: 2,
        height: 2,
        signMap,
      })

      position.signMap[0][0] = -1
      assert.equal(signMap[0][0], 1)
    })
  })

  describe('createWorkingPositionFromSnapshot', () => {
    it('returns null for null input', () => {
      assert.equal(createWorkingPositionFromSnapshot(null), null)
    })

    it('returns null when no id is available', () => {
      assert.equal(
        createWorkingPositionFromSnapshot({width: 3, height: 3, signMap: emptySignMap(3, 3)}),
        null,
      )
    })

    it('uses snapshot id when options omit it', () => {
      let position = createWorkingPositionFromSnapshot({
        id: 'snap-1',
        width: 2,
        height: 2,
        signMap: [
          [1, 0],
          [0, 0],
        ],
        nextPlayer: -1,
      })

      assert.equal(position.id, 'snap-1')
      assert.equal(position.nextPlayer, -1)
      assert.deepEqual(position.signMap, [
        [1, 0],
        [0, 0],
      ])
    })

    it('options override snapshot fields', () => {
      let position = createWorkingPositionFromSnapshot(
        {
          id: 'snap-2',
          width: 2,
          height: 2,
          signMap: emptySignMap(2, 2),
          nextPlayer: 1,
          role: 'current',
        },
        {id: 'override-id', nextPlayer: -1, role: 'reference'},
      )

      assert.equal(position.id, 'override-id')
      assert.equal(position.nextPlayer, -1)
      assert.equal(position.role, 'reference')
    })
  })

  describe('cloneWorkingPosition', () => {
    it('returns null for null input', () => {
      assert.equal(cloneWorkingPosition(null), null)
    })

    it('produces an equal but distinct object', () => {
      let original = createWorkingPosition({
        id: 'wp-clone',
        width: 2,
        height: 2,
        signMap: [
          [1, 0],
          [0, -1],
        ],
        nextPlayer: -1,
        role: 'current',
        komi: 7.5,
        rules: 'Chinese',
        source: {type: 'manual'},
      })

      let cloned = cloneWorkingPosition(original)

      assert.deepEqual(cloned, original)
      assert.notEqual(cloned, original)
      assert.notEqual(cloned.signMap, original.signMap)
      assert.notEqual(cloned.signMap[0], original.signMap[0])
    })

    it('mutations on clone do not affect original', () => {
      let original = createWorkingPosition({
        id: 'wp-mut',
        width: 2,
        height: 2,
        signMap: [
          [1, 0],
          [0, 0],
        ],
      })

      let cloned = cloneWorkingPosition(original)
      cloned.signMap[0][0] = -1
      cloned.nextPlayer = -1

      assert.equal(original.signMap[0][0], 1)
      assert.equal(original.nextPlayer, 1)
    })
  })
})

describe('workingPositionBoard', () => {
  describe('workingPositionToBoard', () => {
    it('returns null for null input', () => {
      assert.equal(workingPositionToBoard(null), null)
    })

    it('creates a board matching the working position', () => {
      let position = createWorkingPosition({
        id: 'wp-board',
        width: 3,
        height: 3,
        signMap: [
          [1, 0, 0],
          [0, -1, 0],
          [0, 0, 1],
        ],
      })

      let board = workingPositionToBoard(position)

      assert.equal(board.width, 3)
      assert.equal(board.height, 3)
      assert.equal(board.get([0, 0]), 1)
      assert.equal(board.get([1, 1]), -1)
      assert.equal(board.get([2, 2]), 1)
      assert.equal(board.get([0, 1]), 0)
    })

    it('adds markers, lines, childrenInfo, siblingsInfo', () => {
      let position = createWorkingPosition({
        id: 'wp-ext',
        width: 2,
        height: 2,
        signMap: emptySignMap(2, 2),
      })

      let board = workingPositionToBoard(position)

      assert.ok(Array.isArray(board.markers))
      assert.ok(Array.isArray(board.lines))
      assert.ok(Array.isArray(board.childrenInfo))
      assert.ok(Array.isArray(board.siblingsInfo))
    })
  })

  describe('createWorkingPositionFromBoard', () => {
    it('round-trips through board conversion', () => {
      let board = newBoard(5, 5)
      board.set([2, 2], 1)
      board.set([3, 3], -1)

      let position = createWorkingPositionFromBoard(board, {
        id: 'from-board',
        nextPlayer: -1,
        role: 'reference',
        komi: 6.5,
        rules: 'Japanese',
        source: {type: 'game-tree-node', id: 'n1'},
      })

      assert.equal(position.id, 'from-board')
      assert.equal(position.width, 5)
      assert.equal(position.height, 5)
      assert.equal(position.nextPlayer, -1)
      assert.equal(position.signMap[2][2], 1)
      assert.equal(position.signMap[3][3], -1)
      assert.equal(position.role, 'reference')
      assert.equal(position.komi, 6.5)

      let board2 = workingPositionToBoard(position)
      assert.equal(board2.get([2, 2]), 1)
      assert.equal(board2.get([3, 3]), -1)
    })

    it('deep-copies the board signMap', () => {
      let board = newBoard(3, 3)
      let position = createWorkingPositionFromBoard(board, {id: 'copy-test'})

      position.signMap[0][0] = 1
      assert.equal(board.signMap[0][0], 0)
    })

    it('omits metadata when not provided', () => {
      let board = newBoard(3, 3)
      let position = createWorkingPositionFromBoard(board, {id: 'minimal'})

      assert.equal('role' in position, false)
      assert.equal('komi' in position, false)
      assert.equal('rules' in position, false)
      assert.equal('source' in position, false)
    })
  })

  describe('placeBlackStone / placeWhiteStone', () => {
    it('places a black stone', () => {
      let position = createWorkingPosition({
        id: 'place-b',
        width: 3,
        height: 3,
        signMap: emptySignMap(3, 3),
      })

      let result = placeBlackStone(position, [1, 1])

      assert.equal(result.signMap[1][1], 1)
      assert.equal(position.signMap[1][1], 0, 'original unchanged')
    })

    it('places a white stone', () => {
      let position = createWorkingPosition({
        id: 'place-w',
        width: 3,
        height: 3,
        signMap: emptySignMap(3, 3),
      })

      let result = placeWhiteStone(position, [0, 0])

      assert.equal(result.signMap[0][0], -1)
      assert.equal(position.signMap[0][0], 0)
    })

    it('preserves metadata on placement', () => {
      let position = createWorkingPosition({
        id: 'meta',
        width: 3,
        height: 3,
        signMap: emptySignMap(3, 3),
        role: 'current',
        komi: 7.5,
      })

      let result = placeBlackStone(position, [1, 1])

      assert.equal(result.id, 'meta')
      assert.equal(result.role, 'current')
      assert.equal(result.komi, 7.5)
    })
  })

  describe('eraseWorkingStone', () => {
    it('clears a stone at the given vertex', () => {
      let position = createWorkingPosition({
        id: 'erase',
        width: 3,
        height: 3,
        signMap: [
          [1, 0, 0],
          [0, -1, 0],
          [0, 0, 0],
        ],
      })

      let result = eraseWorkingStone(position, [0, 0])

      assert.equal(result.signMap[0][0], 0)
      assert.equal(result.signMap[1][1], -1, 'other stones unchanged')
      assert.equal(position.signMap[0][0], 1, 'original unchanged')
    })

    it('no-ops on an already-empty vertex', () => {
      let position = createWorkingPosition({
        id: 'erase-empty',
        width: 2,
        height: 2,
        signMap: [
          [0, 0],
          [0, 0],
        ],
      })

      let result = eraseWorkingStone(position, [0, 0])

      assert.equal(result.signMap[0][0], 0)
    })
  })

  describe('setWorkingNextPlayer', () => {
    it('sets nextPlayer to 1 for positive sign', () => {
      let position = createWorkingPosition({
        id: 'set-np',
        width: 3,
        height: 3,
        signMap: emptySignMap(3, 3),
        nextPlayer: -1,
      })

      let result = setWorkingNextPlayer(position, 5)
      assert.equal(result.nextPlayer, 1)
      assert.equal(position.nextPlayer, -1, 'original unchanged')
    })

    it('sets nextPlayer to -1 for negative sign', () => {
      let position = createWorkingPosition({
        id: 'set-np2',
        width: 3,
        height: 3,
        signMap: emptySignMap(3, 3),
        nextPlayer: 1,
      })

      let result = setWorkingNextPlayer(position, -3)
      assert.equal(result.nextPlayer, -1)
    })
  })

  describe('auto-capture consistency', () => {
    it('matches boardFromSnapshot().makeMove() results', async () => {
      // Import the reference implementation
      let {boardFromSnapshot} = await import('../src/modules/study.js')

      // Set up a position where placing a stone captures
      let signMap = emptySignMap(5, 5)
      signMap[0][1] = -1 // white
      signMap[1][0] = -1 // white
      signMap[1][1] = -1 // white
      signMap[2][1] = 1  // black
      signMap[1][2] = 1  // black
      signMap[0][0] = 0  // empty - white has one liberty at (0,0)

      let position = createWorkingPosition({
        id: 'auto-cap',
        width: 5,
        height: 5,
        signMap,
      })

      // Place black at (0,0) — should capture the 3 white stones
      let result = placeBlackStone(position, [0, 0])

      // Verify via reference path
      let refBoard = boardFromSnapshot({
        width: 5,
        height: 5,
        signMap,
      })
      let refResult = refBoard.makeMove(1, [0, 0])

      assert.deepEqual(
        result.signMap,
        refResult.signMap,
        'placeBlackStone should match board.makeMove capture behavior',
      )
    })
  })
})
