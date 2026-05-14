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

  db.run(`
    CREATE TABLE IF NOT EXISTS weiqi101_problems (
      problem_id TEXT PRIMARY KEY,
      problem_code TEXT NOT NULL DEFAULT '',
      rank TEXT,
      problem_url TEXT NOT NULL DEFAULT '',
      thumbnail_url TEXT,
      correct_count INTEGER,
      wrong_count INTEGER,
      decoded_payload TEXT NOT NULL DEFAULT '',
      sgf TEXT NOT NULL DEFAULT '',
      synced_at TEXT NOT NULL DEFAULT (datetime('now')),
      content_hash TEXT NOT NULL DEFAULT ''
    );
  `)

  db.run('CREATE INDEX IF NOT EXISTS idx_problems_status ON problems(status)')
  db.run('CREATE INDEX IF NOT EXISTS idx_review_schedule_due ON review_schedule(due_at)')
  db.run('CREATE INDEX IF NOT EXISTS idx_recall_sessions_game ON recall_sessions(game_id)')
  db.run('CREATE INDEX IF NOT EXISTS idx_problem_attempts_problem ON problem_attempts(problem_id)')
  db.run('CREATE INDEX IF NOT EXISTS idx_bad_moves_attempt ON bad_moves(attempt_id)')
  db.run('CREATE INDEX IF NOT EXISTS idx_weiqi101_hash ON weiqi101_problems(content_hash)')

  // --- New training domain tables (Phase 2) ---

  db.run(`
    CREATE TABLE IF NOT EXISTS training_tasks (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      source_json TEXT NOT NULL,
      root_position_sgf TEXT NOT NULL,
      side_to_move TEXT,
      title TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS training_attempts (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES training_tasks(id),
      tab_id TEXT,
      started_at TEXT NOT NULL,
      submitted_at TEXT,
      completed_at TEXT,
      root_position_sgf TEXT NOT NULL,
      user_line_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'playing',
      result TEXT NOT NULL DEFAULT 'pending',
      hint_level_used INTEGER NOT NULL DEFAULT 0,
      recall_completed INTEGER NOT NULL DEFAULT 0,
      analysis_opened INTEGER NOT NULL DEFAULT 0
    );
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS move_evaluations (
      id TEXT PRIMARY KEY,
      attempt_id TEXT NOT NULL REFERENCES training_attempts(id),
      move_index INTEGER NOT NULL,
      move TEXT NOT NULL,
      position_before_hash TEXT,
      position_after_hash TEXT,
      position_before_sgf TEXT,
      position_after_sgf TEXT,
      before_score_lead REAL,
      after_score_lead REAL,
      score_drop REAL,
      before_winrate REAL,
      after_winrate REAL,
      winrate_drop REAL,
      engine_suggested_move TEXT,
      engine_suggested_line_json TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      evaluated_at TEXT
    );
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS training_bad_moves (
      id TEXT PRIMARY KEY,
      move_evaluation_id TEXT NOT NULL REFERENCES move_evaluations(id),
      attempt_id TEXT NOT NULL REFERENCES training_attempts(id),
      task_id TEXT NOT NULL REFERENCES training_tasks(id),
      move_index INTEGER NOT NULL,
      severity TEXT NOT NULL,
      punish_side TEXT NOT NULL,
      position_before_sgf TEXT,
      position_after_sgf TEXT,
      user_marked_as_not_bad INTEGER NOT NULL DEFAULT 0,
      generated_problem_id TEXT,
      recall_checkpoint_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  db.run('CREATE INDEX IF NOT EXISTS idx_training_tasks_kind ON training_tasks(kind)')
  db.run('CREATE INDEX IF NOT EXISTS idx_training_attempts_task ON training_attempts(task_id)')
  db.run('CREATE INDEX IF NOT EXISTS idx_training_attempts_status ON training_attempts(status)')
  db.run('CREATE INDEX IF NOT EXISTS idx_move_evaluations_attempt ON move_evaluations(attempt_id)')
  db.run('CREATE INDEX IF NOT EXISTS idx_move_evaluations_status ON move_evaluations(status)')
  db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_move_evaluations_attempt_move ON move_evaluations(attempt_id, move_index)')
  db.run('CREATE INDEX IF NOT EXISTS idx_training_bad_moves_attempt ON training_bad_moves(attempt_id)')
  db.run('CREATE INDEX IF NOT EXISTS idx_training_bad_moves_task ON training_bad_moves(task_id)')
  db.run('CREATE INDEX IF NOT EXISTS idx_training_bad_moves_evaluation ON training_bad_moves(move_evaluation_id)')
  db.run('CREATE INDEX IF NOT EXISTS idx_training_bad_moves_severity ON training_bad_moves(severity)')

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

// --- 101weiqi Cached Problems ---

function saveWeiqi101Problem(problem) {
  const now = new Date().toISOString()
  const existing = queryOne('SELECT problem_id FROM weiqi101_problems WHERE problem_id = ?', [problem.problemId])

  if (existing) {
    run(`UPDATE weiqi101_problems SET problem_code = ?, rank = ?, problem_url = ?,
      thumbnail_url = ?, correct_count = ?, wrong_count = ?, decoded_payload = ?,
      sgf = ?, synced_at = ?, content_hash = ? WHERE problem_id = ?`, [
      problem.problemCode || '', problem.rank || null, problem.problemUrl || '',
      problem.thumbnailUrl || null, problem.correctCount || null,
      problem.wrongCount || null, problem.decodedPayload || '',
      problem.sgf || '', problem.syncedAt || now, problem.contentHash || '',
      problem.problemId,
    ])
  } else {
    run(`INSERT INTO weiqi101_problems (problem_id, problem_code, rank, problem_url,
      thumbnail_url, correct_count, wrong_count, decoded_payload, sgf, synced_at, content_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      problem.problemId, problem.problemCode || '', problem.rank || null,
      problem.problemUrl || '', problem.thumbnailUrl || null,
      problem.correctCount || null, problem.wrongCount || null,
      problem.decodedPayload || '', problem.sgf || '',
      problem.syncedAt || now, problem.contentHash || '',
    ])
  }
  save()
  return problem
}

