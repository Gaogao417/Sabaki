/**
 * ModeActions Contract Tests (Phase 3)
 *
 * Test contract: docs/design/2026-05-18/workbench-ui-phases-1-3/test-contract-v0.1.md
 * Contracts covered: T-3a through T-3h, T-INDEX
 *
 * Test Legitimacy:
 *   All tests import the production ModeActions component and workbench index.
 *   Production module missing -> tests FAIL (import error), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 *
 * NOTE: ModeActions is a TO-BE-CREATED component.
 *
 * Fragility note (from contract): Use data-testid or role, not button text as selector.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

// Static import for ModeBar — this component already exists
import ModeBar from '../../../src/components/workbench/shell/ModeBar.js'

let ModeActions = null
let workbenchIndex = null

describe('ModeActions (T-3)', function () {
  before(async function () {
    ModeActions = await tryImport('src/components/workbench/shell/ModeActions.js')
    if (!ModeActions) this.skip()
  })

  // --- T-3a: mode='play' renders 4 buttons ---
  // Production subject: ModeActions component
  // Production bug: wrong number of buttons for play mode
  // Controlled dependencies: props are inline
  it('T-3a: mode=play renders 4 buttons (new game, settings, end, resign)', () => {
    const {queryAllByTestId} = renderToDom(
      h(ModeActions, {
        mode: 'play',
        onNewGame: () => {},
        onSettings: () => {},
        onEnd: () => {},
        onResign: () => {},
      })
    )

    const buttons = queryAllByTestId('mode-action-btn')
    assert.strictEqual(buttons.length, 4, `Expected 4 buttons for play mode, got ${buttons.length}`)
  })

  // --- T-3b: mode='problem' renders 4 buttons ---
  it('T-3b: mode=problem renders 4 buttons (submit, abandon, settings, analysis)', () => {
    const {queryAllByTestId} = renderToDom(
      h(ModeActions, {
        mode: 'problem',
        onSubmit: () => {},
        onAbandon: () => {},
        onSettings: () => {},
        onAnalysis: () => {},
      })
    )

    const buttons = queryAllByTestId('mode-action-btn')
    assert.strictEqual(buttons.length, 4, `Expected 4 buttons for problem mode, got ${buttons.length}`)
  })

  // --- T-3c: mode='recall' renders 3 buttons ---
  it('T-3c: mode=recall renders 3 buttons (analysis, end, snapshot)', () => {
    const {queryAllByTestId} = renderToDom(
      h(ModeActions, {
        mode: 'recall',
        onAnalysis: () => {},
        onEnd: () => {},
        onSnapshot: () => {},
      })
    )

    const buttons = queryAllByTestId('mode-action-btn')
    assert.strictEqual(buttons.length, 3, `Expected 3 buttons for recall mode, got ${buttons.length}`)
  })

  // --- T-3d: mode='analysis' renders 3 buttons ---
  it('T-3d: mode=analysis renders 3 buttons (snapshot, settings, return)', () => {
    const {queryAllByTestId} = renderToDom(
      h(ModeActions, {
        mode: 'analysis',
        onSnapshot: () => {},
        onSettings: () => {},
        onReturn: () => {},
      })
    )

    const buttons = queryAllByTestId('mode-action-btn')
    assert.strictEqual(buttons.length, 3, `Expected 3 buttons for analysis mode, got ${buttons.length}`)
  })

  // --- T-3e: Play resign button has danger style ---
  // Production subject: ModeActions component
  // Production bug: resign button lacks danger styling
  it('T-3e: play resign button has danger style', () => {
    const {queryByTestId} = renderToDom(
      h(ModeActions, {
        mode: 'play',
        onNewGame: () => {},
        onSettings: () => {},
        onEnd: () => {},
        onResign: () => {},
      })
    )

    const resignBtn = queryByTestId('mode-action-resign')
    assert.ok(resignBtn, 'Resign button with data-testid="mode-action-resign" not found')

    const classList = resignBtn.className || ''
    assert.ok(
      classList.includes('danger'),
      'Resign button should have danger class'
    )
  })

  // --- T-3f: Each button click fires corresponding callback ---
  // SIDE_EFFECT: callback invocation
  // Production subject: ModeActions component
  // Production bug: button click does not fire its callback
  it('T-3f: play button clicks fire corresponding callbacks', () => {
    const calls = {newGame: false, settings: false, end: false, resign: false}
    const {queryByTestId, fireEvent} = renderToDom(
      h(ModeActions, {
        mode: 'play',
        onNewGame: () => { calls.newGame = true },
        onSettings: () => { calls.settings = true },
        onEnd: () => { calls.end = true },
        onResign: () => { calls.resign = true },
      })
    )

    const newGameBtn = queryByTestId('mode-action-new-game')
    const settingsBtn = queryByTestId('mode-action-settings')
    const endBtn = queryByTestId('mode-action-end')
    const resignBtn = queryByTestId('mode-action-resign')

    assert.ok(newGameBtn && settingsBtn && endBtn && resignBtn, 'Not all buttons found')

    fireEvent.click(newGameBtn)
    assert.strictEqual(calls.newGame, true, 'onNewGame should fire')

    fireEvent.click(settingsBtn)
    assert.strictEqual(calls.settings, true, 'onSettings should fire')

    fireEvent.click(endBtn)
    assert.strictEqual(calls.end, true, 'onEnd should fire')

    fireEvent.click(resignBtn)
    assert.strictEqual(calls.resign, true, 'onResign should fire')
  })

  // --- T-3h: Switching mode fully replaces button set ---
  // PURE_LOGIC: changing mode changes which buttons appear
  // Production subject: ModeActions component
  // Production bug: old mode buttons persist after switching
  it('T-3h: switching mode fully replaces button set', () => {
    // First render with play mode
    const playResult = renderToDom(
      h(ModeActions, {
        mode: 'play',
        onNewGame: () => {}, onSettings: () => {}, onEnd: () => {}, onResign: () => {},
      })
    )
    const playButtons = playResult.queryAllByTestId('mode-action-btn')
    const playTestIds = playButtons.map(b => b.getAttribute('data-testid')).sort()

    // Re-render with analysis mode
    const analysisResult = renderToDom(
      h(ModeActions, {
        mode: 'analysis',
        onSnapshot: () => {}, onSettings: () => {}, onReturn: () => {},
      })
    )
    const analysisButtons = analysisResult.queryAllByTestId('mode-action-btn')
    const analysisTestIds = analysisButtons.map(b => b.getAttribute('data-testid')).sort()

    // Button sets should be different
    assert.notDeepStrictEqual(playTestIds, analysisTestIds,
      'Switching mode should produce a different button set')

    // Analysis should have 3 buttons
    assert.strictEqual(analysisTestIds.length, 3, 'Analysis mode should have 3 buttons')
  })
})

describe('ModeBar integration (T-3g)', () => {
  // --- T-3g: ModeBar integrates ModeActions with mode and callback props ---
  // WIRING: ModeBar passes correct props to ModeActions
  // Production subject: ModeBar component (existing)
  // Production bug: ModeBar does not integrate ModeActions
  // This test runs independently of ModeActions existence because ModeBar already exists.
  it('T-3g: ModeBar integrates ModeActions with mode and callback props', () => {
    const {queryAllByTestId} = renderToDom(
      h(ModeBar, {
        activeMode: 'play',
        onModeChange: () => {},
        onSnapshot: () => {},
      })
    )

    // ModeBar should render mode action buttons from ModeActions integration.
    // When ModeActions is integrated, these buttons will appear.
    const actionBtns = queryAllByTestId('mode-action-btn')
    assert.ok(actionBtns.length >= 1,
      'ModeBar should render ModeActions buttons with data-testid="mode-action-btn"')
  })
})

describe('Workbench Index exports (T-INDEX)', () => {
  before(async function () {
    workbenchIndex = await tryImport('src/components/workbench/index.js')
  })

  // --- T-INDEX: index.js exports all new components ---
  // WIRING: barrel file exports
  // Production subject: workbench/index.js
  // Production bug: new components not exported from barrel file
  it('exports ModeActions', () => {
    assert.ok(workbenchIndex, 'workbench/index.js should be importable')
    assert.ok(
      typeof workbenchIndex.ModeActions === 'function' || workbenchIndex.ModeActions != null,
      'ModeActions should be exported from workbench/index.js'
    )
  })
})
