# Gabaki / Sabaki Workbench Wiring Implementation Plan

> 文档类型：接线实施计划
> 当前版本：2026-05-26 wiring reset
> 对应 PRD：`docs/product/sabaki-training-prd.md` v0.7
> 对应架构：`docs/architecture/gabaki-sabaki-training-architecture-v0.5.md`
> 运行态合同：`docs/design/workbench-mode-orchestration-contract.md`
> 棋盘读写合同：`docs/architecture/position-source-mutation-contract.md`
> 前端规格：`docs/ui_ux/workbench-ui-ux-spec.md`
> 六屏接线草案：`docs/ui_ux/workbench-six-screen-migration-wiring-plan.md`
> 野狐数据入口：`docs/product/fox_game_import_prd.md`
> 101 错题入口：`docs/product/101weiqi_error_sync_prd.md`
> 旧长期 phase 计划归档：
> `docs/archive/implementation-plans/2026-05-26-gabaki-sabaki-training-implementation-plan-v0.5-longform.md`

---

## 0. 文档地位

本计划取代旧的 Phase 0-9 长期迁移账本，作为当前 Workbench 六屏前端与训练域后端的
接线执行权威。

权威关系固定为：

```text
PRD v0.7                                  = 产品闭环与对象边界
Workbench UI/UX Spec                      = 六屏体验与组件层级
Mode Orchestration Contract               = 运行态状态机和 companion state
Position Source and Mutation Contract     = 棋盘读源与写入边界
Workbench Wiring Implementation Plan      = 当前执行顺序和并行锁
```

旧计划仍可追溯历史 Phase、legacy debt 和已完成切片，但不再作为下一步排期依据。
新增实现不得把 `workbenchPhaseService`、`openProblemTab`、`source_kind`、
`problemView + sabaki.state.mode='play'` 继续扩展成主路径。

---

## 1. 当前快照

### 已落地

```text
PRD v0.7:
  Attempt-centered Play / Problem -> Submit -> Recall -> Checkpoint -> Analysis -> Snapshot -> Review
  四个 WorkbenchMode: play / problem / recall / analysis

Frontend:
  WorkbenchShell + 六屏 mode/right panels 已成为默认表面
  visible global header row 已移除
  LibrarySideDrawer 已拆成 历史记录 / 棋谱库 / 对局库 tabs
  LibrarySideDrawer 已暴露 101 错题 / Fox 对局真实 command affordance
  Analysis bottom edit bar 已暴露可见 annotation toolbar
  六屏截图验收已归档在 docs/archive/daily-design/2026-05-26/workbench-visual-acceptance/

State / service:
  workbenchStore, trainingRuntimeStore, workbenchTabService.openTask
  workbenchFlowService submit -> freeze Attempt -> create RecallSession -> recallView projection
  modeTransitions.ts 纯状态机骨架
  repository frozen Attempt protected-field guard
  recallService completeRecall 不再回写 Attempt.userLine/result/status
  problemFlowService.undoProblemMove 已同步回滚 runtime cache 和 mutable Attempt line
  boardInteractionController + gobanDataAdapter + projectGobanProps 已接入 Container
  recall checkpoint command path 已有 correction / reveal AI / comment / resume
  Workbench command map 已覆盖 modebar/topbar/bottombar/editbar/library/keyboard

E2E / coverage:
  workbench-command Playwright project 已覆盖 mode command、library 101/Fox command、analysis edit bar command
```

### 剩余核心缺口