function getWeiqi101Problem(problemId) {
  const row = queryOne('SELECT * FROM weiqi101_problems WHERE problem_id = ?', [problemId])
  return row ? rowToWeiqi101Problem(row) : null
}

function getWeiqi101Problems() {
  return queryAll('SELECT * FROM weiqi101_problems ORDER BY synced_at DESC').map(rowToWeiqi101Problem)
}

function getWeiqi101ProblemCount() {
  const row = queryOne('SELECT COUNT(*) as cnt FROM weiqi101_problems')
  return (row && row.cnt) || 0
}

function deleteAllWeiqi101Problems() {
  run('DELETE FROM weiqi101_problems')
  save()
}

function rowToWeiqi101Problem(row) {
  return {
    problemId: row.problem_id,
    problemCode: row.problem_code,
    rank: row.rank,
    problemUrl: row.problem_url,
    thumbnailUrl: row.thumbnail_url,
    correctCount: row.correct_count,
    wrongCount: row.wrong_count,
    decodedPayload: row.decoded_payload,
    sgf: row.sgf,
    syncedAt: row.synced_at,
    contentHash: row.content_hash,
  }
}

// --- Training Tasks ---

function createTrainingTask(task) {
  const id = task.id || uuid()
  const now = new Date().toISOString()
  run(`INSERT INTO training_tasks (id, kind, source_json, root_position_sgf, side_to_move, title, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
    id, task.kind, JSON.stringify(task.source), task.rootPositionSgf,
    task.sideToMove || null, task.title || null, now, now,
  ])
  save()
  return {...rowToTrainingTask(queryOne('SELECT * FROM training_tasks WHERE id = ?', [id])), id}
}

function loadTrainingTask(taskId) {
  const row = queryOne('SELECT * FROM training_tasks WHERE id = ?', [taskId])
  return row ? rowToTrainingTask(row) : null
}

function findTrainingTaskBySource(source) {
  const sourceJson = JSON.stringify(source)
  const row = queryOne('SELECT * FROM training_tasks WHERE source_json = ? LIMIT 1', [sourceJson])
  return row ? rowToTrainingTask(row) : null
}

function updateTrainingTask(taskId, patch) {
  const now = new Date().toISOString()
  const sets = []
  const params = []
  if (patch.kind !== undefined) { sets.push('kind = ?'); params.push(patch.kind) }
  if (patch.source !== undefined) { sets.push('source_json = ?'); params.push(JSON.stringify(patch.source)) }
  if (patch.rootPositionSgf !== undefined) { sets.push('root_position_sgf = ?'); params.push(patch.rootPositionSgf) }
  if (patch.sideToMove !== undefined) { sets.push('side_to_move = ?'); params.push(patch.sideToMove) }
  if (patch.title !== undefined) { sets.push('title = ?'); params.push(patch.title) }
  sets.push('updated_at = ?'); params.push(now)
  params.push(taskId)
  run(`UPDATE training_tasks SET ${sets.join(', ')} WHERE id = ?`, params)
  save()
}

function rowToTrainingTask(row) {
  return {
    id: row.id,
    kind: row.kind,
    source: JSON.parse(row.source_json || '{}'),
    rootPositionSgf: row.root_position_sgf,
    sideToMove: row.side_to_move,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// --- Training Attempts ---

function createTrainingAttempt(attempt) {
  const id = attempt.id || uuid()
  run(`INSERT INTO training_attempts (id, task_id, tab_id, started_at, submitted_at, completed_at,
    root_position_sgf, user_line_json, status, result, hint_level_used, recall_completed, analysis_opened)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    id, attempt.taskId, attempt.tabId || null,
    attempt.startedAt, attempt.submittedAt || null, attempt.completedAt || null,
    attempt.rootPositionSgf, JSON.stringify(attempt.userLine || []),
    attempt.status || 'playing', attempt.result || 'pending',
    attempt.hintLevelUsed || 0, attempt.recallCompleted ? 1 : 0,
    attempt.analysisOpened ? 1 : 0,
  ])
  save()
  return {...rowToTrainingAttempt(queryOne('SELECT * FROM training_attempts WHERE id = ?', [id])), id}
}

