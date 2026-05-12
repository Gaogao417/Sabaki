import assert from 'assert'

import {
  BOARD_INTENTS,
  RESOLVE_STATUSES,
  executePlayInteraction,
} from '../src/modules/workbench/board-interactions/index.ts'

import {
  MUTATION_CONTRACTS,
} from '../src/modules/workbench/contracts/index.ts'

import {
  appendMoveNode,
  detectKo,
  detectPrevPass,
} from '../src/modules/document/gameTreeWrites.js'

import * as gametree from '../src/modules/gametree.js'
import Board from '@sabaki/go-board'

// --- Helpers ---

function resolvedPlayResult(vertex, overrides = {}) {
  return {
    intent: BOARD_INTENTS.PLAY_STONE,
    status: RESOLVE_STATUSES.RESOLVED,
    mutationContract: MUTATION_CONTRACTS.PLAY_MOVE,
    positionSource: {kind: 'game-tree', treePosition: 'node-1'},
    payload: {vertex},
    ...overrides,
  }
}

function trackServices(playMoveResult = {valid: true, changed: true, treePosition: 'node-2', pass: false, capturing: false, suicide: false, ko: false, doublePass: false}) {
  let calls = {
    playMove: [],
    generateReply: [],
    scheduleLiveAnalysis: [],
    stopEngineGame: [],
  }
  return {
    services: {
      documentStore: {
        async playMove(vertex, opts) {
          calls.playMove.push({vertex, opts})
          return playMoveResult
        },
      },
      engineService: {
        generateReply(treePosition, currentPlayer) {
          calls.generateReply.push({treePosition, currentPlayer})
        },
        stopEngineGame() {
          calls.stopEngineGame.push({})
        },
      },
      analysisService: {
        scheduleLiveAnalysis(treePosition) {
          calls.scheduleLiveAnalysis.push({treePosition})
        },
        analyzeMove() {},
      },
    },
    calls,
  }
}

// --- gameTreeWrites tests ---

describe('gameTreeWrites', () => {
  describe('appendMoveNode', () => {
    it('appends a black move and returns new tree and position', () => {
      let tree = gametree.new()
      let rootId = tree.root.id
      let vertex = [3, 3]

      let {newTree, nextTreePosition, createNode} = appendMoveNode(tree, rootId, vertex, 1)

      assert.ok(createNode, 'should create a new node')
      assert.notEqual(nextTreePosition, rootId)
      let node = newTree.get(nextTreePosition)
      assert.ok(node)
      assert.ok(node.data.B)
      assert.equal(node.data.B[0], 'dd')
    })

    it('appends a white move', () => {
      let tree = gametree.new()
      let rootId = tree.root.id

      let {newTree, nextTreePosition} = appendMoveNode(tree, rootId, [4, 4], -1)

      let node = newTree.get(nextTreePosition)
      assert.ok(node.data.W)
      assert.equal(node.data.W[0], 'ee')
    })

    it('createNode is false when appending to existing child', () => {
      let tree = gametree.new()
      let rootId = tree.root.id

      // Append once
      let first = appendMoveNode(tree, rootId, [3, 3], 1)

      // Append same move again to same tree - will create a new child
      // because tree.mutate creates a new tree, not append to same
      let second = appendMoveNode(first.newTree, rootId, [3, 3], 1)

      // The second append should find the existing child
      assert.equal(second.createNode, false)
      assert.equal(second.nextTreePosition, first.nextTreePosition)
    })
  })

  describe('detectKo', () => {
    it('returns false for root node (no parent)', () => {
      let tree = gametree.new()
      let board = Board.fromDimensions(9, 9)

      assert.equal(detectKo(tree, tree.root.id, board, 1, [3, 3]), false)
    })

    it('returns false when no ko position', () => {
      let tree = gametree.new()
      let rootId = tree.root.id

      // Add a move
      let {newTree, nextTreePosition} = appendMoveNode(tree, rootId, [3, 3], 1)

      let board = gametree.getBoard(newTree, nextTreePosition)

      // Playing a move that doesn't create ko
      let result = detectKo(newTree, nextTreePosition, board, -1, [3, 4])
      assert.equal(result, false)
    })
  })

  describe('detectPrevPass', () => {
    it('returns false when previous move was not a pass', () => {
      let tree = gametree.new()
      let rootId = tree.root.id

      // Black plays at 3,3
      let {newTree, nextTreePosition} = appendMoveNode(tree, rootId, [3, 3], 1)

      // White's turn - check if previous (black) was a pass
      assert.equal(detectPrevPass(newTree, nextTreePosition, 'W'), false)
    })

    it('returns true when previous move was a pass of the opposite color', () => {
      let tree = gametree.new()
      let rootId = tree.root.id

      // Black passes
      let {newTree, nextTreePosition} = appendMoveNode(tree, rootId, [-1, -1], 1)

      // Check if previous (black) was a pass - from white's perspective
      assert.equal(detectPrevPass(newTree, nextTreePosition, 'W'), true)
    })
  })
})

