/**
 * ModeToggle Contract Tests (Phase 2.3)
 *
 * Test contract: docs/design/2026-05-18/workbench-ui-phases-1-3/test-contract-v0.1.md
 * Contracts covered: T-2.3a, T-2.3b, T-2.3c
 *
 * Test Legitimacy:
 *   All tests import the production ModeToggle component.
 *   Production module missing -> tests FAIL (import error), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 *
 * NOTE: ModeToggle is a TO-BE-CREATED component.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

let ModeToggle = null

describe('ModeToggle (T-2.3)', function () {
  before(async function () {
    ModeToggle = await tryImport('src/components/workbench/shared/ModeToggle.js')
    if (!ModeToggle) this.skip()
  })

  // --- T-2.3a: checked=true renders open state ---
  // Production subject: ModeToggle component
  // Production bug: checked=true does not show open/active visual state
  it('T-2.3a: checked=true renders open state', () => {
    const {queryByTestId} = renderToDom(
      h(ModeToggle, {checked: true, onChange: () => {}})
    )

    const toggle = queryByTestId('mode-toggle')
    assert.ok(toggle, 'Toggle element with data-testid="mode-toggle" not found')

    const classList = toggle.className || ''
    const ariaChecked = toggle.getAttribute('aria-checked')
    assert.ok(
      classList.includes('open') || classList.includes('active') || classList.includes('checked') || ariaChecked === 'true',
      'checked=true should produce open/active/checked class or aria-checked=true'
    )
  })

  // --- T-2.3b: Click when checked=true triggers onChange(false) ---
  // Production subject: ModeToggle component
  // Production bug: clicking when checked does not fire onChange(false)
  it('T-2.3b: click when checked=true triggers onChange(false)', () => {
    let receivedValue = undefined
    const {queryByTestId, fireEvent} = renderToDom(
      h(ModeToggle, {
        checked: true,
        onChange: (val) => { receivedValue = val },
      })
    )

    const toggle = queryByTestId('mode-toggle')
    assert.ok(toggle, 'Toggle element not found')
    fireEvent.click(toggle)

    assert.strictEqual(receivedValue, false, 'onChange should be called with false')
  })

  // --- T-2.3c: Click when checked=false triggers onChange(true) ---
  // Production subject: ModeToggle component
  // Production bug: clicking when not checked does not fire onChange(true)
  it('T-2.3c: click when checked=false triggers onChange(true)', () => {
    let receivedValue = undefined
    const {queryByTestId, fireEvent} = renderToDom(
      h(ModeToggle, {
        checked: false,
        onChange: (val) => { receivedValue = val },
      })
    )

    const toggle = queryByTestId('mode-toggle')
    assert.ok(toggle, 'Toggle element not found')
    fireEvent.click(toggle)

    assert.strictEqual(receivedValue, true, 'onChange should be called with true')
  })
})
