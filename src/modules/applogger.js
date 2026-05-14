/**
 * Legacy applogger facade.
 *
 * Preserves the old `log(level, category, event, message, data, options)` API
 * so that callers that haven't migrated yet keep working. Internally forwards
 * everything to the injected LoggerService.
 *
 * Phase 1: window.sabaki, engineService.appendConsoleLog, and direct setting
 * reads have been removed. All routing goes through LoggerService.
 */

import {safeSerialize, toSource} from './logger/index.js'

const LEVELS = ['error', 'warn', 'info', 'debug']

/** @type {import('./logger/LoggerService.js').ReturnType<typeof import('./logger/LoggerService.js').createLoggerService> | null} */
let loggerService = null

/** @type {{ write: (entry: object) => void } | null} */
let winstonWriter = null

/**
 * Wire up the facade. Called once from sabaki.js after LoggerService is created.
 *
 * @param {object} services
 * @param {ReturnType<typeof import('./logger/LoggerService.js').createLoggerService>} services.loggerService
 * @param {{ write: (entry: object) => void, updateFilePath: () => boolean, rotate: () => void, close: () => void } | null} [services.winstonWriter]
 */
export function init(services) {
  loggerService = services.loggerService
  winstonWriter = services.winstonWriter ?? null
}

/**
 * Legacy log API — translates (level, category, event) → LoggerService source.
 *
 * @param {string} level
 * @param {string} category
 * @param {string} event
 * @param {string} message
 * @param {unknown} [data]
 * @param {{ mode?: string }} [options]
 */
export function log(level, category, event, message, data = null, options = {}) {
  if (!LEVELS.includes(level)) level = 'info'

  if (!loggerService) {
    try {
      console[level]?.(`[applogger] ${category}.${event}: ${message}`, data)
    } catch (_) {}
    return
  }

  let source = toSource(category, event)

  // Always output to browser console
  try {
    console.log(`[applogger] [${level}] ${source}: ${message}`, data ?? '')
  } catch (_) {}

  let entry = {
    level,
    source,
    message,
    data: data != null ? safeSerialize(data) : null,
    mode: options.mode ?? null,
    // Legacy compat fields so existing UI still renders correctly
    appLog: true,
    category,
    event,
    timestamp: new Date().toISOString(),
  }

  loggerService.log(entry)
}

export function updateFilePath() {
  return winstonWriter?.updateFilePath() ?? true
}

export function rotate() {
  winstonWriter?.rotate()
}

export function close() {
  winstonWriter?.close()
}

export {formatTimestamp} from './logger/logFormatting.js'
