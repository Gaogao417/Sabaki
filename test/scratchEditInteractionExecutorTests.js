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
  toggleMarker,
  toggleCoordLabel,
  toggleNumberLabel,
  setLabelMarker,
  createEmptyMarkerMap,
  addLine,
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

function emptyMarkerMap(w, h) {
  return createEmptyMarkerMap(w, h)
}

function makeEditContext(
  activeTab = 'current',
  currentSignMap = null,
  referenceSignMap = null,
  nextPlayer = 1,
  extras = {},
) {
  let current = currentSignMap
    ? makeSnapshot('snap-current', currentSignMap, nextPlayer)
    : null
  let reference = referenceSignMap
    ? makeSnapshot('snap-reference', referenceSignMap, nextPlayer)
    : null
  let w = currentSignMap ? currentSignMap[0].length : 3
  let h = currentSignMap ? currentSignMap.length : 3
  return {
    activeTab,
    currentSnapshot: current,
    referenceSnapshot: reference,
    currentMarkerMap: emptyMarkerMap(w, h),
    referenceMarkerMap: referenceSignMap ? emptyMarkerMap(w, h) : null,
    currentLines: [],
    referenceLines: [],
    lineFirstVertex: null,
    ...extras,
  }
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

  it('includes marker and line fields', () => {
    let markers = emptyMarkerMap(3, 3)
    let lines = [{v1: [0, 0], v2: [1, 1], type: 'arrow'}]
    let ctx = createScratchEditExecutionContext({
      activeTab: 'current',
      currentSnapshot: makeSnapshot('snap-1', emptySignMap(3, 3)),
      currentMarkerMap: markers,
      currentLines: lines,
    })
    assert.deepEqual(ctx.currentMarkerMap, markers)
    assert.deepEqual(ctx.currentLines, lines)
  })

  it('defaults marker and line fields to null', () => {
    let ctx = createScratchEditExecutionContext({
      activeTab: 'current',
      currentSnapshot: makeSnapshot('snap-1', emptySignMap(3, 3)),
    })
    assert.equal(ctx.currentMarkerMap, null)
    assert.equal(ctx.referenceMarkerMap, null)
    assert.equal(ctx.currentLines, null)
    assert.equal(ctx.referenceLines, null)
    assert.equal(ctx.lineFirstVertex, null)
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

// --- Executor tests (Phase 4 stone intents) ---

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

// --- Phase 7: Drag stone executor ---

describe('executeScratchEdit (drag-stone)', () => {
  it('moves a stone from source to target', () => {
    let signMap = emptySignMap(5, 5)
    signMap[1][1] = 1
    let context = makeEditContext('current', signMap)

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.DRAG_STONE, {
        source: [1, 1],
        target: [2, 2],
        vertex: [2, 2],
      }),
      context,
    )

    assert.equal(exec.changed, true)
    assert.equal(exec.snapshot.signMap[1][1], 0, 'source cleared')
    assert.equal(exec.snapshot.signMap[2][2], 1, 'target filled')
  })

  it('no-ops when source is empty', () => {
    let context = makeEditContext('current', emptySignMap(3, 3))

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.DRAG_STONE, {
        source: [0, 0],
        target: [1, 1],
        vertex: [1, 1],
      }),
      context,
    )

    assert.equal(exec.changed, false)
    assert.ok(exec.reason.includes('empty source'))
  })

  it('no-ops when target is occupied', () => {
    let signMap = emptySignMap(3, 3)
    signMap[0][0] = 1
    signMap[1][1] = -1
    let context = makeEditContext('current', signMap)

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.DRAG_STONE, {
        source: [0, 0],
        target: [1, 1],
        vertex: [1, 1],
      }),
      context,
    )

    assert.equal(exec.changed, false)
    assert.ok(exec.reason.includes('occupied target'))
  })

  it('no-ops when source equals target', () => {
    let signMap = emptySignMap(3, 3)
    signMap[1][1] = 1
    let context = makeEditContext('current', signMap)

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.DRAG_STONE, {
        source: [1, 1],
        target: [1, 1],
        vertex: [1, 1],
      }),
      context,
    )

    assert.equal(exec.changed, false)
    assert.ok(exec.reason.includes('same source and target'))
  })
})

