/**
 * Safe dynamic import wrapper for TO-BE-CREATED components.
 *
 * Returns null if the module does not exist, instead of throwing.
 * Uses dynamic import() inside an async function to avoid top-level await.
 *
 * specifier must be a project-root-relative path, e.g.:
 *   'src/components/workbench/shell/ModeActions.js'
 */

import {resolve, dirname} from 'path'
import {fileURLToPath} from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '../..')

export async function tryImport(specifier) {
  try {
    const absolutePath = specifier.startsWith('/')
      ? specifier
      : resolve(projectRoot, specifier)
    const mod = await import(absolutePath)
    return mod.default || mod
  } catch {
    return null
  }
}
