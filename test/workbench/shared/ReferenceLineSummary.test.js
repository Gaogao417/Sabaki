/**
 * ReferenceLineSummary Contract Tests (Phase 2.5)
 *
 * Test contract: docs/design/2026-05-18/workbench-ui-phases-1-3/test-contract-v0.1.md
 * Contracts covered: T-2.5a, T-2.5b, T-2.5c
 *
 * Test Legitimacy:
 *   All tests import the production ReferenceLineSummary component.
 *   Production module missing -> tests FAIL (import error), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 *
 * NOTE: ReferenceLineSummary is a TO-BE-CREATED component.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

let ReferenceLineSummary = null

describe('ReferenceLineSummary (T-2.5)', function () {
  before(async function () {
    ReferenceLineSummary = await tryImport('src/components/workbench/shared/ReferenceLineSummary.js')
    if (!ReferenceLineSummary) this.skip()
  })

  // --- T-2.5a: Renders each line's label and length ---
  // Production subject: ReferenceLineSummary component
  // Production bug: line labels or lengths not rendered
  // Controlled dependencies: props are inline test data
  it('T-2.5a: renders each line label and length', () => {
    const lines = [
      {label: 'Line A', length: 15},
      {label: 'Line B', length: 8},
    ]

    const {container} = renderToDom(
      h(ReferenceLineSummary, {lines, totalCount: 23})
    )

    const text = container.textContent
    assert.ok(text.includes('Line A'), 'Line A label not rendered')
    assert.ok(text.includes('Line B'), 'Line B label not rendered')
    assert.ok(text.includes('15'), 'Line A length (15) not rendered')
    assert.ok(text.includes('8'), 'Line B length (8) not rendered')
  })

  // --- T-2.5b: Renders totalCount ---
  // Production subject: ReferenceLineSummary component
  // Production bug: totalCount not displayed
  it('T-2.5b: renders totalCount', () => {
    const {queryByTestId} = renderToDom(
      h(ReferenceLineSummary, {
        lines: [{label: 'A', length: 10}],
        totalCount: 10,
      })
    )

    const total = queryByTestId('reference-total-count')
    assert.ok(total, 'Total count element with data-testid="reference-total-count" not found')
    assert.ok(total.textContent.includes('10'), 'totalCount value not rendered')
  })

  // --- T-2.5c: lines=[] renders totalCount=0 only ---
  // Production subject: ReferenceLineSummary component
  // Production bug: empty lines array still renders line items or crashes
  it('T-2.5c: lines=[] renders totalCount=0 only', () => {
    const {container, queryByTestId} = renderToDom(
      h(ReferenceLineSummary, {lines: [], totalCount: 0})
    )

    const total = queryByTestId('reference-total-count')
    assert.ok(total, 'Total count element not found')
    assert.ok(total.textContent.includes('0'), 'totalCount=0 not rendered')

    // Should not render line items
    const lineItems = container.querySelectorAll('[data-testid="reference-line-item"]')
    assert.strictEqual(lineItems.length, 0, 'Should not render line items when lines=[]')
  })
})