// --- Phase 7: Marker executor ---

describe('executeScratchEdit (mark-point)', () => {
  it('toggles a cross marker on empty point', () => {
    let context = makeEditContext('current', emptySignMap(3, 3))

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.MARK_POINT, {
        markerType: 'cross',
        vertex: [1, 1],
      }),
      context,
    )

    assert.equal(exec.handled, true)
    assert.equal(exec.changed, true)
    assert.equal(exec.markerMap[1][1].type, 'cross')
  })

  it('toggles off an existing cross marker', () => {
    let markers = emptyMarkerMap(3, 3)
    markers[1][1] = {type: 'cross'}
    let context = makeEditContext('current', emptySignMap(3, 3), null, 1, {
      currentMarkerMap: markers,
    })

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.MARK_POINT, {
        markerType: 'cross',
        vertex: [1, 1],
      }),
      context,
    )

    assert.equal(exec.handled, true)
    assert.equal(exec.changed, true)
    assert.equal(exec.markerMap[1][1], null)
  })

  it('replaces triangle with cross (different marker type)', () => {
    let markers = emptyMarkerMap(3, 3)
    markers[0][0] = {type: 'triangle'}
    let context = makeEditContext('current', emptySignMap(3, 3), null, 1, {
      currentMarkerMap: markers,
    })

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.MARK_POINT, {
        markerType: 'cross',
        vertex: [0, 0],
      }),
      context,
    )

    assert.equal(exec.markerMap[0][0].type, 'cross')
  })

  it('places triangle, square, and circle markers', () => {
    let context = makeEditContext('current', emptySignMap(3, 3))

    for (let type of ['triangle', 'square', 'circle']) {
      let exec = executeScratchEdit(
        resolvedResult(BOARD_INTENTS.MARK_POINT, {
          markerType: type,
          vertex: [1, 1],
        }),
        context,
      )
      assert.equal(exec.markerMap[1][1].type, type)
    }
  })

  it('places coordinate label for label tool', () => {
    let context = makeEditContext('current', emptySignMap(9, 9))

    // Vertex [2, 3] on a 9x9 board => column C, row 6 => "C6"
    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.MARK_POINT, {
        markerType: 'label',
        vertex: [2, 3],
      }),
      context,
    )

    assert.equal(exec.markerMap[3][2].type, 'label')
    assert.equal(exec.markerMap[3][2].label, 'C6')
  })

  it('toggles off existing coord label', () => {
    let markers = emptyMarkerMap(9, 9)
    markers[3][2] = {type: 'label', label: 'C6'}
    let context = makeEditContext('current', emptySignMap(9, 9), null, 1, {
      currentMarkerMap: markers,
    })

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.MARK_POINT, {
        markerType: 'label',
        vertex: [2, 3],
      }),
      context,
    )

    assert.equal(exec.markerMap[3][2], null)
  })

  it('places sequential number markers', () => {
    let context = makeEditContext('current', emptySignMap(3, 3))

    let exec1 = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.MARK_POINT, {
        markerType: 'number',
        vertex: [0, 0],
      }),
      context,
    )
    assert.equal(exec1.markerMap[0][0].type, 'label')
    assert.equal(exec1.markerMap[0][0].label, '1')

    // Second number should be 2 — use updated markerMap from exec1
    let context2 = {
      ...context,
      currentMarkerMap: exec1.markerMap,
    }
    let exec2 = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.MARK_POINT, {
        markerType: 'number',
        vertex: [1, 0],
      }),
      context2,
    )
    assert.equal(exec2.markerMap[0][1].label, '2')
  })

  it('toggles off existing number marker', () => {
    let markers = emptyMarkerMap(3, 3)
    markers[0][0] = {type: 'label', label: '5'}
    let context = makeEditContext('current', emptySignMap(3, 3), null, 1, {
      currentMarkerMap: markers,
    })

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.MARK_POINT, {
        markerType: 'number',
        vertex: [0, 0],
      }),
      context,
    )

    assert.equal(exec.markerMap[0][0], null)
  })

  it('places custom label via setLabelMarker', () => {
    let context = makeEditContext('current', emptySignMap(3, 3))

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.MARK_POINT, {
        markerType: 'label',
        vertex: [1, 1],
        label: 'custom',
      }),
      context,
    )

    assert.equal(exec.markerMap[1][1].type, 'label')
    assert.equal(exec.markerMap[1][1].label, 'custom')
  })

  it('returns not handled when marker map is null', () => {
    let context = makeEditContext('current', emptySignMap(3, 3))
    context.currentMarkerMap = null

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.MARK_POINT, {
        markerType: 'cross',
        vertex: [0, 0],
      }),
      context,
    )

    assert.equal(exec.handled, false)
    assert.ok(exec.reason.includes('no marker map'))
  })

  it('does not invalidate analysis (markers do not affect board)', () => {
    let {deps, calls} = trackDeps()
    let context = makeEditContext('current', emptySignMap(3, 3))

    executeScratchEdit(
      resolvedResult(BOARD_INTENTS.MARK_POINT, {
        markerType: 'cross',
        vertex: [0, 0],
      }),
      context,
      deps,
    )

    assert.equal(calls.invalidate, 0)
    assert.deepEqual(calls.schedule, [])
  })

  it('works on reference tab', () => {
    let context = makeEditContext('reference', emptySignMap(3, 3), emptySignMap(3, 3))

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.MARK_POINT, {
        markerType: 'triangle',
        vertex: [0, 0],
      }),
      context,
    )

    assert.equal(exec.tab, 'reference')
    assert.equal(exec.markerMap[0][0].type, 'triangle')
  })

  it('does not mutate the original marker map', () => {
    let markers = emptyMarkerMap(3, 3)
    let context = makeEditContext('current', emptySignMap(3, 3), null, 1, {
      currentMarkerMap: markers,
    })

    executeScratchEdit(
      resolvedResult(BOARD_INTENTS.MARK_POINT, {
        markerType: 'cross',
        vertex: [1, 1],
      }),
      context,
    )

    assert.equal(markers[1][1], null, 'original marker map must not be mutated')
  })
})

