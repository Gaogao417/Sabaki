/**
 * RightModePanel Contract Tests (Phase 4)
 *
 * Test contract: docs/design/2026-05-18/workbench-ui-phase-4/test-contract-v0.1.md
 * Contracts covered: T-4.4a, T-4.4b
 *
 * Test Legitimacy:
 *   All tests import the production RightModePanel component.
 *   Production module missing -> tryImport returns null -> this.skip(), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 *
 * NOTE: RightModePanel is a TO-BE-CREATED component.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

let RightModePanel = null
let PlayRightPanel = null
let ProblemRightPanel = null
let RecallRightPanel = null
let AnalysisRightPanel = null

describe('RightModePanel (T-4.4)', function () {
  before(async function () {
    RightModePanel = await tryImport('src/components/workbench/shell/RightModePanel.js')
    if (!RightModePanel) this.skip()
  })

  // --- T-4.4a: renders placeholder per mode ---
  // Production subject: RightModePanel component
  // Production bug: placeholder content missing or root testid missing
  // Controlled dependencies: props are inline
  const modes = ['play', 'problem', 'recall', 'analysis']

  for (const mode of modes) {
    it(`T-4.4a: renders placeholder for mode=${mode}`, () => {
      const {queryByTestId} = renderToDom(
        h(RightModePanel, {mode})
      )

      const root = queryByTestId('right-mode-panel')
      assert.ok(root, `Root with data-testid="right-mode-panel" not found for mode=${mode}`)

      // The panel should contain some placeholder content (non-empty)
      assert.ok(
        root.textContent.trim().length > 0,
        `Right panel should have placeholder content for mode=${mode}`
      )
    })
  }

  // --- T-4.4b: switches content on mode change ---
  // Production subject: RightModePanel component
  // Production bug: mode change does not update panel content
  // Controlled dependencies: props are inline
  it('T-4.4b: switches content when mode changes', () => {
    const playResult = renderToDom(
      h(RightModePanel, {mode: 'play'})
    )
    const playContent = playResult.queryByTestId('right-mode-panel').textContent.trim()

    const analysisResult = renderToDom(
      h(RightModePanel, {mode: 'analysis'})
    )
    const analysisContent = analysisResult.queryByTestId('right-mode-panel').textContent.trim()

    assert.notStrictEqual(
      playContent,
      analysisContent,
      'Switching mode from play to analysis should change the panel content'
    )
  })
})

/**
 * RightModePanel Phase 6 Integration Tests (T-6.5)
 *
 * Contracts covered: T-6.5a, T-6.5b, T-6.5c, T-6.5d
 *
 * Verifies RightModePanel delegates to the correct right panel component
 * based on the mode prop, and passes through relevant props.
 */

describe('RightModePanel Phase 6 Integration (T-6.5)', function () {
  before(async function () {
    RightModePanel = await tryImport('src/components/workbench/shell/RightModePanel.js')
    PlayRightPanel = await tryImport('src/components/workbench/panels/PlayRightPanel.js')
    ProblemRightPanel = await tryImport('src/components/workbench/panels/ProblemRightPanel.js')
    RecallRightPanel = await tryImport('src/components/workbench/panels/RecallRightPanel.js')
    AnalysisRightPanel = await tryImport('src/components/workbench/panels/AnalysisRightPanel.js')
    if (!RightModePanel) this.skip()
  })

  // --- T-6.5a: play mode delegates to PlayRightPanel ---
  it('T-6.5a: renders PlayRightPanel for play mode', function () {
    if (!PlayRightPanel) return this.skip()

    const {queryByTestId} = renderToDom(
      h(RightModePanel, {
        mode: 'play',
        moveCount: 10,
        captures: {black: 1, white: 2},
        pendingEval: 0,
        badMoveCount: 0,
      })
    )

    const rightRoot = queryByTestId('right-mode-panel')
    assert.ok(rightRoot, 'Right mode panel root should exist')

    const playPanel = queryByTestId('play-right-panel')
    assert.ok(playPanel, 'PlayRightPanel should be rendered inside RightModePanel for play mode')
  })

  // --- T-6.5b: problem mode delegates to ProblemRightPanel ---
  it('T-6.5b: renders ProblemRightPanel for problem mode', function () {
    if (!ProblemRightPanel) return this.skip()

    const {queryByTestId} = renderToDom(
      h(RightModePanel, {
        mode: 'problem',
        currentVariation: 1,
        opponentMode: 'ai',
        hint: null,
        aiAnalysisHidden: true,
        referenceLines: [],
      })
    )

    const problemPanel = queryByTestId('problem-right-panel')
    assert.ok(problemPanel, 'ProblemRightPanel should be rendered inside RightModePanel for problem mode')
  })

  // --- T-6.5c: recall mode delegates to RecallRightPanel ---
  it('T-6.5c: renders RecallRightPanel for recall mode', function () {
    if (!RecallRightPanel) return this.skip()

    const {queryByTestId} = renderToDom(
      h(RightModePanel, {
        mode: 'recall',
        hintMessage: 'test',
        systemCheckpoints: 0,
        manualCheckpoints: 0,
        correctCount: 0,
        wrongCount: 0,
        progress: 0,
        totalMoves: 0,
      })
    )

    const recallPanel = queryByTestId('recall-right-panel')
    assert.ok(recallPanel, 'RecallRightPanel should be rendered inside RightModePanel for recall mode')
  })

  // --- T-6.5d: analysis mode delegates to AnalysisRightPanel ---
  it('T-6.5d: renders AnalysisRightPanel for analysis mode', function () {
    if (!AnalysisRightPanel) return this.skip()

    const {queryByTestId} = renderToDom(
      h(RightModePanel, {
        mode: 'analysis',
        moveCount: 5,
        captures: {black: 0, white: 0},
        evaluation: null,
        userOriginalLine: null,
        userCorrection: null,
        aiCandidates: null,
      })
    )

    const analysisPanel = queryByTestId('analysis-right-panel')
    assert.ok(analysisPanel, 'AnalysisRightPanel should be rendered inside RightModePanel for analysis mode')
  })
})
