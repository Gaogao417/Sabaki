# Gabaki / Sabaki Training Implementation Plan

> 文档类型：长期实施计划  
> 对应 PRD：`gabaki-sabaki-training-prd-v0.4.md`  
> 对应架构：`gabaki-sabaki-training-architecture.md`  
> 当前代码现状：训练能力仍以 `sabaki.js` legacy global mode 为主，`trainingStore.js` 主要承载基础 Recall facade，DB 已有 games / recall / problems / problem_attempts / bad_moves / review 等早期表。

---

# 1. 实施原则

## 1.1 主线目标

长期迁移目标保持不变：

```text
legacy global mode
→ TrainingTask + WorkbenchTab + Phase + Attempt
```

业务闭环保持：

```text
Play → Recall → Analysis → Snapshot → Review
```

## 1.2 MVP 工程约束

MVP 不追求一次性完成完整架构，而是采用 strangler pattern：

```text
新训练域逐步接管旧入口；
旧 sabaki.js API 先变成 facade；
旧表和旧 state 保留兼容读取；
新流程写入新事实表；
每个阶段结束时应用必须可运行。
```

必须提前落地的工程防护：

```text
显式 Phase 状态机
轻量 MoveEvaluation 存储
pending evaluation 超时 failed
关键写入 transaction
启动时可发现 incomplete attempt / recall
```

MVP 避免过度拆分：

```text
Service 初始控制在 6～8 个；
Adapter 初始只保留 legacySabakiAdapter / positionSnapshotAdapter / analysisResultAdapter；
evaluationRules 作为纯函数模块；
punishment problem 创建归入 problemService；
review 调度规则归入 reviewService。
```

---

# 2. Phase 0：基础设施

目标：建立新训练域骨架，不改变可见行为。

范围：

```text
src/modules/training/types/*
src/modules/training/store/workbenchStore.ts
src/modules/training/store/trainingRuntimeStore.ts
src/modules/training/repository/trainingRepository.ts
src/modules/training/adapter/legacySabakiAdapter.ts
src/modules/training/adapter/positionSnapshotAdapter.ts
```

关键任务：

1. 定义 `TrainingTask`、`WorkbenchTab`、`TrainingAttempt`、`MoveEvaluation`、`BadMove`、`RecallSession`、`RecallCheckpoint`、`Problem`、`ReviewSchedule` 类型。
2. `workbenchStore` 支持 tabs / activeTabId / subscribe。
3. `trainingRuntimeStore` 支持 activeAttemptId / activeRecallSessionId / pending evaluations。
4. `trainingRepository` 先包装现有 `window.sabaki.db` IPC，不直接改 IPC 边界。
5. `legacySabakiAdapter` 包装当前 `sabaki.js` 的 mode、load SGF、navigate 等能力。

验收：

```text
类型编译通过；
store subscribe / notify 可单测；
repository 能读写现有 7 张早期训练表；
没有可见 UI 行为变化。
```

---

# 3. Phase 1：Task / Tab / Phase 骨架

目标：Problem / Game 以 Task + Tab 形式打开，Phase 切换受状态机约束。

关键任务：

1. 新建 `workbenchTabService`：`openGameTab`、`openProblemTab`、`closeTab`、`switchTab`。
2. 新建 `workbenchPhaseService` 作为 Phase Orchestrator。
3. 实现状态机：

```text
play     -- submit   --> recall
recall   -- complete --> analysis
recall   -- restart  --> play
analysis -- restart  --> play
analysis -- snapshot --> 新 Tab: play
```

4. 非法转换 reject / throw 并记录日志。
5. `sabaki.startProblem(problemId)` 改为代理到 `workbenchTabService.openProblemTab(problemId)`。
6. `workbench_tabs` 先做内存态，不持久化。

验收：

```text
打开 Problem → active tab.phase = play；
Submit → phase = recall；
Recall complete → phase = analysis；
play → analysis 等非法转换被阻止；
旧 ProblemBar/入口仍可兼容。
```

测试：

```text
workbenchStore unit tests；
phase transition table-driven tests；
openProblemTab integration test。
```

---

# 4. Phase 2：Attempt / MoveEvaluation / BadMove

目标：记录每次作答和每手评价，坏棋检测从 `sabaki.js` 迁出。

DB 变更：

```text
training_tasks
training_attempts
move_evaluations
bad_moves
```

关键任务：

1. 实现 `attemptService`：create / appendMove / freeze / finalizeResult。
2. 实现 `evaluationRules`：`evaluateMove`、`classifySeverity`、`evaluateAttempt`。
3. 实现 `analysisResultAdapter`：读取现有 analysisService / engineService 的 normalized result。
4. 实现 `playTrainingMonitor`：
   - 用户落子后创建 pending MoveEvaluation；
   - analysis update 后补算 scoreDrop / winrateDrop；
   - major / severe 创建 BadMove；
   - 30 秒无结果标记 failed。
5. MoveEvaluation 普通记录只保存 moveIndex / move / position hash / eval fields。
6. 只对 BadMove / Checkpoint / Snapshot 保存 SGF snapshot。

验收：

```text
Play 每手产生 pending MoveEvaluation；
有 analysis result 后 pending → evaluated；
超时 pending → failed；
major / severe 生成 BadMove；
Submit 通过 evaluationRules 得出 pending/pass/soft_pass/fail。
```

测试：

```text
evaluationRules unit tests；
pending/evaluated/failed monitor tests；
bad move severity threshold tests；
submitPlay transaction integration test。
```

---

# 5. Phase 3：Recall Checkpoint

目标：Recall 遇到 major / severe BadMove 时进入主动纠错流程。

