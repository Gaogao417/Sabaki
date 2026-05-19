/**
 * W3 Goban Resolver Tests — resolveBoardInteraction WorkbenchMode extension
 *
 * Test contract: docs/design/2026-05-19/workbench-wiring/w3-goban-wiring-contract-v0.1.md
 * Contracts covered: W3-T10, W3-T11, W3-T12, W3-T18
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
})