// --- Phase 7: Line/Arrow executor ---

describe('executeScratchEdit (draw-line)', () => {
  it('stores first vertex on first click', () => {
    let context = makeEditContext('current', emptySignMap(3, 3))

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.DRAW_LINE, {
        lineType: 'line',
        vertex: [0, 0],
      }),
      context,
    )

    assert.equal(exec.handled, true)
    assert.equal(exec.changed, false, 'no line drawn yet')
    assert.deepEqual(exec.lineFirstVertex, {type: 'line', vertex: [0, 0]})
  })

  it('completes line on second click', () => {
    let context = makeEditContext('current', emptySignMap(3, 3), null, 1, {
      lineFirstVertex: {type: 'line', vertex: [0, 0]},
    })

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.DRAW_LINE, {
        lineType: 'line',
        vertex: [2, 2],
      }),
      context,
    )

    assert.equal(exec.handled, true)
    assert.equal(exec.changed, true)
    assert.equal(exec.lines.length, 1)
    assert.deepEqual(exec.lines[0].v1, [0, 0])
    assert.deepEqual(exec.lines[0].v2, [2, 2])
    assert.equal(exec.lines[0].type, 'line')
    assert.equal(exec.lineFirstVertex, null)
  })

  it('draws arrow type', () => {
    let context = makeEditContext('current', emptySignMap(3, 3), null, 1, {
      lineFirstVertex: {type: 'arrow', vertex: [1, 1]},
    })

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.DRAW_LINE, {
        lineType: 'arrow',
        vertex: [2, 1],
      }),
      context,
    )

    assert.equal(exec.changed, true)
    assert.equal(exec.lines[0].type, 'arrow')
  })

  it('resets first vertex when line type changes', () => {
    let context = makeEditContext('current', emptySignMap(3, 3), null, 1, {
      lineFirstVertex: {type: 'line', vertex: [0, 0]},
    })

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.DRAW_LINE, {
        lineType: 'arrow',
        vertex: [1, 1],
      }),
      context,
    )

    assert.equal(exec.changed, false)
    assert.deepEqual(exec.lineFirstVertex, {type: 'arrow', vertex: [1, 1]})
  })

  it('appends to existing lines', () => {
    let existing = [{v1: [0, 0], v2: [1, 1], type: 'line'}]
    let context = makeEditContext('current', emptySignMap(3, 3), null, 1, {
      currentLines: existing,
      lineFirstVertex: {type: 'line', vertex: [2, 0]},
    })

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.DRAW_LINE, {
        lineType: 'line',
        vertex: [2, 2],
      }),
      context,
    )

    assert.equal(exec.lines.length, 2)
    assert.deepEqual(exec.lines[0], existing[0])
    assert.deepEqual(exec.lines[1].v1, [2, 0])
  })

  it('does not invalidate analysis (lines do not affect board)', () => {
    let {deps, calls} = trackDeps()
    let context = makeEditContext('current', emptySignMap(3, 3), null, 1, {
      lineFirstVertex: {type: 'line', vertex: [0, 0]},
    })

    executeScratchEdit(
      resolvedResult(BOARD_INTENTS.DRAW_LINE, {
        lineType: 'line',
        vertex: [1, 1],
      }),
      context,
      deps,
    )

    assert.equal(calls.invalidate, 0)
    assert.deepEqual(calls.schedule, [])
  })

  it('works on reference tab', () => {
    let context = makeEditContext('reference', emptySignMap(3, 3), emptySignMap(3, 3), 1, {
      lineFirstVertex: {type: 'arrow', vertex: [0, 0]},
    })

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.DRAW_LINE, {
        lineType: 'arrow',
        vertex: [2, 2],
      }),
      context,
    )

    assert.equal(exec.tab, 'reference')
    assert.equal(exec.lines.length, 1)
    assert.equal(exec.lines[0].type, 'arrow')
  })

  it('does not mutate original lines array', () => {
    let existing = [{v1: [0, 0], v2: [1, 1], type: 'line'}]
    let context = makeEditContext('current', emptySignMap(3, 3), null, 1, {
      currentLines: existing,
      lineFirstVertex: {type: 'line', vertex: [2, 0]},
    })

    executeScratchEdit(
      resolvedResult(BOARD_INTENTS.DRAW_LINE, {
        lineType: 'line',
        vertex: [2, 2],
      }),
      context,
    )

    assert.equal(existing.length, 1, 'original lines array must not be mutated')
  })
})

