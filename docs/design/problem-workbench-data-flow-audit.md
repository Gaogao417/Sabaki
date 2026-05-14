# Problem Workbench 数据流审计

> 审计日期：2026-05-14
> 范围：做题模式（Problem Mode）涉及的全部后端数据、前端状态及其数据流

---

## 一、后端数据实体清单（7 张表）

| # | 表名 | 记录什么 | 行数级 |
|---|------|---------|--------|
| 1 | `games` | 对局记录（SGF + 元数据） | 10²–10³ |
| 2 | `recall_sessions` | 每次背谱 session | 10²–10³ |
| 3 | `recall_attempts` | session 内每手的对错 | 10³–10⁴ |
| 4 | `problems` | 题目（含惩罚题） | 10²–10⁴ |
| 5 | `problem_attempts` | 每次做题记录 | 10²–10⁴ |
| 6 | `bad_moves` | 坏棋记录 | 10²–10⁴ |
| 7 | `review_schedule` | 间隔重复调度 | 同 problems |

存储：SQLite（sql.js），Electron IPC 桥接，文件 `{userData}/training.db`。

---

## 二、前端状态字段清单

### A. Recall 状态（6 个字段）

| 字段 | 类型 | 默认值 | 谁写 | 谁读 |
|------|------|--------|------|------|
| `recallSession` | `object\|null` | `null` | trainingStore.startRecallSession | RecallBar, setMode guard |
| `recallMoveIndex` | `number` | `0` | trainingStore.submitRecallAnswer/skip | RecallBar |
| `recallExpectedMoves` | `array` | `[]` | trainingStore.startRecallSession | trainingStore.submitRecallAnswer |
| `recallUserAttempts` | `array` | `[]` | trainingStore.submitRecallAnswer/skip | endRecallSession→db |
| `recallShowHint` | `boolean` | `false` | trainingStore.showRecallHint / submitRecallAnswer | RecallBar |
| `recallCompleted` | `boolean` | `false` | trainingStore.checkComplete | RecallBar |

### B. Problem 状态（7 个字段）

| 字段 | 类型 | 默认值 | 谁写 | 谁读 |
|------|------|--------|------|------|
| `problemSession` | `object\|null` | `null` | startProblem / exitProblemMode | ProblemBar, handleProblemMove, setMode guard |
| `problemAttempt` | `object\|null` | `null` | startProblem / handleProblemMove / undoProblemMove / submitProblemAttempt | ProblemBar, handleProblemMove |
| `problemWorkspace` | `GameTree\|null` | `null` | startProblem | （未使用——直接用 gameTrees[gameIndex]） |
| `problemEvalCache` | `array` | `[]` | handleProblemMove / undoProblemMove | submitProblemAttempt |
| `problemBadMoves` | `array` | `[]` | handleProblemMove / undoProblemMove | ProblemBar, submitProblemAttempt |
| `problemSubmitted` | `boolean` | `false` | submitProblemAttempt / exitProblemMode | ProblemBar, handleProblemMove guard |
| `problemResult` | `string\|null` | `null` | submitProblemAttempt / exitProblemMode | ProblemBar |

### C. Review 状态（3 个字段）

| 字段 | 类型 | 默认值 | 谁写 | 谁读 |
|------|------|--------|------|------|
| `reviewQueue` | `array` | `[]` | startReviewSession | advanceReview |
| `reviewCurrentIndex` | `number` | `0` | startReviewSession / advanceReview | ProblemBar |
| `reviewTotalDue` | `number` | `0` | startReviewSession | ProblemBar |

---

## 三、逐实体的前后端数据流

### 1. Game

```
┌─ DB ─────────────────────────────────────────────────────────┐
│  games: id, title, sgf, source, player_color, result, tags   │
└───────────────────────────────────────────────────────────────┘
   ↑ saveGame()                    ↓ getGame(id)
   │                               ↓ getRecentGames(limit)
   │                               ↓ getDashboardSummary()
   │
   │  Play结束 / SGF导入            startRecallSession需要读SGF
   │  → sabaki.saveGameToDb()       → db.getGame() → parse SGF
   │                                → 生成 recallExpectedMoves
   └────── gameTrees (内存) ◄───── sgf.parse() → loadGameTrees()
```

