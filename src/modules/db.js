const initSqlJs = require('sql.js')
const {join} = require('path')
const fs = require('fs')
const {v4: uuid} = require('uuid')

let db = null
let dbPath = null

async function init(userDataDirectory) {
  if (db) return db

  dbPath = join(userDataDirectory, 'training.db')

  const SQL = await initSqlJs()

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  db.run('PRAGMA foreign_keys = ON')
  migrate(db)
  return db
}

function save() {
  if (!db || !dbPath) return
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(dbPath, buffer)
}

function migrate(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      title TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      source TEXT NOT NULL DEFAULT 'play',
      sgf TEXT NOT NULL,
      player_color TEXT NOT NULL DEFAULT 'black',
      opponent_type TEXT NOT NULL DEFAULT 'ai',
      ai_engine TEXT,
      ai_level TEXT,
      result TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      notes TEXT
    );
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS recall_sessions (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL REFERENCES games(id),
      mode TEXT NOT NULL DEFAULT 'full_game',
      start_move INTEGER NOT NULL DEFAULT 0,
      end_move INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS recall_attempts (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES recall_sessions(id),
      move_number INTEGER NOT NULL,
      expected_move TEXT NOT NULL,
      user_move TEXT NOT NULL,
      is_correct INTEGER NOT NULL DEFAULT 0,
      hint_level_used INTEGER NOT NULL DEFAULT 0,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS problems (
      id TEXT PRIMARY KEY,
      source_game_id TEXT REFERENCES games(id),
      source_move_number INTEGER,
      source_problem_id TEXT REFERENCES problems(id),
      type TEXT NOT NULL DEFAULT 'best_move',
      position_sgf TEXT NOT NULL,
      side_to_move TEXT NOT NULL DEFAULT 'black',
      title TEXT,
      position_description TEXT NOT NULL DEFAULT '',
      task_goal TEXT NOT NULL DEFAULT '',
      reference_lines TEXT NOT NULL DEFAULT '[]',
      pass_rule TEXT NOT NULL DEFAULT '{}',
      tags TEXT NOT NULL DEFAULT '[]',
      difficulty INTEGER,
      status TEXT NOT NULL DEFAULT 'inbox',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS problem_attempts (
      id TEXT PRIMARY KEY,
      problem_id TEXT NOT NULL REFERENCES problems(id),
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      submitted_at TEXT,
      user_line TEXT NOT NULL DEFAULT '[]',
      move_evaluations TEXT NOT NULL DEFAULT '[]',
      result TEXT,
      hint_level_used INTEGER NOT NULL DEFAULT 0,
      generated_punishment_problem_ids TEXT NOT NULL DEFAULT '[]'
    );
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS bad_moves (
      id TEXT PRIMARY KEY,
      problem_id TEXT NOT NULL REFERENCES problems(id),
      attempt_id TEXT NOT NULL REFERENCES problem_attempts(id),
      move_index INTEGER NOT NULL,
      move TEXT NOT NULL,
      position_before_move_sgf TEXT NOT NULL,
      position_after_move_sgf TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'minor',
      score_drop REAL,
      winrate_drop REAL,
      punish_side TEXT NOT NULL,
      suggested_punish_move TEXT,
      generated_problem_id TEXT REFERENCES problems(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS review_schedule (
      item_id TEXT NOT NULL,
      item_type TEXT NOT NULL DEFAULT 'problem',
      due_at TEXT NOT NULL,
      interval_days INTEGER NOT NULL DEFAULT 1,
      ease_factor REAL NOT NULL DEFAULT 2.5,
      last_result TEXT,
      consecutive_pass_count INTEGER NOT NULL DEFAULT 0,
      total_fail_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (item_id, item_type)
    );
  `)

  db.run('CREATE INDEX IF NOT EXISTS idx_problems_status ON problems(status)')
  db.run('CREATE INDEX IF NOT EXISTS idx_review_schedule_due ON review_schedule(due_at)')
  db.run('CREATE INDEX IF NOT EXISTS idx_recall_sessions_game ON recall_sessions(game_id)')
  db.run('CREATE INDEX IF NOT EXISTS idx_problem_attempts_problem ON problem_attempts(problem_id)')
  db.run('CREATE INDEX IF NOT EXISTS idx_bad_moves_attempt ON bad_moves(attempt_id)')

  save()
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql)
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

function run(sql, params = []) {
  db.run(sql, params)
}

// --- Games ---

function saveGame(game) {
  const id = game.id || uuid()
  const now = new Date().toISOString()
  const existing = queryOne('SELECT id FROM games WHERE id = ?', [id])

  if (existing) {
    run(`UPDATE games SET title = ?, updated_at = ?, source = ?, sgf = ?,
      player_color = ?, opponent_type = ?, ai_engine = ?, ai_level = ?,
      result = ?, tags = ?, notes = ? WHERE id = ?`, [
      game.title || null, now, game.source || 'play', game.sgf,
      game.playerColor || 'black', game.opponentType || 'ai',
      game.aiEngine || null, game.aiLevel || null,
      game.result || null, JSON.stringify(game.tags || []),
      game.notes || null, id,
    ])
  } else {
    run(`INSERT INTO games (id, title, created_at, updated_at, source, sgf,
      player_color, opponent_type, ai_engine, ai_level, result, tags, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id, game.title || null, now, now, game.source || 'play', game.sgf,
      game.playerColor || 'black', game.opponentType || 'ai',
      game.aiEngine || null, game.aiLevel || null,
      game.result || null, JSON.stringify(game.tags || []),
      game.notes || null,
    ])
  }
  save()
  return {...game, id, updatedAt: now}
}

function getGame(id) {
  const row = queryOne('SELECT * FROM games WHERE id = ?', [id])
  return row ? rowToGame(row) : null
}

function getRecentGames(limit = 20) {
  return queryAll('SELECT * FROM games ORDER BY updated_at DESC LIMIT ?', [limit]).map(rowToGame)
}

function rowToGame(row) {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    source: row.source,
    sgf: row.sgf,
    playerColor: row.player_color,
    opponentType: row.opponent_type,
    aiEngine: row.ai_engine,
    aiLevel: row.ai_level,
    result: row.result,
    tags: JSON.parse(row.tags || '[]'),
    notes: row.notes,
  }
}

// --- Recall Sessions ---

function saveRecallSession(session) {
  const id = session.id || uuid()
  const now = new Date().toISOString()
  const existing = queryOne('SELECT id FROM recall_sessions WHERE id = ?', [id])

  if (existing) {
    run(`UPDATE recall_sessions SET mode = ?, start_move = ?, end_move = ?, completed_at = ? WHERE id = ?`,
      [session.mode || 'full_game', session.startMove || 0, session.endMove || null, session.completedAt || null, id])
  } else {
    run(`INSERT INTO recall_sessions (id, game_id, mode, start_move, end_move, created_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, session.gameId, session.mode || 'full_game', session.startMove || 0, session.endMove || null, now, session.completedAt || null])
  }
  save()
  return {...session, id}
}

function saveRecallAttempts(attempts) {
  for (const a of attempts) {
    run(`INSERT INTO recall_attempts (id, session_id, move_number, expected_move, user_move, is_correct, hint_level_used, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
      a.id || uuid(), a.sessionId, a.moveNumber, a.expectedMove, a.userMove,
      a.isCorrect ? 1 : 0, a.hintLevelUsed || 0, new Date().toISOString(),
    ])
  }
  save()
}

// --- Problems ---

function saveProblem(problem) {
  const id = problem.id || uuid()
  const now = new Date().toISOString()
  const existing = queryOne('SELECT id FROM problems WHERE id = ?', [id])

  if (existing) {
    run(`UPDATE problems SET title = ?, type = ?, position_sgf = ?, side_to_move = ?,
      position_description = ?, task_goal = ?, reference_lines = ?, pass_rule = ?,
      tags = ?, difficulty = ?, status = ?, updated_at = ?,
      source_game_id = ?, source_move_number = ?, source_problem_id = ? WHERE id = ?`, [
      problem.title || null, problem.type || 'best_move', problem.positionSgf,
      problem.sideToMove || 'black', problem.positionDescription || '',
      problem.taskGoal || '', JSON.stringify(problem.referenceLines || []),
      JSON.stringify(problem.passRule || {}), JSON.stringify(problem.tags || []),
      problem.difficulty || null, problem.status || 'inbox', now,
      problem.sourceGameId || null, problem.sourceMoveNumber || null,
      problem.sourceProblemId || null, id,
    ])
  } else {
    run(`INSERT INTO problems (id, source_game_id, source_move_number, source_problem_id,
      type, position_sgf, side_to_move, title, position_description, task_goal,
      reference_lines, pass_rule, tags, difficulty, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id, problem.sourceGameId || null, problem.sourceMoveNumber || null,
      problem.sourceProblemId || null, problem.type || 'best_move',
      problem.positionSgf, problem.sideToMove || 'black',
      problem.title || null, problem.positionDescription || '',
      problem.taskGoal || '', JSON.stringify(problem.referenceLines || []),
      JSON.stringify(problem.passRule || {}), JSON.stringify(problem.tags || []),
      problem.difficulty || null, problem.status || 'inbox', now, now,
    ])
  }
  save()
  return {...problem, id, updatedAt: now}
}

function getProblem(id) {
  const row = queryOne('SELECT * FROM problems WHERE id = ?', [id])
  return row ? rowToProblem(row) : null
}

function getProblemsByStatus(status, limit = 50) {
  return queryAll('SELECT * FROM problems WHERE status = ? ORDER BY updated_at DESC LIMIT ?', [status, limit]).map(rowToProblem)
}

function rowToProblem(row) {
  return {
    id: row.id,
    sourceGameId: row.source_game_id,
    sourceMoveNumber: row.source_move_number,
    sourceProblemId: row.source_problem_id,
    type: row.type,
    positionSgf: row.position_sgf,
    sideToMove: row.side_to_move,
    title: row.title,
    positionDescription: row.position_description,
    taskGoal: row.task_goal,
    referenceLines: JSON.parse(row.reference_lines || '[]'),
    passRule: JSON.parse(row.pass_rule || '{}'),
    tags: JSON.parse(row.tags || '[]'),
    difficulty: row.difficulty,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// --- Problem Attempts ---

function saveProblemAttempt(attempt) {
  const id = attempt.id || uuid()
  const existing = queryOne('SELECT id FROM problem_attempts WHERE id = ?', [id])

  if (existing) {
    run(`UPDATE problem_attempts SET submitted_at = ?, user_line = ?,
      move_evaluations = ?, result = ?, hint_level_used = ?,
      generated_punishment_problem_ids = ? WHERE id = ?`, [
      attempt.submittedAt || null, JSON.stringify(attempt.userLine || []),
      JSON.stringify(attempt.moveEvaluations || []), attempt.result || null,
      attempt.hintLevelUsed || 0,
      JSON.stringify(attempt.generatedPunishmentProblemIds || []), id,
    ])
  } else {
    run(`INSERT INTO problem_attempts (id, problem_id, started_at, submitted_at,
      user_line, move_evaluations, result, hint_level_used, generated_punishment_problem_ids)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id, attempt.problemId, new Date().toISOString(),
      attempt.submittedAt || null,
      JSON.stringify(attempt.userLine || []),
      JSON.stringify(attempt.moveEvaluations || []), attempt.result || null,
      attempt.hintLevelUsed || 0,
      JSON.stringify(attempt.generatedPunishmentProblemIds || []),
    ])
  }
  save()
  return {...attempt, id}
}

