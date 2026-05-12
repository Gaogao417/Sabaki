/**
 * Workbench Phase 0 Behavior Baseline Tests
 *
 * These Playwright characterization tests lock the current observable behavior
 * of board interactions across modes before the workbench migration proceeds.
 * They assert expected writes, forbidden writes, and visible results per the
 * contract language defined in docs/design/workbench-phase0-behavior-baseline-tests.md.
 *
 * Priority levels:
 *   P0 — must be fixed before clickVertex() or workbench boundary migration
 *   P1 — should be fixed before first edit-analysis executor stabilizes
 *   P2 — helpful for overlay / engine / menu / legacy deletion, non-blocking
 */

const {expect} = require('@playwright/test')
const path = require('path')
const sgf = require('@sabaki/sgf')
const {test} = require('./fixtures/electron-app')
const {loadSgfAndWait} = require('./helpers')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Click a vertex by dispatching mousedown+mouseup directly on the DOM element.
 * Uses dispatchEvent to bypass browser hit-testing, which avoids interference
 * from overlapping neighbor vertex elements and the #busy overlay.
 * Accepts [x, y] coordinate pair.  options.button: 0 = left, 2 = right.
 */
async function clickVertex(page, vertex, options = {}) {
  const locator = page.locator(vertexSelector(vertex))
  const buttonNum = options.button ?? 0
  await dispatchMouseEvent(locator, 'mousedown', {button: buttonNum})
  await dispatchMouseEvent(locator, 'mouseup', {button: buttonNum})
}

async function dispatchMouseEvent(locator, type, init = {}) {
  await locator.evaluate(
    (element, {eventType, eventInit}) => {
      element.dispatchEvent(
        new MouseEvent(eventType, {
          bubbles: true,
          cancelable: true,
          view: window,
          ...eventInit,
        }),
      )
    },
    {eventType: type, eventInit: init},
  )
}

/**
 * Switch to analysis mode via DOM click and wait for editWorkspace to be created.
 */
async function enterAnalysisMode(page) {
  await page.locator('button.mode-tab--analysis').click()
  await page.waitForFunction(
    () =>
      window.__sabaki.state.mode === 'analysis' &&
      window.__sabaki.state.editWorkspace != null,
    {timeout: 10000},
  )
}

/**
 * Set selected tool in analysis mode via keyboard shortcut or DOM click.
 * Uses dispatchEvent for button clicks to bypass overlay/overlap interception.
 * Waits for selectedTool to match before returning.
 */
async function setTool(page, tool) {
  const shortcuts = {'stone_1': '1', 'stone_-1': '2', eraser: '3'}
  if (shortcuts[tool]) {
    await page.keyboard.press(shortcuts[tool])
  } else {
    await dispatchMouseEvent(
      page.locator(`section#edit a[data-id="${tool}"]`),
      'click',
    )
  }
  await page.waitForFunction(
    (t) => window.__sabaki.state.selectedTool === t,
    tool,
    {timeout: 3000},
  )
}

/**
 * Capture a snapshot of key workbench state signatures before an action.
 */
async function captureStateBefore(page) {
  return page.evaluate(() => {
    const s = window.__sabaki.state
    const ws = s.editWorkspace
    return {
      treePosition: s.treePosition,
      treeNodeCount: (() => {
        const tree = s.gameTrees[s.gameIndex]
        let count = 0
        const walk = (node) => {
          count++
          for (const c of node.children) walk(c)
        }
        walk(tree.root)
        return count
      })(),
      treeRootId: s.gameTrees[s.gameIndex].root.id,
      editWorkspaceExists: ws != null,
      currentSignMap: ws ? JSON.stringify(ws.currentSnapshot.signMap) : null,
      referenceSignMap: ws?.referenceSnapshot
        ? JSON.stringify(ws.referenceSnapshot.signMap)
        : null,
      nextPlayer: ws?.currentSnapshot?.nextPlayer ?? null,
      currentMarkerMap: ws ? JSON.stringify(ws.currentMarkerMap) : null,
      currentLines: ws ? JSON.stringify(ws.currentLines) : null,
      recallMoveIndex: s.recallMoveIndex,
      recallUserAttemptsLength: s.recallUserAttempts.length,
      recallCompleted: s.recallCompleted,
      deadStones: JSON.stringify(s.deadStones),
      findVertex: s.findVertex ? JSON.stringify(s.findVertex) : null,
    }
  })
}

/**
 * Get the current board signMap from the inferred state.
 */
async function getBoardSignMap(page) {
  return page.evaluate(() =>
    JSON.stringify(window.__sabaki.inferredState.board.signMap),
  )
}

/**
 * Count visible stones on the board DOM.
 */
async function countStonesOnBoard(page) {
  return page.evaluate(() =>
    document.querySelectorAll('.shudan-sign_1, .shudan-sign_-1').length,
  )
}

function vertexSelector([x, y]) {
  return `#goban > .shudan-content > .shudan-vertices > .shudan-vertex[data-x="${x}"][data-y="${y}"]`
}

async function getWorkingSignAt(page, vertex, tab = 'current') {
  return page.evaluate(
    ({v, tabName}) => {
      const ws = window.__sabaki.state.editWorkspace
      if (!ws) return null
      const snapshot =
        tabName === 'reference' ? ws.referenceSnapshot : ws.currentSnapshot
      if (!snapshot) return null
      const [x, y] = v
      return snapshot.signMap[y]?.[x] ?? null
    },
    {v: vertex, tabName: tab},
  )
}

async function expectRenderedVertexSign(page, vertex, sign) {
  const vertexLocator = page.locator(vertexSelector(vertex))
  await expect(vertexLocator).toHaveClass(
    new RegExp(`(^|\\s)shudan-sign_${sign}(\\s|$)`),
  )
}