function loadTrainingAttempt(attemptId) {
  const row = queryOne('SELECT * FROM training_attempts WHERE id = ?', [attemptId])
  return row ? rowToTrainingAttempt(row) : null
}

function listTrainingAttemptsByTask(taskId) {
  return queryAll('SELECT * FROM training_attempts WHERE task_id = ? ORDER BY started_at ASC', [taskId]).map(rowToTrainingAttempt)
}

function updateTrainingAttempt(attemptId, patch) {
  const sets = []
  const params = []
  if (patch.tabId !== undefined) { sets.push('tab_id = ?'); params.push(patch.tabId) }
  if (patch.submittedAt !== undefined) { sets.push('submitted_at = ?'); params.push(patch.submittedAt) }
  if (patch.completedAt !== undefined) { sets.push('completed_at = ?'); params.push(patch.completedAt) }
  if (patch.userLine !== undefined) { sets.push('user_line_json = ?'); params.push(JSON.stringify(patch.userLine)) }
  if (patch.status !== undefined) { sets.push('status = ?'); params.push(patch.status) }
  if (patch.result !== undefined) { sets.push('result = ?'); params.push(patch.result) }
  if (patch.hintLevelUsed !== undefined) { sets.push('hint_level_used = ?'); params.push(patch.hintLevelUsed) }
  if (patch.recallCompleted !== undefined) { sets.push('recall_completed = ?'); params.push(patch.recallCompleted ? 1 : 0) }
  if (patch.analysisOpened !== undefined) { sets.push('analysis_opened = ?'); params.push(patch.analysisOpened ? 1 : 0) }
  params.push(attemptId)
  run(`UPDATE training_attempts SET ${sets.join(', ')} WHERE id = ?`, params)
  save()
}

function listIncompleteTrainingAttempts() {
  return queryAll(`SELECT * FROM training_attempts WHERE status IN ('playing', 'submitted', 'recalling', 'analyzing')`)
    .map(rowToTrainingAttempt)
}

function rowToTrainingAttempt(row) {
  return {
    id: row.id,
    taskId: row.task_id,
    tabId: row.tab_id,
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
    completedAt: row.completed_at,
    rootPositionSgf: row.root_position_sgf,
    userLine: JSON.parse(row.user_line_json || '[]'),
    status: row.status,
    result: row.result,
    hintLevelUsed: row.hint_level_used,
    recallCompleted: !!row.recall_completed,
    analysisOpened: !!row.analysis_opened,
  }
}

