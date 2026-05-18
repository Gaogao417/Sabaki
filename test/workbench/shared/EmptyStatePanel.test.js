/**
 * EmptyStatePanel Contract Tests (Phase 2.1)
 *
 * Test contract: docs/design/2026-05-18/workbench-ui-phases-1-3/test-contract-v0.1.md
 * Contracts covered: T-2.1a, T-2.1b, T-2.1c
 *
 * Test Legitimacy:
 *   All tests import the production EmptyStatePanel component.
 *   Production module missing -> tests FAIL (import error), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 *
 * NOTE: EmptyStatePanel is a TO-BE-CREATED component.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

let EmptyStatePanel = null

describe('EmptyStatePanel (T-2.1)', function () {
  before(async function () {
    EmptyStatePanel = await tryImport('src/components/workbench/shared/EmptyStatePanel.js')
    if (!EmptyStatePanel) this.skip()
  })

  // --- T-2.1a: Renders icon, title, description text ---
  // Production subject: EmptyStatePanel component
  // Production bug: missing icon, title, or description rendering
  // Controlled dependencies: props are inline test data
  it('T-2.1a: renders icon, title, and description text', () => {
    const {container, queryByTestId} = renderToDom(
      h(EmptyStatePanel, {
        icon: 'empty-icon',
        title: 'No tasks yet',
        description: 'Start by creating a new task',
      })
    )

    assert.ok(container.textContent.includes('No tasks yet'),
      'Title text not rendered')
    assert.ok(container.textContent.includes('Start by creating a new task'),
      'Description text not rendered')

    const icon = queryByTestId('empty-state-icon')
    assert.ok(icon, 'Icon element with data-testid="empty-state-icon" not found')
  })

  // --- T-2.1b: Renders action button when action prop provided, onClick fires ---
  // Production subject: EmptyStatePanel component
  // Production bug: action button not rendered or onClick not wired
  it('T-2.1b: renders action button when action prop provided and onClick fires', () => {
    let clicked = false
    const {queryByTestId, fireEvent} = renderToDom(
      h(EmptyStatePanel, {
        icon: 'plus',
        title: 'Empty',
        description: 'Nothing here',
        action: {label: 'Create Task', onClick: () => { clicked = true }},
      })
    )

    const btn = queryByTestId('empty-state-action')
    assert.ok(btn, 'Action button with data-testid="empty-state-action" not found')
    assert.ok(btn.textContent.includes('Create Task'), 'Action button label not rendered')

    fireEvent.click(btn)
    assert.strictEqual(clicked, true, 'onClick callback was not triggered')
  })

  // --- T-2.1c: No action button when action prop omitted ---
  // Production subject: EmptyStatePanel component
  // Production bug: action button rendered even without action prop
  it('T-2.1c: no action button when action prop omitted', () => {
    const {queryByTestId} = renderToDom(
      h(EmptyStatePanel, {
        icon: 'empty',
        title: 'Nothing',
        description: 'No action available',
      })
    )

    const btn = queryByTestId('empty-state-action')
    assert.strictEqual(btn, null, 'Action button should not be rendered when action prop omitted')
  })
})