```text
Mode effects:
  workbenchFlowService 仍主要 patch tab；analysis workspace、overlay、scratch schedule 仍由
  TrainingWorkbenchContainer.ensureAnalysisWorkspace 和 sabaki.setMode 分散执行。

Snapshot:
  modeTransitions.ts 仍允许任意 mode snapshot；
  workbenchFlowService.snapshotFromCurrentContext 未限制 analysis scratch/current source；
  UI 可以全局显示 Snapshot，但持久化必须收敛为先 enter analysis，再从 analysis snapshot。

Problem mode:
  resolver 已能按 WorkbenchMode.problem 路由，但实际仍回落为 playMove；
  缺 `problemAttemptMove` executor；
  openProblemTab legacyCompatibility 仍会 `setMode('play')`；
  Container 的 problem abandon/undo/hint 仍有 legacy controller path。

Recall / checkpoint:
  board click 后 recallView / activeCheckpoint projection 仍需要服务化刷新；
  correctionDraft 的棋盘来源和 checkpoint substate 还未形成完整接线；
  Recall 页面不能显示 analysis projection。

Six-screen projection:
  多个面板已是视觉结构，但标题、题面、评估卡、Analysis 列表、Library 数据仍有静态或本地
  projection；需要从 TrainingTask、runtime view、analysis context、repository/dashboard
  服务接线。

Command coverage / E2E:
  需要显式 command map 覆盖所有可见按钮、快捷键、drawer tab 和 mode segment；
  需要 Playwright E2E 验证六屏截图、主按钮点击、disabled reason 和 service/store/projection 结果。

External data / edit bar:
  101 错题、Fox 对局和本地 SGF 必须进入材料库与 TrainingTask 主路径；
  Analysis edit bar 必须成为 scratch/current 局面编辑与 Snapshot 的真实输入，不能只是视觉工具条。

Legacy cleanup:
  `window.sabaki` 全局查找、legacy problem/review wrappers、phase compatibility 字段仍需逐步薄化。
```

---

## 2. Out Of Scope

- 不新增第五个 Workbench mode；Review、Punishment Problem、Library 都不是 mode。
- 不重写 Sabaki 原生 SGF 编辑、scoring、estimator、find、guess、autoplay。
- 不做云同步、多人题库、课程系统或全量数据库重构。
- 不把组件改成直接写 store；组件只能发 callback。
- 不在 resolver 内实现业务副作用；resolver 只解析 intent，executor/service 负责写入。
- 不扩大 `workbenchPhaseService`；它只保留为 deprecated compatibility。

---

## 3. Step List

