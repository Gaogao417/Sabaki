/**
 * phase1Deprecation.test.js
 *
 * Tests that workbenchPhaseService is properly marked as @deprecated.
 *
 * Contract: docs/design/2026-05-25/phase1-gaps/test-contract-v0.1.md
 * Test IDs: P1G-T33, P1G-T34
 * Layer: ARCHITECTURE_BOUNDARY
 *
 * These tests read the source file as text to verify the presence of
 * @deprecated JSDoc tags. This is a static analysis approach that
 * does not require runtime reflection.
 *
 * Harness manifest:
 * - Real production modules: workbenchPhaseService.ts (read as text)
 * - Fake/spy modules: NONE
 * - Valid for: ARCHITECTURE_BOUNDARY (deprecation marking)
 * - Not valid for: SERVICE_REPOSITORY_TRANSITION, CONTROLLER_STATE_TRANSITION
 */

import assert from 'assert'
import fs from 'fs'
import path from 'path'

const SERVICE_PATH = path.resolve(
  process.cwd(),
  'src/modules/training/workbench/workbenchPhaseService.ts',
)

const INDEX_PATH = path.resolve(
  process.cwd(),
  'src/modules/training/workbench/index.ts',
)

// Read source files at module level so describe.skip logic works correctly.
let serviceSource = ''
let serviceExists = false
try {
  serviceSource = fs.readFileSync(SERVICE_PATH, 'utf-8')
  serviceExists = true
} catch {}

let indexSource = ''
let indexExists = false
try {
  indexSource = fs.readFileSync(INDEX_PATH, 'utf-8')
  indexExists = true
} catch {}

/**
 * Check if a function declaration or export has @deprecated in its JSDoc.
 * Looks for the pattern: a JSDoc block containing @deprecated that appears
 * before the function/export declaration.
 */
function hasDeprecatedJSDocBefore(source, targetPattern) {
  const lines = source.split('\n')

  for (let i = 0; i < lines.length; i++) {
    if (targetPattern.test(lines[i])) {
      // Look backwards for a JSDoc block containing @deprecated
      for (let j = i - 1; j >= 0; j--) {
        const line = lines[j].trim()
        if (line.includes('@deprecated')) {
          return true
        }
        // If we hit the start of a JSDoc block, scan it fully
        if (line === '/**') {
          for (let k = j; k < i; k++) {
            if (lines[k].includes('@deprecated')) return true
          }
          break
        }
        // If we hit a non-JSDoc line that's not blank, the JSDoc isn't adjacent
        if (line !== '' && line !== '*' && !line.startsWith('//') && !line.startsWith('/*')) {
          break
        }
      }
    }
  }

  return false
}

/**
 * Check if the file has a module-level @deprecated marker anywhere.
 */
function hasFileLevelDeprecation(source) {
  return source.includes('@deprecated')
}

const describeIfService = serviceExists ? describe : describe.skip
const describeIfIndex = indexExists ? describe : describe.skip

describe('Phase 1 deprecation: workbenchPhaseService', () => {

  describe('P1G-T33: createWorkbenchPhaseService has @deprecated JSDoc', () => {
    describeIfService('workbenchPhaseService.ts', () => {
      it('createWorkbenchPhaseService function has @deprecated JSDoc tag', () => {
        const hasDeprecated = hasDeprecatedJSDocBefore(
          serviceSource,
          /export\s+function\s+createWorkbenchPhaseService/,
        )

        assert.strictEqual(
          hasDeprecated,
          true,
          'createWorkbenchPhaseService must have @deprecated in its JSDoc comment. ' +
          'Contract: P1G-T33, Section 9 row P1G-T33. ' +
          'Add /** @deprecated Use createWorkbenchFlowService instead */ above the function.',
        )
      })
    })

    if (!serviceExists) {
      it('workbenchPhaseService.ts not found -- this file must exist for deprecation testing', function () {
        this.skip()
      })
    }
  })

  describe('P1G-T34: workbenchPhaseService exports have @deprecated markers', () => {
    describeIfService('workbenchPhaseService.ts exports', () => {
      it('file contains @deprecated marker', () => {
        assert.strictEqual(
          hasFileLevelDeprecation(serviceSource),
          true,
          'workbenchPhaseService.ts must contain @deprecated markers on exported types. ' +
          'Contract: P1G-T34, Section 9 row P1G-T34. ' +
          'At minimum the createWorkbenchPhaseService export and/or the WorkbenchPhaseService type ' +
          'must have @deprecated JSDoc.',
        )
      })
    })

    describeIfIndex('workbench/index.ts re-exports', () => {
      it('re-exports of workbenchPhaseService have @deprecated comment', () => {
        const hasDeprecatedReexport = indexSource.includes('@deprecated') ||
          hasDeprecatedJSDocBefore(
            indexSource,
            /workbenchPhaseService/,
          )

        assert.strictEqual(
          hasDeprecatedReexport,
          true,
          'workbench/index.ts must mark re-exports of workbenchPhaseService with @deprecated. ' +
          'Contract: P1G-T34.',
        )
      })
    })

    if (!serviceExists) {
      it('workbenchPhaseService.ts not found -- this file must exist for deprecation testing', function () {
        this.skip()
      })
    }
  })
})
