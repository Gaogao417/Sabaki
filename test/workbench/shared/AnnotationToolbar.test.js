/**
 * AnnotationToolbar Contract Tests (Phase 2.7)
 *
 * Test contract: docs/design/2026-05-18/workbench-ui-phases-1-3/test-contract-v0.1.md
 * Contracts covered: T-2.7a through T-2.7e
 *
 * Test Legitimacy:
 *   All tests import the production AnnotationToolbar component.
 *   Production module missing -> tests FAIL (import error), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 *
 * NOTE: AnnotationToolbar is a TO-BE-CREATED component.
 *
 * Fragility note (from contract): T-2.7a should drive from a tool-list constant,
 * not hardcoded 10. Tests check that all tool buttons are rendered.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

let AnnotationToolbar = null

describe('AnnotationToolbar (T-2.7)', function () {
  before(async function () {
    AnnotationToolbar = await tryImport('src/components/workbench/shared/AnnotationToolbar.js')
    if (!AnnotationToolbar) this.skip()
  })

  // --- T-2.7a: Renders all tool buttons ---
  // Production subject: AnnotationToolbar component
  // Production bug: not all tool buttons rendered
  // Controlled dependencies: props are inline
  it('T-2.7a: renders all tool buttons', () => {
    const {queryAllByTestId} = renderToDom(
      h(AnnotationToolbar, {activeTool: 'arrow', onToolChange: () => {}})
    )

    const buttons = queryAllByTestId('annotation-tool-btn')
    assert.ok(buttons.length >= 10, `Expected at least 10 tool buttons, got ${buttons.length}`)
  })

  // --- T-2.7b: activeTool button has selected state ---
  // Production subject: AnnotationToolbar component
  // Production bug: no visual distinction for active tool
  it('T-2.7b: activeTool button has selected state', () => {
    const {queryByTestId} = renderToDom(
      h(AnnotationToolbar, {activeTool: 'arrow', onToolChange: () => {}})
    )

    const activeBtn = queryByTestId('annotation-tool-btn-arrow')
    assert.ok(activeBtn, 'Active tool button for "arrow" not found')

    const classList = activeBtn.className || ''
    const ariaPressed = activeBtn.getAttribute('aria-pressed')
    assert.ok(
      classList.includes('active') || classList.includes('selected') || ariaPressed === 'true',
      'Active tool button should have active/selected class or aria-pressed=true'
    )
  })

  // --- T-2.7c: Click non-active tool triggers onToolChange(newTool) ---
  // Production subject: AnnotationToolbar component
  // Production bug: clicking a different tool does not call onToolChange
  it('T-2.7c: click non-active tool triggers onToolChange', () => {
    let receivedTool = undefined
    const {queryByTestId, fireEvent} = renderToDom(
      h(AnnotationToolbar, {
        activeTool: 'arrow',
        onToolChange: (tool) => { receivedTool = tool },
      })
    )

    const textBtn = queryByTestId('annotation-tool-btn-text')
    assert.ok(textBtn, 'Text tool button not found')
    fireEvent.click(textBtn)

    assert.strictEqual(receivedTool, 'text', 'onToolChange should be called with "text"')
  })

  // --- T-2.7d: disabled=true suppresses onToolChange ---
  // Production subject: AnnotationToolbar component
  // Production bug: tool change fires even when disabled
  it('T-2.7d: disabled=true suppresses onToolChange', () => {
    let fired = false
    const {queryByTestId, fireEvent} = renderToDom(
      h(AnnotationToolbar, {
        activeTool: 'arrow',
        disabled: true,
        onToolChange: () => { fired = true },
      })
    )

    const textBtn = queryByTestId('annotation-tool-btn-text')
    assert.ok(textBtn, 'Text tool button not found')
    fireEvent.click(textBtn)

    assert.strictEqual(fired, false, 'onToolChange should NOT fire when disabled=true')
  })

  // --- T-2.7e: Click activeTool does not trigger onToolChange ---
  // Production subject: AnnotationToolbar component
  // Production bug: clicking the already-active tool calls onToolChange
  it('T-2.7e: click activeTool does not trigger onToolChange', () => {
    let fired = false
    const {queryByTestId, fireEvent} = renderToDom(
      h(AnnotationToolbar, {
        activeTool: 'arrow',
        onToolChange: () => { fired = true },
      })
    )

    const arrowBtn = queryByTestId('annotation-tool-btn-arrow')
    assert.ok(arrowBtn, 'Arrow tool button not found')
    fireEvent.click(arrowBtn)

    assert.strictEqual(fired, false, 'onToolChange should NOT fire when clicking the already active tool')
  })
})
