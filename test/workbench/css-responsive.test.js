/**
 * CSS Responsive Media Query Contract Tests (Phase 7)
 *
 * Test contract: Phase 7 Part 1 — responsive media queries
 * Contracts covered: T-7.1a through T-7.1c
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

describe('CSS Responsive Media Queries (T-7.1)', () => {
  let cssContent

  before(() => {
    cssContent = readFileSync(CSS_PATH, 'utf-8')
  })

  // --- T-7.1a: contains media query for max-width 1279px ---
  // Production subject: style/workbench.css responsive rules
  // Production bug: no responsive rules for medium screens
  // Controlled dependencies: none (static file)
  it('T-7.1a: contains @media (max-width: 1279px) rule', () => {
    const hasMedia1279 = /@media\s*\(\s*max-width\s*:\s*1279px\s*\)/.test(cssContent)
    assert.ok(
      hasMedia1279,
      'CSS should contain @media (max-width: 1279px) rule'
    )
  })

  // --- T-7.1b: 1279px media query targets .wb-right-panel ---
  // Production subject: style/workbench.css responsive rules
  // Production bug: right panel not affected at medium widths
  // Controlled dependencies: none (static file)
  it('T-7.1b: 1279px media query contains .wb-right-panel rule', () => {
    const media1279Match = cssContent.match(
      /@media\s*\(\s*max-width\s*:\s*1279px\s*\)\s*\{([^}]*\{[^}]*\}[^}]*)*\}/s
    )
    assert.ok(media1279Match, 'Could not find 1279px media query block body')

    const mediaBlock = media1279Match[0]
    const hasRightPanel = /\.wb-right-panel/.test(mediaBlock)
    assert.ok(
      hasRightPanel,
      '1279px media query should contain .wb-right-panel rule'
    )
  })

  // --- T-7.1c: contains media query for max-width 999px ---
  // Production subject: style/workbench.css responsive rules
  // Production bug: no responsive rules for small screens
  // Controlled dependencies: none (static file)
  it('T-7.1c: contains @media (max-width: 999px) rule', () => {
    const hasMedia999 = /@media\s*\(\s*max-width\s*:\s*999px\s*\)/.test(cssContent)
    assert.ok(
      hasMedia999,
      'CSS should contain @media (max-width: 999px) rule'
    )
  })

  // --- T-7.1d: 999px media query targets .wb-left-panel ---
  // Production subject: style/workbench.css responsive rules
  // Production bug: left panel not affected at small widths
  // Controlled dependencies: none (static file)
  it('T-7.1d: 999px media query contains .wb-left-panel rule', () => {
    // Find the 999px media query block
    // Match from @media (max-width: 999px) { to the closing }
    const media999Start = cssContent.indexOf('@media')
    let searchFrom = 0
    let media999Block = null

    while (searchFrom < cssContent.length) {
      const idx = cssContent.indexOf('@media', searchFrom)
      if (idx === -1) break

      const rest = cssContent.slice(idx)
      const match999 = rest.match(/^@media\s*\(\s*max-width\s*:\s*999px\s*\)/)
      if (match999) {
        // Find the matching closing brace
        let depth = 0
        let inBlock = false
        let end = idx
        for (let i = idx; i < cssContent.length; i++) {
          if (cssContent[i] === '{') {
            depth++
            inBlock = true
          } else if (cssContent[i] === '}') {
            depth--
            if (inBlock && depth === 0) {
              end = i + 1
              break
            }
          }
        }
        media999Block = cssContent.slice(idx, end)
        break
      }
      searchFrom = idx + 1
    }

    assert.ok(media999Block, 'Could not find 999px media query block')
    const hasLeftPanel = /\.wb-left-panel/.test(media999Block)
    assert.ok(
      hasLeftPanel,
      '999px media query should contain .wb-left-panel rule'
    )
  })
})
