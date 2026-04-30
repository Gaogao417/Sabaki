const {expect} = require('@playwright/test')
const path = require('path')
const {test} = require('./fixtures/electron-app')
const {
  loadSgfAndWait,
  getTreeDepth,
  attachAndWaitForEngines,
  detachAndWait,
  enginePath,
  getRequiredKatagoEngine,
} = require('./helpers')

async function waitForLiveAnalysis(page, treePosition) {
  await page.waitForFunction(
    (expectedPos) => {
      let {analysis, analysisTreePosition} = window.__sabaki.state
      return (
        analysis != null &&
        analysisTreePosition === expectedPos &&
        analysis.variations.length > 0
      )
    },
    treePosition,
    {timeout: 15000},
  )
}

test.describe('GTP Engine Integration Tests', () => {
  test('attach and start engine', async ({page}) => {
    const syncerInfo = await page.evaluate((ePath) => {
      const syncers = window.__sabaki.attachEngines([
        {name: 'ResignEngine', path: process.execPath, args: ePath},
      ])
      return syncers.map((s) => ({id: s.id, name: s.engine.name}))
    }, enginePath)

    expect(syncerInfo).toHaveLength(1)
    expect(syncerInfo[0].name).toBe('ResignEngine')

    // Verify it appears in state
    const attached = await page.evaluate(() => {
      return window.__sabaki.state.attachedEngineSyncers.map((s) => s.id)
    })
    expect(attached).toContain(syncerInfo[0].id)

    // Wait for engine to be started (process is running)
    await page.waitForFunction(
      (syncerId) => {
        const syncer = window.__sabaki.state.attachedEngineSyncers.find(
          (s) => s.id === syncerId,
        )
        return syncer && !syncer._suspended
      },
      syncerInfo[0].id,
      {timeout: 10000},
    )

    // Clean up
    await detachAndWait(page, attached)
  })

  test('detach engine cleanly', async ({page}) => {
    const syncerIds = await attachAndWaitForEngines(page, [
      {name: 'ResignEngine', path: process.execPath, args: enginePath},
    ])

    expect(syncerIds).toHaveLength(1)

    await detachAndWait(page, syncerIds)

    const remaining = await page.evaluate(() => {
      return window.__sabaki.state.attachedEngineSyncers.length
    })
    expect(remaining).toBe(0)
  })

  test('engine responds to genmove', async ({page}) => {
    const syncerIds = await attachAndWaitForEngines(page, [
      {name: 'ResignEngine', path: process.execPath, args: enginePath},
    ])

    const initialNodeId = await page.evaluate(() => {
      return window.__sabaki.state.treePosition
    })

    const result = await page.evaluate(async (syncerId) => {
      try {
        const r = await window.__sabaki.generateMove(
          syncerId,
          window.__sabaki.state.treePosition,
        )
        return r
          ? {ok: true, treePosition: r.treePosition, resign: r.resign}
          : {ok: false, reason: 'generateMove returned null'}
      } catch (e) {
        return {ok: false, reason: e.message}
      }
    }, syncerIds[0])

    expect(result.ok).toBe(true)

    const newNodeId = await page.evaluate(() => {
      return window.__sabaki.state.treePosition
    })
    expect(newNodeId).not.toBe(initialNodeId)

    // Clean up
    await detachAndWait(page, syncerIds)
  })

  test('bot-vs-bot game completes', async ({page}) => {
    const syncerIds = await attachAndWaitForEngines(page, [
      {name: 'BlackEngine', path: process.execPath, args: enginePath},
      {name: 'WhiteEngine', path: process.execPath, args: enginePath},
    ])

    expect(syncerIds).toHaveLength(2)

    // Assign engines to black and white
    await page.evaluate((ids) => {
      window.__sabaki.setState({
        blackEngineSyncerId: ids[0],
        whiteEngineSyncerId: ids[1],
      })
    }, syncerIds)

    // startEngineGame is async and resolves when the game ends (resign
    // or two consecutive passes), so we can await it directly.
    const result = await page.evaluate(async () => {
      try {
        await window.__sabaki.startEngineGame(
          window.__sabaki.state.treePosition,
        )
        return {ok: true}
      } catch (e) {
        return {ok: false, reason: e.message}
      }
    })

    expect(result.ok).toBe(true)

    // The resign engine plays 3 moves then resigns, so with 2 engines
    // we expect at least 3 total moves before one resigns
    expect(await getTreeDepth(page)).toBeGreaterThanOrEqual(3)

    // Clean up
    await detachAndWait(page, syncerIds)
  })

  test('board state sync after loading SGF', async ({page}) => {
    const sgfPath = path.resolve(__dirname, '..', 'test', 'sgf', 'pro_game.sgf')

    await loadSgfAndWait(page, sgfPath)

    // Navigate to move 5
    await page.evaluate(() => {
      for (let i = 0; i < 5; i++) {
        window.__sabaki.goStep(1)
      }
    })

    const positionBeforeEngine = await page.evaluate(() => {
      return window.__sabaki.state.treePosition
    })

    const syncerIds = await attachAndWaitForEngines(page, [
      {name: 'ResignEngine', path: process.execPath, args: enginePath},
    ])

    // Verify the treePosition hasn't changed from attaching the engine
    const positionAfterEngine = await page.evaluate(() => {
      return window.__sabaki.state.treePosition
    })
    expect(positionAfterEngine).toBe(positionBeforeEngine)

    // Clean up
    await detachAndWait(page, syncerIds)
  })

  test('collapsed engine excerpt tolerates object-backed log responses', async ({
    page,
  }) => {
    const sgfPath = path.resolve(
      __dirname,
      '..',
      'test',
      'sgf',
      'beginner_game.sgf',
    )
    const pageErrors = []

    page.on('pageerror', (err) => {
      pageErrors.push(String(err))
    })

    await loadSgfAndWait(page, sgfPath)

    await page.evaluate(() => {
      window.__sabaki.setState({
        showLeftSidebar: true,
        leftSidebarWidth: 320,
        showSidebar: true,
        showGameGraph: true,
        showCommentBox: true,
        sidebarWidth: 320,
        consoleLog: [
          {
            name: 'Engine',
            command: null,
            response: {content: 'boot message', internal: true},
            waiting: false,
          },
        ],
      })
      window.__sabaki.setMode('find')
    })

    await page.waitForTimeout(200)

    await expect(page.locator('#leftsidebar .engine-card')).toBeVisible()
    await expect(page.locator('#leftsidebar .log-excerpt-list')).toContainText(
      'boot message',
    )
    await page.getByRole('button', {name: 'Expand Console'}).click()
    await expect(page.locator('#leftsidebar .gtp-console')).toBeVisible()
    await expect(page.locator('#leftsidebar .gtp-console')).toContainText(
      'boot message',
    )
    await expect(page.locator('#graph')).toBeVisible()
    expect(pageErrors).toEqual([])
  })
})

