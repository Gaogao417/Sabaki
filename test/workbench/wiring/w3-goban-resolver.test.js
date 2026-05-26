/**
 * W3 Goban Resolver Tests — resolveBoardInteraction WorkbenchMode extension
 *
 * Test contract: docs/design/2026-05-19/workbench-wiring/w3-goban-wiring-contract-v0.1.md
 * Contracts covered: W3-T10, W3-T11, W3-T12, W3-T18
 *   + Matrix 1.2: problem right-click, problem occupied-in-area, recall occupied,
 *     analysis editWorkspace tools (stone, eraser, play, markers, line/arrow, drag),
 *     analysis no editWorkspace, play edge buttons, scoring/estimator, find, unknown mode
 *
 * Source of truth alignment:
 *   - Contract Section 8: ResolverInput Extension Spec
 *   - Matrix Section 1.2: Event Bindings by Mode
 *   - PRD v0.5 Section 3.2: Problem area constrains placement
 *   - PRD v0.5 Section 3.3: Recall MUST NOT modify game tree
 *   - W1 Section 3.2: Resolver is pure, doesn't import sabaki.js
 *
 * Test Legitimacy:
 *   All tests import resolveBoardInteraction from production code.
 *   Production module missing -> tryImport returns null -> this.skip(), no silent pass.
 *   Controlled dependencies: inline input objects.
 */

import assert from 'assert'
import {tryImport} from '../tryImport.js'

let resolveBoardInteraction = null
let BOARD_INTENTS = null
let RESOLVE_STATUSES = null

