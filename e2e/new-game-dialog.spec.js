const {expect} = require('@playwright/test')
const {test} = require('./fixtures/electron-app')

function vertexSelector([x, y]) {
  return `#goban > .shudan-content > .shudan-vertices > .shudan-vertex[data-x="${x}"][data-y="${y}"]`
}

test.describe('New game settings dialog', () => {
  test('opens from the workbench new game action', async ({electronApp}) => {
    const page =
      electronApp.windows().length > 0
        ? electronApp.windows()[0]
        : await electronApp.firstWindow()

    page.on('dialog', async (dialog) => {
      await dialog.accept()
    })

    await page.waitForSelector('[data-testid="main-board-stage"]', {
      timeout: 30000,
    })
    await page.evaluate(() => window.__sabaki.setMode('play'))

    await page.locator('[data-testid="mode-action-new-game"]:visible').click()

    const dialog = page.locator('.new-game-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('新对局设置')
    await expect(dialog).toContainText('对局双方')
    await expect(dialog).toContainText('规则设置')
    await expect(dialog).toContainText('用时规则')
    await expect(dialog).toContainText('高级选项')
    await expect(dialog).toContainText('本地玩家')
    await expect(dialog).toContainText('开始对局')
    await expect(page.locator('#info.show')).toHaveCount(0)
  })

  test('black human versus white AI starts play tab and AI answers after black move', async ({
    electronApp,
  }) => {
    const page =
      electronApp.windows().length > 0
        ? electronApp.windows()[0]
        : await electronApp.firstWindow()

    page.on('dialog', async (dialog) => {
      await dialog.accept()
    })

    await page.waitForSelector('[data-testid="main-board-stage"]', {
      timeout: 30000,
    })
    await page.evaluate(() => {
      const syncer = {
        id: 'e2e_white_engine',
        engine: {name: 'E2E White AI'},
        commands: ['genmove'],
        busy: false,
        _suspended: false,
        on() {},
        removeListener() {},
        controller: {
          on() {},
          removeListener() {},
        },
      }
      window.__sabaki.__newGameAiHarness = {
        configuredGameArgs: [],
        configuredGameResult: null,
        configuredGameError: null,
        requestMove: [],
      }
      const originalStartConfiguredGame =
        window.__sabaki.startConfiguredGame.bind(window.__sabaki)
      window.__sabaki.startConfiguredGame = async (args) => {
        window.__sabaki.__newGameAiHarness.configuredGameArgs.push(args)
        try {
          const result = await originalStartConfiguredGame(args)
          window.__sabaki.__newGameAiHarness.configuredGameResult = result
          return result
        } catch (err) {
          window.__sabaki.__newGameAiHarness.configuredGameError =
            err && err.stack ? err.stack : String(err)
          throw err
        }
      }
      window.__sabaki.setState({
        mode: 'play',
        engines: [{name: 'E2E White AI', enabled: true}],
      })
      window.__sabaki.getOrAttachEngine = () => syncer
      const playServices = window.__sabaki.getPlayServices()
      playServices.engineService.requestMove = async (input) => {
        window.__sabaki.__newGameAiHarness.requestMove.push(input)
        return {move: 'qq', candidates: ['qq']}
      }
    })

    await page.locator('[data-testid="mode-action-new-game"]:visible').click()
    const dialog = page.locator('.new-game-dialog')
    await expect(dialog).toBeVisible()
    await dialog
      .locator('.new-game-dialog__player-row')
      .filter({hasText: '白方'})
      .getByRole('button', {name: 'AI'})
      .click()
    await dialog.getByRole('button', {name: /开始对局/}).click()
    await expect(dialog).toHaveCount(0)

    await expect(async () => {
      const activeTab = await page.evaluate(() => {
        const ctx = window.__sabaki.getTrainingContext()
        const state = ctx.workbenchStore.getState()
        return {
          activeTab: state.tabs.find((tab) => tab.id === state.activeTabId),
          harness: window.__sabaki.__newGameAiHarness,
        }
      })
      expect(activeTab.harness.configuredGameError).toBeNull()
      expect(activeTab.harness.configuredGameArgs).toHaveLength(1)
      expect(activeTab.harness.configuredGameResult).toBeTruthy()
      expect(activeTab.activeTab.mode).toBe('play')
      expect(activeTab.activeTab.activeAttemptId).toBeTruthy()
      expect(activeTab.activeTab.playerConfig).toMatchObject({
        black: 'human',
        white: 'ai',
        ai: {engineId: 'e2e_white_engine', autoPlay: true},
      })
    }).toPass({timeout: 5000})

    await page.locator(vertexSelector([3, 3])).click()

    await expect(async () => {
      const calls = await page.evaluate(
        () => window.__sabaki.__newGameAiHarness.requestMove,
      )
      expect(calls).toHaveLength(1)
      expect(calls[0].engineId).toBe('e2e_white_engine')
      expect(calls[0].treePosition).toBeTruthy()
    }).toPass({timeout: 5000})

    await expect(page.locator(vertexSelector([3, 3]))).toHaveClass(
      /shudan-sign_1/,
    )
    await expect(page.locator(vertexSelector([16, 16]))).toHaveClass(
      /shudan-sign_-1/,
    )
  })
})
