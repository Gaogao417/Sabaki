/**
 * ModeBar Contract Tests (Phase U2)
 *
 * Test contract: docs/design/2026-05-19/phase-u2-structural/test-contract-v0.1.md
 * Contracts covered: T-U2-2a through T-U2-2f
 *
 * Test Legitimacy:
 *   All tests import the production ModeBar component.
 *   Production module missing -> tests FAIL (import error), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper; props are inline.
 *
 * NOTE: ModeBar exists but needs to be rewritten to use segmented control
 *   classes and Chinese labels. These tests verify the POST-rewrite state.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'

import ModeBar from '../../../src/components/workbench/shell/ModeBar.js'

describe('ModeBar segmented control (T-U2-2)', () => {
  function renderBar(overrides = {}) {
    return renderToDom(
      h(ModeBar, {
        activeMode: 'play',
        onModeChange: () => {},
        onSnapshot: () => {},
        ...overrides,
      })
    )
  }

  // --- T-U2-2a: uses .wb-segmented-control container ---
  // Production subject: ModeBar component
  // Production import path: src/components/workbench/shell/ModeBar.js
  // Production bug: ModeBar still uses .wb-mode-bar__tabs instead of
  //   .wb-segmented-control container
  // Controlled dependencies: props are inline
  it('T-U2-2a: uses .wb-segmented-control container', () => {
    const {container} = renderBar()

    const segmentedControl = container.querySelector('.wb-segmented-control')
    assert.ok(segmentedControl, 'Expected element with class .wb-segmented-control')
  })

  // --- T-U2-2b: 4 .wb-segmented-control__item children ---
  // Production subject: ModeBar component
  // Production import path: src/components/workbench/shell/ModeBar.js
  // Production bug: ModeBar renders wrong number of items, or uses
  //   old .wb-mode-bar__tab class instead of .wb-segmented-control__item
  // Controlled dependencies: props are inline
  it('T-U2-2b: has 4 .wb-segmented-control__item children', () => {
    const {container} = renderBar()

    const items = container.querySelectorAll('.wb-segmented-control__item')
    assert.strictEqual(items.length, 4, `Expected 4 segmented control items, got ${items.length}`)
  })

  // --- T-U2-2c: active item has --active modifier class ---
  // Production subject: ModeBar component
  // Production import path: src/components/workbench/shell/ModeBar.js
  // Production bug: active mode item lacks .wb-segmented-control__item--active
  // Controlled dependencies: props are inline, activeMode varies
  it('T-U2-2c: active item has .wb-segmented-control__item--active', () => {
    const {container} = renderBar({activeMode: 'problem'})

    const activeItems = container.querySelectorAll('.wb-segmented-control__item--active')
    assert.strictEqual(activeItems.length, 1, `Expected exactly 1 active item, got ${activeItems.length}`)
  })

  // --- T-U2-2d: Chinese labels ---
  // Production subject: ModeBar component
  // Production import path: src/components/workbench/shell/ModeBar.js
  // Production bug: ModeBar still uses English labels (Play/Problem/Recall/Analysis)
  //   instead of Chinese (对局/做题/回忆/复盘)
  // Controlled dependencies: props are inline
  it('T-U2-2d: uses Chinese labels 对局/做题/回忆/复盘', () => {
    const {container} = renderBar()

    const text = container.textContent
    assert.ok(text.includes('对局'), 'Missing Chinese label "对局" for play mode')
    assert.ok(text.includes('做题'), 'Missing Chinese label "做题" for problem mode')
    assert.ok(text.includes('回忆'), 'Missing Chinese label "回忆" for recall mode')
    assert.ok(text.includes('复盘'), 'Missing Chinese label "复盘" for analysis mode')
  })

  // --- T-U2-2e: no .wb-mode-bar__tab-indicator ---
  // Production subject: ModeBar component
  // Production import path: src/components/workbench/shell/ModeBar.js
  // Production bug: ModeBar still renders the old .wb-mode-bar__tab-indicator
  //   element from pre-rewrite
  // Controlled dependencies: props are inline
  it('T-U2-2e: does NOT render .wb-mode-bar__tab-indicator', () => {
    const {container} = renderBar()

    const indicator = container.querySelector('.wb-mode-bar__tab-indicator')
    assert.strictEqual(indicator, null, 'Legacy .wb-mode-bar__tab-indicator should NOT exist')
  })

  // --- T-U2-2f: click triggers onModeChange ---
  // Production subject: ModeBar component
  // Production import path: src/components/workbench/shell/ModeBar.js
  // Production bug: clicking a segmented control item does not call onModeChange
  //   with the correct mode key
  // Controlled dependencies: callback spy is an inline function
  it('T-U2-2f: clicking an item triggers onModeChange', () => {
    const calls = []
    const {container, fireEvent} = renderBar({
      activeMode: 'play',
      onModeChange: (mode) => { calls.push(mode) },
    })

    // Find the segmented control items and click the second one
    const items = container.querySelectorAll('.wb-segmented-control__item')
    assert.ok(items.length >= 2, 'Expected at least 2 items to click')

    // Click an inactive item (not the currently active one)
    // The second item should correspond to a different mode
    fireEvent.click(items[1])
    assert.ok(calls.length >= 1, 'onModeChange should be called at least once')
    assert.ok(
      typeof calls[0] === 'string' && calls[0].length > 0,
      `onModeChange should receive a mode string, got "${calls[0]}"`
    )
  })
})