DB 变更：

```text
recall_sessions
recall_attempts
recall_checkpoints
move_comments
```

关键任务：

1. 将现有 `trainingStore.js` Recall 行为迁入 `recallService`。
2. `trainingStore.js` 保留为 transitional facade。
3. 实现 `recallCheckpointService`：
   - `shouldTriggerCheckpoint`
   - `startCheckpoint`
   - `submitUserCorrectionLine`
   - `revealAiCandidateLines`
   - `saveComment`
   - `resumeRecall`
4. 增加 RecallCheckpoint UI 面板：
   - 原变化；
   - 用户修正图；
   - AI candidate lines；
   - comment 模板。
5. skipped checkpoint 进入 Review 候选。

验收：

```text
Recall 到 major/severe BadMove 暂停；
用户可先摆 correction line；
提交后显示 AI candidate lines；
comment 保存后继续 Recall；
中途崩溃后 incomplete recall 可被发现。
```

测试：

```text
recallService unit tests；
checkpoint trigger tests；
Recall → Checkpoint → Resume integration test；
existing trainingStoreTests 兼容通过。
```

---

# 6. Phase 4：Analysis / Snapshot

目标：Analysis 能查看训练材料，并从当前局面派生新 Problem Task。

关键任务：

1. Analysis 面板展示：
   - BadMove list；
   - AI candidate lines；
   - Recall comments；
   - Attempt userLine；
   - correction line。
2. Analysis 自由摆棋默认不写回当前 Attempt。
3. 实现 `snapshotService`：
   - capture current position；
   - capture source task / attempt / moveIndex；
   - create Problem；
   - create Snapshot Problem Task。
4. Snapshot 后由 `workbenchTabService.openSnapshotProblemTab` 打开新 Tab，`phase='play'`。
5. 扩展 `problems` 字段：source_task_id / source_attempt_id / source_move_index / parent_snapshot_reason。

验收：

```text
Analysis 可以看到 BadMove、AI 图和 Recall comment；
Analysis 摆棋不污染 Attempt；
Snapshot 创建 Problem + TrainingTask；
新 Tab 从 Play 开始；
当前 Tab 保持 analysis。
```

测试：

```text
snapshotService unit tests；
Analysis snapshot integration test；
ProblemEditor required fields regression test。
```

---

# 7. Phase 5：Review / Punishment

目标：坏棋沉淀为惩罚题，题目进入长期复习队列。

关键任务：

1. 实现 `reviewService`：
   - getDueItems；
   - openDueItem；
   - updateScheduleAfterResult；
   - calculateNextDue 内联纯函数。
2. 在 `problemService` 中实现 `createPunishmentProblemFromBadMove`。
3. Punishment Problem 不自动打开 Tab，只进入 inbox / review。
4. Review item 打开为普通 Problem Task，继续 `Play → Recall → Analysis`。
5. Training Dashboard 展示 due / inbox / incomplete sessions / recent punishment。

验收：

```text
BadMove 可生成 Problem(type='punishment')；
Punishment Problem 进入 inbox / review；
到期题可打开为 Problem Task；
完成后更新 review schedule；
Review 不再依赖 mode='review'。
```

测试：

```text
reviewService schedule tests；
punishment problem creation tests；
Review open → Problem Task e2e；
Dashboard due/inbox counts integration test。
```

---

# 8. Phase 6：Legacy Cleanup

目标：训练业务不再依赖 `sabaki.js` global training state 和 legacy mode。

关键任务：

1. 逐步删除或薄化：
   - `problemSession`
   - `problemAttempt`
   - `problemEvalCache`
   - `problemBadMoves`
   - `problemSubmitted`
   - `reviewQueue`
2. 移除 `mode='problem'` / `mode='review'` 作为业务判断来源。
3. `mode='recall'` 可短期兼容，但业务事实以 `tab.phase` 为准。
4. UI 组件从直接调用 `sabaki.*` 改为 Container callbacks。
5. `trainingStore.js` 完成迁移后删除或只保留 shim。

验收：

```text
Problem / Review / Recall 业务事实来自 training stores + repository；
sabaki.js 训练函数只剩薄代理或已删除；
board interaction 不再把 problem/review 当特殊 legacy mode；
旧数据仍可通过 repository mapper 读取。
```

---

# 9. Phase 7：持续优化

后置能力：

```text
workbench_tabs 持久化和恢复
TrainingBranch 可视化
更智能的 bad move 判定：winrate / ownership / 阶段判断 / 棋块状态
用户标记“不是坏棋”
SM-2 或更完整的 Review 策略
训练统计与能力画像
SGF / board command / engine analysis adapter 拆出
复杂 reference_lines 独立表
```

拆分触发条件：

```text
某模块超过约 200 行且有多个独立原因变化；
某 helper 出现第二个真实 caller；
需要隔离 legacy API 或错误恢复；
需要独立单元测试边界。
```

---

# 10. 总体里程碑

```text
Phase 0  基础设施                      1-2 周
Phase 1  Task / Tab / Phase 骨架        2-3 周
Phase 2  Attempt + 坏棋检测             2-3 周
Phase 3  Recall Checkpoint              2-3 周
Phase 4  Analysis + Snapshot            2-3 周
Phase 5  Review + Punishment            2-3 周
Phase 6  Legacy Cleanup                 2 周
Phase 7  持续优化                       持续
```

优先级判断：

```text
Phase 0-2 是地基，必须慢一点、测扎实；
Phase 3-5 是训练价值闭环，可以小步快跑；
Phase 6 只在新路径稳定后做；
Phase 7 根据真实使用痛点排序。
```