// --- Phase 7: Set next player ---

describe('executeScratchEdit (set-next-player)', () => {
  it('sets next player to black', () => {
    let context = makeEditContext('current', emptySignMap(3, 3), null, -1)

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.SET_NEXT_PLAYER, {sign: 1}),
      context,
    )

    assert.equal(exec.handled, true)
    assert.equal(exec.changed, true)
    assert.equal(exec.snapshot.nextPlayer, 1)
  })

  it('sets next player to white', () => {
    let context = makeEditContext('current', emptySignMap(3, 3), null, 1)

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.SET_NEXT_PLAYER, {sign: -1}),
      context,
    )

    assert.equal(exec.snapshot.nextPlayer, -1)
  })

  it('normalizes sign values', () => {
    let context = makeEditContext('current', emptySignMap(3, 3))

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.SET_NEXT_PLAYER, {sign: 5}),
      context,
    )

    assert.equal(exec.snapshot.nextPlayer, 1)
  })

  it('invalidates analysis and reschedules', () => {
    let {deps, calls} = trackDeps()
    let context = makeEditContext('current', emptySignMap(3, 3))

    executeScratchEdit(
      resolvedResult(BOARD_INTENTS.SET_NEXT_PLAYER, {sign: -1}),
      context,
      deps,
    )

    assert.equal(calls.invalidate, 1)
    assert.deepEqual(calls.schedule, ['current'])
  })

  it('fails when no active snapshot', () => {
    let context = {activeTab: 'current', currentSnapshot: null, referenceSnapshot: null}

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.SET_NEXT_PLAYER, {sign: 1}),
      context,
    )

    assert.equal(exec.handled, false)
    assert.ok(exec.reason.includes('no active snapshot'))
  })
})

