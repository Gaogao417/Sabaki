/**
 * Thin SQL execution layer wrapping a sql.js Database instance.
 * Decouples SQL helpers from module-level singleton state and file persistence.
 *
 * @param {object} sqlJsDatabase - A sql.js Database instance
 * @param {{ save?: () => void }} [options]
 */
function createDbClient(sqlJsDatabase, options = {}) {
  const _db = sqlJsDatabase
  const _save = options.save || (() => {})

  function run(sql, params = []) {
    _db.run(sql, params)
  }

  function queryAll(sql, params = []) {
    const stmt = _db.prepare(sql)
    stmt.bind(params)
    const rows = []
    while (stmt.step()) {
      rows.push(stmt.getAsObject())
    }
    stmt.free()
    return rows
  }

  function queryOne(sql, params = []) {
    const rows = queryAll(sql, params)
    return rows.length > 0 ? rows[0] : null
  }

  function transaction(fn) {
    _db.run('BEGIN')
    try {
      const result = fn()
      _db.run('COMMIT')
      _save()
      return result
    } catch (e) {
      _db.run('ROLLBACK')
      throw e
    }
  }

  function close() {
    _db.close()
  }

  return { run, queryOne, queryAll, transaction, save: _save, close }
}

module.exports = { createDbClient }