**数据流**：先写 DB，再从 DB 读回 SGF 用于 Recall/Problem。前端 `gameTrees` 是内存态，不持久化。

**问题**：`problemWorkspace` 字段在 startProblem 中赋值但后续代码直接用 `gameTrees[gameIndex]`，`problemWorkspace` 实际未被消费，是冗余字段。

---

### 2. RecallSession + RecallAttempt

```
┌─ DB ──────────────────────────────────────────────────────────────┐
│  recall_sessions: id, game_id, mode, start_move, completed_at     │
│  recall_attempts: id, session_id, move_number, expected, user,    │
│                   is_correct, hint_level_used                      │
└────────────────────────────────────────────────────────────────────┘
   ↑ saveRecallSession()    ↑ saveRecallAttempts()    ↓ (无直接读回)
   │                         │
   │ startRecallSession()    │ endRecallSession()
   │ → db.saveRecallSession  │ → db.saveRecallAttempts(所有attempts)
   │ → setState({             │ → setMode('analysis')
   │     recallSession,       │
   │     recallMoveIndex: 0,  │
   │     recallExpectedMoves, │
   │     recallUserAttempts   │
   │   })                     │
   │                          │
   │ ── 用户每下一手 ──────────│
   │ submitRecallAnswer()     │
   │ → recallUserAttempts.push│
   │ → setState(patch)        │
   │ → 不写DB，纯内存        │
   └──────────────────────────┘
```

**数据流**：session 开始时写一次 DB（拿到 id），中间全部在前端内存中累积，结束时批量写回 attempts。

**问题**：中途崩溃会丢失所有 attempts。MVP 可接受，后续可考虑逐手持久化。

---

### 3. Problem（题目本体）

```
┌─ DB ──────────────────────────────────────────────────────────────────────┐
│  problems: id, source_game_id, type, position_sgf, side_to_move,         │
│            title, position_description, task_goal, reference_lines,       │
│            pass_rule, tags, difficulty, status, source_problem_id         │
└───────────────────────────────────────────────────────────────────────────┘
   ↑ saveProblem()                         ↓ getProblem(id)
   │                                       ↓ getProblemsByStatus(status)
   │                                       ↓ getDueReviews() → JOIN
   │
   │ 创建来源（3个入口）：                    消费方：
   │ 1. generatePunishmentProblem()         startProblem() → db.getProblem()
   │    → submitProblemAttempt() 内调用      → parse SGF → loadGameTrees
   │ 2. saveProblemFromEditor()（用户手动）   → setState({problemSession: problem})
   │ 3. 101weiqi同步（未接入）               TrainingDashboard → db.getProblemsByStatus
   └──────────────────────────────────────────────────────┘
```

**数据流**：题目是"写一次、读多次"的实体。创建时写入 DB，做题时只读。

**问题**：
- `reference_lines` 和 `pass_rule` 在 DB 中是 JSON 字符串，但 `handleProblemMove` 中完全没有用到 `pass_rule`——坏棋阈值硬编码在代码里（2/5/8 目），不走 pass_rule 配置。
- 101weiqi 同步的题目尚未有 adapter 转成 `saveProblem()` 接受的格式。

---

### 4. ProblemAttempt + MoveEvaluation

