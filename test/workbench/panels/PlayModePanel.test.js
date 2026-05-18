/**
 * PlayModePanel Contract Tests (Phase 5)
 *
 * Test contract: docs/design/2026-05-18/workbench-ui-phase-5/test-contract-v0.1.md
 * Contracts covered: T-5.1a through T-5.1d
 *
 * Test Legitimacy:
 *   All tests import the production PlayModePanel component.
 *   Production module missing -> tryImport returns null -> this.skip(), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 *
 * NOTE: PlayModePanel is a TO-BE-CREATED component.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

let PlayModePanel = null

/**
 * Helper: build no-op callbacks for all PlayModePanel props.
 */
function noopProps(overrides = {}) {
  return {
    taskTitle: '',
    taskDescription: '',
    moveCount: 0,
    captures: {black: 0, white: 0},
    onMarkDoubtful: () => {},
    onEnterAnalysis: () => {},
    ...overrides,
  }
}

describe('PlayModePanel (T-5.1)', function () {
  before(async function () {
    PlayModePanel = await tryImport('src/components/workbench/panels/PlayModePanel.js')
    if (!PlayModePanel) this.skip()
  })

  // --- T-5.1a: renders task info card ---
  // Production subject: PlayModePanel component
  // Production bug: taskTitle or taskDescription text not rendered
  // Controlled dependencies: props are inline
  it('T-5.1a: renders task title and description', () => {
    const {queryByTestId} = renderToDom(
      h(PlayModePanel, noopProps({
        taskTitle: '我的对局',
        taskDescription: '一场精彩的比赛',
        moveCount: 10,
        captures: {black: 1, white: 2},
      }))
    )

    const root = queryByTestId('play-mode-panel')
    assert.ok(root, 'Root element with data-testid="play-mode-panel" not found')

    assert.ok(
      root.textContent.includes('我的对局'),
      'Root should contain taskTitle text "我的对局"'
    )
    assert.ok(
      root.textContent.includes('一场精彩的比赛'),
      'Root should contain taskDescription text "一场精彩的比赛"'
    )
  })

  // --- T-5.1b: renders move count and captures ---
  // Production subject: PlayModePanel component
  // Production bug: moveCount or capture numbers not displayed
  // Controlled dependencies: props are inline
  it('T-5.1b: renders move count and captures', () => {
    const {queryByTestId} = renderToDom(
      h(PlayModePanel, noopProps({
        moveCount: 42,
        captures: {black: 3, white: 5},
      }))
    )

    const root = queryByTestId('play-mode-panel')
    assert.ok(root, 'Root element with data-testid="play-mode-panel" not found')

    assert.ok(
      root.textContent.includes('42'),
      'Root should contain moveCount "42"'
    )
    assert.ok(
      root.textContent.includes('3'),
      'Root should contain black captures "3"'
    )
    assert.ok(
      root.textContent.includes('5'),
      'Root should contain white captures "5"'
    )
  })

  // --- T-5.1c: fires onMarkDoubtful callback ---
  // SIDE_EFFECT: callback invocation
  // Production subject: PlayModePanel component
  // Production bug: mark doubtful button click does not invoke onMarkDoubtful
  // Controlled dependencies: props are inline
  it('T-5.1c: fires onMarkDoubtful callback on button click', () => {
    let called = false
    const {queryByTestId} = renderToDom(
      h(PlayModePanel, noopProps({
        onMarkDoubtful: () => { called = true },
      }))
    )

    const btn = queryByTestId('mark-doubtful-btn')
    assert.ok(btn, 'Button with data-testid="mark-doubtful-btn" not found')

    btn.click()
    assert.strictEqual(called, true, 'onMarkDoubtful should be called on click')
  })

  // --- T-5.1d: fires onEnterAnalysis callback ---
  // SIDE_EFFECT: callback invocation
  // Production subject: PlayModePanel component
  // Production bug: enter analysis button click does not invoke onEnterAnalysis
  // Controlled dependencies: props are inline
  it('T-5.1d: fires onEnterAnalysis callback on button click', () => {
    let called = false
    const {queryByTestId} = renderToDom(
      h(PlayModePanel, noopProps({
        onEnterAnalysis: () => { called = true },
      }))
    )

    const btn = queryByTestId('enter-analysis-btn')
    assert.ok(btn, 'Button with data-testid="enter-analysis-btn" not found')

    btn.click()
    assert.strictEqual(called, true, 'onEnterAnalysis should be called on click')
  })
})

describe('PlayModePanel state overlay (T-7.2a-d)', function () {
  before(async function () {
    PlayModePanel = await tryImport('src/components/workbench/panels/PlayModePanel.js')
    if (!PlayModePanel) this.skip()
  })

  // --- T-7.2a: state="loading" renders loading indicator ---
  // Production subject: PlayModePanel component state prop
  // Production bug: loading indicator not rendered when state="loading"
  // Controlled dependencies: props are inline
  it('T-7.2a: state="loading" renders loading indicator', () => {
    const {queryByTestId} = renderToDom(
      h(PlayModePanel, noopProps({state: 'loading'}))
    )

    const indicator = queryByTestId('loading-indicator')
    assert.ok(indicator, 'data-testid="loading-indicator" should be present when state="loading"')
  })

  // --- T-7.2b: state="disabled" renders disabled overlay ---
  // Production subject: PlayModePanel component state prop
  // Production bug: disabled overlay not rendered when state="disabled"
  // Controlled dependencies: props are inline
  it('T-7.2b: state="disabled" renders disabled overlay', () => {
    const {queryByTestId} = renderToDom(
      h(PlayModePanel, noopProps({state: 'disabled'}))
    )

    const overlay = queryByTestId('disabled-overlay')
    assert.ok(overlay, 'data-testid="disabled-overlay" should be present when state="disabled"')
  })

  // --- T-7.2c: state="error" renders error overlay ---
  // Production subject: PlayModePanel component state prop
  // Production bug: error overlay not rendered when state="error"
  // Controlled dependencies: props are inline
  it('T-7.2c: state="error" renders error overlay', () => {
    const {queryByTestId} = renderToDom(
      h(PlayModePanel, noopProps({state: 'error'}))
    )

    const overlay = queryByTestId('error-overlay')
    assert.ok(overlay, 'data-testid="error-overlay" should be present when state="error"')
  })

  // --- T-7.2d: state="success" renders success indicator ---
  // Production subject: PlayModePanel component state prop
  // Production bug: success indicator not rendered when state="success"
  // Controlled dependencies: props are inline
  it('T-7.2d: state="success" renders success indicator', () => {
    const {queryByTestId} = renderToDom(
      h(PlayModePanel, noopProps({state: 'success'}))
    )

    const indicator = queryByTestId('success-indicator')
    assert.ok(indicator, 'data-testid="success-indicator" should be present when state="success"')
  })
})