// --- Phase 7: Capture reference ---

describe('executeScratchEdit (capture-reference)', () => {
  it('captures current to reference', () => {
    let signMap = emptySignMap(3, 3)
    signMap[0][0] = 1
    let context = makeEditContext('current', signMap)

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.CAPTURE_REFERENCE, {}),
      context,
    )

    assert.equal(exec.handled, true)
    assert.equal(exec.changed, true)
    assert.equal(exec.tab, 'reference', 'target tab is reference')
    assert.ok(exec.capturedSnapshot)
    assert.equal(exec.capturedSnapshot.signMap[0][0], 1)
  })

  it('captures reference to current when on reference tab', () => {
    let refSignMap = emptySignMap(3, 3)
    refSignMap[1][1] = -1
    let context = makeEditContext('reference', emptySignMap(3, 3), refSignMap)

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.CAPTURE_REFERENCE, {}),
      context,
    )

    assert.equal(exec.tab, 'current', 'target tab is current')
    assert.equal(exec.capturedSnapshot.signMap[1][1], -1)
  })

  it('fails when no source snapshot', () => {
    let context = makeEditContext('current', null)

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.CAPTURE_REFERENCE, {}),
      context,
    )

    assert.equal(exec.handled, false)
    assert.ok(exec.reason.includes('no source snapshot'))
  })

  it('schedules analysis on target tab', () => {
    let {deps, calls} = trackDeps()
    let context = makeEditContext('current', emptySignMap(3, 3))

    executeScratchEdit(
      resolvedResult(BOARD_INTENTS.CAPTURE_REFERENCE, {}),
      context,
      deps,
    )

    assert.deepEqual(calls.schedule, ['reference'])
  })
})

// --- Phase 7: Toggle tab ---

describe('executeScratchEdit (toggle-tab)', () => {
  it('switches to reference tab', () => {
    let context = makeEditContext('current', emptySignMap(3, 3), emptySignMap(3, 3))

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.TOGGLE_TAB, {tab: 'reference'}),
      context,
    )

    assert.equal(exec.handled, true)
    assert.equal(exec.changed, true)
    assert.equal(exec.newTab, 'reference')
    assert.equal(exec.tab, 'reference')
  })

  it('switches to current tab', () => {
    let context = makeEditContext('reference', emptySignMap(3, 3), emptySignMap(3, 3))

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.TOGGLE_TAB, {tab: 'current'}),
      context,
    )

    assert.equal(exec.newTab, 'current')
  })

  it('fails when reference snapshot is missing', () => {
    let context = makeEditContext('current', emptySignMap(3, 3), null)

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.TOGGLE_TAB, {tab: 'reference'}),
      context,
    )

    assert.equal(exec.handled, false)
    assert.ok(exec.reason.includes('no reference snapshot'))
  })

  it('fails for invalid tab', () => {
    let context = makeEditContext('current', emptySignMap(3, 3))

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.TOGGLE_TAB, {tab: 'invalid'}),
      context,
    )

    assert.equal(exec.handled, false)
    assert.ok(exec.reason.includes('invalid tab'))
  })

  it('schedules analysis on target tab', () => {
    let {deps, calls} = trackDeps()
    let context = makeEditContext('current', emptySignMap(3, 3), emptySignMap(3, 3))

    executeScratchEdit(
      resolvedResult(BOARD_INTENTS.TOGGLE_TAB, {tab: 'reference'}),
      context,
      deps,
    )

    assert.deepEqual(calls.schedule, ['reference'])
  })
})

