/**
 * Pure formatting helpers for log entries. No side effects, no window/UI.
 */

/**
 * Format an ISO timestamp string or epoch ms to HH:MM:SS.
 * @param {string|number} time
 * @returns {string}
 */
export function formatTimestamp(time) {
  let d = typeof time === 'number' ? new Date(time) : new Date(time)
  let h = String(d.getHours()).padStart(2, '0')
  let m = String(d.getMinutes()).padStart(2, '0')
  let s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

/**
 * Build the legacy `source` string from the old (level, category, event) tuple.
 *
 *   ('info', 'engine', 'engine.attached')  => 'engine.attached'
 *   ('warn', 'engine', 'sync.failed')      => 'engine.sync.failed'
 */
export function toSource(category, event) {
  return event.startsWith(`${category}.`) ? event : `${category}.${event}`
}
