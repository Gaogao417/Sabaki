/**
 * Winston file writer adapter for LoggerService.
 *
 * LoggerService calls writer.write(entry); this adapter bridges
 * to winston's file transport. All settings / path logic lives
 * in the adapter, NOT inside LoggerService.
 */

import winston from 'winston'
import {resolve, join} from 'path'

/**
 * @param {object} opts
 * @param {() => string|null} opts.getLogPath   — returns configured dir or null
 * @param {() => boolean} opts.isFileEnabled
 * @param {() => string} opts.getFileLevel
 * @param {(dir: string) => boolean} opts.isWritableDir
 * @param {(msg: string, type: string) => void} opts.showWarning
 */
export function createWinstonWriter(opts) {
  let winstonLogger = null
  let filename = null

  function generateFilename() {
    let now = new Date()
    let parts = {
      year: now.getFullYear(),
      month: String(1 + now.getMonth()).padStart(2, '0'),
      day: String(now.getDate()).padStart(2, '0'),
      hour: String(now.getHours()).padStart(2, '0'),
      minute: String(now.getMinutes()).padStart(2, '0'),
      second: String(now.getSeconds()).padStart(2, '0'),
    }
    let pid = process.pid
    return `sabaki_app_${parts.year}-${parts.month}-${parts.day}-${parts.hour}-${parts.minute}-${parts.second}_${pid}.log`
  }

  function ensureLogger() {
    if (winstonLogger) return
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

  /**
   * Write a LogEntry to file.
   * @param {import('./index.js').LogEntry} entry
   */
  function write(entry) {
    if (!opts.isFileEnabled()) return
    ensureLogger()
    if (!winstonLogger) return

    let fileLevel = opts.getFileLevel()
    let fileLevelIndex = {error: 0, warn: 1, info: 2, debug: 3}[fileLevel] ?? 2
    let entryLevelIndex = {error: 0, warn: 1, info: 2, debug: 3}[entry.level] ?? 2

    if (entryLevelIndex > fileLevelIndex) return

    winstonLogger.log(entry.level, '', {
      ts: entry.time instanceof Date ? entry.time.toISOString() : entry.time,
      level: entry.level,
      source: entry.source,
      message: entry.message,
      data: entry.data,
      mode: entry.mode,
    })
  }

  /** Sync file transport path with settings. Returns true on success. */
  function updateFilePath() {
    if (!winstonLogger) return true

    if (!opts.isFileEnabled()) {
      winstonLogger.transports.forEach((t) => winstonLogger.remove(t))
      return true
    }

    let logPath = opts.getLogPath()
    if (!logPath) return true

    if (!opts.isWritableDir(logPath)) {
      opts.showWarning(
        'You have an invalid log folder for application logging in your settings.\n\n'
        + 'Please make sure the log directory is valid and writable, or disable file logging.',
        'warning',
      )
      return false
    }

    let newDir = resolve(logPath)
    if (filename == null) filename = generateFilename()

    try {
      let newPath = join(newDir, filename)
      let matching = winstonLogger.transports.find(
        (t) => t.filename === filename && resolve(t.dirname) === newDir,
      )
      if (matching != null) return true

      winstonLogger.add(new winston.transports.File({filename: newPath}))

      let notMatching = winstonLogger.transports.find(
        (t) => t.filename !== filename || resolve(t.dirname) !== newDir,
      )
      if (notMatching != null) winstonLogger.remove(notMatching)
      return true
    } catch (_) {
      return false
    }
  }

  function rotate() {
    filename = null
  }

  function close() {
    try { if (winstonLogger) winstonLogger.close() } catch (_) {}
  }

  return {write, updateFilePath, rotate, close}
}
