import assert from 'assert'

import {
  BOARD_INTENTS,
  RESOLVE_STATUSES,
  createBoardInteractionContext,
  executeBoardInteraction,
  resolveBoardInteraction,
} from '../src/modules/workbench/board-interactions/index.ts'

import {
  MUTATION_CONTRACTS,
  createScratchEditExecutionContext,
  createScratchPositionSource,
} from '../src/modules/workbench/contracts/index.ts'

import {createWorkingPosition} from '../src/modules/workbench/working-position/index.js'

import {boardFromSnapshot} from '../src/modules/study.js'

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

function makeAnalysisState(tool, overrides = {}) {
  let signMap = overrides.signMap ?? emptySignMap(9, 9)
  let snapshot = makeSnapshot('snap-1', signMap, overrides.nextPlayer ?? 1)

  return {
    mode: 'analysis',
    selectedTool: tool,
    treePosition: 'node-1',
    editWorkspace: {
      activeTab: 'current',
      currentSnapshot: snapshot,
      referenceSnapshot: null,
      currentMarkerMap: signMap.map((row) => row.map(() => null)),
      currentLines: [],
      lineFirstVertex: null,
    },
    ...overrides.stateOverrides,
  }
}

function leftClick() {
  return {button: 0, ctrlKey: false, metaKey: false}
}

function rightClick() {
  return {button: 2, ctrlKey: false, metaKey: false}
}

// --- Phase 5 integration: context → resolve → execute pipeline ---