```
┌─ DB ──────────────────────────────────────────────────────────────────┐
│  problem_attempts: id, problem_id, started_at, submitted_at,          │
│                    user_line(JSON), move_evaluations(JSON), result,    │
│                    hint_level_used, generated_punishment_ids(JSON)     │
└───────────────────────────────────────────────────────────────────────┘
   ↑ saveProblemAttempt()           ↑ saveProblemAttempt() (final)
   │                                 │
   │ startProblem()                  │ submitProblemAttempt()
   │ → db.saveProblemAttempt({       │ → 计算 result (pass/soft_pass/fail)
   │     userLine: [],               │ → db.saveProblemAttempt(updated)
   │     moveEvaluations: []         │ → 写 bad_moves
   │   })                            │ → 生成惩罚题
   │ → setState({                    │ → 更新 review_schedule
   │     problemAttempt: saved,      │ → setState({
   │     problemEvalCache: [],       │     problemSubmitted: true,
   │     problemBadMoves: []         │     problemResult,
   │   })                            │     problemAttempt: final
   │                                 │   })
   │ ── 每下一手 ──────────────────  │
   │ handleProblemMove()             │
   │ → problemEvalCache.push(eval)   │
   │ → problemBadMoves.push(bad)     │
   │ → problemAttempt.userLine.push  │
   │ → setState(patch)               │
   │ → 不写DB，纯内存               │
   │                                 │
   │ undoProblemMove()               │
   │ → pop from cache/line/badMoves  │
   │ → setState(patch)               │
   └─────────────────────────────────┘
```

**数据流**：与 Recall 相同模式——开始时写 DB 拿 id，中间内存累积，提交时最终写回。

**关键问题**：
- `move_evaluations` 同时存在于两个地方：前端 `problemEvalCache`（数组）和 DB `problem_attempts.move_evaluations`（JSON 字符串）。提交时把 evalCache 完整写入 attempt，这是对的，但运行中 `problemAttempt.moveEvaluations` 和 `problemEvalCache` 是**同一份数据的两份拷贝**，存在一致性风险。`undoProblemMove` 只清了 `problemEvalCache`，没有同步清 `problemAttempt.moveEvaluations`。

---

### 5. BadMove

```
┌─ DB ──────────────────────────────────────────────────────────────────┐
│  bad_moves: id, problem_id, attempt_id, move_index, move,            │
│             position_before/after_sgf, severity, score_drop,         │
│             winrate_drop, punish_side, suggested_punish_move,        │
│             generated_problem_id(FK→problems)                        │
└───────────────────────────────────────────────────────────────────────┘
   ↑ saveBadMove()                    ↑ updateBadMoveGeneratedProblem()
   │                                  │
   │ submitProblemAttempt()           │ generatePunishmentProblem()
   │ → 遍历 problemBadMoves          │ → db.saveProblem(punishment)
   │ → db.saveBadMove(每条)           │ → db.updateBadMoveGeneratedProblem(
   │ → position_before/after_sgf      │     badMove.id, punishment.id)
   │   当前硬编码为空字符串 ''        │
   └──────────────────────────────────┘
```

**数据流**：提交时一次性批量写入。惩罚题生成后再回填 `generated_problem_id`。

**关键问题**：
- `position_before_move_sgf` 和 `position_after_move_sgf` 在写入时是空字符串，没有实际填充 SGF 快照。这意味着后续无法从 bad_moves 表重建做题时的局面。
- `winrate_drop` 从未被写入——`handleProblemMove` 计算了 winrate 但 bad_move 只存 `scoreDrop`。

---

### 6. ReviewSchedule

```
┌─ DB ──────────────────────────────────────────────────────────────────┐
│  review_schedule: item_id, item_type, due_at, interval_days,         │
│                   ease_factor, last_result, consecutive_pass_count,  │
│                   total_fail_count                                    │
│  PK: (item_id, item_type)                                            │
└───────────────────────────────────────────────────────────────────────┘
   ↑ upsertReviewSchedule()              ↓ getDueReviews()
   │                                     ↓ getDashboardSummary()
   │ submitProblemAttempt()               startReviewSession()
   │ → result决定间隔：                   → db.getDueReviews()
   │   fail → 1天                         → reviewQueue = ids
   │   soft_pass → 3天                    → startProblem(queue[0])
   │   pass → 7天                         → setMode('review')
   │ → db.upsertReviewSchedule({         │
   │     intervalDays, dueAt,            │ advanceReview()
   │     lastResult,                     → reviewCurrentIndex++
   │     consecutivePassCount,           → startProblem(queue[next])
   │     totalFailCount                  → setMode('review')
   │   })                                │
   └─────────────────────────────────────┘
```

