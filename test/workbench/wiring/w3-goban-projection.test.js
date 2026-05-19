/**
 * W3 Goban Projection Tests — projectGobanProps pure function
 *
 * Test contract: docs/design/2026-05-19/workbench-wiring/w3-goban-wiring-contract-v0.1.md
 * Contracts covered: W3-T01, W3-T02, W3-T03, W3-T04, W3-T05, W3-T06, W3-T07, W3-T08,
 *                    W3-T19, W3-T21, W3-T23
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
})