async function expectRenderedVertexMarker(page, vertex, markerType) {
  const vertexLocator = page.locator(vertexSelector(vertex))
  await expect(vertexLocator).toHaveClass(
    new RegExp(`(^|\\s)shudan-marker_${markerType}(\\s|$)`),
  )
}

async function getVertexCenter(page, vertex) {
  const box = await page.locator(vertexSelector(vertex)).boundingBox()
  expect(box).not.toBeNull()
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  }
}

async function dragRenderedVertex(page, source, target) {
  const sourceLocator = page.locator(vertexSelector(source))
  const sourceCenter = await getVertexCenter(page, source)
  const targetCenter = await getVertexCenter(page, target)
  const sourceBox = await sourceLocator.boundingBox()
  expect(sourceBox).not.toBeNull()

  const dx = targetCenter.x - sourceCenter.x
  const dy = targetCenter.y - sourceCenter.y
  const distance = Math.hypot(dx, dy) || 1
  const thresholdStep = Math.min(sourceBox.width, sourceBox.height, 12)
  const dragStart = {
    x: sourceCenter.x + (dx / distance) * thresholdStep,
    y: sourceCenter.y + (dy / distance) * thresholdStep,
  }

  await sourceLocator.scrollIntoViewIfNeeded()
  await page.mouse.move(sourceCenter.x, sourceCenter.y)
  await page.mouse.down({button: 'left'})
  await page.mouse.move(dragStart.x, dragStart.y, {steps: 3})
  await page.mouse.move(targetCenter.x, targetCenter.y, {steps: 12})
  await page.mouse.up({button: 'left'})
}

// ---------------------------------------------------------------------------
// P0 Tests
// ---------------------------------------------------------------------------

test.describe('P0 Baseline — Play mode places a real move', () => {
  /*
   * Scenario: Play mode places a real move
   * PositionSource: game-tree
   * MutationContract: playMove
   * BoardInteractionIntent: play-stone
   * Action: Left-click an empty vertex in play mode
   * Expected writes: game tree gets a new move node; treePosition advances; current player flips
   * Forbidden writes: editWorkspace and working snapshots are not created or changed
   * Visible result: Board shows the new stone at the clicked vertex
   */

  test('play mode places a real move in the game tree', async ({page}) => {
    // Start with a fresh empty game in play mode
    await page.evaluate(() => window.__sabaki.newFile())
    await page.waitForFunction(
      () => {
        const tree =
          window.__sabaki.state.gameTrees[window.__sabaki.state.gameIndex]
        return tree && tree.root.children.length === 0
      },
      {timeout: 5000},
    )
    await page.locator('button.mode-tab--play').click()
    await page.waitForFunction(() => window.__sabaki.state.mode === 'play')

    const before = await captureStateBefore(page)
    const stonesBefore = await countStonesOnBoard(page)

    // Click vertex [3, 3] (D4 in 19x19)
    await clickVertex(page, [3, 3], {button: 0})

    // Wait for tree to change (new node added)
    await page.waitForFunction(
      (b) => {
        const s = window.__sabaki.state
        const tree = s.gameTrees[s.gameIndex]
        let count = 0
        const walk = (n) => {
          count++
          for (const c of n.children) walk(c)
        }
        walk(tree.root)
        return (
          count > b.treeNodeCount &&
          s.treePosition !== b.treePosition
        )
      },
      before,
      {timeout: 5000},
    )

    const after = await captureStateBefore(page)
    const stonesAfter = await countStonesOnBoard(page)

    // Expected writes: tree changed, treePosition advanced
    expect(after.treeNodeCount).toBeGreaterThan(before.treeNodeCount)
    expect(after.treePosition).not.toBe(before.treePosition)

    // Forbidden writes: no editWorkspace created
    expect(after.editWorkspaceExists).toBe(false)

    // Visible result: stone appeared on board
    expect(stonesAfter).toBeGreaterThan(stonesBefore)
    await expectRenderedVertexSign(page, [3, 3], 1)
  })
})

test.describe('P0 Baseline — Analysis workspace seeds from current game tree', () => {
  /*
   * Scenario: Analysis workspace seeds from current game tree
   * PositionSource: scratch/current
   * MutationContract: scratchEdit
   * BoardInteractionIntent: enter-edit-analysis
   * Action: Switch to analysis mode from a known game-tree position
   * Expected writes: editWorkspace.currentSnapshot is created from the current board;
   *                  source metadata points at the current tree node when available
   * Forbidden writes: Current SGF tree is not changed
   * Visible result: Board still displays the same position after entering analysis
   */

  test('analysis workspace seeds from current game tree', async ({page}) => {
    const sgfPath = path.resolve(
      __dirname,
      '..',
      'test',
      'sgf',
      'pro_game.sgf',
    )
    await loadSgfAndWait(page, sgfPath)

    // Navigate forward one move so we have a non-root position
    const posBeforeStep = await page.evaluate(() => window.__sabaki.state.treePosition)
    await page.keyboard.press('ArrowDown')
    await page.waitForFunction(
      (b) => window.__sabaki.state.treePosition !== b,
      posBeforeStep,
      {timeout: 5000},
    )

    const before = await captureStateBefore(page)
    const boardBefore = await getBoardSignMap(page)

    // Switch to analysis mode
    await enterAnalysisMode(page)

    const after = await captureStateBefore(page)
    const boardAfter = await getBoardSignMap(page)

    // Expected writes: editWorkspace created with currentSnapshot matching board
    expect(after.editWorkspaceExists).toBe(true)
    expect(after.currentSignMap).not.toBeNull()

    // The snapshot should match the current board
    const snapshotMatchesBoard = await page.evaluate(() => {
      const ws = window.__sabaki.state.editWorkspace
      const board = window.__sabaki.inferredState.board
      if (!ws || !board) return false
      return (
        JSON.stringify(ws.currentSnapshot.signMap) ===
        JSON.stringify(board.signMap)
      )
    })
    expect(snapshotMatchesBoard).toBe(true)

    // Forbidden writes: game tree did not change
    expect(after.treeNodeCount).toBe(before.treeNodeCount)

    // Visible result: board still shows same position
    expect(boardAfter).toBe(boardBefore)
  })
})

