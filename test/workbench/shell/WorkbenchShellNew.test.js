/**
 * WorkbenchShell Rewrite Contract Tests (T-2, T-3, T-4)
 *
 * Test contract: docs/design/2026-05-18/workbench-shell-integration/test-contract-v0.1.md
 * Contracts covered: T-2.1a through T-2.1h, T-3.1a, T-4.1a through T-4.1c
 *
 * Test Legitimacy:
 *   T-2 tests: Import production WorkbenchShell from src/components/WorkbenchShell.js.
 *     Production module missing -> tryImport returns null -> this.skip(), no silent pass.
 *     Controlled dependencies: jsdom DOM via preactTestHelper; props are inline.
 *   T-3 test: Import production index.js, assert named export is a function.
 *   T-4 tests: Read production CSS file via fs.readFileSync, assert class strings exist.
 *
 * NOTE: WorkbenchShell rewrite is TO-BE-IMPLEMENTED. These tests will fail until
 * the component is rewritten to use new workbench sub-components with data-testid
 * attributes.
 */

import assert from 'assert'
import {h} from 'preact'
import {readFileSync} from 'fs'
import {resolve, dirname} from 'path'
import {fileURLToPath} from 'url'

import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '../../..')

let WorkbenchShell = null

/**
 * Helper: render WorkbenchShell with minimal valid props.
 * Provides a mock child for MainBoardStage.
 */
function renderShell(overrides = {}) {
  const props = {
    mode: 'play',
    onModeChange: () => {},
    children: h('div', {'data-testid': 'mock-children'}, 'board'),
    ...overrides,
  }
  return renderToDom(h(WorkbenchShell, props))
}

// ============================================================================
// T-2: WorkbenchShell Rewrite — Structural Layout
// ============================================================================

describe('WorkbenchShell Rewrite (T-2.1)', function () {
  before(async function () {
    WorkbenchShell = await tryImport('src/components/WorkbenchShell.js')
    if (!WorkbenchShell) this.skip()
  })

  // --- T-2.1a: renders GlobalHeader ---
  // Production subject: WorkbenchShell component
  // Production import path: src/components/WorkbenchShell.js
  // Production bug: WorkbenchShell does not render GlobalHeader, or GlobalHeader
  //   lacks data-testid="global-header"
  // Controlled dependencies: jsdom DOM; minimal inline props
  it('T-2.1a: renders GlobalHeader with data-testid="global-header"', function () {
    const {queryByTestId} = renderShell()

    const header = queryByTestId('global-header')
    assert.ok(header, 'Expected element with data-testid="global-header" inside shell')
  })

  // --- T-2.1b: renders GameTabBar when games prop provided ---
  // Production subject: WorkbenchShell component
  // Production import path: src/components/WorkbenchShell.js
  // Production bug: WorkbenchShell does not render GameTabBar when games prop is given,
  //   or GameTabBar lacks data-testid="game-tab-bar"
  // Controlled dependencies: jsdom DOM; games prop is inline
  it('T-2.1b: renders GameTabBar when games prop provided', function () {
    const {queryByTestId} = renderShell({
      games: [{index: 0, title: 'Test Game', active: true}],
      activeIndex: 0,
      onSelectGame: () => {},
      onCloseGame: () => {},
      onAddGame: () => {},
    })

    const tabBar = queryByTestId('game-tab-bar')
    assert.ok(tabBar, 'Expected element with data-testid="game-tab-bar" when games prop provided')
  })

  // --- T-2.1c: renders ModeBar ---
  // Production subject: WorkbenchShell component
  // Production import path: src/components/WorkbenchShell.js
  // Production bug: WorkbenchShell does not render ModeBar, or ModeBar
  //   lacks data-testid="mode-bar"
  // Controlled dependencies: jsdom DOM; mode prop is inline
  it('T-2.1c: renders ModeBar with data-testid="mode-bar"', function () {
    const {queryByTestId} = renderShell({mode: 'play'})

    const modeBar = queryByTestId('mode-bar')
    assert.ok(modeBar, 'Expected element with data-testid="mode-bar" inside shell')
  })

  // --- T-2.1d: renders correct left panel per mode ---
  // Production subject: WorkbenchShell component
  // Production import path: src/components/WorkbenchShell.js
  // Production bug: wrong mode panel rendered for a given mode, or mode panel
  //   lacks the expected data-testid
  // Controlled dependencies: jsdom DOM; mode prop varies per sub-test
  const modePanelCases = [
    {mode: 'play', testId: 'play-mode-panel'},
    {mode: 'problem', testId: 'problem-mode-panel'},
    {mode: 'recall', testId: 'recall-mode-panel'},
    {mode: 'analysis', testId: 'analysis-mode-panel'},
  ]

  for (const {mode, testId} of modePanelCases) {
    it(`T-2.1d: renders ${testId} when mode="${mode}"`, function () {
      const {queryByTestId} = renderShell({mode})

      const panel = queryByTestId(testId)
      assert.ok(panel, `Expected element with data-testid="${testId}" when mode="${mode}"`)
    })
  }

  // --- T-2.1e: renders MainBoardStage in center ---
  // Production subject: WorkbenchShell component
  // Production import path: src/components/WorkbenchShell.js
  // Production bug: WorkbenchShell does not render MainBoardStage, or MainBoardStage
  //   lacks data-testid="main-board-stage"
  // Controlled dependencies: jsdom DOM; children prop is a mock div
  it('T-2.1e: renders MainBoardStage in center with data-testid="main-board-stage"', function () {
    const {queryByTestId} = renderShell()

    const board = queryByTestId('main-board-stage')
    assert.ok(board, 'Expected element with data-testid="main-board-stage" inside shell')
  })

  // --- T-2.1f: renders RightModePanel ---
  // Production subject: WorkbenchShell component
  // Production import path: src/components/WorkbenchShell.js
  // Production bug: WorkbenchShell does not render RightModePanel, or RightModePanel
  //   lacks data-testid="right-mode-panel"
  // Controlled dependencies: jsdom DOM; minimal inline props
  it('T-2.1f: renders RightModePanel with data-testid="right-mode-panel"', function () {
    const {queryByTestId} = renderShell()

    const rightPanel = queryByTestId('right-mode-panel')
    assert.ok(rightPanel, 'Expected element with data-testid="right-mode-panel" inside shell')
  })

  // --- T-2.1g: renders BottomActionBar ---
  // Production subject: WorkbenchShell component
  // Production import path: src/components/WorkbenchShell.js
  // Production bug: WorkbenchShell does not render BottomActionBar, or BottomActionBar
  //   lacks data-testid="bottom-action-bar"
  // Controlled dependencies: jsdom DOM; minimal inline props
  it('T-2.1g: renders BottomActionBar with data-testid="bottom-action-bar"', function () {
    const {queryByTestId} = renderShell()

    const actionBar = queryByTestId('bottom-action-bar')
    assert.ok(actionBar, 'Expected element with data-testid="bottom-action-bar" inside shell')
  })

  // --- T-2.1h: does NOT render legacy components ---
  // Production subject: WorkbenchShell component
  // Production import path: src/components/WorkbenchShell.js
  // Production bug: legacy class "workbench-shell__left" or BoardToolbar still present
  //   in rewritten component
  // Controlled dependencies: jsdom DOM; minimal inline props
  it('T-2.1h: does NOT render legacy workbench-shell__left or BoardToolbar', function () {
    const {container} = renderShell()

    // Legacy class should not exist
    const legacyLeft = container.querySelector('.workbench-shell__left')
    assert.strictEqual(legacyLeft, null, 'Legacy .workbench-shell__left should NOT be present')

    // BoardToolbar should not be rendered (it uses class 'board-toolbar')
    const boardToolbar = container.querySelector('.board-toolbar')
    assert.strictEqual(boardToolbar, null, 'BoardToolbar (.board-toolbar) should NOT be present')
  })
})

