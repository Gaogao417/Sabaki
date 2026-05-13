import assert from 'assert'

import {
  BOARD_INTENTS,
  RESOLVE_STATUSES,
  executePlayInteraction,
} from '../src/modules/workbench/board-interactions/index.ts'

import {
  MUTATION_CONTRACTS,
} from '../src/modules/workbench/contracts/index.ts'

// --- Helpers ---

function resolvedPlayResult(vertex) {
  return {
    intent: BOARD_INTENTS.PLAY_STONE,
    status: RESOLVE_STATUSES.RESOLVED,
    mutationContract: MUTATION_CONTRACTS.PLAY_MOVE,
    positionSource: { kind: 'game-tree', treePosition: 'node-1' },
    payload: { vertex },
  }
}

/**
 * Simulates the real engineService.generateReply behavior:
 *   1. Look up syncerId from blackEngineSyncerId/whiteEngineSyncerId by player sign
 *   2. If found, call generateMove (which sends the GTP command)
 */
function createMockEngineService({ blackSyncerId = null, whiteSyncerId = null } = {}) {
  let state = {
    blackEngineSyncerId: blackSyncerId,
    whiteEngineSyncerId: whiteSyncerId,
  }

  let gtpCommands = []

  function setBlackWhiteSyncerIds(bId, wId) {
    state.blackEngineSyncerId = bId
    state.whiteEngineSyncerId = wId
  }

  function getBlackSyncerId() { return state.blackEngineSyncerId }
  function getWhiteSyncerId() { return state.whiteEngineSyncerId }

  // Mirrors real generateReply logic from engineService.js:1389-1398
  function generateReply(treePosition, currentPlayer) {
    let syncerId = currentPlayer > 0
      ? state.whiteEngineSyncerId
      : state.blackEngineSyncerId

    if (syncerId == null) return

    // Simulate generateMove sending GTP genmove
    let color = currentPlayer > 0 ? 'W' : 'B'
    gtpCommands.push({ name: 'genmove', args: [color], syncerId, treePosition })
  }

  return {
    engineService: {
      generateReply,
      setBlackWhiteSyncerIds,
      getBlackSyncerId,
      getWhiteSyncerId,
    },
    gtpCommands,
    state,
  }
}

function createServices(engineOpts = {}) {
  let mock = createMockEngineService(engineOpts)
  let playMoveCalls = []

  return {
    services: {
      documentStore: {
        async playMove(vertex, opts) {
          playMoveCalls.push({ vertex, opts })
          return {
            valid: true, changed: true, treePosition: 'node-2',
            pass: false, capturing: false, suicide: false, ko: false, doublePass: false,
          }
        },
      },
      engineService: mock.engineService,
      analysisService: {
        scheduleLiveAnalysis() { },
        analyzeMove() { },
      },
    },
    mock,
    playMoveCalls,
  }
}

// --- Tests ---

