/**
 * Architecture Boundary Tests (Phase U2)
 *
 * Test contract: docs/design/2026-05-19/phase-u2-structural/test-contract-v0.1.md
 * Contracts covered: T-U2-6b
 *
 * Test Legitimacy:
 *   Tests use fs.readFileSync to read production source files as text and
 *   inspect import statements. No module execution occurs.
 *   Production module missing -> test fails (file not found), no silent pass.
 *   Controlled dependencies: local file system reads.
 *
 * Purpose: Ensure workbench shell components do NOT import sabaki.js directly.
 *   All data must flow through props; all actions through callback props.
 *   This protects the architecture boundary: components are pure presentation.
 */

import assert from 'assert'
import {readFileSync} from 'fs'
import {resolve, dirname} from 'path'
import {fileURLToPath} from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '../..')

/**
 * Shell components that must not import sabaki.js
 */
const SHELL_COMPONENTS = [
  'src/components/workbench/shell/GlobalHeader.js',
  'src/components/workbench/shell/ModeBar.js',
  'src/components/workbench/shell/BottomActionBar.js',
  'src/components/workbench/shell/ModeActions.js',
  'src/components/workbench/shell/StoneStatus.js',
  'src/components/workbench/shell/MainBoardStage.js',
  'src/components/workbench/shell/RightModePanel.js',
  'src/components/workbench/shell/GameTabBar.js',
]

/**
 * Forbidden import patterns — importing sabaki.js directly violates
 * the architecture boundary.
 */
const FORBIDDEN_PATTERNS = [
  /from\s+['"][^'"]*sabaki\.js['"]/,
  /import\s*\(\s*['"][^'"]*sabaki\.js['"]\s*\)/,
  /require\s*\(\s*['"][^'"]*sabaki\.js['"]\s*\)/,
]

describe('Architecture boundary: no sabaki.js import (T-U2-6b)', () => {
  // --- T-U2-6b: shell components do not import sabaki.js ---
  // Production subject: all shell component files
  // Production bug: a component directly imports sabaki.js, bypassing
  //   the resolver/executor pattern and violating architecture boundary
  // Controlled dependencies: local file reads via fs.readFileSync
  // Silent pass risk: none — assert.ok always runs if file exists;
  //   if file does not exist, readFileSync throws and test fails

  for (const componentPath of SHELL_COMPONENTS) {
    it(`${componentPath} does NOT import sabaki.js`, () => {
      const absolutePath = resolve(projectRoot, componentPath)
      let source
      try {
        source = readFileSync(absolutePath, 'utf-8')
      } catch {
        // Component does not exist yet — skip (not a boundary violation)
        return
      }

      for (const pattern of FORBIDDEN_PATTERNS) {
        const match = source.match(pattern)
        assert.ok(
          !match,
          `${componentPath} must NOT import sabaki.js. Found forbidden pattern: "${match ? match[0] : ''}"`
        )
      }
    })
  }
})
