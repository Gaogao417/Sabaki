const {expect} = require('@playwright/test')
const {test} = require('./fixtures/electron-app')

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

    await page.getByTestId('mode-action-new-game').click()

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
})