describe('Phase 5 edit-analysis click redirect', () => {
  // Simulates the Phase 5 clickVertex path:
  //   boardFromSnapshot(snapshot) -> createBoardInteractionContext -> resolveBoardInteraction
  //   -> createScratchEditExecutionContext -> executeBoardInteraction
  // Returns {handled, changed, tab, snapshot} (same shape as handleEditAnalysisClick result).

  function runPipeline(state, vertex, event) {
    let ws = state.editWorkspace
    let tab = ws.activeTab
    let snapshotKey = `${tab}Snapshot`
    let snapshot = ws[snapshotKey]

    let workingBoard = boardFromSnapshot(snapshot)
    if (workingBoard == null) return {handled: false}

    let context = createBoardInteractionContext({
      state,
      board: workingBoard,
      vertex,
      event,
      isMac: false,
    })
    if (context == null) return {handled: false}

    let result = resolveBoardInteraction(context)

    let execContext = createScratchEditExecutionContext(ws)
    if (execContext == null) return {handled: false}

    let execResult = executeBoardInteraction(result, execContext)
    return {...execResult, result}
  }

  describe('migrated intents (stone_1, stone_-1, eraser, play)', () => {
    it('stone_1 on empty point: handled, changed, places black', () => {
      let state = makeAnalysisState('stone_1')
      let {handled, changed, snapshot} = runPipeline(state, [3, 3], leftClick())

      assert.equal(handled, true)
      assert.equal(changed, true)
      assert.equal(snapshot.signMap[3][3], 1)
    })

    it('stone_1 on same-color stone: handled, changed, toggles off', () => {
      let signMap = emptySignMap(9, 9)
      signMap[3][3] = 1
      let state = makeAnalysisState('stone_1', {signMap})
      let {handled, changed, snapshot} = runPipeline(state, [3, 3], leftClick())

      assert.equal(handled, true)
      assert.equal(changed, true)
      assert.equal(snapshot.signMap[3][3], 0)
    })

    it('stone_1 on opposite-color stone: handled, changed, replaces with black', () => {
      let signMap = emptySignMap(9, 9)
      signMap[3][3] = -1
      let state = makeAnalysisState('stone_1', {signMap})
      let {handled, changed, snapshot} = runPipeline(state, [3, 3], leftClick())

      assert.equal(handled, true)
      assert.equal(changed, true)
      assert.equal(snapshot.signMap[3][3], 1)
    })

    it('stone_-1 on empty point: handled, changed, places white', () => {
      let state = makeAnalysisState('stone_-1')
      let {handled, changed, snapshot} = runPipeline(state, [3, 3], leftClick())

      assert.equal(handled, true)
      assert.equal(changed, true)
      assert.equal(snapshot.signMap[3][3], -1)
    })

    it('stone_-1 on same-color stone: handled, changed, toggles off', () => {
      let signMap = emptySignMap(9, 9)
      signMap[3][3] = -1
      let state = makeAnalysisState('stone_-1', {signMap})
      let {handled, changed, snapshot} = runPipeline(state, [3, 3], leftClick())

      assert.equal(handled, true)
      assert.equal(changed, true)
      assert.equal(snapshot.signMap[3][3], 0)
    })

    it('eraser on occupied point: handled, changed, removes stone', () => {
      let signMap = emptySignMap(9, 9)
      signMap[3][3] = 1
      let state = makeAnalysisState('eraser', {signMap})
      let {handled, changed, snapshot} = runPipeline(state, [3, 3], leftClick())

      assert.equal(handled, true)
      assert.equal(changed, true)
      assert.equal(snapshot.signMap[3][3], 0)
    })

    it('eraser on empty point: handled, NOT changed (no-op)', () => {
      let state = makeAnalysisState('eraser')
      let {handled, changed} = runPipeline(state, [3, 3], leftClick())

      assert.equal(handled, true)
      assert.equal(changed, false)
    })

    it('play on empty point: handled, changed, uses nextPlayer', () => {
      let state = makeAnalysisState('play', {nextPlayer: -1})
      let {handled, changed, snapshot} = runPipeline(state, [3, 3], leftClick())

      assert.equal(handled, true)
      assert.equal(changed, true)
      assert.equal(snapshot.signMap[3][3], -1)
      assert.equal(snapshot.nextPlayer, 1)
    })

    it('play on occupied point: resolver rejects, falls back to legacy', () => {
      let signMap = emptySignMap(9, 9)
      signMap[3][3] = 1
      let state = makeAnalysisState('play', {signMap})
      let {handled, result} = runPipeline(state, [3, 3], leftClick())

      // The resolver rejects play-on-occupied (NOOP), executor returns
      // handled:false, which correctly falls through to legacy scratchEdit
      // (which also returns early for occupied points).
      assert.equal(handled, false)
      assert.equal(result.intent, BOARD_INTENTS.NOOP)
    })

    it('right-click stone_1 toggles to white placement', () => {
      let state = makeAnalysisState('stone_1')
      let {handled, changed, snapshot} = runPipeline(
        state,
        [3, 3],
        rightClick(),
      )

      assert.equal(handled, true)
      assert.equal(changed, true)
      assert.equal(snapshot.signMap[3][3], -1)
    })

    it('right-click stone_-1 toggles to black placement', () => {
      let state = makeAnalysisState('stone_-1')
      let {handled, changed, snapshot} = runPipeline(
        state,
        [3, 3],
        rightClick(),
      )

      assert.equal(handled, true)
      assert.equal(changed, true)
      assert.equal(snapshot.signMap[3][3], 1)
    })
  })

  describe('migrated marker intents', () => {
    const markerTools = [
      'cross',
      'triangle',
      'square',
      'circle',
      'label',
      'number',
    ]

    for (let tool of markerTools) {
      it(`${tool}: handled, changed, returns markerMap`, () => {
        let state = makeAnalysisState(tool)
        let {handled, changed, markerMap} = runPipeline(state, [3, 3], leftClick())

        assert.equal(handled, true)
        assert.equal(changed, true)
        assert.ok(markerMap != null, 'markerMap should be present')
      })
    }

    it('line tool first click: handled, NOT changed, saves lineFirstVertex', () => {
      let state = makeAnalysisState('line')
      let {handled, changed, lineFirstVertex} = runPipeline(state, [3, 3], leftClick())

      assert.equal(handled, true)
      assert.equal(changed, false)
      assert.deepEqual(lineFirstVertex, {type: 'line', vertex: [3, 3]})
    })

    it('arrow tool first click: handled, NOT changed, saves lineFirstVertex', () => {
      let state = makeAnalysisState('arrow')
      let {handled, changed, lineFirstVertex} = runPipeline(state, [3, 3], leftClick())

      assert.equal(handled, true)
      assert.equal(changed, false)
      assert.deepEqual(lineFirstVertex, {type: 'arrow', vertex: [3, 3]})
    })

    it('line tool second click: produces completed line and clears lineFirstVertex', () => {
      let state = makeAnalysisState('line')
      // Simulate first click already committed — workspace has lineFirstVertex
      state.editWorkspace.lineFirstVertex = {type: 'line', vertex: [3, 3]}

      let {handled, changed, lines, lineFirstVertex: lfResult} = runPipeline(state, [5, 5], leftClick())

      assert.equal(handled, true)
      assert.equal(changed, true)
      assert.ok(lines != null)
      assert.equal(lines.length, 1)
      assert.deepEqual(lines[0].v1, [3, 3])
      assert.deepEqual(lines[0].v2, [5, 5])
      assert.equal(lines[0].type, 'line')
      assert.equal(lfResult, null)
    })

    it('right-click label: NOT handled (menu action)', () => {
      let state = makeAnalysisState('label')
      let {handled} = runPipeline(state, [3, 3], rightClick())

      assert.equal(handled, false)
    })

    it('right-click number: NOT handled (menu action)', () => {
      let state = makeAnalysisState('number')
      let {handled} = runPipeline(state, [3, 3], rightClick())

      assert.equal(handled, false)
    })
  })

  describe('commit-back state shape', () => {
    it('migrated stone edit produces snapshot with correct shape', () => {
      let state = makeAnalysisState('stone_1')
      let {snapshot, tab} = runPipeline(state, [3, 3], leftClick())

      assert.equal(tab, 'current')
      assert.ok(snapshot.id)
      assert.ok(snapshot.signMap)
      assert.equal(snapshot.width, 9)
      assert.equal(snapshot.height, 9)
      assert.equal(snapshot.signMap[3][3], 1)
    })

    it('migrated play edit flips nextPlayer', () => {
      let state = makeAnalysisState('play', {nextPlayer: 1})
      let {snapshot} = runPipeline(state, [3, 3], leftClick())

      assert.equal(snapshot.nextPlayer, -1)
    })

    it('edit does not modify the original snapshot', () => {
      let state = makeAnalysisState('stone_1')
      let originalSnapshot = state.editWorkspace.currentSnapshot
      let originalSignMap = originalSnapshot.signMap[3][3]

      runPipeline(state, [3, 3], leftClick())

      assert.equal(originalSnapshot.signMap[3][3], originalSignMap)
    })

    it('positionSource can be derived from the resulting snapshot', () => {
      let state = makeAnalysisState('stone_1')
      let {snapshot} = runPipeline(state, [3, 3], leftClick())

      let source = createScratchPositionSource(
        snapshot.id,
        snapshot.role ?? 'current',
      )
      assert.equal(source.kind, 'scratch')
      assert.equal(source.snapshotId, snapshot.id)
    })

    it('cross marker produces markerMap with correct shape', () => {
      let state = makeAnalysisState('cross')
      let {markerMap, tab} = runPipeline(state, [3, 3], leftClick())

      assert.equal(tab, 'current')
      assert.ok(markerMap)
      assert.equal(markerMap[3][3].type, 'cross')
    })

    it('number marker produces sequential label', () => {
      let state = makeAnalysisState('number')
      let {markerMap} = runPipeline(state, [3, 3], leftClick())

      assert.ok(markerMap)
      assert.equal(markerMap[3][3].type, 'label')
      assert.equal(markerMap[3][3].label, '1')
    })

    it('line first click produces lineFirstVertex but no lines', () => {
      let state = makeAnalysisState('line')
      let {lineFirstVertex, lines} = runPipeline(state, [3, 3], leftClick())

      assert.deepEqual(lineFirstVertex, {type: 'line', vertex: [3, 3]})
      assert.equal(lines, undefined)
    })
  })

  describe('legacy mode regression', () => {
    it('play mode produces play-stone intent, NOT scratch edit', () => {
      let state = {
        mode: 'play',
        selectedTool: 'stone_1',
        treePosition: 'node-1',
      }
      let signMap = emptySignMap(9, 9)
      let snapshot = makeSnapshot('snap-1', signMap)
      let board = boardFromSnapshot(snapshot)

      let context = createBoardInteractionContext({
        state,
        board,
        vertex: [3, 3],
        event: leftClick(),
        isMac: false,
      })

      let result = resolveBoardInteraction(context)
      assert.equal(result.intent, BOARD_INTENTS.PLAY_STONE)
      assert.equal(result.mutationContract, MUTATION_CONTRACTS.PLAY_MOVE)

      let execResult = executeBoardInteraction(result, {
        activeTab: 'current',
        currentSnapshot: null,
        referenceSnapshot: null,
      })
      assert.equal(execResult.handled, false)
    })

    it('recall mode produces recall intent, NOT scratch edit', () => {
      let state = {
        mode: 'recall',
        selectedTool: 'stone_1',
        treePosition: 'node-1',
      }
      let signMap = emptySignMap(9, 9)
      let snapshot = makeSnapshot('snap-1', signMap)
      let board = boardFromSnapshot(snapshot)

      let context = createBoardInteractionContext({
        state,
        board,
        vertex: [3, 3],
        event: leftClick(),
        isMac: false,
      })

      let result = resolveBoardInteraction(context)
      assert.equal(result.intent, BOARD_INTENTS.SUBMIT_RECALL_ANSWER)
      assert.equal(result.mutationContract, MUTATION_CONTRACTS.RECALL_ANSWER)
    })

    it('analysis without workspace produces legacy-sgf-edit', () => {
      let state = {
        mode: 'analysis',
        selectedTool: 'stone_1',
        treePosition: 'node-1',
      }
      let signMap = emptySignMap(9, 9)
      let snapshot = makeSnapshot('snap-1', signMap)
      let board = boardFromSnapshot(snapshot)

      let context = createBoardInteractionContext({
        state,
        board,
        vertex: [3, 3],
        event: leftClick(),
        isMac: false,
      })

      let result = resolveBoardInteraction(context)
      assert.equal(result.intent, BOARD_INTENTS.LEGACY_SGF_EDIT)
      assert.equal(result.status, RESOLVE_STATUSES.DEFERRED)
    })
  })
})
