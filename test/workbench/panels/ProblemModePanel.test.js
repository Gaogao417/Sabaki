/**
 * ProblemModePanel Contract Tests (Phase 5)
 *
 * Test contract: docs/design/2026-05-18/workbench-ui-phase-5/test-contract-v0.1.md
 * Contracts covered: T-5.2a through T-5.2e
 *
 * Test Legitimacy:
 *   All tests import the production ProblemModePanel component.
 *   Production module missing -> tryImport returns null -> this.skip(), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 *
 * NOTE: ProblemModePanel is a TO-BE-CREATED component.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

let ProblemModePanel = null

/**
 * Helper: build no-op callbacks for all ProblemModePanel props.
 */
function noopProps(overrides = {}) {
  return {
    prompt: '',
    goal: '',
    passRuleSummary: '',
    referenceLines: [],
    blackPlayer: '',
    whitePlayer: '',
    onOpponentChange: () => {},
    onRequestHint: () => {},
    ...overrides,
  }
}

describe('ProblemModePanel (T-5.2)', function () {
  before(async function () {
    ProblemModePanel = await tryImport('src/components/workbench/panels/ProblemModePanel.js')
    if (!ProblemModePanel) this.skip()
  })

  // --- T-5.2a: renders prompt and goal ---
  // Production subject: ProblemModePanel component
  // Production bug: prompt or goal text not rendered
  // Controlled dependencies: props are inline
  it('T-5.2a: renders prompt and goal', () => {
    const {queryByTestId} = renderToDom(
      h(ProblemModePanel, noopProps({
        prompt: '黑先杀白',
        goal: '找到正确的手筋',
      }))
    )

    const root = queryByTestId('problem-mode-panel')
    assert.ok(root, 'Root element with data-testid="problem-mode-panel" not found')

    assert.ok(
      root.textContent.includes('黑先杀白'),
      'Root should contain prompt text "黑先杀白"'
    )
    assert.ok(
      root.textContent.includes('找到正确的手筋'),
      'Root should contain goal text "找到正确的手筋"'
    )
  })

  // --- T-5.2b: renders pass rule summary ---
  // Production subject: ProblemModePanel component
  // Production bug: passRuleSummary text not rendered
  // Controlled dependencies: props are inline
  it('T-5.2b: renders pass rule summary', () => {
    const {queryByTestId} = renderToDom(
      h(ProblemModePanel, noopProps({
        passRuleSummary: '中国规则，贴7.5目',
      }))
    )

    const root = queryByTestId('problem-mode-panel')
    assert.ok(root, 'Root element not found')

    assert.ok(
      root.textContent.includes('中国规则，贴7.5目'),
      'Root should contain passRuleSummary text'
    )
  })

  // --- T-5.2c: renders OpponentControl component ---
  // Production subject: ProblemModePanel component
  // Production bug: OpponentControl sub-component not rendered
  // Controlled dependencies: props are inline
  it('T-5.2c: renders OpponentControl component', () => {
    const {queryByTestId} = renderToDom(
      h(ProblemModePanel, noopProps({
        blackPlayer: '黑方',
        whitePlayer: '白方',
      }))
    )

    const opponentControl = queryByTestId('opponent-control')
    assert.ok(
      opponentControl,
      'OpponentControl with data-testid="opponent-control" should be present'
    )
  })

  // --- T-5.2d: renders ReferenceLineSummary section ---
  // Production subject: ProblemModePanel component
  // Production bug: reference line summary section not rendered
  // Controlled dependencies: props are inline
  it('T-5.2d: renders ReferenceLineSummary section', () => {
    const {queryByTestId} = renderToDom(
      h(ProblemModePanel, noopProps({
        referenceLines: [
          {label: '正解', length: 7},
          {label: '变化1', length: 12},
        ],
      }))
    )

    const root = queryByTestId('problem-mode-panel')
    assert.ok(root, 'Root element not found')

    // ReferenceLineSummary section should be present; verify via text content
    assert.ok(
      root.textContent.includes('正解'),
      'Root should show reference line label "正解"'
    )
    assert.ok(
      root.textContent.includes('变化1'),
      'Root should show reference line label "变化1"'
    )
  })

  // --- T-5.2e: fires onRequestHint callback ---
  // SIDE_EFFECT: callback invocation
  // Production subject: ProblemModePanel component
  // Production bug: hint button click does not invoke onRequestHint
  // Controlled dependencies: props are inline
  it('T-5.2e: fires onRequestHint callback on button click', () => {
    let called = false
    const {queryByTestId} = renderToDom(
      h(ProblemModePanel, noopProps({
        onRequestHint: () => { called = true },
      }))
    )

    const btn = queryByTestId('request-hint-btn')
    assert.ok(btn, 'Button with data-testid="request-hint-btn" not found')

    btn.click()
    assert.strictEqual(called, true, 'onRequestHint should be called on click')
  })
})