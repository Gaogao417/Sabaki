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
        /\bworkbenchStore\.updateTab\b/,
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
})
