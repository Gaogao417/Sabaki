/**
 * Console writer adapter for LoggerService.
 *
 * In tests: Mocha captures console output — every log entry is visible in
 * the terminal, surfacing bugs that would otherwise be buried in the UI-only
 * GtpConsole panel.
 *
 * In the running app: output goes to DevTools console via console.log/warn/error.
 */

const LEVEL_FN = {
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console),
  debug: console.log.bind(console),
}

/**
 * @param {object} [opts]
 * @param {() => string} [opts.minLevel]  — returns level name; entries below are skipped
 */
export function createConsoleWriter(opts = {}) {
  const levelIndex = {error: 0, warn: 1, info: 2, debug: 3}
  const getMinLevel = opts.minLevel ?? (() => 'debug')
  const minIndex = () => levelIndex[getMinLevel()] ?? 3

  /**
   * @param {import('./index.js').LogEntry} entry
   */
  function write(entry) {
    if ((levelIndex[entry.level] ?? 3) > minIndex()) return

    const ts = new Date(entry.time).toISOString().slice(11, 23)
    const fn = LEVEL_FN[entry.level] ?? console.log
    const prefix = `[${ts}][${entry.level.toUpperCase()}][${entry.source}]`

    if (entry.data != null) {
      fn(prefix, entry.message, entry.data)
    } else {
      fn(prefix, entry.message)
    }
  }

  return {write}
}