// --- Phase 7: Save as problem ---

describe('executeScratchEdit (save-as-problem)', () => {
  it('returns handled but delegates to caller', () => {
    let context = makeEditContext('current', emptySignMap(3, 3))

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.SAVE_AS_PROBLEM, {}),
      context,
    )

    assert.equal(exec.handled, true)
    assert.equal(exec.changed, false)
    assert.ok(exec.reason.includes('delegated'))
  })
})

// --- Phase 7: Marker helper unit tests ---

describe('workingPositionMarkers helpers', () => {
  describe('toggleMarker', () => {
    it('places a cross marker', () => {
      let map = emptyMarkerMap(3, 3)
      let updated = toggleMarker(map, [1, 1], 'cross')
      assert.equal(updated[1][1].type, 'cross')
      assert.equal(map[1][1], null, 'original not mutated')
    })

    it('removes existing same-type marker', () => {
      let map = emptyMarkerMap(3, 3)
      map[0][0] = {type: 'triangle'}
      let updated = toggleMarker(map, [0, 0], 'triangle')
      assert.equal(updated[0][0], null)
    })

    it('replaces different marker type', () => {
      let map = emptyMarkerMap(3, 3)
      map[0][0] = {type: 'cross'}
      let updated = toggleMarker(map, [0, 0], 'triangle')
      assert.equal(updated[0][0].type, 'triangle')
    })
  })

  describe('toggleCoordLabel', () => {
    it('places a coordinate label', () => {
      let map = emptyMarkerMap(9, 9)
      let updated = toggleCoordLabel(map, [0, 0], 9)
      assert.equal(updated[0][0].type, 'label')
      assert.equal(updated[0][0].label, 'A9')
    })

    it('removes existing same label', () => {
      let map = emptyMarkerMap(9, 9)
      map[0][0] = {type: 'label', label: 'A9'}
      let updated = toggleCoordLabel(map, [0, 0], 9)
      assert.equal(updated[0][0], null)
    })

    it('skips I column (SGF convention)', () => {
      let map = emptyMarkerMap(9, 9)
      // Index 8 (column 9) should be J, not I
      let updated = toggleCoordLabel(map, [8, 0], 9)
      assert.equal(updated[0][8].label, 'J9')
    })
  })

  describe('toggleNumberLabel', () => {
    it('places first number as 1', () => {
      let map = emptyMarkerMap(3, 3)
      let updated = toggleNumberLabel(map, [0, 0])
      assert.equal(updated[0][0].type, 'label')
      assert.equal(updated[0][0].label, '1')
    })

    it('assigns next available number', () => {
      let map = emptyMarkerMap(3, 3)
      map[0][0] = {type: 'label', label: '1'}
      let updated = toggleNumberLabel(map, [1, 0])
      assert.equal(updated[0][1].label, '2')
    })

    it('removes existing number marker', () => {
      let map = emptyMarkerMap(3, 3)
      map[0][0] = {type: 'label', label: '3'}
      let updated = toggleNumberLabel(map, [0, 0])
      assert.equal(updated[0][0], null)
    })

    it('does not remove non-numeric label', () => {
      let map = emptyMarkerMap(3, 3)
      map[0][0] = {type: 'label', label: 'abc'}
      let updated = toggleNumberLabel(map, [0, 0])
      assert.equal(updated[0][0].type, 'label')
      assert.ok(Number.isFinite(parseInt(updated[0][0].label, 10)))
    })
  })

  describe('setLabelMarker', () => {
    it('sets a custom label', () => {
      let map = emptyMarkerMap(3, 3)
      let updated = setLabelMarker(map, [1, 1], 'hello')
      assert.equal(updated[1][1].type, 'label')
      assert.equal(updated[1][1].label, 'hello')
    })

    it('overwrites existing marker', () => {
      let map = emptyMarkerMap(3, 3)
      map[1][1] = {type: 'cross'}
      let updated = setLabelMarker(map, [1, 1], 'test')
      assert.equal(updated[1][1].type, 'label')
      assert.equal(updated[1][1].label, 'test')
    })
  })

  describe('createEmptyMarkerMap', () => {
    it('creates correctly sized map', () => {
      let map = createEmptyMarkerMap(5, 4)
      assert.equal(map.length, 4)
      assert.equal(map[0].length, 5)
      assert.equal(map[3][4], null)
    })
  })
})