describe('play mode: human clicks → GTP genmove sent', () => {
  describe('setBlackWhiteSyncerIds', () => {
    it('sets both syncer IDs', () => {
      let { engineService: es } = createMockEngineService()
      assert.equal(es.getBlackSyncerId(), null)
      assert.equal(es.getWhiteSyncerId(), null)

      es.setBlackWhiteSyncerIds('b-id', 'w-id')

      assert.equal(es.getBlackSyncerId(), 'b-id')
      assert.equal(es.getWhiteSyncerId(), 'w-id')
    })

    it('can update one side independently', () => {
      let { engineService: es } = createMockEngineService()
      es.setBlackWhiteSyncerIds('b', 'w')
      es.setBlackWhiteSyncerIds('b2', 'w')

      assert.equal(es.getBlackSyncerId(), 'b2')
      assert.equal(es.getWhiteSyncerId(), 'w')
    })

    it('can clear one side with null', () => {
      let { engineService: es } = createMockEngineService()
      es.setBlackWhiteSyncerIds('b', 'w')
      es.setBlackWhiteSyncerIds(null, 'w')

      assert.equal(es.getBlackSyncerId(), null)
      assert.equal(es.getWhiteSyncerId(), 'w')
    })
  })

  describe('human (black) plays → AI (white) generates move', () => {
    it('sends genmove W after black stone placement', async () => {
      let { services, mock } = createServices({ whiteSyncerId: 'white-engine' })

      // Black plays at 3,3 (player=1 means black just moved)
      await executePlayInteraction(resolvedPlayResult([3, 3]), { player: 1 }, services)

      assert.equal(mock.gtpCommands.length, 1, 'Exactly one GTP command should be sent')
      assert.equal(mock.gtpCommands[0].name, 'genmove')
      assert.deepEqual(mock.gtpCommands[0].args, ['W'])
      assert.equal(mock.gtpCommands[0].syncerId, 'white-engine')
    })

    it('sends genmove B after white stone placement', async () => {
      let { services, mock } = createServices({ blackSyncerId: 'black-engine' })

      await executePlayInteraction(resolvedPlayResult([4, 4]), { player: -1 }, services)

      assert.equal(mock.gtpCommands.length, 1)
      assert.equal(mock.gtpCommands[0].name, 'genmove')
      assert.deepEqual(mock.gtpCommands[0].args, ['B'])
      assert.equal(mock.gtpCommands[0].syncerId, 'black-engine')
    })

    it('sends no command when no engine is assigned for that color', async () => {
      // Only black engine assigned, but white should reply (player=1 → white)
      let { services, mock } = createServices({ blackSyncerId: 'black-engine' })

      await executePlayInteraction(resolvedPlayResult([3, 3]), { player: 1 }, services)

      assert.equal(mock.gtpCommands.length, 0, 'No GTP command when wrong side has no engine')
    })

    it('sends no command when no engines are assigned at all', async () => {
      let { services, mock } = createServices()

      await executePlayInteraction(resolvedPlayResult([3, 3]), { player: 1 }, services)

      assert.equal(mock.gtpCommands.length, 0)
    })

    it('sends no command after double pass', async () => {
      let { services, mock } = createServices({ whiteSyncerId: 'white-engine' })

      // Override playMove to return double pass
      services.documentStore.playMove = async () => ({
        valid: true, changed: true, treePosition: 'node-2',
        pass: true, capturing: false, suicide: false, ko: false, doublePass: true,
      })

      await executePlayInteraction(resolvedPlayResult([-1, -1]), { player: 1 }, services)

      assert.equal(mock.gtpCommands.length, 0, 'No GTP command on double pass')
    })

    it('sends no command when move is not changed (e.g. ko cancelled)', async () => {
      let { services, mock } = createServices({ whiteSyncerId: 'white-engine' })

      services.documentStore.playMove = async () => ({
        valid: true, changed: false, reason: 'ko-cancelled',
      })

      await executePlayInteraction(resolvedPlayResult([3, 3]), { player: 1 }, services)

      assert.equal(mock.gtpCommands.length, 0)
    })
  })

  describe('player context propagation', () => {
    it('null player (pre-fix bug) looks up wrong side and sends no command', async () => {
      let { services, mock } = createServices({ whiteSyncerId: 'white-engine' })

      await executePlayInteraction(resolvedPlayResult([3, 3]), {}, services)

      assert.equal(mock.gtpCommands.length, 0,
        'null player should pick black syncerId, which is null → no GTP')
    })

    it('player=1 (black moved) correctly triggers white engine', async () => {
      let { services, mock } = createServices({ whiteSyncerId: 'white-engine' })

      await executePlayInteraction(resolvedPlayResult([3, 3]), { player: 1 }, services)

      assert.equal(mock.gtpCommands.length, 1)
      assert.deepEqual(mock.gtpCommands[0].args, ['W'])
    })

    it('player=-1 (white moved) correctly triggers black engine', async () => {
      let { services, mock } = createServices({ blackSyncerId: 'black-engine' })

      await executePlayInteraction(resolvedPlayResult([4, 4]), { player: -1 }, services)

      assert.equal(mock.gtpCommands.length, 1)
      assert.deepEqual(mock.gtpCommands[0].args, ['B'])
    })
  })

  // -------------------------------------------------------------------
  // Regression: covers two bugs that caused silent GTP failure
  //   Bug 1 — sabaki.js menu called setBlackSyncerId/setWhiteSyncerId
  //           which don't exist → TypeError, syncer IDs never set.
  //           Fix: use combined setBlackWhiteSyncerIds(bId, wId).
  //   Bug 2 — executePlayMove passed empty context {} → player=null →
  //           generateReply looked up wrong side (null>0 → black) →
  //           no GTP command.  Fix: pass {player: currentPlayer}.
  // -------------------------------------------------------------------

  describe('regression: full human-vs-AI play flow', () => {
    it('end-to-end: assign engine, human plays, AI replies', async () => {
      let { services, mock } = createServices()

      // 1. No engine assigned yet — human plays, nothing happens
      await executePlayInteraction(resolvedPlayResult([3, 3]), { player: 1 }, services)
      assert.equal(mock.gtpCommands.length, 0)

      // 2. User assigns engine as white player via context menu
      //    (was broken: called setWhiteSyncerId which didn't exist)
      mock.engineService.setBlackWhiteSyncerIds(null, 'katago-w')

      assert.equal(mock.engineService.getWhiteSyncerId(), 'katago-w')
      assert.equal(mock.engineService.getBlackSyncerId(), null)

      // 3. Human plays again — genmove W should fire
      await executePlayInteraction(resolvedPlayResult([4, 4]), { player: 1 }, services)
      assert.equal(mock.gtpCommands.length, 1)
      assert.equal(mock.gtpCommands[0].name, 'genmove')
      assert.deepEqual(mock.gtpCommands[0].args, ['W'])
      assert.equal(mock.gtpCommands[0].syncerId, 'katago-w')

      // 4. AI played white, now human (black) plays again
      await executePlayInteraction(resolvedPlayResult([5, 5]), { player: 1 }, services)
      assert.equal(mock.gtpCommands.length, 2, 'Second genmove fires')
      assert.deepEqual(mock.gtpCommands[1].args, ['W'])
    })

    it('setBlackWhiteSyncerIds toggles: assign → unassign → no GTP', async () => {
      let { services, mock } = createServices({ whiteSyncerId: 'engine-w' })

      // Assigned — GTP fires
      await executePlayInteraction(resolvedPlayResult([3, 3]), { player: 1 }, services)
      assert.equal(mock.gtpCommands.length, 1)

      // Unassign via menu toggle (was setWhiteSyncerId(null), now setBlackWhiteSyncerIds)
      mock.engineService.setBlackWhiteSyncerIds(null, null)

      // Unassigned — no GTP
      await executePlayInteraction(resolvedPlayResult([4, 4]), { player: 1 }, services)
      assert.equal(mock.gtpCommands.length, 1, 'No additional GTP after unassign')
    })

    it('switching engine assignment mid-game', async () => {
      let { services, mock } = createServices({ whiteSyncerId: 'engine-a' })

      await executePlayInteraction(resolvedPlayResult([3, 3]), { player: 1 }, services)
      assert.equal(mock.gtpCommands[0].syncerId, 'engine-a')

      // Switch to different engine
      mock.engineService.setBlackWhiteSyncerIds(null, 'engine-b')

      await executePlayInteraction(resolvedPlayResult([4, 4]), { player: 1 }, services)
      assert.equal(mock.gtpCommands[1].syncerId, 'engine-b')
    })

    it('both sides have engines — black and white alternate', async () => {
      let { services, mock } = createServices({
        blackSyncerId: 'engine-b',
        whiteSyncerId: 'engine-w',
      })

      // Black (human) plays → white AI replies
      await executePlayInteraction(resolvedPlayResult([3, 3]), { player: 1 }, services)
      assert.equal(mock.gtpCommands.length, 1)
      assert.deepEqual(mock.gtpCommands[0].args, ['W'])

      // White (human) plays → black AI replies
      await executePlayInteraction(resolvedPlayResult([15, 15]), { player: -1 }, services)
      assert.equal(mock.gtpCommands.length, 2)
      assert.deepEqual(mock.gtpCommands[1].args, ['B'])
    })

    it('bug 2 regression: empty context {} with white engine → no GTP', async () => {
      // This was the silent failure: executePlayMove passed context={}
      // player=null → generateReply picks blackEngineSyncerId (wrong side)
      let { services, mock } = createServices({ whiteSyncerId: 'engine-w' })

      await executePlayInteraction(resolvedPlayResult([3, 3]), {}, services)
      assert.equal(mock.gtpCommands.length, 0,
        'Bug 2: empty context must NOT send GTP to wrong side')
    })

    it('bug 1 regression: setBlackWhiteSyncerIds is the only setter', () => {
      let { engineService: es } = createMockEngineService()

      // Verify no setBlackSyncerId / setWhiteSyncerId methods exist
      assert.equal(typeof es.setBlackSyncerId, 'undefined',
        'setBlackSyncerId must not exist — use setBlackWhiteSyncerIds')
      assert.equal(typeof es.setWhiteSyncerId, 'undefined',
        'setWhiteSyncerId must not exist — use setBlackWhiteSyncerIds')

      // Combined setter works
      assert.equal(typeof es.setBlackWhiteSyncerIds, 'function')
      es.setBlackWhiteSyncerIds('b', 'w')
      assert.equal(es.getBlackSyncerId(), 'b')
      assert.equal(es.getWhiteSyncerId(), 'w')
    })
  })
})
