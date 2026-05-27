# 测试审计

Date: 2026-05-27
Role: test-auditor retry1
Subject: step1 overlay child-region transition tests
Initial test commit: 427a2898 `test-writer: add overlay region transition tests`
Retry test commit: c5599ec0 `test-writer: cover overlay transition matrix`

## 1. 结论

APPROVED

retry1 已关闭 v0.1 audit 的三项 blocker：`OVR-T09` 覆盖 `play/problem/recall -> analysis`；`OVR-T04` 覆盖 `analysis -> play/problem/recall`；`OVR-T03` 增加 public API mode-writer 负断言和 upward writer scan。当前目标测试仍按预期红灯于缺少 production `src/modules/overlays/workbenchOverlayRegion.ts`，不是 skip/pass-through 绿灯。

允许进入 implementation-agent。production 编辑范围限于：

- 新增 `src/modules/overlays/workbenchOverlayRegion.ts` 或同职责 overlay child-region adapter。
- 在 `src/modules/training/workbench/workbenchFlowService.ts` 注入并调用 overlay region transition port。
- 必要时更新相关 production 类型导出。

不得在本 implementation step 编辑 UI/container/projection、runtime/scratch/engine/snapshot/resolver 逻辑，除非先回到契约/测试步骤激活 OVR-T07/T08 或对应 deferred row。

## 2. 审查范围

| 文件 | 类型 | 是否生产 import | 备注 |
| --- | --- | --- | --- |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/test-contract-v0.2.md` | approved contract | 否 | 审计 OVR-T01/T02/T03/T04/T05/T06/T09，确认 OVR-T07/T08 deferred。 |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/contract-audit-v0.2.md` | approved contract audit | 否 | 确认 test-writer 可进入范围和 deferred 边界。 |
| `docs/archive/daily-design/2026-05-27/workbench-region-state-machines/overlay-region/test-audit-v0.1.md` | prior test audit | 否 | 核对 retry1 是否关闭三项 REQUEST_CHANGES。 |
| `docs/workflow-checklists/2026-05-27-workbench-region-state-machines.md` | workflow checklist | 否 | 只读；按用户要求本 agent 不修改 checklist。 |
| `test/overlays/overlayStore.test.js` | STORE_SUBSCRIPTION / SIDE_EFFECT_BOUNDARY | 是，`createOverlayStore` | T01/T02 使用真实 overlayStore、真实 subscriber/notify path、controlled Promise。 |
| `test/overlays/workbenchOverlayRegionBoundary.test.js` | ARCHITECTURE_BOUNDARY | 读 production source；实现后 require production module | T03 断言 typed region port、factory、forbidden public writer API、forbidden imports/calls。 |
| `test/training/workbenchFlowService.test.js` | SIDE_EFFECT_BOUNDARY | 是，`createWorkbenchFlowService`、`createWorkbenchStore`、`createOverlayStore`；实现后 require production overlay region | T04/T05/T06/T09 使用真实 flow/store/overlayStore，recording decorator 只记录后委托 production region。 |

## 3. 阻塞问题

无阻塞问题。

v0.1 blocker 关闭情况：

| v0.1 blocker | retry1 证据 | 状态 |
| --- | --- | --- |
| OVR-T09 只覆盖 `play -> analysis` | `test/training/workbenchFlowService.test.js:1175` 参数化 `['play', 'problem', 'recall']`；`:1193-1211` 断言 tab mode、previousMode、analysisReturnTarget、overlay flags false、region call from/to/reason。 | closed |
| OVR-T04 只覆盖 `analysis -> recall` | `test/training/workbenchFlowService.test.js:1215` 参数化 `['play', 'problem', 'recall']`；`:1251-1265` 断言目标 mode、return target 清理、tree position、overlay flags false、region call from/to/reason。 | closed |
| OVR-T03 public API / upward writer 断言偏弱 | `test/overlays/workbenchOverlayRegionBoundary.test.js:45-63` 禁止 module/region 暴露 `setMode`、`setWorkbenchMode`、`updateMode`、`updateWorkbenchMode`、`updateTab`、`setTabMode`；`:72-90` 扫描 forbidden import/call，包括 `setMode(`、`workbenchStore.updateTab`、`deps.workbenchStore.updateTab`、`createWorkbenchFlowService`。 | closed |

