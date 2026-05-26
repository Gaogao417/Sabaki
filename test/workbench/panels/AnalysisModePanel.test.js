/**
 * AnalysisModePanel Contract Tests (Phase 5)
 *
 * Test contract: docs/design/2026-05-18/workbench-ui-phase-5/test-contract-v0.1.md
 * Contracts covered: T-5.5a through T-5.5d
 *
 * Test Legitimacy:
 *   All tests import the production AnalysisModePanel component.
 *   Production module missing -> tryImport returns null -> this.skip(), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 *
 * NOTE: AnalysisModePanel is a TO-BE-CREATED component.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

let AnalysisModePanel = null

/**
 * Helper: build no-op callbacks for all AnalysisModePanel props.
 */
function noopProps(overrides = {}) {
  return {
    moveCount: 0,
    captures: {black: 0, white: 0},
    evaluation: null,
    onSnapshot: () => {},
    ...overrides,
  }
}

describe('AnalysisModePanel (T-5.5)', function () {
  before(async function () {
    AnalysisModePanel = await tryImport('src/components/workbench/panels/AnalysisModePanel.js')
    if (!AnalysisModePanel) this.skip()
  })

  // --- T-5.5a: renders move count and captures ---
  // Production subject: AnalysisModePanel component
  // Production bug: moveCount or capture numbers not displayed
  // Controlled dependencies: props are inline
  it('T-5.5a: renders move count and captures', () => {
    const {queryByTestId} = renderToDom(
      h(AnalysisModePanel, noopProps({
        moveCount: 88,
        captures: {black: 7, white: 4},
      }))
    )

    const root = queryByTestId('analysis-mode-panel')
    assert.ok(root, 'Root element with data-testid="analysis-mode-panel" not found')

    assert.ok(
      root.textContent.includes('88'),
      'Root should contain moveCount "88"'
    )
    assert.ok(
      root.textContent.includes('7'),
      'Root should contain black captures "7"'
    )
    assert.ok(
      root.textContent.includes('4'),
      'Root should contain white captures "4"'
    )
  })

  // --- T-5.5b: renders evaluation when provided ---
  // Production subject: AnalysisModePanel component
  // Production bug: evaluation text not rendered when evaluation is non-null
  // Controlled dependencies: props are inline
  it('T-5.5b: renders evaluation when provided', () => {
    const {queryByTestId} = renderToDom(
      h(AnalysisModePanel, noopProps({
        evaluation: '黑优 72%',
      }))
    )

    const root = queryByTestId('analysis-mode-panel')
    assert.ok(root, 'Root element not found')

    const evalSection = queryByTestId('evaluation-section')
    assert.ok(
      evalSection,
      'Evaluation section with data-testid="evaluation-section" should be present when evaluation is provided'
    )

    assert.ok(
      evalSection.textContent.includes('黑优 72%'),
      'Evaluation section should contain evaluation text "黑优 72%"'
    )
  })

  // --- T-5.5c: fires onSnapshot callback ---
  // SIDE_EFFECT: callback invocation
  // Production subject: AnalysisModePanel component
  // Production bug: snapshot button click does not invoke onSnapshot
  // Controlled dependencies: props are inline
  it('T-5.5c: fires onSnapshot callback on button click', () => {
    let called = false
    const {queryByTestId} = renderToDom(
      h(AnalysisModePanel, noopProps({
        onSnapshot: () => { called = true },
      }))
    )

    const btn = queryByTestId('snapshot-btn')
    assert.ok(btn, 'Button with data-testid="snapshot-btn" not found')

    btn.click()
    assert.strictEqual(called, true, 'onSnapshot should be called on click')
  })

  // --- T-5.5d: no evaluation section when null ---
  // Production subject: AnalysisModePanel component
  // Production bug: evaluation section rendered even when evaluation is null
  // Controlled dependencies: props are inline
  it('T-5.5d: no evaluation section when evaluation is null', () => {
    const {queryByTestId} = renderToDom(
      h(AnalysisModePanel, noopProps({
        evaluation: null,
      }))
    )

    const root = queryByTestId('analysis-mode-panel')
    assert.ok(root, 'Root element not found')

    const evalSection = queryByTestId('evaluation-section')
    assert.ok(
      !evalSection,
      'Evaluation section should NOT be present when evaluation is null'
    )
  })

  it('renders analysis projection from props without static sample rows', () => {
    const {queryByTestId} = renderToDom(
      h(AnalysisModePanel, noopProps({
        analysisContext: {
          source: 'analysis test context from props',
          taskId: 'task_analysis_panel',
          checkpointId: 'chk_analysis_panel',
        },
        analysisProjection: {
          treeRows: [{label: 'analysis branch from projection', score: '+1.5'}],
          issues: [{label: 'analysis issue from projection', delta: '-3.0', status: 'review'}],
          referenceLine: 'reference line from projection',
          correctionLine: 'correction line from projection',
          engineStatus: 'engine status from projection',
          evaluation: 'evaluation from projection',
        },
      }))
    )

    const root = queryByTestId('analysis-mode-panel')
    assert.ok(root.textContent.includes('analysis test context from props'))
    assert.ok(root.textContent.includes('analysis branch from projection'))
    assert.ok(root.textContent.includes('analysis issue from projection'))
    assert.ok(root.textContent.includes('reference line from projection'))
    assert.ok(root.textContent.includes('correction line from projection'))
    assert.ok(root.textContent.includes('engine status from projection'))
    assert.ok(!root.textContent.includes('黑 R10'))
  })
})

describe('AnalysisModePanel state overlay (T-7.2g)', function () {
  before(async function () {
    AnalysisModePanel = await tryImport('src/components/workbench/panels/AnalysisModePanel.js')
    if (!AnalysisModePanel) this.skip()
  })

  // --- T-7.2g: state="loading" renders loading indicator ---
  // Production subject: AnalysisModePanel component state prop
  // Production bug: loading indicator not rendered when state="loading"
  // Controlled dependencies: props are inline
  it('T-7.2g: state="loading" renders loading indicator', () => {
    const {queryByTestId} = renderToDom(
      h(AnalysisModePanel, noopProps({state: 'loading'}))
    )

    const indicator = queryByTestId('loading-indicator')
    assert.ok(indicator, 'data-testid="loading-indicator" should be present when state="loading"')
  })
})
