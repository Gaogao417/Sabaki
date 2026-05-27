# 架构审查

## 1. 结论

APPROVE

v0.1 的两个阻塞项已关闭：

- 生产 composition root 已创建 `createWorkbenchOverlayRegion({overlayStore: this.getOverlayStore(), logger})` 并注入 `createWorkbenchFlowService`，见 `src/modules/sabaki.js:43-44`、`src/modules/sabaki.js:1028-1040`。
- Workbench mode effects 进入 Analysis 时已调用 `sabaki.setMode('analysis', {autoEnableTerritory: false})`，且 legacy `sabaki.setMode` 尊重该选项，见 `src/modules/training/workbench/workbenchFlowService.ts:173-181`、`src/modules/sabaki.js:502-566`。

本次复审未发现需要阻塞 step1 overlay child-region retry 的架构问题。当前工作区存在 unrelated UI dirty files，本审查未纳入这些文件，也未修改 production/tests/checklist。

验证命令：

```bash
npx mocha --require tsx test/overlays/overlayStore.test.js test/overlays/workbenchOverlayRegionBoundary.test.js test/training/workbenchFlowService.test.js test/training/modeTransitions.test.js test/training/modeStateResolver.test.js
```

结果：`170 passing`。

## 2. 严重阻塞问题

无。

## 3. 架构边界审查

| 边界 | 状态 | 证据 | 关注点 |
|---|---|---|---|
| Production composition root 注入 overlay region | 通过 | `src/modules/sabaki.js:43-44` import；`src/modules/sabaki.js:1028-1031` 创建 region；`src/modules/sabaki.js:1032-1040` 注入 flow service | 关闭 v0.1 假绿风险；真实 training context 不再缺少 overlay child-region dep |
| `workbenchOverlayRegion` child-region adapter | 通过 | `src/modules/overlays/workbenchOverlayRegion.ts:1-54` 只有 type import、`overlayStore.onModeChange(input.toMode)` 和 logger | 无 parent writer、service/store/repository/UI/engine/global Sabaki 依赖；adapter 不反写 WorkbenchMode |
| Flow service -> overlay region 通知顺序 | 通过 | `enterAnalysis`: assert 后 update tab，再通知，见 `workbenchFlowService.ts:625-657`；`returnFromAnalysis`: guard/assert 后 update tab，再通知，见 `:678-726`；`completeRecall`: assert 后 update tab，再通知，见 `:779-826`；`restartAttempt`: Analysis exit 后通知，见 `:912-944` | 通知仍是手写调用点，后续新增 mode exit path 时有遗漏风险，建议 step2.x 抽出统一 transition-commit helper |
| Rejected transition atomicity | 通过 | `returnFromAnalysis` 无 target 时在 `workbenchFlowService.ts:684-697` 先 throw；测试 `test/training/workbenchFlowService.test.js:1306-1331` 断言 tab/overlay/calls 均未变 | 本 slice 覆盖主要 rejected overlay path；未覆盖 overlayRegion 自身抛错后的回滚策略，列为残余风险 |
| Legacy `setMode` overlay auto-enable 隔离 | 通过 | `createSabakiModeEffects` 使用 `{autoEnableTerritory:false}`；`sabaki.setMode` 仅当 option 未 false 时自动 enable territory | 非 Workbench legacy caller 仍可能用默认 auto-enable，这是保留 legacy 行为，不阻塞 step1 |
| Step1 范围控制 | 通过 | retry implementation commit `38880948` 只改 `src/modules/sabaki.js`、`workbenchFlowService.ts`；当前相关 production/tests 无未提交 diff | 未扩展到 UI/container/projection/runtime/scratch/engine/snapshot/resolver |

## 4. 状态和事实来源审查

真源证据：

