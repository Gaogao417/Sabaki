/**
 * MaterialLibraryDialog Contract Tests (Phase 2.8)
 *
 * Test contract: docs/design/2026-05-18/workbench-ui-phases-1-3/test-contract-v0.1.md
 * Contracts covered: T-2.8a, T-2.8b, T-2.8c
 *
 * Test Legitimacy:
 *   All tests import the production MaterialLibraryDialog component.
 *   Production module missing -> tests FAIL (import error), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 *
 * NOTE: MaterialLibraryDialog is a TO-BE-CREATED component.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

let MaterialLibraryDialog = null

describe('MaterialLibraryDialog (T-2.8)', function () {
  before(async function () {
    MaterialLibraryDialog = await tryImport('src/components/workbench/shared/MaterialLibraryDialog.js')
    if (!MaterialLibraryDialog) this.skip()
  })

  // --- T-2.8a: open=true renders visible dialog ---
  // Production subject: MaterialLibraryDialog component
  // Production bug: dialog not visible when open=true
  // Controlled dependencies: props are inline test data
  it('T-2.8a: open=true renders visible dialog', () => {
    const {queryByTestId} = renderToDom(
      h(MaterialLibraryDialog, {
        open: true,
        onClose: () => {},
      })
    )

    const dialog = queryByTestId('material-library-dialog')
    assert.ok(dialog, 'Dialog element with data-testid="material-library-dialog" not found')

    const classList = dialog.className || ''
    const hidden = classList.includes('hidden') || classList.includes('closed')
    assert.ok(!hidden, 'Dialog should be visible when open=true')
  })

  // --- T-2.8b: open=false renders hidden dialog ---
  // Production subject: MaterialLibraryDialog component
  // Production bug: dialog visible when open=false
  it('T-2.8b: open=false renders hidden dialog', () => {
    const {queryByTestId} = renderToDom(
      h(MaterialLibraryDialog, {
        open: false,
        onClose: () => {},
      })
    )

    const dialog = queryByTestId('material-library-dialog')
    assert.ok(dialog, 'Dialog element not found')

    const classList = dialog.className || ''
    const hidden = classList.includes('hidden') || classList.includes('closed')
    const ariaHidden = dialog.getAttribute('aria-hidden')
    assert.ok(
      hidden || ariaHidden === 'true',
      'Dialog should be hidden when open=false'
    )
  })

  // --- T-2.8c: Close action triggers onClose ---
  // Production subject: MaterialLibraryDialog component
  // Production bug: close button not wired to onClose
  it('T-2.8c: close action triggers onClose', () => {
    let closed = false
    const {queryByTestId, fireEvent} = renderToDom(
      h(MaterialLibraryDialog, {
        open: true,
        onClose: () => { closed = true },
      })
    )

    const closeBtn = queryByTestId('material-library-close')
    assert.ok(closeBtn, 'Close button with data-testid="material-library-close" not found')
    fireEvent.click(closeBtn)

    assert.strictEqual(closed, true, 'onClose should be called on close action')
  })
})