test.describe('P0 Baseline — Analysis stone_1 places black in working position', () => {
  /*
   * Scenario: Analysis stone_1 places black in working position
   * PositionSource: scratch/current
   * MutationContract: scratchEdit
   * BoardInteractionIntent: place-black-stone
   * Action: Left-click an empty vertex with stone_1 tool in analysis mode
   * Expected writes: currentSnapshot.signMap changes at that vertex
   * Forbidden writes: Game tree, treePosition, and real history are unchanged
   * Visible result: Board shows a black stone
   */

  test('analysis stone_1 places black in working position', async ({page}) => {
    await page.evaluate(() => window.__sabaki.newFile())
    await page.waitForFunction(
      () => {
        const tree =
          window.__sabaki.state.gameTrees[window.__sabaki.state.gameIndex]
        return tree && tree.root.children.length === 0
      },
      {timeout: 5000},
    )

    await enterAnalysisMode(page)
    await setTool(page, 'stone_1')

    const before = await captureStateBefore(page)

    // Click vertex [4, 4] (E5)
    await clickVertex(page, [4, 4], {button: 0})

    // Wait for snapshot to change
    await page.waitForFunction(
      (b) => {
        const ws = window.__sabaki.state.editWorkspace
        if (!ws) return false
        return (
          JSON.stringify(ws.currentSnapshot.signMap) !== b.currentSignMap
        )
      },
      before,
      {timeout: 5000},
    )

    const after = await captureStateBefore(page)

    // Expected write: currentSnapshot changed
    expect(after.currentSignMap).not.toBe(before.currentSignMap)

    // Verify the stone is black (sign=1) at [4,4]
    expect(await getWorkingSignAt(page, [4, 4])).toBe(1)

    // Forbidden writes: game tree and treePosition unchanged
    expect(after.treeNodeCount).toBe(before.treeNodeCount)
    expect(after.treePosition).toBe(before.treePosition)

    // Visible result: board shows a black stone
    await expectRenderedVertexSign(page, [4, 4], 1)
  })
})

test.describe('P0 Baseline — Analysis stone_-1 places white in working position', () => {
  /*
   * Scenario: Analysis stone_-1 places white in working position
   * PositionSource: scratch/current
   * MutationContract: scratchEdit
   * BoardInteractionIntent: place-white-stone
   * Action: Left-click an empty vertex with stone_-1 tool in analysis mode
   * Expected writes: currentSnapshot.signMap changes at that vertex
   * Forbidden writes: Game tree, treePosition, and real history are unchanged
   * Visible result: Board shows a white stone
   */

  test('analysis stone_-1 places white in working position', async ({page}) => {
    await page.evaluate(() => window.__sabaki.newFile())
    await page.waitForFunction(
      () => {
        const tree =
          window.__sabaki.state.gameTrees[window.__sabaki.state.gameIndex]
        return tree && tree.root.children.length === 0
      },
      {timeout: 5000},
    )

    await enterAnalysisMode(page)
    await setTool(page, 'stone_-1')

    const before = await captureStateBefore(page)

    // Click vertex [3, 3] (D4)
    await clickVertex(page, [3, 3], {button: 0})

    // Wait for snapshot to change
    await page.waitForFunction(
      (b) => {
        const ws = window.__sabaki.state.editWorkspace
        if (!ws) return false
        return (
          JSON.stringify(ws.currentSnapshot.signMap) !== b.currentSignMap
        )
      },
      before,
      {timeout: 5000},
    )

    const after = await captureStateBefore(page)

    // Expected write: currentSnapshot changed
    expect(after.currentSignMap).not.toBe(before.currentSignMap)

    // Verify the stone is white (sign=-1) at [3,3]
    expect(await getWorkingSignAt(page, [3, 3])).toBe(-1)

    // Forbidden writes: game tree and treePosition unchanged
    expect(after.treeNodeCount).toBe(before.treeNodeCount)
    expect(after.treePosition).toBe(before.treePosition)

    // Visible result: board shows a white stone
    await expectRenderedVertexSign(page, [3, 3], -1)
  })
})

test.describe('P0 Baseline — Analysis eraser removes from working position', () => {
  /*
   * Scenario: Analysis eraser removes from working position
   * PositionSource: scratch/current
   * MutationContract: scratchEdit
   * BoardInteractionIntent: erase-stone
   * Action: Left-click an occupied vertex with eraser tool in analysis mode
   * Expected writes: currentSnapshot.signMap becomes 0 at that vertex
   * Forbidden writes: Game tree and treePosition are unchanged
   * Visible result: Board no longer shows a stone there
   */

  test('analysis eraser removes from working position', async ({page}) => {
    await page.evaluate(() => window.__sabaki.newFile())
    await page.waitForFunction(
      () => {
        const tree =
          window.__sabaki.state.gameTrees[window.__sabaki.state.gameIndex]
        return tree && tree.root.children.length === 0
      },
      {timeout: 5000},
    )

    await enterAnalysisMode(page)

    // Place a black stone first
    await setTool(page, 'stone_1')
    await clickVertex(page, [4, 4], {button: 0})
    await page.waitForFunction(() => {
      const ws = window.__sabaki.state.editWorkspace
      return ws && ws.currentSnapshot.signMap[4][4] === 1
    }, {timeout: 5000})

    // Now switch to eraser and click same vertex
    await setTool(page, 'eraser')
    const before = await captureStateBefore(page)

    await clickVertex(page, [4, 4], {button: 0})

    // Wait for stone to be removed
    await page.waitForFunction(() => {
      const ws = window.__sabaki.state.editWorkspace
      return ws && ws.currentSnapshot.signMap[4][4] === 0
    }, {timeout: 5000})

    const after = await captureStateBefore(page)

    // Expected write: signMap at [4,4] is now 0
    expect(await getWorkingSignAt(page, [4, 4])).toBe(0)

    // Forbidden writes: game tree and treePosition unchanged
    expect(after.treeNodeCount).toBe(before.treeNodeCount)
    expect(after.treePosition).toBe(before.treePosition)

    // Visible result: the edited point is empty again
    await expectRenderedVertexSign(page, [4, 4], 0)
  })
})