// --- Move Evaluations ---

function createMoveEvaluation(evaluation) {
  const id = evaluation.id || uuid()
  run(`INSERT INTO move_evaluations (id, attempt_id, move_index, move,
    position_before_hash, position_after_hash, position_before_sgf, position_after_sgf,
    before_score_lead, after_score_lead, score_drop,
    before_winrate, after_winrate, winrate_drop,
    engine_suggested_move, engine_suggested_line_json, status, created_at, evaluated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    id, evaluation.attemptId, evaluation.moveIndex, evaluation.move,
    evaluation.positionBeforeHash || null, evaluation.positionAfterHash || null,
    evaluation.positionBeforeSgf || null, evaluation.positionAfterSgf || null,
    evaluation.beforeScoreLead ?? null, evaluation.afterScoreLead ?? null, evaluation.scoreDrop ?? null,
    evaluation.beforeWinrate ?? null, evaluation.afterWinrate ?? null, evaluation.winrateDrop ?? null,
    evaluation.engineSuggestedMove || null,
    evaluation.engineSuggestedLine ? JSON.stringify(evaluation.engineSuggestedLine) : null,
    evaluation.status || 'pending', evaluation.createdAt || new Date().toISOString(),
    evaluation.evaluatedAt || null,
  ])
  save()
  return {...rowToMoveEvaluation(queryOne('SELECT * FROM move_evaluations WHERE id = ?', [id])), id}
}

function updateMoveEvaluation(evaluationId, patch) {
  const sets = []
  const params = []
  if (patch.positionBeforeSgf !== undefined) { sets.push('position_before_sgf = ?'); params.push(patch.positionBeforeSgf) }
  if (patch.positionAfterSgf !== undefined) { sets.push('position_after_sgf = ?'); params.push(patch.positionAfterSgf) }
  if (patch.beforeScoreLead !== undefined) { sets.push('before_score_lead = ?'); params.push(patch.beforeScoreLead) }
  if (patch.afterScoreLead !== undefined) { sets.push('after_score_lead = ?'); params.push(patch.afterScoreLead) }
  if (patch.scoreDrop !== undefined) { sets.push('score_drop = ?'); params.push(patch.scoreDrop) }
  if (patch.beforeWinrate !== undefined) { sets.push('before_winrate = ?'); params.push(patch.beforeWinrate) }
  if (patch.afterWinrate !== undefined) { sets.push('after_winrate = ?'); params.push(patch.afterWinrate) }
  if (patch.winrateDrop !== undefined) { sets.push('winrate_drop = ?'); params.push(patch.winrateDrop) }
  if (patch.engineSuggestedMove !== undefined) { sets.push('engine_suggested_move = ?'); params.push(patch.engineSuggestedMove) }
  if (patch.engineSuggestedLine !== undefined) { sets.push('engine_suggested_line_json = ?'); params.push(JSON.stringify(patch.engineSuggestedLine)) }
  if (patch.status !== undefined) { sets.push('status = ?'); params.push(patch.status) }
  if (patch.evaluatedAt !== undefined) { sets.push('evaluated_at = ?'); params.push(patch.evaluatedAt) }
  params.push(evaluationId)
  run(`UPDATE move_evaluations SET ${sets.join(', ')} WHERE id = ?`, params)
  save()
}

function listMoveEvaluationsByAttempt(attemptId) {
  return queryAll('SELECT * FROM move_evaluations WHERE attempt_id = ? ORDER BY move_index ASC', [attemptId])
    .map(rowToMoveEvaluation)
}

function listExpiredPendingMoveEvaluations(now) {
  return queryAll(`SELECT * FROM move_evaluations WHERE status = 'pending' AND created_at < ?`, [now])
    .map(rowToMoveEvaluation)
}

function rowToMoveEvaluation(row) {
  return {
    id: row.id,
    attemptId: row.attempt_id,
    moveIndex: row.move_index,
    move: row.move,
    positionBeforeHash: row.position_before_hash,
    positionAfterHash: row.position_after_hash,
    positionBeforeSgf: row.position_before_sgf,
    positionAfterSgf: row.position_after_sgf,
    beforeScoreLead: row.before_score_lead,
    afterScoreLead: row.after_score_lead,
    scoreDrop: row.score_drop,
    beforeWinrate: row.before_winrate,
    afterWinrate: row.after_winrate,
    winrateDrop: row.winrate_drop,
    engineSuggestedMove: row.engine_suggested_move,
    engineSuggestedLine: row.engine_suggested_line_json ? JSON.parse(row.engine_suggested_line_json) : undefined,
    status: row.status,
    createdAt: row.created_at,
    evaluatedAt: row.evaluated_at,
  }
}

// --- Training Bad Moves (Phase 2) ---

function createTrainingBadMove(badMove) {
  const id = badMove.id || uuid()
  run(`INSERT INTO training_bad_moves (id, move_evaluation_id, attempt_id, task_id,
    move_index, severity, punish_side, position_before_sgf, position_after_sgf,
    user_marked_as_not_bad, generated_problem_id, recall_checkpoint_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    id, badMove.moveEvaluationId, badMove.attemptId, badMove.taskId,
    badMove.moveIndex, badMove.severity, badMove.punishSide,
    badMove.positionBeforeSgf || null, badMove.positionAfterSgf || null,
    badMove.userMarkedAsNotBad ? 1 : 0,
    badMove.generatedProblemId || null, badMove.recallCheckpointId || null,
    new Date().toISOString(),
  ])
  save()
  return {...rowToTrainingBadMove(queryOne('SELECT * FROM training_bad_moves WHERE id = ?', [id])), id}
}