- PRD 固定运行态 Workbench mode 只有 `Play / Problem / Recall / Analysis`，并区分 Problem entity、RecallCheckpoint、Review、Punishment Problem 与运行态 mode，见 `docs/product/sabaki-training-prd.md:235-253`。
- PRD 要求 Snapshot 创建 Problem 前必须先进入 Analysis scratch/current projection，避免污染 live mutable context，见 `docs/product/sabaki-training-prd.md:255-269`。
- Architecture 要求 UI 只展示、Container/Controller 读 Store 调 Service、Service 编排业务动作、Store 不调 Service，见 `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:89-116`、`:180-209`。
- Architecture 的状态机行要求 `enterAnalysis` 保存 return target，`return` 恢复 previous mode / recall substate / tree position / move index，非法转换 reject/throw，见 `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:135-158`。
- Architecture 定义 `workbenchFlowService` 负责 Tab 内 mode 转换和跨实体流程编排，见 `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:727-802`。
- Architecture 定义 `overlayStore` 是显示层 overlay 状态，不承载训练业务，见 `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:412-430`；长期 ownership 也把 overlay visibility/input 归给 `overlayStore`，见 `docs/architecture/workbench-architecture-overview.md:462-480`。

当前实现没有新增第五个 mode，没有把 checkpoint/review/punishment 提升为 WorkbenchMode，也没有让 overlay region 写 Attempt、RecallSession、Task、Snapshot 或 SGF tree。`docs/archive/.../test-contract-v0.2.md`、test audit 和 prior review 仅作为本 step 派生输入使用；未发现与上述真源冲突。

## 5. 副作用审查

新增/修改的副作用边界可接受：

- `workbenchOverlayRegion` 只调用注入的 `overlayStore.onModeChange(toMode)` 并记录日志，未引入 DB、IPC、engine、repository、snapshot、UI 或 `window.sabaki`。
- `workbenchFlowService` 只通过 `overlayRegion?.onWorkbenchModeTransition(...)` 发送 transition intent，没有直接修改 overlay internals。
- `sabaki.setMode` 仍保留 legacy overlay cleanup 和 legacy Analysis auto-enable 行为，但 Workbench mode effect 已通过 `{autoEnableTerritory:false}` 隔离 auto-enable。

残余风险：

- `createSabakiModeEffects.exitAnalysis()` 仍调用 legacy `sabaki.setMode('play')`，不区分返回 `problem` 或 `recall`。这对 overlay cleanup 是安全的非 Analysis 清理，但会继续留下 legacy app mode 与 WorkbenchTab.mode 的迁移缝，建议 step2.2 scratch/mode-effects gate 收敛。
- overlay region 通知失败没有回滚 `workbenchStore.updateTab`。当前 overlayStore path 同步且简单，非阻塞；若后续 child region 增加更多行为，应定义 region failure policy。

## 6. 测试质量审查

测试不是 callback-only：

- `test/overlays/overlayStore.test.js:125-180` 使用真实 `overlayStore` 覆盖 leaving Analysis cleanup、subscriber/notify outcome；同文件也覆盖 late async readiness 不复活 overlay。
- `test/overlays/workbenchOverlayRegionBoundary.test.js:15-119` 覆盖 adapter API、forbidden import/API、production composition root 注入。
- `test/training/workbenchFlowService.test.js:1177-1331` 使用真实 `createWorkbenchFlowService`、真实 `workbenchStore`、真实 `overlayStore` 和 production adapter decorator，主断言是最终 tab state 与 overlay flags。
- `test/training/workbenchFlowService.test.js:1335-1379` 锁住 `createSabakiModeEffects` 不触发 legacy territory auto-enable 的 retry 风险。

测试残余风险：

- production composition safeguard 是 source scan，不实例化真实 Electron/Sabaki training context；它能防止 v0.1 的漏注入回归，但对运行时初始化错误不如集成 harness 强。建议后续有可用 Sabaki app harness 时补一条真实 `getTrainingContext()` smoke。
- flow overlay 通知点尚未由统一 helper 强制，未来新增 mode-changing command 可能绕过 child region；建议 step2.x 用 helper 或 contract test 保护。

## 7. 范围控制审查

通过。当前 step1 retry 保持在 overlay child-region implementation 范围内：

