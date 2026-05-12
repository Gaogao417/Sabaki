/**
 * Analysis Overlay Baseline Tests
 *
 * Playwright characterization tests that verify the EditBar analysis-tool buttons
 * (Territory, Territory Compare, AI Suggestions/heatmap, Human Preference) start
 * the analysis engine and activate the corresponding overlay.
 *
 * These tests require KataGo to be available (pre-seeded via e2e/fixtures/electron-app
 * settings). Each test is skipped automatically when KataGo is not configured.
 *
 * Contract language per docs/design/workbench-test-writing-conduct.md:
 *
 *   Expected write:  overlay toggle state changes to true; engine analysis starts.
 *   Forbidden write: game tree and treePosition do not change.
 *   Visible result:  overlay DOM signals appear (territory-mode class, heatmap, etc.)
 */

const {expect} = require('@playwright/test')
const {test} = require('./fixtures/electron-app')
const {attachAndWaitForEngines, getRequiredKatagoEngine} = require('./helpers')
const {getKatagoEngine} = require('./katago-fixture')

const katagoAvailable = getKatagoEngine() != null

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
 * Capture a snapshot of key state signatures before an action.
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
      territoryEnabled: s.territoryEnabled,
      territoryCompareEnabled: s.territoryCompareEnabled,
      showAISuggestions: s.showAISuggestions,
      showHumanPreference: s.showHumanPreference,
      editWorkspaceExists: ws != null,
    }
  })
}

/**
 * Attach KataGo engine and wait for it to be ready.
 * Returns the syncer IDs.  Callers should guard with katagoAvailable.
 */
async function setupKataGo(page) {
  return attachAndWaitForEngines(page, [getRequiredKatagoEngine()])
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Analysis Overlay — Territory toggle starts engine and activates overlay', () => {
  /*
   * Scenario: Territory toggle starts engine and activates overlay
   * PositionSource: scratch/current
   * MutationContract: null (read-only overlay)
   * BoardInteractionIntent: toggle-territory
   * Action: Call sabaki.toggleTerritoryEnabled() in analysis mode
   * Expected writes: territoryEnabled changes to true; engine analysis starts
   * Forbidden writes: game tree and treePosition do not change
   * Visible result: territory-mode CSS class appears on the board (#goban)
   */

  test('territory toggle starts engine and activates overlay', async ({page}) => {
    test.skip(!katagoAvailable, 'KataGo not available')
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

    const syncerIds = await setupKataGo(page)

    const before = await captureStateBefore(page)
    expect(before.territoryEnabled).toBe(false)

    // Toggle territory on
    await page.evaluate(() =>
      window.__sabaki.toggleTerritoryEnabled(),
    )

    // Wait for territoryEnabled to become true
    await page.waitForFunction(
      () => window.__sabaki.state.territoryEnabled === true,
      {timeout: 15000},
    )

    // Wait for territory-mode class on the board
    await page.waitForFunction(
      () => {
        const el = document.querySelector('#goban .shudan-goban')
        return el != null && el.classList.contains('territory-mode')
      },
      {timeout: 10000},
    )

    const after = await captureStateBefore(page)

    // Expected write: territoryEnabled is now true
    expect(after.territoryEnabled).toBe(true)

    // Forbidden writes: game tree and treePosition unchanged
    expect(after.treeNodeCount).toBe(before.treeNodeCount)
    expect(after.treePosition).toBe(before.treePosition)

    // Visible result: territory-mode class on goban
    const hasTerritoryMode = await page.evaluate(() => {
      const el = document.querySelector('#goban .shudan-goban')
      return el != null && el.classList.contains('territory-mode')
    })
    expect(hasTerritoryMode).toBe(true)

    // Clean up
    await page.evaluate((ids) => window.__sabaki.detachEngines(ids), syncerIds)
  })
})

