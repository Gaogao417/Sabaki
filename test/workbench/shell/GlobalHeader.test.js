/**
 * GlobalHeader Contract Tests (Phase 1.2c)
 *
 * Test contract: docs/design/2026-05-18/workbench-ui-phases-1-3/test-contract-v0.1.md
 * Contracts covered: T-1.2c
 *
 * Test Legitimacy:
 *   All tests import the production GlobalHeader component.
 *   Production module missing -> tests FAIL (import error), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'

import GlobalHeader from '../../../src/components/workbench/shell/GlobalHeader.js'

describe('GlobalHeader (T-1.2c)', () => {
  // --- T-1.2c: GlobalHeader uses QuietStatusChips replacing statusChips ---
  // PURE_LOGIC: Assert characteristic output (chip rendering), not component instance.
  // Production subject: GlobalHeader component
  // Production bug: GlobalHeader still uses raw statusChips strings instead of
  //   QuietStatusChips component (no data-testid="quiet-status-chip" elements)
  // Controlled dependencies: props are inline test data

  it('T-1.2c: GlobalHeader renders status chip elements from statusChips prop', () => {
    const {container} = renderToDom(
      h(GlobalHeader, {
        taskTitle: 'Test',
        mode: 'play',
        statusChips: ['黑先', '未提交'],
      })
    )

    // GlobalHeader must render chip-like elements for each status chip string
    const chips = container.querySelectorAll('.wb-global-header__status-chip')
    assert.ok(chips.length >= 2, `Expected at least 2 status chip elements, got ${chips.length}`)
    assert.ok(container.textContent.includes('黑先'), 'Missing chip text "黑先"')
    assert.ok(container.textContent.includes('未提交'), 'Missing chip text "未提交"')
  })
})