// --- playInteractionExecutor tests ---

describe('executePlayInteraction', () => {
  describe('valid play-stone', () => {
    it('calls document store and returns handled/changed', async () => {
      let {services, calls} = trackServices()
      let result = resolvedPlayResult([3, 3])

      let exec = await executePlayInteraction(result, {}, services)

      assert.equal(exec.handled, true)
      assert.equal(exec.changed, true)
      assert.equal(calls.playMove.length, 1)
      assert.deepEqual(calls.playMove[0].vertex, [3, 3])
    })

    it('returns tree position and move metadata', async () => {
      let {services} = trackServices({
        valid: true,
        changed: true,
        treePosition: 'node-42',
        pass: false,
        capturing: true,
        suicide: false,
        ko: false,
        doublePass: false,
      })

      let exec = await executePlayInteraction(resolvedPlayResult([3, 3]), {}, services)

      assert.equal(exec.treePosition, 'node-42')
      assert.equal(exec.capturing, true)
      assert.equal(exec.pass, false)
    })

    it('passes player from context to document store', async () => {
      let {services, calls} = trackServices()

      await executePlayInteraction(resolvedPlayResult([3, 3]), {player: -1}, services)

      assert.equal(calls.playMove[0].opts.player, -1)
    })
  })

  describe('engine reply', () => {
    it('runs after changed non-double-pass moves', async () => {
      let {services, calls} = trackServices({
        valid: true, changed: true, treePosition: 'node-2',
        pass: false, capturing: false, suicide: false, ko: false, doublePass: false,
      })

      await executePlayInteraction(resolvedPlayResult([3, 3]), {player: 1}, services)

      assert.equal(calls.generateReply.length, 1)
      assert.equal(calls.generateReply[0].currentPlayer, 1)
    })

    it('does not run after double pass', async () => {
      let {services, calls} = trackServices({
        valid: true, changed: true, treePosition: 'node-2',
        pass: true, capturing: false, suicide: false, ko: false, doublePass: true,
      })

      await executePlayInteraction(resolvedPlayResult([-1, -1]), {}, services)

      assert.equal(calls.generateReply.length, 0)
    })

    it('does not run when move was not changed', async () => {
      let {services, calls} = trackServices({
        valid: true, changed: false, reason: 'ko-cancelled',
      })

      await executePlayInteraction(resolvedPlayResult([3, 3]), {}, services)

      assert.equal(calls.generateReply.length, 0)
    })
  })

  describe('live analysis', () => {
    it('is scheduled after changed move', async () => {
      let {services, calls} = trackServices({
        valid: true, changed: true, treePosition: 'node-2',
        pass: false, capturing: false, suicide: false, ko: false, doublePass: false,
      })

      await executePlayInteraction(resolvedPlayResult([3, 3]), {}, services)

      assert.equal(calls.scheduleLiveAnalysis.length, 1)
      assert.equal(calls.scheduleLiveAnalysis[0].treePosition, 'node-2')
    })

    it('is not scheduled when move was not changed', async () => {
      let {services, calls} = trackServices({
        valid: true, changed: false, reason: 'ko-cancelled',
      })

      await executePlayInteraction(resolvedPlayResult([3, 3]), {}, services)

      assert.equal(calls.scheduleLiveAnalysis.length, 0)
    })
  })

  describe('rejection', () => {
    it('wrong intent is rejected without side effects', async () => {
      let {services, calls} = trackServices()
      let result = resolvedPlayResult([3, 3], {intent: BOARD_INTENTS.PLACE_BLACK_STONE})

      let exec = await executePlayInteraction(result, {}, services)

      assert.equal(exec.handled, false)
      assert.equal(exec.changed, false)
      assert.equal(calls.playMove.length, 0)
    })

    it('wrong contract is rejected without side effects', async () => {
      let {services, calls} = trackServices()
      let result = resolvedPlayResult([3, 3], {mutationContract: MUTATION_CONTRACTS.SCRATCH_EDIT})

      let exec = await executePlayInteraction(result, {}, services)

      assert.equal(exec.handled, false)
      assert.equal(calls.playMove.length, 0)
    })

    it('deferred status is rejected', async () => {
      let {services, calls} = trackServices()
      let result = {
        intent: BOARD_INTENTS.LEGACY_PLAY_RIGHT_CLICK,
        status: RESOLVE_STATUSES.DEFERRED,
        mutationContract: null,
        positionSource: null,
        reason: 'right-click',
      }

      let exec = await executePlayInteraction(result, {}, services)

      assert.equal(exec.handled, false)
      assert.equal(calls.playMove.length, 0)
    })

    it('rejected status is rejected', async () => {
      let {services, calls} = trackServices()
      let result = {
        intent: BOARD_INTENTS.NOOP,
        status: RESOLVE_STATUSES.REJECTED,
        mutationContract: MUTATION_CONTRACTS.PLAY_MOVE,
        positionSource: {kind: 'game-tree', treePosition: 'n1'},
        reason: 'occupied',
      }

      let exec = await executePlayInteraction(result, {}, services)

      assert.equal(exec.handled, false)
      assert.equal(calls.playMove.length, 0)
    })
  })

  describe('scratch edit isolation', () => {
    it('does not touch scratch edit services/state', async () => {
      let {services, calls} = trackServices()

      await executePlayInteraction(resolvedPlayResult([3, 3]), {}, services)

      // Only documentStore, engineService, analysisService should be called
      // No scratch edit methods exist on these services
      assert.equal(calls.playMove.length, 1)
      assert.equal(calls.generateReply.length, 1)
      assert.equal(calls.scheduleLiveAnalysis.length, 1)
      // stopEngineGame should NOT be called
      assert.equal(calls.stopEngineGame.length, 0)
    })

    it('tolerates missing engine and analysis services', async () => {
      let services = {
        documentStore: {
          async playMove() {
            return {valid: true, changed: true, treePosition: 'n2', pass: false, capturing: false, suicide: false, ko: false, doublePass: false}
          },
        },
      }

      let exec = await executePlayInteraction(resolvedPlayResult([3, 3]), {}, services)

      assert.equal(exec.handled, true)
      assert.equal(exec.changed, true)
    })
  })
})

// --- Router integration tests ---

describe('executeBoardInteraction (router) playMove handling', () => {
  it('sync router does not handle playMove (async executor handles it)', () => {
    let {executeBoardInteraction} = require('../src/modules/workbench/board-interactions/index.ts')

    let result = resolvedPlayResult([3, 3])
    let exec = executeBoardInteraction(result, {})

    assert.equal(exec.handled, false)
    assert.ok(exec.reason.includes('unsupported contract'))
  })
})
