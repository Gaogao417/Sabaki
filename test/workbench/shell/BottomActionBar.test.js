/**
 * BottomActionBar Contract Tests (Phase 4)
 *
 * Test contract: docs/design/2026-05-18/workbench-ui-phase-4/test-contract-v0.1.md
 * Contracts covered: T-4.3a through T-4.3g
 *
 * Test Legitimacy:
 *   All tests import the production BottomActionBar component.
 *   Production module missing -> tryImport returns null -> this.skip(), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 *
 * NOTE: BottomActionBar is a TO-BE-CREATED component.
 *
 * Fragility note: Button testid lists come directly from the contract.
 * Adding/removing buttons requires a contract update.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

let BottomActionBar = null

/**
 * Helper: build no-op callbacks for all possible BottomActionBar props.
 * This avoids "undefined is not a function" errors during rendering.
 */
function noopProps(overrides = {}) {
  return {
    mode: 'play',
    onUndo: () => {},
    onRedo: () => {},
    onPass: () => {},
    onResign: () => {},
    onEndAttempt: () => {},
    onMarkDoubtful: () => {},
    onRequestHint: () => {},
    onSubmitAnswer: () => {},
    onAbandonAnswer: () => {},
    onMarkCheckpoint: () => {},
    onHint: () => {},
    onVerifySkip: () => {},
    onEnterAnalysis: () => {},
    onClear: () => {},
    onEditPosition: () => {},
    onSnapshot: () => {},
    onSelect: () => {},
    onHandShape: () => {},
    onZoomIn: () => {},
    onZoomOut: () => {},
    onFullscreen: () => {},
    activeAnnotationTool: null,
    onAnnotationToolChange: () => {},
    ...overrides,
  }
}

/** Common buttons expected in all modes */
const commonButtons = [
  'action-select',
  'action-hand-shape',
  'action-zoom-in',
  'action-zoom-out',
  'action-fullscreen',
]

