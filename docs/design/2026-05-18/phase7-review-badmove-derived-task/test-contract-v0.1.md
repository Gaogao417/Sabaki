# Phase 7 Test Contract: Review / BadMove 派生 Task

Date: 2026-05-18
Status: pending

## Gap Analysis

| # | 差距 | 严重性 | 说明 |
|---|-----|--------|------|
| G1 | openDueItem 用 legacy openProblemTab | P0 | 应改为 openTask(taskId) |
| G2 | updateScheduleAfterResult 用 legacy itemId/itemType | P0 | 应改为 taskId |
| G3 | addToReviewQueue 用 legacy itemId/itemType | P0 | 应改为 taskId |
| G4 | 缺少 findReviewScheduleByTask | P0 | repository 需要 taskId 查找 |
| G5 | createTaskFromBadMove 不创建 ReviewSchedule | P1 | Phase 7 要求派生 task 进入 review queue |
| G6 | ReviewSchedule 创建不用 taskId | P0 | 新建 schedule 必须以 taskId 为主 |

## User Stories

**US-1:** 作为学习者，我希望复习到期项时直接打开一个普通 Task（通过 `openTask`），而不是走遗留的 `openProblemTab` 分支，这样复习与普通任务打开行为一致。

**US-2:** 作为学习者，我希望 BadMove 派生出的任务自动进入复习队列，这样我不需要手动将错题加入复习。

**US-3:** 作为学习者，我希望复习调度和进度更新完全基于 `taskId` 而非遗留的 `itemId`/`itemType`，这样所有复习项的寻址方式统一。

**US-4:** 作为开发者，我希望 `reviewService` 不再依赖 `ReviewItemType`（`'problem'` | `'recall_segment'`）做分支判断，这样复习逻辑与任务类型完全解耦。

**US-5:** 作为学习者，我希望 Punishment 不再是特殊的 Tab 或自动打断当前流程，而是作为普通 TrainingTask 进入我的 inbox 和复习队列。

## Test/Acceptance Contract Table

### Group A: reviewService API 升级到 taskId

| ID | Type | Classification | Contract | Importance | Miss Risk |
| ---- | ---- | -------------- | -------- | -------------- | --------------- |
| C01 | WIRING | MUST_AUTOMATE | `openDueItem(scheduleId)` 通过 `schedule.taskId` 调用 `workbenchTabService.openTask({ taskId })`，不调用 `openProblemTab` | critical | Review 打开走遗留路径，绕过统一 Task 系统 |
| C02 | STATE | MUST_AUTOMATE | `openDueItem(scheduleId)` 找不到 schedule 时抛错，包含 scheduleId 信息 | high | 无错误提示，用户看到空白 |
| C03 | STATE | MUST_AUTOMATE | `openDueItem(scheduleId)` 找到 schedule 但 task 不存在时抛错 | high | Task 被删除后复习崩溃 |
| C04 | STATE | MUST_AUTOMATE | `updateScheduleAfterResult({ taskId, result })` 通过 `findReviewScheduleByTask(taskId)` 查找现有 schedule | critical | 遗留查找逻辑残留 |
| C05 | STATE | MUST_AUTOMATE | `updateScheduleAfterResult` 找到现有 schedule 时更新 `dueAt`/`intervalDays`/`consecutivePassCount`/`totalFailCount`/`lastResult` | high | 复习进度丢失 |
| C06 | STATE | MUST_AUTOMATE | `updateScheduleAfterResult` 未找到现有 schedule 时创建新 schedule，`taskId` 字段正确 | high | 新 Task 无法进入复习 |
| C07 | STATE | MUST_AUTOMATE | `addToReviewQueue({ taskId })` 创建新 schedule 时 `taskId` 正确，`dueAt` 为当前时间 | high | 入队后找不到 Task |
| C08 | STATE | MUST_AUTOMATE | `addToReviewQueue({ taskId })` 对已存在的 schedule（同一 taskId）返回现有 schedule，不创建重复 | high | 复习队列重复项 |
| C09 | STATE | MUST_AUTOMATE | `getDueItems` 返回包含 `taskId` 字段的 schedule 列表 | medium | UI 无法关联 Task |

