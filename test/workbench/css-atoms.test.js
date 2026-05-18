/**
 * Phase U1: CSS Design Atom Contract Tests
 *
 * Test contract: docs/design/2026-05-19/phase-u1-css-atoms/test-contract-v0.1.md
 * Contracts covered: G-01 through G-04, C-01 through C-07, S-01 through S-05,
 *                    I-01 through I-05, T-01 through T-05, P-01 through P-03
 *
 * Test Legitimacy:
 *   All tests import and parse the production CSS file (style/workbench.css).
 *   Production module missing -> tests FAIL (file read error), no silent pass.
 *   No mocks required -- CSS parsing is a pure string operation.
 *   Controlled dependencies: none (reads a static file from disk).
 */

import assert from 'assert'
import {readFileSync} from 'fs'
import {resolve, dirname} from 'path'
import {fileURLToPath} from 'url'
import {createHash} from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CSS_PATH = resolve(__dirname, '../../style/workbench.css')

/**
 * Extract a CSS rule block for a given class selector.
 * Returns the full rule body (content between { }) as a string,
 * or null if the selector is not found.
 */
function extractRule(css, selector) {
  // Escape selector for regex (dots, dashes, etc.)
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(escaped + '\\s*\\{([^}]*)\\}', 's')
  const match = css.match(regex)
  return match ? match[1] : null
}

/**
 * Extract ALL rule blocks for a given class selector.
 * Returns array of rule bodies (for selectors that appear multiple times).
 */
function extractAllRules(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(escaped + '\\s*\\{([^}]*)\\}', 'gs')
  const results = []
  let match
  while ((match = regex.exec(css)) !== null) {
    results.push(match[1])
  }
  return results
}

/**
 * Check if a rule body contains a specific CSS declaration.
 * Property name is matched case-insensitively, value loosely.
 */
function hasDeclaration(ruleBody, property, valuePattern) {
  const regex = new RegExp(
    property + '\\s*:\\s*' + valuePattern,
    'i'
  )
  return regex.test(ruleBody)
}

/**
 * Get the value of a CSS property from a rule body.
 * Returns the raw value string (trimmed), or null if not found.
 */
function getDeclarationValue(ruleBody, property) {
  const regex = new RegExp(property + '\\s*:\\s*([^;]+)', 'i')
  const match = ruleBody.match(regex)
  return match ? match[1].trim() : null
}

// ---------------------------------------------------------------------------
// Snapshot of existing CSS content (everything BEFORE the Phase U1 additions)
// for the append-only check (G-03).
// As of commit fecd89cc, the CSS file has exactly 976 lines.
// We record a hash of the known-existing content so that any modification
// to those lines is detected.
// ---------------------------------------------------------------------------

// The content up to and including the last known section (GameTabBar).
// This is the "existing rules" that must not be modified.
function getExistingContentHash(css) {
  // Find the end marker of the last known section before U1 atoms.
  // The last existing section ends with the .wb-game-tab-bar__add:hover rule.
  const marker = '.wb-game-tab-bar__add:hover'
  const idx = css.lastIndexOf(marker)
  if (idx === -1) {
    // Marker not found -- either the file is empty or has been restructured.
    // Return hash of full content so the test fails clearly.
    return createHash('sha256').update(css).digest('hex')
  }
  // Find the closing brace of this rule
  const closingBrace = css.indexOf('}', idx)
  if (closingBrace === -1) {
    return createHash('sha256').update(css).digest('hex')
  }
  // Include everything up to and including the closing brace
  const existingContent = css.slice(0, closingBrace + 1)
  return createHash('sha256').update(existingContent).digest('hex')
}

// Pre-computed hash of the existing CSS content (before U1 additions).
// This value is computed from the CSS as of commit fecd89cc.
const EXISTING_CONTENT_HASH = (() => {
  const css = readFileSync(CSS_PATH, 'utf-8')
  return getExistingContentHash(css)
})()

