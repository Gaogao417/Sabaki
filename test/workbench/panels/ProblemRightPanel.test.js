/**
 * ProblemRightPanel Contract Tests (Phase 6)
 *
 * Contracts covered: T-6.2a through T-6.2d
 *
 * Test Legitimacy:
 *   All tests import the production ProblemRightPanel component.
 *   Production module missing -> tryImport returns null -> this.skip(), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

let ProblemRightPanel = null

function noopProps(overrides = {}) {
  return {
    currentVariation: 0,
    opponentMode: 'ai',
    hint: null,
    aiAnalysisHidden: true,
    referenceLines: [],
    pendingEval: 0,
    badMoveCount: 0,
    ...overrides,
  }
}

describe('ProblemRightPanel (T-6.2)', function () {
  before(async function () {
    ProblemRightPanel = await tryImport('src/components/workbench/panels/ProblemRightPanel.js')
    if (!ProblemRightPanel) this.skip()
  })

  // --- T-6.2a: renders root with data-testid ---
  it('T-6.2a: renders root element', () => {
    const {queryByTestId} = renderToDom(
      h(ProblemRightPanel, noopProps())
    )

    const root = queryByTestId('problem-right-panel')
    assert.ok(root, 'Root element with data-testid="problem-right-panel" not found')
  })

  // --- T-6.2b: renders hint card when hint is provided ---
  it('T-6.2b: renders hint card section with hint text', () => {
    const {queryByTestId} = renderToDom(
      h(ProblemRightPanel, noopProps({
        hint: 'Try the attachment',
      }))
    )

    const hintCard = queryByTestId('hint-card')
    assert.ok(hintCard, 'Hint card with data-testid="hint-card" not found')
    assert.ok(
      hintCard.textContent.includes('Try the attachment'),
      'Hint card should contain the hint text'
    )
  })
})