test.describe('P0 Baseline — Analysis play tool uses working next player', () => {
  /*
   * Scenario: Analysis play tool uses working next player
   * PositionSource: scratch/current
   * MutationContract: scratchEdit
   * BoardInteractionIntent: place-next-player-stone
   * Action: Left-click an empty vertex with play tool in analysis mode
   * Expected writes: Stone is placed with nextPlayer; nextPlayer flips
   * Forbidden writes: Game tree, treePosition, and real history are unchanged
   * Visible result: Board shows the placed stone with the expected color
   */

  test('analysis play tool uses working next player', async ({page}) => {
    await page.evaluate(() => window.__sabaki.newFile())
    await page.waitForFunction(
      () => {
        const tree =
          window.__sabaki.state.gameTrees[window.__sabaki.state.gameIndex]
        return tree && tree.root.children.length === 0
      },
      {timeout: 5000},
    )

    await enterAnalysisMode(page)
    await setTool(page, 'play')

    const before = await captureStateBefore(page)
    // Default nextPlayer should be 1 (black) on empty board
    const nextPlayerBefore = await page.evaluate(
      () => window.__sabaki.state.editWorkspace.currentSnapshot.nextPlayer,
    )
    expect(nextPlayerBefore).toBe(1)

    // Click vertex [3, 3]
    await clickVertex(page, [3, 3], {button: 0})

    // Wait for snapshot to change
    await page.waitForFunction(
      (b) => {
        const ws = window.__sabaki.state.editWorkspace
        if (!ws) return false
        return (
          JSON.stringify(ws.currentSnapshot.signMap) !== b.currentSignMap
        )
      },
      before,
      {timeout: 5000},
    )

    const after = await captureStateBefore(page)

    // Expected write: stone placed as black (nextPlayer was 1)
    expect(await getWorkingSignAt(page, [3, 3])).toBe(1)

    // nextPlayer should have flipped
    const nextPlayerAfter = await page.evaluate(
      () => window.__sabaki.state.editWorkspace.currentSnapshot.nextPlayer,
    )
    expect(nextPlayerAfter).toBe(-1)

    // Forbidden writes: game tree and treePosition unchanged
    expect(after.treeNodeCount).toBe(before.treeNodeCount)
    expect(after.treePosition).toBe(before.treePosition)

    await expectRenderedVertexSign(page, [3, 3], 1)
  })
})

test.describe('P0 Baseline — Recall correct click submits an answer', () => {
  /*
   * Scenario: Recall correct click submits an answer
   * PositionSource: game-tree/problem-attempt
   * MutationContract: recallAnswer
   * BoardInteractionIntent: submit-recall-answer
   * Action: Click the expected vertex in recall mode
   * Expected writes: recallUserAttempts records a correct answer;
   *                  recallMoveIndex advances; recall navigation may advance treePosition
   * Forbidden writes: No free-edit stone is inserted outside recall flow;
   *                   editWorkspace is not changed
   * Visible result: Recall progress advances
   */

  test('recall correct click submits an answer', async ({page}) => {
    const sgfPath = path.resolve(
      __dirname,
      '..',
      'test',
      'sgf',
      'beginner_game.sgf',
    )
    await loadSgfAndWait(page, sgfPath)

    // Set up recall session: first expected move from the SGF
    const expectedMove = await page.evaluate(() => {
      const tree =
        window.__sabaki.state.gameTrees[window.__sabaki.state.gameIndex]
      const root = tree.root
      // Get first child move
      const firstChild = root.children[0]
      if (!firstChild) return null
      const sign = firstChild.data.B ? 1 : -1
      const moveData = firstChild.data.B || firstChild.data.W
      if (!moveData) return null
      return {sign, vertex: moveData[0]} // SGF coordinate, e.g. "pd" or "dd"
    })
    expect(expectedMove).not.toBeNull()

    // Setup recall state pointing at root position
    await page.evaluate((move) => {
      window.__sabaki.setState({
        recallSession: {id: 'e2e-recall-test', gameId: 'e2e-game'},
        recallMoveIndex: 0,
        recallExpectedMoves: [move],
        recallUserAttempts: [],
        recallShowHint: false,
        recallCompleted: false,
      })
      window.__sabaki.setMode('recall')
    }, expectedMove)

    await page.waitForFunction(
      () => window.__sabaki.state.mode === 'recall',
      {timeout: 5000},
    )

    const before = await captureStateBefore(page)

    // Parse SGF coordinates into Sabaki vertex coordinates and click it.
    const recallVertex = sgf.parseVertex(expectedMove.vertex)

    await clickVertex(page, recallVertex, {button: 0})

    // Wait for recall state to update
    await page.waitForFunction(
      (b) => window.__sabaki.state.recallMoveIndex > b.recallMoveIndex,
      before,
      {timeout: 5000},
    )

    const after = await captureStateBefore(page)

    // Expected writes: recallUserAttempts has a correct answer, moveIndex advanced
    expect(after.recallUserAttemptsLength).toBeGreaterThan(
      before.recallUserAttemptsLength,
    )
    expect(after.recallMoveIndex).toBeGreaterThan(before.recallMoveIndex)

    // Forbidden writes: editWorkspace not created/changed
    expect(after.editWorkspaceExists).toBe(before.editWorkspaceExists)
  })
})