describe('W3 Goban Resolver: resolveBoardInteraction with WorkbenchMode', function () {
  before(async function () {
    const resolverMod = await tryImport(
      'src/modules/workbench/board-interactions/resolveBoardInteraction.ts',
    )
    if (!resolverMod) this.skip()

    resolveBoardInteraction = resolverMod.resolveBoardInteraction
    if (typeof resolveBoardInteraction !== 'function') this.skip()

    const intentsMod = await tryImport(
      'src/modules/workbench/board-interactions/intents.ts',
    )
    if (!intentsMod) this.skip()

    BOARD_INTENTS = intentsMod.BOARD_INTENTS
    RESOLVE_STATUSES = intentsMod.RESOLVE_STATUSES
  })

  // --- Helpers ---

  function baseResolverInput(overrides = {}) {
    return {
      mode: 'play',
      selectedTool: 'stone_1',
      event: {button: 0, ctrlKey: false, metaKey: false, isMac: false},
      point: {sign: 0, markerType: null},
      vertex: [3, 3],
      sourceVertex: null,
      sourcePoint: null,
      positionSource: {kind: 'game-tree', treePosition: 'node_1'},
      mutationContract: 'playMove',
      editWorkspacePresent: false,
      ...overrides,
    }
  }

  // --- W3-T10: workbenchMode='play' + empty vertex -> play-stone intent + playMove contract ---

  describe('W3-T10: workbenchMode=play produces play-stone intent', () => {
    it('returns RESOLVED status for empty vertex left-click', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'play',
        workbenchMode: 'play',
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
    })

    it('returns play-stone intent', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'play',
        workbenchMode: 'play',
      }))

      assert.strictEqual(result.intent, BOARD_INTENTS.PLAY_STONE)
    })

    it('preserves playMove mutationContract', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'play',
        workbenchMode: 'play',
        mutationContract: 'playMove',
      }))

      assert.strictEqual(result.mutationContract, 'playMove')
    })

    it('includes vertex in payload', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'play',
        workbenchMode: 'play',
        vertex: [4, 5],
      }))

      assert.deepStrictEqual(result.payload.vertex, [4, 5])
    })

    it('returns REJECTED for occupied point', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'play',
        workbenchMode: 'play',
        point: {sign: 1, markerType: null},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })
  })

  // --- W3-T11: workbenchMode='recall' + empty vertex -> submit-recall-answer + recallAnswer ---

  describe('W3-T11: workbenchMode=recall produces submit-recall-answer intent', () => {
    it('returns RESOLVED status for empty vertex left-click', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'recall',
        workbenchMode: 'recall',
        mutationContract: 'recallAnswer',
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
    })

    it('returns submit-recall-answer intent', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'recall',
        workbenchMode: 'recall',
        mutationContract: 'recallAnswer',
      }))

      assert.strictEqual(result.intent, BOARD_INTENTS.SUBMIT_RECALL_ANSWER)
    })

    it('preserves recallAnswer mutationContract', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'recall',
        workbenchMode: 'recall',
        mutationContract: 'recallAnswer',
      }))

      assert.strictEqual(result.mutationContract, 'recallAnswer')
    })

    it('includes vertex in payload', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'recall',
        workbenchMode: 'recall',
        mutationContract: 'recallAnswer',
        vertex: [10, 10],
      }))

      assert.deepStrictEqual(result.payload.vertex, [10, 10])
    })

    it('returns REJECTED for non-left button', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'recall',
        workbenchMode: 'recall',
        mutationContract: 'recallAnswer',
        event: {button: 2, ctrlKey: false, metaKey: false, isMac: false},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })
  })

  // --- W3-T12: workbenchMode='problem' + vertex outside problemArea -> REJECTED ---

  describe('W3-T12: workbenchMode=problem rejects vertex outside problemArea', () => {
    function makeProblemArea(vertices) {
      return {vertices}
    }

    it('accepts vertex inside problemArea', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'play',
        workbenchMode: 'problem',
        mutationContract: 'playMove',
        vertex: [3, 3],
        problemArea: makeProblemArea([[3, 3], [4, 4], [5, 5]]),
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.strictEqual(result.intent, BOARD_INTENTS.PLAY_STONE)
      assert.strictEqual(result.mutationContract, 'problemAttemptMove')
    })

    it('rejects vertex outside problemArea', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'play',
        workbenchMode: 'problem',
        mutationContract: 'playMove',
        vertex: [15, 15],
        problemArea: makeProblemArea([[3, 3], [4, 4], [5, 5]]),
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })

    it('accepts any vertex when problemArea is not set', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'play',
        workbenchMode: 'problem',
        mutationContract: 'playMove',
        vertex: [15, 15],
        problemArea: undefined,
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.strictEqual(result.mutationContract, 'problemAttemptMove')
    })

    it('accepts any vertex when problemArea is null', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'play',
        workbenchMode: 'problem',
        mutationContract: 'playMove',
        vertex: [15, 15],
        problemArea: null,
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.strictEqual(result.mutationContract, 'problemAttemptMove')
    })
  })

  // --- W3-T18: play mode + playerConfig current side=AI -> REJECTED ---

  describe('W3-T18: play mode AI turn rejects board clicks', () => {
    it('rejects click when playerConfig indicates AI turn', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'play',
        workbenchMode: 'play',
        mutationContract: 'playMove',
        vertex: [3, 3],
        playerConfig: {currentSide: 'ai'},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })

    it('accepts click when playerConfig indicates human turn', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'play',
        workbenchMode: 'play',
        mutationContract: 'playMove',
        vertex: [3, 3],
        playerConfig: {currentSide: 'human'},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.strictEqual(result.intent, BOARD_INTENTS.PLAY_STONE)
    })

    it('accepts click when playerConfig is absent (default to human)', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'play',
        workbenchMode: 'play',
        mutationContract: 'playMove',
        vertex: [3, 3],
        playerConfig: undefined,
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
    })

    it('accepts click when playerConfig is null (default to human)', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'play',
        workbenchMode: 'play',
        mutationContract: 'playMove',
        vertex: [3, 3],
        playerConfig: null,
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
    })
  })

  // --- Legacy behavior preserved when workbenchMode is absent ---

  describe('Legacy mode string behavior preserved (migration seam)', () => {
    it('play mode string without workbenchMode still works', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'play',
        // workbenchMode intentionally omitted
      }))

      assert.strictEqual(result.intent, BOARD_INTENTS.PLAY_STONE)
      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
    })

    it('recall mode string without workbenchMode still works', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'recall',
        mutationContract: 'recallAnswer',
        // workbenchMode intentionally omitted
      }))

      assert.strictEqual(result.intent, BOARD_INTENTS.SUBMIT_RECALL_ANSWER)
      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
    })

    it('analysis mode string without workbenchMode uses legacy fallback', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'analysis',
        editWorkspacePresent: false,
        // workbenchMode intentionally omitted
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.DEFERRED)
    })
  })

  // ===================================================================
  // Matrix 1.2 gap fillers — problem mode extended coverage
  // ===================================================================

  describe('Problem mode: right-click produces DEFERRED legacy intent', () => {
    it('right-click in problem mode returns DEFERRED legacy-play-right-click', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'play',
        workbenchMode: 'problem',
        mutationContract: 'playMove',
        vertex: [3, 3],
        problemArea: {vertices: [[3, 3]]},
        event: {button: 2, ctrlKey: false, metaKey: false, isMac: false},
      }))

      // problem routes to resolvePlay; right-click in play returns DEFERRED
      assert.strictEqual(result.status, RESOLVE_STATUSES.DEFERRED)
      assert.strictEqual(result.intent, BOARD_INTENTS.LEGACY_PLAY_RIGHT_CLICK)
    })

    it('Mac ctrl+left-click in problem mode treated as right-click', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'play',
        workbenchMode: 'problem',
        mutationContract: 'playMove',
        vertex: [3, 3],
        problemArea: {vertices: [[3, 3]]},
        event: {button: 0, ctrlKey: true, metaKey: false, isMac: true},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.DEFERRED)
      assert.strictEqual(result.intent, BOARD_INTENTS.LEGACY_PLAY_RIGHT_CLICK)
    })
  })

  describe('Problem mode: occupied vertex inside problemArea is REJECTED', () => {
    it('left-click on occupied point inside problemArea is rejected', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'play',
        workbenchMode: 'problem',
        mutationContract: 'playMove',
        vertex: [3, 3],
        problemArea: {vertices: [[3, 3]]},
        point: {sign: 1, markerType: null},
      }))

      // problem area check passes, but resolvePlay rejects occupied
      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })
  })

  describe('Problem mode: middle button is REJECTED', () => {
    it('middle button (button=1) in problem mode is rejected', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'play',
        workbenchMode: 'problem',
        mutationContract: 'playMove',
        vertex: [3, 3],
        problemArea: {vertices: [[3, 3]]},
        event: {button: 1, ctrlKey: false, metaKey: false, isMac: false},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })
  })

  describe('Problem mode: AI turn is REJECTED', () => {
    it('AI turn in problem mode rejects click even inside problemArea', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'play',
        workbenchMode: 'problem',
        mutationContract: 'playMove',
        vertex: [3, 3],
        problemArea: {vertices: [[3, 3]]},
        playerConfig: {currentSide: 'ai'},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })
  })

  // ===================================================================
  // Matrix 1.2: recall mode — occupied point click
  // ===================================================================

  describe('Recall mode: occupied point click is REJECTED', () => {
    it('left-click on black stone returns REJECTED', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'recall',
        workbenchMode: 'recall',
        mutationContract: 'recallAnswer',
        point: {sign: 1, markerType: null},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })

    it('left-click on white stone returns REJECTED', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'recall',
        workbenchMode: 'recall',
        mutationContract: 'recallAnswer',
        point: {sign: -1, markerType: null},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })
  })

  describe('Recall mode: middle button is REJECTED', () => {
    it('middle button (button=1) returns REJECTED', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'recall',
        workbenchMode: 'recall',
        mutationContract: 'recallAnswer',
        event: {button: 1, ctrlKey: false, metaKey: false, isMac: false},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })
  })

  // ===================================================================
  // Matrix 1.2: analysis mode with editWorkspace — tool-dependent intents
  // ===================================================================

  describe('Analysis editWorkspace: tool=stone_1 produces place-black-stone', () => {
    it('on empty point returns RESOLVED with place action', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'analysis',
        workbenchMode: 'analysis',
        editWorkspacePresent: true,
        selectedTool: 'stone_1',
        mutationContract: 'scratchEdit',
        point: {sign: 0, markerType: null},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.strictEqual(result.intent, BOARD_INTENTS.PLACE_BLACK_STONE)
      assert.strictEqual(result.mutationContract, 'scratchEdit')
      assert.strictEqual(result.payload.action, 'place')
      assert.strictEqual(result.payload.sign, 1)
    })

    it('on same-color stone returns RESOLVED with remove action', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'analysis',
        workbenchMode: 'analysis',
        editWorkspacePresent: true,
        selectedTool: 'stone_1',
        mutationContract: 'scratchEdit',
        point: {sign: 1, markerType: null},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.strictEqual(result.intent, BOARD_INTENTS.PLACE_BLACK_STONE)
      assert.strictEqual(result.payload.action, 'remove')
    })

    it('on opposite-color stone returns RESOLVED with place action', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'analysis',
        workbenchMode: 'analysis',
        editWorkspacePresent: true,
        selectedTool: 'stone_1',
        mutationContract: 'scratchEdit',
        point: {sign: -1, markerType: null},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.strictEqual(result.intent, BOARD_INTENTS.PLACE_BLACK_STONE)
      assert.strictEqual(result.payload.action, 'place')
    })
  })

  describe('Analysis editWorkspace: tool=stone_-1 produces place-white-stone', () => {
    it('on empty point returns RESOLVED with place action', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'analysis',
        workbenchMode: 'analysis',
        editWorkspacePresent: true,
        selectedTool: 'stone_-1',
        mutationContract: 'scratchEdit',
        point: {sign: 0, markerType: null},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.strictEqual(result.intent, BOARD_INTENTS.PLACE_WHITE_STONE)
      assert.strictEqual(result.mutationContract, 'scratchEdit')
      assert.strictEqual(result.payload.action, 'place')
      assert.strictEqual(result.payload.sign, -1)
    })

    it('on same-color stone returns RESOLVED with remove action', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'analysis',
        workbenchMode: 'analysis',
        editWorkspacePresent: true,
        selectedTool: 'stone_-1',
        mutationContract: 'scratchEdit',
        point: {sign: -1, markerType: null},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.strictEqual(result.intent, BOARD_INTENTS.PLACE_WHITE_STONE)
      assert.strictEqual(result.payload.action, 'remove')
    })
  })

  describe('Analysis editWorkspace: right-click toggles stone tool color', () => {
    it('right-click with stone_1 tool toggles to place-white-stone', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'analysis',
        workbenchMode: 'analysis',
        editWorkspacePresent: true,
        selectedTool: 'stone_1',
        mutationContract: 'scratchEdit',
        point: {sign: 0, markerType: null},
        event: {button: 2, ctrlKey: false, metaKey: false, isMac: false},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.strictEqual(result.intent, BOARD_INTENTS.PLACE_WHITE_STONE)
    })

    it('right-click with stone_-1 tool toggles to place-black-stone', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'analysis',
        workbenchMode: 'analysis',
        editWorkspacePresent: true,
        selectedTool: 'stone_-1',
        mutationContract: 'scratchEdit',
        point: {sign: 0, markerType: null},
        event: {button: 2, ctrlKey: false, metaKey: false, isMac: false},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.strictEqual(result.intent, BOARD_INTENTS.PLACE_BLACK_STONE)
    })

    it('right-click with label tool is REJECTED (menu action)', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'analysis',
        workbenchMode: 'analysis',
        editWorkspacePresent: true,
        selectedTool: 'label',
        mutationContract: 'scratchEdit',
        event: {button: 2, ctrlKey: false, metaKey: false, isMac: false},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })

    it('right-click with number tool is REJECTED (menu action)', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'analysis',
        workbenchMode: 'analysis',
        editWorkspacePresent: true,
        selectedTool: 'number',
        mutationContract: 'scratchEdit',
        event: {button: 2, ctrlKey: false, metaKey: false, isMac: false},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })
  })

  describe('Analysis editWorkspace: tool=eraser produces erase-stone', () => {
    it('on any point returns RESOLVED erase-stone', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'analysis',
        workbenchMode: 'analysis',
        editWorkspacePresent: true,
        selectedTool: 'eraser',
        mutationContract: 'scratchEdit',
        point: {sign: 1, markerType: null},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.strictEqual(result.intent, BOARD_INTENTS.ERASE_STONE)
      assert.strictEqual(result.mutationContract, 'scratchEdit')
    })
  })

  describe('Analysis editWorkspace: tool=play produces play-stone (scratch)', () => {
    it('on empty point returns RESOLVED play-stone', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'analysis',
        workbenchMode: 'analysis',
        editWorkspacePresent: true,
        selectedTool: 'play',
        mutationContract: 'scratchEdit',
        point: {sign: 0, markerType: null},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.strictEqual(result.intent, BOARD_INTENTS.PLAY_STONE)
      assert.strictEqual(result.mutationContract, 'scratchEdit')
    })

    it('on occupied point returns REJECTED', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'analysis',
        workbenchMode: 'analysis',
        editWorkspacePresent: true,
        selectedTool: 'play',
        mutationContract: 'scratchEdit',
        point: {sign: 1, markerType: null},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })
  })

  describe('Analysis editWorkspace: marker tools produce mark-point', () => {
    const markerTools = ['cross', 'triangle', 'square', 'circle', 'label', 'number']

    markerTools.forEach(tool => {
      it(`tool=${tool} returns RESOLVED mark-point`, () => {
        const result = resolveBoardInteraction(baseResolverInput({
          mode: 'analysis',
          workbenchMode: 'analysis',
          editWorkspacePresent: true,
          selectedTool: tool,
          mutationContract: 'scratchEdit',
          point: {sign: 0, markerType: null},
        }))

        assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
        assert.strictEqual(result.intent, BOARD_INTENTS.MARK_POINT)
        assert.strictEqual(result.payload.markerType, tool)
      })
    })

    it('mark-point works on occupied point too (markers overlay stones)', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'analysis',
        workbenchMode: 'analysis',
        editWorkspacePresent: true,
        selectedTool: 'triangle',
        mutationContract: 'scratchEdit',
        point: {sign: 1, markerType: null},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.strictEqual(result.intent, BOARD_INTENTS.MARK_POINT)
    })
  })

  describe('Analysis editWorkspace: line/arrow tools produce draw-line', () => {
    it('tool=line returns RESOLVED draw-line with lineType=line', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'analysis',
        workbenchMode: 'analysis',
        editWorkspacePresent: true,
        selectedTool: 'line',
        mutationContract: 'scratchEdit',
        point: {sign: 0, markerType: null},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.strictEqual(result.intent, BOARD_INTENTS.DRAW_LINE)
      assert.strictEqual(result.payload.lineType, 'line')
    })

    it('tool=arrow returns RESOLVED draw-line with lineType=arrow', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'analysis',
        workbenchMode: 'analysis',
        editWorkspacePresent: true,
        selectedTool: 'arrow',
        mutationContract: 'scratchEdit',
        point: {sign: 0, markerType: null},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.strictEqual(result.intent, BOARD_INTENTS.DRAW_LINE)
      assert.strictEqual(result.payload.lineType, 'arrow')
    })
  })

  describe('Analysis editWorkspace: drag-stone intent', () => {
    it('sourceVertex with stone to empty target produces drag-stone', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'analysis',
        workbenchMode: 'analysis',
        editWorkspacePresent: true,
        selectedTool: 'stone_1',
        mutationContract: 'scratchEdit',
        vertex: [5, 5],
        sourceVertex: [3, 3],
        sourcePoint: {sign: 1, markerType: null},
        point: {sign: 0, markerType: null},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.RESOLVED)
      assert.strictEqual(result.intent, BOARD_INTENTS.DRAG_STONE)
      assert.deepStrictEqual(result.payload.source, [3, 3])
      assert.deepStrictEqual(result.payload.target, [5, 5])
    })

    it('drag to same vertex is REJECTED', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'analysis',
        workbenchMode: 'analysis',
        editWorkspacePresent: true,
        selectedTool: 'stone_1',
        mutationContract: 'scratchEdit',
        vertex: [3, 3],
        sourceVertex: [3, 3],
        sourcePoint: {sign: 1, markerType: null},
        point: {sign: 0, markerType: null},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })

    it('drag from empty source is REJECTED', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'analysis',
        workbenchMode: 'analysis',
        editWorkspacePresent: true,
        selectedTool: 'stone_1',
        mutationContract: 'scratchEdit',
        vertex: [5, 5],
        sourceVertex: [3, 3],
        sourcePoint: {sign: 0, markerType: null},
        point: {sign: 0, markerType: null},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })

    it('drag to occupied target is REJECTED', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'analysis',
        workbenchMode: 'analysis',
        editWorkspacePresent: true,
        selectedTool: 'stone_1',
        mutationContract: 'scratchEdit',
        vertex: [5, 5],
        sourceVertex: [3, 3],
        sourcePoint: {sign: 1, markerType: null},
        point: {sign: -1, markerType: null},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })

    it('drag with non-left button is REJECTED', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'analysis',
        workbenchMode: 'analysis',
        editWorkspacePresent: true,
        selectedTool: 'stone_1',
        mutationContract: 'scratchEdit',
        vertex: [5, 5],
        sourceVertex: [3, 3],
        sourcePoint: {sign: 1, markerType: null},
        point: {sign: 0, markerType: null},
        event: {button: 2, ctrlKey: false, metaKey: false, isMac: false},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })
  })

  describe('Analysis editWorkspace: unknown tool is REJECTED', () => {
    it('unknown tool string returns REJECTED', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'analysis',
        workbenchMode: 'analysis',
        editWorkspacePresent: true,
        selectedTool: 'nonexistent_tool',
        mutationContract: 'scratchEdit',
        point: {sign: 0, markerType: null},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })
  })

  describe('Analysis editWorkspace: unsupported button is REJECTED', () => {
    it('middle button (button=1) returns REJECTED', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'analysis',
        workbenchMode: 'analysis',
        editWorkspacePresent: true,
        selectedTool: 'stone_1',
        mutationContract: 'scratchEdit',
        point: {sign: 0, markerType: null},
        event: {button: 1, ctrlKey: false, metaKey: false, isMac: false},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })
  })

  // ===================================================================
  // Matrix 1.2: analysis mode without editWorkspace — DEFERRED
  // ===================================================================

  describe('Analysis workbenchMode without editWorkspace returns DEFERRED', () => {
    it('analysis mode with editWorkspacePresent=false returns DEFERRED', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'analysis',
        workbenchMode: 'analysis',
        editWorkspacePresent: false,
        selectedTool: 'stone_1',
        mutationContract: 'scratchEdit',
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.DEFERRED)
      assert.strictEqual(result.intent, BOARD_INTENTS.LEGACY_SGF_EDIT)
    })
  })

  // ===================================================================
  // Matrix 1.2: play mode edge cases
  // ===================================================================

  describe('Play mode: right-click returns DEFERRED legacy intent', () => {
    it('right-click (button=2) returns DEFERRED legacy-play-right-click', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'play',
        workbenchMode: 'play',
        mutationContract: 'playMove',
        event: {button: 2, ctrlKey: false, metaKey: false, isMac: false},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.DEFERRED)
      assert.strictEqual(result.intent, BOARD_INTENTS.LEGACY_PLAY_RIGHT_CLICK)
    })

    it('Mac ctrl+left-click returns DEFERRED legacy-play-right-click', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'play',
        workbenchMode: 'play',
        mutationContract: 'playMove',
        event: {button: 0, ctrlKey: true, metaKey: false, isMac: true},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.DEFERRED)
      assert.strictEqual(result.intent, BOARD_INTENTS.LEGACY_PLAY_RIGHT_CLICK)
    })
  })

  describe('Play mode: middle button (button=1) is REJECTED', () => {
    it('middle button returns REJECTED', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'play',
        workbenchMode: 'play',
        mutationContract: 'playMove',
        event: {button: 1, ctrlKey: false, metaKey: false, isMac: false},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })
  })

  // ===================================================================
  // Legacy: scoring/estimator modes
  // ===================================================================

  describe('Legacy scoring: left-click stone returns DEFERRED toggle-dead-stones', () => {
    it('scoring mode left-click on stone returns DEFERRED', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'scoring',
        point: {sign: 1, markerType: null},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.DEFERRED)
      assert.strictEqual(result.intent, BOARD_INTENTS.LEGACY_TOGGLE_DEAD_STONES)
    })

    it('scoring mode left-click on empty returns REJECTED', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'scoring',
        point: {sign: 0, markerType: null},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })

    it('scoring mode right-click returns REJECTED', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'scoring',
        point: {sign: 1, markerType: null},
        event: {button: 2, ctrlKey: false, metaKey: false, isMac: false},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })
  })

  describe('Legacy estimator: left-click stone returns DEFERRED toggle-dead-stones', () => {
    it('estimator mode left-click on stone returns DEFERRED', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'estimator',
        point: {sign: 1, markerType: null},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.DEFERRED)
      assert.strictEqual(result.intent, BOARD_INTENTS.LEGACY_TOGGLE_DEAD_STONES)
    })

    it('estimator mode left-click on empty returns REJECTED', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'estimator',
        point: {sign: 0, markerType: null},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })
  })

  // ===================================================================
  // Legacy: find mode
  // ===================================================================

  describe('Legacy find: left-click returns DEFERRED legacy-find-move', () => {
    it('find mode left-click returns DEFERRED', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'find',
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.DEFERRED)
      assert.strictEqual(result.intent, BOARD_INTENTS.LEGACY_FIND_MOVE)
    })

    it('find mode right-click returns REJECTED', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'find',
        event: {button: 2, ctrlKey: false, metaKey: false, isMac: false},
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })
  })

  // ===================================================================
  // Legacy: unknown mode
  // ===================================================================

  describe('Legacy unknown mode returns REJECTED', () => {
    it('unknown mode string without workbenchMode returns REJECTED', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'nonexistent_mode',
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.REJECTED)
    })
  })

  // ===================================================================
  // Legacy: autoplay mode
  // ===================================================================

  describe('Legacy autoplay returns DEFERRED', () => {
    it('autoplay mode returns DEFERRED legacy-autoplay', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'autoplay',
      }))

      assert.strictEqual(result.status, RESOLVE_STATUSES.DEFERRED)
      assert.strictEqual(result.intent, BOARD_INTENTS.LEGACY_AUTOPLAY)
    })
  })

  // ===================================================================
  // Scratch edit contract: analysis mutations must not carry playMove
  // ===================================================================

  describe('Analysis editWorkspace: mutationContract is scratchEdit, not playMove', () => {
    it('place-black-stone carries scratchEdit contract, not playMove', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'analysis',
        workbenchMode: 'analysis',
        editWorkspacePresent: true,
        selectedTool: 'stone_1',
        mutationContract: 'scratchEdit',
        point: {sign: 0, markerType: null},
      }))

      assert.strictEqual(result.mutationContract, 'scratchEdit')
      assert.notStrictEqual(result.mutationContract, 'playMove')
    })

    it('erase-stone carries scratchEdit contract', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'analysis',
        workbenchMode: 'analysis',
        editWorkspacePresent: true,
        selectedTool: 'eraser',
        mutationContract: 'scratchEdit',
        point: {sign: 1, markerType: null},
      }))

      assert.strictEqual(result.mutationContract, 'scratchEdit')
    })

    it('mark-point carries scratchEdit contract', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'analysis',
        workbenchMode: 'analysis',
        editWorkspacePresent: true,
        selectedTool: 'triangle',
        mutationContract: 'scratchEdit',
        point: {sign: 0, markerType: null},
      }))

      assert.strictEqual(result.mutationContract, 'scratchEdit')
    })

    it('drag-stone carries scratchEdit contract', () => {
      const result = resolveBoardInteraction(baseResolverInput({
        mode: 'analysis',
        workbenchMode: 'analysis',
        editWorkspacePresent: true,
        selectedTool: 'stone_1',
        mutationContract: 'scratchEdit',
        vertex: [5, 5],
        sourceVertex: [3, 3],
        sourcePoint: {sign: 1, markerType: null},
        point: {sign: 0, markerType: null},
      }))

      assert.strictEqual(result.mutationContract, 'scratchEdit')
    })
  })
})
