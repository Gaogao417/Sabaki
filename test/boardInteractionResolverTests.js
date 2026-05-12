import assert from 'assert'

import {
  BOARD_INTENTS,
  RESOLVE_STATUSES,
  resolveBoardInteraction,
  createBoardInteractionContext,
} from '../src/modules/workbench/board-interactions/index.ts'

import {
  MUTATION_CONTRACTS,
  createGameTreePositionSource,
  createScratchPositionSource,
} from '../src/modules/workbench/contracts/index.ts'

// --- Helpers ---

function leftClick() {
  return {button: 0, ctrlKey: false, metaKey: false, isMac: false}
}

function rightClick() {
  return {button: 2, ctrlKey: false, metaKey: false, isMac: false}
}

function macCtrlClick() {
  return {button: 0, ctrlKey: true, metaKey: false, isMac: true}
}

function emptyPoint() {
  return {sign: 0, markerType: null}
}

function blackPoint() {
  return {sign: 1, markerType: null}
}

function whitePoint() {
  return {sign: -1, markerType: null}
}

function gameTreeSource(id = 'node-1') {
  return createGameTreePositionSource(id)
}

function scratchSource(id = 'snap-1', role = 'current') {
  return createScratchPositionSource(id, role)
}

function playInput(overrides = {}) {
  return {
    mode: 'play',
    selectedTool: 'stone_1',
    event: leftClick(),
    point: emptyPoint(),
    vertex: [3, 3],
    positionSource: gameTreeSource(),
    mutationContract: MUTATION_CONTRACTS.PLAY_MOVE,
    editWorkspacePresent: false,
    ...overrides,
  }
}

function analysisInput(overrides = {}) {
  return {
    mode: 'analysis',
    selectedTool: 'stone_1',
    event: leftClick(),
    point: emptyPoint(),
    vertex: [3, 3],
    positionSource: scratchSource(),
    mutationContract: MUTATION_CONTRACTS.SCRATCH_EDIT,
    editWorkspacePresent: true,
    ...overrides,
  }
}

function recallInput(overrides = {}) {
  return {
    mode: 'recall',
    selectedTool: 'stone_1',
    event: leftClick(),
    point: emptyPoint(),
    vertex: [3, 3],
    positionSource: gameTreeSource(),
    mutationContract: MUTATION_CONTRACTS.RECALL_ANSWER,
    editWorkspacePresent: false,
    ...overrides,
  }
}

// --- Resolver matrix tests ---

