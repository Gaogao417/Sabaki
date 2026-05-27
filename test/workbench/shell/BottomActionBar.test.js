/**
 * BottomActionBar Contract Tests (Phase 4 + Phase U2)
 *
 * Test contract:
 *   Phase 4: docs/design/2026-05-18/workbench-ui-phase-4/test-contract-v0.1.md
 *   Phase U2: docs/design/2026-05-19/phase-u2-structural/test-contract-v0.1.md
 * Contracts covered: T-4.3a through T-4.3g (Phase 4), T-U2-3a through T-U2-3c (Phase U2)
 *
 * Test Legitimacy:
 *   All tests import the production BottomActionBar component.
 *   Production module missing -> tryImport returns null -> this.skip(), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 *
 * NOTE: BottomActionBar is an existing component that needs Phase U2 additions
 *   (status text area). Phase 4 tests are preserved; U2 tests are appended.
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
  'action-zoom-in',
  'action-zoom-out',
  'action-fullscreen',
]

function queryActionButtons(container) {
  return Array.from(
    container.querySelectorAll('button[data-testid^="action-"]'),
  )
}

function queryVisibleEditTool(container, label) {
  return container.querySelector(
    `[data-testid="analysis-edit-toolbar"] #edit a[aria-label="${label}"]`,
  )
}

describe('BottomActionBar (T-4.3)', function () {
  before(async function () {
    BottomActionBar = await tryImport(
      'src/components/workbench/shell/BottomActionBar.js',
    )
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
      'action-mark-doubtful',
      ...commonButtons,
    ]

    const {container, queryByTestId} = renderToDom(
      h(BottomActionBar, noopProps({mode: 'play'})),
    )

    const root = queryByTestId('bottom-action-bar')
    assert.ok(root, 'Root with data-testid="bottom-action-bar" not found')

    for (const testId of playButtons) {
      const btn = queryByTestId(testId)
      assert.ok(
        btn,
        `Play mode should have button with data-testid="${testId}"`,
      )
    }

    const allButtons = queryActionButtons(container)
    assert.strictEqual(
      allButtons.length,
      playButtons.length,
      `Expected ${playButtons.length} action buttons in play mode, got ${allButtons.length}`,
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
      ...commonButtons,
    ]

    const {container, queryByTestId} = renderToDom(
      h(BottomActionBar, noopProps({mode: 'problem'})),
    )

    for (const testId of problemButtons) {
      const btn = queryByTestId(testId)
      assert.ok(
        btn,
        `Problem mode should have button with data-testid="${testId}"`,
      )
    }

    const allButtons = queryActionButtons(container)
    assert.strictEqual(
      allButtons.length,
      problemButtons.length,
      `Expected ${problemButtons.length} action buttons in problem mode, got ${allButtons.length}`,
    )
  })

  // --- T-4.3c: recall mode renders correct buttons ---
  // Production subject: BottomActionBar component
  // Production bug: wrong button set for recall mode
  // Controlled dependencies: props are inline
  it('T-4.3c: recall mode renders correct buttons', () => {
    const recallButtons = [
      'action-hint',
      'action-verify-skip',
      ...commonButtons,
    ]

    const {container, queryByTestId} = renderToDom(
      h(BottomActionBar, noopProps({mode: 'recall'})),
    )

    for (const testId of recallButtons) {
      const btn = queryByTestId(testId)
      assert.ok(
        btn,
        `Recall mode should have button with data-testid="${testId}"`,
      )
    }

    const allButtons = queryActionButtons(container)
    assert.strictEqual(
      allButtons.length,
      recallButtons.length,
      `Expected ${recallButtons.length} action buttons in recall mode, got ${allButtons.length}`,
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
      ...commonButtons,
    ]

    const {container, queryByTestId} = renderToDom(
      h(
        BottomActionBar,
        noopProps({
          mode: 'analysis',
          analysisAreaVertices: [[0, 0]],
        }),
      ),
    )

    // The visible analysis drawer owns the edit toolbar; compatibility buttons
    // remain hidden for older command-surface tests.
    const toolbar = queryByTestId('analysis-edit-toolbar')
    assert.ok(
      toolbar,
      'Analysis mode should have visible data-testid="analysis-edit-toolbar"',
    )

    for (const testId of analysisButtons) {
      const btn = queryByTestId(testId)
      assert.ok(
        btn,
        `Analysis mode should have button with data-testid="${testId}"`,
      )
    }

    for (const testId of [
      '区域选择',
      '清除区域',
      'Territory',
      'Territory Compare',
      'AI 推荐点',
      '人类偏好点',
    ]) {
      const btn = queryVisibleEditTool(container, testId)
      assert.ok(
        btn,
        `Analysis mode should have visible EditBar tool "${testId}"`,
      )
    }

    const visibleLegacyActions = container.querySelectorAll(
      '.wb-bottom-action-bar__visual button[data-testid^="action-"]',
    )
    assert.strictEqual(
      visibleLegacyActions.length,
      0,
      'Analysis drawer should not show legacy undo/redo/clear/snapshot buttons',
    )
  })

  // --- T-4.3e: button clicks fire callbacks ---
  // SIDE_EFFECT: callback invocation
  // Production subject: BottomActionBar component
  // Production bug: button click does not invoke the corresponding callback
  // Controlled dependencies: props are inline
  it('T-4.3e: play button clicks fire callbacks', () => {
    const calls = {undo: false, pass: false}
    const {queryByTestId} = renderToDom(
      h(
        BottomActionBar,
        noopProps({
          mode: 'play',
          onUndo: () => {
            calls.undo = true
          },
          onPass: () => {
            calls.pass = true
          },
        }),
      ),
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

  it('T-4.3e2: analysis annotation tool click delegates through EditBar', () => {
    let selectedTool = null
    const {container} = renderToDom(
      h(
        BottomActionBar,
        noopProps({
          mode: 'analysis',
          selectedTool: 'stone_1',
          onAnnotationToolChange: (tool) => {
            selectedTool = tool
          },
        }),
      ),
    )

    const triangle = container.querySelector(
      '[data-testid="analysis-edit-toolbar"] #edit a[data-id="triangle"]',
    )
    assert.ok(triangle, 'Visible EditBar triangle tool not found')

    triangle.click()
    assert.strictEqual(
      selectedTool,
      'triangle',
      'EditBar tool click should fire onAnnotationToolChange with the selected tool id',
    )
  })

  // --- T-4.3f: analysis annotation tools render ---
  // Production subject: BottomActionBar component
  // Production bug: annotation tool buttons missing
  // Controlled dependencies: props are inline
  it('T-4.3f: analysis annotation tools render all tool buttons', () => {
    const annotationTools = [
      'stone_1',
      'cross',
      'triangle',
      'square',
      'circle',
      'line',
      'arrow',
      'label',
      'number',
    ]

    const {container} = renderToDom(
      h(BottomActionBar, noopProps({mode: 'analysis'})),
    )

    const toolBtns = Array.from(
      container.querySelectorAll(
        '[data-testid="analysis-edit-toolbar"] #edit a[data-id]',
      ),
    )
    assert.strictEqual(
      toolBtns.length,
      annotationTools.length,
      `Expected ${annotationTools.length} annotation tool buttons, got ${toolBtns.length}`,
    )

    const renderedTools = toolBtns.map((b) => b.getAttribute('data-id'))
    for (const tool of annotationTools) {
      assert.ok(
        renderedTools.includes(tool),
        `Annotation tool "${tool}" not found. Got: [${renderedTools.join(', ')}]`,
      )
    }
  })

  // --- T-4.3g: active annotation tool is highlighted ---
  // Production subject: BottomActionBar component
  // Production bug: active tool button not visually distinguished
  // Controlled dependencies: props are inline
  it('T-4.3g: active annotation tool is highlighted', () => {
    const {container} = renderToDom(
      h(
        BottomActionBar,
        noopProps({
          mode: 'analysis',
          activeAnnotationTool: 'triangle',
        }),
      ),
    )

    const toolBtns = Array.from(
      container.querySelectorAll(
        '[data-testid="analysis-edit-toolbar"] #edit li',
      ),
    )
    const triangleBtn = toolBtns.find(
      (b) => b.querySelector('a[data-id="triangle"]') != null,
    )
    assert.ok(triangleBtn, 'Triangle annotation tool button not found')

    const classList = triangleBtn.className || ''
    assert.ok(
      classList.includes('active') || classList.includes('selected'),
      `Active tool "triangle" should have active class, got "${classList}"`,
    )
  })
})

// ============================================================================
// Phase U2: Status Text Area
// ============================================================================

describe('BottomActionBar status text (T-U2-3)', function () {
  before(async function () {
    BottomActionBar = await tryImport(
      'src/components/workbench/shell/BottomActionBar.js',
    )
    if (!BottomActionBar) this.skip()
  })

  // --- T-U2-3a: has .wb-status-text area ---
  // Production subject: BottomActionBar component
  // Production import path: src/components/workbench/shell/BottomActionBar.js
  // Production bug: BottomActionBar does not render a .wb-status-text element
  // Controlled dependencies: props are inline
  it('T-U2-3a: renders .wb-status-text area', () => {
    const {container} = renderToDom(
      h(
        BottomActionBar,
        noopProps({
          mode: 'play',
          workspaceLabel: '对局',
          moveNumber: 42,
          engineStatus: 'KataGo 已连接',
        }),
      ),
    )

    const statusText = container.querySelector('.wb-status-text')
    assert.ok(statusText, 'Expected element with class .wb-status-text')
  })

  // --- T-U2-3b: contains workspaceLabel, moveNumber, engineStatus ---
  // Production subject: BottomActionBar component
  // Production import path: src/components/workbench/shell/BottomActionBar.js
  // Production bug: BottomActionBar does not render workspaceLabel, moveNumber,
  //   or engineStatus text in the status area
  // Controlled dependencies: props are inline test data
  it('T-U2-3b: status text contains workspaceLabel, moveNumber, engineStatus', () => {
    const {container} = renderToDom(
      h(
        BottomActionBar,
        noopProps({
          mode: 'play',
          workspaceLabel: '对局',
          moveNumber: 42,
          engineStatus: 'KataGo 已连接',
        }),
      ),
    )

    const text = container.textContent
    assert.ok(
      text.includes('对局'),
      'Expected workspaceLabel "对局" in status text',
    )
    assert.ok(text.includes('42'), 'Expected moveNumber "42" in status text')
    assert.ok(
      text.includes('KataGo'),
      'Expected engineStatus containing "KataGo" in status text',
    )
  })

  // --- T-U2-3c: different mode produces different workspaceLabel ---
  // Production subject: BottomActionBar component
  // Production import path: src/components/workbench/shell/BottomActionBar.js
  // Production bug: workspaceLabel does not change across modes, always shows
  //   same label regardless of mode prop
  // Controlled dependencies: props are inline test data
  it('T-U2-3c: different mode produces different workspaceLabel', () => {
    const playResult = renderToDom(
      h(
        BottomActionBar,
        noopProps({
          mode: 'play',
          workspaceLabel: '对局',
          moveNumber: 1,
          engineStatus: '',
        }),
      ),
    )

    const problemResult = renderToDom(
      h(
        BottomActionBar,
        noopProps({
          mode: 'problem',
          workspaceLabel: '做题',
          moveNumber: 1,
          engineStatus: '',
        }),
      ),
    )

    const playText = playResult.container.textContent
    const problemText = problemResult.container.textContent

    assert.ok(
      playText.includes('对局'),
      'Play mode should show "对局" workspaceLabel',
    )
    assert.ok(
      problemText.includes('做题'),
      'Problem mode should show "做题" workspaceLabel',
    )
    assert.notStrictEqual(
      playText,
      problemText,
      'Different modes should produce different status text',
    )
  })
})