| Step | Do | Mode | Depends on | Can run with | Locks / owner | Next role |
| --- | --- | --- | --- | --- | --- | --- |
| step1.1 | 写 snapshot 合同对齐测试：`snapshot` 只允许 analysis scratch/current 持久化；play/problem/recall 的全局按钮必须先 enter analysis 或被 disabled。 | parallel | none | step1.2, step1.3 | `test/training/modeTransitions.test.js`, `test/training/workbenchFlowService.test.js`, `test/training/snapshotService.test.js` | test-writer |
| step1.2 | 写 ModeState / companion state 只读 resolver 测试：从 tab/runtime/overlay/engine 聚合四种 mode，并标出 illegal companion state。 | parallel | none | step1.1, step1.3 | new `test/training/modeStateResolver.test.ts` | test-writer |
| step1.3 | 写六屏 projection 防假绿测试：Problem/Recall/Analysis/Library 面板字段必须来自 task/runtime/analysis/repository，不允许只靠静态文案。 | parallel | none | step1.1, step1.2 | `test/workbench/wiring/*`, panel tests | visual-test-writer |
| step1.4 | 建立 Workbench command map 测试：枚举顶部、底部、edit bar、library drawer、mode segment、快捷键；每个可见 action 必须有 handler、disabled reason 和 owner service。 | parallel | none | step1.1, step1.2, step1.3, step1.5 | new `test/workbench/wiring/command-map-coverage.test.js`, `TrainingWorkbenchContainer.js`, shell/panel components | visual-test-writer |
| step1.5 | 建立 Playwright E2E 验收合同：六屏截图 + 主 command 点击 + disabled no-op + service/store/projection 结果，覆盖 desktop 和 compact breakpoint。 | parallel | none | step1.1, step1.2, step1.3, step1.4 | `e2e/workbench-baseline.spec.js`, new workbench command e2e | visual-test-writer |
| step2 | 审计并合并 step1 测试，删除仍要求任意 mode snapshot 的旧断言，保留 null task crash-prevention 但改成 enter-analysis guard。 | serial | step1.* | none | test files only | test-auditor |
| step3.1 | 实现只读 `ModeState` / companion resolver，输出 play/problem/recall/analysis 的 tab、runtime、overlay、engine region projection。 | parallel | step2 | step3.2 | `src/modules/training/workbench/modeStateResolver.ts` | implementation-agent |
| step3.2 | 给 workbenchFlowService 增加 ModeEnterEffect / ModeExitEffect 依赖接口，把 tab patch、runtime patch、overlay patch、analysis workspace effect 收进同一个入口。 | parallel | step2 | step3.1 | `src/modules/training/workbench/workbenchFlowService.ts` | implementation-agent |
| step4 | 集成 step3：Container 不再自己决定 analysis workspace 生命周期，只调用 flowService；flowService effect deps 适配现有 `sabaki.setMode` / `editWorkspace` / overlay store。 | serial | step3.1, step3.2 | none | `src/components/TrainingWorkbenchContainer.js`, `workbenchFlowService.ts` | implementation-agent |
| step5.1 | 收紧 snapshot 主路径：`modeTransitions` 非 analysis snapshot rejected；`snapshotFromCurrentContext` 校验 analysis + scratch/current source；child problem tab 保持 parent 不变。 | parallel | step4 | step5.2, step6.1 | `modeTransitions.ts`, `workbenchFlowService.ts`, `snapshotService.ts` | implementation-agent |
| step5.2 | 调整 UI Snapshot command：非 analysis 下点击 Snapshot 只负责进入 analysis / 初始化 scratch；真正保存题目必须第二步从 analysis 执行。 | parallel | step4 | step5.1, step6.1 | `TrainingWorkbenchContainer.js`, `BottomActionBar.js`, `ModeActions.js` | frontend-implementation-agent |
| step6.1 | 实现 `problemAttemptMove` executor：Problem board click 写 mutable Attempt、problem runtime/eval handoff，并保留 problemArea / AI turn guard。 | parallel | step4 | step5.*, step6.2 | `resolveBoardInteraction.ts`, `boardInteractionController.ts`, new executor | implementation-agent |
| step6.2 | 把 Problem submit/undo/abandon 从 legacy controller 收敛到 flow/problem service；禁止 submit 后继续写 frozen Attempt。 | parallel | step4 | step5.*, step6.1 | `problemFlowService.ts`, `workbenchFlowService.ts`, `TrainingWorkbenchContainer.js` | implementation-agent |
| step7.1 | Recall board answer 后刷新 recallView、activeCheckpoint、recallSubstate；checkpoint active 时禁止继续提交普通 recall answer。 | parallel | step6.* | step7.2, step8.* | `recallService.ts`, `recallCheckpointService.ts`, `boardInteractionController.ts`, `runtimeStore` | implementation-agent |
| step7.2 | 接 correctionDraft 棋盘来源：checkpoint correction board edits 写 `runtimeStore.correctionDraft`，submit/reveal/comment/resume 后清理并刷新投影。 | parallel | step6.* | step7.1, step8.* | `TrainingWorkbenchContainer.js`, `recallCheckpointService.ts`, `runtimeStore` | implementation-agent |
| step8.1 | Problem 六屏数据接线：题面、目标、pass rule、side to move、score drop、hint、attempt path、visible bad moves 全部来自 task/runtime/evaluation。 | parallel | step5.*, step6.* | step7.*, step8.2, step8.3 | `ProblemModePanel.js`, `ProblemRightPanel.js`, Container projection | frontend-implementation-agent |
| step8.2 | Recall / Checkpoint 六屏数据接线：progress、当前手、错误数、原线、correction、AI candidates、comment 状态全部来自 recall/checkpoint projection。 | parallel | step7.* | step8.1, step8.3 | `RecallModePanel.js`, `RecallRightPanel.js`, `RecallCheckpointPanel.js` | frontend-implementation-agent |
| step8.3 | Analysis 六屏数据接线：Analysis left tree、issue list、reference/correction lines、overlay/engine status、snapshot button reason 全部来自 analysis context 和 overlay/engine projection。 | parallel | step5.* | step8.1, step8.2 | `AnalysisModePanel.js`, `AnalysisRightPanel.js`, `projectGobanProps.ts` | frontend-implementation-agent |
| step8.4 | Library / external data 接线：历史记录、棋谱库、对局库、101 错题、Fox 对局、Review/Problem inbox 都来自 repository/sync services；支持 loading/empty/error/syncing/success。 | parallel | step4 | step8.1, step8.2, step8.3, step8.5 | `LibrarySideDrawer.js`, `taskImportService.ts`, Fox/101 services, dashboard/repository services | frontend-implementation-agent |
| step8.5 | Analysis edit bar 接线：摆子、删除、标记、线/箭头、撤销/重做、清空、Edit position、Snapshot 都写 scratch/current working position，并共享顶部 command path。 | parallel | step5.* | step8.1, step8.2, step8.3, step8.4 | `BottomActionBar.js`, `AnnotationToolbar.js`, scratch edit executor, `TrainingWorkbenchContainer.js` | frontend-implementation-agent |
| step9.1 | 集成六屏 projection：统一 Container view-model mapper，移除静态兜底文案导致的假绿，补 compact breakpoint 截图验收。 | serial | step8.* | none | `TrainingWorkbenchContainer.js`, `style/workbench.css`, e2e harness | visual-fidelity-reviewer |
| step9.2 | Playwright E2E command acceptance：六屏 canonical states、library drawer、edit bar、101/Fox sync states、disabled reason、快捷键与按钮同 path。 | serial | step9.1 | none | `e2e/workbench-baseline.spec.js`, new e2e specs/screenshots | visual-fidelity-reviewer |
| step10.1 | Legacy cleanup A：`openProblemTab` 默认不再 `setMode('play')`；legacyCompatibility 只作显式 opt-in；review/open due 主路径只走 `openTask`。 | parallel | step9.* | step10.2 | `workbenchTabService.ts`, review tests | implementation-agent |
| step10.2 | Legacy cleanup B：替换 Container 内训练域相关 `legacyTrainingFlowController` 与 `window.sabaki` 查找；保留非训练 legacy actions 的 adapter 边界。 | parallel | step9.* | step10.1 | `TrainingWorkbenchContainer.js`, adapters | implementation-agent |
| step11 | 总体验收：跑 focused wiring/training tests、PRD smoke、frontend screenshot acceptance；更新本计划的证据 ledger。 | serial | step10.* | none | test commands + docs evidence | architecture-reviewer |

