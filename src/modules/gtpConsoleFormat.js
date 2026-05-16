/**
 * Pure functions for formatting GTP console log entries as plain text.
 * Extracted from GtpConsole.copyAllLogs() for testability.
 */

export function formatGtpEntry(entry) {
  let {name, command, response} = entry
  let lines = []

  if (command) {
    let cmdText =
      command.id != null ? `${command.id} ${command.name}` : command.name
    let args = (command.args || []).join(' ')
    if (args) cmdText += ` ${args}`
    lines.push(`${name}> ${cmdText}`)
  }

  if (response) {
    let prefix = response.error ? '?' : '='
    let idStr = response.id != null ? response.id : ''
    let content = typeof response.content === 'string' ? response.content : ''
    lines.push(`${prefix}${idStr} ${content}`)
  }

  return lines
}

export function formatGtpConsoleLogs({
  consoleLog = [],
  appLogs = [],
  logFilter = 'gtp',
  formatTimestamp = (time) => new Date(time).toISOString(),
} = {}) {
  let lines = []
  let combined = []

  if (logFilter === 'all' || logFilter === 'gtp') {
    combined.push(...consoleLog.map((entry) => ({...entry, appLog: false})))
  }

  if (logFilter === 'all' || logFilter === 'app') {
    combined.push(...appLogs.map((entry) => ({...entry, appLog: true})))
  }

  combined.sort((a, b) => (a.time || 0) - (b.time || 0))

  for (let entry of combined) {
    if (entry.appLog) {
      let time = formatTimestamp(entry.time || Date.now())
      let data = entry.data ? ` ${JSON.stringify(entry.data)}` : ''
      lines.push(
        `${time} ${entry.level.toUpperCase()} ${entry.source || entry.category} ${entry.message}${data}`,
      )
    } else {
      lines.push(...formatGtpEntry(entry))
    }
  }

  return lines.join('\n')
}
