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
 * NOTE: ModeBar now displays current-mode context and actions only. Manual
 *   mode segmented tabs were removed so users enter modes through task flows.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'

import ModeBar from '../../../src/components/workbench/shell/ModeBar.js'

describe('ModeBar current-mode topbar (T-U2-2)', () => {
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

  it('T-U2-2a: renders the mode bar container with active mode class', () => {
    const {container} = renderBar()

    const modeBar = container.querySelector('[data-testid="mode-bar"]')
    assert.ok(modeBar, 'Expected data-testid="mode-bar"')
    assert.ok(
      modeBar.className.includes('wb-mode-bar--play'),
      'ModeBar should include the active mode class',
    )
  })

  it('T-U2-2b: does not render manual segmented mode items', () => {
    const {container} = renderBar()

    const items = container.querySelectorAll('.wb-segmented-control__item')
    assert.strictEqual(items.length, 0, `Expected no segmented control items, got ${items.length}`)
  })

  it('T-U2-2c: problem mode is represented in topbar metadata', () => {
    const {container} = renderBar({activeMode: 'problem'})

    assert.ok(
      container.querySelector('[data-testid="mode-bar"]').className.includes('wb-mode-bar--problem'),
      'ModeBar should include problem active mode class',
    )
    assert.ok(container.textContent.includes('Problem'), 'ModeBar should display current problem mode metadata')
  })

  it('T-U2-2d: renders play actions without manual mode switch labels', () => {
    const {container} = renderBar()

    const text = container.textContent
    assert.ok(text.includes('新对局'), 'Missing New Game play action')
    assert.ok(text.includes('复盘'), 'Missing Analysis play action')
    assert.ok(!text.includes('做题模式'), 'ModeBar must not invite manual problem-mode switching')
    assert.ok(!text.includes('回忆模式'), 'ModeBar must not invite manual recall-mode switching')
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

  it('T-U2-2f: clicking mode actions does not call onModeChange', () => {
    const calls = []
    const {container, fireEvent} = renderBar({
      activeMode: 'play',
      onModeChange: (mode) => { calls.push(mode) },
    })

    const action = container.querySelector('[data-testid="mode-action-analysis"]')
    assert.ok(action, 'Expected analysis action button')

    fireEvent.click(action)
    assert.deepStrictEqual(calls, [], 'Mode actions should route through explicit callbacks, not onModeChange')
  })

  it('opens preferences from the topbar icon', () => {
    let opened = false
    const {queryByTestId, fireEvent} = renderBar({
      onOpenPreferences: () => { opened = true },
    })

    const preferences = queryByTestId('mode-action-preferences')
    assert.ok(preferences, 'Expected preferences entry in ModeBar')

    fireEvent.click(preferences)
    assert.strictEqual(opened, true, 'Preferences entry should call onOpenPreferences')
  })
})
