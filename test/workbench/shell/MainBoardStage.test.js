/**
 * MainBoardStage Contract Tests (Phase 4 + W3 wiring)
 *
 * Original Phase 4 contract: T-4.1a through T-4.1d (placeholder tests)
 * W3 upgrade: MainBoardStage now renders real Goban when boardProps provided,
 * falls back to minimal container when boardProps absent.
 *
 * Test Legitimacy:
 *   All tests import the production MainBoardStage component.
 *   Production module missing -> tryImport returns null -> this.skip(), no silent pass.
 *   Controlled dependencies: jsdom DOM via preactTestHelper.
 *
 * Note: T-4.1b cannot fully render Goban in jsdom because Goban depends on
 * window.sabaki.setting.get. We test the prop-flattening contract by verifying
 * the component renders without error when boardProps is provided (with the
 * global stub) and structure when boardProps is absent.
 */

import assert from 'assert'
import {h} from 'preact'
import {renderToDom} from '../preactTestHelper.js'
import {tryImport} from '../tryImport.js'

let MainBoardStage = null

function stubWindowSabaki() {
  if (!global.window) global.window = {}
  if (!global.window.sabaki) global.window.sabaki = {}
  if (!global.window.sabaki.setting) {
    global.window.sabaki.setting = {get: () => undefined}
  }
}

describe('MainBoardStage (T-4.1)', function () {
  before(async function () {
    MainBoardStage = await tryImport('src/components/workbench/shell/MainBoardStage.js')
    if (!MainBoardStage) this.skip()
  })

  // --- T-4.1a: renders container without boardProps ---
  it('T-4.1a: renders container div when boardProps absent', () => {
    const {queryByTestId} = renderToDom(
      h(MainBoardStage, {mode: 'play'})
    )

    const root = queryByTestId('main-board-stage')
    assert.ok(root, 'Root element with data-testid="main-board-stage" not found')
  })

  // --- T-4.1b: passes flattened boardProps to Goban when provided ---
  // Verifies the component doesn't crash when boardProps present.
  // Full Goban rendering is tested in existing Goban component tests with full Electron setup.
  it('T-4.1b: renders without error when boardProps provided', () => {
    stubWindowSabaki()

    const noop = () => {}
    const boardProps = {
      boardStateProps: {
        gameTree: null,
        treePosition: '',
        board: {width: 9, height: 9, signMap: Array(9).fill(null).map(() => Array(9).fill(0)), lines: []},
      },
      overlayDisplayProps: {
        paintMap: [], markerMap: [], dimmedStones: [], analysis: null,
        showMoveNumbers: false, showNextMoves: false, showSiblings: false,
        crosshair: false, overlayGhostStoneMap: null, showCoordinates: true,
        showMoveColorization: false, fuzzyStonePlacement: false,
        animateStonePlacement: false, highlightVertices: [],
        analysisType: '', showHumanPreference: false,
      },
      interactionProps: {
        dragMode: false, drawLineMode: null,
        areaSelectMode: false, transformation: [1, 0, 0, 1, 0, 0],
      },
      handlerProps: {
        onVertexClick: noop, onLineDraw: noop, onAreaSelect: noop,
        onStoneDragEnd: null, onPlayVariationMoves: null,
      },
    }

    const {container} = renderToDom(
      h(MainBoardStage, {mode: 'play', boardProps})
    )

    const root = container.querySelector('[data-testid="main-board-stage"]')
    assert.ok(root, 'Root element should exist')
    assert.ok(root.childNodes.length > 0, 'Should render child content when boardProps provided')
  })

  // --- T-4.1c: renders children when provided ---
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

  // --- T-4.1d: presentational — does not import services ---
  it('T-4.1d: does not import services, stores, or adapters', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync('src/components/workbench/shell/MainBoardStage.js', 'utf8')
    const forbidden = ['workbenchStore', 'trainingStore', 'recallService', 'attemptService',
      'documentStore', 'engineService', 'sabaki.js', 'window.sabaki']
    for (const pattern of forbidden) {
      assert.ok(!source.includes(pattern), `MainBoardStage must not import "${pattern}"`)
    }
  })
})