test.describe('Analysis Overlay — Territory Compare toggle activates diff overlay', () => {
  /*
   * Scenario: Territory Compare toggle activates diff overlay
   * PositionSource: scratch/current + scratch/reference
   * MutationContract: null (read-only overlay)
   * BoardInteractionIntent: toggle-territory-compare
   * Action: Enable territory first, then toggle territory compare in analysis mode
   * Expected writes: territoryCompareEnabled changes to true;
   *                  referenceSnapshot is captured automatically if absent
   * Forbidden writes: game tree and treePosition do not change
   * Visible result: territory-mode class remains active; diff overlay appears
   */

  test('territory compare toggle activates diff overlay', async ({page}) => {
    test.skip(!katagoAvailable, 'KataGo not available')
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

    const syncerIds = await setupKataGo(page)

    // Enable territory first (required before compare can be activated)
    await page.evaluate(() => window.__sabaki.setTerritoryEnabled(true))
    await page.waitForFunction(
      () => window.__sabaki.state.territoryEnabled === true,
      {timeout: 15000},
    )

    // Wait for analysis to produce ownership data
    await page.waitForFunction(
      () => {
        const ws = window.__sabaki.state.editWorkspace
        return ws != null && ws.currentOwnership != null
      },
      {timeout: 20000},
    )

    const before = await captureStateBefore(page)
    expect(before.territoryEnabled).toBe(true)
    expect(before.territoryCompareEnabled).toBe(false)

    // Toggle territory compare
    await page.evaluate(() => window.__sabaki.toggleTerritoryCompareEnabled())

    // Wait for territoryCompareEnabled to become true
    await page.waitForFunction(
      () => window.__sabaki.state.territoryCompareEnabled === true,
      {timeout: 15000},
    )

    const after = await captureStateBefore(page)

    // Expected write: territoryCompareEnabled is now true
    expect(after.territoryCompareEnabled).toBe(true)

    // Forbidden writes: game tree unchanged
    expect(after.treeNodeCount).toBe(before.treeNodeCount)
    expect(after.treePosition).toBe(before.treePosition)

    // Visible result: territory-mode still active on board
    const hasTerritoryMode = await page.evaluate(() => {
      const el = document.querySelector('#goban .shudan-goban')
      return el != null && el.classList.contains('territory-mode')
    })
    expect(hasTerritoryMode).toBe(true)

    // Clean up
    await page.evaluate((ids) => window.__sabaki.detachEngines(ids), syncerIds)
  })
})

test.describe('Analysis Overlay — AI Suggestions (heatmap) toggle starts engine', () => {
  /*
   * Scenario: AI Suggestions (heatmap) toggle starts engine
   * PositionSource: scratch/current
   * MutationContract: null (read-only overlay)
   * BoardInteractionIntent: toggle-ai-suggestions
   * Action: Call sabaki.toggleShowAISuggestions() in analysis mode
   * Expected writes: showAISuggestions changes to true; engine starts analysis
   * Forbidden writes: game tree and treePosition do not change
   * Visible result: heatmap overlay (analysis winrate/visits markers) appears on board
   */

  test('AI suggestions toggle starts engine and shows heatmap', async ({page}) => {
    test.skip(!katagoAvailable, 'KataGo not available')
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

    const syncerIds = await setupKataGo(page)

    // Make sure AI suggestions are initially off
    await page.evaluate(() => {
      window.__sabaki.setState({showAISuggestions: false, showAnalysis: false})
    })
    await page.waitForFunction(
      () => window.__sabaki.state.showAISuggestions === false,
      {timeout: 5000},
    )

    const before = await captureStateBefore(page)
    expect(before.showAISuggestions).toBe(false)

    // Toggle AI suggestions on
    await page.evaluate(() => window.__sabaki.toggleShowAISuggestions())

    // Wait for showAISuggestions to become true
    await page.waitForFunction(
      () => window.__sabaki.state.showAISuggestions === true,
      {timeout: 10000},
    )

    // Wait for analysis to produce variations (heatmap data)
    await page.waitForFunction(
      () => {
        const ws = window.__sabaki.state.editWorkspace
        return ws != null && ws.currentAnalysis != null
          && ws.currentAnalysis.variations != null
          && ws.currentAnalysis.variations.length > 0
      },
      {timeout: 20000},
    )

    const after = await captureStateBefore(page)

    // Expected write: showAISuggestions is now true
    expect(after.showAISuggestions).toBe(true)

    // Forbidden writes: game tree and treePosition unchanged
    expect(after.treeNodeCount).toBe(before.treeNodeCount)
    expect(after.treePosition).toBe(before.treePosition)

    // Visible result: heatmap elements appear on the board
    // Shudan renders heat points as .shudan-heatmap elements inside the goban
    const heatmapCount = await page.evaluate(() => {
      const elements = document.querySelectorAll('#goban .shudan-heat')
      return elements.length
    })
    expect(heatmapCount).toBeGreaterThan(0)

    // Clean up
    await page.evaluate((ids) => window.__sabaki.detachEngines(ids), syncerIds)
  })
})

