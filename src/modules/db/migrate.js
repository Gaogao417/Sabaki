/**
 * Schema migration for the Sabaki training database.
 * Receives a DbClient (from createDbClient) instead of raw sql.js instance.
 *
 * @param {{ run: Function, queryAll: Function, save: Function }} client
 */
function migrate(client) {
  client.run('PRAGMA foreign_keys = ON')

  // --- Legacy tables ---

  client.run(`
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
  client.run(`
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
  client.run(`
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
  client.run(`
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
  client.run(`
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
  client.run(`
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
  client.run(`
    CREATE TABLE IF NOT EXISTS review_schedule (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      item_type TEXT NOT NULL DEFAULT 'problem',
      due_at TEXT NOT NULL,
      interval_days INTEGER NOT NULL DEFAULT 1,
      ease_factor REAL,
      last_result TEXT,
      consecutive_pass_count INTEGER NOT NULL DEFAULT 0,
      total_fail_count INTEGER NOT NULL DEFAULT 0,
      last_reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  client.run(`
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

  client.run('CREATE INDEX IF NOT EXISTS idx_problems_status ON problems(status)')
  client.run('CREATE INDEX IF NOT EXISTS idx_review_schedule_due ON review_schedule(due_at)')
  client.run('CREATE INDEX IF NOT EXISTS idx_recall_sessions_game ON recall_sessions(game_id)')
  client.run('CREATE INDEX IF NOT EXISTS idx_problem_attempts_problem ON problem_attempts(problem_id)')
  client.run('CREATE INDEX IF NOT EXISTS idx_bad_moves_attempt ON bad_moves(attempt_id)')
  client.run('CREATE INDEX IF NOT EXISTS idx_weiqi101_hash ON weiqi101_problems(content_hash)')

  // --- New training domain tables (Phase 2) ---

  client.run(`
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
  client.run(`
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
  client.run(`
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
  client.run(`
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

  client.run('CREATE INDEX IF NOT EXISTS idx_training_tasks_kind ON training_tasks(kind)')
  client.run('CREATE INDEX IF NOT EXISTS idx_training_attempts_task ON training_attempts(task_id)')
  client.run('CREATE INDEX IF NOT EXISTS idx_training_attempts_status ON training_attempts(status)')
  client.run('CREATE INDEX IF NOT EXISTS idx_move_evaluations_attempt ON move_evaluations(attempt_id)')
  client.run('CREATE INDEX IF NOT EXISTS idx_move_evaluations_status ON move_evaluations(status)')
  client.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_move_evaluations_attempt_move ON move_evaluations(attempt_id, move_index)')
  client.run('CREATE INDEX IF NOT EXISTS idx_training_bad_moves_attempt ON training_bad_moves(attempt_id)')
  client.run('CREATE INDEX IF NOT EXISTS idx_training_bad_moves_task ON training_bad_moves(task_id)')
  client.run('CREATE INDEX IF NOT EXISTS idx_training_bad_moves_evaluation ON training_bad_moves(move_evaluation_id)')
  client.run('CREATE INDEX IF NOT EXISTS idx_training_bad_moves_severity ON training_bad_moves(severity)')

  // --- Phase 3: Recall / Checkpoint / Comment tables ---

  client.run(`
    CREATE TABLE IF NOT EXISTS training_recall_sessions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES training_tasks(id),
      tab_id TEXT,
      type TEXT NOT NULL DEFAULT 'line_recall',
      source_json TEXT NOT NULL,
      start_move INTEGER NOT NULL DEFAULT 0,
      end_move INTEGER,
      expected_moves_json TEXT NOT NULL DEFAULT '[]',
      current_move_index INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );
  `)
  client.run(`
    CREATE TABLE IF NOT EXISTS training_recall_attempts (
      id TEXT PRIMARY KEY,
      recall_session_id TEXT NOT NULL REFERENCES training_recall_sessions(id),
      move_number INTEGER NOT NULL,
      expected_move TEXT NOT NULL,
      user_move TEXT NOT NULL,
      is_correct INTEGER NOT NULL DEFAULT 0,
      hint_level_used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
  client.run(`
    CREATE TABLE IF NOT EXISTS training_recall_checkpoints (
      id TEXT PRIMARY KEY,
      recall_session_id TEXT NOT NULL REFERENCES training_recall_sessions(id),
      bad_move_id TEXT NOT NULL REFERENCES training_bad_moves(id),
      status TEXT NOT NULL DEFAULT 'pending_correction',
      user_correction_line_json TEXT NOT NULL DEFAULT '[]',
      ai_candidate_lines_json TEXT NOT NULL DEFAULT '[]',
      user_comment_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );
  `)
  client.run(`
    CREATE TABLE IF NOT EXISTS training_move_comments (
      id TEXT PRIMARY KEY,
      target_json TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      template_answers_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  client.run('CREATE INDEX IF NOT EXISTS idx_training_recall_sessions_task ON training_recall_sessions(task_id)')
  client.run('CREATE INDEX IF NOT EXISTS idx_training_recall_sessions_completed ON training_recall_sessions(completed)')
  client.run('CREATE INDEX IF NOT EXISTS idx_training_recall_attempts_session ON training_recall_attempts(recall_session_id)')
  client.run('CREATE INDEX IF NOT EXISTS idx_training_recall_checkpoints_session ON training_recall_checkpoints(recall_session_id)')
  client.run('CREATE INDEX IF NOT EXISTS idx_training_recall_checkpoints_bad_move ON training_recall_checkpoints(bad_move_id)')
  client.run('CREATE INDEX IF NOT EXISTS idx_training_move_comments_target ON training_move_comments(target_json)')

  // --- Schema migration v2: align with architecture design ---

  function _hasColumn(table, column) {
    const rows = client.queryAll(`PRAGMA table_info(${table})`, [])
    return rows.some(row => row.name === column)
  }

  function _tryAlter(sql) {
    try { client.run(sql) } catch (_) { /* column already exists */ }
  }

  // problems: add snapshot traceability columns
  _tryAlter('ALTER TABLE problems ADD COLUMN source_task_id TEXT')
  _tryAlter('ALTER TABLE problems ADD COLUMN source_attempt_id TEXT')
  _tryAlter('ALTER TABLE problems ADD COLUMN parent_problem_id TEXT')
  _tryAlter('ALTER TABLE problems ADD COLUMN parent_snapshot_reason TEXT')

  // problems: rename source_move_number → source_move_index
  if (_hasColumn('problems', 'source_move_number') && !_hasColumn('problems', 'source_move_index')) {
    try { client.run('ALTER TABLE problems RENAME COLUMN source_move_number TO source_move_index') } catch (_) {}
  }

  // training_tasks: add explicit source columns for indexable queries
  _tryAlter('ALTER TABLE training_tasks ADD COLUMN source_kind TEXT')
  _tryAlter('ALTER TABLE training_tasks ADD COLUMN source_game_id TEXT')
  _tryAlter('ALTER TABLE training_tasks ADD COLUMN source_problem_id TEXT')
  _tryAlter('ALTER TABLE training_tasks ADD COLUMN source_segment_id TEXT')
  _tryAlter('ALTER TABLE training_tasks ADD COLUMN parent_task_id TEXT')
  _tryAlter('ALTER TABLE training_tasks ADD COLUMN parent_attempt_id TEXT')

  client.run('CREATE INDEX IF NOT EXISTS idx_training_tasks_source_kind ON training_tasks(source_kind)')

  // review_schedule: restructure from composite PK to id PK
  if (!_hasColumn('review_schedule', 'id')) {
    client.run(`CREATE TABLE review_schedule_new (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      item_type TEXT NOT NULL DEFAULT 'problem',
      due_at TEXT NOT NULL,
      interval_days INTEGER NOT NULL DEFAULT 1,
      ease_factor REAL,
      last_result TEXT,
      consecutive_pass_count INTEGER NOT NULL DEFAULT 0,
      total_fail_count INTEGER NOT NULL DEFAULT 0,
      last_reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`)
    try {
      client.run(`INSERT INTO review_schedule_new (id, item_id, item_type, due_at, interval_days,
        ease_factor, last_result, consecutive_pass_count, total_fail_count, created_at, updated_at)
        SELECT item_id || '_' || item_type, item_id, item_type, due_at, interval_days,
        ease_factor, last_result, consecutive_pass_count, total_fail_count, datetime('now'), datetime('now')
        FROM review_schedule`)
    } catch (_) {}
    client.run('DROP TABLE review_schedule')
    client.run('ALTER TABLE review_schedule_new RENAME TO review_schedule')
    client.run('CREATE INDEX IF NOT EXISTS idx_review_schedule_due ON review_schedule(due_at)')
    client.run('CREATE INDEX IF NOT EXISTS idx_review_schedule_item ON review_schedule(item_id, item_type)')
  }

  // --- Schema migration v3: Phase 0 v0.5 model convergence ---

  // training_tasks: add v0.5 columns
  _tryAlter('ALTER TABLE training_tasks ADD COLUMN origin_json TEXT')
  _tryAlter('ALTER TABLE training_tasks ADD COLUMN initial_position_sgf TEXT')
  _tryAlter('ALTER TABLE training_tasks ADD COLUMN prompt TEXT')
  _tryAlter('ALTER TABLE training_tasks ADD COLUMN goal TEXT')
  _tryAlter('ALTER TABLE training_tasks ADD COLUMN pass_rule_json TEXT')
  _tryAlter('ALTER TABLE training_tasks ADD COLUMN reference_lines_json TEXT')
  _tryAlter('ALTER TABLE training_tasks ADD COLUMN problem_area_json TEXT')
  _tryAlter('ALTER TABLE training_tasks ADD COLUMN tags_json TEXT')
  _tryAlter('ALTER TABLE training_tasks ADD COLUMN difficulty INTEGER')
  _tryAlter('ALTER TABLE training_tasks ADD COLUMN status TEXT')
  _tryAlter('ALTER TABLE training_tasks ADD COLUMN archived_at TEXT')

  // training_bad_moves: add generated_task_id (v0.5 rename of generated_problem_id)
  _tryAlter('ALTER TABLE training_bad_moves ADD COLUMN generated_task_id TEXT')

  // review_schedule: add task_id (v0.5 replacement for item_id + item_type)
  _tryAlter('ALTER TABLE review_schedule ADD COLUMN task_id TEXT')

  // training_recall_sessions: add attempt_id (v0.5 replacement for source_json)
  _tryAlter('ALTER TABLE training_recall_sessions ADD COLUMN attempt_id TEXT')

  // training_attempts: add move_actors_json (v0.5 new field)
  _tryAlter('ALTER TABLE training_attempts ADD COLUMN move_actors_json TEXT')

  // New indexes for v0.5 columns
  client.run('CREATE INDEX IF NOT EXISTS idx_training_tasks_status ON training_tasks(status)')
  client.run('CREATE INDEX IF NOT EXISTS idx_review_schedule_task ON review_schedule(task_id)')
  client.run('CREATE INDEX IF NOT EXISTS idx_training_recall_sessions_attempt ON training_recall_sessions(attempt_id)')

  client.save()
}

module.exports = { migrate }