### Group B: BadMove 派生 Task + Review 自动入队

| ID | Type | Classification | Contract | Importance | Miss Risk |
| ---- | ---- | -------------- | -------- | -------------- | --------------- |
| C10 | SIDE_EFFECT | MUST_AUTOMATE | `createTaskFromBadMove({ badMoveId })` 创建 task 后自动将新 task 加入 review queue（schedule 的 taskId 指向新 task） | critical | Phase 7 核心需求：错题不进入复习 |
| C11 | STATE | MUST_AUTOMATE | `createTaskFromBadMove` 返回的 task 是普通 `TrainingTask`（`origin.provider = 'bad_move'`） | high | 退化为特殊类型 |
| C12 | STATE | MUST_AUTOMATE | `createTaskFromBadMove` 更新 `badMove.generatedTaskId` 为新 task 的 id | high | BadMove 与 Task 断链 |
| C13 | SIDE_EFFECT | MUST_AUTOMATE | BadMove 派生的 task 的 `origin.provider` 为 `'bad_move'`，非 `'punishment'` 或其他特殊值 | high | 类型不一致 |
| C14 | STATE | MUST_AUTOMATE | 重复调用 `createTaskFromBadMove` 同一 badMoveId 时：如果已有 `generatedTaskId`，返回已存在的 task（幂等性） | medium | 重复创建导致复习队列混乱 |

### Group C: Repository taskId 查找

| ID | Type | Classification | Contract | Importance | Miss Risk |
| ---- | ---- | -------------- | -------- | -------------- | --------------- |
| C15 | STATE | MUST_AUTOMATE | `repository.findReviewScheduleByTask(taskId)` 对存在的 taskId 返回正确的 ReviewSchedule | critical | 核心查找方法缺失 |
| C16 | STATE | MUST_AUTOMATE | `repository.findReviewScheduleByTask(taskId)` 对不存在的 taskId 返回 null | high | 错误处理路径 |
| C17 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | `findReviewScheduleByTask` 只按 `taskId` 查找，不依赖 `itemId`/`itemType` | high | 遗留字段耦合 |
| C18 | STATE | MUST_AUTOMATE | `createReviewSchedule` 创建的 schedule 包含正确的 `taskId` 字段 | high | 数据完整性 |

### Group D: 架构边界守卫

| ID | Type | Classification | Contract | Importance | Miss Risk |
| ---- | ---- | -------------- | -------- | -------------- | --------------- |
| C19 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | `openDueItem` 不调用 `workbenchTabService.openProblemTab` | critical | 退化为遗留分支 |
| C20 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | `reviewService` 的公共 API 签名中不包含 `ReviewItemType` 参数 | high | 遗留接口泄漏 |
| C21 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | `openDueItem` 打开的 tab 的 `mode` 由 `inferDefaultMode(task)` 决定，不是硬编码 | medium | Review 不应该覆盖 mode 推断 |
| C22 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | Review 不设置 `mode='review'` -- 复习不是 mode | high | 架构违反 |
| C23 | ARCHITECTURE_BOUNDARY | MUST_AUTOMATE | `createTaskFromBadMove` 不调用 `repository.createProblem` | high | 已有边界测试，Phase 7 保持 |

## 状态流

```
openDueItem(scheduleId)
  -> 查找 schedule (by id)
  -> 加载 task (by schedule.taskId)
  -> workbenchTabService.openTask({ taskId: schedule.taskId })
  -> 返回 WorkbenchTab (mode 由 inferDefaultMode 决定)

updateScheduleAfterResult({ taskId, result })
  -> findReviewScheduleByTask(taskId)
  -> [找到] -> calculateNextDue -> updateReviewSchedule
  -> [未找到] -> calculateNextDue -> createReviewSchedule({ taskId })

addToReviewQueue({ taskId })
  -> findReviewScheduleByTask(taskId)
  -> [已存在] -> 返回现有 schedule
  -> [不存在] -> createReviewSchedule({ taskId, dueAt=now })

createTaskFromBadMove({ badMoveId })
  -> [现有] 加载 BadMove -> 创建 TrainingTask -> 更新 generatedTaskId
  -> [新增] addToReviewQueue({ taskId: newTask.id })
```
