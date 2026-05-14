/**
 * Safe serialization utility for logging.
 * shared between LoggerService and the legacy facade without duplication.
 */

export function safeSerialize(value, depth = 0, seen = null) {
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
      } catch (_) {
        result[key] = '[Error serializing]'
      }
    }
    return result
  }

  try {
    return String(value)
  } catch (_) {
    return '[Unknown]'
  }
}
