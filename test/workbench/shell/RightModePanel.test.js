/**
 * RightModePanel Contract Tests (Phase 4)
 *
 * Test contract: docs/design/2026-05-18/workbench-ui-phase-4/test-contract-v0.1.md
 * Contracts covered: T-4.4a, T-4.4b
 *
 * Test Legitimacy:
 *   All tests import the production RightModePanel component.
 *   Production module missing -> tryImport returns null -> this.skip(), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 *
 * NOTE: RightModePanel is a TO-BE-CREATED component.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

let RightModePanel = null

describe('RightModePanel (T-4.4)', function () {
  before(async function () {
    RightModePanel = await tryImport('src/components/workbench/shell/RightModePanel.js')
    if (!RightModePanel) this.skip()
  })

  // --- T-4.4a: renders placeholder per mode ---
  // Production subject: RightModePanel component
  // Production bug: placeholder content missing or root testid missing
  // Controlled dependencies: props are inline
  const modes = ['play', 'problem', 'recall', 'analysis']

  for (const mode of modes) {
    it(`T-4.4a: renders placeholder for mode=${mode}`, () => {
      const {queryByTestId} = renderToDom(
        h(RightModePanel, {mode})
      )

      const root = queryByTestId('right-mode-panel')
      assert.ok(root, `Root with data-testid="right-mode-panel" not found for mode=${mode}`)

      // The panel should contain some placeholder content (non-empty)
      assert.ok(
        root.textContent.trim().length > 0,
        `Right panel should have placeholder content for mode=${mode}`
      )
    })
  }

  // --- T-4.4b: switches content on mode change ---
  // Production subject: RightModePanel component
  // Production bug: mode change does not update panel content
  // Controlled dependencies: props are inline
  it('T-4.4b: switches content when mode changes', () => {
    const playResult = renderToDom(
      h(RightModePanel, {mode: 'play'})
    )
    const playContent = playResult.queryByTestId('right-mode-panel').textContent.trim()

    const analysisResult = renderToDom(
      h(RightModePanel, {mode: 'analysis'})
    )
    const analysisContent = analysisResult.queryByTestId('right-mode-panel').textContent.trim()

    assert.notStrictEqual(
      playContent,
      analysisContent,
      'Switching mode from play to analysis should change the panel content'
    )
  })
})