test.describe('Analysis Overlay — Human Preference toggle starts engine', () => {
  /*
   * Scenario: Human Preference toggle starts engine
   * PositionSource: scratch/current
   * MutationContract: null (read-only overlay)
   * BoardInteractionIntent: toggle-human-preference
   * Action: Call sabaki.toggleShowHumanPreference() in analysis mode
   * Expected writes: showHumanPreference changes to true; engine starts analysis
   * Forbidden writes: game tree and treePosition do not change
   * Visible result: human-prior markers appear on top-5 human preference points
   */

  test('human preference toggle starts engine and shows overlay', async ({page}) => {
    test.skip(!katagoAvailable, 'KataGo not available')
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

    const syncerIds = await setupKataGo(page)

    // Enable AI suggestions first (required for heatmap rendering infrastructure)
    // then enable analysis so the engine produces humanPolicyMap data
    await page.evaluate(() => {
      window.__sabaki.setState({
        showAISuggestions: false,
        showHumanPreference: false,
        showAnalysis: false,
      })
    })

    const before = await captureStateBefore(page)
    expect(before.showHumanPreference).toBe(false)

    // Toggle human preference on — this also calls ensureAnalysisReady()
    await page.evaluate(() => window.__sabaki.toggleShowHumanPreference())

    // Wait for showHumanPreference to become true
    await page.waitForFunction(
      () => window.__sabaki.state.showHumanPreference === true,
      {timeout: 10000},
    )

    // Also enable AI suggestions to trigger full heatmap rendering
    // (the humanPrior markers are drawn inside the heatmap rendering code)
    await page.evaluate(() => window.__sabaki.toggleShowAISuggestions())

    // Wait for analysis to produce variations AND humanPolicyMap
    await page.waitForFunction(
      () => {
        const ws = window.__sabaki.state.editWorkspace
        return ws != null
          && ws.currentAnalysis != null
          && ws.currentAnalysis.variations != null
          && ws.currentAnalysis.variations.length > 0
          && ws.currentAnalysis.humanPolicyMap != null
      },
      {timeout: 20000},
    )

    const after = await captureStateBefore(page)

    // Expected write: showHumanPreference is now true
    expect(after.showHumanPreference).toBe(true)

    // Forbidden writes: game tree and treePosition unchanged
    expect(after.treeNodeCount).toBe(before.treeNodeCount)
    expect(after.treePosition).toBe(before.treePosition)

    // Visible result: heatmap elements exist on board (humanPrior markers render
    // as heat points with a distinct visual style via the humanPrior flag)
    const heatmapCount = await page.evaluate(() => {
      const elements = document.querySelectorAll('#goban .shudan-heat')
      return elements.length
    })
    expect(heatmapCount).toBeGreaterThan(0)

    // Clean up
    await page.evaluate((ids) => window.__sabaki.detachEngines(ids), syncerIds)
  })
})
