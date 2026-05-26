const fs = require('fs')
const path = require('path')
const http = require('http')
const {chromium, _electron: electron} = require('@playwright/test')

const repoRoot = path.resolve(__dirname, '../../..')
const outDir = path.join(
  repoRoot,
  'docs',
  'archive',
  'daily-design',
  '2026-05-26',
  'workbench-visual-acceptance',
  'screenshots',
)

const scenarios = [
  'problem',
  'recall',
  'play-history',
  'play-kifu',
  'play-games',
  'analysis',
  'analysis-library',
  'checkpoint',
]

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html'
  if (filePath.endsWith('.js')) return 'text/javascript'
  if (filePath.endsWith('.css')) return 'text/css'
  if (filePath.endsWith('.png')) return 'image/png'
  if (filePath.endsWith('.svg')) return 'image/svg+xml'
  return 'application/octet-stream'
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
      const filePath = path.join(repoRoot, urlPath === '/' ? 'index.html' : urlPath)

      if (!filePath.startsWith(repoRoot) || !fs.existsSync(filePath)) {
        res.writeHead(404)
        res.end('not found')
        return
      }

      res.writeHead(200, {'content-type': contentType(filePath)})
      fs.createReadStream(filePath).pipe(res)
    })

    server.listen(0, '127.0.0.1', () => {
      resolve({server, port: server.address().port})
    })
  })
}

async function capture() {
  fs.mkdirSync(outDir, {recursive: true})
  const {server, port} = await startServer()
  const electronPath = require('electron')
  const app = await electron.launch({
    executablePath: electronPath,
    args: [repoRoot],
    env: {...process.env, SABAKI_E2E: '1'},
  })

  try {
    await (app.windows().length > 0 ? Promise.resolve(app.windows()[0]) : app.firstWindow())
    const firstUrl = `http://127.0.0.1:${port}/docs/.visual-acceptance/workbench-harness/index.html#${scenarios[0]}`
    const pagePromise = app.waitForEvent('window')
    await app.evaluate(({BrowserWindow}, url) => {
      const win = new BrowserWindow({
        width: 1448,
        height: 1086,
        show: true,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
        },
      })
      win.loadURL(url)
    }, firstUrl)
    const page = await pagePromise
    await page.waitForLoadState('domcontentloaded').catch(() => {})
    console.log(`visual window: ${page.url()}`)
    page.on('dialog', async (dialog) => {
      await dialog.accept().catch(() => {})
    })
    page.on('console', (message) => {
      if (message.type() === 'error') console.error(message.text())
    })
    page.on('pageerror', (err) => {
      console.error(`pageerror: ${err.message}`)
    })
    await page.setViewportSize({width: 1448, height: 1086})
    await page.reload({waitUntil: 'domcontentloaded'}).catch(() => {})
    await page.evaluate(() => {
      window.onbeforeunload = null
      window.onunload = null
    }).catch(() => {})

    const results = []
    for (const scenario of scenarios) {
      await page.evaluate((nextScenario) => {
        window.location.hash = nextScenario
      }, scenario)
      await page.waitForSelector('.workbench-shell', {timeout: 10000}).catch(async (err) => {
        console.error(`failed scenario ${scenario} at ${page.url()}`)
        console.error(await page.locator('body').innerText().catch(() => '<no body>'))
        throw err
      })
      await page.waitForTimeout(500)

      const metrics = await page.evaluate(() => {
        const shell = document.querySelector('.workbench-shell')
        const modeBar = document.querySelector('.wb-mode-bar')
        const board = document.querySelector('.wb-board-fallback')
        const drawer = document.querySelector('.wb-library-drawer')
        const cards = [...document.querySelectorAll('.wb-card')]
          .filter((card) => getComputedStyle(card).display !== 'none')
        const bodyText = document.body.innerText
        const overflowNodes = [...document.querySelectorAll('button, .wb-topbar-title, .wb-card, .wb-library-drawer__item')]
          .filter((node) => {
            const rect = node.getBoundingClientRect()
            return rect.width > 0 && node.scrollWidth > node.clientWidth + 2
          })
        const overflowDetails = overflowNodes.map((node) => ({
          tag: node.tagName.toLowerCase(),
          className: typeof node.className === 'string' ? node.className : '',
          text: node.innerText?.replace(/\s+/g, ' ').trim().slice(0, 80) || '',
          clientWidth: node.clientWidth,
          scrollWidth: node.scrollWidth,
        }))

        return {
          shell: !!shell,
          modeBar: !!modeBar,
          board: !!board,
          drawer: !!drawer,
          visibleCards: cards.length,
          textLength: bodyText.length,
          hasGlobalHeaderClass: !!document.querySelector('.wb-global-header'),
          overflowCount: overflowNodes.length,
          overflowDetails,
          topbar: modeBar?.getBoundingClientRect().toJSON?.() || null,
          boardBox: board?.getBoundingClientRect().toJSON?.() || null,
        }
      })

      const screenshotPath = path.join(outDir, `${scenario}.png`)
      await page.screenshot({path: screenshotPath, fullPage: false})
      results.push({scenario, screenshotPath, metrics})
    }

    fs.writeFileSync(
      path.join(outDir, 'acceptance-results.json'),
      JSON.stringify(results, null, 2),
    )

    console.log(JSON.stringify({outDir, results}, null, 2))
  } finally {
    await app.evaluate(({app: electronApp}) => electronApp.exit(0)).catch(() => {})
    await app.close().catch(() => {})
    server.close()
  }
}

capture().catch((err) => {
  console.error(err)
  process.exit(1)
})
