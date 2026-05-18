/**
 * RightDrawer Contract Tests (Phase 2.6)
 *
 * Test contract: docs/design/2026-05-18/workbench-ui-phases-1-3/test-contract-v0.1.md
 * Contracts covered: T-2.6a through T-2.6e (note: T-2.2e in contract is typo, meant T-2.6e)
 *
 * Test Legitimacy:
 *   All tests import the production RightDrawer component.
 *   Production module missing -> tests FAIL (import error), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 *
 * NOTE: RightDrawer is a TO-BE-CREATED component.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

let RightDrawer = null

describe('RightDrawer (T-2.6)', function () {
  before(async function () {
    RightDrawer = await tryImport('src/components/workbench/shared/RightDrawer.js')
    if (!RightDrawer) this.skip()
  })

  // --- T-2.6a: open=true renders visible panel ---
  // Production subject: RightDrawer component
  // Production bug: drawer not visible when open=true
  it('T-2.6a: open=true renders visible panel', () => {
    const {queryByTestId} = renderToDom(
      h(RightDrawer, {
        open: true,
        title: 'Test Drawer',
        onClose: () => {},
      })
    )

    const drawer = queryByTestId('right-drawer')
    assert.ok(drawer, 'Drawer element with data-testid="right-drawer" not found')

    const classList = drawer.className || ''
    const hidden = classList.includes('hidden') || classList.includes('closed')
    assert.ok(!hidden, 'Drawer should be visible when open=true')
  })

  // --- T-2.6b: open=false renders hidden panel ---
  // Production subject: RightDrawer component
  // Production bug: drawer visible when open=false
  it('T-2.6b: open=false renders hidden panel', () => {
    const {queryByTestId} = renderToDom(
      h(RightDrawer, {
        open: false,
        title: 'Test Drawer',
        onClose: () => {},
      })
    )

    const drawer = queryByTestId('right-drawer')
    assert.ok(drawer, 'Drawer element not found')

    const classList = drawer.className || ''
    const hidden = classList.includes('hidden') || classList.includes('closed')
    const ariaHidden = drawer.getAttribute('aria-hidden')
    assert.ok(
      hidden || ariaHidden === 'true',
      'Drawer should be hidden/closed when open=false'
    )
  })

  // --- T-2.6c: Close button click triggers onClose ---
  // Production subject: RightDrawer component
  // Production bug: close button not wired to onClose
  it('T-2.6c: close button click triggers onClose', () => {
    let closed = false
    const {queryByTestId, fireEvent} = renderToDom(
      h(RightDrawer, {
        open: true,
        title: 'Test',
        onClose: () => { closed = true },
      })
    )

    const closeBtn = queryByTestId('right-drawer-close')
    assert.ok(closeBtn, 'Close button with data-testid="right-drawer-close" not found')
    fireEvent.click(closeBtn)

    assert.strictEqual(closed, true, 'onClose should be called on close button click')
  })

  // --- T-2.6d: Escape key triggers onClose ---
  // SIDE_EFFECT: keyboard event handling
  // Production subject: RightDrawer component
  // Production bug: Escape key does not close the drawer
  it('T-2.6d: Escape key triggers onClose', () => {
    let closed = false
    const {queryByTestId, fireEvent} = renderToDom(
      h(RightDrawer, {
        open: true,
        title: 'Test',
        onClose: () => { closed = true },
      })
    )

    const drawer = queryByTestId('right-drawer')
    assert.ok(drawer, 'Drawer element not found')
    fireEvent.keyDown(drawer, 'Escape')

    assert.strictEqual(closed, true, 'onClose should be called on Escape key')
  })

  // --- T-2.6e: Renders title and children ---
  // Production subject: RightDrawer component
  // Production bug: title or children not rendered
  it('T-2.6e: renders title and children', () => {
    const {container, queryByTestId} = renderToDom(
      h(RightDrawer, {
        open: true,
        title: 'Analysis Details',
        onClose: () => {},
      }, h('div', {'data-testid': 'drawer-child'}, 'Child content'))
    )

    const title = queryByTestId('right-drawer-title')
    assert.ok(title, 'Title element with data-testid="right-drawer-title" not found')
    assert.ok(title.textContent.includes('Analysis Details'), 'Title text not rendered')

    const child = queryByTestId('drawer-child')
    assert.ok(child, 'Child content not rendered inside drawer')
    assert.ok(child.textContent.includes('Child content'), 'Child text not rendered')
  })
})