---

## 4. Current Execution Status

| Step | Status | Evidence |
| --- | --- | --- |
| step1.1 | done | Existing snapshot/mode transition contracts now assert `snapshot` is analysis-only. Verified by `npm test`. |
| step1.2 | next | Not implemented in this pass. |
| step1.3 | next | Not implemented in this pass. |
| step1.4 | done | `src/modules/training/workbench/workbenchCommandMap.ts` + `test/workbench/wiring/command-map-coverage.test.js`; verifies owner, handler, disabled reason, visible affordance, 101/Fox explicit commands. |
| step1.5 | done | `playwright.config.js` project `workbench-command` + `e2e/workbench-command-acceptance.spec.js`; browser-clicks mode command, library 101/Fox, and analysis edit bar. |

Step 1 的可见 command 防漏接线骨架已经落地；下一轮应继续补 `step1.2` 和 `step1.3`，
然后进入 `step2` 审计合并。

---

## 5. Shared Locks / Integrators

```text
TrainingWorkbenchContainer.js
  全局 UI -> service callback 集成点。任意两个 step 不应同时改它；并行分支需要在 step4 或 step9 集成。

workbenchFlowService.ts
  mode transition / effect 编排唯一入口。step3、step5、step6 都必须串行合并这里的改动。

boardInteractionController.ts + resolveBoardInteraction.ts
  棋盘事件接线锁。Problem executor 和 Recall checkpoint draft 不能并行写同一段 dispatch。

trainingRuntimeStore.ts
  runtime projection 只能存 companion/cache；不得变成业务真相。

style/workbench.css + WorkbenchShell panels
  step8 可以按 mode 分文件并行；step9 统一做布局、响应式和截图验收。

e2e/
  Playwright 验收锁。所有新可见 command 必须进入 command map，再进入 E2E 点击或 disabled no-op 验收。

Fox / 101 sync services
  只负责拉取、同步、解码和入库；Workbench 只消费 TrainingTask / Game / Problem projection。

tests
  先改合同测试，再实现。旧测试若和当前 PRD/architecture 冲突，必须在 step2 明确迁移理由。
```