- 未改 UI/container/projection/runtime/scratch/engine/snapshot/resolver。
- 未新增 mode、tab opening API、origin/source 分支或 snapshot 行为。
- 未把派生 contract/test audit 提升为产品或架构真源。
- 当前 `git diff --stat` 的变更来自 unrelated UI dirty files；本次相关 production/tests 路径 `git diff -- ...` 为空。

## 8. 需要手动检查的文件或行

- `src/modules/sabaki.js:43-44`, `:1028-1040`：production overlay region composition。
- `src/modules/sabaki.js:502-566`：legacy `setMode` option 与 overlay side effect。
- `src/modules/training/workbench/workbenchFlowService.ts:173-181`：mode effect 进入 Analysis 时禁用 legacy territory auto-enable。
- `src/modules/training/workbench/workbenchFlowService.ts:625-657`, `:678-726`, `:779-826`, `:912-944`：overlay region 通知点。
- `src/modules/overlays/workbenchOverlayRegion.ts:1-54`：child-region adapter 边界。
- `test/overlays/workbenchOverlayRegionBoundary.test.js:101-119`：production composition source-scan safeguard。

## 9. 建议操作

1. 继续 step2.1 runtime companion region：把 `problemView`、`recallView`、checkpoint/correction transient cleanup 迁到明确 owner，不在 flow service 中扩大状态桶。
2. 在 step2.2 scratch/mode-effects gate 中处理 legacy `setMode('play')` 固定目标和 scratch workspace target/generation，降低 Sabaki legacy mode 与 WorkbenchTab.mode 分叉风险。
3. 为 mode-changing transition 引入统一 commit/notify helper，或补一个架构契约测试，防止未来新增 `workbenchFlowService` transition 漏掉 child-region notification。
4. 后续若建立 Sabaki production harness，补真实 `sabaki.getTrainingContext().flowService` smoke，替代或增强当前 source-scan composition 测试。

## 10. Workbench 接线闭环追踪（如适用）

| 控件/命令 | Event | Container | Controller | Service/Store | Projection/UI | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| Mode segmented -> Analysis | `onModeChange('analysis')` | 既有 `TrainingWorkbenchContainer` 映射到 `flowService.enterAnalysis`，本 step 未改 container | 当前无独立 controller | `workbenchFlowService.enterAnalysis` guard 成功后更新 `workbenchStore`，通知 production `overlayRegion`；`createSabakiModeEffects` 调 legacy `setMode('analysis', {autoEnableTerritory:false})` | Workbench mode 从 store 回流；overlay flags 保持 false，后续用户命令才开启 | APPROVE |
| Return from Analysis | return action / previous mode segment | 既有 container 调 `flowService.returnFromAnalysis` | 当前无独立 controller | `returnFromAnalysis` 先校验 saved target，成功 update tab 后通知 overlay region 清 territory/compare；rejected path 不通知不清理 | overlayStore subscription/projection 可读到 false；tab 恢复 target mode | APPROVE |
| Recall complete -> Analysis | recall completion command | 既有路径调 `flowService.completeRecall` | 当前无独立 controller | `completeRecall` 校验 recall mode，清 recall view transient 后 update tab 到 analysis，并通知 overlay region；Analysis 不 auto-enable territory | Analysis panel/toolbar 后续按 active tab mode 投影 | APPROVE_WITH_NOTES |
| Restart attempt from Analysis | restart command | 既有路径调 `flowService.restartAttempt` | 当前无独立 controller | Analysis exit 时 update target mode 后通知 overlay region 清 overlay；非 Analysis restart 不通知 overlay，因 overlay 应已被 Analysis-only owner 禁止 | target mode 回流，overlay flags false | APPROVE_WITH_NOTES |

## 11. 真源冲突清单（如适用）

| 冲突产物 | 冲突内容 | 统一真源 | 处理建议 |
| --- | --- | --- | --- |
| 无 | 未发现当前 implementation retry、测试或审查输入与 `docs/product/` / `docs/architecture/` / `docs/ui_ux/` 真源冲突 | PRD 四 mode、Architecture service/store/overlay ownership | 继续按 step2.x 拆 runtime、scratch/engine、diagnostics |

可以继续。
