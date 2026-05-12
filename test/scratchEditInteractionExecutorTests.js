import assert from 'assert'

import {
  BOARD_INTENTS,
  RESOLVE_STATUSES,
  executeBoardInteraction,
  executeScratchEdit,
} from '../src/modules/workbench/board-interactions/index.ts'

import {
  MUTATION_CONTRACTS,
  createScratchEditExecutionContext,
} from '../src/modules/workbench/contracts/index.ts'

import {
  createWorkingPosition,
} from '../src/modules/workbench/working-position/index.js'

// --- Helpers ---

function emptySignMap(w, h) {
  return Array.from({length: h}, () => Array(w).fill(0))
}

function makeSnapshot(id, signMap, nextPlayer = 1) {
  return createWorkingPosition({
    id,
    width: signMap[0].length,
    height: signMap.length,
    signMap,
    nextPlayer,
  })
}

function makeEditContext(activeTab = 'current', currentSignMap = null, referenceSignMap = null, nextPlayer = 1) {
  let current = currentSignMap
    ? makeSnapshot('snap-current', currentSignMap, nextPlayer)
    : null
  let reference = referenceSignMap
    ? makeSnapshot('snap-reference', referenceSignMap, nextPlayer)
    : null
  return {activeTab, currentSnapshot: current, referenceSnapshot: reference}
}

function resolvedResult(intent, payload, contract = MUTATION_CONTRACTS.SCRATCH_EDIT) {
  return {
    intent,
    status: RESOLVE_STATUSES.RESOLVED,
    mutationContract: contract,
    positionSource: {kind: 'scratch', snapshotId: 'snap-current'},
    payload,
  }
}

function deferredResult(intent) {
  return {
    intent,
    status: RESOLVE_STATUSES.DEFERRED,
    mutationContract: null,
    positionSource: null,
    reason: 'deferred',
  }
}

function rejectedResult(reason) {
  return {
    intent: BOARD_INTENTS.NOOP,
    status: RESOLVE_STATUSES.REJECTED,
    mutationContract: MUTATION_CONTRACTS.SCRATCH_EDIT,
    positionSource: {kind: 'scratch', snapshotId: 'snap-current'},
    reason,
  }
}

function trackDeps() {
  let calls = {invalidate: 0, schedule: []}
  return {
    deps: {
      invalidateEditAnalysis() { calls.invalidate++ },
      scheduleEditWorkspaceAnalysis(tab) { calls.schedule.push(tab) },
    },
    calls,
  }
}

// --- createScratchEditExecutionContext tests ---

describe('createScratchEditExecutionContext', () => {
  it('extracts context from a full editWorkspace', () => {
    let current = makeSnapshot('snap-1', emptySignMap(3, 3))
    let reference = makeSnapshot('snap-2', emptySignMap(3, 3))
    let ctx = createScratchEditExecutionContext({
      activeTab: 'reference',
      currentSnapshot: current,
      referenceSnapshot: reference,
    })

    assert.ok(ctx)
    assert.equal(ctx.activeTab, 'reference')
    assert.equal(ctx.currentSnapshot, current)
    assert.equal(ctx.referenceSnapshot, reference)
  })

  it('returns null for null input', () => {
    assert.equal(createScratchEditExecutionContext(null), null)
  })

  it('returns null for undefined input', () => {
    assert.equal(createScratchEditExecutionContext(undefined), null)
  })

  it('defaults activeTab to current', () => {
    let ctx = createScratchEditExecutionContext({
      currentSnapshot: makeSnapshot('snap-1', emptySignMap(3, 3)),
    })
    assert.equal(ctx.activeTab, 'current')
  })

  it('normalizes missing snapshots to null', () => {
    let ctx = createScratchEditExecutionContext({activeTab: 'current'})
    assert.equal(ctx.currentSnapshot, null)
    assert.equal(ctx.referenceSnapshot, null)
  })

  it('preserves snapshot fields', () => {
    let snapshot = createWorkingPosition({
      id: 'snap-full',
      width: 9,
      height: 9,
      signMap: emptySignMap(9, 9),
      nextPlayer: -1,
      role: 'current',
      komi: 7.5,
      rules: 'Chinese',
      source: {type: 'game-tree-node', id: 'node-1'},
    })
    let ctx = createScratchEditExecutionContext({
      activeTab: 'current',
      currentSnapshot: snapshot,
    })

    assert.equal(ctx.currentSnapshot.id, 'snap-full')
    assert.equal(ctx.currentSnapshot.nextPlayer, -1)
    assert.equal(ctx.currentSnapshot.role, 'current')
    assert.equal(ctx.currentSnapshot.komi, 7.5)
    assert.equal(ctx.currentSnapshot.rules, 'Chinese')
    assert.deepEqual(ctx.currentSnapshot.source, {type: 'game-tree-node', id: 'node-1'})
  })

  it('context is compatible with executor input', () => {
    let snapshot = makeSnapshot('snap-exec', emptySignMap(3, 3))
    let ctx = createScratchEditExecutionContext({
      activeTab: 'current',
      currentSnapshot: snapshot,
    })

    let exec = executeScratchEdit(
      resolvedResult(
        BOARD_INTENTS.PLACE_BLACK_STONE,
        {sign: 1, action: 'place', vertex: [1, 1]},
      ),
      ctx,
    )

    assert.equal(exec.handled, true)
    assert.equal(exec.changed, true)
    assert.equal(exec.snapshot.signMap[1][1], 1)
  })
})