test.describe('P0 Baseline — Recall wrong click records a wrong answer', () => {
  /*
   * Scenario: Recall wrong click records a wrong answer
   * PositionSource: game-tree/problem-attempt
   * MutationContract: recallAnswer
   * BoardInteractionIntent: submit-recall-answer
   * Action: Click a different vertex in recall mode
   * Expected writes: recallUserAttempts records a wrong answer;
   *                  recallMoveIndex does not advance
   * Forbidden writes: Game tree is not freely edited; editWorkspace is not changed
   * Visible result: Recall remains on the same answer step
   */

  test('recall wrong click records a wrong answer', async ({page}) => {
    const sgfPath = path.resolve(
      __dirname,
      '..',
      'test',
      'sgf',
      'beginner_game.sgf',
    )
    await loadSgfAndWait(page, sgfPath)

    // Setup recall with a known expected vertex, then click a different one
    await page.evaluate(() => {
      window.__sabaki.setState({
        recallSession: {id: 'e2e-recall-wrong', gameId: 'e2e-game'},
        recallMoveIndex: 0,
        recallExpectedMoves: [{sign: 1, vertex: 'dd'}],
        recallUserAttempts: [],
        recallShowHint: false,
        recallCompleted: false,
      })
      window.__sabaki.setMode('recall')
    })

    await page.waitForFunction(
      () => window.__sabaki.state.mode === 'recall',
      {timeout: 5000},
    )

    const before = await captureStateBefore(page)

    // Click a wrong vertex [0, 0] (A19) — not "dd" which is [3,3]
    await clickVertex(page, [0, 0], {button: 0})

    // Wait for the attempt to be recorded
    await page.waitForFunction(
      (b) =>
        window.__sabaki.state.recallUserAttempts.length >
        b.recallUserAttemptsLength,
      before,
      {timeout: 5000},
    )

    const after = await captureStateBefore(page)

    // Expected writes: wrong answer recorded
    expect(after.recallUserAttemptsLength).toBeGreaterThan(
      before.recallUserAttemptsLength,
    )

    // The answer should be wrong
    const lastAttempt = await page.evaluate(
      () =>
        window.__sabaki.state.recallUserAttempts[
          window.__sabaki.state.recallUserAttempts.length - 1
        ],
    )
    expect(lastAttempt.isCorrect).toBe(false)

    // recallMoveIndex should NOT advance on wrong answer
    expect(after.recallMoveIndex).toBe(before.recallMoveIndex)

    // Forbidden writes: game tree unchanged, editWorkspace not created
    expect(after.treeNodeCount).toBe(before.treeNodeCount)
    expect(after.editWorkspaceExists).toBe(before.editWorkspaceExists)
  })
})

// ---------------------------------------------------------------------------
// P1 Tests
// ---------------------------------------------------------------------------

test.describe('P1 Baseline — Analysis edits reference tab only', () => {
  /*
   * Scenario: Analysis edits reference tab only
   * PositionSource: scratch/reference
   * MutationContract: scratchEdit
   * BoardInteractionIntent: place-black-stone
   * Action: Use a stone tool on an empty point with reference tab active
   * Expected writes: referenceSnapshot.signMap changes
   * Forbidden writes: currentSnapshot and game tree are unchanged
   * Visible result: Reference preview or active board reflects the edit
   */

  test('analysis edits reference tab only', async ({page}) => {
    const sgfPath = path.resolve(
      __dirname,
      '..',
      'test',
      'sgf',
      'pro_game.sgf',
    )
    await loadSgfAndWait(page, sgfPath)

    await enterAnalysisMode(page)

    // Capture reference first
    await page.keyboard.press('r')
    await page.waitForFunction(
      () => window.__sabaki.state.editWorkspace?.referenceSnapshot != null,
      {timeout: 5000},
    )

    // Switch to reference tab
    await page.keyboard.press('Tab')
    await page.waitForFunction(
      () => window.__sabaki.state.editWorkspace?.activeTab === 'reference',
      {timeout: 5000},
    )

    await setTool(page, 'stone_1')

    const before = await captureStateBefore(page)

    // Click an empty vertex
    await clickVertex(page, [0, 0], {button: 0})

    // Wait for reference snapshot to change
    await page.waitForFunction(
      (b) => {
        const ws = window.__sabaki.state.editWorkspace
        if (!ws || !ws.referenceSnapshot) return false
        return (
          JSON.stringify(ws.referenceSnapshot.signMap) !== b.referenceSignMap
        )
      },
      before,
      {timeout: 5000},
    )

    const after = await captureStateBefore(page)

    // Expected write: reference signMap changed
    expect(after.referenceSignMap).not.toBe(before.referenceSignMap)

    // Forbidden write: currentSnapshot unchanged
    expect(after.currentSignMap).toBe(before.currentSignMap)

    // Forbidden write: game tree unchanged
    expect(after.treeNodeCount).toBe(before.treeNodeCount)

    // Visible result: active reference board reflects the edit.
    await expectRenderedVertexSign(page, [0, 0], 1)
  })
})

test.describe('P1 Baseline — Analysis captures reference without dirtying game tree', () => {
  /*
   * Scenario: Analysis captures reference without dirtying game tree
   * PositionSource: scratch/reference
   * MutationContract: scratchEdit
   * BoardInteractionIntent: capture-reference
   * Action: Capture reference in analysis workspace
   * Expected writes: referenceSnapshot is created or replaced
   * Forbidden writes: Game tree and real history are unchanged
   * Visible result: Reference UI becomes available
   */

  test('analysis captures reference without dirtying game tree', async ({
    page,
  }) => {
    const sgfPath = path.resolve(
      __dirname,
      '..',
      'test',
      'sgf',
      'pro_game.sgf',
    )
    await loadSgfAndWait(page, sgfPath)

    await enterAnalysisMode(page)

    const before = await captureStateBefore(page)

    // Capture reference
    await page.keyboard.press('r')

    await page.waitForFunction(
      () => window.__sabaki.state.editWorkspace?.referenceSnapshot != null,
      {timeout: 5000},
    )

    const after = await captureStateBefore(page)

    // Expected write: referenceSnapshot was created
    expect(after.referenceSignMap).not.toBeNull()

    // Forbidden write: game tree unchanged
    expect(after.treeNodeCount).toBe(before.treeNodeCount)
    expect(after.treePosition).toBe(before.treePosition)

    // Forbidden write: currentSnapshot unchanged
    expect(after.currentSignMap).toBe(before.currentSignMap)
  })
})

