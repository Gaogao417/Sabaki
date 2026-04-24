const {expect} = require('@playwright/test')
const path = require('path')
const {test} = require('./fixtures/electron-app')
const {loadSgfAndWait, getTreeDepth, waitForGameLoad} = require('./helpers')

test.describe('Renderer Integration Tests', () => {
  test.describe('Navigation', () => {
    test.beforeEach(async ({page}) => {
      const sgfPath = path.resolve(
        __dirname,
        '..',
        'test',
        'sgf',
        'pro_game.sgf',
      )

      await loadSgfAndWait(page, sgfPath)
    })

    test('goStep navigates forward and backward', async ({page}) => {
      await page.evaluate(() => {
        for (let i = 0; i < 5; i++) {
          window.__sabaki.goStep(1)
        }
      })

      expect(await getTreeDepth(page)).toBe(5)

      await page.evaluate(() => {
        for (let i = 0; i < 3; i++) {
          window.__sabaki.goStep(-1)
        }
      })

      expect(await getTreeDepth(page)).toBe(2)
    })

    test('goToEnd and goToBeginning jump correctly', async ({page}) => {
      await page.evaluate(() => {
        window.__sabaki.goToEnd()
      })

      const stonesAtEnd = await page.evaluate(() => {
        return document.querySelectorAll('.shudan-sign_1, .shudan-sign_-1')
          .length
      })
      expect(stonesAtEnd).toBeGreaterThan(0)

      await page.evaluate(() => {
        window.__sabaki.goToBeginning()
      })

      const isAtRoot = await page.evaluate(() => {
        const tree =
          window.__sabaki.state.gameTrees[window.__sabaki.state.gameIndex]
        return window.__sabaki.state.treePosition === tree.root.id
      })
      expect(isAtRoot).toBe(true)
    })

    test('arrow key navigation moves through game tree', async ({page}) => {
      await page.evaluate(() => {
        window.__sabaki.goToBeginning()
      })

      expect(await getTreeDepth(page)).toBe(0)

      // ArrowDown triggers startAutoscrolling, which calls goStep(1)
      // synchronously on the first tick. Poll for the state change
      // rather than using a fixed timeout.
      await page.keyboard.down('ArrowDown')

      await page.waitForFunction(
        () => {
          const tree =
            window.__sabaki.state.gameTrees[window.__sabaki.state.gameIndex]
          return window.__sabaki.state.treePosition !== tree.root.id
        },
        {timeout: 5000},
      )

      await page.keyboard.up('ArrowDown')

      expect(await getTreeDepth(page)).toBeGreaterThan(0)
    })
  })

  test.describe('Dialog Stubbing', () => {
    test('file open dialog can be stubbed', async ({electronApp, page}) => {
      const sgfPath = path.resolve(
        __dirname,
        '..',
        'test',
        'sgf',
        'beginner_game.sgf',
      )

      // Stub the open dialog in the main process so showOpenDialog returns
      // a specific file path instead of showing a native dialog.
      await electronApp.evaluate(({dialog}, filePath) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [filePath],
        })
      }, sgfPath)

      // loadFile() without args triggers the showOpenDialog stub
      await page.evaluate(() => {
        window.__sabaki.loadFile()
      })

      await waitForGameLoad(page)

      const hasChildren = await page.evaluate(() => {
        const tree =
          window.__sabaki.state.gameTrees[window.__sabaki.state.gameIndex]
        return tree.root.children.length > 0
      })
      expect(hasChildren).toBe(true)
    })
  })

  test.describe('Board Interaction', () => {
    test('clicking vertex in edit mode places a stone', async ({page}) => {
      await page.evaluate(() => {
        window.__sabaki.setMode('edit')
      })

      await page.waitForFunction(
        () => window.__sabaki && window.__sabaki.state.mode === 'edit',
      )

      const stonesBefore = await page.evaluate(() => {
        return document.querySelectorAll('.shudan-sign_1, .shudan-sign_-1')
          .length
      })

      const vertex = page.locator('.shudan-vertex').nth(50)
      await vertex.click()

      await page.waitForFunction(
        (before) => {
          const current = document.querySelectorAll(
            '.shudan-sign_1, .shudan-sign_-1',
          ).length
          return current > before
        },
        stonesBefore,
        {timeout: 5000},
      )

      const stonesAfter = await page.evaluate(() => {
        return document.querySelectorAll('.shudan-sign_1, .shudan-sign_-1')
          .length
      })
      expect(stonesAfter).toBeGreaterThan(stonesBefore)
    })

    test('new file creates empty board', async ({page}) => {
      await page.evaluate(() => {
        window.__sabaki.newFile()
      })

      await page.waitForFunction(
        () => {
          if (!window.__sabaki) return false
          const tree =
            window.__sabaki.state.gameTrees[window.__sabaki.state.gameIndex]
          return tree && tree.root.children.length === 0
        },
        {timeout: 5000},
      )

      const stonesOnBoard = await page.evaluate(() => {
        return document.querySelectorAll('.shudan-sign_1, .shudan-sign_-1')
          .length
      })
      expect(stonesOnBoard).toBe(0)
    })

    test('study workspace stays outside the board area', async ({page}) => {
      await page.evaluate(() => {
        window.__sabaki.enterStudyMode()
      })

      await page.waitForFunction(
        () =>
          window.__sabaki &&
          window.__sabaki.state.studyEnabled &&
          document.querySelector('#study') != null,
      )

      const boardStageBox = await page.locator('main.board-stage').boundingBox()
      const studyBox = await page.locator('#study').boundingBox()

      expect(boardStageBox).not.toBeNull()
      expect(studyBox).not.toBeNull()
      expect(studyBox.y).toBeGreaterThanOrEqual(
        boardStageBox.y + boardStageBox.height,
      )
    })

    test('ctrl adds analysis area boxes and alt removes them', async ({
      page,
    }) => {
      await page.evaluate(() => {
        window.__sabaki.newFile()
      })

      const vertex = page.locator('.shudan-vertex').nth(50)
      const stonesBefore = await page.evaluate(() => {
        return document.querySelectorAll('.shudan-sign_1, .shudan-sign_-1')
          .length
      })

      await vertex.click({modifiers: ['Control']})
      await page.waitForFunction(
        () => window.__sabaki.state.analysisAreaVertices?.length === 1,
      )

      const stonesAfterControl = await page.evaluate(() => {
        return document.querySelectorAll('.shudan-sign_1, .shudan-sign_-1')
          .length
      })
      expect(stonesAfterControl).toBe(stonesBefore)

      await vertex.click({modifiers: ['Control']})
      await page.waitForFunction(
        () => window.__sabaki.state.analysisAreaVertices == null,
      )

      const start = await page.locator('.shudan-vertex').nth(20).boundingBox()
      const end = await page.locator('.shudan-vertex').nth(42).boundingBox()
      expect(start).not.toBeNull()
      expect(end).not.toBeNull()
      const startVertex = page.locator('.shudan-vertex').nth(20)
      const endVertex = page.locator('.shudan-vertex').nth(42)

      await startVertex.dispatchEvent('mousedown', {
        button: 0,
        buttons: 1,
        ctrlKey: true,
        clientX: start.x + start.width / 2,
        clientY: start.y + start.height / 2,
      })
      await endVertex.dispatchEvent('mousemove', {
        button: 0,
        buttons: 1,
        ctrlKey: true,
        clientX: end.x + end.width / 2,
        clientY: end.y + end.height / 2,
      })
      await endVertex.dispatchEvent('mouseup', {
        button: 0,
        ctrlKey: true,
        clientX: end.x + end.width / 2,
        clientY: end.y + end.height / 2,
      })

      await page.waitForFunction(
        () => window.__sabaki.state.analysisAreaVertices?.length > 1,
      )

      await startVertex.click({modifiers: ['Alt']})
      await page.waitForFunction(
        () => window.__sabaki.state.analysisAreaVertices == null,
      )
    })

    test('ctrl area selection does not trigger edit line drawing', async ({
      page,
    }) => {
      await page.evaluate(async () => {
        await window.__sabaki.newFile({suppressAskForSave: true})
        window.__sabaki.setMode('edit')
        window.__sabaki.setState({selectedTool: 'line'})
      })
      await page.waitForFunction(
        () =>
          window.__sabaki.state.mode === 'edit' &&
          window.__sabaki.state.editWorkspace != null,
      )

      const start = await page.locator('.shudan-vertex').nth(30).boundingBox()
      const end = await page.locator('.shudan-vertex').nth(52).boundingBox()
      expect(start).not.toBeNull()
      expect(end).not.toBeNull()
      const startVertex = page.locator('.shudan-vertex').nth(30)
      const endVertex = page.locator('.shudan-vertex').nth(52)

      await startVertex.dispatchEvent('mousedown', {
        button: 0,
        buttons: 1,
        ctrlKey: true,
        clientX: start.x + start.width / 2,
        clientY: start.y + start.height / 2,
      })
      await endVertex.dispatchEvent('mousemove', {
        button: 0,
        buttons: 1,
        ctrlKey: true,
        clientX: end.x + end.width / 2,
        clientY: end.y + end.height / 2,
      })
      await endVertex.dispatchEvent('mouseup', {
        button: 0,
        ctrlKey: true,
        clientX: end.x + end.width / 2,
        clientY: end.y + end.height / 2,
      })

      await page.waitForFunction(
        () => window.__sabaki.state.analysisAreaVertices?.length > 1,
      )

      const currentLines = await page.evaluate(
        () => window.__sabaki.state.editWorkspace.currentLines.length,
      )
      expect(currentLines).toBe(0)
    })

    test('board tool shortcuts and edit Current/Reference tabs stay in sync', async ({
      page,
    }) => {
      const sgfPath = path.resolve(
        __dirname,
        '..',
        'test',
        'sgf',
        'beginner_game.sgf',
      )

      await loadSgfAndWait(page, sgfPath)

      await page.evaluate(() => {
        window.__sabaki.goStep(1)
      })

      await page.evaluate(() => {
        window.__sabaki.setState({territoryEnabled: true})
      })
      await page.waitForFunction(() => window.__sabaki.state.territoryEnabled)

      const compareButton = page.locator(
        '.board-toolbar .toolbar-button[title="Compare Reference against Current"]',
      )
      await expect(compareButton).toHaveCount(0)

      await page.evaluate(() => {
        window.__sabaki.setMode('edit')
      })
      await page.waitForFunction(
        () =>
          window.__sabaki.state.mode === 'edit' &&
          window.__sabaki.state.editWorkspace != null,
      )

      await expect(compareButton).toHaveCount(1)
      await expect(compareButton).toHaveAttribute('aria-disabled', 'true')

      await page
        .getByRole('link', {name: 'Capture Reference', exact: true})
        .click()
      await page.waitForFunction(
        () => window.__sabaki.state.editWorkspace?.referenceSnapshot != null,
      )

      await expect(
        page.getByRole('link', {name: 'Current', exact: true}),
      ).toBeVisible()
      await expect(
        page.getByRole('link', {name: 'Reference', exact: true}),
      ).toBeVisible()
      await expect(page.locator('.edit-board-panel--secondary')).toBeVisible()
      await expect(compareButton).toHaveAttribute('aria-disabled', 'false')

      await compareButton.click()
      await page.waitForFunction(
        () => window.__sabaki.state.territoryCompareEnabled,
      )

      await page.evaluate(() => {
        window.__sabaki.toggleEditTab('reference')
      })
      await page.waitForFunction(
        () => window.__sabaki.state.editWorkspace?.activeTab === 'reference',
      )
    })
  })
})
