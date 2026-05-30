/**
 * W3 Goban Overlay Policy Tests — overlay activation/deactivation by WorkbenchMode
 *
 * Test contract: docs/design/2026-05-19/workbench-wiring/w3-goban-wiring-contract-v0.1.md
 * Matrix reference: docs/design/2026-05-19/workbench-wiring/goban-overlay-state-matrix-v0.1.md §2.3
 *
 * Source of truth alignment:
 *   - Matrix §2.3: Overlay Activation by Mode
 *   - Contract §7: projectGobanProps Per-Mode Behavior
 *   - PRD v0.5 §3.3: Recall MUST NOT modify game tree (implies no analysis overlay)
 *
 * Test Legitimacy:
 *   All tests import projectGobanProps from production code.
 *   Production module missing -> tryImport returns null -> this.skip(), no silent pass.
 *   Controlled dependencies: inline input objects.
 */

import assert from 'assert'
import {tryImport} from '../tryImport.js'

let projectGobanProps = null

describe('W3 Goban Overlay Policy — activation/deactivation by WorkbenchMode', function () {
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

  const fakeAnalysisData = {
    activeAnalysis: {
      id: 'analysis_1',
      variations: [{vertex: [3, 3], visits: 100, winrate: 0.55}],
    },
    analysisType: 'winrate',
  }

  // ===================================================================
  // CRITICAL RULE 1: Recall MUST NOT show analysis overlay
  // Even when overlayState.analysis is non-null AND settings.showAnalysis=true,
  // recall mode must return analysis=null.
  // Rationale: PRD v0.5 §3.3 recall MUST NOT modify game tree.
  //   Showing AI suggestions during recall would subvert the recall test.
  // ===================================================================

  describe('CRITICAL: recall MUST NOT show analysis overlay', () => {
    it('returns analysis=null even when overlayState.analysis is non-null and showAnalysis=true', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        overlayState: {
          paintMap: [],
          markerMap: [],
          dimmedStones: [],
          analysis: {variations: [{vertex: [3, 3], visits: 100}], winrate: 0.55},
        },
        settings: {
          ...baseInput().settings,
          showAnalysis: true,
        },
        analysisData: fakeAnalysisData,
      }))

      assert.strictEqual(result.overlayDisplayProps.analysis, null)
    })

    it('returns analysis=null when overlayState.analysis is non-null and showAnalysis=false', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        overlayState: {
          paintMap: [],
          markerMap: [],
          dimmedStones: [],
          analysis: {variations: [{vertex: [4, 4]}]},
        },
        settings: {
          ...baseInput().settings,
          showAnalysis: false,
        },
      }))

      assert.strictEqual(result.overlayDisplayProps.analysis, null)
    })

    it('returns analysis=null when analysisData is provided in recall mode', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        overlayState: {
          paintMap: [],
          markerMap: [],
          dimmedStones: [],
          analysis: {variations: [{vertex: [10, 10]}]},
        },
        analysisData: fakeAnalysisData,
        settings: {
          ...baseInput().settings,
          showAnalysis: true,
        },
      }))

      assert.strictEqual(result.overlayDisplayProps.analysis, null)
    })
  })

  // ===================================================================
  // CRITICAL RULE 2: Recall MUST NOT show ghost stones
  // showNextMoves=false, showSiblings=false regardless of settings.
  // Rationale: Ghost stones would reveal the next expected move
  //   during recall, defeating the purpose of testing memory.
  // ===================================================================

  describe('CRITICAL: recall MUST NOT show ghost stones', () => {
    it('returns showNextMoves=false regardless of settings.showNextMoves=true', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        settings: {
          ...baseInput().settings,
          showNextMoves: true,
        },
      }))

      assert.strictEqual(result.overlayDisplayProps.showNextMoves, false)
    })

    it('returns showSiblings=false regardless of settings.showSiblings=true', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        settings: {
          ...baseInput().settings,
          showSiblings: true,
        },
      }))

      assert.strictEqual(result.overlayDisplayProps.showSiblings, false)
    })

    it('returns both false when settings enable both and overlayState has ghost data', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        settings: {
          ...baseInput().settings,
          showNextMoves: true,
          showSiblings: true,
        },
        overlayState: {
          paintMap: [],
          markerMap: [],
          dimmedStones: [],
          analysis: null,
          overlayGhostStoneMap: {[[3, 3]]: {sign: 1}},
        },
      }))

      assert.strictEqual(result.overlayDisplayProps.showNextMoves, false)
      assert.strictEqual(result.overlayDisplayProps.showSiblings, false)
    })
  })

  // ===================================================================
  // CRITICAL RULE 3: Play MUST NOT show move numbers
  // showMoveNumbers=false regardless of settings.
  // Rationale: Matrix §2.3 play row — move numbers disabled in play.
  // ===================================================================

  describe('CRITICAL: play MUST NOT show move numbers', () => {
    it('returns showMoveNumbers=false when settings.showMoveNumbers=true', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {
          ...baseInput().settings,
          showMoveNumbers: true,
        },
      }))

      assert.strictEqual(result.overlayDisplayProps.showMoveNumbers, false)
    })

    it('returns showMoveNumbers=false when settings.showMoveNumbers=false', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {
          ...baseInput().settings,
          showMoveNumbers: false,
        },
      }))

      assert.strictEqual(result.overlayDisplayProps.showMoveNumbers, false)
    })
  })

  // ===================================================================
  // CRITICAL RULE 4: Analysis without editWorkspace MUST NOT show analysis overlay
  // analysis=null when editWorkspaceActive=false.
  // Rationale: Legacy analysis path does not go through workbench overlay pipeline.
  // ===================================================================

  describe('CRITICAL: analysis without editWorkspace MUST NOT show analysis overlay', () => {
    it('returns analysis=null when editWorkspaceActive=false and showAnalysis=true', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {
          ...baseInput().settings,
          editWorkspaceActive: false,
          showAnalysis: true,
        },
        overlayState: {
          paintMap: [],
          markerMap: [],
          dimmedStones: [],
          analysis: {variations: [{vertex: [3, 3]}]},
        },
        analysisData: fakeAnalysisData,
      }))

      assert.strictEqual(result.overlayDisplayProps.analysis, null)
    })

    it('returns dragMode=false when editWorkspaceActive=false', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {
          ...baseInput().settings,
          editWorkspaceActive: false,
        },
      }))

      assert.strictEqual(result.interactionProps.dragMode, false)
    })

    it('returns drawLineMode=null when editWorkspaceActive=false even if tool is arrow', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {
          ...baseInput().settings,
          editWorkspaceActive: false,
          selectedTool: 'arrow',
        },
      }))

      assert.strictEqual(result.interactionProps.drawLineMode, null)
    })

    it('returns showMoveNumbers=false when editWorkspaceActive=false regardless of settings', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {
          ...baseInput().settings,
          editWorkspaceActive: false,
          showMoveNumbers: true,
        },
      }))

      assert.strictEqual(result.overlayDisplayProps.showMoveNumbers, false)
    })
  })

  // ===================================================================
  // CRITICAL RULE 5: dimmedStones is ALWAYS [] for all modes
  // Scoring dimming is handled elsewhere (MainView/scoring pipeline),
  // not in projectGobanProps.
  // ===================================================================

  describe('CRITICAL: dimmedStones is ALWAYS [] for all modes', () => {
    const modes = ['play', 'problem', 'recall', 'analysis']

    for (const mode of modes) {
      it(`returns dimmedStones=[] in ${mode} mode`, () => {
        const editWorkspaceActive = mode === 'analysis'
        const result = projectGobanProps(baseInput({
          workbenchMode: mode,
          settings: {
            ...baseInput().settings,
            editWorkspaceActive,
          },
          overlayState: {
            paintMap: [],
            markerMap: [],
            dimmedStones: [[3, 3], [15, 15]],
            analysis: null,
          },
        }))

        assert.deepStrictEqual(result.overlayDisplayProps.dimmedStones, [])
      })
    }

    it('returns dimmedStones=[] even when input overlayState.dimmedStones is non-empty', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        overlayState: {
          paintMap: [],
          markerMap: [],
          dimmedStones: [[0, 0], [1, 1], [2, 2]],
          analysis: null,
        },
      }))

      assert.deepStrictEqual(result.overlayDisplayProps.dimmedStones, [])
    })
  })

  // ===================================================================
  // CRITICAL RULE 6: highlightVertices is ALWAYS [] for all modes
  // Find highlighting is handled elsewhere, not in projectGobanProps.
  // ===================================================================

  describe('CRITICAL: highlightVertices is ALWAYS [] for all modes', () => {
    const modes = ['play', 'problem', 'recall', 'analysis']

    for (const mode of modes) {
      it(`returns highlightVertices=[] in ${mode} mode`, () => {
        const editWorkspaceActive = mode === 'analysis'
        const result = projectGobanProps(baseInput({
          workbenchMode: mode,
          settings: {
            ...baseInput().settings,
            editWorkspaceActive,
          },
        }))

        assert.deepStrictEqual(result.overlayDisplayProps.highlightVertices, [])
      })
    }
  })

  // ===================================================================
  // Play mode overlay policy
  // Matrix §2.3 play: ghost stones from settings, heatmap gated by
  // showAnalysis, move numbers always false, human preference passthrough.
  // ===================================================================

  describe('play mode overlay activation policy', () => {
    it('shows ghost stones (showNextMoves) when settings.enable it', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {
          ...baseInput().settings,
          showNextMoves: true,
        },
      }))

      assert.strictEqual(result.overlayDisplayProps.showNextMoves, true)
    })

    it('hides ghost stones (showNextMoves) when settings disable it', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {
          ...baseInput().settings,
          showNextMoves: false,
        },
      }))

      assert.strictEqual(result.overlayDisplayProps.showNextMoves, false)
    })

    it('shows sibling ghost stones when settings.enable it', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {
          ...baseInput().settings,
          showSiblings: true,
        },
      }))

      assert.strictEqual(result.overlayDisplayProps.showSiblings, true)
    })

    it('hides sibling ghost stones when settings disable it', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {
          ...baseInput().settings,
          showSiblings: false,
        },
      }))

      assert.strictEqual(result.overlayDisplayProps.showSiblings, false)
    })

    it('hides analysis overlay in play even when showAnalysis=true and analysis data present', () => {
      const analysisObj = {variations: [{vertex: [3, 3], visits: 50}]}
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {
          ...baseInput().settings,
          showAnalysis: true,
        },
        overlayState: {
          paintMap: [],
          markerMap: [],
          dimmedStones: [],
          analysis: analysisObj,
        },
      }))

      assert.strictEqual(result.overlayDisplayProps.analysis, null)
    })

    it('hides analysis overlay when showAnalysis=false even if analysis data present', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {
          ...baseInput().settings,
          showAnalysis: false,
        },
        overlayState: {
          paintMap: [],
          markerMap: [],
          dimmedStones: [],
          analysis: {variations: [{vertex: [3, 3]}]},
        },
      }))

      assert.strictEqual(result.overlayDisplayProps.analysis, null)
    })

    it('hides analysis overlay when showAnalysis=true but no analysis data', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {
          ...baseInput().settings,
          showAnalysis: true,
        },
        overlayState: {
          paintMap: [],
          markerMap: [],
          dimmedStones: [],
          analysis: null,
        },
      }))

      assert.strictEqual(result.overlayDisplayProps.analysis, null)
    })

    it('passes through showHumanPreference from settings', () => {
      const resultTrue = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {
          ...baseInput().settings,
          showHumanPreference: true,
        },
      }))
      const resultFalse = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: {
          ...baseInput().settings,
          showHumanPreference: false,
        },
      }))

      assert.strictEqual(resultTrue.overlayDisplayProps.showHumanPreference, true)
      assert.strictEqual(resultFalse.overlayDisplayProps.showHumanPreference, false)
    })
  })

  // ===================================================================
  // Problem mode overlay policy
  // Matrix §2.3 problem: same as play for overlays.
  // ===================================================================

  describe('problem mode overlay activation policy (same as play)', () => {
    it('shows ghost stones from settings', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        settings: {
          ...baseInput().settings,
          showNextMoves: true,
          showSiblings: true,
        },
      }))

      assert.strictEqual(result.overlayDisplayProps.showNextMoves, true)
      assert.strictEqual(result.overlayDisplayProps.showSiblings, true)
    })

    it('hides analysis when showAnalysis=false', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        settings: {
          ...baseInput().settings,
          showAnalysis: false,
        },
        overlayState: {
          paintMap: [],
          markerMap: [],
          dimmedStones: [],
          analysis: {variations: [{vertex: [3, 3]}]},
        },
      }))

      assert.strictEqual(result.overlayDisplayProps.analysis, null)
    })

    it('hides analysis in problem even when showAnalysis=true and data present', () => {
      const analysisObj = {variations: [{vertex: [4, 4]}]}
      const result = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        settings: {
          ...baseInput().settings,
          showAnalysis: true,
        },
        overlayState: {
          paintMap: [],
          markerMap: [],
          dimmedStones: [],
          analysis: analysisObj,
        },
      }))

      assert.strictEqual(result.overlayDisplayProps.analysis, null)
    })

    it('returns showMoveNumbers=false (same as play)', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        settings: {
          ...baseInput().settings,
          showMoveNumbers: true,
        },
      }))

      assert.strictEqual(result.overlayDisplayProps.showMoveNumbers, false)
    })

    it('problem and play produce identical overlay props for identical inputs', () => {
      const sharedSettings = {
        showMoveNumbers: true,
        showNextMoves: true,
        showSiblings: false,
        showAnalysis: true,
        showCoordinates: true,
        showHumanPreference: false,
        selectedTool: 'stone_1',
        editWorkspaceActive: false,
        boardTransformation: [1, 0, 0, 1, 0, 0],
        areaSelectMode: false,
      }
      const sharedOverlayState = {
        paintMap: [],
        markerMap: [],
        dimmedStones: [],
        analysis: {variations: [{vertex: [3, 3]}]},
      }

      const playResult = projectGobanProps(baseInput({
        workbenchMode: 'play',
        settings: sharedSettings,
        overlayState: sharedOverlayState,
      }))
      const problemResult = projectGobanProps(baseInput({
        workbenchMode: 'problem',
        settings: sharedSettings,
        overlayState: sharedOverlayState,
      }))

      assert.deepStrictEqual(
        playResult.overlayDisplayProps,
        problemResult.overlayDisplayProps,
        'problem and play should produce identical overlayDisplayProps for identical inputs',
      )
    })
  })

  // ===================================================================
  // Recall mode overlay policy
  // Matrix §2.3 recall: ghost stones disabled, heatmap disabled,
  // move numbers enabled, human preference passthrough.
  // ===================================================================

  describe('recall mode overlay activation policy', () => {
    it('returns showMoveNumbers=true regardless of settings', () => {
      const resultWithSettingTrue = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        settings: {
          ...baseInput().settings,
          showMoveNumbers: true,
        },
      }))
      const resultWithSettingFalse = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        settings: {
          ...baseInput().settings,
          showMoveNumbers: false,
        },
      }))

      assert.strictEqual(resultWithSettingTrue.overlayDisplayProps.showMoveNumbers, true)
      assert.strictEqual(resultWithSettingFalse.overlayDisplayProps.showMoveNumbers, true)
    })

    it('passes through showHumanPreference from settings', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
        settings: {
          ...baseInput().settings,
          showHumanPreference: true,
        },
      }))

      assert.strictEqual(result.overlayDisplayProps.showHumanPreference, true)
    })

    it('returns crosshair=false', () => {
      const result = projectGobanProps(baseInput({workbenchMode: 'recall'}))

      assert.strictEqual(result.overlayDisplayProps.crosshair, false)
    })
  })

  // ===================================================================
  // Analysis mode with editWorkspace overlay policy
  // Matrix §2.3 analysis (editWS): full overlay access.
  // ===================================================================

  describe('analysis mode with editWorkspace overlay activation policy', () => {
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

    it('shows ghost stones from settings (showNextMoves)', () => {
      const result = projectGobanProps(analysisEditInput({
        settings: {
          ...baseInput().settings,
          editWorkspaceActive: true,
          showNextMoves: true,
        },
      }))

      assert.strictEqual(result.overlayDisplayProps.showNextMoves, true)
    })

    it('hides ghost stones when settings disable showNextMoves', () => {
      const result = projectGobanProps(analysisEditInput({
        settings: {
          ...baseInput().settings,
          editWorkspaceActive: true,
          showNextMoves: false,
        },
      }))

      assert.strictEqual(result.overlayDisplayProps.showNextMoves, false)
    })

    it('shows analysis overlay when showAnalysis=true and data present', () => {
      const analysisObj = {variations: [{vertex: [10, 10], visits: 200}]}
      const result = projectGobanProps(analysisEditInput({
        settings: {
          ...baseInput().settings,
          editWorkspaceActive: true,
          showAnalysis: true,
        },
        overlayState: {
          paintMap: [],
          markerMap: [],
          dimmedStones: [],
          analysis: analysisObj,
        },
      }))

      assert.strictEqual(result.overlayDisplayProps.analysis, analysisObj)
    })

    it('hides analysis overlay when showAnalysis=false even with data', () => {
      const result = projectGobanProps(analysisEditInput({
        settings: {
          ...baseInput().settings,
          editWorkspaceActive: true,
          showAnalysis: false,
        },
        overlayState: {
          paintMap: [],
          markerMap: [],
          dimmedStones: [],
          analysis: {variations: [{vertex: [3, 3]}]},
        },
      }))

      assert.strictEqual(result.overlayDisplayProps.analysis, null)
    })

    it('showMoveNumbers follows settings', () => {
      const resultOn = projectGobanProps(analysisEditInput({
        settings: {
          ...baseInput().settings,
          editWorkspaceActive: true,
          showMoveNumbers: true,
        },
      }))
      const resultOff = projectGobanProps(analysisEditInput({
        settings: {
          ...baseInput().settings,
          editWorkspaceActive: true,
          showMoveNumbers: false,
        },
      }))

      assert.strictEqual(resultOn.overlayDisplayProps.showMoveNumbers, true)
      assert.strictEqual(resultOff.overlayDisplayProps.showMoveNumbers, false)
    })

    it('passes through showHumanPreference from settings', () => {
      const result = projectGobanProps(analysisEditInput({
        settings: {
          ...baseInput().settings,
          editWorkspaceActive: true,
          showHumanPreference: true,
        },
      }))

      assert.strictEqual(result.overlayDisplayProps.showHumanPreference, true)
    })

    it('passes through analysisType from analysisData when analysis overlay is present', () => {
      const result = projectGobanProps(analysisEditInput({
        overlayState: {
          ...baseInput().overlayState,
          analysis: {type: 'winrate', data: {}},
        },
        analysisData: {
          activeAnalysis: null,
          analysisType: 'winrate',
        },
      }))

      assert.strictEqual(result.overlayDisplayProps.analysisType, 'winrate')
    })

    it('clears analysisType when analysis overlay is null (per W3-T36)', () => {
      const result = projectGobanProps(analysisEditInput({
        analysisData: {
          activeAnalysis: null,
          analysisType: 'winrate',
        },
      }))

      assert.strictEqual(result.overlayDisplayProps.analysis, null)
      assert.strictEqual(result.overlayDisplayProps.analysisType, '')
    })

    it('returns empty string analysisType when analysisData is null', () => {
      const result = projectGobanProps(analysisEditInput({
        analysisData: null,
      }))

      assert.strictEqual(result.overlayDisplayProps.analysisType, '')
    })
  })

  // ===================================================================
  // Cross-mode safety: verify that settings cannot override mode guards
  // These tests confirm the mode-specific overlay gates are hard guards,
  // not soft preferences.
  // ===================================================================

  describe('cross-mode safety: settings cannot override mode overlay guards', () => {
    it('all settings true in recall still produces analysis=null, showNextMoves=false, showSiblings=false', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'recall',
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
          areaSelectMode: false,
        },
        overlayState: {
          paintMap: [],
          markerMap: [],
          dimmedStones: [],
          analysis: {variations: [{vertex: [5, 5]}]},
        },
        analysisData: fakeAnalysisData,
      }))

      assert.strictEqual(result.overlayDisplayProps.analysis, null)
      assert.strictEqual(result.overlayDisplayProps.showNextMoves, false)
      assert.strictEqual(result.overlayDisplayProps.showSiblings, false)
      assert.strictEqual(result.overlayDisplayProps.showMoveNumbers, true)
    })

    it('all settings true in play still produces showMoveNumbers=false', () => {
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
          areaSelectMode: false,
        },
      }))

      assert.strictEqual(result.overlayDisplayProps.showMoveNumbers, false)
    })

    it('all settings true in analysis without editWorkspace still produces analysis=null and showMoveNumbers=false', () => {
      const result = projectGobanProps(baseInput({
        workbenchMode: 'analysis',
        settings: {
          showMoveNumbers: true,
          showNextMoves: true,
          showSiblings: true,
          showAnalysis: true,
          showCoordinates: true,
          showHumanPreference: true,
          selectedTool: 'arrow',
          editWorkspaceActive: false,
          boardTransformation: [1, 0, 0, 1, 0, 0],
          areaSelectMode: false,
        },
        overlayState: {
          paintMap: [],
          markerMap: [],
          dimmedStones: [],
          analysis: {variations: [{vertex: [3, 3]}]},
        },
        analysisData: fakeAnalysisData,
      }))

      assert.strictEqual(result.overlayDisplayProps.analysis, null)
      assert.strictEqual(result.overlayDisplayProps.showMoveNumbers, false)
    })
  })
})
