/**
 * Pure LoggerService — no window, no UI, no engineService.
 *
 * Owns: in-memory log buffer, subscriber notifications, optional writer dispatch.
 * Does NOT own: settings, winston, file paths, UI panels.
 */

/** @typedef {'debug'|'info'|'warn'|'error'} LogLevel */

const LEVELS = /** @type {const} */ (['error', 'warn', 'info', 'debug'])
const LEVEL_INDEX = {error: 0, warn: 1, info: 2, debug: 3}

/**
 * @param {object} [config]
 * @param {number}  [config.bufferSize=500]
 * @param {LogLevel} [config.minLevel='debug']
 * @param {{ write(entry: object): void }[]} [config.writers]
 */
export function createLoggerService(config = {}) {
  let {
    bufferSize = 500,
    minLevel = 'debug',
    writers = [],
  } = config

  /** @type {object[]} */
  let buffer = []
  let minLevelIndex = LEVEL_INDEX[minLevel] ?? 3
  /** @type {Set<(entry: object) => void>} */
  let subscribers = new Set()
  let closed = false

  function shouldLog(level) {
    return LEVEL_INDEX[level] != null && LEVEL_INDEX[level] <= minLevelIndex
  }

  /**
   * @param {Omit<import('./index.js').LogEntry, 'time'> & { time?: number }} entry
   */
  function append(entry) {
    if (closed) return

    let fullEntry = {
      ...entry,
      time: entry.time ?? Date.now(),
    }

    buffer.push(fullEntry)
    while (buffer.length > bufferSize) buffer.shift()

    for (let sub of subscribers) {
      try { sub(fullEntry) } catch (_) { /* never let a subscriber break logging */ }
    }

    for (let w of writers) {
      try { w.write(fullEntry) } catch (_) {}
    }
  }

  // --- Convenience methods ---

  function debug(source, message, data) {
    if (shouldLog('debug')) append({level: 'debug', source, message, data: data ?? null})
  }
  function info(source, message, data) {
    if (shouldLog('info')) append({level: 'info', source, message, data: data ?? null})
  }
  function warn(source, message, data) {
    if (shouldLog('warn')) append({level: 'warn', source, message, data: data ?? null})
  }
  function error(source, message, data) {
    if (shouldLog('error')) append({level: 'error', source, message, data: data ?? null})
  }

  // --- Subscription ---

  /**
   * @param {(entry: object) => void} listener
   * @returns {() => void} unsubscribe
   */
  function subscribe(listener) {
    subscribers.add(listener)
    return () => { subscribers.delete(listener) }
  }

  /** @returns {object[]} snapshot */
  function getEntries() {
    return buffer.slice()
  }

  function close() {
    closed = true
    subscribers.clear()
  }

  /**
   * Reconfigure on the fly (e.g. when settings change).
   * Does NOT clear the buffer.
   */
  function reconfigure(next = {}) {
    if (next.bufferSize != null) bufferSize = next.bufferSize
    if (next.minLevel != null) minLevelIndex = LEVEL_INDEX[next.minLevel] ?? 3
    if (next.writers != null) writers = next.writers
  }

  function clear() {
    buffer = []
    for (let sub of subscribers) {
      try { sub(null) } catch (_) {}
    }
  }

  return {
    debug,
    info,
    warn,
    error,
    log: append,
    subscribe,
    getEntries,
    clear,
    close,
    reconfigure,
  }
}
