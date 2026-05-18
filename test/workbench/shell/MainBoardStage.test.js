/**
 * MainBoardStage Contract Tests (Phase 4)
 *
 * Test contract: docs/design/2026-05-18/workbench-ui-phase-4/test-contract-v0.1.md
 * Contracts covered: T-4.1a through T-4.1d
 *
 * Test Legitimacy:
 *   All tests import the production MainBoardStage component.
 *   Production module missing -> tryImport returns null -> this.skip(), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 *
 * NOTE: MainBoardStage is a TO-BE-CREATED component.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

let MainBoardStage = null

describe('MainBoardStage (T-4.1)', function () {
  before(async function () {
    MainBoardStage = await tryImport('src/components/workbench/shell/MainBoardStage.js')
    if (!MainBoardStage) this.skip()
  })

  // --- T-4.1a: renders placeholder with mode label ---
  // Production subject: MainBoardStage component
  // Production bug: missing mode label or board placeholder text
  // Controlled dependencies: props are inline
  it('T-4.1a: renders placeholder with mode label and board area text', () => {
    const {getByTestId, queryByTestId} = renderToDom(
      h(MainBoardStage, {mode: 'play'})
    )

    const root = queryByTestId('main-board-stage')
    assert.ok(root, 'Root element with data-testid="main-board-stage" not found')

    const modeChip = queryByTestId('board-mode-chip')
    assert.ok(modeChip, 'Mode chip with data-testid="board-mode-chip" not found')

    const placeholder = queryByTestId('board-placeholder')
    assert.ok(placeholder, 'Placeholder with data-testid="board-placeholder" not found')
    assert.ok(
      placeholder.textContent.includes('棋盘区域'),
      'Placeholder should contain "棋盘区域"'
    )

    // Mode label for play is "对局"
    assert.ok(
      root.textContent.includes('对局'),
      'Root should show mode label "对局" for play mode'
    )
  })

  // --- T-4.1b: renders mode-specific labels ---
  // Production subject: MainBoardStage component
  // Production bug: wrong or missing Chinese label for a given mode
  // Controlled dependencies: props are inline
  const modeLabels = [
    ['play', '对局'],
    ['problem', '题目'],
    ['recall', '复棋'],
    ['analysis', '分析'],
  ]

  for (const [mode, label] of modeLabels) {
    it(`T-4.1b: mode=${mode} shows label "${label}"`, () => {
      const {getByTestId} = renderToDom(
        h(MainBoardStage, {mode})
      )

      const root = getByTestId('main-board-stage')
      assert.ok(
        root.textContent.includes(label),
        `Mode ${mode} should show label "${label}"`
      )
    })
  }

  // --- T-4.1c: renders children when provided ---
  // Production subject: MainBoardStage component
  // Production bug: children prop is ignored
  // Controlled dependencies: props are inline
  it('T-4.1c: renders children when provided', () => {
    const {queryByTestId} = renderToDom(
      h(MainBoardStage, {mode: 'play'},
        h('div', {'data-testid': 'child'}, 'test')
      )
    )

    const child = queryByTestId('child')
    assert.ok(child, 'Child element should be rendered inside the board area')
    assert.strictEqual(child.textContent, 'test', 'Child text content should match')
  })

  // --- T-4.1d: applies mode color to mode chip ---
  // Production subject: MainBoardStage component
  // Production bug: mode chip does not apply the mode-specific color
  // Controlled dependencies: props are inline
  const modeColors = [
    ['play', '#2563ff'],
    ['problem', '#d97706'],
    ['recall', '#169b55'],
    ['analysis', '#7c3aed'],
  ]

  for (const [mode, color] of modeColors) {
    it(`T-4.1d: mode=${mode} chip has color ${color}`, () => {
      const {getByTestId} = renderToDom(
        h(MainBoardStage, {mode})
      )

      const chip = getByTestId('board-mode-chip')
      const style = chip.getAttribute('style') || ''
      assert.ok(
        style.includes(color),
        `Mode chip for ${mode} should include color ${color} in its style, got: "${style}"`
      )
    })
  }
})
