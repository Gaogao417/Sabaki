verdict: APPROVED

# 架构审查

Date: 2026-05-27
Role: architecture-reviewer
Subject: step2.1 runtime companion region implementation
Implementation commit: `841bb74a implementation-agent: runtime companion region owner`

## 1. 结论

APPROVED

本轮实现尊重 step2.1 的 runtime companion region 边界：新增 owner 只写 `trainingRuntimeStore` 的 runtime transient companion；`workbenchFlowService` 仍负责父状态机和 tab/mode orchestration；checkpoint resume/skip/comment cleanup 已通过 runtime-region port，而不是在 cleanup path 继续散落 raw setter。没有发现会阻塞继续 workflow 的架构问题。

## 2. 严重阻塞问题

无。

## 3. 架构边界审查

| 边界 | 状态 | 证据 | 关注点 |
|---|---|---|---|
| Runtime owner 写入范围 | APPROVED | `src/modules/training/workbench/workbenchRuntimeRegion.ts:21-35` 只调用 `setProblemView(null)`, `setActiveRecallSession`, `setRecallView`, `setActiveCheckpoint(undefined)`；`trainingRuntimeStore.setActiveRecallSession` / `setActiveCheckpoint` 负责级联清 `correctionDraft`（`trainingRuntimeStore.ts:148-176`）。 | owner 未写 Attempt/RecallSession/Checkpoint facts、tab state 或非本轮 runtime cache。 |
| Owner forbidden imports | APPROVED | `workbenchRuntimeRegion.ts:1-3` 只 import `RecallSession`, `TrainingRuntimeStore`, `mapRecallSessionToRecallView`；未 import/call `workbenchStore`, `workbenchFlowService`, repository, UI, snapshot/tab service, overlay/scratch/engine/global Sabaki。 | 纯 mapper 放在 `recallService` 中仍是 residual risk；后续若 recallService 变重，应迁到 projection helper。 |
| Parent state machine ownership | APPROVED | `workbenchFlowService.ts:505-554`, `746-752`, `790-797`, `1015-1083` 仍由 flow service 更新 `WorkbenchTab.mode`, `recallSubstate`, `activeRecallSessionId`, return target，并只向 runtime region 发送 intent。 | owner 未反写 WorkbenchMode/tab/repository facts。 |
| Checkpoint activation deferred | APPROVED | `recallCheckpointService.ts:122-123` 的 startCheckpoint activation 和 `:160` correction draft submit cleanup 仍保留在原路径；RTM-T10 剥离这些函数体后只检查 resume/skip cleanup。 | 符合 step2.1b deferred；本轮未混入 checkpoint activation automation。 |
| Resume/skip/comment cleanup | APPROVED_WITH_RISK | `recallCheckpointService.ts:271`, `:307` 和 `workbenchFlowService.ts:1021-1023`, `:1078-1079` 通过 `runtimeRegion.onCheckpointResumed` 清 active checkpoint/draft。 | flow service 与 checkpoint service 都发送同一 cleanup intent，会产生重复 store notification；当前最终状态正确，但下轮 owner 若加日志/generation 应收敛为单一通知点。 |

## 4. 状态和事实来源审查

真源 PRD / Architecture / UI evidence:

