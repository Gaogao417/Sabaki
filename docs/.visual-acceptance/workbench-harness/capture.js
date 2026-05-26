const fs = require('fs')
const path = require('path')
const http = require('http')
const webpack = require('webpack')
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

const captureProfiles = [
  {name: 'desktop', width: 1448, height: 1086, scenarios},
  {
    name: 'compact',
    width: 1279,
    height: 860,
    scenarios: ['problem', 'analysis-library'],
  },
]

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html'
  if (filePath.endsWith('.js')) return 'text/javascript'
  if (filePath.endsWith('.css')) return 'text/css'
  if (filePath.endsWith('.png')) return 'image/png'
  if (filePath.endsWith('.svg')) return 'image/svg+xml'
  return 'application/octet-stream'
}

function buildHarnessBundle() {
  const buildDir = path.join(outDir, '.harness-build')
  fs.mkdirSync(buildDir, {recursive: true})

  return new Promise((resolve, reject) => {
    webpack({
      mode: 'development',
      entry: path.join(repoRoot, 'docs/.visual-acceptance/workbench-harness/entry.js'),
      output: {
        filename: 'harness.js',
        path: buildDir,
      },
      devtool: false,
      target: 'electron-renderer',
      node: {
        __dirname: false,
      },
      module: {
        rules: [
          {
            test: /\.tsx?$/,
            exclude: /node_modules/,
            use: path.resolve(repoRoot, 'ci/esbuildTsLoader.js'),
          },
        ],
      },
      resolve: {
        extensions: ['.js', '.ts', '.tsx'],
        alias: {
          react: 'preact/compat',
          'react-dom/test-utils': 'preact/test-utils',
          'react-dom': 'preact/compat',
          'react/jsx-runtime': 'preact/jsx-runtime',
        },
      },
      externals: {
        '@sabaki/i18n': 'require("@sabaki/i18n")',
        'cross-spawn': 'null',
        'iconv-lite': 'require("iconv-lite")',
        moment: 'null',
      },
    }, (err, stats) => {
      if (err) {
        reject(err)
        return
      }

      if (stats.hasErrors()) {
        reject(new Error(stats.toString({colors: false, errors: true})))
        return
      }

      resolve(path.join(buildDir, 'harness.js'))
    })
  })
}

