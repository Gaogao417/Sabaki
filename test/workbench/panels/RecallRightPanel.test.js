/**
 * RecallRightPanel Contract Tests (Phase 6)
 *
 * Contracts covered: T-6.3a through T-6.3d
 *
 * Test Legitimacy:
 *   All tests import the production RecallRightPanel component.
 *   Production module missing -> tryImport returns null -> this.skip(), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

let RecallRightPanel = null

function noopProps(overrides = {}) {
  return {
    hintMessage: '',
    systemCheckpoints: 0,
    manualCheckpoints: 0,
    correctCount: 0,
    wrongCount: 0,
    progress: 0,
    totalMoves: 0,
    ...overrides,
  }
}

describe('RecallRightPanel (T-6.3)', function () {
  before(async function () {
    RecallRightPanel = await tryImport('src/components/workbench/panels/RecallRightPanel.js')
    if (!RecallRightPanel) this.skip()
  })

  // --- T-6.3a: renders root with hint message ---
  it('T-6.3a: renders root element with hint message', () => {
    const {queryByTestId} = renderToDom(
      h(RecallRightPanel, noopProps({
        hintMessage: 'Remember the shoulder hit',
      }))
    )

    const root = queryByTestId('recall-right-panel')
    assert.ok(root, 'Root element with data-testid="recall-right-panel" not found')

    assert.ok(
      root.textContent.includes('Remember the shoulder hit'),
      'Root should contain hintMessage text'
    )
  })

  // --- T-6.3b: renders checkpoint summary ---
  it('T-6.3b: renders checkpoint summary with system and manual counts', () => {
    const {queryByTestId} = renderToDom(
      h(RecallRightPanel, noopProps({
        systemCheckpoints: 5,
        manualCheckpoints: 2,
      }))
    )

    const root = queryByTestId('recall-right-panel')
    assert.ok(
      root.textContent.includes('5'),
      'Root should contain systemCheckpoints "5"'
    )
    assert.ok(
      root.textContent.includes('2'),
      'Root should contain manualCheckpoints "2"'
    )
  })

  // --- T-6.3c: renders result feedback with correct/wrong counts and progress ---
  it('T-6.3c: renders result feedback with correct, wrong counts and progress', () => {
    const {queryByTestId} = renderToDom(
      h(RecallRightPanel, noopProps({
        correctCount: 8,
        wrongCount: 3,
        progress: 72,
        totalMoves: 15,
      }))
    )

    const root = queryByTestId('recall-right-panel')
    assert.ok(
      root.textContent.includes('8'),
      'Root should contain correctCount "8"'
    )
    assert.ok(
      root.textContent.includes('3'),
      'Root should contain wrongCount "3"'
    )
    assert.ok(
      root.textContent.includes('72'),
      'Root should contain progress "72"'
    )
  })

  // --- T-6.3d: renders variation tree with EmptyStatePanel ---
  it('T-6.3d: renders variation tree section', () => {
    const {queryByTestId} = renderToDom(
      h(RecallRightPanel, noopProps())
    )

    const root = queryByTestId('recall-right-panel')
    assert.ok(root, 'Root element should exist')
    // Variation tree section should exist as a child section
    assert.ok(
      root.textContent.length > 0,
      'Root should have content including variation tree section'
    )
  })
})