function loadTrainingBadMove(badMoveId) {
  const row = queryOne('SELECT * FROM training_bad_moves WHERE id = ?', [badMoveId])
  return row ? rowToTrainingBadMove(row) : null
}

function listTrainingBadMovesByAttempt(attemptId) {
  return queryAll('SELECT * FROM training_bad_moves WHERE attempt_id = ? ORDER BY move_index ASC', [attemptId])
    .map(rowToTrainingBadMove)
}

function listTrainingBadMovesByTask(taskId) {
  return queryAll('SELECT * FROM training_bad_moves WHERE task_id = ? ORDER BY move_index ASC', [taskId])
    .map(rowToTrainingBadMove)
}

function markTrainingBadMoveAsNotBad(badMoveId) {
  run('UPDATE training_bad_moves SET user_marked_as_not_bad = 1 WHERE id = ?', [badMoveId])
  save()
}

function rowToTrainingBadMove(row) {
  return {
    id: row.id,
    moveEvaluationId: row.move_evaluation_id,
    attemptId: row.attempt_id,
    taskId: row.task_id,
    moveIndex: row.move_index,
    severity: row.severity,
    punishSide: row.punish_side,
    positionBeforeSgf: row.position_before_sgf,
    positionAfterSgf: row.position_after_sgf,
    userMarkedAsNotBad: !!row.user_marked_as_not_bad,
    generatedProblemId: row.generated_problem_id,
    recallCheckpointId: row.recall_checkpoint_id,
    createdAt: row.created_at,
  }
}

module.exports = {init, saveGame, getGame, getRecentGames, saveRecallSession, saveRecallAttempts, saveProblem, getProblem, getProblemsByStatus, saveProblemAttempt, saveBadMove, updateBadMoveGeneratedProblem, getDueReviews, upsertReviewSchedule, getDashboardSummary, saveWeiqi101Problem, getWeiqi101Problem, getWeiqi101Problems, getWeiqi101ProblemCount, deleteAllWeiqi101Problems, createTrainingTask, loadTrainingTask, findTrainingTaskBySource, updateTrainingTask, createTrainingAttempt, loadTrainingAttempt, listTrainingAttemptsByTask, updateTrainingAttempt, listIncompleteTrainingAttempts, createMoveEvaluation, updateMoveEvaluation, listMoveEvaluationsByAttempt, listExpiredPendingMoveEvaluations, createTrainingBadMove, loadTrainingBadMove, listTrainingBadMovesByAttempt, listTrainingBadMovesByTask, markTrainingBadMoveAsNotBad}
