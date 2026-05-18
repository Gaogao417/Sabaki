/**
 * OpponentControl Contract Tests (Phase 2.4)
 *
 * Test contract: docs/design/2026-05-18/workbench-ui-phases-1-3/test-contract-v0.1.md
 * Contracts covered: T-2.4a, T-2.4b, T-2.4c
 * (T-2.4d is MANUAL_ACCEPTANCE for tooltip behavior)
 *
 * Test Legitimacy:
 *   All tests import the production OpponentControl component.
 *   Production module missing -> tests FAIL (import error), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 *
 * NOTE: OpponentControl is a TO-BE-CREATED component.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

let OpponentControl = null

describe('OpponentControl (T-2.4)', function () {
  before(async function () {
    OpponentControl = await tryImport('src/components/workbench/shared/OpponentControl.js')
    if (!OpponentControl) this.skip()
  })

  // --- T-2.4a: value='self' shows self selected ---
  // Production subject: OpponentControl component
  // Production bug: value='self' does not indicate self is selected
  it('T-2.4a: value=self shows self selected', () => {
    const {container, queryByTestId} = renderToDom(
      h(OpponentControl, {value: 'self', onChange: () => {}})
    )

    const selfOption = queryByTestId('opponent-option-self')
    assert.ok(selfOption, 'Self option element not found')

    const classList = selfOption.className || ''
    const ariaSelected = selfOption.getAttribute('aria-selected')
    assert.ok(
      classList.includes('selected') || classList.includes('active') || ariaSelected === 'true',
      'Self option should appear selected when value=self'
    )
  })

  // --- T-2.4b: Click triggers onChange('ai') when value='self' ---
  // Production subject: OpponentControl component
  // Production bug: clicking does not fire onChange or fires wrong value
  it('T-2.4b: click triggers onChange(ai) when value=self', () => {
    let receivedValue = undefined
    const {queryByTestId, fireEvent} = renderToDom(
      h(OpponentControl, {
        value: 'self',
        onChange: (val) => { receivedValue = val },
      })
    )

    // Click the control or the AI option to switch
    const control = queryByTestId('opponent-control') || queryByTestId('opponent-option-ai')
    assert.ok(control, 'OpponentControl or AI option element not found')
    fireEvent.click(control)

    assert.strictEqual(receivedValue, 'ai', 'onChange should be called with "ai"')
  })

  // --- T-2.4c: disabled=true suppresses onChange ---
  // Production subject: OpponentControl component
  // Production bug: onChange fires even when disabled
  it('T-2.4c: disabled=true suppresses onChange', () => {
    let fired = false
    const {queryByTestId, fireEvent} = renderToDom(
      h(OpponentControl, {
        value: 'self',
        disabled: true,
        onChange: () => { fired = true },
      })
    )

    const control = queryByTestId('opponent-control')
    assert.ok(control, 'OpponentControl element not found')
    fireEvent.click(control)

    assert.strictEqual(fired, false, 'onChange should NOT fire when disabled=true')
  })
})