test.describe('Analysis Flow Tests', () => {
  test('final node receives analysis after rapid navigation', async ({
    page,
  }) => {
    const sgfPath = path.resolve(__dirname, '..', 'test', 'sgf', 'pro_game.sgf')
    await loadSgfAndWait(page, sgfPath)

    const syncerIds = await attachAndWaitForEngines(page, [
      getRequiredKatagoEngine(),
    ])

    await page.evaluate((syncerId) => {
      window.__sabaki.startAnalysis(syncerId)
    }, syncerIds[0])

    const nodeIds = await page.evaluate(() => {
      let ids = []
      let tree =
        window.__sabaki.state.gameTrees[window.__sabaki.state.gameIndex]
      let pos = tree.root.id
      ids.push(pos)
      for (let i = 0; i < 5; i++) {
        let node = tree.get(pos)
        if (node.children.length === 0) break
        pos = node.children[0].id
        ids.push(pos)
      }
      return ids
    })

    for (const nodeId of nodeIds) {
      await page.evaluate((id) => {
        let tree =
          window.__sabaki.state.gameTrees[window.__sabaki.state.gameIndex]
        window.__sabaki.setCurrentTreePosition(tree, id)
      }, nodeId)
    }

    const finalNodeId = nodeIds[nodeIds.length - 1]
    await waitForLiveAnalysis(page, finalNodeId)

    const analysisState = await page.evaluate(() => ({
      analysis: window.__sabaki.state.analysis,
      analysisTreePosition: window.__sabaki.state.analysisTreePosition,
      treePosition: window.__sabaki.state.treePosition,
    }))

    expect(analysisState.analysis).not.toBeNull()
    expect(analysisState.analysisTreePosition).toBe(finalNodeId)
    expect(analysisState.analysisTreePosition).toBe(analysisState.treePosition)

    await detachAndWait(page, syncerIds)
  })

  test('analyzeMove bypasses ownership cache and refreshes live analysis', async ({
    page,
  }) => {
    const sgfPath = path.resolve(__dirname, '..', 'test', 'sgf', 'pro_game.sgf')
    await loadSgfAndWait(page, sgfPath)

    const syncerIds = await attachAndWaitForEngines(page, [
      getRequiredKatagoEngine(),
    ])

    await page.evaluate(() => {
      for (let i = 0; i < 3; i++) window.__sabaki.goStep(1)
    })

    const nodeId = await page.evaluate(() => window.__sabaki.state.treePosition)

    const result = await page.evaluate(
      async ({syncerId, treePosition}) => {
        let sabaki = window.__sabaki
        let tree = sabaki.state.gameTrees[sabaki.state.gameIndex]
        let syncer = sabaki.state.attachedEngineSyncers.find(
          (s) => s.id === syncerId,
        )
        let originalRunBoardAnalysis = sabaki.runBoardAnalysis
        let called = false

        sabaki.cacheOwnership(syncerId, tree, treePosition, [[0.1]])
        sabaki.setState({
          analyzingEngineSyncerId: syncerId,
          analysis: {variations: []},
          analysisTreePosition: tree.root.id,
        })

        sabaki.runBoardAnalysis = async (options) => {
          called = true
          return {
            sign: options.analyzePlayer,
            variations: [],
            ownership: [[0.2]],
          }
        }

        try {
          await sabaki.analyzeMove(treePosition)
        } finally {
          sabaki.runBoardAnalysis = originalRunBoardAnalysis
        }

        return {
          called,
          cachedOwnership: sabaki.getCachedOwnership(
            syncer.id,
            tree,
            treePosition,
          ),
        }
      },
      {syncerId: syncerIds[0], treePosition: nodeId},
    )

    expect(result.cachedOwnership).not.toBeNull()
    expect(result.called).toBe(true)

    await detachAndWait(page, syncerIds)
  })

  test('stale analysis update triggers retry for current node', async ({
    page,
  }) => {
    const sgfPath = path.resolve(__dirname, '..', 'test', 'sgf', 'pro_game.sgf')
    await loadSgfAndWait(page, sgfPath)

    const syncerIds = await attachAndWaitForEngines(page, [
      getRequiredKatagoEngine(),
    ])

    const result = await page.evaluate((syncerId) => {
      let tree =
        window.__sabaki.state.gameTrees[window.__sabaki.state.gameIndex]
      let nodeA = tree.root.children[0].id
      let nodeB = tree.get(nodeA).children[0].id
      let scheduledTreePosition = null
      let syncer = window.__sabaki.state.attachedEngineSyncers.find(
        (s) => s.id === syncerId,
      )
      let originalScheduleLiveAnalysis = window.__sabaki.scheduleLiveAnalysis

      window.__sabaki.scheduleLiveAnalysis = (treePosition) => {
        scheduledTreePosition = treePosition
      }

      window.__sabaki.setCurrentTreePosition(tree, nodeB)
      window.__sabaki.setState({
        analyzingEngineSyncerId: syncerId,
        analysis: {variations: []},
        analysisTreePosition: nodeB,
      })

      syncer.treePosition = nodeA
      syncer.analysis = {
        sign: 1,
        variations: [
          {
            vertex: [3, 3],
            visits: 100,
            winrate: 54.32,
            scoreLead: 3.5,
            moves: [[3, 3]],
          },
        ],
        ownership: Array(19)
          .fill(0)
          .map(() => Array(19).fill(0.1)),
        winrate: 54.32,
        scoreLead: 3.5,
      }

      window.__sabaki.scheduleLiveAnalysis = originalScheduleLiveAnalysis

      return {
        nodeA,
        nodeB,
        scheduledTreePosition,
        analysisTreePosition: window.__sabaki.state.analysisTreePosition,
        treePosition: window.__sabaki.state.treePosition,
      }
    }, syncerIds[0])

    expect(result.nodeB).not.toBe(result.nodeA)
    expect(result.scheduledTreePosition).toBe(result.nodeB)
    expect(result.analysisTreePosition).not.toBe(result.nodeA)
    expect(result.analysisTreePosition).toBe(result.treePosition)

    await detachAndWait(page, syncerIds)
  })
})
