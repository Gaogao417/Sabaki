/**
 * modeTransitionsBoundary.test.js
 *
 * Architecture boundary test: modeTransitions module must not import
 * any service, store, adapter, or DB module.
 *
 * Contract: docs/design/2026-05-25/phase1-gaps/test-contract-v0.1.md
 * Test ID: P1G-T36
 * Layer: ARCHITECTURE_BOUNDARY
 *
 * This test reads the source file as text and checks that import/require
 * statements do not reference forbidden modules. This is a static analysis
 * approach that avoids runtime execution while protecting the purity boundary.
 *
 * Harness manifest:
 * - Real production modules: modeTransitions.ts (read as text, not imported)
 * - Fake/spy modules: NONE
 * - Valid for: ARCHITECTURE_BOUNDARY (import purity)
 * - Not valid for: CONTROLLER_STATE_TRANSITION, SERVICE_REPOSITORY_TRANSITION
 */

import assert from 'assert'
import fs from 'fs'
import path from 'path'

const MODULE_PATH = path.resolve(
  process.cwd(),
  'src/modules/training/workbench/modeTransitions.ts',
)

/**
 * Patterns that MUST NOT appear in import/require statements of modeTransitions.ts.
 * These are the module categories listed in Contract Section 8, item 1:
 * "modeTransitions.ts 不得 import 任何 service、store、adapter 或 DB 模块"
 */
const FORBIDDEN_IMPORT_PATTERNS = [
  // Service modules
  /service/i,
  // Store modules
  /store/i,
  // Adapter modules
  /adapter/i,
  // DB / repository modules
  /repository/i,
  /database/i,
  // IO / network / DOM
  /fetch/i,
  /http/i,
  /dom/i,
]

/**
 * Allowed import sources -- these are legitimate for a pure state machine:
 * - types (type-only imports)
 * - Relative imports within workbench/ or types/
 */
const ALLOWED_IMPORT_PATHS = [
  // type imports from the types directory
  /^\.\.\/types\//,
  // same directory relative imports within workbench
  /^\.\//,
  // type-only imports from any location are allowed
]

function extractImportPaths(source) {
  const paths = []

  // Match `import ... from '...'` and `import '...'`
  const importFromRegex = /import\s+(?:type\s+)?(?:[\w{},\s*]*\s+from\s+)?['"]([^'"]+)['"]/g
  let match
  while ((match = importFromRegex.exec(source)) !== null) {
    paths.push({path: match[1], line: source.substring(0, match.index).split('\n').length})
  }

  // Match `require('...')`
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  while ((match = requireRegex.exec(source)) !== null) {
    paths.push({path: match[1], line: source.substring(0, match.index).split('\n').length})
  }

  return paths
}

function isTypeOnlyImport(source, importPath) {
  // Check if this import line starts with `import type`
  const escaped = importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const typeImportRegex = new RegExp(`import\\s+type\\s+.*['"]${escaped}['"]`)
  return typeImportRegex.test(source)
}

function isForbiddenPath(importPath, source) {
  // Type-only imports are always allowed (they are erased at compile time)
  if (isTypeOnlyImport(source, importPath)) return false

  // Check if it's an allowed path
  for (const pattern of ALLOWED_IMPORT_PATHS) {
    if (pattern.test(importPath)) return false
  }

  // Check against forbidden patterns
  for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
    if (pattern.test(importPath)) return true
  }

  return false
}

// Read source at module level so describe.skip logic works correctly.
let boundarySource = ''
let boundaryModuleExists = false
try {
  boundarySource = fs.readFileSync(MODULE_PATH, 'utf-8')
  boundaryModuleExists = true
} catch {
  // Module doesn't exist yet -- test will skip.
}

// Only run boundary tests if the module file exists.
// If it doesn't exist yet, the module extraction gap is already
// covered by modeTransitions.test.js skipping all its tests.
const describeIfBoundary = boundaryModuleExists ? describe : describe.skip

describe('P1G-T36: modeTransitions architecture boundary', () => {
  describeIfBoundary('modeTransitions.ts import purity', () => {
    it('P1G-T36: modeTransitions does not import any service/store/adapter/DB', () => {
      const imports = extractImportPaths(boundarySource)

      const violations = imports.filter(
        ({path: p}) => isForbiddenPath(p, boundarySource)
      )

      assert.strictEqual(
        violations.length,
        0,
        `modeTransitions.ts must not import service/store/adapter/DB modules.\n` +
        `Found forbidden imports:\n` +
        violations.map(v => `  line ${v.line}: ${v.path}`).join('\n') +
        `\nAll imports:\n` +
        imports.map(i => `  line ${i.line}: ${i.path}`).join('\n'),
      )
    })

    it('modeTransitions has no dynamic import() calls', () => {
      const dynamicImportRegex = /import\s*\(/g
      const matches = boundarySource.match(dynamicImportRegex)

      assert.strictEqual(
        matches,
        null,
        'modeTransitions.ts must not contain dynamic import() calls',
      )
    })
  })
})
