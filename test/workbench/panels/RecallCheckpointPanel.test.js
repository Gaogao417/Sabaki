/**
 * RecallCheckpointPanel Contract Tests (Phase 5)
 *
 * Test contract: docs/design/2026-05-18/workbench-ui-phase-5/test-contract-v0.1.md
 * Contracts covered: T-5.4a through T-5.4c
 *
 * Test Legitimacy:
 *   All tests import the production RecallCheckpointPanel component.
 *   Production module missing -> tryImport returns null -> this.skip(), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 *
 * NOTE: RecallCheckpointPanel is a TO-BE-CREATED component.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

let RecallCheckpointPanel = null

describe('RecallCheckpointPanel (T-5.4)', function () {
  before(async function () {
    RecallCheckpointPanel = await tryImport('src/components/workbench/panels/RecallCheckpointPanel.js')
    if (!RecallCheckpointPanel) this.skip()
  })

  // --- T-5.4a: renders checkpoint info ---
  // Production subject: RecallCheckpointPanel component
  // Production bug: moveNumber or summary text not rendered
  // Controlled dependencies: props are inline
  it('T-5.4a: renders checkpoint info', () => {
    const {queryByTestId} = renderToDom(
      h(RecallCheckpointPanel, {
        checkpoint: {id: 'cp1', moveNumber: 42, source: 'system', summary: '关键变化'},
        isActive: false,
        onSelect: () => {},
      })
    )

    const root = queryByTestId('recall-checkpoint-panel')
    assert.ok(root, 'Root element with data-testid="recall-checkpoint-panel" not found')

    assert.ok(
      root.textContent.includes('42'),
      'Root should contain moveNumber "42"'
    )
    assert.ok(
      root.textContent.includes('关键变化'),
      'Root should contain summary text "关键变化"'
    )
  })

  // --- T-5.4b: active state has active class ---
  // Production subject: RecallCheckpointPanel component
  // Production bug: active class not applied when isActive=true
  // Controlled dependencies: props are inline
  it('T-5.4b: active state has active class', () => {
    const {queryByTestId} = renderToDom(
      h(RecallCheckpointPanel, {
        checkpoint: {id: 'cp1', moveNumber: 42, source: 'system', summary: '关键变化'},
        isActive: true,
        onSelect: () => {},
      })
    )

    const root = queryByTestId('recall-checkpoint-panel')
    assert.ok(root, 'Root element not found')

    const classList = root.className || ''
    assert.ok(
      classList.includes('active'),
      `Active checkpoint should have "active" class, got "${classList}"`
    )
  })

  // --- T-5.4b (negative): inactive state has no active class ---
  // Production subject: RecallCheckpointPanel component
  // Production bug: active class applied when isActive=false
  // Controlled dependencies: props are inline
  it('T-5.4b: inactive state has no active class', () => {
    const {queryByTestId} = renderToDom(
      h(RecallCheckpointPanel, {
        checkpoint: {id: 'cp1', moveNumber: 42, source: 'system', summary: '关键变化'},
        isActive: false,
        onSelect: () => {},
      })
    )

    const root = queryByTestId('recall-checkpoint-panel')
    assert.ok(root, 'Root element not found')

    const classList = root.className || ''
    assert.ok(
      !classList.includes('active'),
      `Inactive checkpoint should NOT have "active" class, got "${classList}"`
    )
  })

  // --- T-5.4c: fires onSelect callback ---
  // SIDE_EFFECT: callback invocation
  // Production subject: RecallCheckpointPanel component
  // Production bug: click does not invoke onSelect
  // Controlled dependencies: props are inline
  it('T-5.4c: fires onSelect callback on click', () => {
    let called = false
    const {queryByTestId} = renderToDom(
      h(RecallCheckpointPanel, {
        checkpoint: {id: 'cp1', moveNumber: 42, source: 'system', summary: '关键变化'},
        isActive: false,
        onSelect: () => { called = true },
      })
    )

    const root = queryByTestId('recall-checkpoint-panel')
    assert.ok(root, 'Root element not found')

    root.click()
    assert.strictEqual(called, true, 'onSelect should be called on click')
  })
})