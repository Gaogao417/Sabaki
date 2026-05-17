const initSqlJs = require('sql.js')
const {join} = require('path')
const fs = require('fs')
const {v4: uuid} = require('uuid')

const { createDbClient } = require('./db/client')
const { migrate } = require('./db/migrate')
const { createTrainingDbApi } = require('./db/trainingDbApi')

let client = null
let trainingApi = null
let dbPath = null

async function init(userDataDirectory) {
  if (client) return client

  dbPath = join(userDataDirectory, 'training.db')

  const SQL = await initSqlJs()
  let sqlDb
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath)
    sqlDb = new SQL.Database(buffer)
  } else {
    sqlDb = new SQL.Database()
  }

  client = createDbClient(sqlDb, {
    save: () => {
      if (!sqlDb || !dbPath) return
      const data = sqlDb.export()
      const buffer = Buffer.from(data)
      fs.writeFileSync(dbPath, buffer)
    }
  })

  migrate(client)
  trainingApi = createTrainingDbApi(client)
  return client
}

function save() {
  client && client.save()
}

function queryAll(sql, params = []) {
  return client.queryAll(sql, params)
}

function queryOne(sql, params = []) {
  return client.queryOne(sql, params)
}

function run(sql, params = []) {
  client.run(sql, params)
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

// --- Recall Sessions (legacy) ---

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
      source_game_id = ?, source_move_index = ?, source_problem_id = ?,
      source_task_id = ?, source_attempt_id = ?,
      parent_problem_id = ?, parent_snapshot_reason = ? WHERE id = ?`, [
      problem.title || null, problem.type || 'best_move', problem.positionSgf,
      problem.sideToMove || 'black', problem.positionDescription || '',
      problem.taskGoal || '', JSON.stringify(problem.referenceLines || []),
      JSON.stringify(problem.passRule || {}), JSON.stringify(problem.tags || []),
      problem.difficulty || null, problem.status || 'inbox', now,
      problem.sourceGameId || null, problem.sourceMoveIndex ?? problem.sourceMoveNumber ?? null,
      problem.sourceProblemId || null,
      problem.sourceTaskId || null, problem.sourceAttemptId || null,
      problem.parentProblemId || null, problem.parentSnapshotReason || null,
      id,
    ])
  } else {
    run(`INSERT INTO problems (id, source_game_id, source_move_index, source_problem_id,
      source_task_id, source_attempt_id, parent_problem_id, parent_snapshot_reason,
      type, position_sgf, side_to_move, title, position_description, task_goal,
      reference_lines, pass_rule, tags, difficulty, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id, problem.sourceGameId || null, problem.sourceMoveIndex ?? problem.sourceMoveNumber ?? null,
      problem.sourceProblemId || null,
      problem.sourceTaskId || null, problem.sourceAttemptId || null,
      problem.parentProblemId || null, problem.parentSnapshotReason || null,
      problem.type || 'best_move',
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
    sourceMoveIndex: row.source_move_index ?? row.source_move_number,
    sourceProblemId: row.source_problem_id,
    sourceTaskId: row.source_task_id,
    sourceAttemptId: row.source_attempt_id,
    parentProblemId: row.parent_problem_id,
    parentSnapshotReason: row.parent_snapshot_reason,
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

// --- Bad Moves (legacy) ---

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

function updateProblem(problemId, patch) {
  const now = new Date().toISOString()
  const sets = ['updated_at = ?']
  const params = [now]
  if (patch.type !== undefined) { sets.push('type = ?'); params.push(patch.type) }
  if (patch.positionSgf !== undefined) { sets.push('position_sgf = ?'); params.push(patch.positionSgf) }
  if (patch.sideToMove !== undefined) { sets.push('side_to_move = ?'); params.push(patch.sideToMove) }
  if (patch.title !== undefined) { sets.push('title = ?'); params.push(patch.title) }
  if (patch.positionDescription !== undefined) { sets.push('position_description = ?'); params.push(patch.positionDescription) }
  if (patch.taskGoal !== undefined) { sets.push('task_goal = ?'); params.push(patch.taskGoal) }
  if (patch.referenceLines !== undefined) { sets.push('reference_lines = ?'); params.push(JSON.stringify(patch.referenceLines)) }
  if (patch.passRule !== undefined) { sets.push('pass_rule = ?'); params.push(JSON.stringify(patch.passRule)) }
  if (patch.tags !== undefined) { sets.push('tags = ?'); params.push(JSON.stringify(patch.tags)) }
  if (patch.difficulty !== undefined) { sets.push('difficulty = ?'); params.push(patch.difficulty) }
  if (patch.status !== undefined) { sets.push('status = ?'); params.push(patch.status) }
  if (patch.sourceGameId !== undefined) { sets.push('source_game_id = ?'); params.push(patch.sourceGameId) }
  if (patch.sourceMoveIndex !== undefined) { sets.push('source_move_index = ?'); params.push(patch.sourceMoveIndex) }
  if (patch.sourceProblemId !== undefined) { sets.push('source_problem_id = ?'); params.push(patch.sourceProblemId) }
  if (patch.sourceTaskId !== undefined) { sets.push('source_task_id = ?'); params.push(patch.sourceTaskId) }
  if (patch.sourceAttemptId !== undefined) { sets.push('source_attempt_id = ?'); params.push(patch.sourceAttemptId) }
  if (patch.parentProblemId !== undefined) { sets.push('parent_problem_id = ?'); params.push(patch.parentProblemId) }
  if (patch.parentSnapshotReason !== undefined) { sets.push('parent_snapshot_reason = ?'); params.push(patch.parentSnapshotReason) }
  params.push(problemId)
  run(`UPDATE problems SET ${sets.join(', ')} WHERE id = ?`, params)
  save()
  return rowToProblem(queryOne('SELECT * FROM problems WHERE id = ?', [problemId]))
}

function archiveProblem(problemId) {
  const now = new Date().toISOString()
  run('UPDATE problems SET status = ?, updated_at = ? WHERE id = ?', ['archived', now, problemId])
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
  const now = new Date().toISOString()
  const id = item.id || `${item.itemId || item.taskId}_${item.itemType || 'problem'}`
  const existing = queryOne('SELECT id FROM review_schedule WHERE id = ?', [id])

  const taskId = item.taskId || item.itemId || null
  const itemId = item.itemId || item.taskId || null
  const itemType = item.itemType || (item.taskId ? 'task' : 'problem')

  if (existing) {
    run(`UPDATE review_schedule SET due_at = ?, interval_days = ?, ease_factor = ?,
      last_result = ?, consecutive_pass_count = ?, total_fail_count = ?,
      last_reviewed_at = ?, task_id = ?, updated_at = ? WHERE id = ?`, [
      item.dueAt, item.intervalDays ?? 1, item.easeFactor ?? null,
      item.lastResult || null, item.consecutivePassCount ?? 0,
      item.totalFailCount ?? 0, item.lastReviewedAt || null, taskId, now, id,
    ])
  } else {
    run(`INSERT INTO review_schedule (id, item_id, item_type, task_id, due_at, interval_days, ease_factor,
      last_result, consecutive_pass_count, total_fail_count, last_reviewed_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id, itemId, itemType, taskId, item.dueAt,
      item.intervalDays ?? 1, item.easeFactor ?? null,
      item.lastResult || null, item.consecutivePassCount ?? 0,
      item.totalFailCount ?? 0, item.lastReviewedAt || null, now, now,
    ])
  }
  save()
  return {...item, id, taskId}
}

function findReviewScheduleByItem(itemId, itemType) {
  // v0.5: also check task_id column for direct lookups
  if (itemType === 'task') {
    return queryOne('SELECT * FROM review_schedule WHERE task_id = ?', [itemId])
  }
  return queryOne('SELECT * FROM review_schedule WHERE item_id = ? AND item_type = ?', [itemId, itemType])
}

function updateReviewSchedule(id, patch) {
  const now = new Date().toISOString()
  const sets = ['updated_at = ?']
  const params = [now]
  if (patch.dueAt !== undefined) { sets.push('due_at = ?'); params.push(patch.dueAt) }
  if (patch.intervalDays !== undefined) { sets.push('interval_days = ?'); params.push(patch.intervalDays) }
  if (patch.easeFactor !== undefined) { sets.push('ease_factor = ?'); params.push(patch.easeFactor) }
  if (patch.lastResult !== undefined) { sets.push('last_result = ?'); params.push(patch.lastResult) }
  if (patch.consecutivePassCount !== undefined) { sets.push('consecutive_pass_count = ?'); params.push(patch.consecutivePassCount) }
  if (patch.totalFailCount !== undefined) { sets.push('total_fail_count = ?'); params.push(patch.totalFailCount) }
  if (patch.lastReviewedAt !== undefined) { sets.push('last_reviewed_at = ?'); params.push(patch.lastReviewedAt) }
  params.push(id)
  run(`UPDATE review_schedule SET ${sets.join(', ')} WHERE id = ?`, params)
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

// --- Transaction support ---

function transaction(fn) {
  return client.transaction(fn)
}

// --- Training Tasks ---

function createTrainingTask(task) {
  const id = task.id || uuid()
  const now = new Date().toISOString()
  const source = task.source || {}
  const originJson = task.origin ? JSON.stringify(task.origin) : null
  const passRuleJson = task.passRule ? JSON.stringify(task.passRule) : null
  const referenceLinesJson = task.referenceLines ? JSON.stringify(task.referenceLines) : null
  const problemAreaJson = task.problemArea ? JSON.stringify(task.problemArea) : null
  const tagsJson = task.tags ? JSON.stringify(task.tags) : null
  run(`INSERT INTO training_tasks (id, kind, source_json, source_kind, source_game_id, source_problem_id,
    source_segment_id, parent_task_id, parent_attempt_id,
    root_position_sgf, side_to_move, title,
    origin_json, initial_position_sgf, prompt, goal,
    pass_rule_json, reference_lines_json, problem_area_json, tags_json,
    difficulty, status,
    created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    id, task.kind || 'free_play', JSON.stringify(source), source.kind || null,
    source.gameId || null, source.problemId || null, source.segmentId || null,
    source.parentTaskId || null, source.parentAttemptId || null,
    task.rootPositionSgf, task.sideToMove || null, task.title || null,
    originJson, task.initialPositionSgf || null, task.prompt || null, task.goal || null,
    passRuleJson, referenceLinesJson, problemAreaJson, tagsJson,
    task.difficulty ?? null, task.status || null,
    now, now,
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
  if (patch.source !== undefined) {
    const source = patch.source
    sets.push('source_kind = ?'); params.push(source.kind || null)
    sets.push('source_game_id = ?'); params.push(source.gameId || null)
    sets.push('source_problem_id = ?'); params.push(source.problemId || null)
    sets.push('source_segment_id = ?'); params.push(source.segmentId || null)
    sets.push('parent_task_id = ?'); params.push(source.parentTaskId || null)
    sets.push('parent_attempt_id = ?'); params.push(source.parentAttemptId || null)
  }
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
    origin: row.origin_json ? JSON.parse(row.origin_json) : undefined,
    initialPositionSgf: row.initial_position_sgf,
    prompt: row.prompt,
    goal: row.goal,
    passRule: row.pass_rule_json ? JSON.parse(row.pass_rule_json) : undefined,
    referenceLines: row.reference_lines_json ? JSON.parse(row.reference_lines_json) : undefined,
    problemArea: row.problem_area_json ? JSON.parse(row.problem_area_json) : undefined,
    tags: row.tags_json ? JSON.parse(row.tags_json) : undefined,
    difficulty: row.difficulty,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// --- Training Attempts ---

function createTrainingAttempt(attempt) {
  const id = attempt.id || uuid()
  const moveActorsJson = attempt.moveActors ? JSON.stringify(attempt.moveActors) : null
  run(`INSERT INTO training_attempts (id, task_id, tab_id, started_at, submitted_at, completed_at,
    root_position_sgf, user_line_json, status, result, hint_level_used, recall_completed, analysis_opened,
    move_actors_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    id, attempt.taskId, attempt.tabId || null,
    attempt.startedAt, attempt.submittedAt || null, attempt.completedAt || null,
    attempt.rootPositionSgf, JSON.stringify(attempt.userLine || []),
    attempt.status || 'playing', attempt.result || 'pending',
    attempt.hintLevelUsed || 0, attempt.recallCompleted ? 1 : 0,
    attempt.analysisOpened ? 1 : 0,
    moveActorsJson,
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
    moveActors: row.move_actors_json ? JSON.parse(row.move_actors_json) : undefined,
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

function updateTrainingBadMove(badMoveId, patch) {
  return trainingApi.updateTrainingBadMove(badMoveId, patch)
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
    generatedTaskId: row.generated_task_id || row.generated_problem_id || undefined,
    generatedProblemId: row.generated_problem_id,
    recallCheckpointId: row.recall_checkpoint_id,
    createdAt: row.created_at,
  }
}

// --- Phase 3 delegates to trainingDbApi ---

function createTrainingRecallSession(session) { return trainingApi.createTrainingRecallSession(session) }
function loadTrainingRecallSession(sessionId) { return trainingApi.loadTrainingRecallSession(sessionId) }
function updateTrainingRecallSession(sessionId, patch) { return trainingApi.updateTrainingRecallSession(sessionId, patch) }
function listIncompleteTrainingRecallSessions() { return trainingApi.listIncompleteTrainingRecallSessions() }
function createTrainingRecallAttempt(attempt) { return trainingApi.createTrainingRecallAttempt(attempt) }
function listTrainingRecallAttemptsBySession(sessionId) { return trainingApi.listTrainingRecallAttemptsBySession(sessionId) }
function createTrainingRecallCheckpoint(checkpoint) { return trainingApi.createTrainingRecallCheckpoint(checkpoint) }
function loadTrainingRecallCheckpoint(checkpointId) { return trainingApi.loadTrainingRecallCheckpoint(checkpointId) }
function updateTrainingRecallCheckpoint(checkpointId, patch) { return trainingApi.updateTrainingRecallCheckpoint(checkpointId, patch) }
function listTrainingRecallCheckpointsBySession(sessionId) { return trainingApi.listTrainingRecallCheckpointsBySession(sessionId) }
function createTrainingMoveComment(comment) { return trainingApi.createTrainingMoveComment(comment) }
function loadTrainingMoveComment(commentId) { return trainingApi.loadTrainingMoveComment(commentId) }
function updateTrainingMoveComment(commentId, patch) { return trainingApi.updateTrainingMoveComment(commentId, patch) }

module.exports = {init, save, saveGame, getGame, getRecentGames, saveRecallSession, saveRecallAttempts, saveProblem, getProblem, getProblemsByStatus, updateProblem, archiveProblem, saveProblemAttempt, saveBadMove, updateBadMoveGeneratedProblem, getDueReviews, findReviewScheduleByItem, upsertReviewSchedule, updateReviewSchedule, getDashboardSummary, saveWeiqi101Problem, getWeiqi101Problem, getWeiqi101Problems, getWeiqi101ProblemCount, deleteAllWeiqi101Problems, createTrainingTask, loadTrainingTask, findTrainingTaskBySource, updateTrainingTask, createTrainingAttempt, loadTrainingAttempt, listTrainingAttemptsByTask, updateTrainingAttempt, listIncompleteTrainingAttempts, createMoveEvaluation, updateMoveEvaluation, listMoveEvaluationsByAttempt, listExpiredPendingMoveEvaluations, createTrainingBadMove, loadTrainingBadMove, listTrainingBadMovesByAttempt, listTrainingBadMovesByTask, markTrainingBadMoveAsNotBad, updateTrainingBadMove, createTrainingRecallSession, loadTrainingRecallSession, updateTrainingRecallSession, listIncompleteTrainingRecallSessions, createTrainingRecallAttempt, listTrainingRecallAttemptsBySession, createTrainingRecallCheckpoint, loadTrainingRecallCheckpoint, updateTrainingRecallCheckpoint, listTrainingRecallCheckpointsBySession, createTrainingMoveComment, loadTrainingMoveComment, updateTrainingMoveComment, transaction}