// --- Bad Moves ---

function saveBadMove(badMove) {
  const id = badMove.id || uuid()
  run(`INSERT INTO bad_moves (id, problem_id, attempt_id, move_index, move,
    position_before_move_sgf, position_after_move_sgf, severity,
    score_drop, winrate_drop, punish_side, suggested_punish_move,
    generated_problem_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    id, badMove.problemId, badMove.attemptId, badMove.moveIndex,
    badMove.move, badMove.positionBeforeMoveSgf, badMove.positionAfterMoveSgf,
    badMove.severity || 'minor', badMove.scoreDrop || null,
    badMove.winrateDrop || null, badMove.punishSide,
    badMove.suggestedPunishMove || null, badMove.generatedProblemId || null,
    new Date().toISOString(),
  ])
  save()
  return {...badMove, id}
}

function updateBadMoveGeneratedProblem(badMoveId, generatedProblemId) {
  run('UPDATE bad_moves SET generated_problem_id = ? WHERE id = ?', [generatedProblemId, badMoveId])
  save()
}

// --- Review Schedule ---

function getDueReviews() {
  const now = new Date().toISOString()
  return queryAll(`SELECT rs.*, p.type as problem_type, p.title as problem_title, p.status as problem_status
    FROM review_schedule rs
    INNER JOIN problems p ON p.id = rs.item_id AND rs.item_type = 'problem'
    WHERE rs.due_at <= ? AND p.status = 'active'
    ORDER BY rs.due_at ASC`, [now])
}

function upsertReviewSchedule(item) {
  const existing = queryOne('SELECT item_id FROM review_schedule WHERE item_id = ? AND item_type = ?', [item.itemId, item.itemType || 'problem'])

  if (existing) {
    run(`UPDATE review_schedule SET due_at = ?, interval_days = ?, ease_factor = ?,
      last_result = ?, consecutive_pass_count = ?, total_fail_count = ?
      WHERE item_id = ? AND item_type = ?`, [
      item.dueAt, item.intervalDays || 1, item.easeFactor || 2.5,
      item.lastResult || null, item.consecutivePassCount || 0,
      item.totalFailCount || 0, item.itemId, item.itemType || 'problem',
    ])
  } else {
    run(`INSERT INTO review_schedule (item_id, item_type, due_at, interval_days, ease_factor,
      last_result, consecutive_pass_count, total_fail_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
      item.itemId, item.itemType || 'problem', item.dueAt,
      item.intervalDays || 1, item.easeFactor || 2.5,
      item.lastResult || null, item.consecutivePassCount || 0,
      item.totalFailCount || 0,
    ])
  }
  save()
}

// --- Dashboard ---

function getDashboardSummary() {
  const now = new Date().toISOString()
  const dueRow = queryOne(`SELECT COUNT(*) as cnt FROM review_schedule rs
    INNER JOIN problems p ON p.id = rs.item_id AND rs.item_type = 'problem'
    WHERE rs.due_at <= ? AND p.status = 'active'`, [now])
  const inboxRow = queryOne('SELECT COUNT(*) as cnt FROM problems WHERE status = ?', ['inbox'])
  const punishRow = queryOne(`SELECT COUNT(*) as cnt FROM problems
    WHERE type = 'punishment' AND created_at >= datetime('now', '-7 days')`)

  return {
    dueCount: (dueRow && dueRow.cnt) || 0,
    inboxCount: (inboxRow && inboxRow.cnt) || 0,
    recentPunishmentCount: (punishRow && punishRow.cnt) || 0,
    recentGames: getRecentGames(5),
  }
}

module.exports = {init, saveGame, getGame, getRecentGames, saveRecallSession, saveRecallAttempts, saveProblem, getProblem, getProblemsByStatus, saveProblemAttempt, saveBadMove, updateBadMoveGeneratedProblem, getDueReviews, upsertReviewSchedule, getDashboardSummary}