function startServer(harnessBundlePath) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
      if (urlPath === '/docs/.visual-acceptance/workbench-harness/harness.js') {
        res.writeHead(200, {'content-type': 'text/javascript'})
        fs.createReadStream(harnessBundlePath).pipe(res)
        return
      }
      if (urlPath.startsWith('/docs/.visual-acceptance/workbench-harness/')) {
        const chunkPath = path.join(
          path.dirname(harnessBundlePath),
          path.basename(urlPath),
        )
        if (fs.existsSync(chunkPath)) {
          res.writeHead(200, {'content-type': contentType(chunkPath)})
          fs.createReadStream(chunkPath).pipe(res)
          return
        }
      }

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
  const harnessBundlePath = await buildHarnessBundle()
  const {server, port} = await startServer(harnessBundlePath)
  const electronPath = require('electron')
  const app = await electron.launch({
    executablePath: electronPath,
    args: [repoRoot],
    env: {...process.env, SABAKI_E2E: '1'},
  })

  try {
    await (app.windows().length > 0 ? Promise.resolve(app.windows()[0]) : app.firstWindow())
    const firstUrl = harnessUrl(port, scenarios[0])
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
    for (const profile of captureProfiles) {
      await page.setViewportSize({width: profile.width, height: profile.height})

      for (const scenario of profile.scenarios) {
        await page.evaluate((nextScenario) => {
          window.location.hash = nextScenario
        }, scenario)
        await page.waitForSelector('.workbench-shell', {timeout: 10000}).catch(async (err) => {
          console.error(`failed ${profile.name}/${scenario} at ${page.url()}`)
          console.error(await page.locator('body').innerText().catch(() => '<no body>'))
          throw err
        })
        await page.waitForTimeout(500)

        const metrics = await page.evaluate(() => {
          const rect = (node) => {
            if (!node) return null
            const box = node.getBoundingClientRect()
            return {
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
              top: box.top,
              right: box.right,
              bottom: box.bottom,
              left: box.left,
            }
          }
          const shell = document.querySelector('.workbench-shell')
          const modeBar = document.querySelector('.wb-mode-bar')
          const stage = document.querySelector('[data-testid="main-board-stage"]')
          const board = document.querySelector('.wb-board-fallback')
          const bottom = document.querySelector('.workbench-shell__bottom')
          const drawerShell = document.querySelector('.wb-library-drawer-shell')
          const drawer = document.querySelector('.wb-library-drawer')
          const leftPanel = document.querySelector('.workbench-shell__left-panel')
          const rightPanel = document.querySelector('.workbench-shell__right-panel')
          const cards = [...document.querySelectorAll('.wb-card')]
            .filter((card) => getComputedStyle(card).display !== 'none')
          const bodyText = document.body.innerText
          const overflowNodes = [...document.querySelectorAll([
            'button',
            '.wb-topbar-title',
            '.wb-library-drawer__item',
            '.wb-library-drawer__source',
            '.wb-visual-action',
          ].join(','))]
            .filter((node) => {
              const box = node.getBoundingClientRect()
              return box.width > 0 &&
                box.height > 0 &&
                node.scrollWidth > node.clientWidth + 2
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
            stage: !!stage,
            board: !!board,
            bottom: !!bottom,
            drawer: !!drawer,
            visibleCards: cards.length,
            textLength: bodyText.length,
            hasGlobalHeaderClass: !!document.querySelector('.wb-global-header'),
            overflowCount: overflowNodes.length,
            overflowDetails,
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight,
            },
            documentWidth: document.documentElement.scrollWidth,
            bodyWidth: document.body.scrollWidth,
            topbar: rect(modeBar),
            stageBox: rect(stage),
            boardBox: rect(board),
            bottomBox: rect(bottom),
            drawerShellBox: rect(drawerShell),
            drawerBox: rect(drawer),
            drawerShellPosition: drawerShell ? getComputedStyle(drawerShell).position : null,
            leftPanelDisplay: leftPanel ? getComputedStyle(leftPanel).display : null,
            rightPanelDisplay: rightPanel ? getComputedStyle(rightPanel).display : null,
          }
        })

        const screenshotName = profile.name === 'desktop'
          ? `${scenario}.png`
          : `${profile.name}-${scenario}.png`
        const screenshotPath = path.join(outDir, screenshotName)
        await page.screenshot({path: screenshotPath, fullPage: false})
        assertProfileMetrics(profile, scenario, metrics)
        results.push({profile: profile.name, scenario, screenshotPath, metrics})
      }
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

function harnessUrl(port, scenario) {
  const query = new URLSearchParams({repoRoot})
  return `http://127.0.0.1:${port}/docs/.visual-acceptance/workbench-harness/index.html?${query}#${scenario}`
}

function assertProfileMetrics(profile, scenario, metrics) {
  const label = `${profile.name}/${scenario}`
  const requireMetric = (condition, message) => {
    if (!condition) {
      throw new Error(`${label}: ${message}`)
    }
  }

  requireMetric(metrics.shell, 'missing .workbench-shell')
  requireMetric(metrics.stage, 'missing main board stage')
  requireMetric(metrics.board, 'missing board fallback')
  requireMetric(metrics.bottom, 'missing bottom action bar area')
  requireMetric(metrics.textLength > 20, 'rendered shell has too little visible text')

  if (profile.name !== 'compact') return

  requireMetric(metrics.viewport.width <= 1279, `viewport is not compact: ${metrics.viewport.width}`)
  requireMetric(metrics.leftPanelDisplay === 'none', `left panel remains visible: ${metrics.leftPanelDisplay}`)
  requireMetric(metrics.rightPanelDisplay === 'none', `right panel remains visible: ${metrics.rightPanelDisplay}`)
  requireMetric(metrics.documentWidth <= metrics.viewport.width + 2, `document overflows horizontally: ${metrics.documentWidth}`)
  requireMetric(metrics.bodyWidth <= metrics.viewport.width + 2, `body overflows horizontally: ${metrics.bodyWidth}`)
  requireMetric(metrics.overflowCount === 0, `visible text overflow: ${JSON.stringify(metrics.overflowDetails)}`)

  const board = metrics.boardBox
  const stage = metrics.stageBox
  const bottom = metrics.bottomBox
  requireMetric(board && board.width >= 520, `board is too narrow: ${board?.width}`)
  requireMetric(board.right <= metrics.viewport.width + 1, `board exceeds viewport: ${JSON.stringify(board)}`)
  requireMetric(board.left >= -1, `board starts outside viewport: ${JSON.stringify(board)}`)
  requireMetric(bottom && bottom.height >= 70, `bottom bar is too short: ${bottom?.height}`)
  requireMetric(bottom.bottom <= metrics.viewport.height + 1, `bottom bar exceeds viewport: ${JSON.stringify(bottom)}`)

  const boardCenter = board.left + board.width / 2
  const stageCenter = stage.left + stage.width / 2
  requireMetric(
    Math.abs(boardCenter - stageCenter) <= 24,
    `board is not centered in stage: board=${boardCenter}, stage=${stageCenter}`,
  )

  if (scenario.includes('library')) {
    const drawer = metrics.drawerBox
    const drawerShell = metrics.drawerShellBox
    requireMetric(metrics.drawer, 'library drawer is not visible')
    requireMetric(metrics.drawerShellPosition === 'fixed', `drawer shell is not overlay fixed: ${metrics.drawerShellPosition}`)
    requireMetric(drawerShell && drawerShell.width >= metrics.viewport.width - 1, `drawer shell does not cover viewport width: ${JSON.stringify(drawerShell)}`)
    requireMetric(drawerShell && drawerShell.height >= metrics.viewport.height - 1, `drawer shell does not cover viewport height: ${JSON.stringify(drawerShell)}`)
    requireMetric(drawer && drawer.width >= 320, `drawer overlay is too narrow: ${drawer?.width}`)
    requireMetric(drawer.right <= metrics.viewport.width + 1, `drawer overlay exceeds viewport: ${JSON.stringify(drawer)}`)
    requireMetric(drawer.height >= metrics.viewport.height - 96, `drawer panel is too short for compact overlay: ${JSON.stringify(drawer)}`)
  }
}

capture().catch((err) => {
  console.error(err)
  process.exit(1)
})
