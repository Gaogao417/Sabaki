/**
 * W3 Goban Projection Tests — projectGobanProps pure function
 *
 * Test contract: docs/design/2026-05-19/workbench-wiring/w3-goban-wiring-contract-v0.1.md
 * Contracts covered: W3-T01, W3-T02, W3-T03, W3-T04, W3-T05, W3-T06, W3-T07, W3-T08,
 *                    W3-T19, W3-T21, W3-T23,
 *                    W3-T24 (problem mode projection), W3-T25 (play overlay policy),
 *                    W3-T26 (recall overlay policy — CRITICAL), W3-T27 (analysis+editWS overlay policy),
 *                    W3-T28 (analysis no editWS overlay policy), W3-T29 (submitAttempt full diff),
 *                    W3-T30 (enterAnalysis full diff), W3-T31 (returnFromAnalysis -> play full restore),
 *                    W3-T32 (returnFromAnalysis -> recall full restore), W3-T33 (settings passthrough),
 *                    W3-T34 (problem overlay policy mirrors play)
 *
 * Source of truth alignment:
 *   - Contract Section 7: projectGobanProps Function Spec
 *   - Matrix Section 2.3: Overlay Activation by Mode
 *   - Matrix Section 3.1-3.3: Goban Props by Mode
 *   - Matrix Section 4.1-4.5: Mode Transition Effects on Goban
 *   - Arch v0.5 Section 14: analysis must not pollute Attempt.userLine
 *
 * Test Legitimacy:
 *   All tests import projectGobanProps from production code.
 *   Production module missing -> tryImport returns null -> this.skip(), no silent pass.
 *   Controlled dependencies: inline input objects.
 *
 * NOTE: projectGobanProps is a TO-BE-CREATED pure function at
 *       src/modules/training/workbench/projectGobanProps.ts
 */

import assert from 'assert'
import {tryImport} from '../tryImport.js'

let projectGobanProps = null

