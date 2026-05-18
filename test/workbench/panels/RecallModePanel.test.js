/**
 * RecallModePanel Contract Tests (Phase 5)
 *
 * Test contract: docs/design/2026-05-18/workbench-ui-phase-5/test-contract-v0.1.md
 * Contracts covered: T-5.3a through T-5.3e
 *
 * Test Legitimacy:
 *   All tests import the production RecallModePanel component.
 *   Production module missing -> tryImport returns null -> this.skip(), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 *
 * NOTE: RecallModePanel is a TO-BE-CREATED component.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

let RecallModePanel = null

/**
 * Helper: build no-op callbacks for all RecallModePanel props.
 */
function noopProps(overrides = {}) {
  return {
    recallOriginalLine: true,
    onRecallToggle: () => {},
    progress: 0,
    currentMove: 0,
    totalMoves: 0,
    correctCount: 0,
    wrongCount: 0,
    status: '',
    onMarkCheckpoint: () => {},
    onVerify: () => {},
    onSkip: () => {},
    onHint: () => {},
    onEndRecall: () => {},
    checkpoints: [],
    activeCheckpointId: null,
    onSubmitCorrection: () => {},
    onRevealAI: () => {},
    onSkipCheckpoint: () => {},
    ...overrides,
  }
}

describe('RecallModePanel (T-5.3)', function () {
  before(async function () {
    RecallModePanel = await tryImport('src/components/workbench/panels/RecallModePanel.js')
    if (!RecallModePanel) this.skip()
  })

  // --- T-5.3a: renders ModeToggle for recall original line ---
  // Production subject: RecallModePanel component
  // Production bug: ModeToggle sub-component not rendered
  // Controlled dependencies: props are inline
  it('T-5.3a: renders ModeToggle for recall original line', () => {
    const {queryByTestId} = renderToDom(
      h(RecallModePanel, noopProps())
    )

    const root = queryByTestId('recall-mode-panel')
    assert.ok(root, 'Root element with data-testid="recall-mode-panel" not found')

    const modeToggle = queryByTestId('mode-toggle')
    assert.ok(
      modeToggle,
      'ModeToggle with data-testid="mode-toggle" should be present'
    )
  })

  // --- T-5.3b: with recallOriginalLine=true renders progress view ---
  // Production subject: RecallModePanel component
  // Production bug: ProgressRing not rendered when recallOriginalLine=true
  // Controlled dependencies: props are inline
  it('T-5.3b: recallOriginalLine=true renders progress view with ProgressRing', () => {
    const {queryByTestId} = renderToDom(
      h(RecallModePanel, noopProps({
        recallOriginalLine: true,
        progress: 60,
        currentMove: 6,
        totalMoves: 10,
        correctCount: 5,
        wrongCount: 1,
        status: '进行中',
      }))
    )

    const root = queryByTestId('recall-mode-panel')
    assert.ok(root, 'Root element not found')

    const progressRing = queryByTestId('progress-ring')
    assert.ok(
      progressRing,
      'ProgressRing with data-testid="progress-ring" should be present when recallOriginalLine=true'
    )

    // Verify progress stats are shown in the root content
    assert.ok(
      root.textContent.includes('6'),
      'Root should show currentMove "6"'
    )
    assert.ok(
      root.textContent.includes('10'),
      'Root should show totalMoves "10"'
    )
  })

  // --- T-5.3c: with recallOriginalLine=false renders checkpoint view ---
  // Production subject: RecallModePanel component
  // Production bug: checkpoint list not rendered when recallOriginalLine=false
  // Controlled dependencies: props are inline
  it('T-5.3c: recallOriginalLine=false renders checkpoint view', () => {
    const {queryByTestId, queryAllByTestId} = renderToDom(
      h(RecallModePanel, noopProps({
        recallOriginalLine: false,
        checkpoints: [
          {id: 'cp1', moveNumber: 10, source: 'system', summary: '第一个'},
          {id: 'cp2', moveNumber: 25, source: 'system', summary: '第二个'},
        ],
      }))
    )

    const root = queryByTestId('recall-mode-panel')
    assert.ok(root, 'Root element not found')

    // When recallOriginalLine=false, ProgressRing should NOT be present
    const progressRing = queryByTestId('progress-ring')
    assert.ok(
      !progressRing,
      'ProgressRing should NOT be present when recallOriginalLine=false'
    )

    // Checkpoint items should be rendered
    const checkpointPanels = queryAllByTestId('recall-checkpoint-panel')
    assert.ok(
      checkpointPanels.length >= 1,
      `Expected at least 1 checkpoint panel, got ${checkpointPanels.length}`
    )
  })

  // --- T-5.3d: fires callbacks in progress view ---
  // SIDE_EFFECT: callback invocation
  // Production subject: RecallModePanel component
  // Production bug: mark-checkpoint or verify button click does not fire callback
  // Controlled dependencies: props are inline
  it('T-5.3d: fires onMarkCheckpoint callback in progress view', () => {
    let markCalled = false
    const {queryByTestId} = renderToDom(
      h(RecallModePanel, noopProps({
        recallOriginalLine: true,
        onMarkCheckpoint: () => { markCalled = true },
      }))
    )

    const btn = queryByTestId('mark-checkpoint-btn')
    assert.ok(btn, 'Button with data-testid="mark-checkpoint-btn" not found')

    btn.click()
    assert.strictEqual(markCalled, true, 'onMarkCheckpoint should be called on click')
  })

  it('T-5.3d: fires onVerify callback in progress view', () => {
    let verifyCalled = false
    const {queryByTestId} = renderToDom(
      h(RecallModePanel, noopProps({
        recallOriginalLine: true,
        onVerify: () => { verifyCalled = true },
      }))
    )

    const btn = queryByTestId('verify-btn')
    assert.ok(btn, 'Button with data-testid="verify-btn" not found')

    btn.click()
    assert.strictEqual(verifyCalled, true, 'onVerify should be called on click')
  })

  // --- T-5.3e: fires callbacks in checkpoint view ---
  // SIDE_EFFECT: callback invocation
  // Production subject: RecallModePanel component
  // Production bug: submit-correction button click does not fire callback
  // Controlled dependencies: props are inline
  it('T-5.3e: fires onSubmitCorrection callback in checkpoint view', () => {
    let correctionCalled = false
    const {queryByTestId} = renderToDom(
      h(RecallModePanel, noopProps({
        recallOriginalLine: false,
        checkpoints: [
          {id: 'cp1', moveNumber: 10, source: 'system', summary: '检查点'},
        ],
        activeCheckpointId: 'cp1',
        onSubmitCorrection: () => { correctionCalled = true },
      }))
    )

    const btn = queryByTestId('submit-correction-btn')
    assert.ok(btn, 'Button with data-testid="submit-correction-btn" not found')

    btn.click()
    assert.strictEqual(correctionCalled, true, 'onSubmitCorrection should be called on click')
  })
})

describe('RecallModePanel state overlay (T-7.2f)', function () {
  before(async function () {
    RecallModePanel = await tryImport('src/components/workbench/panels/RecallModePanel.js')
    if (!RecallModePanel) this.skip()
  })

  // --- T-7.2f: state="disabled" renders disabled overlay ---
  // Production subject: RecallModePanel component state prop
  // Production bug: disabled overlay not rendered when state="disabled"
  // Controlled dependencies: props are inline
  it('T-7.2f: state="disabled" renders disabled overlay', () => {
    const {queryByTestId} = renderToDom(
      h(RecallModePanel, noopProps({state: 'disabled'}))
    )

    const overlay = queryByTestId('disabled-overlay')
    assert.ok(overlay, 'data-testid="disabled-overlay" should be present when state="disabled"')
  })
})