**数据流**：做题提交时更新 schedule；开始复习时查询 due items。

**关键问题**：
- `ease_factor` 字段在 DB schema 中默认 2.5，但 `upsertReviewSchedule` 从未写入此字段——间隔算法是硬编码的 1/3/7 天，没有实现 SM-2 ease factor 调整。
- `consecutivePassCount` 和 `totalFailCount` 虽然写入但没有用于计算间隔——只是被重置/递增。

---

### 7. Engine Analysis（纯内存，无 DB）

```
┌─ engineService (内存) ───────────────────────────────────────────────┐
│  state.analysis: {sign, variations[], winrate, scoreLead, ownership} │
│  state.analysisTreePosition: string                                  │
│  state.analyzingEngineSyncerId: string|null                          │
└──────────────────────────────────────────────────────────────────────┘
   ↓ getAnalysisForPosition(treePosition)
   │
   │ handleProblemMove(vertex)
   │ → preMoveAnalysis = engineService.getAnalysisForPosition(treePosition)
   │ → 用 preMoveAnalysis.variations 找用户下的那手
   │ → 计算 scoreDrop = topMove.scoreLead - userMove.scoreLead
   │ → 判定 severity
   │
   │ setMode('problem')
   │ → engineService.ensureAnalyzerForProblemMode()
   │ → 自动选第一个 attached engine 作为 analyzer
   │
   │ startProblem()
   │ → loadGameTrees → setCurrentTreePosition → analyzeMove(root.id)
   │ → 触发首次 engine 分析
```

**数据流**：引擎分析结果只在内存中，通过 `analysis-update` 事件持续刷新。`handleProblemMove` 在落子前快照当前分析，落子后引擎自动分析新位置。

**关键问题**：
- 引擎分析是异步的，`getAnalysisForPosition` 可能返回 null（分析还没完成）。当前代码在 `preMoveAnalysis` 为 null 时跳过评估——用户快速下子时不会触发坏棋检测。
- problem mode 下没有显式调用 `scheduleLiveAnalysis()`，依赖 `setCurrentTreePosition` 的副作用触发分析。这个隐式依赖比较脆弱。

---

## 四、数据流问题汇总

| # | 问题 | 严重度 | 修复建议 |
|---|------|--------|---------|
| 1 | `problemWorkspace` 赋值后未消费 | 低 | 删除或改为真正使用 |
| 2 | `problemEvalCache` 与 `problemAttempt.moveEvaluations` 双份拷贝 | 中 | 统一为一个数据源 |
| 3 | `bad_moves` 缺 `position_before/after_sgf`（硬编码为空串） | 高 | 提交时填充实际 SGF |
| 4 | `bad_moves` 缺 `winrate_drop` | 中 | handleProblemMove 已有数据，写入即可 |
| 5 | `review_schedule` 的 SM-2 `ease_factor` 未使用 | 中 | MVP 硬编码可接受，后续实现 SM-2 |
| 6 | 引擎分析 null 时跳过坏棋检测 | 高 | 等分析完成再允许落子，或做异步补偿 |

---

## 五、完整训练闭环数据流全景

```
Play → Recall → Analysis → Snapshot → Problem → Submit → Punishment → Review
  ✅      ✅       ✅/🟡      🟡        ✅/🟡     ✅       ✅/🟡       🟡

  Play        games 表写入
  Recall      recall_sessions + recall_attempts 写入
  Analysis    纯内存（engineService），无 DB 写入
  Snapshot    problems 表写入（从 Analysis 局面生成题目）— 流程未完整接入
  Problem     problem_attempts 写入，bad_moves 写入
  Submit      review_schedule 更新
  Punishment  problems 表写入（type='punishment'）
  Review      review_schedule 读取，problem_attempts 追加写入
```