describe('W3 Goban Projection: projectGobanProps', function () {
  before(async function () {
    projectGobanProps = await tryImport(
      'src/modules/training/workbench/projectGobanProps.ts',
    )
    if (!projectGobanProps) this.skip()
  })

  // --- Helpers ---

  function baseInput(overrides = {}) {
    return {
      workbenchMode: 'play',
      task: {problemArea: null, prompt: null, goal: null},
      runtimeState: {},
      boardState: {
        gameTree: {id: 'gt_1'},
        treePosition: 'node_1',
        board: {width: 19, height: 19, signMap: []},
      },
      overlayState: {
        paintMap: [],
        markerMap: [],
        dimmedStones: [],
        analysis: null,
      },
      settings: {
        showMoveNumbers: false,
        showNextMoves: true,
        showSiblings: true,
        showAnalysis: true,
        showCoordinates: true,
        showHumanPreference: false,
        selectedTool: 'stone_1',
        editWorkspaceActive: false,
        boardTransformation: [1, 0, 0, 1, 0, 0],
        areaSelectMode: false,
      },
      analysisData: null,
      ...overrides,
    }
  }

  // --- W3-T01: play mode projection ---

  describe('W3-T01: projectGobanProps(play)', () => {
    it('returns showMoveNumbers=false', () => {
      const result = projectGobanProps(baseInput({workbenchMode: 'play'}))
      assert.strictEqual(result.overlayDisplayProps.showMoveNumbers, false)
    })

    it('returns showNextMoves from settings', () => {
      const result = projectGobanProps(
        baseInput({workbenchMode: 'play', settings: {
          ...baseInput().settings,
          showNextMoves: true,
        }}),
      )
      assert.strictEqual(result.overlayDisplayProps.showNextMoves, true)
    })

    it('returns dragMode=false', () => {
      const result = projectGobanProps(baseInput({workbenchMode: 'play'}))
      assert.strictEqual(result.interactionProps.dragMode, false)
    })

    it('returns drawLineMode=null', () => {
      const result = projectGobanProps(baseInput({workbenchMode: 'play'}))
      assert.strictEqual(result.interactionProps.drawLineMode, null)
    })

    it('returns dimmedStones as empty array', () => {
      const result = projectGobanProps(baseInput({workbenchMode: 'play'}))
      assert.deepStrictEqual(result.overlayDisplayProps.dimmedStones, [])
    })

    it('returns crosshair=false', () => {
      const result = projectGobanProps(baseInput({workbenchMode: 'play'}))
      assert.strictEqual(result.overlayDisplayProps.crosshair, false)
    })

    it('returns onStoneDragEnd=null', () => {
      const result = projectGobanProps(baseInput({workbenchMode: 'play'}))
      assert.strictEqual(result.handlerProps.onStoneDragEnd, null)
    })

    it('returns onPlayVariationMoves=null', () => {
      const result = projectGobanProps(baseInput({workbenchMode: 'play'}))
      assert.strictEqual(result.handlerProps.onPlayVariationMoves, null)
    })
  })

  // --- W3-T02: recall mode projection ---

  describe('W3-T02: projectGobanProps(recall)', () => {
    it('returns showMoveNumbers=true', () => {
      const result = projectGobanProps(baseInput({workbenchMode: 'recall'}))
      assert.strictEqual(result.overlayDisplayProps.showMoveNumbers, true)
    })

    it('returns showNextMoves=false regardless of settings', () => {
      const result = projectGobanProps(
        baseInput({workbenchMode: 'recall', settings: {
          ...baseInput().settings,
          showNextMoves: true,
        }}),
      )
      assert.strictEqual(result.overlayDisplayProps.showNextMoves, false)
    })

    it('returns showSiblings=false regardless of settings', () => {
      const result = projectGobanProps(
        baseInput({workbenchMode: 'recall', settings: {
          ...baseInput().settings,
          showSiblings: true,
        }}),
      )
      assert.strictEqual(result.overlayDisplayProps.showSiblings, false)
    })

    it('returns analysis=null', () => {
      const result = projectGobanProps(baseInput({workbenchMode: 'recall'}))
      assert.strictEqual(result.overlayDisplayProps.analysis, null)
    })

    it('returns dragMode=false', () => {
      const result = projectGobanProps(baseInput({workbenchMode: 'recall'}))
      assert.strictEqual(result.interactionProps.dragMode, false)
    })

    it('returns dimmedStones as empty array', () => {
      const result = projectGobanProps(baseInput({workbenchMode: 'recall'}))
      assert.deepStrictEqual(result.overlayDisplayProps.dimmedStones, [])
    })
  })

  // --- W3-T03: analysis mode with editWorkspace ---

  describe('W3-T03: projectGobanProps(analysis + editWorkspace)', () => {
    function analysisInput(overrides = {}) {
      return baseInput({
        workbenchMode: 'analysis',
        settings: {
          ...baseInput().settings,
          editWorkspaceActive: true,
          showMoveNumbers: false,
          showNextMoves: true,
          showSiblings: true,
          ...overrides.settings,
        },
        ...overrides,
      })
    }

    it('returns dragMode=true', () => {
      const result = projectGobanProps(analysisInput())
      assert.strictEqual(result.interactionProps.dragMode, true)
    })

    it('returns drawLineMode from selectedTool when tool is arrow', () => {
      const result = projectGobanProps(analysisInput({
        settings: {
          ...baseInput().settings,
          editWorkspaceActive: true,
          selectedTool: 'arrow',
        },
      }))
      assert.strictEqual(result.interactionProps.drawLineMode, 'arrow')
    })

    it('returns drawLineMode from selectedTool when tool is line', () => {
      const result = projectGobanProps(analysisInput({
        settings: {
          ...baseInput().settings,
          editWorkspaceActive: true,
          selectedTool: 'line',
        },
      }))
      assert.strictEqual(result.interactionProps.drawLineMode, 'line')
    })

    it('returns drawLineMode=null when tool is stone_1', () => {
      const result = projectGobanProps(analysisInput({
        settings: {
          ...baseInput().settings,
          editWorkspaceActive: true,
          selectedTool: 'stone_1',
        },
      }))
      assert.strictEqual(result.interactionProps.drawLineMode, null)
    })

    it('returns drawLineMode=null when tool is cross', () => {
      const result = projectGobanProps(analysisInput({
        settings: {
          ...baseInput().settings,
          editWorkspaceActive: true,
          selectedTool: 'cross',
        },
      }))
      assert.strictEqual(result.interactionProps.drawLineMode, null)
    })

    it('returns showMoveNumbers from settings', () => {
      const result = projectGobanProps(analysisInput({
        settings: {
          ...baseInput().settings,
          editWorkspaceActive: true,
          showMoveNumbers: true,
        },
      }))
      assert.strictEqual(result.overlayDisplayProps.showMoveNumbers, true)
    })

    it('provides onStoneDragEnd handler', () => {
      const result = projectGobanProps(analysisInput())
      assert.strictEqual(typeof result.handlerProps.onStoneDragEnd, 'function')
    })

    it('provides onPlayVariationMoves handler', () => {
      const result = projectGobanProps(analysisInput())
      assert.strictEqual(typeof result.handlerProps.onPlayVariationMoves, 'function')
    })
  })

  // --- W3-T04: analysis mode without editWorkspace ---

  describe('W3-T04: projectGobanProps(analysis + no editWorkspace)', () => {
    function legacyAnalysisInput(overrides = {}) {
      return baseInput({
        workbenchMode: 'analysis',
        settings: {
          ...baseInput().settings,
          editWorkspaceActive: false,
          ...overrides.settings,
        },
        ...overrides,
      })
    }

    it('returns dragMode=false', () => {
      const result = projectGobanProps(legacyAnalysisInput())
      assert.strictEqual(result.interactionProps.dragMode, false)
    })

    it('returns drawLineMode=null', () => {
      const result = projectGobanProps(legacyAnalysisInput())
      assert.strictEqual(result.interactionProps.drawLineMode, null)
    })

    it('returns onStoneDragEnd=null', () => {
      const result = projectGobanProps(legacyAnalysisInput())
      assert.strictEqual(result.handlerProps.onStoneDragEnd, null)
    })

    it('returns onPlayVariationMoves=null', () => {
      const result = projectGobanProps(legacyAnalysisInput())
      assert.strictEqual(result.handlerProps.onPlayVariationMoves, null)
    })
  })

  // --- W3-T05: submitAttempt transition changes props from play to recall ---

  describe('W3-T05: submitAttempt play-to-recall projection change', () => {
    it('play props differ from recall props on showMoveNumbers', () => {
      const playResult = projectGobanProps(baseInput({workbenchMode: 'play'}))
      const recallResult = projectGobanProps(baseInput({workbenchMode: 'recall'}))

      assert.notStrictEqual(
        playResult.overlayDisplayProps.showMoveNumbers,
        recallResult.overlayDisplayProps.showMoveNumbers,
        'showMoveNumbers should change from play to recall',
      )
      assert.strictEqual(playResult.overlayDisplayProps.showMoveNumbers, false)
      assert.strictEqual(recallResult.overlayDisplayProps.showMoveNumbers, true)
    })

    it('play props differ from recall props on showNextMoves', () => {
      const playResult = projectGobanProps(baseInput({workbenchMode: 'play'}))
      const recallResult = projectGobanProps(baseInput({workbenchMode: 'recall'}))

      assert.strictEqual(recallResult.overlayDisplayProps.showNextMoves, false)
    })

    it('play props differ from recall props on showSiblings', () => {
      const playResult = projectGobanProps(baseInput({workbenchMode: 'play'}))
      const recallResult = projectGobanProps(baseInput({workbenchMode: 'recall'}))

      assert.strictEqual(recallResult.overlayDisplayProps.showSiblings, false)
    })

    it('play props differ from recall props on analysis', () => {
      const recallResult = projectGobanProps(baseInput({workbenchMode: 'recall'}))
      assert.strictEqual(recallResult.overlayDisplayProps.analysis, null)
    })
  })

  // --- W3-T06: enterAnalysis transition changes props ---

  describe('W3-T06: enterAnalysis projection change', () => {
    it('gameTree in boardStateProps is passed through', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {
          ...baseInput().settings,
          editWorkspaceActive: true,
        },
      }))
      // projectGobanProps should pass through the boardState it receives.
      // The caller (Container) is responsible for providing the editWorkspace tree.
      assert.ok(result.boardStateProps)
    })

    it('dragMode changes from false (play) to true (analysis+editWS)', () => {
      const playResult = projectGobanProps(baseInput({workbenchMode: 'play'}))
      const analysisResult = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {
          ...baseInput().settings,
          editWorkspaceActive: true,
        },
      }))

      assert.strictEqual(playResult.interactionProps.dragMode, false)
      assert.strictEqual(analysisResult.interactionProps.dragMode, true)
    })

    it('drawLineMode depends on selectedTool in analysis', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {
          ...baseInput().settings,
          editWorkspaceActive: true,
          selectedTool: 'arrow',
        },
      }))
      assert.strictEqual(result.interactionProps.drawLineMode, 'arrow')
    })
  })

  // --- W3-T07: returnFromAnalysis restores previous mode projection ---

  describe('W3-T07: returnFromAnalysis restores previous mode projection', () => {
    it('play projection restores after analysis exits', () => {
      const originalResult = projectGobanProps(baseInput({workbenchMode: 'play'}))
      const analysisResult = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {
          ...baseInput().settings,
          editWorkspaceActive: true,
          selectedTool: 'arrow',
        },
      }))
      const restoredResult = projectGobanProps(baseInput({workbenchMode: 'play'}))

      assert.strictEqual(analysisResult.interactionProps.dragMode, true)
      assert.strictEqual(restoredResult.interactionProps.dragMode, false)
      assert.strictEqual(restoredResult.interactionProps.dragMode, originalResult.interactionProps.dragMode)
    })

    it('recall projection restores after analysis exits', () => {
      const originalResult = projectGobanProps(baseInput({workbenchMode: 'recall'}))
      const analysisResult = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {
          ...baseInput().settings,
          editWorkspaceActive: true,
        },
      }))
      const restoredResult = projectGobanProps(baseInput({workbenchMode: 'recall'}))

      assert.strictEqual(analysisResult.interactionProps.dragMode, true)
      assert.strictEqual(restoredResult.interactionProps.dragMode, false)
      assert.strictEqual(restoredResult.overlayDisplayProps.showMoveNumbers, true)
      assert.strictEqual(restoredResult.overlayDisplayProps.showMoveNumbers, originalResult.overlayDisplayProps.showMoveNumbers)
    })
  })

  // --- W3-T08: switchTaskTab re-projects from new tab ---

  describe('W3-T08: switchTaskTab re-projects', () => {
    it('re-projecting with a different mode produces different overlay props', () => {
      const playResult = projectGobanProps(baseInput({workbenchMode: 'play'}))
      const problemResult = projectGobanProps(baseInput({workbenchMode: 'problem'}))

      // Both play and problem have showMoveNumbers=false, but the point is
      // that projectGobanProps produces distinct results per mode.
      // A more meaningful switch would be play -> recall:
      const recallResult = projectGobanProps(baseInput({workbenchMode: 'recall'}))

      assert.notStrictEqual(
        playResult.overlayDisplayProps.showMoveNumbers,
        recallResult.overlayDisplayProps.showMoveNumbers,
      )
    })

    it('re-projecting with different boardState produces different boardStateProps', () => {
      const boardA = {gameTree: {id: 'gt_a'}, treePosition: 'node_a', board: {width: 9, height: 9, signMap: []}}
      const boardB = {gameTree: {id: 'gt_b'}, treePosition: 'node_b', board: {width: 19, height: 19, signMap: []}}

      const resultA = projectGobanProps(baseInput({boardState: boardA}))
      const resultB = projectGobanProps(baseInput({boardState: boardB}))

      assert.strictEqual(resultA.boardStateProps.gameTree.id, 'gt_a')
      assert.strictEqual(resultB.boardStateProps.gameTree.id, 'gt_b')
    })
  })

  // --- W3-T19: submitAttempt: projectGobanProps re-projection shows recall start position ---

  describe('W3-T19: submitAttempt recall start position in projection', () => {
    it('recall projection uses the provided treePosition (recall start)', () => {
      const recallStartPosition = 'node_recall_start'
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        boardState: {
          gameTree: {id: 'gt_1'},
          treePosition: recallStartPosition,
          board: {width: 19, height: 19, signMap: []},
        },
      }))

      assert.strictEqual(result.boardStateProps.treePosition, recallStartPosition)
    })

    it('recall projection shows showMoveNumbers=true for recall start', () => {
      const result = projectGobanProps(baseInput({workbenchMode: 'recall'}))
      assert.strictEqual(result.overlayDisplayProps.showMoveNumbers, true)
    })
  })

  // --- W3-T21: null gameTree returns safe defaults ---

  describe('W3-T21: null gameTree returns safe defaults', () => {
    it('returns boardStateProps.gameTree as null when input gameTree is null', () => {
      const result = projectGobanProps(baseInput({
        boardState: {
          gameTree: null,
          treePosition: '',
          board: {width: 19, height: 19, signMap: []},
        },
      }))
      assert.strictEqual(result.boardStateProps.gameTree, null)
    })

    it('still returns overlay props when gameTree is null', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        boardState: {
          gameTree: null,
          treePosition: '',
          board: {width: 19, height: 19, signMap: []},
        },
      }))
      assert.ok(result.overlayDisplayProps)
      assert.strictEqual(result.overlayDisplayProps.showMoveNumbers, false)
      assert.strictEqual(result.interactionProps.dragMode, false)
    })
  })

  // --- W3-T23: play mode AI turn handler rejects clicks ---

  describe('W3-T23: play mode AI turn projection', () => {
    it('projectGobanProps still produces valid props regardless of playerConfig', () => {
      // projectGobanProps is a pure projection function; it does not know about
      // playerConfig directly. The handler for AI turn rejection is at the resolver
      // level (W3-T18). projectGobanProps always produces the same structural output
      // for play mode. The AI-turn gating is done by the resolver rejecting clicks.
      const result = projectGobanProps(baseInput({workbenchMode: 'play'}))
      assert.strictEqual(typeof result.handlerProps.onVertexClick, 'function')
      assert.strictEqual(result.interactionProps.dragMode, false)
    })
  })

  // ====================================================================
  // EXPANDED PROJECTION MATRIX COVERAGE
  // Contract: Section 7 Per-Mode Behavior table
  // Matrix: Section 2.3 Overlay Activation, Section 3.1-3.3 Goban Props
  // ====================================================================

  // --- W3-T24: problem mode projection (Contract Section 7, play-equivalent) ---

  describe('W3-T24: projectGobanProps(problem) — play-equivalent projection', () => {
    it('returns showMoveNumbers=false', () => {
      const result = projectGobanProps(baseInput({workbenchMode: 'problem'}))
      assert.strictEqual(result.overlayDisplayProps.showMoveNumbers, false)
    })

    it('returns showNextMoves from settings (true)', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        settings: {...baseInput().settings, showNextMoves: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.showNextMoves, true)
    })

    it('returns showNextMoves from settings (false)', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        settings: {...baseInput().settings, showNextMoves: false},
      }))
      assert.strictEqual(result.overlayDisplayProps.showNextMoves, false)
    })

    it('returns showSiblings from settings (true)', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        settings: {...baseInput().settings, showSiblings: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.showSiblings, true)
    })

    it('returns showSiblings from settings (false)', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        settings: {...baseInput().settings, showSiblings: false},
      }))
      assert.strictEqual(result.overlayDisplayProps.showSiblings, false)
    })

    it('returns analysis from overlayState when showAnalysis=true', () => {
      const analysisObj = {type: 'winrate', data: [0.6]}
      const result = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        overlayState: {
          ...baseInput().overlayState,
          analysis: analysisObj,
        },
        settings: {...baseInput().settings, showAnalysis: true},
      }))
      assert.deepStrictEqual(result.overlayDisplayProps.analysis, analysisObj)
    })

    it('returns analysis=null when showAnalysis=false', () => {
      const analysisObj = {type: 'winrate', data: [0.6]}
      const result = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        overlayState: {
          ...baseInput().overlayState,
          analysis: analysisObj,
        },
        settings: {...baseInput().settings, showAnalysis: false},
      }))
      assert.strictEqual(result.overlayDisplayProps.analysis, null)
    })

    it('returns dragMode=false', () => {
      const result = projectGobanProps(baseInput({workbenchMode: 'problem'}))
      assert.strictEqual(result.interactionProps.dragMode, false)
    })

    it('returns drawLineMode=null', () => {
      const result = projectGobanProps(baseInput({workbenchMode: 'problem'}))
      assert.strictEqual(result.interactionProps.drawLineMode, null)
    })

    it('returns dimmedStones as empty array', () => {
      const result = projectGobanProps(baseInput({workbenchMode: 'problem'}))
      assert.deepStrictEqual(result.overlayDisplayProps.dimmedStones, [])
    })

    it('returns crosshair=false', () => {
      const result = projectGobanProps(baseInput({workbenchMode: 'problem'}))
      assert.strictEqual(result.overlayDisplayProps.crosshair, false)
    })

    it('returns onStoneDragEnd=null', () => {
      const result = projectGobanProps(baseInput({workbenchMode: 'problem'}))
      assert.strictEqual(result.handlerProps.onStoneDragEnd, null)
    })

    it('returns onPlayVariationMoves=null', () => {
      const result = projectGobanProps(baseInput({workbenchMode: 'problem'}))
      assert.strictEqual(result.handlerProps.onPlayVariationMoves, null)
    })

    it('provides all three core handler props as functions', () => {
      const result = projectGobanProps(baseInput({workbenchMode: 'problem'}))
      assert.strictEqual(typeof result.handlerProps.onVertexClick, 'function')
      assert.strictEqual(typeof result.handlerProps.onLineDraw, 'function')
      assert.strictEqual(typeof result.handlerProps.onAreaSelect, 'function')
    })

    it('produces identical overlayDisplayProps as play for same inputs', () => {
      const sharedSettings = {
        ...baseInput().settings,
        showNextMoves: true,
        showSiblings: true,
        showAnalysis: true,
      }
      const sharedOverlay = {
        ...baseInput().overlayState,
        analysis: {type: 'winrate', data: [0.5]},
      }
      const playResult = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: sharedSettings,
        overlayState: sharedOverlay,
      }))
      const problemResult = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        settings: sharedSettings,
        overlayState: sharedOverlay,
      }))

      assert.strictEqual(
        problemResult.overlayDisplayProps.showMoveNumbers,
        playResult.overlayDisplayProps.showMoveNumbers,
        'showMoveNumbers should be identical for play and problem',
      )
      assert.strictEqual(
        problemResult.overlayDisplayProps.showNextMoves,
        playResult.overlayDisplayProps.showNextMoves,
        'showNextMoves should be identical for play and problem',
      )
      assert.strictEqual(
        problemResult.overlayDisplayProps.showSiblings,
        playResult.overlayDisplayProps.showSiblings,
        'showSiblings should be identical for play and problem',
      )
      assert.deepStrictEqual(
        problemResult.overlayDisplayProps.analysis,
        playResult.overlayDisplayProps.analysis,
        'analysis should be identical for play and problem',
      )
    })

    it('produces identical interactionProps as play for same inputs', () => {
      const playResult = projectGobanProps(baseInput({workbenchMode: 'play'}))
      const problemResult = projectGobanProps(baseInput({workbenchMode: 'problem'}))

      assert.strictEqual(
        problemResult.interactionProps.dragMode,
        playResult.interactionProps.dragMode,
      )
      assert.strictEqual(
        problemResult.interactionProps.drawLineMode,
        playResult.interactionProps.drawLineMode,
      )
    })

    it('produces identical handlerProps null/function pattern as play', () => {
      const playResult = projectGobanProps(baseInput({workbenchMode: 'play'}))
      const problemResult = projectGobanProps(baseInput({workbenchMode: 'problem'}))

      assert.strictEqual(
        problemResult.handlerProps.onStoneDragEnd,
        playResult.handlerProps.onStoneDragEnd,
        'onStoneDragEnd should both be null for play and problem',
      )
      assert.strictEqual(
        problemResult.handlerProps.onPlayVariationMoves,
        playResult.handlerProps.onPlayVariationMoves,
        'onPlayVariationMoves should both be null for play and problem',
      )
    })
  })

  // --- W3-T25: overlay activation policy — play mode (Matrix Section 2.3) ---

  describe('W3-T25: overlay activation policy — play mode', () => {
    it('showMoveNumbers=false regardless of settings.showMoveNumbers=true', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {...baseInput().settings, showMoveNumbers: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.showMoveNumbers, false)
    })

    it('showMoveNumbers=false when settings.showMoveNumbers=false', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {...baseInput().settings, showMoveNumbers: false},
      }))
      assert.strictEqual(result.overlayDisplayProps.showMoveNumbers, false)
    })

    it('showNextMatches passes through from settings (true)', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {...baseInput().settings, showNextMoves: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.showNextMoves, true)
    })

    it('showNextMatches passes through from settings (false)', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {...baseInput().settings, showNextMoves: false},
      }))
      assert.strictEqual(result.overlayDisplayProps.showNextMoves, false)
    })

    it('analysis=overlayState.analysis when showAnalysis=true', () => {
      const analysisObj = {type: 'winrate', data: [0.55]}
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        overlayState: {...baseInput().overlayState, analysis: analysisObj},
        settings: {...baseInput().settings, showAnalysis: true},
      }))
      assert.deepStrictEqual(result.overlayDisplayProps.analysis, analysisObj)
    })

    it('analysis=null when showAnalysis=false even if overlayState has analysis', () => {
      const analysisObj = {type: 'winrate', data: [0.55]}
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        overlayState: {...baseInput().overlayState, analysis: analysisObj},
        settings: {...baseInput().settings, showAnalysis: false},
      }))
      assert.strictEqual(result.overlayDisplayProps.analysis, null)
    })

    it('dimmedStones=[] always, even when overlayState.dimmedStones has entries', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        overlayState: {...baseInput().overlayState, dimmedStones: [[3, 3], [4, 4]]},
      }))
      assert.deepStrictEqual(result.overlayDisplayProps.dimmedStones, [])
    })
  })

  // --- W3-T26: overlay activation policy — recall mode (Matrix Section 2.3, CRITICAL) ---

  describe('W3-T26: overlay activation policy — recall mode (CRITICAL: no analysis overlay)', () => {
    it('showMoveNumbers=true regardless of settings.showMoveNumbers=false', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        settings: {...baseInput().settings, showMoveNumbers: false},
      }))
      assert.strictEqual(result.overlayDisplayProps.showMoveNumbers, true)
    })

    it('showNextMoves=false regardless of settings.showNextMoves=true', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        settings: {...baseInput().settings, showNextMoves: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.showNextMoves, false)
    })

    it('showSiblings=false regardless of settings.showSiblings=true', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        settings: {...baseInput().settings, showSiblings: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.showSiblings, false)
    })

    it('analysis=null regardless of overlayState.analysis and showAnalysis=true', () => {
      // CRITICAL: recall must NEVER show analysis overlay, per PRD Section 3.3
      // and Arch v0.5 Section 14 (recall is read-only, no pollution).
      const analysisObj = {type: 'winrate', data: [0.7]}
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        overlayState: {...baseInput().overlayState, analysis: analysisObj},
        settings: {...baseInput().settings, showAnalysis: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.analysis, null)
    })

    it('analysis=null when overlayState.analysis is null anyway', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        overlayState: {...baseInput().overlayState, analysis: null},
        settings: {...baseInput().settings, showAnalysis: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.analysis, null)
    })
  })

  // --- W3-T27: overlay activation policy — analysis+editWorkspace (Matrix Section 2.3) ---

  describe('W3-T27: overlay activation policy — analysis+editWorkspace', () => {
    function analysisEditInput(overrides = {}) {
      return baseInput({
        workbenchMode: 'analysis',
        settings: {
          ...baseInput().settings,
          editWorkspaceActive: true,
          ...overrides.settings,
        },
        ...overrides,
      })
    }

    it('showMoveNumbers from settings (true)', () => {
      const result = projectGobanProps(analysisEditInput({
        settings: {...baseInput().settings, editWorkspaceActive: true, showMoveNumbers: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.showMoveNumbers, true)
    })

    it('showMoveNumbers from settings (false)', () => {
      const result = projectGobanProps(analysisEditInput({
        settings: {...baseInput().settings, editWorkspaceActive: true, showMoveNumbers: false},
      }))
      assert.strictEqual(result.overlayDisplayProps.showMoveNumbers, false)
    })

    it('showNextMatches from settings (true)', () => {
      const result = projectGobanProps(analysisEditInput({
        settings: {...baseInput().settings, editWorkspaceActive: true, showNextMoves: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.showNextMoves, true)
    })

    it('showSiblings from settings (true)', () => {
      const result = projectGobanProps(analysisEditInput({
        settings: {...baseInput().settings, editWorkspaceActive: true, showSiblings: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.showSiblings, true)
    })

    it('analysis from overlayState when showAnalysis=true', () => {
      const analysisObj = {type: 'score', data: {black: 50}}
      const result = projectGobanProps(analysisEditInput({
        overlayState: {...baseInput().overlayState, analysis: analysisObj},
        settings: {...baseInput().settings, editWorkspaceActive: true, showAnalysis: true},
      }))
      assert.deepStrictEqual(result.overlayDisplayProps.analysis, analysisObj)
    })

    it('analysis=null when showAnalysis=false', () => {
      const analysisObj = {type: 'score', data: {black: 50}}
      const result = projectGobanProps(analysisEditInput({
        overlayState: {...baseInput().overlayState, analysis: analysisObj},
        settings: {...baseInput().settings, editWorkspaceActive: true, showAnalysis: false},
      }))
      assert.strictEqual(result.overlayDisplayProps.analysis, null)
    })

    it('dragMode=true', () => {
      const result = projectGobanProps(analysisEditInput())
      assert.strictEqual(result.interactionProps.dragMode, true)
    })

    it('drawLineMode=arrow when selectedTool=arrow', () => {
      const result = projectGobanProps(analysisEditInput({
        settings: {...baseInput().settings, editWorkspaceActive: true, selectedTool: 'arrow'},
      }))
      assert.strictEqual(result.interactionProps.drawLineMode, 'arrow')
    })

    it('drawLineMode=null when selectedTool is not arrow or line', () => {
      const result = projectGobanProps(analysisEditInput({
        settings: {...baseInput().settings, editWorkspaceActive: true, selectedTool: 'stone_1'},
      }))
      assert.strictEqual(result.interactionProps.drawLineMode, null)
    })
  })

  // --- W3-T28: overlay activation policy — analysis without editWorkspace (Matrix Section 2.3) ---

  describe('W3-T28: overlay activation policy — analysis (no editWorkspace)', () => {
    function analysisNoEditInput(overrides = {}) {
      return baseInput({
        workbenchMode: 'analysis',
        settings: {
          ...baseInput().settings,
          editWorkspaceActive: false,
          ...overrides.settings,
        },
        ...overrides,
      })
    }

    it('showMoveNumbers=false (hardcoded, not from settings)', () => {
      const result = projectGobanProps(analysisNoEditInput({
        settings: {...baseInput().settings, editWorkspaceActive: false, showMoveNumbers: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.showMoveNumbers, false)
    })

    it('analysis=null even when showAnalysis=true and overlayState has analysis', () => {
      const analysisObj = {type: 'winrate', data: [0.5]}
      const result = projectGobanProps(analysisNoEditInput({
        overlayState: {...baseInput().overlayState, analysis: analysisObj},
        settings: {...baseInput().settings, editWorkspaceActive: false, showAnalysis: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.analysis, null)
    })

    it('dragMode=false', () => {
      const result = projectGobanProps(analysisNoEditInput())
      assert.strictEqual(result.interactionProps.dragMode, false)
    })

    it('drawLineMode=null', () => {
      const result = projectGobanProps(analysisNoEditInput({
        settings: {...baseInput().settings, editWorkspaceActive: false, selectedTool: 'arrow'},
      }))
      assert.strictEqual(result.interactionProps.drawLineMode, null)
    })

    it('onStoneDragEnd=null', () => {
      const result = projectGobanProps(analysisNoEditInput())
      assert.strictEqual(result.handlerProps.onStoneDragEnd, null)
    })

    it('onPlayVariationMoves=null', () => {
      const result = projectGobanProps(analysisNoEditInput())
      assert.strictEqual(result.handlerProps.onPlayVariationMoves, null)
    })
  })

  // --- W3-T29: mode transition re-projection — submitAttempt (play -> recall, ALL changed fields) ---

  describe('W3-T29: submitAttempt full field diff (play -> recall)', () => {
    it('showMoveNumbers changes from false to true', () => {
      const playResult = projectGobanProps(baseInput({workbenchMode: 'play'}))
      const recallResult = projectGobanProps(baseInput({workbenchMode: 'recall'}))
      assert.strictEqual(playResult.overlayDisplayProps.showMoveNumbers, false)
      assert.strictEqual(recallResult.overlayDisplayProps.showMoveNumbers, true)
    })

    it('showNextMoves changes from settings value to false', () => {
      const input = baseInput({
        settings: {...baseInput().settings, showNextMoves: true},
      })
      const playResult = projectGobanProps({...input, workbenchMode: 'play'})
      const recallResult = projectGobanProps({...input, workbenchMode: 'recall'})
      assert.strictEqual(playResult.overlayDisplayProps.showNextMoves, true)
      assert.strictEqual(recallResult.overlayDisplayProps.showNextMoves, false)
    })

    it('showSiblings changes from settings value to false', () => {
      const input = baseInput({
        settings: {...baseInput().settings, showSiblings: true},
      })
      const playResult = projectGobanProps({...input, workbenchMode: 'play'})
      const recallResult = projectGobanProps({...input, workbenchMode: 'recall'})
      assert.strictEqual(playResult.overlayDisplayProps.showSiblings, true)
      assert.strictEqual(recallResult.overlayDisplayProps.showSiblings, false)
    })

    it('analysis changes from conditional to null', () => {
      const analysisObj = {type: 'winrate', data: [0.6]}
      const sharedOverlay = {...baseInput().overlayState, analysis: analysisObj}
      const sharedSettings = {...baseInput().settings, showAnalysis: true}
      const playResult = projectGobanProps(baseInput({
        workbenchMode: 'play',
        overlayState: sharedOverlay,
        settings: sharedSettings,
      }))
      const recallResult = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        overlayState: sharedOverlay,
        settings: sharedSettings,
      }))
      assert.deepStrictEqual(playResult.overlayDisplayProps.analysis, analysisObj)
      assert.strictEqual(recallResult.overlayDisplayProps.analysis, null)
    })

    it('handlerProps.onStoneDragEnd stays null', () => {
      const playResult = projectGobanProps(baseInput({workbenchMode: 'play'}))
      const recallResult = projectGobanProps(baseInput({workbenchMode: 'recall'}))
      assert.strictEqual(playResult.handlerProps.onStoneDragEnd, null)
      assert.strictEqual(recallResult.handlerProps.onStoneDragEnd, null)
    })

    it('handlerProps.onPlayVariationMoves stays null', () => {
      const playResult = projectGobanProps(baseInput({workbenchMode: 'play'}))
      const recallResult = projectGobanProps(baseInput({workbenchMode: 'recall'}))
      assert.strictEqual(playResult.handlerProps.onPlayVariationMoves, null)
      assert.strictEqual(recallResult.handlerProps.onPlayVariationMoves, null)
    })

    it('interactionProps.dragMode stays false', () => {
      const playResult = projectGobanProps(baseInput({workbenchMode: 'play'}))
      const recallResult = projectGobanProps(baseInput({workbenchMode: 'recall'}))
      assert.strictEqual(playResult.interactionProps.dragMode, false)
      assert.strictEqual(recallResult.interactionProps.dragMode, false)
    })

    it('interactionProps.drawLineMode stays null', () => {
      const playResult = projectGobanProps(baseInput({workbenchMode: 'play'}))
      const recallResult = projectGobanProps(baseInput({workbenchMode: 'recall'}))
      assert.strictEqual(playResult.interactionProps.drawLineMode, null)
      assert.strictEqual(recallResult.interactionProps.drawLineMode, null)
    })
  })

  // --- W3-T30: mode transition re-projection — enterAnalysis (play -> analysis+editWS, full field diff) ---

  describe('W3-T30: enterAnalysis full field diff (play -> analysis+editWS)', () => {
    it('showMoveNumbers changes from false (hardcoded) to settings value', () => {
      const playResult = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {...baseInput().settings, showMoveNumbers: true},
      }))
      const analysisResult = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {...baseInput().settings, editWorkspaceActive: true, showMoveNumbers: true},
      }))
      assert.strictEqual(playResult.overlayDisplayProps.showMoveNumbers, false)
      assert.strictEqual(analysisResult.overlayDisplayProps.showMoveNumbers, true)
    })

    it('dragMode changes from false to true', () => {
      const playResult = projectGobanProps(baseInput({workbenchMode: 'play'}))
      const analysisResult = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {...baseInput().settings, editWorkspaceActive: true},
      }))
      assert.strictEqual(playResult.interactionProps.dragMode, false)
      assert.strictEqual(analysisResult.interactionProps.dragMode, true)
    })

    it('drawLineMode changes from null to tool-dependent', () => {
      const playResult = projectGobanProps(baseInput({workbenchMode: 'play'}))
      const analysisResult = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {...baseInput().settings, editWorkspaceActive: true, selectedTool: 'line'},
      }))
      assert.strictEqual(playResult.interactionProps.drawLineMode, null)
      assert.strictEqual(analysisResult.interactionProps.drawLineMode, 'line')
    })

    it('onStoneDragEnd changes from null to function', () => {
      const playResult = projectGobanProps(baseInput({workbenchMode: 'play'}))
      const analysisResult = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {...baseInput().settings, editWorkspaceActive: true},
      }))
      assert.strictEqual(playResult.handlerProps.onStoneDragEnd, null)
      assert.strictEqual(typeof analysisResult.handlerProps.onStoneDragEnd, 'function')
    })

    it('onPlayVariationMoves changes from null to function', () => {
      const playResult = projectGobanProps(baseInput({workbenchMode: 'play'}))
      const analysisResult = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {...baseInput().settings, editWorkspaceActive: true},
      }))
      assert.strictEqual(playResult.handlerProps.onPlayVariationMoves, null)
      assert.strictEqual(typeof analysisResult.handlerProps.onPlayVariationMoves, 'function')
    })
  })

  // --- W3-T31: mode transition re-projection — returnFromAnalysis (analysis -> play, full restore) ---

  describe('W3-T31: returnFromAnalysis full field restore (analysis -> play)', () => {
    it('all overlay props match original play projection', () => {
      const originalPlay = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {...baseInput().settings, showMoveNumbers: true},
      }))
      const analysisResult = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {...baseInput().settings, editWorkspaceActive: true, showMoveNumbers: true},
      }))
      const restoredPlay = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {...baseInput().settings, showMoveNumbers: true},
      }))

      // Verify analysis was different
      assert.strictEqual(analysisResult.interactionProps.dragMode, true)
      assert.strictEqual(analysisResult.overlayDisplayProps.showMoveNumbers, true)

      // Verify restored matches original
      assert.strictEqual(restoredPlay.overlayDisplayProps.showMoveNumbers, originalPlay.overlayDisplayProps.showMoveNumbers)
      assert.strictEqual(restoredPlay.overlayDisplayProps.showNextMoves, originalPlay.overlayDisplayProps.showNextMoves)
      assert.strictEqual(restoredPlay.overlayDisplayProps.showSiblings, originalPlay.overlayDisplayProps.showSiblings)
      assert.strictEqual(restoredPlay.interactionProps.dragMode, originalPlay.interactionProps.dragMode)
      assert.strictEqual(restoredPlay.interactionProps.drawLineMode, originalPlay.interactionProps.drawLineMode)
      assert.strictEqual(restoredPlay.handlerProps.onStoneDragEnd, originalPlay.handlerProps.onStoneDragEnd)
      assert.strictEqual(restoredPlay.handlerProps.onPlayVariationMoves, originalPlay.handlerProps.onPlayVariationMoves)
    })
  })

  // --- W3-T32: mode transition re-projection — returnFromAnalysis (analysis -> recall, full restore) ---

  describe('W3-T32: returnFromAnalysis full field restore (analysis -> recall)', () => {
    it('all overlay props match original recall projection', () => {
      const originalRecall = projectGobanProps(baseInput({workbenchMode: 'recall'}))
      const analysisResult = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {...baseInput().settings, editWorkspaceActive: true},
      }))
      const restoredRecall = projectGobanProps(baseInput({workbenchMode: 'recall'}))

      // Verify analysis was different from recall
      assert.strictEqual(analysisResult.interactionProps.dragMode, true)
      assert.strictEqual(analysisResult.overlayDisplayProps.showMoveNumbers, false)

      // Verify restored recall matches original recall
      assert.strictEqual(restoredRecall.overlayDisplayProps.showMoveNumbers, originalRecall.overlayDisplayProps.showMoveNumbers)
      assert.strictEqual(restoredRecall.overlayDisplayProps.showMoveNumbers, true)
      assert.strictEqual(restoredRecall.overlayDisplayProps.showNextMoves, originalRecall.overlayDisplayProps.showNextMoves)
      assert.strictEqual(restoredRecall.overlayDisplayProps.showNextMoves, false)
      assert.strictEqual(restoredRecall.overlayDisplayProps.showSiblings, originalRecall.overlayDisplayProps.showSiblings)
      assert.strictEqual(restoredRecall.overlayDisplayProps.showSiblings, false)
      assert.strictEqual(restoredRecall.overlayDisplayProps.analysis, originalRecall.overlayDisplayProps.analysis)
      assert.strictEqual(restoredRecall.overlayDisplayProps.analysis, null)
      assert.strictEqual(restoredRecall.interactionProps.dragMode, originalRecall.interactionProps.dragMode)
      assert.strictEqual(restoredRecall.interactionProps.dragMode, false)
      assert.strictEqual(restoredRecall.interactionProps.drawLineMode, originalRecall.interactionProps.drawLineMode)
      assert.strictEqual(restoredRecall.interactionProps.drawLineMode, null)
      assert.strictEqual(restoredRecall.handlerProps.onStoneDragEnd, originalRecall.handlerProps.onStoneDragEnd)
      assert.strictEqual(restoredRecall.handlerProps.onPlayVariationMoves, originalRecall.handlerProps.onPlayVariationMoves)
    })
  })

  // --- W3-T33: settings passthrough verification ---

  describe('W3-T33: settings passthrough in all modes', () => {
    it('showCoordinates passes through in play mode', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {...baseInput().settings, showCoordinates: false},
      }))
      assert.strictEqual(result.overlayDisplayProps.showCoordinates, false)
    })

    it('showCoordinates passes through in recall mode', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        settings: {...baseInput().settings, showCoordinates: false},
      }))
      assert.strictEqual(result.overlayDisplayProps.showCoordinates, false)
    })

    it('showCoordinates passes through in analysis mode', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {...baseInput().settings, editWorkspaceActive: true, showCoordinates: false},
      }))
      assert.strictEqual(result.overlayDisplayProps.showCoordinates, false)
    })

    it('showCoordinates passes through in problem mode', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        settings: {...baseInput().settings, showCoordinates: false},
      }))
      assert.strictEqual(result.overlayDisplayProps.showCoordinates, false)
    })

    it('boardTransformation passes through in play mode', () => {
      const transform = [0, 1, -1, 0, 5, 3]
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {...baseInput().settings, boardTransformation: transform},
      }))
      assert.deepStrictEqual(result.interactionProps.transformation, transform)
    })

    it('boardTransformation passes through in recall mode', () => {
      const transform = [0, -1, 1, 0, 2, 7]
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        settings: {...baseInput().settings, boardTransformation: transform},
      }))
      assert.deepStrictEqual(result.interactionProps.transformation, transform)
    })

    it('boardTransformation passes through in analysis mode', () => {
      const transform = [-1, 0, 0, -1, 10, 10]
      const result = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {...baseInput().settings, editWorkspaceActive: true, boardTransformation: transform},
      }))
      assert.deepStrictEqual(result.interactionProps.transformation, transform)
    })

    it('boardTransformation passes through in problem mode', () => {
      const transform = [0, 1, 1, 0, 0, 0]
      const result = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        settings: {...baseInput().settings, boardTransformation: transform},
      }))
      assert.deepStrictEqual(result.interactionProps.transformation, transform)
    })

    it('areaSelectMode passes through in play mode', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {...baseInput().settings, areaSelectMode: true},
      }))
      assert.strictEqual(result.interactionProps.areaSelectMode, true)
    })

    it('areaSelectMode passes through in recall mode', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        settings: {...baseInput().settings, areaSelectMode: true},
      }))
      assert.strictEqual(result.interactionProps.areaSelectMode, true)
    })

    it('areaSelectMode passes through in analysis mode', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {...baseInput().settings, editWorkspaceActive: true, areaSelectMode: true},
      }))
      assert.strictEqual(result.interactionProps.areaSelectMode, true)
    })

    it('areaSelectMode passes through in problem mode', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        settings: {...baseInput().settings, areaSelectMode: true},
      }))
      assert.strictEqual(result.interactionProps.areaSelectMode, true)
    })

    it('showHumanPreference passes through in play mode', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {...baseInput().settings, showHumanPreference: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.showHumanPreference, true)
    })

    it('showHumanPreference passes through in recall mode', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        settings: {...baseInput().settings, showHumanPreference: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.showHumanPreference, true)
    })

    it('showHumanPreference passes through in analysis mode', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {...baseInput().settings, editWorkspaceActive: true, showHumanPreference: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.showHumanPreference, true)
    })

    it('showHumanPreference passes through in problem mode', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        settings: {...baseInput().settings, showHumanPreference: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.showHumanPreference, true)
    })
  })

  // --- W3-T34: overlay activation policy — problem mode (Matrix Section 2.3, play-equivalent) ---

  describe('W3-T34: overlay activation policy — problem mode mirrors play', () => {
    it('showMoveNumbers=false regardless of settings.showMoveNumbers=true', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        settings: {...baseInput().settings, showMoveNumbers: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.showMoveNumbers, false)
    })

    it('analysis from overlayState when showAnalysis=true', () => {
      const analysisObj = {type: 'score', data: {black: 40}}
      const result = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        overlayState: {...baseInput().overlayState, analysis: analysisObj},
        settings: {...baseInput().settings, showAnalysis: true},
      }))
      assert.deepStrictEqual(result.overlayDisplayProps.analysis, analysisObj)
    })

    it('analysis=null when showAnalysis=false', () => {
      const analysisObj = {type: 'score', data: {black: 40}}
      const result = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        overlayState: {...baseInput().overlayState, analysis: analysisObj},
        settings: {...baseInput().settings, showAnalysis: false},
      }))
      assert.strictEqual(result.overlayDisplayProps.analysis, null)
    })

    it('dimmedStones=[] always, even when overlayState.dimmedStones has entries', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        overlayState: {...baseInput().overlayState, dimmedStones: [[5, 5]]},
      }))
      assert.deepStrictEqual(result.overlayDisplayProps.dimmedStones, [])
    })
  })

  // ====================================================================
  // MATRIX 3.1-3.3 EXPANDED INPUT/OUTPUT COVERAGE
  // Tests W3-T35 through W3-T43
  //
  // These tests verify current projectGobanProps behavior for fields
  // that are direct passthrough or hardcoded constants.
  //
  // Where Matrix 3.2 disagrees with current implementation, tests
  // assert actual current behavior and document the GAP-G4 gap.
  // ====================================================================

  // --- W3-T35: paintMap per mode (current: passthrough) ---

  describe('W3-T35: paintMap per mode — passthrough (Matrix 3.2)', () => {
    // Matrix 3.2 says recall paintMap=[], but current impl passes
    // overlayState.paintMap through without mode gating.
    // GAP-G4: overlay pipeline not yet wired to WorkbenchMode.
    // Tests assert current behavior, not the matrix future value.

    const knownPaintMap = [[0, 1, 0], [1, 0, 1], [0, 1, 0]]

    it('play mode passes paintMap through unchanged', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        overlayState: {...baseInput().overlayState, paintMap: knownPaintMap},
      }))
      assert.deepStrictEqual(result.overlayDisplayProps.paintMap, knownPaintMap)
    })

    it('problem mode passes paintMap through unchanged', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        overlayState: {...baseInput().overlayState, paintMap: knownPaintMap},
      }))
      assert.deepStrictEqual(result.overlayDisplayProps.paintMap, knownPaintMap)
    })

    it('recall mode passes paintMap through unchanged (GAP-G4: Matrix says [])', () => {
      // GAP-G4: Matrix 3.2 says recall paintMap=[], but overlay pipeline
      // is not yet WorkbenchMode-aware. Current impl passes through.
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        overlayState: {...baseInput().overlayState, paintMap: knownPaintMap},
      }))
      assert.deepStrictEqual(result.overlayDisplayProps.paintMap, knownPaintMap)
    })

    it('analysis+editWS mode passes paintMap through unchanged', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {...baseInput().settings, editWorkspaceActive: true},
        overlayState: {...baseInput().overlayState, paintMap: knownPaintMap},
      }))
      assert.deepStrictEqual(result.overlayDisplayProps.paintMap, knownPaintMap)
    })

    it('analysis (no editWS) mode passes paintMap through unchanged', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {...baseInput().settings, editWorkspaceActive: false},
        overlayState: {...baseInput().overlayState, paintMap: knownPaintMap},
      }))
      assert.deepStrictEqual(result.overlayDisplayProps.paintMap, knownPaintMap)
    })

    it('empty paintMap passes through as empty', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        overlayState: {...baseInput().overlayState, paintMap: []},
      }))
      assert.deepStrictEqual(result.overlayDisplayProps.paintMap, [])
    })
  })

  // --- W3-T36: markerMap per mode (current: passthrough) ---

  describe('W3-T36: markerMap per mode — passthrough (Matrix 3.2)', () => {
    // Matrix 3.2 says recall markerMap=null, but current impl passes
    // overlayState.markerMap through without mode gating.
    // GAP-G4: overlay pipeline not yet wired to WorkbenchMode.

    const knownMarkerMap = [[null, {type: 'circle'}], [{type: 'triangle'}, null]]

    it('play mode passes markerMap through unchanged', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        overlayState: {...baseInput().overlayState, markerMap: knownMarkerMap},
      }))
      assert.deepStrictEqual(result.overlayDisplayProps.markerMap, knownMarkerMap)
    })

    it('problem mode passes markerMap through unchanged', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        overlayState: {...baseInput().overlayState, markerMap: knownMarkerMap},
      }))
      assert.deepStrictEqual(result.overlayDisplayProps.markerMap, knownMarkerMap)
    })

    it('recall mode passes markerMap through unchanged (GAP-G4: Matrix says null)', () => {
      // GAP-G4: Matrix 3.2 says recall markerMap=null, but current impl
      // passes through. Asserting actual behavior.
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        overlayState: {...baseInput().overlayState, markerMap: knownMarkerMap},
      }))
      assert.deepStrictEqual(result.overlayDisplayProps.markerMap, knownMarkerMap)
    })

    it('analysis+editWS mode passes markerMap through unchanged', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {...baseInput().settings, editWorkspaceActive: true},
        overlayState: {...baseInput().overlayState, markerMap: knownMarkerMap},
      }))
      assert.deepStrictEqual(result.overlayDisplayProps.markerMap, knownMarkerMap)
    })

    it('analysis (no editWS) mode passes markerMap through unchanged', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {...baseInput().settings, editWorkspaceActive: false},
        overlayState: {...baseInput().overlayState, markerMap: knownMarkerMap},
      }))
      assert.deepStrictEqual(result.overlayDisplayProps.markerMap, knownMarkerMap)
    })

    it('empty markerMap passes through as empty', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        overlayState: {...baseInput().overlayState, markerMap: []},
      }))
      assert.deepStrictEqual(result.overlayDisplayProps.markerMap, [])
    })
  })

  // --- W3-T37: overlayGhostStoneMap per mode (current: passthrough with nullish coalesce) ---

  describe('W3-T37: overlayGhostStoneMap per mode — passthrough with ?? null', () => {
    // overlayState.overlayGhostStoneMap ?? null
    // Ghost stones are visually hidden in recall via showNextMoves=false,
    // not by clearing overlayGhostStoneMap.
    // Note: recall showNextMoves=false is tested in W3-T02/W3-T26.

    const ghostMap = {0: {sign: 1}, 1: {sign: -1}}

    it('play mode passes overlayGhostStoneMap through unchanged', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        overlayState: {...baseInput().overlayState, overlayGhostStoneMap: ghostMap},
      }))
      assert.deepStrictEqual(result.overlayDisplayProps.overlayGhostStoneMap, ghostMap)
    })

    it('problem mode passes overlayGhostStoneMap through unchanged', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        overlayState: {...baseInput().overlayState, overlayGhostStoneMap: ghostMap},
      }))
      assert.deepStrictEqual(result.overlayDisplayProps.overlayGhostStoneMap, ghostMap)
    })

    it('recall mode passes overlayGhostStoneMap through unchanged (hidden via showNextMoves=false)', () => {
      // Ghost stones in recall are gated by showNextMoves=false at the Goban
      // rendering level, not by clearing overlayGhostStoneMap.
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        overlayState: {...baseInput().overlayState, overlayGhostStoneMap: ghostMap},
      }))
      assert.deepStrictEqual(result.overlayDisplayProps.overlayGhostStoneMap, ghostMap)
      // Confirm showNextMoves=false which actually hides ghost rendering
      assert.strictEqual(result.overlayDisplayProps.showNextMoves, false)
    })

    it('analysis+editWS mode passes overlayGhostStoneMap through unchanged', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {...baseInput().settings, editWorkspaceActive: true},
        overlayState: {...baseInput().overlayState, overlayGhostStoneMap: ghostMap},
      }))
      assert.deepStrictEqual(result.overlayDisplayProps.overlayGhostStoneMap, ghostMap)
    })

    it('analysis (no editWS) mode passes overlayGhostStoneMap through unchanged', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {...baseInput().settings, editWorkspaceActive: false},
        overlayState: {...baseInput().overlayState, overlayGhostStoneMap: ghostMap},
      }))
      assert.deepStrictEqual(result.overlayDisplayProps.overlayGhostStoneMap, ghostMap)
    })

    it('null input produces null output', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        overlayState: {...baseInput().overlayState, overlayGhostStoneMap: null},
      }))
      assert.strictEqual(result.overlayDisplayProps.overlayGhostStoneMap, null)
    })

    it('undefined input produces null output (?? null coalesce)', () => {
      // When overlayGhostStoneMap is not provided (undefined), ?? null yields null
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        overlayState: {
          ...baseInput().overlayState,
          // overlayGhostStoneMap intentionally omitted (undefined)
        },
      }))
      assert.strictEqual(result.overlayDisplayProps.overlayGhostStoneMap, null)
    })
  })

  // --- W3-T38: analysisType per mode (current: passthrough from analysisData) ---

  describe('W3-T38: analysisType per mode — passthrough from analysisData', () => {
    // analysisType = analysisData?.analysisType ?? ''
    // Mode does not gate analysisType; it always comes from input.
    // When analysis prop is null (recall, analysis-noEditWS), analysisType
    // is still output but has no visual effect since there is no overlay.

    it('play mode passes analysisType from analysisData', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        analysisData: {activeAnalysis: {type: 'winrate'}, analysisType: 'ownership'},
      }))
      assert.strictEqual(result.overlayDisplayProps.analysisType, 'ownership')
    })

    it('problem mode passes analysisType from analysisData', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        analysisData: {activeAnalysis: {type: 'winrate'}, analysisType: 'ownership'},
      }))
      assert.strictEqual(result.overlayDisplayProps.analysisType, 'ownership')
    })

    it('recall mode passes analysisType from analysisData (though analysis is null)', () => {
      // recall analysis=null (tested in W3-T26), but analysisType is still
      // projected from input. It has no visual effect since analysis is null.
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        analysisData: {activeAnalysis: {type: 'winrate'}, analysisType: 'ownership'},
      }))
      assert.strictEqual(result.overlayDisplayProps.analysisType, 'ownership')
      assert.strictEqual(result.overlayDisplayProps.analysis, null)
    })

    it('analysis+editWS mode passes analysisType from analysisData', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {...baseInput().settings, editWorkspaceActive: true},
        analysisData: {activeAnalysis: {type: 'score'}, analysisType: 'scoreEstimate'},
      }))
      assert.strictEqual(result.overlayDisplayProps.analysisType, 'scoreEstimate')
    })

    it('analysis (no editWS) passes analysisType even though analysis=null', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {...baseInput().settings, editWorkspaceActive: false},
        analysisData: {activeAnalysis: {type: 'winrate'}, analysisType: 'ownership'},
      }))
      assert.strictEqual(result.overlayDisplayProps.analysisType, 'ownership')
      assert.strictEqual(result.overlayDisplayProps.analysis, null)
    })

    it('null analysisData produces empty string analysisType', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        analysisData: null,
      }))
      assert.strictEqual(result.overlayDisplayProps.analysisType, '')
    })

    it('analysisData with empty analysisType produces empty string', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        analysisData: {activeAnalysis: null, analysisType: ''},
      }))
      assert.strictEqual(result.overlayDisplayProps.analysisType, '')
    })
  })

  // --- W3-T39: showHumanPreference per mode (current: passthrough) ---

  describe('W3-T39: showHumanPreference per mode — passthrough', () => {
    // showHumanPreference is always from settings, no mode gating.

    it('play mode passes showHumanPreference=true', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {...baseInput().settings, showHumanPreference: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.showHumanPreference, true)
    })

    it('play mode passes showHumanPreference=false', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {...baseInput().settings, showHumanPreference: false},
      }))
      assert.strictEqual(result.overlayDisplayProps.showHumanPreference, false)
    })

    it('problem mode passes showHumanPreference=true', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        settings: {...baseInput().settings, showHumanPreference: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.showHumanPreference, true)
    })

    it('recall mode passes showHumanPreference=true', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        settings: {...baseInput().settings, showHumanPreference: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.showHumanPreference, true)
    })

    it('analysis+editWS mode passes showHumanPreference=true', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {...baseInput().settings, editWorkspaceActive: true, showHumanPreference: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.showHumanPreference, true)
    })

    it('analysis (no editWS) mode passes showHumanPreference=true', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {...baseInput().settings, editWorkspaceActive: false, showHumanPreference: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.showHumanPreference, true)
    })
  })

  // --- W3-T40: showCoordinates per mode (current: passthrough) ---

  describe('W3-T40: showCoordinates per mode — passthrough', () => {
    // showCoordinates is always from settings, no mode gating.

    it('play mode passes showCoordinates=false', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {...baseInput().settings, showCoordinates: false},
      }))
      assert.strictEqual(result.overlayDisplayProps.showCoordinates, false)
    })

    it('play mode passes showCoordinates=true', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {...baseInput().settings, showCoordinates: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.showCoordinates, true)
    })

    it('problem mode passes showCoordinates=true', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        settings: {...baseInput().settings, showCoordinates: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.showCoordinates, true)
    })

    it('recall mode passes showCoordinates=true', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        settings: {...baseInput().settings, showCoordinates: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.showCoordinates, true)
    })

    it('analysis+editWS mode passes showCoordinates=true', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {...baseInput().settings, editWorkspaceActive: true, showCoordinates: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.showCoordinates, true)
    })

    it('analysis (no editWS) mode passes showCoordinates=true', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {...baseInput().settings, editWorkspaceActive: false, showCoordinates: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.showCoordinates, true)
    })
  })

  // --- W3-T41: areaSelectMode and boardTransformation per mode (current: passthrough) ---

  describe('W3-T41: areaSelectMode and boardTransformation per mode — passthrough', () => {
    // Both areaSelectMode and boardTransformation come from settings
    // with no mode gating. Tested here for completeness of Matrix 3.1-3.3
    // coverage (some of this was already covered in W3-T33).

    const customTransform = [0, -1, 1, 0, 5, 2]

    it('play mode passes areaSelectMode=true', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {...baseInput().settings, areaSelectMode: true},
      }))
      assert.strictEqual(result.interactionProps.areaSelectMode, true)
    })

    it('recall mode passes areaSelectMode=true', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        settings: {...baseInput().settings, areaSelectMode: true},
      }))
      assert.strictEqual(result.interactionProps.areaSelectMode, true)
    })

    it('analysis+editWS mode passes areaSelectMode=true', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {...baseInput().settings, editWorkspaceActive: true, areaSelectMode: true},
      }))
      assert.strictEqual(result.interactionProps.areaSelectMode, true)
    })

    it('problem mode passes boardTransformation custom value', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        settings: {...baseInput().settings, boardTransformation: customTransform},
      }))
      assert.deepStrictEqual(result.interactionProps.transformation, customTransform)
    })

    it('recall mode passes boardTransformation custom value', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        settings: {...baseInput().settings, boardTransformation: customTransform},
      }))
      assert.deepStrictEqual(result.interactionProps.transformation, customTransform)
    })

    it('analysis+editWS mode passes boardTransformation custom value', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {...baseInput().settings, editWorkspaceActive: true, boardTransformation: customTransform},
      }))
      assert.deepStrictEqual(result.interactionProps.transformation, customTransform)
    })

    it('areaSelectMode=false passes through as false', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {...baseInput().settings, areaSelectMode: false},
      }))
      assert.strictEqual(result.interactionProps.areaSelectMode, false)
    })

    it('identity boardTransformation passes through', () => {
      const identity = [1, 0, 0, 1, 0, 0]
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {...baseInput().settings, boardTransformation: identity},
      }))
      assert.deepStrictEqual(result.interactionProps.transformation, identity)
    })
  })

  // --- W3-T42: hardcoded fields per mode ---

  describe('W3-T42: hardcoded fields per mode — always constant', () => {
    // showMoveColorization, fuzzyStonePlacement, animateStonePlacement
    // are hardcoded false; highlightVertices is hardcoded [].
    // These do not depend on mode or settings.

    const modes = ['play', 'problem', 'recall', 'analysis']

    for (const mode of modes) {
      describe(`mode=${mode}`, () => {
        const input = mode === 'analysis'
          ? baseInput({workbenchMode: mode, settings: {...baseInput().settings, editWorkspaceActive: true}})
          : baseInput({workbenchMode: mode})

        it('showMoveColorization is false', () => {
          const result = projectGobanProps(input)
          assert.strictEqual(result.overlayDisplayProps.showMoveColorization, false)
        })

        it('fuzzyStonePlacement is false', () => {
          const result = projectGobanProps(input)
          assert.strictEqual(result.overlayDisplayProps.fuzzyStonePlacement, false)
        })

        it('animateStonePlacement is false', () => {
          const result = projectGobanProps(input)
          assert.strictEqual(result.overlayDisplayProps.animateStonePlacement, false)
        })

        it('highlightVertices is empty array', () => {
          const result = projectGobanProps(input)
          assert.deepStrictEqual(result.overlayDisplayProps.highlightVertices, [])
        })
      })
    }

    it('hardcoded fields are constant even when settings are all true', () => {
      // Verify that even with all boolean settings true, hardcoded fields
      // remain at their constant values.
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {
          showMoveNumbers: true,
          showNextMoves: true,
          showSiblings: true,
          showAnalysis: true,
          showCoordinates: true,
          showHumanPreference: true,
          selectedTool: 'stone_1',
          editWorkspaceActive: false,
          boardTransformation: [1, 0, 0, 1, 0, 0],
          areaSelectMode: true,
        },
      }))
      assert.strictEqual(result.overlayDisplayProps.showMoveColorization, false)
      assert.strictEqual(result.overlayDisplayProps.fuzzyStonePlacement, false)
      assert.strictEqual(result.overlayDisplayProps.animateStonePlacement, false)
      assert.deepStrictEqual(result.overlayDisplayProps.highlightVertices, [])
    })
  })

  // --- W3-T43: boardStateProps passthrough stability ---

  describe('W3-T43: boardStateProps passthrough stability', () => {
    // projectGobanProps is a pure passthrough for boardStateProps.
    // The actual tree switching (formal vs editWorkspace) happens at the
    // Container/caller level. These tests verify that whatever you put in
    // comes out unchanged, regardless of mode or other settings.

    it('gameTree passes through unchanged in play mode', () => {
      const tree = {id: 'formal_tree_play', root: {data: {}}}
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        boardState: {
          gameTree: tree,
          treePosition: 'pos_1',
          board: {width: 19, height: 19, signMap: []},
        },
      }))
      assert.strictEqual(result.boardStateProps.gameTree, tree)
      assert.strictEqual(result.boardStateProps.gameTree.id, 'formal_tree_play')
    })

    it('gameTree passes through unchanged in recall mode', () => {
      const tree = {id: 'formal_tree_recall', root: {data: {}}}
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        boardState: {
          gameTree: tree,
          treePosition: 'recall_start',
          board: {width: 19, height: 19, signMap: []},
        },
      }))
      assert.strictEqual(result.boardStateProps.gameTree, tree)
      assert.strictEqual(result.boardStateProps.gameTree.id, 'formal_tree_recall')
    })

    it('gameTree passes through unchanged in analysis+editWS mode', () => {
      // In analysis mode, the caller (Container) is responsible for
      // providing the editWorkspace tree as input. projectGobanProps
      // just passes it through.
      const tree = {id: 'edit_workspace_tree', root: {data: {}}}
      const result = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {...baseInput().settings, editWorkspaceActive: true},
        boardState: {
          gameTree: tree,
          treePosition: 'edit_pos_1',
          board: {width: 19, height: 19, signMap: []},
        },
      }))
      assert.strictEqual(result.boardStateProps.gameTree, tree)
      assert.strictEqual(result.boardStateProps.gameTree.id, 'edit_workspace_tree')
    })

    it('treePosition passes through unchanged regardless of mode', () => {
      const positions = [
        {mode: 'play', pos: 'current_move'},
        {mode: 'problem', pos: 'problem_move'},
        {mode: 'recall', pos: 'recall_start_node'},
        {mode: 'analysis', pos: 'edit_workspace_position'},
      ]
      for (const {mode, pos} of positions) {
        const result = projectGobanProps(baseInput({
          workbenchMode: mode,
          settings: mode === 'analysis'
            ? {...baseInput().settings, editWorkspaceActive: true}
            : baseInput().settings,
          boardState: {
            gameTree: {id: 'gt'},
            treePosition: pos,
            board: {width: 19, height: 19, signMap: []},
          },
        }))
        assert.strictEqual(result.boardStateProps.treePosition, pos,
          `treePosition should pass through unchanged in ${mode} mode`)
      }
    })

    it('board passes through unchanged regardless of mode', () => {
      const customBoard = {width: 9, height: 9, signMap: [[1, -1], [0, 0]]}
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        boardState: {
          gameTree: {id: 'gt'},
          treePosition: 'pos',
          board: customBoard,
        },
      }))
      assert.strictEqual(result.boardStateProps.board, customBoard)
      assert.strictEqual(result.boardStateProps.board.width, 9)
      assert.strictEqual(result.boardStateProps.board.height, 9)
    })

    it('null gameTree passes through as null without throwing', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        boardState: {
          gameTree: null,
          treePosition: '',
          board: {width: 19, height: 19, signMap: []},
        },
      }))
      assert.strictEqual(result.boardStateProps.gameTree, null)
    })

    it('boardStateProps is unaffected by overlayState changes', () => {
      const tree = {id: 'gt_stable'}
      const boardA = {gameTree: tree, treePosition: 'n1', board: {width: 19, height: 19, signMap: []}}

      const result1 = projectGobanProps(baseInput({
        boardState: boardA,
        overlayState: {...baseInput().overlayState, paintMap: [], analysis: null},
      }))
      const result2 = projectGobanProps(baseInput({
        boardState: boardA,
        overlayState: {
          ...baseInput().overlayState,
          paintMap: [[1]],
          analysis: {type: 'winrate', data: [0.5]},
        },
      }))

      assert.strictEqual(result1.boardStateProps.gameTree, result2.boardStateProps.gameTree)
      assert.strictEqual(result1.boardStateProps.treePosition, result2.boardStateProps.treePosition)
      assert.strictEqual(result1.boardStateProps.board, result2.boardStateProps.board)
    })

    it('boardStateProps is unaffected by settings changes', () => {
      const boardInput = {
        gameTree: {id: 'gt_settings_test'},
        treePosition: 'pos_settings',
        board: {width: 19, height: 19, signMap: []},
      }

      const result1 = projectGobanProps(baseInput({
        boardState: boardInput,
        settings: {...baseInput().settings, showMoveNumbers: false, showNextMoves: false},
      }))
      const result2 = projectGobanProps(baseInput({
        boardState: boardInput,
        settings: {...baseInput().settings, showMoveNumbers: true, showNextMoves: true},
      }))

      assert.strictEqual(result1.boardStateProps.gameTree, result2.boardStateProps.gameTree)
      assert.strictEqual(result1.boardStateProps.treePosition, result2.boardStateProps.treePosition)
      assert.strictEqual(result1.boardStateProps.board, result2.boardStateProps.board)
    })
  })
})