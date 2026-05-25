const {v4: uuid} = require('uuid')

/**
 * Training domain DB API for Phase 3 tables (recall, checkpoint, comment)
 * and the updateTrainingBadMove function used by the recall checkpoint flow.
 *
 * @param {{ run: Function, queryOne: Function, queryAll: Function, save: Function }} client
 */
function createTrainingDbApi(client) {

  // --- Recall Sessions ---

  function createTrainingRecallSession(session) {
    const id = session.id || uuid()
    const now = new Date().toISOString()
    const attemptId = session.attemptId || null
    const recallPolicy = session.recallPolicy || null
    const expectedMoveIndexesJson = session.expectedMoveIndexes
      ? JSON.stringify(session.expectedMoveIndexes)
      : null
    client.run(`INSERT INTO training_recall_sessions (id, task_id, tab_id, type, source_json,
      start_move, end_move, expected_moves_json, current_move_index, completed, created_at, completed_at,
      attempt_id, recall_policy, expected_move_indexes_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id, session.taskId, session.tabId || null, session.type || 'line_recall',
      JSON.stringify(session.source || {}), session.startMove || 0, session.endMove ?? null,
      JSON.stringify(session.expectedMoves || []), session.currentMoveIndex || 0,
      session.completed ? 1 : 0, now, session.completedAt || null,
      attemptId, recallPolicy, expectedMoveIndexesJson,
    ])
    client.save()
    return rowToTrainingRecallSession(client.queryOne('SELECT * FROM training_recall_sessions WHERE id = ?', [id]))
  }

  function loadTrainingRecallSession(sessionId) {
    const row = client.queryOne('SELECT * FROM training_recall_sessions WHERE id = ?', [sessionId])
    return row ? rowToTrainingRecallSession(row) : null
  }

  function updateTrainingRecallSession(sessionId, patch) {
    const sets = []
    const params = []
    if (patch.currentMoveIndex !== undefined) { sets.push('current_move_index = ?'); params.push(patch.currentMoveIndex) }
    if (patch.completed !== undefined) { sets.push('completed = ?'); params.push(patch.completed ? 1 : 0) }
    if (patch.completedAt !== undefined) { sets.push('completed_at = ?'); params.push(patch.completedAt) }
    params.push(sessionId)
    client.run(`UPDATE training_recall_sessions SET ${sets.join(', ')} WHERE id = ?`, params)
    client.save()
  }

  function listIncompleteTrainingRecallSessions() {
    return client.queryAll('SELECT * FROM training_recall_sessions WHERE completed = 0')
      .map(rowToTrainingRecallSession)
  }

  function rowToTrainingRecallSession(row) {
    // v0.5: prefer attemptId column, fall back to source_json parsing
    let attemptId = row.attempt_id || null
    if (!attemptId && row.source_json) {
      try {
        const source = JSON.parse(row.source_json)
        if (source && source.kind === 'attempt' && source.attemptId) {
          attemptId = source.attemptId
        }
      } catch (_) {}
    }

    const expectedMoves = JSON.parse(row.expected_moves_json || '[]')

    // v0.5: recallPolicy defaults to 'fullLine' when absent (legacy compat)
    const recallPolicy = row.recall_policy || 'fullLine'

    // v0.5: expectedMoveIndexes defaults to [0..N-1] when absent (legacy compat)
    let expectedMoveIndexes
    if (row.expected_move_indexes_json) {
      expectedMoveIndexes = JSON.parse(row.expected_move_indexes_json)
    } else {
      expectedMoveIndexes = expectedMoves.map((_, i) => i)
    }

    return {
      id: row.id,
      taskId: row.task_id,
      tabId: row.tab_id,
      attemptId: attemptId,
      type: row.type,
      source: JSON.parse(row.source_json || '{}'),
      startMove: row.start_move,
      endMove: row.end_move,
      recallPolicy,
      expectedMoveIndexes,
      expectedMoves,
      currentMoveIndex: row.current_move_index,
      completed: !!row.completed,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    }
  }

  // --- Recall Attempts ---

  function createTrainingRecallAttempt(attempt) {
    const id = attempt.id || uuid()
    const now = new Date().toISOString()
    client.run(`INSERT INTO training_recall_attempts (id, recall_session_id, move_number,
      expected_move, user_move, is_correct, hint_level_used, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
      id, attempt.recallSessionId, attempt.moveNumber,
      attempt.expectedMove, attempt.userMove,
      attempt.isCorrect ? 1 : 0, attempt.hintLevelUsed || 0, now,
    ])
    client.save()
    return rowToTrainingRecallAttempt(client.queryOne('SELECT * FROM training_recall_attempts WHERE id = ?', [id]))
  }

  function listTrainingRecallAttemptsBySession(sessionId) {
    return client.queryAll('SELECT * FROM training_recall_attempts WHERE recall_session_id = ? ORDER BY move_number ASC', [sessionId])
      .map(rowToTrainingRecallAttempt)
  }

  function rowToTrainingRecallAttempt(row) {
    return {
      id: row.id,
      recallSessionId: row.recall_session_id,
      moveNumber: row.move_number,
      expectedMove: row.expected_move,
      userMove: row.user_move,
      isCorrect: !!row.is_correct,
      hintLevelUsed: row.hint_level_used,
      createdAt: row.created_at,
    }
  }

  // --- Recall Checkpoints ---

  function createTrainingRecallCheckpoint(checkpoint) {
    const id = checkpoint.id || uuid()
    const now = new Date().toISOString()
    client.run(`INSERT INTO training_recall_checkpoints (id, recall_session_id, bad_move_id,
      status, user_correction_line_json, ai_candidate_lines_json, user_comment_id,
      created_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id, checkpoint.recallSessionId, checkpoint.badMoveId,
      checkpoint.status || 'pending_correction',
      JSON.stringify(checkpoint.userCorrectionLine || []),
      JSON.stringify(checkpoint.aiCandidateLines || []),
      checkpoint.userCommentId || null, now, checkpoint.completedAt || null,
    ])
    client.save()
    return rowToTrainingRecallCheckpoint(client.queryOne('SELECT * FROM training_recall_checkpoints WHERE id = ?', [id]))
  }

  function loadTrainingRecallCheckpoint(checkpointId) {
    const row = client.queryOne('SELECT * FROM training_recall_checkpoints WHERE id = ?', [checkpointId])
    return row ? rowToTrainingRecallCheckpoint(row) : null
  }

  function updateTrainingRecallCheckpoint(checkpointId, patch) {
    const sets = []
    const params = []
    if (patch.status !== undefined) { sets.push('status = ?'); params.push(patch.status) }
    if (patch.userCorrectionLine !== undefined) { sets.push('user_correction_line_json = ?'); params.push(JSON.stringify(patch.userCorrectionLine)) }
    if (patch.aiCandidateLines !== undefined) { sets.push('ai_candidate_lines_json = ?'); params.push(JSON.stringify(patch.aiCandidateLines)) }
    if (patch.userCommentId !== undefined) { sets.push('user_comment_id = ?'); params.push(patch.userCommentId) }
    if (patch.completedAt !== undefined) { sets.push('completed_at = ?'); params.push(patch.completedAt) }
    params.push(checkpointId)
    client.run(`UPDATE training_recall_checkpoints SET ${sets.join(', ')} WHERE id = ?`, params)
    client.save()
  }

  function listTrainingRecallCheckpointsBySession(sessionId) {
    return client.queryAll('SELECT * FROM training_recall_checkpoints WHERE recall_session_id = ? ORDER BY created_at ASC', [sessionId])
      .map(rowToTrainingRecallCheckpoint)
  }

  function rowToTrainingRecallCheckpoint(row) {
    return {
      id: row.id,
      recallSessionId: row.recall_session_id,
      badMoveId: row.bad_move_id,
      status: row.status,
      userCorrectionLine: JSON.parse(row.user_correction_line_json || '[]'),
      aiCandidateLines: JSON.parse(row.ai_candidate_lines_json || '[]'),
      userCommentId: row.user_comment_id,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    }
  }

  // --- Move Comments ---

  function createTrainingMoveComment(comment) {
    const id = comment.id || uuid()
    const now = new Date().toISOString()
    client.run(`INSERT INTO training_move_comments (id, target_json, content, template_answers_json,
      created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`, [
      id, JSON.stringify(comment.target), comment.content,
      comment.templateAnswers ? JSON.stringify(comment.templateAnswers) : null,
      now, now,
    ])
    client.save()
    return rowToTrainingMoveComment(client.queryOne('SELECT * FROM training_move_comments WHERE id = ?', [id]))
  }

  function loadTrainingMoveComment(commentId) {
    const row = client.queryOne('SELECT * FROM training_move_comments WHERE id = ?', [commentId])
    return row ? rowToTrainingMoveComment(row) : null
  }

  function updateTrainingMoveComment(commentId, patch) {
    const now = new Date().toISOString()
    const sets = ['updated_at = ?']
    const params = [now]
    if (patch.content !== undefined) { sets.push('content = ?'); params.push(patch.content) }
    if (patch.templateAnswers !== undefined) { sets.push('template_answers_json = ?'); params.push(JSON.stringify(patch.templateAnswers)) }
    params.push(commentId)
    client.run(`UPDATE training_move_comments SET ${sets.join(', ')} WHERE id = ?`, params)
    client.save()
  }

  function rowToTrainingMoveComment(row) {
    return {
      id: row.id,
      target: JSON.parse(row.target_json || '{}'),
      content: row.content,
      templateAnswers: row.template_answers_json ? JSON.parse(row.template_answers_json) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  // --- Bad Move update (used by recall checkpoint link-back) ---

  function updateTrainingBadMove(badMoveId, patch) {
    const sets = []
    const params = []
    if (patch.recallCheckpointId !== undefined) { sets.push('recall_checkpoint_id = ?'); params.push(patch.recallCheckpointId) }
    if (patch.generatedProblemId !== undefined) { sets.push('generated_problem_id = ?'); params.push(patch.generatedProblemId) }
    if (patch.generatedTaskId !== undefined) { sets.push('generated_task_id = ?'); params.push(patch.generatedTaskId) }
    if (patch.userMarkedAsNotBad !== undefined) { sets.push('user_marked_as_not_bad = ?'); params.push(patch.userMarkedAsNotBad ? 1 : 0) }
    if (sets.length === 0) return
    params.push(badMoveId)
    client.run(`UPDATE training_bad_moves SET ${sets.join(', ')} WHERE id = ?`, params)
    client.save()
  }

  return {
    createTrainingRecallSession, loadTrainingRecallSession,
    updateTrainingRecallSession, listIncompleteTrainingRecallSessions,
    createTrainingRecallAttempt, listTrainingRecallAttemptsBySession,
    createTrainingRecallCheckpoint, loadTrainingRecallCheckpoint,
    updateTrainingRecallCheckpoint, listTrainingRecallCheckpointsBySession,
    createTrainingMoveComment, loadTrainingMoveComment, updateTrainingMoveComment,
    updateTrainingBadMove,
  }
}

module.exports = { createTrainingDbApi }
