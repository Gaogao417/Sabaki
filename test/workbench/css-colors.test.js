/**
 * CSS Color Variable Contract Tests (Phase 1.1)
 *
 * Test contract: docs/design/2026-05-18/workbench-ui-phases-1-3/test-contract-v0.1.md
 * Contracts covered: T-1.1a through T-1.1f
 *
 * Test Legitimacy:
 *   All tests import and parse the production CSS file (style/workbench.css).
 *   Production module missing -> tests FAIL (file read error), no silent pass.
 *   No mocks required — CSS parsing is a pure string operation.
 */

import assert from 'assert'
import {readFileSync} from 'fs'
import {resolve, dirname} from 'path'
import {fileURLToPath} from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CSS_PATH = resolve(__dirname, '../../style/workbench.css')

/**
 * Parse CSS custom property declarations from :root block.
 * Returns a Map of var name -> value (lowercase, trimmed).
 */
function parseCssVars(cssContent) {
  const rootMatch = cssContent.match(/:root\s*\{([^}]+)\}/s)
  assert.ok(rootMatch, 'Could not find :root block in CSS file')

  const vars = new Map()
  const lines = rootMatch[1].split('\n')
  for (const line of lines) {
    const m = line.match(/--([\w-]+)\s*:\s*([^;]+);/)
    if (m) {
      vars.set(`--${m[1]}`, m[2].trim().toLowerCase())
    }
  }
  return vars
}

/**
 * Parse hardcoded color maps from JS files.
 * Returns a Map of mode -> color string.
 */
function parseJsColorMap(jsContent) {
  const colorMatch = jsContent.match(/MODE_COLORS\s*=\s*\{([^}]+)\}/s)
  if (!colorMatch) return new Map()

  const colors = new Map()
  const entries = colorMatch[1].split(',')
  for (const entry of entries) {
    const m = entry.match(/(\w+)\s*:\s*['"]([^'"]+)['"]/)
    if (m) {
      colors.set(m[1], m[2].trim().toLowerCase())
    }
  }
  return colors
}

function parseJsModesArray(jsContent) {
  const modesMatch = jsContent.match(/MODES\s*=\s*\[([\s\S]*?)\]/)
  if (!modesMatch) return new Map()

  const colors = new Map()
  const entries = modesMatch[1].split(/},\s*{/)
  for (const entry of entries) {
    const keyMatch = entry.match(/key\s*:\s*['"](\w+)['"]/)
    const colorMatch = entry.match(/color\s*:\s*['"]([^'"]+)['"]/)
    if (keyMatch && colorMatch) {
      colors.set(keyMatch[1], colorMatch[1].trim().toLowerCase())
    }
  }
  return colors
}

describe('CSS Color Variables (T-1.1)', () => {
  let cssContent
  let cssVars

  before(() => {
    cssContent = readFileSync(CSS_PATH, 'utf-8')
    cssVars = parseCssVars(cssContent)
  })

  // --- T-1.1a: --ui-play resolves to #2563ff ---
  // Production subject: style/workbench.css :root block
  // Production bug: --ui-play is wrong color or missing
  // Controlled dependencies: none (static file)
  it('T-1.1a: --ui-play resolves to #2563ff', () => {
    const value = cssVars.get('--ui-play')
    assert.ok(value, '--ui-play not found in :root')
    assert.strictEqual(value, '#2563ff')
  })

  // --- T-1.1b: --ui-problem resolves to #d97706 ---
  it('T-1.1b: --ui-problem resolves to #d97706', () => {
    const value = cssVars.get('--ui-problem')
    assert.ok(value, '--ui-problem not found in :root')
    assert.strictEqual(value, '#d97706')
  })

  // --- T-1.1c: --ui-recall-mode resolves to #169b55 ---
  it('T-1.1c: --ui-recall-mode resolves to #169b55', () => {
    const value = cssVars.get('--ui-recall-mode')
    assert.ok(value, '--ui-recall-mode not found in :root')
    assert.strictEqual(value, '#169b55')
  })

  // --- T-1.1d: --ui-analysis resolves to #7c3aed ---
  it('T-1.1d: --ui-analysis resolves to #7c3aed', () => {
    const value = cssVars.get('--ui-analysis')
    assert.ok(value, '--ui-analysis not found in :root')
    assert.strictEqual(value, '#7c3aed')
  })

  // --- T-1.1e: All four -soft variables resolve to correct values ---
  // Phase 7 updated soft colors: each mode's soft tint now matches its primary hue.
  it('T-1.1e: all four -soft variables resolve to correct values', () => {
    const softVars = {
      '--ui-play-soft': '#eef4ff',
      '--ui-problem-soft': '#fff7ed',
      '--ui-recall-mode-soft': '#eaf8f0',
      '--ui-analysis-soft': '#f2edff',
    }

    for (const [name, expected] of Object.entries(softVars)) {
      const value = cssVars.get(name)
      assert.ok(value, `${name} not found in :root`)
      assert.strictEqual(value, expected, `${name} should be ${expected}`)
    }
  })

  // --- T-1.1f: ModeBar/GlobalHeader hardcoded colors align with CSS vars ---
  // ARCHITECTURE_BOUNDARY: JS hardcoded colors should match CSS custom properties
  it('T-1.1f: GlobalHeader hardcoded colors align with CSS vars', () => {
    const globalHeaderPath = resolve(__dirname, '../../src/components/workbench/shell/GlobalHeader.js')
    const globalHeaderContent = readFileSync(globalHeaderPath, 'utf-8')
    const jsColors = parseJsColorMap(globalHeaderContent)

    // Verify each mode's JS color matches the CSS variable
    const expectedFromCss = {
      play: cssVars.get('--ui-play'),
      problem: cssVars.get('--ui-problem'),
      recall: cssVars.get('--ui-recall-mode'),
      analysis: cssVars.get('--ui-analysis'),
    }

    for (const [mode, cssColor] of Object.entries(expectedFromCss)) {
      const jsColor = jsColors.get(mode)
      assert.ok(jsColor, `GlobalHeader MODE_COLORS missing "${mode}" key`)
      assert.strictEqual(
        jsColor, cssColor,
        `GlobalHeader color for "${mode}" (${jsColor}) does not match CSS var (${cssColor})`
      )
    }
  })

  it('T-1.1f: ModeBar hardcoded colors align with CSS vars', () => {
    const modeBarPath = resolve(__dirname, '../../src/components/workbench/shell/ModeBar.js')
    const modeBarContent = readFileSync(modeBarPath, 'utf-8')
    const jsColors = parseJsModesArray(modeBarContent)

    const expectedFromCss = {
      play: cssVars.get('--ui-play'),
      problem: cssVars.get('--ui-problem'),
      recall: cssVars.get('--ui-recall-mode'),
      analysis: cssVars.get('--ui-analysis'),
    }

    for (const [mode, cssColor] of Object.entries(expectedFromCss)) {
      const jsColor = jsColors.get(mode)
      assert.ok(jsColor, `ModeBar MODES missing "${mode}" key`)
      assert.strictEqual(
        jsColor, cssColor,
        `ModeBar color for "${mode}" (${jsColor}) does not match CSS var (${cssColor})`
      )
    }
  })
})