describe('board interaction resolver', () => {
  describe('play mode', () => {
    it('left-click empty point -> play-stone', () => {
      let result = resolveBoardInteraction(playInput())
      assert.equal(result.intent, BOARD_INTENTS.PLAY_STONE)
      assert.equal(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.equal(result.mutationContract, MUTATION_CONTRACTS.PLAY_MOVE)
      assert.ok(result.positionSource)
      assert.equal(result.positionSource.kind, 'game-tree')
      assert.deepEqual(result.payload.vertex, [3, 3])
    })

    it('left-click occupied point -> noop', () => {
      let result = resolveBoardInteraction(playInput({point: blackPoint()}))
      assert.equal(result.intent, BOARD_INTENTS.NOOP)
      assert.equal(result.status, RESOLVE_STATUSES.REJECTED)
      assert.ok(result.reason)
    })

    it('middle-click -> noop (unsupported button)', () => {
      let result = resolveBoardInteraction(
        playInput({event: {button: 1, ctrlKey: false, metaKey: false, isMac: false}}),
      )
      assert.equal(result.intent, BOARD_INTENTS.NOOP)
      assert.ok(result.reason.includes('unsupported button'))
    })

    it('right-click -> legacy-play-right-click (deferred)', () => {
      let result = resolveBoardInteraction(playInput({event: rightClick()}))
      assert.equal(result.intent, BOARD_INTENTS.LEGACY_PLAY_RIGHT_CLICK)
      assert.equal(result.status, RESOLVE_STATUSES.DEFERRED)
      assert.equal(result.positionSource, null)
      assert.equal(result.mutationContract, null)
    })

    it('mac ctrl-click -> legacy-play-right-click (deferred)', () => {
      let result = resolveBoardInteraction(playInput({event: macCtrlClick()}))
      assert.equal(result.intent, BOARD_INTENTS.LEGACY_PLAY_RIGHT_CLICK)
      assert.equal(result.status, RESOLVE_STATUSES.DEFERRED)
    })

    it('preserves game-tree position source', () => {
      let src = gameTreeSource('node-42')
      let result = resolveBoardInteraction(playInput({positionSource: src}))
      assert.deepEqual(result.positionSource, src)
    })
  })

  describe('analysis edit workspace', () => {
    it('stone_1 left-click empty -> place-black-stone (place)', () => {
      let result = resolveBoardInteraction(analysisInput({selectedTool: 'stone_1'}))
      assert.equal(result.intent, BOARD_INTENTS.PLACE_BLACK_STONE)
      assert.equal(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.equal(result.payload.sign, 1)
      assert.equal(result.payload.action, 'place')
      assert.deepEqual(result.payload.vertex, [3, 3])
    })

    it('stone_1 left-click same-color -> place-black-stone (remove/toggle)', () => {
      let result = resolveBoardInteraction(
        analysisInput({selectedTool: 'stone_1', point: blackPoint()}),
      )
      assert.equal(result.intent, BOARD_INTENTS.PLACE_BLACK_STONE)
      assert.equal(result.payload.sign, 1)
      assert.equal(result.payload.action, 'remove')
    })

    it('stone_1 left-click opposite-color -> place-black-stone (place)', () => {
      let result = resolveBoardInteraction(
        analysisInput({selectedTool: 'stone_1', point: whitePoint()}),
      )
      assert.equal(result.intent, BOARD_INTENTS.PLACE_BLACK_STONE)
      assert.equal(result.payload.action, 'place')
    })

    it('stone_-1 left-click empty -> place-white-stone (place)', () => {
      let result = resolveBoardInteraction(analysisInput({selectedTool: 'stone_-1'}))
      assert.equal(result.intent, BOARD_INTENTS.PLACE_WHITE_STONE)
      assert.equal(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.equal(result.payload.sign, -1)
      assert.equal(result.payload.action, 'place')
    })

    it('stone_-1 left-click same-color -> place-white-stone (remove/toggle)', () => {
      let result = resolveBoardInteraction(
        analysisInput({selectedTool: 'stone_-1', point: whitePoint()}),
      )
      assert.equal(result.intent, BOARD_INTENTS.PLACE_WHITE_STONE)
      assert.equal(result.payload.sign, -1)
      assert.equal(result.payload.action, 'remove')
    })

    it('stone_-1 left-click opposite-color -> place-white-stone (place)', () => {
      let result = resolveBoardInteraction(
        analysisInput({selectedTool: 'stone_-1', point: blackPoint()}),
      )
      assert.equal(result.intent, BOARD_INTENTS.PLACE_WHITE_STONE)
      assert.equal(result.payload.action, 'place')
    })

    it('stone_1 right-click -> place-white-stone (toggled)', () => {
      let result = resolveBoardInteraction(
        analysisInput({selectedTool: 'stone_1', event: rightClick()}),
      )
      assert.equal(result.intent, BOARD_INTENTS.PLACE_WHITE_STONE)
      assert.equal(result.payload.sign, -1)
    })

    it('stone_-1 right-click -> place-black-stone (toggled)', () => {
      let result = resolveBoardInteraction(
        analysisInput({selectedTool: 'stone_-1', event: rightClick()}),
      )
      assert.equal(result.intent, BOARD_INTENTS.PLACE_BLACK_STONE)
      assert.equal(result.payload.sign, 1)
    })

    it('stone_1 mac ctrl-click -> place-white-stone (toggled)', () => {
      let result = resolveBoardInteraction(
        analysisInput({selectedTool: 'stone_1', event: macCtrlClick()}),
      )
      assert.equal(result.intent, BOARD_INTENTS.PLACE_WHITE_STONE)
    })

    it('eraser -> erase-stone with vertex', () => {
      let result = resolveBoardInteraction(
        analysisInput({selectedTool: 'eraser'}),
      )
      assert.equal(result.intent, BOARD_INTENTS.ERASE_STONE)
      assert.equal(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.deepEqual(result.payload.vertex, [3, 3])
    })

    it('play tool empty point -> play-stone with scratchEdit contract and vertex', () => {
      let result = resolveBoardInteraction(
        analysisInput({selectedTool: 'play', point: emptyPoint()}),
      )
      assert.equal(result.intent, BOARD_INTENTS.PLAY_STONE)
      assert.equal(result.mutationContract, MUTATION_CONTRACTS.SCRATCH_EDIT)
      assert.deepEqual(result.payload.vertex, [3, 3])
    })

    it('play tool occupied point -> noop', () => {
      let result = resolveBoardInteraction(
        analysisInput({selectedTool: 'play', point: blackPoint()}),
      )
      assert.equal(result.intent, BOARD_INTENTS.NOOP)
      assert.ok(result.reason.includes('occupied'))
    })

    // Marker tools
    for (let tool of ['cross', 'triangle', 'square', 'circle']) {
      it(`${tool} tool -> mark-point`, () => {
        let result = resolveBoardInteraction(
          analysisInput({selectedTool: tool}),
        )
        assert.equal(result.intent, BOARD_INTENTS.MARK_POINT)
        assert.equal(result.payload.markerType, tool)
      })
    }

    it('label tool -> mark-point', () => {
      let result = resolveBoardInteraction(
        analysisInput({selectedTool: 'label'}),
      )
      assert.equal(result.intent, BOARD_INTENTS.MARK_POINT)
      assert.equal(result.payload.markerType, 'label')
    })

    it('number tool -> mark-point', () => {
      let result = resolveBoardInteraction(
        analysisInput({selectedTool: 'number'}),
      )
      assert.equal(result.intent, BOARD_INTENTS.MARK_POINT)
      assert.equal(result.payload.markerType, 'number')
    })

    // Line tools
    for (let tool of ['line', 'arrow']) {
      it(`${tool} tool -> draw-line`, () => {
        let result = resolveBoardInteraction(
          analysisInput({selectedTool: tool}),
        )
        assert.equal(result.intent, BOARD_INTENTS.DRAW_LINE)
        assert.equal(result.payload.lineType, tool)
      })
    }

    it('right-click with label tool -> noop (menu action)', () => {
      let result = resolveBoardInteraction(
        analysisInput({selectedTool: 'label', event: rightClick()}),
      )
      assert.equal(result.intent, BOARD_INTENTS.NOOP)
    })

    it('right-click with number tool -> noop (menu action)', () => {
      let result = resolveBoardInteraction(
        analysisInput({selectedTool: 'number', event: rightClick()}),
      )
      assert.equal(result.intent, BOARD_INTENTS.NOOP)
    })

    it('preserves scratch position source', () => {
      let src = scratchSource('snap-42', 'reference')
      let result = resolveBoardInteraction(
        analysisInput({positionSource: src}),
      )
      assert.deepEqual(result.positionSource, src)
    })

    it('unsupported button -> noop', () => {
      let result = resolveBoardInteraction(
        analysisInput({event: {button: 1, ctrlKey: false, metaKey: false, isMac: false}}),
      )
      assert.equal(result.intent, BOARD_INTENTS.NOOP)
    })
  })

  describe('analysis without edit workspace', () => {
    it('returns legacy-sgf-edit', () => {
      let result = resolveBoardInteraction(
        analysisInput({editWorkspacePresent: false}),
      )
      assert.equal(result.intent, BOARD_INTENTS.LEGACY_SGF_EDIT)
      assert.equal(result.status, RESOLVE_STATUSES.DEFERRED)
      assert.equal(result.positionSource, null)
      assert.equal(result.mutationContract, null)
    })
  })

  describe('recall mode', () => {
    it('left-click empty point -> submit-recall-answer', () => {
      let result = resolveBoardInteraction(recallInput())
      assert.equal(result.intent, BOARD_INTENTS.SUBMIT_RECALL_ANSWER)
      assert.equal(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.equal(result.mutationContract, MUTATION_CONTRACTS.RECALL_ANSWER)
      assert.deepEqual(result.payload.vertex, [3, 3])
    })

    it('left-click occupied point -> noop', () => {
      let result = resolveBoardInteraction(recallInput({point: blackPoint()}))
      assert.equal(result.intent, BOARD_INTENTS.NOOP)
    })

    it('right-click -> noop', () => {
      let result = resolveBoardInteraction(recallInput({event: rightClick()}))
      assert.equal(result.intent, BOARD_INTENTS.NOOP)
    })
  })

  describe('scoring / estimator', () => {
    for (let mode of ['scoring', 'estimator']) {
      it(`${mode}: left-click stone -> legacy-toggle-dead-stones`, () => {
        let result = resolveBoardInteraction(
          playInput({mode, point: blackPoint()}),
        )
        assert.equal(result.intent, BOARD_INTENTS.LEGACY_TOGGLE_DEAD_STONES)
        assert.equal(result.status, RESOLVE_STATUSES.DEFERRED)
      })

      it(`${mode}: left-click empty -> noop`, () => {
        let result = resolveBoardInteraction(
          playInput({mode, point: emptyPoint()}),
        )
        assert.equal(result.intent, BOARD_INTENTS.NOOP)
      })

      it(`${mode}: right-click -> noop`, () => {
        let result = resolveBoardInteraction(
          playInput({mode, event: rightClick(), point: blackPoint()}),
        )
        assert.equal(result.intent, BOARD_INTENTS.NOOP)
      })
    }
  })

  describe('legacy modes', () => {
    it('autoplay -> legacy-autoplay', () => {
      let result = resolveBoardInteraction(playInput({mode: 'autoplay'}))
      assert.equal(result.intent, BOARD_INTENTS.LEGACY_AUTOPLAY)
      assert.equal(result.status, RESOLVE_STATUSES.DEFERRED)
    })

    it('find left-click -> legacy-find-move', () => {
      let result = resolveBoardInteraction(playInput({mode: 'find'}))
      assert.equal(result.intent, BOARD_INTENTS.LEGACY_FIND_MOVE)
      assert.equal(result.status, RESOLVE_STATUSES.DEFERRED)
    })

    it('find right-click -> noop', () => {
      let result = resolveBoardInteraction(
        playInput({mode: 'find', event: rightClick()}),
      )
      assert.equal(result.intent, BOARD_INTENTS.NOOP)
    })

    it('guess left-click -> legacy-guess-move', () => {
      let result = resolveBoardInteraction(playInput({mode: 'guess'}))
      assert.equal(result.intent, BOARD_INTENTS.LEGACY_GUESS_MOVE)
    })

    it('problem left-click -> legacy-problem-move', () => {
      let result = resolveBoardInteraction(playInput({mode: 'problem'}))
      assert.equal(result.intent, BOARD_INTENTS.LEGACY_PROBLEM_MOVE)
    })

    it('review left-click -> legacy-problem-move', () => {
      let result = resolveBoardInteraction(playInput({mode: 'review'}))
      assert.equal(result.intent, BOARD_INTENTS.LEGACY_PROBLEM_MOVE)
    })

    it('unknown mode -> noop', () => {
      let result = resolveBoardInteraction(playInput({mode: 'custom-mode'}))
      assert.equal(result.intent, BOARD_INTENTS.NOOP)
      assert.ok(result.reason.includes('unknown mode'))
    })
  })

  describe('result shape invariants', () => {
    it('every result has intent, status, positionSource, mutationContract', () => {
      let inputs = [
        playInput(),
        playInput({point: blackPoint()}),
        analysisInput(),
        analysisInput({selectedTool: 'eraser'}),
        recallInput(),
        playInput({mode: 'scoring', point: blackPoint()}),
        playInput({mode: 'find'}),
        playInput({mode: 'autoplay'}),
      ]

      for (let input of inputs) {
        let result = resolveBoardInteraction(input)
        assert.ok('intent' in result, `missing intent for mode=${input.mode}`)
        assert.ok('status' in result, `missing status for mode=${input.mode}`)
        assert.ok('positionSource' in result)
        assert.ok('mutationContract' in result)
      }
    })

    it('every resolved result carries vertex in payload', () => {
      let inputs = [
        playInput(),
        analysisInput({selectedTool: 'stone_1'}),
        analysisInput({selectedTool: 'stone_-1'}),
        analysisInput({selectedTool: 'eraser'}),
        analysisInput({selectedTool: 'play'}),
        analysisInput({selectedTool: 'cross'}),
        analysisInput({selectedTool: 'line'}),
        recallInput(),
      ]

      for (let input of inputs) {
        let result = resolveBoardInteraction(input)
        assert.equal(result.status, RESOLVE_STATUSES.RESOLVED, `expected resolved for mode=${input.mode} tool=${input.selectedTool}`)
        assert.ok(result.payload, `missing payload for mode=${input.mode} tool=${input.selectedTool}`)
        assert.ok('vertex' in result.payload, `missing vertex in payload for mode=${input.mode} tool=${input.selectedTool}`)
      }
    })

    it('legacy results always have null source/contract', () => {
      let legacyModes = [
        {mode: 'autoplay', expected: BOARD_INTENTS.LEGACY_AUTOPLAY},
        {mode: 'find', expected: BOARD_INTENTS.LEGACY_FIND_MOVE},
        {mode: 'guess', expected: BOARD_INTENTS.LEGACY_GUESS_MOVE},
        {mode: 'problem', expected: BOARD_INTENTS.LEGACY_PROBLEM_MOVE},
        {mode: 'review', expected: BOARD_INTENTS.LEGACY_PROBLEM_MOVE},
      ]

      for (let {mode, expected} of legacyModes) {
        let result = resolveBoardInteraction(playInput({mode}))
        assert.equal(result.intent, expected, `mode=${mode}`)
        assert.equal(result.positionSource, null, `source null for ${mode}`)
        assert.equal(result.mutationContract, null, `contract null for ${mode}`)
        assert.equal(result.status, RESOLVE_STATUSES.DEFERRED)
      }
    })

    it('resolved results preserve source and contract from input', () => {
      let src = scratchSource('snap-99', 'reference')
      let result = resolveBoardInteraction(
        analysisInput({
          positionSource: src,
          mutationContract: MUTATION_CONTRACTS.SCRATCH_EDIT,
          selectedTool: 'stone_1',
        }),
      )
      assert.equal(result.intent, BOARD_INTENTS.PLACE_BLACK_STONE)
      assert.equal(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.deepEqual(result.positionSource, src)
      assert.equal(result.mutationContract, MUTATION_CONTRACTS.SCRATCH_EDIT)
    })
  })
})

// --- Context builder tests ---

describe('createBoardInteractionContext', () => {
  function fakeBoard({signMap = [[0, 0], [0, 0]], markers} = {}) {
    let defaultMarkers = signMap.map((row) => row.map(() => null))
    return {
      width: signMap[0].length,
      height: signMap.length,
      signMap,
      markers: markers ?? defaultMarkers,
      get([x, y]) { return signMap[y]?.[x] ?? 0 },
    }
  }

  it('derives context from play state and board', () => {
    let board = fakeBoard()
    let state = {
      mode: 'play',
      selectedTool: 'stone_1',
      treePosition: 'node-1',
      editWorkspace: null,
    }
    let ctx = createBoardInteractionContext({
      state,
      board,
      vertex: [1, 0],
      event: {button: 0, ctrlKey: false},
      isMac: false,
    })

    assert.ok(ctx)
    assert.equal(ctx.mode, 'play')
    assert.equal(ctx.selectedTool, 'stone_1')
    assert.equal(ctx.point.sign, 0)
    assert.equal(ctx.point.markerType, null)
    assert.equal(ctx.editWorkspacePresent, false)
    assert.equal(ctx.event.button, 0)
    assert.equal(ctx.event.isMac, false)
    assert.ok(ctx.positionSource)
    assert.equal(ctx.positionSource.kind, 'game-tree')
    assert.equal(ctx.mutationContract, MUTATION_CONTRACTS.PLAY_MOVE)
  })

  it('reads point sign via board.get(), not signMap directly', () => {
    // A board where get() returns 1 but signMap is all zeros.
    // This proves the context uses get(), not signMap indexing.
    let board = {
      width: 2,
      height: 2,
      markers: [[null, null], [null, null]],
      get([x, y]) { return (x === 1 && y === 0) ? 1 : 0 },
    }
    let state = {mode: 'play', selectedTool: 'stone_1', treePosition: 'n1'}
    let ctx = createBoardInteractionContext({
      state,
      board,
      vertex: [1, 0],
      event: {button: 0},
    })

    assert.ok(ctx)
    assert.equal(ctx.point.sign, 1, 'should read from get(), not signMap')
  })

  it('derives context from analysis state with scratch source', () => {
    let board = fakeBoard({signMap: [[1, 0], [0, -1]]})
    let state = {
      mode: 'analysis',
      selectedTool: 'stone_-1',
      treePosition: 'node-1',
      editWorkspace: {
        activeTab: 'current',
        currentSnapshot: {id: 'snap-a', role: 'current'},
        referenceSnapshot: {id: 'snap-b', role: 'reference'},
      },
    }

    // Click the empty point at [1,0]
    let ctx = createBoardInteractionContext({
      state,
      board,
      vertex: [1, 0],
      event: {button: 0, ctrlKey: false},
    })

    assert.ok(ctx)
    assert.equal(ctx.mode, 'analysis')
    assert.equal(ctx.selectedTool, 'stone_-1')
    assert.equal(ctx.point.sign, 0)
    assert.equal(ctx.editWorkspacePresent, true)
    assert.equal(ctx.positionSource.kind, 'scratch')
    assert.equal(ctx.positionSource.snapshotId, 'snap-a')
    assert.equal(ctx.mutationContract, MUTATION_CONTRACTS.SCRATCH_EDIT)
  })

  it('reads marker state from board', () => {
    let board = fakeBoard({
      signMap: [[0]],
      markers: [[{type: 'triangle'}]],
    })
    let state = {mode: 'play', selectedTool: 'stone_1', treePosition: 'n1'}
    let ctx = createBoardInteractionContext({
      state,
      board,
      vertex: [0, 0],
      event: {button: 0},
    })

    assert.equal(ctx.point.markerType, 'triangle')
  })

  it('returns null for null state', () => {
    let board = fakeBoard()
    assert.equal(
      createBoardInteractionContext({state: null, board, vertex: [0, 0], event: {}}),
      null,
    )
  })

  it('returns null for null board', () => {
    let state = {mode: 'play'}
    assert.equal(
      createBoardInteractionContext({state, board: null, vertex: [0, 0], event: {}}),
      null,
    )
  })

  it('defaults mode to play and tool to stone_1', () => {
    let board = fakeBoard()
    let state = {}
    let ctx = createBoardInteractionContext({
      state,
      board,
      vertex: [0, 0],
      event: {button: 2, ctrlKey: true},
      isMac: true,
    })

    assert.ok(ctx)
    assert.equal(ctx.mode, 'play')
    assert.equal(ctx.selectedTool, 'stone_1')
    assert.equal(ctx.event.isMac, true)
    assert.equal(ctx.event.button, 2)
  })

  it('derives null source/contract for legacy modes', () => {
    let board = fakeBoard()
    let state = {mode: 'scoring', treePosition: 'n1'}
    let ctx = createBoardInteractionContext({
      state,
      board,
      vertex: [0, 0],
      event: {button: 0},
    })

    assert.ok(ctx)
    assert.equal(ctx.mode, 'scoring')
    assert.equal(ctx.positionSource, null)
    assert.equal(ctx.mutationContract, null)
  })
})

// --- Integration: context -> resolver roundtrip ---

describe('context -> resolver roundtrip', () => {
  function fakeBoard({signMap = [[0, 0], [0, 0]]} = {}) {
    let markers = signMap.map((row) => row.map(() => null))
    return {
      width: signMap[0].length,
      height: signMap.length,
      signMap,
      markers,
      get([x, y]) { return signMap[y]?.[x] ?? 0 },
    }
  }

  it('play mode roundtrip: click empty -> play-stone', () => {
    let board = fakeBoard()
    let state = {mode: 'play', selectedTool: 'stone_1', treePosition: 'node-1'}
    let ctx = createBoardInteractionContext({
      state,
      board,
      vertex: [0, 0],
      event: {button: 0, ctrlKey: false},
    })

    let result = resolveBoardInteraction(ctx)
    assert.equal(result.intent, BOARD_INTENTS.PLAY_STONE)
    assert.equal(result.status, RESOLVE_STATUSES.RESOLVED)
    assert.equal(result.mutationContract, MUTATION_CONTRACTS.PLAY_MOVE)
  })

  it('analysis roundtrip: stone_1 click -> place-black-stone', () => {
    let board = fakeBoard()
    let state = {
      mode: 'analysis',
      selectedTool: 'stone_1',
      treePosition: 'node-1',
      editWorkspace: {
        activeTab: 'current',
        currentSnapshot: {id: 'snap-1'},
      },
    }
    let ctx = createBoardInteractionContext({
      state,
      board,
      vertex: [1, 1],
      event: {button: 0},
    })

    let result = resolveBoardInteraction(ctx)
    assert.equal(result.intent, BOARD_INTENTS.PLACE_BLACK_STONE)
    assert.equal(result.status, RESOLVE_STATUSES.RESOLVED)
    assert.equal(result.mutationContract, MUTATION_CONTRACTS.SCRATCH_EDIT)
  })

  it('recall roundtrip: click empty -> submit-recall-answer', () => {
    let board = fakeBoard()
    let state = {mode: 'recall', selectedTool: 'stone_1', treePosition: 'node-r1'}
    let ctx = createBoardInteractionContext({
      state,
      board,
      vertex: [0, 0],
      event: {button: 0},
    })

    let result = resolveBoardInteraction(ctx)
    assert.equal(result.intent, BOARD_INTENTS.SUBMIT_RECALL_ANSWER)
    assert.equal(result.mutationContract, MUTATION_CONTRACTS.RECALL_ANSWER)
  })

  it('scoring roundtrip: click stone -> legacy-toggle-dead-stones', () => {
    let board = fakeBoard({signMap: [[1, 0], [0, 0]]})
    let state = {mode: 'scoring', treePosition: 'n1'}
    let ctx = createBoardInteractionContext({
      state,
      board,
      vertex: [0, 0],
      event: {button: 0},
    })

    let result = resolveBoardInteraction(ctx)
    assert.equal(result.intent, BOARD_INTENTS.LEGACY_TOGGLE_DEAD_STONES)
    assert.equal(result.status, RESOLVE_STATUSES.DEFERRED)
  })
})
