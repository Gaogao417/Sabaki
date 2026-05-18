/**
 * GlobalHeader Contract Tests (Phase 1.2c + Phase U2)
 *
 * Test contract:
 *   Phase 1.2c: docs/design/2026-05-18/workbench-ui-phases-1-3/test-contract-v0.1.md
 *   Phase U2: docs/design/2026-05-19/phase-u2-structural/test-contract-v0.1.md
 * Contracts covered: T-1.2c, T-U2-1e, T-U2-5a, T-U2-5b, T-U2-6a
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

// ============================================================================
// Phase U2: StoneStatus Integration + Avatar Removal + Chinese Labels
// ============================================================================

describe('GlobalHeader Phase U2 (T-U2-1e, T-U2-5, T-U2-6)', () => {
  // --- T-U2-1e: renders StoneStatus (black stone indicator present) ---
  // Production subject: GlobalHeader component
  // Production import path: src/components/workbench/shell/GlobalHeader.js
  // Production bug: GlobalHeader does not render StoneStatus, or StoneStatus
  //   does not produce a .wb-stone-indicator--black element
  // Controlled dependencies: props are inline; StoneStatus is rendered as a child
  //   component within GlobalHeader
  it('T-U2-1e: renders StoneStatus with black stone indicator', () => {
    const {container} = renderToDom(
      h(GlobalHeader, {
        taskTitle: 'Test',
        mode: 'play',
        statusChips: [],
        blackCaptures: 3,
        whiteCaptures: 5,
        currentPlayer: 'black',
      })
    )

    const blackIndicator = container.querySelector('.wb-stone-indicator--black')
    assert.ok(blackIndicator, 'Expected .wb-stone-indicator--black inside GlobalHeader')
  })

  // --- T-U2-5a: no avatar element ---
  // Production subject: GlobalHeader component
  // Production import path: src/components/workbench/shell/GlobalHeader.js
  // Production bug: GlobalHeader still renders .wb-global-header__avatar element
  // Controlled dependencies: props are inline
  it('T-U2-5a: does NOT render .wb-global-header__avatar', () => {
    const {container} = renderToDom(
      h(GlobalHeader, {
        taskTitle: 'Test',
        mode: 'play',
        statusChips: [],
      })
    )

    const avatar = container.querySelector('.wb-global-header__avatar')
    assert.strictEqual(avatar, null, '.wb-global-header__avatar should NOT be present')
  })

  // --- T-U2-5b: no GC initials ---
  // Production subject: GlobalHeader component
  // Production import path: src/components/workbench/shell/GlobalHeader.js
  // Production bug: GlobalHeader still renders "GC" initials text
  // Controlled dependencies: props are inline
  it('T-U2-5b: does NOT contain GC initials text', () => {
    const {container} = renderToDom(
      h(GlobalHeader, {
        taskTitle: 'Test',
        mode: 'play',
        statusChips: [],
      })
    )

    const allText = container.textContent
    // Check that "GC" does not appear as standalone initials
    // (it might appear in "GC" as part of a word, so we check the avatar-initials element)
    const initialsEl = container.querySelector('.wb-global-header__avatar-initials')
    assert.strictEqual(initialsEl, null, '.wb-global-header__avatar-initials should NOT be present')
  })

  // --- T-U2-6a: mode chip uses Chinese label ---
  // Production subject: GlobalHeader component
  // Production import path: src/components/workbench/shell/GlobalHeader.js
  // Production bug: mode chip shows English label instead of Chinese
  // Controlled dependencies: props are inline, mode varies
  it('T-U2-6a: mode chip uses Chinese label', () => {
    const cases = [
      {mode: 'play', expected: '对局'},
      {mode: 'problem', expected: '题目'},
      {mode: 'recall', expected: '回忆'},
      {mode: 'analysis', expected: '复盘'},
    ]

    for (const {mode, expected} of cases) {
      const {container} = renderToDom(
        h(GlobalHeader, {
          taskTitle: 'Test',
          mode,
          statusChips: [],
        })
      )

      const modeChip = container.querySelector('.wb-global-header__mode-chip')
      assert.ok(modeChip, `Expected .wb-global-header__mode-chip for mode="${mode}"`)
      assert.strictEqual(
        modeChip.textContent.trim(),
        expected,
        `Mode chip for "${mode}" should show "${expected}", got "${modeChip.textContent.trim()}"`
      )
    }
  })
})
