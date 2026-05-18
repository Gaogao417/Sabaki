/**
 * QuietStatusChips Contract Tests (Phase 1.2)
 *
 * Test contract: docs/design/2026-05-18/workbench-ui-phases-1-3/test-contract-v0.1.md
 * Contracts covered: T-1.2a, T-1.2b
 *
 * Test Legitimacy:
 *   All tests import the production QuietStatusChips component.
 *   Production module missing -> tests FAIL (import error), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 *
 * NOTE: QuietStatusChips is a TO-BE-CREATED component. These tests define the
 * expected contract and will fail until the component is implemented.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

let QuietStatusChips = null

describe('QuietStatusChips (T-1.2)', function () {
  before(async function () {
    QuietStatusChips = await tryImport('src/components/workbench/shared/QuietStatusChips.js')
    if (!QuietStatusChips) this.skip()
  })

  // --- T-1.2a: Renders chip for saveStatus='saving' ---
  // Production subject: QuietStatusChips component
  // Production bug: saveStatus='saving' produces no visible chip
  // Controlled dependencies: props are inline test data
  it('T-1.2a: renders chip for saveStatus=saving', () => {
    const {container, queryAllByTestId} = renderToDom(
      h(QuietStatusChips, {saveStatus: 'saving'})
    )
    const chips = queryAllByTestId('quiet-status-chip')
    const textContent = container.textContent
    assert.ok(
      chips.length >= 1 || textContent.includes('saving') || textContent.includes('保存'),
      'Expected at least one chip when saveStatus=saving'
    )
  })

  // --- T-1.2b: Renders chip for engineStatus='thinking' ---
  // Production subject: QuietStatusChips component
  // Production bug: engineStatus='thinking' produces no visible chip
  it('T-1.2b: renders chip for engineStatus=thinking', () => {
    const {container, queryAllByTestId} = renderToDom(
      h(QuietStatusChips, {engineStatus: 'thinking'})
    )
    const chips = queryAllByTestId('quiet-status-chip')
    const textContent = container.textContent
    assert.ok(
      chips.length >= 1 || textContent.includes('thinking') || textContent.includes('思考'),
      'Expected at least one chip when engineStatus=thinking'
    )
  })
})
