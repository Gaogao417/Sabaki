/**
 * ModeActions Contract Tests (Phase 3 + Phase U2)
 *
 * Test contract:
 *   Phase 3: docs/design/2026-05-18/workbench-ui-phases-1-3/test-contract-v0.1.md
 *   Phase U2: docs/design/2026-05-19/phase-u2-structural/test-contract-v0.1.md
 * Contracts covered: T-3a through T-3h (Phase 3), T-U2-4a through T-U2-4d (Phase U2)
 *
 * Test Legitimacy:
 *   All tests import the production ModeActions component and workbench index.
 *   Production module missing -> tests FAIL (import error), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 *
 * Fragility note (from contract): Use data-testid or role, not button text as selector.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'

// Static import for ModeBar — this component already exists
import ModeBar from '../../../src/components/workbench/shell/ModeBar.js'
import ModeActions from '../../../src/components/workbench/shell/ModeActions.js'

describe('ModeActions (T-3)', () => {
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

  // --- T-3c: mode='recall' renders quiet top actions ---
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

// ============================================================================
// Phase U2: Chinese Labels
// ============================================================================

describe('ModeActions Chinese labels (T-U2-4)', () => {
  // --- T-U2-4a: Play Chinese labels ---
  // Production subject: ModeActions component
  // Production import path: src/components/workbench/shell/ModeActions.js
  // Production bug: Play buttons still use English labels (New Game/Settings/End/Resign)
  //   instead of Chinese (新对局/对局设置/结束/认输)
  // Controlled dependencies: props are inline
  it('T-U2-4a: Play mode uses Chinese labels', () => {
    const {container} = renderToDom(
      h(ModeActions, {
        mode: 'play',
        onNewGame: () => {},
        onSettings: () => {},
        onEnd: () => {},
        onResign: () => {},
      })
    )

    const text = container.textContent
    assert.ok(text.includes('新对局'), 'Expected Play label "新对局"')
    assert.ok(text.includes('对局设置'), 'Expected Play label "对局设置"')
    assert.ok(text.includes('结束'), 'Expected Play label "结束"')
    assert.ok(text.includes('认输'), 'Expected Play label "认输"')
  })

  // --- T-U2-4b: Problem Chinese labels ---
  // Production subject: ModeActions component
  // Production import path: src/components/workbench/shell/ModeActions.js
  // Production bug: Problem buttons still use English labels
  //   instead of Chinese (提交答案/放弃作答/做题设置/进入复盘)
  // Controlled dependencies: props are inline
  it('T-U2-4b: Problem mode uses Chinese labels', () => {
    const {container} = renderToDom(
      h(ModeActions, {
        mode: 'problem',
        onSubmit: () => {},
        onAbandon: () => {},
        onSettings: () => {},
        onAnalysis: () => {},
      })
    )

    const text = container.textContent
    assert.ok(text.includes('提交答案'), 'Expected Problem label "提交答案"')
    assert.ok(text.includes('放弃作答'), 'Expected Problem label "放弃作答"')
    assert.ok(text.includes('做题设置'), 'Expected Problem label "做题设置"')
    assert.ok(text.includes('进入复盘'), 'Expected Problem label "进入复盘"')
  })

  // --- T-U2-4c: Recall Chinese labels ---
  // Production subject: ModeActions component
  // Production import path: src/components/workbench/shell/ModeActions.js
  // Production bug: Recall buttons still use English labels
  //   instead of Chinese (进入复盘/结束回忆/Snapshot)
  // Controlled dependencies: props are inline
  it('T-U2-4c: Recall mode uses Chinese labels', () => {
    const {container} = renderToDom(
      h(ModeActions, {
        mode: 'recall',
        onAnalysis: () => {},
        onEnd: () => {},
        onSnapshot: () => {},
      })
    )

    const text = container.textContent
    assert.ok(text.includes('进入复盘'), 'Expected Recall label "进入复盘"')
    assert.ok(text.includes('结束回忆'), 'Expected Recall label "结束回忆"')
    assert.ok(text.includes('Snapshot'), 'Expected Recall label "Snapshot"')
  })

  // --- T-U2-4d: Analysis labels ---
  // Production subject: ModeActions component
  // Production import path: src/components/workbench/shell/ModeActions.js
  // Production bug: Analysis buttons use wrong labels
  //   Contract says: Snapshot/返回
  // Controlled dependencies: props are inline
  it('T-U2-4d: Analysis mode has Snapshot and 返回 labels', () => {
    const {container} = renderToDom(
      h(ModeActions, {
        mode: 'analysis',
        onSnapshot: () => {},
        onSettings: () => {},
        onReturn: () => {},
      })
    )

    const text = container.textContent
    assert.ok(text.includes('Snapshot'), 'Expected Analysis label "Snapshot"')
    assert.ok(text.includes('返回'), 'Expected Analysis label "返回"')
  })
})