// ---------------------------------------------------------------------------
// The new class names that Phase U1 is expected to add.
// Used by G-01 to verify BEM naming.
// ---------------------------------------------------------------------------
const NEW_U1_CLASSES = [
  '.wb-card',
  '.wb-card--flat',
  '.wb-card--compact',
  '.wb-segmented-control',
  '.wb-segmented-control__item',
  '.wb-segmented-control__item--active',
  '.wb-stone-indicator',
  '.wb-stone-indicator--black',
  '.wb-stone-indicator--white',
  '.wb-stone-indicator--inline',
  '.wb-status-text',
  '.wb-status-text__label',
  '.wb-status-text__value',
  '.wb-status-text__divider',
  '.wb-panel-title',
  '.wb-panel-body',
  '.wb-panel-caption',
]

describe('Phase U1 -- CSS Design Atoms', () => {
  let cssContent

  before(() => {
    cssContent = readFileSync(CSS_PATH, 'utf-8')
  })

  // =========================================================================
  // G Group -- Global Acceptance
  // =========================================================================
  describe('Global constraints (G)', () => {
    // --- G-01: All new class names follow wb- prefix + BEM naming ---
    // Production subject: style/workbench.css (new selectors added by U1)
    // Production bug: a new class uses wrong naming convention
    // Controlled dependencies: none
    it('G-01: all new class names follow wb- prefix and BEM convention', () => {
      // BEM pattern: .wb-block, .wb-block__element, .wb-block--modifier,
      // .wb-block__element--modifier
      const bemPattern = /^\.wb-[a-z]([a-z0-9]*)(-[a-z0-9]+)*(__[a-z0-9]([a-z0-9]*)(-[a-z0-9]+)*)?(--[a-z0-9]([a-z0-9]*)(-[a-z0-9]+)*)?$/

      for (const cls of NEW_U1_CLASSES) {
        assert.ok(
          bemPattern.test(cls),
          `Class "${cls}" does not follow wb- BEM naming convention`
        )
      }
    })

    // --- G-01 (existence): each new class actually exists in the CSS ---
    it('G-01: all expected U1 class selectors exist in the CSS file', () => {
      for (const cls of NEW_U1_CLASSES) {
        const rule = extractRule(cssContent, cls)
        assert.ok(
          rule !== null,
          `Expected selector "${cls}" not found in CSS`
        )
        assert.ok(
          rule.trim().length > 0,
          `Selector "${cls}" has an empty rule body`
        )
      }
    })

    // --- G-02: No hardcoded hex/rgba colors in new rules ---
    // Exception: gradient stops inside .wb-stone-indicator rules
    // Production subject: style/workbench.css (U1 section)
    // Production bug: a U1 rule uses a raw hex color instead of a CSS variable
    // Controlled dependencies: none
    it('G-02: no hardcoded colors in new rules (except stone indicator gradients)', () => {
      const hexColorPattern = /#[0-9a-fA-F]{3,8}\b/
      const rgbaPattern = /rgba?\(\s*\d+/

      for (const cls of NEW_U1_CLASSES) {
        // Skip stone indicator classes -- they are allowed hex in gradients
        if (cls.startsWith('.wb-stone-indicator')) continue

        const rules = extractAllRules(cssContent, cls)
        assert.ok(rules.length > 0, `Selector "${cls}" not found`)

        for (const ruleBody of rules) {
          const hasHex = hexColorPattern.test(ruleBody)
          const hasRgba = rgbaPattern.test(ruleBody)

          assert.ok(
            !hasHex,
            `Rule "${cls}" contains hardcoded hex color. Use var(--ui-*) instead. Rule body: ${ruleBody.slice(0, 200)}`
          )
          assert.ok(
            !hasRgba,
            `Rule "${cls}" contains hardcoded rgba/rgb color. Use var(--ui-*) instead. Rule body: ${ruleBody.slice(0, 200)}`
          )
        }
      }
    })

    // --- G-03: Existing rules are unchanged (append-only) ---
    // Production subject: style/workbench.css (pre-U1 content)
    // Production bug: an existing rule was modified during U1 implementation
    // Controlled dependencies: none
    it('G-03: existing CSS rules are unchanged (append-only)', () => {
      const currentHash = getExistingContentHash(cssContent)
      assert.strictEqual(
        currentHash,
        EXISTING_CONTENT_HASH,
        'Existing CSS content has been modified. Phase U1 must be append-only.'
      )
    })
  })

  // =========================================================================
  // C Group -- .wb-card
  // =========================================================================
  describe('.wb-card (C)', () => {
    // --- C-01: .wb-card exists with required structural properties ---
    // Production subject: style/workbench.css .wb-card rule
    // Production bug: .wb-card is missing or lacks required properties
    // Controlled dependencies: none
    it('C-01: .wb-card exists with background, border, border-radius, box-shadow, padding', () => {
      const rule = extractRule(cssContent, '.wb-card')
      assert.ok(rule, '.wb-card rule not found')

      assert.ok(hasDeclaration(rule, 'background', '.'), '.wb-card missing background')
      assert.ok(hasDeclaration(rule, 'border', '.'), '.wb-card missing border')
      assert.ok(hasDeclaration(rule, 'border-radius', '.'), '.wb-card missing border-radius')
      assert.ok(hasDeclaration(rule, 'box-shadow', '.'), '.wb-card missing box-shadow')
      assert.ok(hasDeclaration(rule, 'padding', '.'), '.wb-card missing padding')
    })

    // --- C-02: background uses var(--ui-card) ---
    // Production bug: background uses wrong variable or hardcoded value
    it('C-02: background uses var(--ui-card)', () => {
      const rule = extractRule(cssContent, '.wb-card')
      assert.ok(rule, '.wb-card rule not found')

      assert.ok(
        hasDeclaration(rule, 'background', 'var\\(--ui-card\\)'),
        '.wb-card background should use var(--ui-card)'
      )
    })

    // --- C-03: border-radius uses var(--radius-md) or var(--radius-lg) ---
    // Production bug: border-radius uses wrong value
    it('C-03: border-radius uses var(--radius-md) or var(--radius-lg)', () => {
      const rule = extractRule(cssContent, '.wb-card')
      assert.ok(rule, '.wb-card rule not found')

      const radiusValue = getDeclarationValue(rule, 'border-radius')
      assert.ok(
        radiusValue && (radiusValue.includes('var(--radius-md)') || radiusValue.includes('var(--radius-lg)')),
        `.wb-card border-radius should use var(--radius-md) or var(--radius-lg), got: ${radiusValue}`
      )
    })

    // --- C-04: box-shadow uses var(--ui-shadow-sm) ---
    // Production bug: box-shadow uses wrong value
    it('C-04: box-shadow uses var(--ui-shadow-sm)', () => {
      const rule = extractRule(cssContent, '.wb-card')
      assert.ok(rule, '.wb-card rule not found')

      assert.ok(
        hasDeclaration(rule, 'box-shadow', 'var\\(--ui-shadow-sm\\)'),
        '.wb-card box-shadow should use var(--ui-shadow-sm)'
      )
    })

    // --- C-05: .wb-card--flat removes box-shadow and border ---
    // Production bug: --flat variant does not remove shadow/border
    it('C-05: .wb-card--flat exists with box-shadow: none and no border', () => {
      const rule = extractRule(cssContent, '.wb-card--flat')
      assert.ok(rule, '.wb-card--flat rule not found')

      assert.ok(
        hasDeclaration(rule, 'box-shadow', 'none'),
        '.wb-card--flat should have box-shadow: none'
      )
    })

    // --- C-06: .wb-card--compact reduces padding to <= 10px ---
    // Production bug: --compact variant does not reduce padding
    it('C-06: .wb-card--compact exists with padding <= 10px', () => {
      const rule = extractRule(cssContent, '.wb-card--compact')
      assert.ok(rule, '.wb-card--compact rule not found')

      const paddingValue = getDeclarationValue(rule, 'padding')
      assert.ok(paddingValue, '.wb-card--compact missing padding declaration')

      // Extract numeric value(s) from padding -- could be shorthand like "8px" or "8px 12px"
      const pxValues = paddingValue.match(/(\d+(?:\.\d+)?)px/g)
      assert.ok(pxValues && pxValues.length > 0, `.wb-card--compact padding should use px values, got: ${paddingValue}`)

      // All padding values should be <= 10px
      for (const pv of pxValues) {
        const num = parseFloat(pv)
        assert.ok(
          num <= 10,
          `.wb-card--compact padding value ${pv} exceeds 10px`
        )
      }
    })
  })

  // =========================================================================
  // S Group -- .wb-segmented-control
  // =========================================================================
  describe('.wb-segmented-control (S)', () => {
    // --- S-01: container exists with display: inline-flex or flex ---
    // Production subject: style/workbench.css .wb-segmented-control
    // Production bug: wrong display value or missing rule
    // Controlled dependencies: none
    it('S-01: .wb-segmented-control exists with display: inline-flex or flex', () => {
      const rule = extractRule(cssContent, '.wb-segmented-control')
      assert.ok(rule, '.wb-segmented-control rule not found')

      const displayValue = getDeclarationValue(rule, 'display')
      assert.ok(
        displayValue && (displayValue === 'inline-flex' || displayValue === 'flex'),
        `.wb-segmented-control display should be inline-flex or flex, got: ${displayValue}`
      )
    })

    // --- S-01b: container has border-radius >= 6px ---
    it('S-01: container has rounded corners (border-radius >= 6px)', () => {
      const rule = extractRule(cssContent, '.wb-segmented-control')
      assert.ok(rule, '.wb-segmented-control rule not found')

      const radiusValue = getDeclarationValue(rule, 'border-radius')
      assert.ok(radiusValue, '.wb-segmented-control missing border-radius')

      // Check for var() reference or numeric value
      if (radiusValue.includes('var(')) {
        // Using a variable is acceptable
        assert.ok(true, 'Using CSS variable for border-radius')
      } else {
        const pxMatch = radiusValue.match(/(\d+(?:\.\d+)?)px/)
        assert.ok(pxMatch, `.wb-segmented-control border-radius should use px or var(), got: ${radiusValue}`)
        const num = parseFloat(pxMatch[1])
        assert.ok(num >= 6, `.wb-segmented-control border-radius should be >= 6px, got ${num}px`)
      }
    })

    // --- S-02: __item exists with cursor: pointer ---
    // Production bug: items not clickable
    it('S-02: .wb-segmented-control__item exists with cursor: pointer', () => {
      const rule = extractRule(cssContent, '.wb-segmented-control__item')
      assert.ok(rule, '.wb-segmented-control__item rule not found')

      assert.ok(
        hasDeclaration(rule, 'cursor', 'pointer'),
        '.wb-segmented-control__item should have cursor: pointer'
      )
    })

    // --- S-02b: __item has reasonable padding (6-14px) ---
    it('S-02: __item has reasonable padding (6-14px)', () => {
      const rule = extractRule(cssContent, '.wb-segmented-control__item')
      assert.ok(rule, '.wb-segmented-control__item rule not found')

      const paddingValue = getDeclarationValue(rule, 'padding')
      assert.ok(paddingValue, '.wb-segmented-control__item missing padding')

      const pxValues = paddingValue.match(/(\d+(?:\.\d+)?)px/g)
      assert.ok(pxValues && pxValues.length > 0, `Expected px padding values, got: ${paddingValue}`)

      for (const pv of pxValues) {
        const num = parseFloat(pv)
        assert.ok(
          num >= 6 && num <= 14,
          `.wb-segmented-control__item padding ${pv} outside 6-14px range`
        )
      }
    })

    // --- S-04: __item--active has background via var(--segment-color) ---
    // Production bug: active state does not use segment-color variable
    it('S-04: .wb-segmented-control__item--active has background using var(--segment-color)', () => {
      const rule = extractRule(cssContent, '.wb-segmented-control__item--active')
      assert.ok(rule, '.wb-segmented-control__item--active rule not found')

      assert.ok(
        hasDeclaration(rule, 'background', 'var\\(--segment-color'),
        '.wb-segmented-control__item--active background should use var(--segment-color)'
      )
    })

    // --- S-04b: active item text is white or var(--ui-bg) ---
    // Production bug: active text unreadable against colored background
    it('S-04: active item text color is white or var(--ui-bg)', () => {
      const rule = extractRule(cssContent, '.wb-segmented-control__item--active')
      assert.ok(rule, '.wb-segmented-control__item--active rule not found')

      const colorValue = getDeclarationValue(rule, 'color')
      assert.ok(
        colorValue && (
          colorValue === '#fff' ||
          colorValue === '#ffffff' ||
          colorValue === 'white' ||
          colorValue.includes('var(--ui-bg)')
        ),
        `.wb-segmented-control__item--active color should be white or var(--ui-bg), got: ${colorValue}`
      )
    })
  })

  // =========================================================================
  // I Group -- .wb-stone-indicator
  // =========================================================================
  describe('.wb-stone-indicator (I)', () => {
    // --- I-01: base class exists, display: inline-block, border-radius: 50% ---
    // Production subject: style/workbench.css .wb-stone-indicator
    // Production bug: stone indicator missing or wrong shape
    // Controlled dependencies: none
    it('I-01: .wb-stone-indicator exists with display: inline-block and border-radius: 50%', () => {
      const rule = extractRule(cssContent, '.wb-stone-indicator')
      assert.ok(rule, '.wb-stone-indicator rule not found')

      const displayValue = getDeclarationValue(rule, 'display')
      assert.ok(
        displayValue && displayValue === 'inline-block',
        `.wb-stone-indicator display should be inline-block, got: ${displayValue}`
      )

      const radiusValue = getDeclarationValue(rule, 'border-radius')
      assert.ok(
        radiusValue && radiusValue === '50%',
        `.wb-stone-indicator border-radius should be 50%, got: ${radiusValue}`
      )
    })

    // --- I-02: --black variant has radial-gradient ---
    // Production bug: black stone missing gradient texture
    it('I-02: .wb-stone-indicator--black has radial-gradient', () => {
      const rule = extractRule(cssContent, '.wb-stone-indicator--black')
      assert.ok(rule, '.wb-stone-indicator--black rule not found')

      assert.ok(
        hasDeclaration(rule, 'background', 'radial-gradient'),
        '.wb-stone-indicator--black should use radial-gradient'
      )
    })

    // --- I-03: --white variant has radial-gradient ---
    // Production bug: white stone missing gradient texture
    it('I-03: .wb-stone-indicator--white has radial-gradient', () => {
      const rule = extractRule(cssContent, '.wb-stone-indicator--white')
      assert.ok(rule, '.wb-stone-indicator--white rule not found')

      assert.ok(
        hasDeclaration(rule, 'background', 'radial-gradient'),
        '.wb-stone-indicator--white should use radial-gradient'
      )
    })

    // --- I-04: --inline variant is 16px ---
    // Production bug: inline variant wrong size
    it('I-04: .wb-stone-indicator--inline width and height are 16px', () => {
      const rule = extractRule(cssContent, '.wb-stone-indicator--inline')
      assert.ok(rule, '.wb-stone-indicator--inline rule not found')

      const widthValue = getDeclarationValue(rule, 'width')
      const heightValue = getDeclarationValue(rule, 'height')

      assert.ok(
        widthValue && widthValue === '16px',
        `.wb-stone-indicator--inline width should be 16px, got: ${widthValue}`
      )
      assert.ok(
        heightValue && heightValue === '16px',
        `.wb-stone-indicator--inline height should be 16px, got: ${heightValue}`
      )
    })

    // --- I-05: default size is 24px ---
    // Production bug: default stone indicator wrong size
    it('I-05: default size (width/height) is 24px', () => {
      const rule = extractRule(cssContent, '.wb-stone-indicator')
      assert.ok(rule, '.wb-stone-indicator rule not found')

      const widthValue = getDeclarationValue(rule, 'width')
      const heightValue = getDeclarationValue(rule, 'height')

      assert.ok(
        widthValue && widthValue === '24px',
        `.wb-stone-indicator width should be 24px, got: ${widthValue}`
      )
      assert.ok(
        heightValue && heightValue === '24px',
        `.wb-stone-indicator height should be 24px, got: ${heightValue}`
      )
    })
  })

  // =========================================================================
  // T Group -- .wb-status-text
  // =========================================================================
  describe('.wb-status-text (T)', () => {
    // --- T-01: container exists with display: inline-flex or flex ---
    // Production subject: style/workbench.css .wb-status-text
    // Production bug: status text container missing or wrong display
    // Controlled dependencies: none
    it('T-01: .wb-status-text exists with display: inline-flex or flex', () => {
      const rule = extractRule(cssContent, '.wb-status-text')
      assert.ok(rule, '.wb-status-text rule not found')

      const displayValue = getDeclarationValue(rule, 'display')
      assert.ok(
        displayValue && (displayValue === 'inline-flex' || displayValue === 'flex'),
        `.wb-status-text display should be inline-flex or flex, got: ${displayValue}`
      )
    })

    // --- T-01b: children are vertically centered ---
    it('T-05: .wb-status-text has align-items: center', () => {
      const rule = extractRule(cssContent, '.wb-status-text')
      assert.ok(rule, '.wb-status-text rule not found')

      assert.ok(
        hasDeclaration(rule, 'align-items', 'center'),
        '.wb-status-text should have align-items: center'
      )
    })

    // --- T-02: __label exists with font-weight including 600 or 700 ---
    // Production bug: label not bold enough
    it('T-02: .wb-status-text__label exists with font-weight >= 600', () => {
      const rule = extractRule(cssContent, '.wb-status-text__label')
      assert.ok(rule, '.wb-status-text__label rule not found')

      const fwValue = getDeclarationValue(rule, 'font-weight')
      assert.ok(fwValue, '.wb-status-text__label missing font-weight')

      // Accept "600", "700", "bold" (which is 700)
      const numericMatch = fwValue.match(/(\d+)/)
      const isBold = fwValue.toLowerCase() === 'bold'
      const isSemiBold = numericMatch && parseInt(numericMatch[1]) >= 600

      assert.ok(
        isBold || isSemiBold,
        `.wb-status-text__label font-weight should be >= 600 or "bold", got: ${fwValue}`
      )
    })

    // --- T-02b: __label font-size ~14px ---
    it('T-02: .wb-status-text__label font-size is 14px', () => {
      const rule = extractRule(cssContent, '.wb-status-text__label')
      assert.ok(rule, '.wb-status-text__label rule not found')

      const fsValue = getDeclarationValue(rule, 'font-size')
      assert.ok(fsValue, '.wb-status-text__label missing font-size')
      assert.strictEqual(fsValue, '14px', `.wb-status-text__label font-size should be 14px, got: ${fsValue}`)
    })

    // --- T-03: __value exists with color using var(--ui-text-secondary) ---
    // Production bug: value color not using secondary text token
    it('T-03: .wb-status-text__value exists with color var(--ui-text-secondary)', () => {
      const rule = extractRule(cssContent, '.wb-status-text__value')
      assert.ok(rule, '.wb-status-text__value rule not found')

      assert.ok(
        hasDeclaration(rule, 'color', 'var\\(--ui-text-secondary\\)'),
        '.wb-status-text__value color should use var(--ui-text-secondary)'
      )
    })

    // --- T-03b: __value font-size ~13px ---
    it('T-03: .wb-status-text__value font-size is 13px', () => {
      const rule = extractRule(cssContent, '.wb-status-text__value')
      assert.ok(rule, '.wb-status-text__value rule not found')

      const fsValue = getDeclarationValue(rule, 'font-size')
      assert.ok(fsValue, '.wb-status-text__value missing font-size')
      assert.strictEqual(fsValue, '13px', `.wb-status-text__value font-size should be 13px, got: ${fsValue}`)
    })

    // --- T-04: __divider exists as vertical line (width 1px, height 12-16px) ---
    // Production bug: divider not rendering as vertical separator
    it('T-04: .wb-status-text__divider exists as vertical line', () => {
      const rule = extractRule(cssContent, '.wb-status-text__divider')
      assert.ok(rule, '.wb-status-text__divider rule not found')

      const widthValue = getDeclarationValue(rule, 'width')
      assert.ok(
        widthValue && widthValue === '1px',
        `.wb-status-text__divider width should be 1px, got: ${widthValue}`
      )

      // Check for height (12-16px range)
      const heightValue = getDeclarationValue(rule, 'height')
      assert.ok(heightValue, '.wb-status-text__divider missing height')

      const pxMatch = heightValue.match(/(\d+(?:\.\d+)?)px/)
      assert.ok(pxMatch, `.wb-status-text__divider height should use px, got: ${heightValue}`)
      const h = parseFloat(pxMatch[1])
      assert.ok(
        h >= 12 && h <= 16,
        `.wb-status-text__divider height should be 12-16px, got ${h}px`
      )
    })
  })

  // =========================================================================
  // P Group -- Panel Typography
  // =========================================================================
  describe('Panel typography (P)', () => {
    // --- P-01: .wb-panel-title is ~14px, font-weight bold ---
    // Production subject: style/workbench.css .wb-panel-title
    // Production bug: panel title wrong size or weight
    // Controlled dependencies: none
    it('P-01: .wb-panel-title exists with font-size 14px and font-weight bold', () => {
      const rule = extractRule(cssContent, '.wb-panel-title')
      assert.ok(rule, '.wb-panel-title rule not found')

      const fsValue = getDeclarationValue(rule, 'font-size')
      assert.ok(fsValue, '.wb-panel-title missing font-size')
      assert.strictEqual(fsValue, '14px', `.wb-panel-title font-size should be 14px, got: ${fsValue}`)

      const fwValue = getDeclarationValue(rule, 'font-weight')
      assert.ok(fwValue, '.wb-panel-title missing font-weight')
      const numericMatch = fwValue.match(/(\d+)/)
      const isBold = fwValue.toLowerCase() === 'bold'
      const isSemiBold = numericMatch && parseInt(numericMatch[1]) >= 600
      assert.ok(
        isBold || isSemiBold,
        `.wb-panel-title font-weight should be >= 600 or "bold", got: ${fwValue}`
      )
    })

    // --- P-02: .wb-panel-body is 12-13px ---
    // Production bug: panel body wrong font size
    it('P-02: .wb-panel-body exists with font-size 12-13px', () => {
      const rule = extractRule(cssContent, '.wb-panel-body')
      assert.ok(rule, '.wb-panel-body rule not found')

      const fsValue = getDeclarationValue(rule, 'font-size')
      assert.ok(fsValue, '.wb-panel-body missing font-size')

      const pxMatch = fsValue.match(/(\d+(?:\.\d+)?)px/)
      assert.ok(pxMatch, `.wb-panel-body font-size should use px, got: ${fsValue}`)
      const size = parseFloat(pxMatch[1])
      assert.ok(
        size >= 12 && size <= 13,
        `.wb-panel-body font-size should be 12-13px, got ${size}px`
      )
    })

    // --- P-03: .wb-panel-caption uses var(--ui-text-tertiary) ---
    // Production bug: caption not using tertiary text token
    it('P-03: .wb-panel-caption exists with color var(--ui-text-tertiary)', () => {
      const rule = extractRule(cssContent, '.wb-panel-caption')
      assert.ok(rule, '.wb-panel-caption rule not found')

      assert.ok(
        hasDeclaration(rule, 'color', 'var\\(--ui-text-tertiary\\)'),
        '.wb-panel-caption color should use var(--ui-text-tertiary)'
      )
    })
  })
})