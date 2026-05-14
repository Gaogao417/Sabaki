import assert from 'assert'

import {resolveAnalysisDisplay} from '../../src/modules/overlays/resolveAnalysisDisplay.ts'

function makeInput(overrides = {}) {
  return {
    mode: 'analysis',
    showAnalysis: true,
    showAISuggestions: true,
    showHumanPreference: false,
    showNextMoves: true,
    showSiblings: true,
    editWorkspaceActive: false,
    ...overrides,
  }
}

describe('resolveAnalysisDisplay', () => {
  // --- Baseline: analysis mode works ---

  describe('analysis mode', () => {
    it('shows analysis when flags are on', () => {
      let result = resolveAnalysisDisplay(makeInput({mode: 'analysis'}))
      assert.strictEqual(result.showAnalysis, true)
      assert.strictEqual(result.showAISuggestions, true)
      assert.strictEqual(result.showAnalysisSummaryCard, true)
    })

    it('shows next moves and siblings', () => {
      let result = resolveAnalysisDisplay(makeInput({mode: 'analysis'}))
      assert.strictEqual(result.showNextMoves, true)
      assert.strictEqual(result.showSiblings, true)
    })

    it('hides analysis when showAnalysis is off', () => {
      let result = resolveAnalysisDisplay(makeInput({showAnalysis: false}))
      assert.strictEqual(result.showAnalysis, false)
    })

    it('hides AI suggestions when flag is off', () => {
      let result = resolveAnalysisDisplay(
        makeInput({showAISuggestions: false, showHumanPreference: false}),
      )
      assert.strictEqual(result.showAnalysis, false)
      assert.strictEqual(result.showAISuggestions, false)
    })

    it('shows analysis with human preference only', () => {
      let result = resolveAnalysisDisplay(
        makeInput({showAISuggestions: false, showHumanPreference: true}),
      )
      assert.strictEqual(result.showAnalysis, true)
      assert.strictEqual(result.showHumanPreference, true)
    })
  })

  // --- Regression: recall mode should show analysis ---

  describe('recall mode', () => {
    it('shows analysis when flags are on', () => {
      let result = resolveAnalysisDisplay(makeInput({mode: 'recall'}))
      assert.strictEqual(result.showAnalysis, true)
      assert.strictEqual(result.showAISuggestions, true)
      assert.strictEqual(result.showAnalysisSummaryCard, true)
    })

    it('hides next moves and siblings (do not spoil expected moves)', () => {
      let result = resolveAnalysisDisplay(makeInput({mode: 'recall'}))
      assert.strictEqual(result.showNextMoves, false)
      assert.strictEqual(result.showSiblings, false)
    })

    it('hides analysis when showAnalysis is off', () => {
      let result = resolveAnalysisDisplay(
        makeInput({mode: 'recall', showAnalysis: false}),
      )
      assert.strictEqual(result.showAnalysis, false)
    })

    it('shows human preference when flag is on', () => {
      let result = resolveAnalysisDisplay(
        makeInput({
          mode: 'recall',
          showAISuggestions: false,
          showHumanPreference: true,
        }),
      )
      assert.strictEqual(result.showAnalysis, true)
      assert.strictEqual(result.showHumanPreference, true)
    })
  })

  // --- Other modes: analysis hidden ---

  describe('play mode', () => {
    it('hides analysis', () => {
      let result = resolveAnalysisDisplay(makeInput({mode: 'play'}))
      assert.strictEqual(result.showAnalysis, false)
      assert.strictEqual(result.showAISuggestions, false)
      assert.strictEqual(result.showAnalysisSummaryCard, false)
    })

    it('shows next moves and siblings', () => {
      let result = resolveAnalysisDisplay(makeInput({mode: 'play'}))
      assert.strictEqual(result.showNextMoves, true)
      assert.strictEqual(result.showSiblings, true)
    })
  })

  describe('scoring mode', () => {
    it('hides analysis', () => {
      let result = resolveAnalysisDisplay(makeInput({mode: 'scoring'}))
      assert.strictEqual(result.showAnalysis, false)
      assert.strictEqual(result.showAnalysisSummaryCard, false)
    })
  })

  describe('problem mode', () => {
    it('hides analysis', () => {
      let result = resolveAnalysisDisplay(makeInput({mode: 'problem'}))
      assert.strictEqual(result.showAnalysis, false)
      assert.strictEqual(result.showAnalysisSummaryCard, false)
    })

    it('hides next moves and siblings', () => {
      let result = resolveAnalysisDisplay(makeInput({mode: 'problem'}))
      assert.strictEqual(result.showNextMoves, false)
      assert.strictEqual(result.showSiblings, false)
    })
  })

  describe('guess mode', () => {
    it('hides analysis', () => {
      let result = resolveAnalysisDisplay(makeInput({mode: 'guess'}))
      assert.strictEqual(result.showAnalysis, false)
    })

    it('hides next moves and siblings', () => {
      let result = resolveAnalysisDisplay(makeInput({mode: 'guess'}))
      assert.strictEqual(result.showNextMoves, false)
      assert.strictEqual(result.showSiblings, false)
    })
  })

  // --- Edit workspace ---

  describe('edit workspace active', () => {
    it('hides next moves and siblings regardless of mode', () => {
      let result = resolveAnalysisDisplay(
        makeInput({mode: 'analysis', editWorkspaceActive: true}),
      )
      assert.strictEqual(result.showNextMoves, false)
      assert.strictEqual(result.showSiblings, false)
    })
  })
})
