const assert = require('assert')
const fs = require('fs')
const path = require('path')

const REPO_ROOT = path.resolve(__dirname, '../..')
const REGION_MODULE = path.join(
  REPO_ROOT,
  'src/modules/overlays/workbenchOverlayRegion.ts',
)

function readSource(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

describe('Workbench overlay region boundary (OVR-T03)', () => {
  it('exports a production transition region instead of hiding cleanup in flow/UI code', () => {
    assert.ok(
      fs.existsSync(REGION_MODULE),
      'src/modules/overlays/workbenchOverlayRegion.ts must define the overlay child-region transition boundary',
    )

    let source = fs.readFileSync(REGION_MODULE, 'utf8')
    assert.match(
      source,
      /export\s+(type|interface)\s+WorkbenchOverlayRegion\b/,
      'overlay region module must export a typed WorkbenchOverlayRegion port',
    )
    assert.match(
      source,
      /\bonWorkbenchModeTransition\b/,
      'overlay region port must expose onWorkbenchModeTransition(...)',
    )
    assert.match(
      source,
      /export\s+function\s+createWorkbenchOverlayRegion\b/,
      'overlay region module must export createWorkbenchOverlayRegion(...)',
    )

    let mod = require(REGION_MODULE)
    let region = mod.createWorkbenchOverlayRegion({
      overlayStore: {
        onModeChange: () => {},
      },
    })
    let forbiddenWriterNames = [
      'setMode',
      'setWorkbenchMode',
      'updateMode',
      'updateWorkbenchMode',
      'updateTab',
      'setTabMode',
    ]

    for (let name of forbiddenWriterNames) {
      assert.ok(
        !Object.prototype.hasOwnProperty.call(mod, name),
        `overlay region module must not export parent mode writer API ${name}`,
      )
      assert.ok(
        !Object.prototype.hasOwnProperty.call(region, name),
        `WorkbenchOverlayRegion object must not expose parent mode writer API ${name}`,
      )
    }
  })

  for (const relativePath of [
    'src/modules/overlays/overlayStore.ts',
    'src/modules/overlays/workbenchOverlayRegion.ts',
  ]) {
    it(`${relativePath} does not import or call parent Workbench writers`, () => {
      let source = readSource(relativePath)
      let forbiddenPatterns = [
        /from\s+['"][^'"]*training\/workbench[^'"]*['"]/,
        /from\s+['"][^'"]*training\/store[^'"]*['"]/,
        /from\s+['"][^'"]*training\/repository[^'"]*['"]/,
        /from\s+['"][^'"]*components[^'"]*['"]/,
        /from\s+['"][^'"]*engine[^'"]*['"]/,
        /from\s+['"][^'"]*db[^'"]*['"]/,
        /require\s*\(\s*['"][^'"]*training\/workbench[^'"]*['"]\s*\)/,
        /require\s*\(\s*['"][^'"]*training\/store[^'"]*['"]\s*\)/,
        /require\s*\(\s*['"][^'"]*training\/repository[^'"]*['"]\s*\)/,
        /\bwindow\.sabaki\b/,
        /\bsabaki\.setMode\b/,
        /\bsetMode\s*\(/,
        /\bsetWorkbenchMode\s*\(/,
        /\bupdateWorkbenchMode\s*\(/,
        /\bworkbenchStore\.updateTab\b/,
        /\bdeps\.workbenchStore\.updateTab\b/,
        /\bcreateWorkbenchFlowService\b/,
      ]

      for (let pattern of forbiddenPatterns) {
        assert.ok(
          !pattern.test(source),
          `${relativePath} violates the one-way overlay child-region boundary with ${pattern}`,
        )
      }
    })
  }

  it('production training context injects overlay region into flow service', () => {
    let source = readSource('src/modules/sabaki.js')

    assert.match(
      source,
      /\bcreateWorkbenchOverlayRegion\b/,
      'sabaki.js composition root must import/use createWorkbenchOverlayRegion',
    )
    assert.match(
      source,
      /const\s+overlayRegion\s*=\s*createWorkbenchOverlayRegion\s*\(\s*{[\s\S]*overlayStore:\s*this\.getOverlayStore\(\)[\s\S]*}\s*\)/,
      'sabaki.js must create overlayRegion from the production overlayStore',
    )
    assert.match(
      source,
      /createWorkbenchFlowService\s*\(\s*{[\s\S]*\boverlayRegion\b[\s\S]*}\s*\)/,
      'sabaki.js must pass overlayRegion into the production workbench flow service',
    )
  })
})
