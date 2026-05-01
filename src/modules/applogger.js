import winston from 'winston'
import {resolve, join} from 'path'

import i18n from '../i18n.js'
import {showMessageBox} from './dialog.js'
import * as helper from './helper.js'

const t = i18n.context('applogger')

const setting = {
  get: (key) => window.sabaki?.setting?.get(key),
}

let initialized = false
let isAppendingConsoleLog = false
let winstonLogger = null
let filename = null

const LEVELS = ['error', 'warn', 'info', 'debug']

function safeSerialize(value, depth = 0, seen = null) {
  if (depth > 4) return '[MaxDepth]'
  if (value == null || typeof value === 'boolean' || typeof value === 'number') {
    return value
  }

  if (typeof value === 'string') {
    return value.length > 1000 ? value.slice(0, 1000) + '...[truncated]' : value
  }

  if (value instanceof Error) {
    return {name: value.name, message: value.message, stack: value.stack}
  }

  // Skip large objects
  if (
    value &&
    typeof value === 'object' &&
    (value.constructor?.name === 'GameTree' || value.constructor?.name === 'Board')
  ) {
    return `[${value.constructor.name}]`
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => safeSerialize(v, depth + 1, seen))
  }

  if (typeof value === 'object') {
    if (!seen) seen = new WeakSet()
    if (seen.has(value)) return '[Circular]'
    seen.add(value)

    let result = {}
    let keys = Object.keys(value).slice(0, 20)
    for (let key of keys) {
      try {
        result[key] = safeSerialize(value[key], depth + 1, seen)
      } catch (e) {
        result[key] = '[Error serializing]'
      }
    }
    return result
  }

  try {
    return String(value)
  } catch (e) {
    return '[Unknown]'
  }
}

function formatTimestamp(isoString) {
  let d = new Date(isoString)
  let h = String(d.getHours()).padStart(2, '0')
  let m = String(d.getMinutes()).padStart(2, '0')
  let s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

function generateFilename() {
  let now = new Date()
  let t = {
    year: now.getFullYear(),
    month: String(1 + now.getMonth()).padStart(2, '0'),
    day: String(now.getDate()).padStart(2, '0'),
    hour: String(now.getHours()).padStart(2, '0'),
    minute: String(now.getMinutes()).padStart(2, '0'),
    second: String(now.getSeconds()).padStart(2, '0'),
  }
  let pid = process.pid
  return `sabaki_app_${t.year}-${t.month}-${t.day}-${t.hour}-${t.minute}-${t.second}_${pid}.log`
}

function getModeFromState() {
  try {
    return window.sabaki?.state?.mode || 'unknown'
  } catch (e) {
    return 'unknown'
  }
}

export function init() {
  initialized = true
  winstonLogger = winston.createLogger({
    format: winston.format.combine(
      winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss.SSS'}),
      winston.format.json(),
    ),
    handleExceptions: false,
    exitOnError: false,
    levels: {error: 0, warn: 1, info: 2, debug: 3},
  })
}

export function log(level, category, event, message, data = null, options = {}) {
  if (!LEVELS.includes(level)) level = 'info'

  if (!initialized) {
    try {
      console[level]?.(`[applogger] ${category}.${event}: ${message}`, data)
    } catch (e) {}
    return
  }

  let loggingEnabled = setting.get('app.logging_enabled')
  let fileEnabled = setting.get('app.logging_file_enabled')
  let fileLevel = setting.get('app.logging_level') || 'info'
  let fileLevelIndex = LEVELS.indexOf(fileLevel)

  if (!loggingEnabled && !fileEnabled) return

  let mode = options.mode != null ? options.mode : getModeFromState()
  let timestamp = new Date().toISOString()

  let entry = {
    appLog: true,
    level,
    category,
    event,
    message,
    data: data != null ? safeSerialize(data) : null,
    timestamp,
    mode,
  }

  // Append to UI consoleLog
  if (loggingEnabled && !isAppendingConsoleLog) {
    try {
      isAppendingConsoleLog = true
      let sabaki = window.sabaki
      if (sabaki && sabaki.setState) {
        let maxLength = setting.get('console.max_history_count') || 1000
        sabaki.setState(({consoleLog}) => {
          let newLog = consoleLog.slice(Math.max(consoleLog.length - maxLength + 1, 0))
          newLog.push(entry)
          return {consoleLog: newLog}
        })
      }
    } catch (e) {
      // Silently fail — never let logging break the app
    } finally {
      isAppendingConsoleLog = false
    }
  }

  // Write to file
  if (fileEnabled && winstonLogger && LEVELS.indexOf(level) <= fileLevelIndex) {
    try {
      winstonLogger.log(level, '', {
        ts: timestamp,
        level,
        category,
        event,
        mode,
        message,
        data: entry.data,
      })
    } catch (e) {}
  }
}

export function updateFilePath() {
  if (!initialized || !winstonLogger) return true

  let fileEnabled = setting.get('app.logging_file_enabled')
  if (!fileEnabled) {
    // Remove all file transports
    winstonLogger.transports.forEach((t) => winstonLogger.remove(t))
    return true
  }

  let logPath = setting.get('app.logging_file_path')
  if (!logPath) return true // null path means disabled

  if (!helper.isWritableDirectory(logPath)) {
    showMessageBox(
      t(
        [
          'You have an invalid log folder for application logging in your settings.',
          'Please make sure the log directory is valid and writable, or disable file logging.',
        ].join('\n\n'),
      ),
      'warning',
    )
    return false
  }

  let newDir = resolve(logPath)

  if (filename == null) {
    filename = generateFilename()
  }

  try {
    let newPath = join(newDir, filename)
    let matching = winstonLogger.transports.find(
      (transport) =>
        transport.filename === filename && resolve(transport.dirname) === newDir,
    )

    if (matching != null) return true

    let notMatching = winstonLogger.transports.find(
      (transport) =>
        transport.filename !== filename || resolve(transport.dirname) !== newDir,
    )

    winstonLogger.add(new winston.transports.File({filename: newPath}))

    if (notMatching != null) {
      winstonLogger.remove(notMatching)
    }

    return true
  } catch (err) {
    return false
  }
}

export function rotate() {
  filename = null
}

export function close() {
  try {
    if (winstonLogger) winstonLogger.close()
  } catch (err) {}
}

export {formatTimestamp}
