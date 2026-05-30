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

    it('projects analysis panel data from overlay/engine analysis without store reads', () => {
      const result = projectGobanProps(analysisInput({
        overlayState: {
          paintMap: [],
          markerMap: [],
          dimmedStones: [],
          analysis: {
            engineStatus: 'projected engine ready',
            evaluation: 'projected eval +2.4',
            candidates: [{label: 'projected candidate Q16', moves: ['Q16', 'R16']}],
          },
        },
        analysisData: {
          activeAnalysis: {
            engineStatus: 'projected engine ready',
            evaluation: 'projected eval +2.4',
            candidates: [{label: 'projected candidate Q16', moves: ['Q16', 'R16']}],
          },
          analysisType: 'ownership',
        },
        settings: {
          ...baseInput().settings,
          editWorkspaceActive: true,
          showAnalysis: true,
        },
      }))

      assert.deepStrictEqual(result.analysisPanelProps, {
        engineStatus: 'projected engine ready',
        evaluation: 'projected eval +2.4',
        candidates: [{label: 'projected candidate Q16', moves: ['Q16', 'R16']}],
        analysisType: 'ownership',
        overlayVisible: true,
      })
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

    it('returns analysis=null in problem even when showAnalysis=true', () => {
      const analysisObj = {type: 'winrate', data: [0.6]}
      const result = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        overlayState: {
          ...baseInput().overlayState,
          analysis: analysisObj,
        },
        settings: {...baseInput().settings, showAnalysis: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.analysis, null)
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

    it('analysis=null in play even when showAnalysis=true', () => {
      const analysisObj = {type: 'winrate', data: [0.55]}
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        overlayState: {...baseInput().overlayState, analysis: analysisObj},
        settings: {...baseInput().settings, showAnalysis: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.analysis, null)
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
      assert.strictEqual(playResult.overlayDisplayProps.analysis, null)
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

    it('analysis=null in problem even when showAnalysis=true', () => {
      const analysisObj = {type: 'score', data: {black: 40}}
      const result = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        overlayState: {...baseInput().overlayState, analysis: analysisObj},
        settings: {...baseInput().settings, showAnalysis: true},
      }))
      assert.strictEqual(result.overlayDisplayProps.analysis, null)
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

  // --- W3-T35: recall overlay input sanitization (matrix target, not current behavior) ---

  describe('W3-T35: recall must sanitize overlay inputs that could leak answers', () => {
    // Matrix §2.3: recall mode disables ghost stones, heatmap, territory paint/diff.
    // Matrix §3.2: recall paintMap=[], markerMap=null.
    //
    // Current implementation passes paintMap/markerMap through from overlayState.
    // These tests assert the MATRIX DESIRED behavior. They are RED until GAP-G4
    // wires the overlay pipeline to WorkbenchMode.
    //
    // Rationale: a passing test asserting "recall leaks paintMap" would hardcode
    // the bug into the test suite. A failing test documents the gap honestly.

    it('recall paintMap must be [] even when overlayState has data', () => {
      const leakedPaintMap = [[1, 2, 0], [0, 0, 0], [0, 0, 0]]
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        overlayState: {...baseInput().overlayState, paintMap: leakedPaintMap},
      }))
      assert.deepStrictEqual(result.overlayDisplayProps.paintMap, [],
        'recall must not leak territory/area paint data')
    })

    it('recall markerMap must be null even when overlayState has data', () => {
      const leakedMarkerMap = [[{type: 'circle', data: {winrate: 0.7}}]]
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        overlayState: {...baseInput().overlayState, markerMap: leakedMarkerMap},
      }))
      assert.deepStrictEqual(result.overlayDisplayProps.markerMap, null,
        'recall must not leak heatmap/suggestion markers')
    })

    it('overlayGhostStoneMap must be null in recall (defense in depth)', () => {
      // Ghost stones are primarily hidden by showNextMoves=false at the Goban
      // rendering level. But projection should also clear the map as defense in
      // depth — if a rendering path ignores showNextMoves, the data itself is empty.
      const ghostMap = {0: {sign: 1}, 1: {sign: -1}}
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        overlayState: {...baseInput().overlayState, overlayGhostStoneMap: ghostMap},
      }))
      assert.deepStrictEqual(result.overlayDisplayProps.overlayGhostStoneMap, null,
        'recall must not leak ghost stone data even as defense in depth')
    })
  })

  // --- W3-T36: analysis=null implies analysisType must be empty ---

  describe('W3-T36: analysisType must be empty when analysis overlay is null', () => {
    // When analysis=null (recall, analysis-noEditWS), analysisType is meaningless
    // and should not signal to the UI that an overlay is available.
    // Currently analysisType passes through from input regardless — these are RED.

    it('recall: analysisType must be empty when analysis=null', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        analysisData: {activeAnalysis: {type: 'winrate'}, analysisType: 'ownership'},
      }))
      assert.strictEqual(result.overlayDisplayProps.analysis, null)
      assert.strictEqual(result.overlayDisplayProps.analysisType, '',
        'analysisType must not advertise overlay type when analysis is null')
    })

    it('analysis no editWS: analysisType must be empty when analysis=null', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {...baseInput().settings, editWorkspaceActive: false},
        analysisData: {activeAnalysis: {type: 'score'}, analysisType: 'scoreEstimate'},
      }))
      assert.strictEqual(result.overlayDisplayProps.analysis, null)
      assert.strictEqual(result.overlayDisplayProps.analysisType, '',
        'analysisType must not advertise overlay type when analysis is null')
    })
  })

  // --- W3-T37: boardStateProps passthrough stability ---

  describe('W3-T37: boardStateProps must not be modified by projection', () => {
    // projectGobanProps MUST NOT transform boardState. Tree switching (formal vs
    // editWorkspace) is the Container's responsibility — it swaps the input, not
    // the projection function. If projection adds mode-based boardState logic,
    // that's an architectural violation (moves state management into a pure function).

    it('gameTree reference is preserved, not cloned or replaced', () => {
      const tree = {id: 'formal_tree', root: {data: {}}}
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        boardState: {gameTree: tree, treePosition: 'pos_1', board: {width: 19, height: 19, signMap: []}},
      }))
      assert.strictEqual(result.boardStateProps.gameTree, tree,
        'projection must preserve gameTree reference, not create a new object')
    })

    it('changing mode does not change boardStateProps', () => {
      const boardState = {
        gameTree: {id: 'gt'},
        treePosition: 'pos_A',
        board: {width: 19, height: 19, signMap: []},
      }
      const play = projectGobanProps(baseInput({workbenchMode: 'play', boardState}))
      const recall = projectGobanProps(baseInput({workbenchMode: 'recall', boardState}))
      const analysis = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {...baseInput().settings, editWorkspaceActive: true},
        boardState,
      }))

      assert.strictEqual(play.boardStateProps.gameTree, recall.boardStateProps.gameTree)
      assert.strictEqual(play.boardStateProps.treePosition, recall.boardStateProps.treePosition)
      assert.strictEqual(play.boardStateProps.board, analysis.boardStateProps.board)
    })

    it('changing overlayState or settings does not affect boardStateProps', () => {
      const boardState = {
        gameTree: {id: 'gt_stable'},
        treePosition: 'n1',
        board: {width: 19, height: 19, signMap: []},
      }
      const result1 = projectGobanProps(baseInput({
        boardState,
        overlayState: {...baseInput().overlayState, paintMap: [], analysis: null},
        settings: {...baseInput().settings, showMoveNumbers: false},
      }))
      const result2 = projectGobanProps(baseInput({
        boardState,
        overlayState: {...baseInput().overlayState, paintMap: [[1]], analysis: {type: 'winrate'}},
        settings: {...baseInput().settings, showMoveNumbers: true, showAnalysis: true},
      }))
      assert.strictEqual(result1.boardStateProps.gameTree, result2.boardStateProps.gameTree)
      assert.strictEqual(result1.boardStateProps.treePosition, result2.boardStateProps.treePosition)
      assert.strictEqual(result1.boardStateProps.board, result2.boardStateProps.board)
    })
  })

  // --- W3-T38: hardcoded constant fields ---

  describe('W3-T38: hardcoded visual fields must not vary with mode or settings', () => {
    // These fields are intentionally hardcoded. If someone adds mode/settings
    // branching to them, it's likely unintentional.

    const modes = ['play', 'problem', 'recall', 'analysis']

    for (const mode of modes) {
      describe(`mode=${mode}`, () => {
        const input = mode === 'analysis'
          ? baseInput({workbenchMode: mode, settings: {...baseInput().settings, editWorkspaceActive: true}})
          : baseInput({workbenchMode: mode})

        it('showMoveColorization=false', () => {
          const result = projectGobanProps(input)
          assert.strictEqual(result.overlayDisplayProps.showMoveColorization, false)
        })
        it('fuzzyStonePlacement=false', () => {
          const result = projectGobanProps(input)
          assert.strictEqual(result.overlayDisplayProps.fuzzyStonePlacement, false)
        })
        it('animateStonePlacement=false', () => {
          const result = projectGobanProps(input)
          assert.strictEqual(result.overlayDisplayProps.animateStonePlacement, false)
        })
        it('highlightVertices=[]', () => {
          const result = projectGobanProps(input)
          assert.deepStrictEqual(result.overlayDisplayProps.highlightVertices, [])
        })
      })
    }
  })

})
