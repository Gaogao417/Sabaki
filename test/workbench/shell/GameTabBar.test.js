/**
 * GameTabBar Contract Tests (T-1.1)
 *
 * Test contract: docs/design/2026-05-18/workbench-shell-integration/test-contract-v0.1.md
 * Contracts covered: T-1.1a through T-1.1f
 *
 * Test Legitimacy:
 *   All tests import the production GameTabBar component.
 *   Production module missing -> tryImport returns null -> this.skip(), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper; all inputs are inline props.
 *
 * NOTE: GameTabBar is a TO-BE-CREATED component.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

let GameTabBar = null

describe('GameTabBar (T-1.1)', function () {
  before(async function () {
    GameTabBar = await tryImport('src/components/workbench/shell/GameTabBar.js')
    if (!GameTabBar) this.skip()
  })

  const twoGames = [
    {index: 0, title: 'Game 1', active: true},
    {index: 1, title: 'Game 2', active: false},
  ]

  // --- T-1.1a: renders tab items from games prop ---
  // Production subject: GameTabBar component
  // Production import path: src/components/workbench/shell/GameTabBar.js
  // Production bug: wrong number of tab items rendered, or wrong data-testid
  // Controlled dependencies: props are inline
  it('T-1.1a: renders tab items from games prop', () => {
    const {queryByTestId, queryAllByTestId} = renderToDom(
      h(GameTabBar, {
        games: twoGames,
        activeIndex: 0,
        onSelect: () => {},
        onClose: () => {},
        onAdd: () => {},
      })
    )

    const root = queryByTestId('game-tab-bar')
    assert.ok(root, 'Root element with data-testid="game-tab-bar" not found')

    const tabs = queryAllByTestId('game-tab-item')
    assert.strictEqual(tabs.length, 2, `Expected 2 tab items, got ${tabs.length}`)
  })

  // --- T-1.1b: highlights active tab ---
  // Production subject: GameTabBar component
  // Production import path: src/components/workbench/shell/GameTabBar.js
  // Production bug: active tab not distinguished by class, or wrong tab highlighted
  // Controlled dependencies: props are inline
  it('T-1.1b: highlights active tab and not others', () => {
    const {queryAllByTestId} = renderToDom(
      h(GameTabBar, {
        games: twoGames,
        activeIndex: 0,
        onSelect: () => {},
        onClose: () => {},
        onAdd: () => {},
      })
    )

    const tabs = queryAllByTestId('game-tab-item')
    assert.strictEqual(tabs.length, 2, 'Expected 2 tabs')

    for (const tab of tabs) {
      const tabIndex = tab.getAttribute('data-index')
      const classList = tab.className || ''
      const isActive = String(tabIndex) === '0'

      if (isActive) {
        assert.ok(
          classList.includes('active'),
          `Tab at index "${tabIndex}" should have 'active' class, got "${classList}"`
        )
      } else {
        assert.ok(
          !classList.includes('active'),
          `Tab at index "${tabIndex}" should NOT have 'active' class, got "${classList}"`
        )
      }
    }
  })

  // --- T-1.1c: fires onSelect on tab click ---
  // SIDE_EFFECT: callback invocation
  // Production subject: GameTabBar component
  // Production import path: src/components/workbench/shell/GameTabBar.js
  // Production bug: clicking a tab does not fire onSelect, or fires with wrong index
  // Controlled dependencies: onSelect is a spy closure
  it('T-1.1c: fires onSelect with correct index on tab click', () => {
    let selectedIndex = null
    const {queryAllByTestId} = renderToDom(
      h(GameTabBar, {
        games: twoGames,
        activeIndex: 0,
        onSelect: (index) => { selectedIndex = index },
        onClose: () => {},
        onAdd: () => {},
      })
    )

    const tabs = queryAllByTestId('game-tab-item')
    const secondTab = tabs.find(t => t.getAttribute('data-index') === '1')
    assert.ok(secondTab, 'Tab with data-index="1" not found')

    secondTab.click()
    assert.strictEqual(selectedIndex, 1, 'onSelect should be called with index 1')
  })

  // --- T-1.1d: fires onClose on close button click ---
  // SIDE_EFFECT: callback invocation, event propagation control
  // Production subject: GameTabBar component
  // Production import path: src/components/workbench/shell/GameTabBar.js
  // Production bug: close click fires onClose with wrong index, or also fires onSelect
  // Controlled dependencies: onSelect and onClose are spy closures
  it('T-1.1d: fires onClose on close button click and does not propagate to onSelect', () => {
    let closedIndex = null
    let selectFired = false

    const {queryAllByTestId} = renderToDom(
      h(GameTabBar, {
        games: twoGames,
        activeIndex: 0,
        onSelect: () => { selectFired = true },
        onClose: (index) => { closedIndex = index },
        onAdd: () => {},
      })
    )

    const closeButtons = queryAllByTestId('game-tab-close')
    assert.ok(closeButtons.length > 0, 'No close buttons found')

    // Find close button for the second tab (index 1)
    // The close button should be inside the tab item
    const secondTabClose = closeButtons.find(btn => {
      const parentTab = btn.closest('[data-testid="game-tab-item"]')
      return parentTab && parentTab.getAttribute('data-index') === '1'
    })
    assert.ok(secondTabClose, 'Close button for tab index 1 not found')

    secondTabClose.click()
    assert.strictEqual(closedIndex, 1, 'onClose should be called with index 1')
    assert.ok(!selectFired, 'onSelect should NOT be called when clicking close button')
  })

  // --- T-1.1e: fires onAdd on add button click ---
  // SIDE_EFFECT: callback invocation
  // Production subject: GameTabBar component
  // Production import path: src/components/workbench/shell/GameTabBar.js
  // Production bug: clicking add button does not fire onAdd
  // Controlled dependencies: onAdd is a spy counter
  it('T-1.1e: fires onAdd on add button click', () => {
    let addCallCount = 0

    const {queryByTestId} = renderToDom(
      h(GameTabBar, {
        games: twoGames,
        activeIndex: 0,
        onSelect: () => {},
        onClose: () => {},
        onAdd: () => { addCallCount++ },
      })
    )

    const addButton = queryByTestId('game-tab-add')
    assert.ok(addButton, 'Add button with data-testid="game-tab-add" not found')

    addButton.click()
    assert.strictEqual(addCallCount, 1, 'onAdd should be called exactly once')
  })

  // --- T-1.1f: renders with empty games array ---
  // Production subject: GameTabBar component
  // Production import path: src/components/workbench/shell/GameTabBar.js
  // Production bug: component crashes with empty games array, or hides add button
  // Controlled dependencies: props are inline
  it('T-1.1f: renders with empty games array and shows add button', () => {
    const {queryByTestId, queryAllByTestId} = renderToDom(
      h(GameTabBar, {
        games: [],
        activeIndex: -1,
        onSelect: () => {},
        onClose: () => {},
        onAdd: () => {},
      })
    )

    const root = queryByTestId('game-tab-bar')
    assert.ok(root, 'Root element should render even with empty games')

    const tabs = queryAllByTestId('game-tab-item')
    assert.strictEqual(tabs.length, 0, `Expected 0 tab items with empty games, got ${tabs.length}`)

    const addButton = queryByTestId('game-tab-add')
    assert.ok(addButton, 'Add button should be present even with empty games')
  })
})