describe('BottomActionBar (T-4.3)', function () {
  before(async function () {
    BottomActionBar = await tryImport('src/components/workbench/shell/BottomActionBar.js')
    if (!BottomActionBar) this.skip()
  })

  // --- T-4.3a: play mode renders correct buttons ---
  // Production subject: BottomActionBar component
  // Production bug: wrong button set for play mode
  // Controlled dependencies: props are inline
  it('T-4.3a: play mode renders correct buttons', () => {
    const playButtons = [
      'action-undo',
      'action-pass',
      'action-resign',
      'action-end-attempt',
      'action-mark-doubtful',
      ...commonButtons,
    ]

    const {queryByTestId, queryAllByTestId} = renderToDom(
      h(BottomActionBar, noopProps({mode: 'play'}))
    )

    const root = queryByTestId('bottom-action-bar')
    assert.ok(root, 'Root with data-testid="bottom-action-bar" not found')

    for (const testId of playButtons) {
      const btn = queryByTestId(testId)
      assert.ok(btn, `Play mode should have button with data-testid="${testId}"`)
    }

    const allButtons = queryAllByTestId('action-btn')
    assert.strictEqual(
      allButtons.length,
      playButtons.length,
      `Expected ${playButtons.length} action-btn elements in play mode, got ${allButtons.length}`
    )
  })

  // --- T-4.3b: problem mode renders correct buttons ---
  // Production subject: BottomActionBar component
  // Production bug: wrong button set for problem mode
  // Controlled dependencies: props are inline
  it('T-4.3b: problem mode renders correct buttons', () => {
    const problemButtons = [
      'action-undo',
      'action-redo',
      'action-pass',
      'action-request-hint',
      'action-submit-answer',
      'action-abandon-answer',
      ...commonButtons,
    ]

    const {queryByTestId, queryAllByTestId} = renderToDom(
      h(BottomActionBar, noopProps({mode: 'problem'}))
    )

    for (const testId of problemButtons) {
      const btn = queryByTestId(testId)
      assert.ok(btn, `Problem mode should have button with data-testid="${testId}"`)
    }

    const allButtons = queryAllByTestId('action-btn')
    assert.strictEqual(
      allButtons.length,
      problemButtons.length,
      `Expected ${problemButtons.length} action-btn elements in problem mode, got ${allButtons.length}`
    )
  })

  // --- T-4.3c: recall mode renders correct buttons ---
  // Production subject: BottomActionBar component
  // Production bug: wrong button set for recall mode
  // Controlled dependencies: props are inline
  it('T-4.3c: recall mode renders correct buttons', () => {
    const recallButtons = [
      'action-mark-checkpoint',
      'action-hint',
      'action-verify-skip',
      'action-enter-analysis',
      ...commonButtons,
    ]

    const {queryByTestId, queryAllByTestId} = renderToDom(
      h(BottomActionBar, noopProps({mode: 'recall'}))
    )

    for (const testId of recallButtons) {
      const btn = queryByTestId(testId)
      assert.ok(btn, `Recall mode should have button with data-testid="${testId}"`)
    }

    const allButtons = queryAllByTestId('action-btn')
    assert.strictEqual(
      allButtons.length,
      recallButtons.length,
      `Expected ${recallButtons.length} action-btn elements in recall mode, got ${allButtons.length}`
    )
  })

  // --- T-4.3d: analysis mode renders correct buttons ---
  // Production subject: BottomActionBar component
  // Production bug: wrong button set for analysis mode
  // Controlled dependencies: props are inline
  it('T-4.3d: analysis mode renders correct buttons', () => {
    const analysisButtons = [
      'action-undo',
      'action-redo',
      'action-clear',
      'action-edit-position',
      'action-snapshot',
      ...commonButtons,
    ]

    const {queryByTestId} = renderToDom(
      h(BottomActionBar, noopProps({mode: 'analysis'}))
    )

    // Annotation tool group must exist
    const toolGroup = queryByTestId('annotation-tool')
    assert.ok(toolGroup, 'Analysis mode should have annotation tool group with data-testid="annotation-tool"')

    for (const testId of analysisButtons) {
      const btn = queryByTestId(testId)
      assert.ok(btn, `Analysis mode should have button with data-testid="${testId}"`)
    }
  })

  // --- T-4.3e: button clicks fire callbacks ---
  // SIDE_EFFECT: callback invocation
  // Production subject: BottomActionBar component
  // Production bug: button click does not invoke the corresponding callback
  // Controlled dependencies: props are inline
  it('T-4.3e: play button clicks fire callbacks', () => {
    const calls = {undo: false, pass: false}
    const {queryByTestId} = renderToDom(
      h(BottomActionBar, noopProps({
        mode: 'play',
        onUndo: () => { calls.undo = true },
        onPass: () => { calls.pass = true },
      }))
    )

    const undoBtn = queryByTestId('action-undo')
    const passBtn = queryByTestId('action-pass')
    assert.ok(undoBtn, 'Undo button not found')
    assert.ok(passBtn, 'Pass button not found')

    undoBtn.click()
    assert.strictEqual(calls.undo, true, 'onUndo should fire on undo click')

    passBtn.click()
    assert.strictEqual(calls.pass, true, 'onPass should fire on pass click')
  })

  // --- T-4.3f: analysis annotation tools render ---
  // Production subject: BottomActionBar component
  // Production bug: annotation tool buttons missing
  // Controlled dependencies: props are inline
  it('T-4.3f: analysis annotation tools render all tool buttons', () => {
    const annotationTools = [
      'black', 'white', 'cross', 'triangle', 'square',
      'circle', 'line', 'arrow', 'label-A', 'label-1',
    ]

    const {queryAllByTestId} = renderToDom(
      h(BottomActionBar, noopProps({mode: 'analysis'}))
    )

    const toolBtns = queryAllByTestId('annotation-tool-btn')
    assert.strictEqual(
      toolBtns.length,
      annotationTools.length,
      `Expected ${annotationTools.length} annotation tool buttons, got ${toolBtns.length}`
    )

    const renderedTools = toolBtns.map(b => b.getAttribute('data-tool'))
    for (const tool of annotationTools) {
      assert.ok(
        renderedTools.includes(tool),
        `Annotation tool "${tool}" not found. Got: [${renderedTools.join(', ')}]`
      )
    }
  })

  // --- T-4.3g: active annotation tool is highlighted ---
  // Production subject: BottomActionBar component
  // Production bug: active tool button not visually distinguished
  // Controlled dependencies: props are inline
  it('T-4.3g: active annotation tool is highlighted', () => {
    const {queryAllByTestId} = renderToDom(
      h(BottomActionBar, noopProps({
        mode: 'analysis',
        activeAnnotationTool: 'triangle',
      }))
    )

    const toolBtns = queryAllByTestId('annotation-tool-btn')
    const triangleBtn = toolBtns.find(b => b.getAttribute('data-tool') === 'triangle')
    assert.ok(triangleBtn, 'Triangle annotation tool button not found')

    const classList = triangleBtn.className || ''
    assert.ok(
      classList.includes('active'),
      `Active tool "triangle" should have active class, got "${classList}"`
    )
  })
})