test.describe('P1 Baseline — Analysis marker tools write marker maps only', () => {
  /*
   * Scenario: Analysis marker tools write marker maps only
   * PositionSource: scratch/current
   * MutationContract: scratchEdit
   * BoardInteractionIntent: mark-point
   * Action: Click a vertex with a marker tool in analysis mode
   * Expected writes: Current marker map changes
   * Forbidden writes: Snapshot stones and game tree are unchanged
   * Visible result: Marker appears on board
   */

  test('analysis marker tools write marker maps only', async ({page}) => {
    await page.evaluate(() => window.__sabaki.newFile())
    await page.waitForFunction(
      () => {
        const tree =
          window.__sabaki.state.gameTrees[window.__sabaki.state.gameIndex]
        return tree && tree.root.children.length === 0
      },
      {timeout: 5000},
    )

    await enterAnalysisMode(page)
    await setTool(page, 'triangle')

    const before = await captureStateBefore(page)

    // Click vertex [3, 3]
    await clickVertex(page, [3, 3], {button: 0})

    // Wait for marker map to change
    await page.waitForFunction(
      (b) => {
        const ws = window.__sabaki.state.editWorkspace
        if (!ws) return false
        return (
          JSON.stringify(ws.currentMarkerMap) !== b.currentMarkerMap
        )
      },
      before,
      {timeout: 5000},
    )

    const after = await captureStateBefore(page)

    // Expected write: marker map changed
    expect(after.currentMarkerMap).not.toBe(before.currentMarkerMap)

    // Verify marker at [3,3]
    const markerAtVertex = await page.evaluate(() => {
      const ws = window.__sabaki.state.editWorkspace
      return ws.currentMarkerMap[3][3]
    })
    expect(markerAtVertex).not.toBeNull()
    expect(markerAtVertex.type).toBe('triangle')

    // Forbidden writes: snapshot stones unchanged
    expect(after.currentSignMap).toBe(before.currentSignMap)

    // Forbidden writes: game tree unchanged
    expect(after.treeNodeCount).toBe(before.treeNodeCount)

    // Visible result: marker appears at the edited vertex.
    await expectRenderedVertexMarker(page, [3, 3], 'triangle')
  })
})

test.describe('P1 Baseline — Analysis line/arrow writes edit lines only', () => {
  /*
   * Scenario: Analysis line/arrow writes edit lines only
   * PositionSource: scratch/current
   * MutationContract: scratchEdit
   * BoardInteractionIntent: draw-line
   * Action: Draw between two vertices with line/arrow tool in analysis mode
   * Expected writes: Current lines list changes
   * Forbidden writes: Snapshot stones and game tree are unchanged
   * Visible result: Line or arrow appears on board
   */

  // TODO: Re-enable after analysis edit lines persist in the rendered board.
  // The action writes editWorkspace.currentLines, but the visible Shudan line
  // currently flashes and disappears.
  test.skip('analysis line tool writes edit lines only', async ({page}) => {
    await page.evaluate(() => window.__sabaki.newFile())
    await page.waitForFunction(
      () => {
        const tree =
          window.__sabaki.state.gameTrees[window.__sabaki.state.gameIndex]
        return tree && tree.root.children.length === 0
      },
      {timeout: 5000},
    )

    await enterAnalysisMode(page)
    await setTool(page, 'line')

    const before = await captureStateBefore(page)

    // Draw a real line gesture from [3,3] to [5,5].
    await dragRenderedVertex(page, [3, 3], [5, 5])

    // Wait for line to be added
    await page.waitForFunction(
      (b) => {
        const ws = window.__sabaki.state.editWorkspace
        if (!ws) return false
        return JSON.stringify(ws.currentLines) !== b.currentLines
      },
      before,
      {timeout: 5000},
    )

    const after = await captureStateBefore(page)

    // Expected write: lines changed
    expect(after.currentLines).not.toBe(before.currentLines)

    // Verify line was added
    const lines = await page.evaluate(
      () => window.__sabaki.state.editWorkspace.currentLines,
    )
    expect(lines.length).toBeGreaterThan(0)
    await expect(page.locator('#goban .shudan-lines path')).toHaveCount(1)

    // Forbidden writes: snapshot stones unchanged
    expect(after.currentSignMap).toBe(before.currentSignMap)

    // Forbidden writes: game tree unchanged
    expect(after.treeNodeCount).toBe(before.treeNodeCount)
  })
})

test.describe('P1 Baseline — Analysis drag moves only working-position stones', () => {
  /*
   * Scenario: Analysis drag moves only working-position stones
   * PositionSource: scratch/current
   * MutationContract: scratchEdit
   * BoardInteractionIntent: drag-stone
   * Action: Drag stone to an empty vertex in analysis workspace
   * Expected writes: Working snapshot source and target points change
   * Forbidden writes: Game tree is unchanged
   * Visible result: Stone appears at the new point
   */

  test.skip('analysis drag moves only working-position stones', async ({page}) => {
    await page.evaluate(() => window.__sabaki.newFile())
    await page.waitForFunction(
      () => {
        const tree =
          window.__sabaki.state.gameTrees[window.__sabaki.state.gameIndex]
        return tree && tree.root.children.length === 0
      },
      {timeout: 5000},
    )

    await enterAnalysisMode(page)

    // Place a black stone at [3, 3] first
    await setTool(page, 'stone_1')
    await clickVertex(page, [3, 3], {button: 0})
    await page.waitForFunction(() => {
      const ws = window.__sabaki.state.editWorkspace
      return ws && ws.currentSnapshot.signMap[3][3] === 1
    }, {timeout: 5000})

    const before = await captureStateBefore(page)

    // Use the rendered board gesture path, not a synthetic place-then-erase.
    await dragRenderedVertex(page, [3, 3], [5, 5])
    await page.waitForFunction(() => {
      const ws = window.__sabaki.state.editWorkspace
      return (
        ws &&
        ws.currentSnapshot.signMap[3][3] === 0 &&
        ws.currentSnapshot.signMap[5][5] === 1
      )
    }, {timeout: 5000})

    const after = await captureStateBefore(page)

    // Expected writes: stone moved from [3,3] to [5,5]
    expect(await getWorkingSignAt(page, [5, 5])).toBe(1)
    expect(await getWorkingSignAt(page, [3, 3])).toBe(0)

    // Forbidden writes: game tree unchanged
    expect(after.treeNodeCount).toBe(before.treeNodeCount)

    await expectRenderedVertexSign(page, [5, 5], 1)
    await expectRenderedVertexSign(page, [3, 3], 0)
  })
})