// ============================================================================
// T-3: Index Export
// ============================================================================

describe('workbench/index.js exports (T-3.1)', function () {
  // --- T-3.1a: GameTabBar exported from workbench/index.js ---
  // Production subject: workbench/index.js module
  // Production import path: src/components/workbench/index.js
  // Production bug: GameTabBar is not exported, or exported value is not a function
  // Controlled dependencies: none (static import assertion)
  it('T-3.1a: exports GameTabBar as a function', async function () {
    const workbench = await tryImport('src/components/workbench/index.js')
    if (!workbench) return this.skip()

    assert.ok(workbench.GameTabBar, 'GameTabBar should be exported from workbench/index.js')
    assert.strictEqual(
      typeof workbench.GameTabBar,
      'function',
      `GameTabBar should be a function, got ${typeof workbench.GameTabBar}`
    )
  })
})

// ============================================================================
// T-4: CSS for GameTabBar
// ============================================================================

describe('workbench.css GameTabBar styles (T-4.1)', function () {
  let cssContent = ''

  before(function () {
    const cssPath = resolve(projectRoot, 'style/workbench.css')
    try {
      cssContent = readFileSync(cssPath, 'utf-8')
    } catch {
      // CSS file does not exist yet
    }
  })

  // --- T-4.1a: workbench.css contains .wb-game-tab-bar ---
  // Production subject: style/workbench.css
  // Production bug: .wb-game-tab-bar class missing from stylesheet
  // Controlled dependencies: local file read via fs.readFileSync
  it('T-4.1a: contains .wb-game-tab-bar class', function () {
    assert.ok(
      cssContent.includes('.wb-game-tab-bar'),
      'Expected ".wb-game-tab-bar" class in workbench.css'
    )
  })

  // --- T-4.1b: workbench.css contains .wb-game-tab-bar__tab ---
  // Production subject: style/workbench.css
  // Production bug: .wb-game-tab-bar__tab class missing from stylesheet
  // Controlled dependencies: local file read via fs.readFileSync
  it('T-4.1b: contains .wb-game-tab-bar__tab class', function () {
    assert.ok(
      cssContent.includes('.wb-game-tab-bar__tab'),
      'Expected ".wb-game-tab-bar__tab" class in workbench.css'
    )
  })

  // --- T-4.1c: workbench.css contains .wb-game-tab-bar__tab--active ---
  // Production subject: style/workbench.css
  // Production bug: .wb-game-tab-bar__tab--active class missing from stylesheet
  // Controlled dependencies: local file read via fs.readFileSync
  it('T-4.1c: contains .wb-game-tab-bar__tab--active class', function () {
    assert.ok(
      cssContent.includes('.wb-game-tab-bar__tab--active'),
      'Expected ".wb-game-tab-bar__tab--active" class in workbench.css'
    )
  })
})