---

## 6. Gate Ledger Seed

| Gate | Required evidence | Exit condition |
| --- | --- | --- |
| Contract source alignment | PRD v0.7, Mode Orchestration Contract, Position Source Contract, Six-Screen Plan 被同一 step 引用 | 无互相冲突的 snapshot/problem/recall 语义 |
| Test-first wiring | 每个 step 至少有 focused test 覆盖 visible command path 或 service/store projection | 测试先红后绿，禁止只测 mock callback |
| Command coverage | 所有顶部/底部/edit bar/library/mode/keyboard action 在 command map 中有 owner、handler、disabled reason、E2E evidence | 不允许新增无 handler 的可见按钮 |
| Boundary audit | Resolver 无副作用；component 无直接 store write；Recall/Analysis 不写 frozen Attempt protected fields | `architectureBoundary` / scoped rg scan 通过 |
| Visual acceptance | 六屏 desktop 1448x1086 + compact breakpoint 截图 | 无遮挡、无静态假数据、状态文案来自 projection |
| Playwright E2E acceptance | `npm run test:e2e -- --project=workbench-baseline` 或同等新增 project，含 command clicks 和 disabled no-op | UI command 到 service/store/projection 至少走通一段真实结果 |
| External data acceptance | 101/Fox 的 loading/empty/error/syncing/success、导入、打开 Task、去重进入 E2E 或 focused integration | 材料库 tab 不再是静态壳 |
| Legacy cleanup | 新主路径不依赖 `workbenchPhaseService`、`openProblemTab`、`sabaki.state.mode='play' + problemView` | legacy 仅作为 adapter 或显式 compatibility |
| Final verification | focused `npm test` targets + PRD smoke + relevant e2e/screenshot harness | 本计划更新 evidence/status 后结束 |

---

## 7. Minimal Command Targets

```text
npm test -- test/training/modeTransitions.test.js
npm test -- test/training/workbenchFlowService.test.js
npm test -- test/training/snapshotService.test.js
npm test -- test/training/problemFlowService.test.js
npm test -- test/training/trainingRepositoryFrozenAttempt.test.js
npm test -- test/training/prdSmoke.test.js
npm test -- test/workbench/wiring
npm test -- test/workbench/panels
npm test -- test/workbench/shell
npm run bundle -- --mode development
npx playwright test --project=workbench-baseline
npx playwright test --project=analysis-overlay
npx playwright test --project=workbench-command
```

视觉验收继续使用 `docs/archive/daily-design/2026-05-26/workbench-visual-acceptance/`
同类 harness。若实现触及 board/canvas/overlay，必须补桌面和 compact 截图。

---

## 8. Evidence Ledger

| Date | Scope | Result |
| --- | --- | --- |
| 2026-05-26 | Command map coverage | `npx mocha --require tsx test/workbench/wiring/command-map-coverage.test.js` -> 5 passing |
| 2026-05-26 | Workbench command E2E | `npx playwright test --project=workbench-command` -> 3 passing |
| 2026-05-26 | Full unit suite | `npm test` -> 1798 passing |
| 2026-05-26 | Build / whitespace | `npm run bundle -- --mode development` and `git diff --check` -> pass |

---

## 9. 下一步建议

下一轮不要从 UI 继续补静态字段。先并行执行剩余 Step 1：

```text
step1.2  建 ModeState / companion state resolver 测试；
step1.3  建六屏 projection 防假绿测试。
```

然后进入 `step2` 审计合并，再进 `step3` 把 ModeState resolver 与 ModeEnter/Exit effects 收到
flowService 主路径。