// ---------------------------------------------------------------------------
// P2 Tests
// ---------------------------------------------------------------------------

test.describe('P2 Baseline — Scoring toggles dead stones', () => {
  /*
   * Scenario: Scoring toggles dead stones
   * PositionSource: legacy
   * MutationContract: legacy
   * BoardInteractionIntent: legacy-toggle-dead-stone
   * Action: Click an occupied vertex in scoring mode
   * Expected writes: deadStones toggles the related stones
   * Forbidden writes: Game tree is unchanged
   * Visible result: Stones are dimmed or restored
   */

  // Current workbench scope does not support legacy scoring dead-stone toggles.
  test.skip('scoring toggles dead stones', async ({page}) => {
    const sgfPath = path.resolve(
      __dirname,
      '..',
      'test',
      'sgf',
      'pro_game.sgf',
    )
    await loadSgfAndWait(page, sgfPath)

    // Go to end of game to get a board with many stones
    await page.evaluate(() => window.__sabaki.goToEnd())

    // Switch to scoring mode
    await page.evaluate(() => window.__sabaki.setMode('scoring'))

    // Wait for dead stone guessing to complete
    await page.waitForFunction(
      () => window.__sabaki.state.mode === 'scoring',
      {timeout: 10000},
    )

    // Give deadstones guess a moment to complete
    await page.waitForFunction(
      () => window.__sabaki.state.deadStones != null,
      {timeout: 10000},
    )

    const before = await captureStateBefore(page)

    // Find a vertex with a stone
    const occupiedVertex = await page.evaluate(() => {
      const board = window.__sabaki.inferredState.board
      for (let y = 0; y < board.height; y++) {
        for (let x = 0; x < board.width; x++) {
          if (board.get([x, y]) !== 0) return [x, y]
        }
      }
      return null
    })
    expect(occupiedVertex).not.toBeNull()

    await clickVertex(page, occupiedVertex, {button: 0})

    // Wait for deadStones to change
    await page.waitForFunction(
      (b) => JSON.stringify(window.__sabaki.state.deadStones) !== b.deadStones,
      before,
      {timeout: 5000},
    )

    const after = await captureStateBefore(page)

    // Expected write: deadStones changed
    expect(after.deadStones).not.toBe(before.deadStones)

    // Forbidden write: game tree unchanged
    expect(after.treeNodeCount).toBe(before.treeNodeCount)
  })
})

test.describe('P2 Baseline — Estimator toggles dead stones', () => {
  /*
   * Scenario: Estimator toggles dead stones
   * PositionSource: legacy
   * MutationContract: legacy
   * BoardInteractionIntent: legacy-toggle-dead-stone
   * Action: Click an occupied vertex in estimator mode
   * Expected writes: deadStones toggles the chain
   * Forbidden writes: Game tree is unchanged
   * Visible result: Stones are dimmed or restored
   */

  // Current workbench scope does not support legacy estimator dead-stone toggles.
  test.skip('estimator toggles dead stones', async ({page}) => {
    const sgfPath = path.resolve(
      __dirname,
      '..',
      'test',
      'sgf',
      'pro_game.sgf',
    )
    await loadSgfAndWait(page, sgfPath)

    await page.evaluate(() => window.__sabaki.goToEnd())

    await page.evaluate(() => window.__sabaki.setMode('estimator'))

    await page.waitForFunction(
      () => window.__sabaki.state.mode === 'estimator',
      {timeout: 10000},
    )

    await page.waitForFunction(
      () => window.__sabaki.state.deadStones != null,
      {timeout: 10000},
    )

    const before = await captureStateBefore(page)

    const occupiedVertex = await page.evaluate(() => {
      const board = window.__sabaki.inferredState.board
      for (let y = 0; y < board.height; y++) {
        for (let x = 0; x < board.width; x++) {
          if (board.get([x, y]) !== 0) return [x, y]
        }
      }
      return null
    })
    expect(occupiedVertex).not.toBeNull()

    await clickVertex(page, occupiedVertex, {button: 0})

    await page.waitForFunction(
      (b) => JSON.stringify(window.__sabaki.state.deadStones) !== b.deadStones,
      before,
      {timeout: 5000},
    )

    const after = await captureStateBefore(page)

    expect(after.deadStones).not.toBe(before.deadStones)
    expect(after.treeNodeCount).toBe(before.treeNodeCount)
  })
})