// --- Phase 7: Line helper unit tests ---

describe('workingPositionLines helpers', () => {
  describe('addLine', () => {
    it('adds a line to empty array', () => {
      let lines = addLine([], [0, 0], [1, 1], 'line')
      assert.equal(lines.length, 1)
      assert.deepEqual(lines[0], {v1: [0, 0], v2: [1, 1], type: 'line'})
    })

    it('appends to existing lines', () => {
      let existing = [{v1: [0, 0], v2: [1, 1], type: 'line'}]
      let lines = addLine(existing, [2, 2], [3, 3], 'arrow')
      assert.equal(lines.length, 2)
      assert.equal(lines[0].type, 'line')
      assert.equal(lines[1].type, 'arrow')
    })

    it('does not mutate original array', () => {
      let existing = [{v1: [0, 0], v2: [1, 1], type: 'line'}]
      addLine(existing, [2, 2], [3, 3], 'arrow')
      assert.equal(existing.length, 1)
    })
  })
})

// --- Phase 7: Boundary isolation tests ---

describe('Phase 7 boundary isolation', () => {
  it('marker writes do not affect game-tree mutation helpers', () => {
    let context = makeEditContext('current', emptySignMap(3, 3))
    let originalSnapshot = context.currentSnapshot

    executeScratchEdit(
      resolvedResult(BOARD_INTENTS.MARK_POINT, {
        markerType: 'cross',
        vertex: [1, 1],
      }),
      context,
    )

    // Snapshot is unchanged — only markerMap is returned
    assert.deepEqual(
      context.currentSnapshot.signMap,
      originalSnapshot.signMap,
      'marker write must not touch signMap',
    )
  })

  it('line writes do not affect snapshot', () => {
    let context = makeEditContext('current', emptySignMap(3, 3), null, 1, {
      lineFirstVertex: {type: 'line', vertex: [0, 0]},
    })
    let originalSnapshot = context.currentSnapshot

    executeScratchEdit(
      resolvedResult(BOARD_INTENTS.DRAW_LINE, {
        lineType: 'line',
        vertex: [2, 2],
      }),
      context,
    )

    assert.deepEqual(
      context.currentSnapshot.signMap,
      originalSnapshot.signMap,
      'line write must not touch signMap',
    )
  })

  it('capture-reference does not modify source snapshot', () => {
    let signMap = emptySignMap(3, 3)
    signMap[0][0] = 1
    let context = makeEditContext('current', signMap)
    let originalSignMap = signMap.map(r => [...r])

    executeScratchEdit(
      resolvedResult(BOARD_INTENTS.CAPTURE_REFERENCE, {}),
      context,
    )

    assert.deepEqual(
      context.currentSnapshot.signMap,
      originalSignMap,
      'capture must not modify source',
    )
  })

  it('set-next-player does not modify stones', () => {
    let signMap = emptySignMap(3, 3)
    signMap[1][1] = 1
    signMap[0][2] = -1
    let context = makeEditContext('current', signMap)

    let exec = executeScratchEdit(
      resolvedResult(BOARD_INTENTS.SET_NEXT_PLAYER, {sign: -1}),
      context,
    )

    assert.equal(exec.snapshot.signMap[1][1], 1, 'stones unchanged')
    assert.equal(exec.snapshot.signMap[0][2], -1, 'stones unchanged')
    assert.equal(exec.snapshot.nextPlayer, -1, 'player updated')
  })
})