// --- Router tests ---

describe('executeBoardInteraction (router)', () => {
  it('no-ops rejected results', () => {
    let context = makeEditContext('current', emptySignMap(3, 3))
    let exec = executeBoardInteraction(
      rejectedResult('occupied'),
      context,
    )
    assert.equal(exec.handled, false)
    assert.equal(exec.changed, false)
  })

  it('no-ops deferred results', () => {
    let context = makeEditContext('current', emptySignMap(3, 3))
    let exec = executeBoardInteraction(
      deferredResult(BOARD_INTENTS.LEGACY_SGF_EDIT),
      context,
    )
    assert.equal(exec.handled, false)
    assert.equal(exec.changed, false)
  })

  it('no-ops results with no contract', () => {
    let exec = executeBoardInteraction(
      {
        intent: BOARD_INTENTS.PLAY_STONE,
        status: RESOLVE_STATUSES.RESOLVED,
        mutationContract: null,
        positionSource: {kind: 'game-tree', treePosition: 'n1'},
        payload: {vertex: [3, 3]},
      },
      makeEditContext('current', emptySignMap(9, 9)),
    )
    assert.equal(exec.handled, false)
    assert.equal(exec.changed, false)
  })

  it('no-ops unsupported contracts (playMove)', () => {
    let exec = executeBoardInteraction(
      resolvedResult(
        BOARD_INTENTS.PLAY_STONE,
        {vertex: [3, 3]},
        MUTATION_CONTRACTS.PLAY_MOVE,
      ),
      makeEditContext('current', emptySignMap(9, 9)),
    )
    assert.equal(exec.handled, false)
    assert.ok(exec.reason.includes('unsupported contract'))
  })

  it('routes scratchEdit contract to executor', () => {
    let context = makeEditContext('current', emptySignMap(3, 3))
    let exec = executeBoardInteraction(
      resolvedResult(
        BOARD_INTENTS.PLACE_BLACK_STONE,
        {sign: 1, action: 'place', vertex: [1, 1]},
      ),
      context,
    )
    assert.equal(exec.handled, true)
    assert.equal(exec.changed, true)
    assert.equal(exec.snapshot.signMap[1][1], 1)
  })
})

// --- Executor tests ---