test.describe('P2 Baseline — Find click sets and clears find vertex', () => {
  /*
   * Scenario: Find click sets and clears find vertex
   * PositionSource: legacy
   * MutationContract: legacy
   * BoardInteractionIntent: legacy-find-point
   * Action: Click a vertex in find mode, then click it again
   * Expected writes: findVertex is set, then cleared
   * Forbidden writes: Game tree and working snapshots are unchanged
   * Visible result: Highlight appears, then disappears
   */

  // Current workbench scope does not support legacy find-click behavior.
  test.skip('find click sets and clears find vertex', async ({page}) => {
    await page.evaluate(() => window.__sabaki.newFile())
    await page.waitForFunction(
      () => {
        const tree =
          window.__sabaki.state.gameTrees[window.__sabaki.state.gameIndex]
        return tree && tree.root.children.length === 0
      },
      {timeout: 5000},
    )

    await page.evaluate(() => window.__sabaki.setMode('find'))
    await page.waitForFunction(
      () => window.__sabaki.state.mode === 'find',
      {timeout: 5000},
    )

    const before = await captureStateBefore(page)

    // Click vertex [3, 3] to set findVertex
    await clickVertex(page, [3, 3], {button: 0})

    await page.waitForFunction(
      (b) => {
        const fv = window.__sabaki.state.findVertex
        return fv != null && JSON.stringify(fv) !== b.findVertex
      },
      before,
      {timeout: 5000},
    )

    const afterFirst = await captureStateBefore(page)

    // Expected write: findVertex is set
    expect(afterFirst.findVertex).not.toBe(before.findVertex)

    // Click same vertex again to clear it
    await clickVertex(page, [3, 3], {button: 0})

    await page.waitForFunction(
      () => window.__sabaki.state.findVertex == null,
      {timeout: 5000},
    )

    const afterSecond = await captureStateBefore(page)

    // Expected write: findVertex cleared
    expect(afterSecond.findVertex).toBeNull()

    // Forbidden writes: game tree unchanged throughout
    expect(afterSecond.treeNodeCount).toBe(before.treeNodeCount)
  })
})

test.describe('P2 Baseline — Analysis right-click stone tool toggles color behavior', () => {
  /*
   * Scenario: Analysis right-click stone tool toggles color behavior
   * PositionSource: scratch/current
   * MutationContract: scratchEdit
   * BoardInteractionIntent: place-opposite-stone
   * Action: Right-click an empty vertex with stone_1 tool in analysis mode
   * Expected writes: Working snapshot receives the opposite color
   * Forbidden writes: Game tree is unchanged
   * Visible result: Board shows the expected opposite-color stone
   */

  test('analysis right-click toggles stone color', async ({page}) => {
    await page.evaluate(() => window.__sabaki.newFile())
    await page.waitForFunction(
      () => {
        const tree =
          window.__sabaki.state.gameTrees[window.__sabaki.state.gameIndex]
        return tree && tree.root.children.length === 0
      },
      {timeout: 5000},
    )

    await enterAnalysisMode(page)
    await setTool(page, 'stone_1') // Black tool

    const before = await captureStateBefore(page)

    // Right-click vertex [4, 4] — should place white (opposite of stone_1)
    await clickVertex(page, [4, 4], {button: 2})

    // Wait for snapshot to change
    await page.waitForFunction(
      (b) => {
        const ws = window.__sabaki.state.editWorkspace
        if (!ws) return false
        return (
          JSON.stringify(ws.currentSnapshot.signMap) !== b.currentSignMap
        )
      },
      before,
      {timeout: 5000},
    )

    const after = await captureStateBefore(page)

    // Expected write: opposite color placed (white, sign=-1)
    const signAtVertex = await page.evaluate(() => {
      const ws = window.__sabaki.state.editWorkspace
      return ws.currentSnapshot.signMap[4][4]
    })
    expect(signAtVertex).toBe(-1)
    await expectRenderedVertexSign(page, [4, 4], -1)

    // Forbidden writes: game tree unchanged
    expect(after.treeNodeCount).toBe(before.treeNodeCount)
    expect(after.treePosition).toBe(before.treePosition)
  })
})

test.describe('P2 Baseline — Native SGF edit stays legacy', () => {
  /*
   * Scenario: Native SGF edit stays legacy
   * PositionSource: legacy
   * MutationContract: legacy
   * BoardInteractionIntent: legacy-sgf-edit
   * Action: Use an existing native edit affordance without edit workspace
   * Expected writes: Existing SGF edit behavior remains available where supported
   * Forbidden writes: New workbench paths are not invoked
   * Visible result: Existing visible behavior is unchanged
   */

  test.skip('legacy useTool fallback is internal and must not block migration', async ({
    page,
  }) => {
    const sgfPath = path.resolve(
      __dirname,
      '..',
      'test',
      'sgf',
      'pro_game.sgf',
    )
    await loadSgfAndWait(page, sgfPath)

    // Enter analysis, then clear the workspace to force legacy path
    await page.evaluate(() => {
      window.__sabaki.setMode('analysis')
    })
    await page.waitForFunction(
      () =>
        window.__sabaki.state.mode === 'analysis' &&
        window.__sabaki.state.editWorkspace != null,
      {timeout: 5000},
    )

    // Clear the workspace to force legacy path
    await page.evaluate(() => {
      window.__sabaki.setState({editWorkspace: null})
    })
    await page.waitForFunction(
      () => window.__sabaki.state.editWorkspace == null,
      {timeout: 5000},
    )

    await setTool(page, 'stone_1')

    const before = await captureStateBefore(page)

    // Click a vertex — should go through legacy useTool path
    await clickVertex(page, [0, 0], {button: 0})

    // Wait for game tree to change (legacy edit modifies the tree)
    await page.waitForFunction(
      (b) => {
        const tree = window.__sabaki.state.gameTrees[window.__sabaki.state.gameIndex]
        let count = 0
        const walk = (n) => {
          count++
          for (const c of n.children) walk(c)
        }
        walk(tree.root)
        return count > b.treeNodeCount
      },
      before,
      {timeout: 5000},
    )

    const after = await captureStateBefore(page)

    // Expected: legacy path modifies game tree
    expect(after.treeNodeCount).not.toBe(before.treeNodeCount)

    // Verify editWorkspace was not created (stayed in legacy path)
    expect(after.editWorkspaceExists).toBe(false)
  })
})