## 4. 弱测试与虚假通过风险

| 测试/位置 | 风险 | 为什么会误导 | 要求修改 |
| --- | --- | --- | --- |
| `test/training/workbenchFlowService.test.js:142` | `createMockDeps` 是 JS helper；`tsconfig.json:5` 为 `checkJs: false`，JSDoc 不是 CI 级类型约束。 | 本轮 overlay rows 未通过这些 mocked repository/attempt/snapshot/tab deps 证明 state transition，因此不是 fake green；但若 implementation 扩展 `restartAttempt` 依赖真实 repository/attempt 路径，手写 fake 会有 contract drift 风险。 | 非阻塞。若实现触碰这些生产依赖，必须升级为 TS typed/shared factory 或 in-memory repository fake。 |
| `test/training/workbenchFlowService.test.js:2062` | 旧 `describe.skip` fallback。 | 属于 out-of-scope `inferDefaultMode` helper fallback，不覆盖本轮 OVR-T01/T09 等核心 row。 | 非阻塞；不得为本轮核心 overlay contract 添加 skip。 |
| `test/training/workbenchFlowService.test.js:1207-1211` | T09 对 enterAnalysis 的 production region 内部 noop 不敏感。 | enterAnalysis 的 overlay contract 是通知 owner 且不自动开启 overlay；noop cleanup 在 entering Analysis 时不会破坏该 outcome。若 flow 不调用 region，`recording.calls.length` 会失败。 | 可接受；不要求补测。 |

fake-green 复查结论：

| 检查项 | 结论 | 证据 |
| --- | --- | --- |
| mocked `workbenchFlowService` | 未发现 | `test/training/workbenchFlowService.test.js:15` import/require real service，`:1180`、`:1220`、`:1273`、`:1307` 创建 real service。 |
| mocked `workbenchStore.updateTab` | 未发现 | `test/training/workbenchFlowService.test.js:7` 使用 real `createWorkbenchStore`；`:142-149` helper 暴露同一个 real store。 |
| callback-only assertion | 未发现 | Flow rows 均断言 final tab/overlay state：`:1193-1206`、`:1251-1261`、`:1290-1296`、`:1324-1328`；region call count 不是唯一 oracle。 |
| logger-only assertion | 未发现 | 本轮 overlay rows 不以 logger 作为主断言。 |
| legacy `sabaki.setMode` | 未发现作为测试路径 | 本轮 harness 不构造 Sabaki adapter；boundary scan 禁止 overlay module 使用 `sabaki.setMode`，见 `test/overlays/workbenchOverlayRegionBoundary.test.js:82-84`。 |
| 非真实 `overlayStore` | 未发现 | `test/overlays/overlayStore.test.js:3` 和 `test/training/workbenchFlowService.test.js:17` 使用 real `createOverlayStore`。 |
| UI/container 越界 | 未发现 | 本轮未修改或测试 UI/container；OVR-T08 仍 deferred。 |

## 5. 覆盖矩阵审计