describe('executeScratchEdit', () => {
  describe('black stone placement', () => {
    it('places black stone on empty point', () => {
      let context = makeEditContext('current', emptySignMap(3, 3))
      let {deps, calls} = trackDeps()

      let exec = executeScratchEdit(
        resolvedResult(
          BOARD_INTENTS.PLACE_BLACK_STONE,
          {sign: 1, action: 'place', vertex: [1, 1]},
        ),
        context,
        deps,
      )

      assert.equal(exec.handled, true)
      assert.equal(exec.changed, true)
      assert.equal(exec.snapshot.signMap[1][1], 1)
      assert.equal(exec.tab, 'current')
      assert.equal(calls.invalidate, 1)
      assert.deepEqual(calls.schedule, ['current'])
    })

    it('removes same-color black stone (toggle)', () => {
      let signMap = emptySignMap(3, 3)
      signMap[1][1] = 1
      let context = makeEditContext('current', signMap)

      let exec = executeScratchEdit(
        resolvedResult(
          BOARD_INTENTS.PLACE_BLACK_STONE,
          {sign: 1, action: 'remove', vertex: [1, 1]},
        ),
        context,
      )

      assert.equal(exec.changed, true)
      assert.equal(exec.snapshot.signMap[1][1], 0)
    })

    it('places black stone over white stone', () => {
      let signMap = emptySignMap(3, 3)
      signMap[1][1] = -1
      let context = makeEditContext('current', signMap)

      let exec = executeScratchEdit(
        resolvedResult(
          BOARD_INTENTS.PLACE_BLACK_STONE,
          {sign: 1, action: 'place', vertex: [1, 1]},
        ),
        context,
      )

      assert.equal(exec.changed, true)
      assert.equal(exec.snapshot.signMap[1][1], 1)
    })
  })

  describe('white stone placement', () => {
    it('places white stone on empty point', () => {
      let context = makeEditContext('current', emptySignMap(3, 3))

      let exec = executeScratchEdit(
        resolvedResult(
          BOARD_INTENTS.PLACE_WHITE_STONE,
          {sign: -1, action: 'place', vertex: [0, 0]},
        ),
        context,
      )

      assert.equal(exec.changed, true)
      assert.equal(exec.snapshot.signMap[0][0], -1)
    })

    it('removes same-color white stone (toggle)', () => {
      let signMap = emptySignMap(3, 3)
      signMap[2][2] = -1
      let context = makeEditContext('current', signMap)

      let exec = executeScratchEdit(
        resolvedResult(
          BOARD_INTENTS.PLACE_WHITE_STONE,
          {sign: -1, action: 'remove', vertex: [2, 2]},
        ),
        context,
      )

      assert.equal(exec.changed, true)
      assert.equal(exec.snapshot.signMap[2][2], 0)
    })

    it('places white stone over black stone', () => {
      let signMap = emptySignMap(3, 3)
      signMap[0][0] = 1
      let context = makeEditContext('current', signMap)

      let exec = executeScratchEdit(
        resolvedResult(
          BOARD_INTENTS.PLACE_WHITE_STONE,
          {sign: -1, action: 'place', vertex: [0, 0]},
        ),
        context,
      )

      assert.equal(exec.changed, true)
      assert.equal(exec.snapshot.signMap[0][0], -1)
    })
  })

  describe('erase tool', () => {
    it('clears a stone', () => {
      let signMap = emptySignMap(3, 3)
      signMap[1][1] = 1
      let context = makeEditContext('current', signMap)

      let exec = executeScratchEdit(
        resolvedResult(BOARD_INTENTS.ERASE_STONE, {vertex: [1, 1]}),
        context,
      )

      assert.equal(exec.changed, true)
      assert.equal(exec.snapshot.signMap[1][1], 0)
    })

    it('no-ops on already-empty point', () => {
      let context = makeEditContext('current', emptySignMap(3, 3))

      let exec = executeScratchEdit(
        resolvedResult(BOARD_INTENTS.ERASE_STONE, {vertex: [0, 0]}),
        context,
      )

      assert.equal(exec.handled, true)
      assert.equal(exec.changed, false)
      assert.ok(exec.reason.includes('already empty'))
    })
  })

  describe('play tool (scratch)', () => {
    it('places stone using nextPlayer and flips it', () => {
      let context = makeEditContext('current', emptySignMap(3, 3), null, 1)

      let exec = executeScratchEdit(
        resolvedResult(BOARD_INTENTS.PLAY_STONE, {vertex: [1, 1]}),
        context,
      )

      assert.equal(exec.changed, true)
      assert.equal(exec.snapshot.signMap[1][1], 1, 'placed black (nextPlayer was 1)')
      assert.equal(exec.snapshot.nextPlayer, -1, 'flipped to white')
    })

    it('places white when nextPlayer is -1', () => {
      let context = makeEditContext('current', emptySignMap(3, 3), null, -1)

      let exec = executeScratchEdit(
        resolvedResult(BOARD_INTENTS.PLAY_STONE, {vertex: [2, 2]}),
        context,
      )

      assert.equal(exec.snapshot.signMap[2][2], -1, 'placed white')
      assert.equal(exec.snapshot.nextPlayer, 1, 'flipped to black')
    })

    it('refuses occupied point', () => {
      let signMap = emptySignMap(3, 3)
      signMap[1][1] = 1
      let context = makeEditContext('current', signMap, null, 1)

      let exec = executeScratchEdit(
        resolvedResult(BOARD_INTENTS.PLAY_STONE, {vertex: [1, 1]}),
        context,
      )

      assert.equal(exec.handled, true)
      assert.equal(exec.changed, false)
      assert.ok(exec.reason.includes('occupied'))
    })
  })

  describe('reference tab isolation', () => {
    it('edits reference snapshot without touching current', () => {
      let currentSignMap = emptySignMap(3, 3)
      let refSignMap = emptySignMap(3, 3)
      let context = makeEditContext('reference', currentSignMap, refSignMap)

      let exec = executeScratchEdit(
        resolvedResult(
          BOARD_INTENTS.PLACE_BLACK_STONE,
          {sign: 1, action: 'place', vertex: [0, 0]},
        ),
        context,
      )

      assert.equal(exec.tab, 'reference')
      assert.equal(exec.snapshot.signMap[0][0], 1)
      assert.equal(context.currentSnapshot.signMap[0][0], 0)
    })
  })

  describe('unsupported intents for Phase 4', () => {
    it('marker intent is not handled', () => {
      let context = makeEditContext('current', emptySignMap(3, 3))
      let exec = executeScratchEdit(
        resolvedResult(BOARD_INTENTS.MARK_POINT, {markerType: 'cross', vertex: [0, 0]}),
        context,
      )
      assert.equal(exec.handled, false)
      assert.ok(exec.reason.includes('unsupported intent'))
    })

    it('line intent is not handled', () => {
      let context = makeEditContext('current', emptySignMap(3, 3))
      let exec = executeScratchEdit(
        resolvedResult(BOARD_INTENTS.DRAW_LINE, {lineType: 'arrow', vertex: [0, 0]}),
        context,
      )
      assert.equal(exec.handled, false)
    })

    it('recall intent is not handled', () => {
      let context = makeEditContext('current', emptySignMap(3, 3))
      let exec = executeScratchEdit(
        resolvedResult(BOARD_INTENTS.SUBMIT_RECALL_ANSWER, {vertex: [0, 0]}),
        context,
      )
      assert.equal(exec.handled, false)
    })

    it('legacy intents are not handled', () => {
      let context = makeEditContext('current', emptySignMap(3, 3))
      for (let intent of [
        BOARD_INTENTS.LEGACY_TOGGLE_DEAD_STONES,
        BOARD_INTENTS.LEGACY_FIND_MOVE,
        BOARD_INTENTS.LEGACY_SGF_EDIT,
      ]) {
        let exec = executeScratchEdit(
          resolvedResult(intent, {vertex: [0, 0]}),
          context,
        )
        assert.equal(exec.handled, false, `expected not handled for ${intent}`)
      }
    })
  })

  describe('context without snapshot', () => {
    it('returns not handled when active tab has no snapshot', () => {
      let context = {activeTab: 'current', currentSnapshot: null, referenceSnapshot: null}
      let exec = executeScratchEdit(
        resolvedResult(
          BOARD_INTENTS.PLACE_BLACK_STONE,
          {sign: 1, action: 'place', vertex: [0, 0]},
        ),
        context,
      )
      assert.equal(exec.handled, false)
      assert.ok(exec.reason.includes('no active snapshot'))
    })
  })

  describe('state preservation guarantees', () => {
    it('does not mutate the original snapshot', () => {
      let signMap = emptySignMap(3, 3)
      let context = makeEditContext('current', signMap)

      let original = context.currentSnapshot
      executeScratchEdit(
        resolvedResult(
          BOARD_INTENTS.PLACE_BLACK_STONE,
          {sign: 1, action: 'place', vertex: [1, 1]},
        ),
        context,
      )

      assert.equal(original.signMap[1][1], 0, 'original snapshot must not be mutated')
    })

    it('preserves metadata (id, role, komi, rules)', () => {
      let snapshot = createWorkingPosition({
        id: 'meta-test',
        width: 3,
        height: 3,
        signMap: emptySignMap(3, 3),
        nextPlayer: 1,
        role: 'current',
        komi: 7.5,
        rules: 'Chinese',
        source: {type: 'manual'},
      })
      let context = {activeTab: 'current', currentSnapshot: snapshot, referenceSnapshot: null}

      let exec = executeScratchEdit(
        resolvedResult(
          BOARD_INTENTS.PLACE_BLACK_STONE,
          {sign: 1, action: 'place', vertex: [1, 1]},
        ),
        context,
      )

      assert.equal(exec.snapshot.id, 'meta-test')
      assert.equal(exec.snapshot.role, 'current')
      assert.equal(exec.snapshot.komi, 7.5)
      assert.equal(exec.snapshot.rules, 'Chinese')
      assert.deepEqual(exec.snapshot.source, {type: 'manual'})
    })

    it('does not call deps when snapshot is missing', () => {
      let {deps, calls} = trackDeps()
      let context = {activeTab: 'current', currentSnapshot: null, referenceSnapshot: null}

      executeScratchEdit(
        resolvedResult(
          BOARD_INTENTS.PLACE_BLACK_STONE,
          {sign: 1, action: 'place', vertex: [0, 0]},
        ),
        context,
        deps,
      )

      assert.equal(calls.invalidate, 0)
      assert.deepEqual(calls.schedule, [])
    })

    it('does not call deps when erase finds nothing to erase', () => {
      let {deps, calls} = trackDeps()
      let context = makeEditContext('current', emptySignMap(3, 3))

      executeScratchEdit(
        resolvedResult(BOARD_INTENTS.ERASE_STONE, {vertex: [0, 0]}),
        context,
        deps,
      )

      assert.equal(calls.invalidate, 0)
      assert.deepEqual(calls.schedule, [])
    })
  })

  describe('dep injection', () => {
    it('calls both deps on successful write', () => {
      let {deps, calls} = trackDeps()
      let context = makeEditContext('current', emptySignMap(3, 3))

      executeScratchEdit(
        resolvedResult(
          BOARD_INTENTS.PLACE_BLACK_STONE,
          {sign: 1, action: 'place', vertex: [1, 1]},
        ),
        context,
        deps,
      )

      assert.equal(calls.invalidate, 1)
      assert.deepEqual(calls.schedule, ['current'])
    })

    it('calls scheduleEditWorkspaceAnalysis with reference tab', () => {
      let {deps, calls} = trackDeps()
      let context = makeEditContext('reference', emptySignMap(3, 3), emptySignMap(3, 3))

      executeScratchEdit(
        resolvedResult(
          BOARD_INTENTS.PLACE_WHITE_STONE,
          {sign: -1, action: 'place', vertex: [0, 0]},
        ),
        context,
        deps,
      )

      assert.deepEqual(calls.schedule, ['reference'])
    })

    it('tolerates missing deps', () => {
      let context = makeEditContext('current', emptySignMap(3, 3))
      let exec = executeScratchEdit(
        resolvedResult(
          BOARD_INTENTS.PLACE_BLACK_STONE,
          {sign: 1, action: 'place', vertex: [1, 1]},
        ),
        context,
      )
      assert.equal(exec.changed, true)
    })
  })
})
