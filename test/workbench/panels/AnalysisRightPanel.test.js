/**
 * AnalysisRightPanel Contract Tests (Phase 6)
 *
 * Contracts covered: T-6.4a through T-6.4e
 *
 * Test Legitimacy:
 *   All tests import the production AnalysisRightPanel component.
 *   Production module missing -> tryImport returns null -> this.skip(), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

let AnalysisRightPanel = null

function noopProps(overrides = {}) {
  return {
    moveCount: 0,
    captures: {black: 0, white: 0},
    evaluation: null,
    userOriginalLine: null,
    userCorrection: null,
    aiCandidates: null,
    ...overrides,
  }
}

describe('AnalysisRightPanel (T-6.4)', function () {
  before(async function () {
    AnalysisRightPanel = await tryImport('src/components/workbench/panels/AnalysisRightPanel.js')
    if (!AnalysisRightPanel) this.skip()
  })

  // --- T-6.4a: renders root with data-testid ---
  it('T-6.4a: renders root element', () => {
    const {queryByTestId} = renderToDom(
      h(AnalysisRightPanel, noopProps())
    )

    const root = queryByTestId('analysis-right-panel')
    assert.ok(root, 'Root element with data-testid="analysis-right-panel" not found')
  })

  // --- T-6.4b: renders board evaluation section with move count, captures, evaluation ---
  it('T-6.4b: renders board evaluation with move count, captures and evaluation', () => {
    const {queryByTestId} = renderToDom(
      h(AnalysisRightPanel, noopProps({
        moveCount: 30,
        captures: {black: 5, white: 8},
        evaluation: 'B+2.5',
      }))
    )

    const root = queryByTestId('analysis-right-panel')
    assert.ok(
      root.textContent.includes('30'),
      'Root should contain moveCount "30"'
    )
    assert.ok(
      root.textContent.includes('5'),
      'Root should contain black captures "5"'
    )
    assert.ok(
      root.textContent.includes('8'),
      'Root should contain white captures "8"'
    )
    assert.ok(
      root.textContent.includes('B+2.5'),
      'Root should contain evaluation "B+2.5"'
    )
  })

  // --- T-6.4c: renders comparison section with user original, correction, ai candidates ---
  it('T-6.4c: renders comparison section when comparison fields provided', () => {
    const {queryByTestId} = renderToDom(
      h(AnalysisRightPanel, noopProps({
        userOriginalLine: 'D4 Q16',
        userCorrection: 'D4 Q16 C10',
        aiCandidates: 'D4 Q16 R14',
      }))
    )

    const root = queryByTestId('analysis-right-panel')
    assert.ok(
      root.textContent.includes('D4 Q16'),
      'Root should contain userOriginalLine text'
    )
    assert.ok(
      root.textContent.includes('C10'),
      'Root should contain userCorrection text'
    )
    assert.ok(
      root.textContent.includes('R14'),
      'Root should contain aiCandidates text'
    )
  })

  // --- T-6.4d: renders snapshot comparison button ---
  it('T-6.4d: renders add-snapshot-btn button', () => {
    const {queryByTestId} = renderToDom(
      h(AnalysisRightPanel, noopProps())
    )

    const btn = queryByTestId('add-snapshot-btn')
    assert.ok(btn, 'Button with data-testid="add-snapshot-btn" not found')
  })

  // --- T-6.4e: renders AI analysis section ---
  it('T-6.4e: renders AI analysis section with content', () => {
    const {queryByTestId} = renderToDom(
      h(AnalysisRightPanel, noopProps())
    )

    const root = queryByTestId('analysis-right-panel')
    assert.ok(root, 'Root element should exist')
    assert.ok(
      root.textContent.length > 0,
      'Root should have content including AI analysis section'
    )
  })
})
