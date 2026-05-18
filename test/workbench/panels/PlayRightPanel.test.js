/**
 * PlayRightPanel Contract Tests (Phase 6)
 *
 * Contracts covered: T-6.1a through T-6.1d
 *
 * Test Legitimacy:
 *   All tests import the production PlayRightPanel component.
 *   Production module missing -> tryImport returns null -> this.skip(), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

let PlayRightPanel = null

function noopProps(overrides = {}) {
  return {
    moveCount: 0,
    captures: {black: 0, white: 0},
    pendingEval: 0,
    badMoveCount: 0,
    ...overrides,
  }
}

describe('PlayRightPanel (T-6.1)', function () {
  before(async function () {
    PlayRightPanel = await tryImport('src/components/workbench/panels/PlayRightPanel.js')
    if (!PlayRightPanel) this.skip()
  })

  // --- T-6.1a: renders root with data-testid and board info ---
  it('T-6.1a: renders root element with move count and captures', () => {
    const {queryByTestId} = renderToDom(
      h(PlayRightPanel, noopProps({
        moveCount: 25,
        captures: {black: 4, white: 7},
      }))
    )

    const root = queryByTestId('play-right-panel')
    assert.ok(root, 'Root element with data-testid="play-right-panel" not found')

    assert.ok(
      root.textContent.includes('25'),
      'Root should contain moveCount "25"'
    )
    assert.ok(
      root.textContent.includes('4'),
      'Root should contain black captures "4"'
    )
    assert.ok(
      root.textContent.includes('7'),
      'Root should contain white captures "7"'
    )
  })

  // --- T-6.1b: renders AI analysis with EmptyStatePanel ---
  it('T-6.1b: renders AI analysis empty state with connection message', () => {
    const {queryByTestId} = renderToDom(
      h(PlayRightPanel, noopProps())
    )

    const root = queryByTestId('play-right-panel')
    assert.ok(
      root.textContent.includes('连接引擎后可查看分析结果'),
      'Should show AI analysis empty state message'
    )
  })

  // --- T-6.1c: renders variation tree with EmptyStatePanel ---
  it('T-6.1c: renders variation tree empty state with auto-record message', () => {
    const {queryByTestId} = renderToDom(
      h(PlayRightPanel, noopProps())
    )

    const root = queryByTestId('play-right-panel')
    assert.ok(
      root.textContent.includes('对局过程中将自动记录变化'),
      'Should show variation tree empty state message'
    )
  })

  // --- T-6.1d: renders drawer toggle buttons for expandable sections ---
  it('T-6.1d: renders drawer toggle buttons for expandable sections', () => {
    const {queryAllByTestId} = renderToDom(
      h(PlayRightPanel, noopProps())
    )

    const toggles = queryAllByTestId('drawer-toggle')
    assert.ok(
      toggles.length >= 2,
      'Should have at least 2 drawer-toggle buttons for expandable sections'
    )
  })
})