| 真源 | 证据 | 本轮判断 |
|---|---|---|
| `docs/product/sabaki-training-prd.md:237-250` | Workbench runtime mode 只有 Play / Problem / Recall / Analysis；Problem mode 拥有 `problemView`；RecallCheckpoint 不是独立 mode。 | implementation 未新增 mode，runtime owner 只同步 companion state。 |
| `docs/product/sabaki-training-prd.md:413-427` | checkpoint 完成后继续 Recall 或进入 Analysis。 | skip/comment resume 后清 active checkpoint runtime，tab 回 `recallSubstate: normal`。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:91-109` | UI 只展示；Container/Controller 调 Service；Service 编排；Repository 统一 DB；snapshotService 不打开 Tab。 | owner 无 UI/repository/snapshot/tab-service 依赖。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:112-158` | Mode transition 收敛到状态机；checkpoint 是 Recall substate；非法转换 reject/throw。 | flow service 保留 transition guard 和 parent orchestration；runtime region 不反写 mode。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:473-586` | `workbenchStore` 拥有 tab/mode/active ids；`trainingRuntimeStore` 保存 runtime transient。 | 实现把 runtime transient cleanup/activation 收束到 owner，不把 mode ownership 下放给 owner。 |
| `docs/architecture/gabaki-sabaki-training-architecture-v0.5.md:727-802` | `workbenchFlowService` 负责 Tab 内模式转换和跨实体流程编排。 | submit/enterRecall/completeRecall/checkpoint commands 仍从 flow service 发起。 |
| `docs/architecture/sabaki-state-field-mapping.md:171-202` | runtime companion fields 包括 `activeRecallSessionId`, `activeCheckpointId`, `correctionDraft`, `recallView`, `problemView`；Recall executor 不得改 source Attempt facts。 | owner 改动仅落在本轮 runtime fields；RTM-T05 断言 checkpoint cleanup 不写 protected Attempt fields。 |
| `docs/ui_ux/workbench-ui-ux-spec.md:23-31`, `:876-884` | UI mode 固定四个；RecallCheckpoint 是 Recall surface；Analysis return 使用保存目标。 | 本轮无视觉/layout 修改，未引入第五 mode。 |

派生产物冲突：未发现 approved contract/test audit 与真源冲突；archive contract/audit 仅作为 step scope 和 test guarantee 使用。

## 5. 副作用审查

允许副作用：

- `workbenchRuntimeRegion` 只通过 `trainingRuntimeStore` setter 写 runtime transient。
- `workbenchFlowService` 继续写 `workbenchStore.updateTab`，并在成功 transition 后通知 runtime/overlay/mode effects。
- `recallCheckpointService` 继续写 repository facts，skip/resume 成功后通过 runtime-region port 清 checkpoint runtime 并刷新 recall view。

未发现禁止副作用：

- 未引入 `window.sabaki`、`getTrainingContext`、snapshot/tab opening、overlay/scratch/engine/global Sabaki 到 runtime owner。
- 未发现 runtime owner 写 DB/repository、UI、game tree、document store、Attempt facts、RecallSession facts 或 WorkbenchMode。
- `startCheckpoint` / correction draft activation 没有被本轮自动化；仍是 deferred path。

Residual risks:

- `recallService.ts:246-247` 和 `:282-283` 仍有历史 runtime writes。它们未被本轮 RTM-T10 定为 blocker，且现有 recallService tests 仍依赖这些行为；后续若要做到严格单一 owner，应单独开 recall runtime activation/cleanup slice。
- checkpoint resume/skip/comment cleanup 当前由 checkpoint service 和 flow service 各通知一次 owner。最终状态正确，但不够干净；后续应明确唯一通知层。

## 6. 测试质量审查

APPROVED

- `test/training/workbenchRuntimeRegion.test.ts` 真实执行 `createWorkbenchFlowService`, real `workbenchStore`, real `trainingRuntimeStore`, real checkpoint/recall services 和 type-bound repository fake；不是 callback-only 或 setter-spy 测试。
- RTM-T01..T09 覆盖 state-forward、runtime final state、rejected/failed transition atomicity、subscription observation。
- RTM-T10 检查 production owner/export/forbidden import，以及 flow/checkpoint cleanup scope 中 direct setter token。`replaceFunctionBody` fix（`test/training/workbenchRuntimeRegion.test.ts:403-438`）支持 `async function` 与参数括号匹配，避免 allowed out-of-scope 函数体剥离失败；没有削弱 test-audit v0.3 批准的 dot/bracket/destructured/aliased/bound setter scan。
- JS suite 中既有 recallService tests 仍锁定 legacy raw runtime writes；这解释了为什么本轮只把 flow/checkpoint cleanup ownership 作为 architecture gate，而不强行扩大到 recallService 全面迁移。

验证结果：

| 命令 | 结果 | 判断 |
|---|---:|---|
| `git diff --stat` / `git diff` | clean | 当前只有无关未跟踪 `.harness-build/`，未纳入审查或提交。 |
| `npx mocha --require tsx test/training/workbenchRuntimeRegion.test.ts test/training/workbenchFlowService.test.js test/training/recallService.test.js test/training/modeTransitions.test.js test/training/modeStateResolver.test.js` | 218 passing | 目标 runtime regression 通过。 |
| `npx mocha --require tsx test/overlays/overlayStore.test.js test/overlays/workbenchOverlayRegionBoundary.test.js test/training/workbenchRuntimeRegion.test.ts test/training/workbenchFlowService.test.js test/training/recallService.test.js test/training/modeTransitions.test.js test/training/modeStateResolver.test.js` | 232 passing | overlay + runtime 回归通过。 |
| `npm test` | 1879 passing / 6 failing | 失败不由 `841bb74a` 引入：失败文件不在该 commit touched files 中。 |

Full suite failing checks:

| Failure | 文件/行 | 与本实现关系 |
|---|---|---|
| `analysisNoMutation.test.js` C20 expects non-analysis snapshot rejection | `test/training/analysisNoMutation.test.js:257` | 失败来自 snapshot guard 行为期望；`841bb74a` 未触碰该测试或 snapshot code。 |
| command map coverage missing `editbar.edit-position` affordance | `test/workbench/wiring/command-map-coverage.test.js:140` | UI command affordance coverage，不在 runtime-region scope。 |
| W5 analysis return payload expects `{tabId}` only, actual includes `reason: 'return'` | `test/workbench/wiring/w5-analysis-mode-wiring.test.js:521`, `:551` | Analysis wiring signature drift；`841bb74a` 未触碰该文件。 |

## 7. 范围控制审查

APPROVED

- 没有新增 WorkbenchMode、Problem-as-board-mode、review/checkpoint/punishment runtime mode。
- 没有把 snapshot、scratch workspace、engine target、overlay region、modeStateResolver diagnostics、rendered UI return 混入本轮。
- 没有修改 production/tests/checklist 以外的 requested implementation surface；本 review 只产出本文件。
- `.harness-build/` 未跟踪目录未纳入。

## 8. 需要手动检查的文件或行

| 文件 | 行 | 原因 |
|---|---:|---|
| `src/modules/training/workbench/workbenchRuntimeRegion.ts` | 21-35 | owner 具体 runtime setter 范围。 |
| `src/modules/training/workbench/workbenchFlowService.ts` | 239-241, 511, 554, 752, 790, 1022, 1079 | runtimeRegion composition 与 parent orchestration call sites。 |
| `src/modules/training/recall/recallCheckpointService.ts` | 54-55, 122-123, 160, 271, 307 | deferred activation/correction draft 与 resume cleanup port 边界。 |
| `src/modules/training/recall/recallService.ts` | 246-247, 282-283, 297-317 | legacy runtime writes 与 pure recall view mapper。 |
| `test/training/workbenchRuntimeRegion.test.ts` | 403-438, 758-823 | RTM-T10 helper fix 与 architecture boundary scan。 |

## 9. 建议操作

- 可以进入下一 workflow step。
- 在后续 step2.1b 或 cleanup slice 中，明确 `recallService` 的 runtime writes 是否继续作为 legacy contract，还是迁到 runtime-region owner。
- 后续收敛 checkpoint cleanup 的唯一通知层，避免 owner event 重复触发 subscriber/logging/generation。
- 单独处理当前 `npm test` 的 6 个既有/并行 wiring 失败，不要把它们归因到 runtime-region implementation。

## 10. Workbench 接线闭环追踪（如适用）

| 控件/命令 | Event | Container | Controller | Service/Store | Projection/UI | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| Play/Problem Submit | `submit` | existing container calls flow service | `workbenchFlowService.submit` | attempt/recall services persist facts; `workbenchStore.updateTab({mode:'recall'})`; `runtimeRegion.onRecallActivated` updates runtime | runtimeStore subscriber observes cleaned recall runtime | APPROVED |
| Enter Recall | `enterRecall` | command owner / container path | `workbenchFlowService.enterRecall` | `createRecallForAttempt`; tab goes recall; runtime owner activates recall | recallView and activeRecallSessionId align | APPROVED |
| Complete Recall | `completeRecall` | existing recall end callback | `workbenchFlowService.completeRecall` | flow creates Analysis return/context and calls `runtimeRegion.onRecallCompleted`; tab goes analysis | recall runtime cleared | APPROVED_WITH_RISK: recallService still has legacy raw cleanup |
| Skip Checkpoint | `resumeRecall` via skip | existing checkpoint action | `workbenchFlowService.skipCheckpoint` | checkpoint service persists skip; owner port clears checkpoint runtime; tab substate normal | active recall remains, activeCheckpoint/draft cleared | APPROVED_WITH_RISK: duplicate owner notification |
| Save Checkpoint Comment | `commentCheckpoint` then `resumeRecall` | existing checkpoint action | `workbenchFlowService.saveCheckpointComment` | save comment, resume recall, owner port clears checkpoint runtime, tab substate normal | active recall remains, activeCheckpoint/draft cleared | APPROVED_WITH_RISK: duplicate owner notification |
| Temporary Analysis / Return | `enterAnalysis` / `returnFromAnalysis` | existing mode action | `workbenchFlowService.enterAnalysis/returnFromAnalysis` | tab return target saved/restored; runtime owner not asked to clean source runtime | problem/recall runtime preserved | APPROVED |

## 11. 真源冲突清单（如适用）

| 冲突产物 | 冲突内容 | 统一真源 | 处理建议 |
| --- | --- | --- | --- |
| 无 | 无 | `docs/product/`, `docs/architecture/`, `docs/ui_ux/` | 无 |

可以继续。