| Source Row | Required Behavior | Test ID/File | Status | Notes |
| --- | --- | --- | --- | --- |
| OVR-T01 | Real `overlayStore.onModeChange(nonAnalysis)` clears active territory/compare and fires subscriber/notify outcome. | `test/overlays/overlayStore.test.js:125` | covered | Covers play/problem/recall and both territory + compare; asserts subscriber and `notifyChange`. |
| OVR-T02 | Late `ensureAnalysisReady` after leaving Analysis cannot revive overlay or schedule analysis side effects. | `test/overlays/overlayStore.test.js:187` | covered | Covers territory and compare; asserts flags false and no `analyzeMove` / `scheduleEditWorkspaceAnalysis`. |
| OVR-T03 | Overlay region/store import/API boundary; public API cannot set Workbench mode. | `test/overlays/workbenchOverlayRegionBoundary.test.js:15` | covered | Fails until region module exists; implementation must satisfy typed port/factory, API negative assertions, and forbidden writer scan. |
| OVR-T04 | Real `returnFromAnalysis` restores target mode and clears overlay for target play/problem/recall. | `test/training/workbenchFlowService.test.js:1215` | covered | Covers all three target modes with real flow/store/overlayStore and production region decorator. |
| OVR-T05 | Representative non-return Analysis exit clears overlay through the same child-region path. | `test/training/workbenchFlowService.test.js:1269` | covered | Uses `restartAttempt` from Analysis to problem; asserts tab mode, cleared return target, overlay false, no analysis side effects, region call. |
| OVR-T06 | Rejected transition does not notify overlay region and does not clear overlay. | `test/training/workbenchFlowService.test.js:1303` | covered | Covers analysis-without-target rejection; tab remains analysis, overlay remains active, zero region calls. |
| OVR-T07 | Overlay state projection to Workbench props. | Contract `test-contract-v0.2.md:237`, `:251` | deferred-with-approved-reason | Approved reason: step1 changes service/child-region boundary, not projection shape. Exit condition: activate if overlay state shape, container overlay props, toolbar subscription path, or rendered selected state changes. |
| OVR-T08 | ModeBar/Shell/Container command mapping with one-arg `onModeChange(key)`. | Contract `test-contract-v0.2.md:238`, `:252` | deferred-with-approved-reason | Approved reason: no UI/container edit is assigned in step1. Exit condition: activate if ModeBar/Shell/Container handler plumbing changes or audit requires command mapping proof. |
| OVR-T09 | Real `enterAnalysis` from play/problem/recall notifies overlay owner and leaves overlay false. | `test/training/workbenchFlowService.test.js:1175` | covered | Covers all three source modes; asserts return target, mode analysis, overlay false, region from/to/reason. |

## 6. Red/Green 检查

| 检查 | 结论 | 证据 |
| --- | --- | --- |
| 生产模块删除或导出错误时，核心测试会失败还是跳过/通过？ | 会失败 | 当前 `src/modules/overlays/workbenchOverlayRegion.ts` 不存在；目标命令得到 1 passing / 10 failing，失败点是 missing file/module。 |
| 被测 handler/region 改成 noop 时，测试会失败吗？ | 会失败于关键 rows | Flow noop 会使 T09/T04/T05 tab state 断言失败。Region cleanup noop 会使 T04/T05 overlay false 断言失败；T06 会捕获 rejected path 的错误通知/清理。 |
| Container 不传关键 props 时，测试会失败吗？ | 本轮不测 | OVR-T08 deferred 合理，因为 step1 未触碰 UI/container handler plumbing。 |
| resolver 忽略 mode/context 时，测试会失败吗？ | 本轮不测 | Resolver diagnostics 属于后续 step2.3，不是 overlay transition step1。 |
| executor/flow 写错 store 或漏写 store 时，测试会失败吗？ | 会失败 | T04/T05/T09 断言 real workbenchStore final tab mode、return target、tree position；不是只看 callback。 |
| store 更新后 UI projection 不变时，测试会失败吗？ | 本轮不测 | OVR-T07 deferred 合理，除非 implementation 改 overlay state shape/projection/toolbar props/subscription path。 |
| 当前未完成实现是否导致目标 contract 测试红灯？ | 是 | `npx mocha --require tsx test/overlays/workbenchOverlayRegionBoundary.test.js test/training/workbenchFlowService.test.js --grep "Workbench overlay region boundary|step1 overlay child-region transition boundary"` 当前 1 passing / 10 failing，均因缺少 production overlay region。 |

已运行验证：

| 命令 | 结果 |
| --- | --- |
| `npx mocha --require tsx test/overlays/overlayStore.test.js` | 10 passing |
| `npx mocha --require tsx test/overlays/workbenchOverlayRegionBoundary.test.js test/training/workbenchFlowService.test.js --grep "Workbench overlay region boundary|step1 overlay child-region transition boundary"` | expected RED: 1 passing, 10 failing |

## 7. Human Gate

- OVR-T07/OVR-T08 deferred 可以继续接受，前提是 implementation-agent 不改 projection、toolbar props、subscription path、ModeBar/Shell/Container handler plumbing。
- 本轮范围应保持为 overlay child-region transition boundary；不要扩大到 runtime、scratch、engine、diagnostics、snapshot 或视觉实现。
- 可以允许进入 implementation-agent；实现后应重跑本审计列出的两条命令，目标是 overlayStore 继续 GREEN，boundary/flow grep 命令由 expected RED 转为 GREEN。

测试质量可以进入人工确认。
