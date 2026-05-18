/**
 * TrainingTabBar Contract Tests (Phase 4)
 *
 * Test contract: docs/design/2026-05-18/workbench-ui-phase-4/test-contract-v0.1.md
 * Contracts covered: T-4.2a through T-4.2e
 *
 * Test Legitimacy:
 *   All tests import the production TrainingTabBar component.
 *   Production module missing -> tryImport returns null -> this.skip(), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 *
 * NOTE: TrainingTabBar is a TO-BE-CREATED component.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

let TrainingTabBar = null

describe('TrainingTabBar (T-4.2)', function () {
  before(async function () {
    TrainingTabBar = await tryImport('src/components/workbench/shell/TrainingTabBar.js')
    if (!TrainingTabBar) this.skip()
  })

  // --- T-4.2a: renders 4 mode tabs ---
  // Production subject: TrainingTabBar component
  // Production bug: wrong number of tabs rendered
  // Controlled dependencies: props are inline
  it('T-4.2a: renders 4 mode tabs', () => {
    const {queryAllByTestId, queryByTestId} = renderToDom(
      h(TrainingTabBar, {
        activeTab: 'play',
        onTabChange: () => {},
      })
    )

    const root = queryByTestId('training-tab-bar')
    assert.ok(root, 'Root element with data-testid="training-tab-bar" not found')

    const tabs = queryAllByTestId('training-tab')
    assert.strictEqual(tabs.length, 4, `Expected 4 mode tabs, got ${tabs.length}`)
  })

  // --- T-4.2b: highlights active tab ---
  // Production subject: TrainingTabBar component
  // Production bug: active tab not visually distinguished, or wrong tab highlighted
  // Controlled dependencies: props are inline
  it('T-4.2b: highlights active tab and not others', () => {
    const {queryAllByTestId} = renderToDom(
      h(TrainingTabBar, {
        activeTab: 'problem',
        onTabChange: () => {},
      })
    )

    const tabs = queryAllByTestId('training-tab')
    assert.strictEqual(tabs.length, 4, 'Expected 4 tabs')

    for (const tab of tabs) {
      const tabMode = tab.getAttribute('data-tab')
      const classList = tab.className || ''
      if (tabMode === 'problem') {
        assert.ok(
          classList.includes('active'),
          `Tab "${tabMode}" should have active class, got "${classList}"`
        )
      } else {
        assert.ok(
          !classList.includes('active'),
          `Tab "${tabMode}" should NOT have active class, got "${classList}"`
        )
      }
    }
  })

  // --- T-4.2c: fires onTabChange on tab click ---
  // SIDE_EFFECT: callback invocation
  // Production subject: TrainingTabBar component
  // Production bug: clicking a tab does not fire onTabChange with the correct mode
  // Controlled dependencies: props are inline
  it('T-4.2c: fires onTabChange with correct mode on tab click', () => {
    let changedTab = null
    const {queryAllByTestId} = renderToDom(
      h(TrainingTabBar, {
        activeTab: 'play',
        onTabChange: (tab) => { changedTab = tab },
      })
    )

    const tabs = queryAllByTestId('training-tab')
    const problemTab = tabs.find(t => t.getAttribute('data-tab') === 'problem')
    assert.ok(problemTab, 'Problem tab not found')

    problemTab.click()
    assert.strictEqual(changedTab, 'problem', 'onTabChange should be called with "problem"')
  })

  // --- T-4.2d: renders badge counts when provided ---
  // Production subject: TrainingTabBar component
  // Production bug: badges not rendered or show wrong count
  // Controlled dependencies: props are inline
  it('T-4.2d: renders badge counts when provided', () => {
    const {queryAllByTestId} = renderToDom(
      h(TrainingTabBar, {
        activeTab: 'play',
        onTabChange: () => {},
        badgeCounts: {play: 3, recall: 1},
      })
    )

    const badges = queryAllByTestId('tab-badge')
    assert.strictEqual(badges.length, 2, `Expected 2 badge elements, got ${badges.length}`)

    const badgeTexts = badges.map(b => b.textContent.trim())
    assert.ok(badgeTexts.includes('3'), 'Should show badge "3" for play')
    assert.ok(badgeTexts.includes('1'), 'Should show badge "1" for recall')
  })

  // --- T-4.2e: no badge when count is 0 or undefined ---
  // Production subject: TrainingTabBar component
  // Production bug: badge rendered for zero or missing count
  // Controlled dependencies: props are inline
  it('T-4.2e: no badge when count is 0 or undefined', () => {
    const {queryAllByTestId} = renderToDom(
      h(TrainingTabBar, {
        activeTab: 'play',
        onTabChange: () => {},
        badgeCounts: {play: 0},
      })
    )

    const badges = queryAllByTestId('tab-badge')
    assert.strictEqual(badges.length, 0, `Expected 0 badges when all counts are 0 or missing, got ${badges.length}`)
  })
})
