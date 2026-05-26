# 测试审计

## 1. 结论

APPROVE

Step2 已修正 step1 测试中的过时 snapshot 假设：`snapshotService` 不再断言 play/problem/recall 可直接 capture；null-task 回归被改为非 analysis Snapshot 必须先 `enterAnalysis` 的 container guard；101 command-map 断言已对齐真实 `taskImportService.import101Problem` 方法名；E2E monkey patch 增加生产接口存在性 guard。

当前 RED 是合法实现缺口，不是测试质量问题。无需重试上游 step1.*；可进入 implementation-agent。

## 2. 审查范围

| 文件 | 类型 | 是否生产 import | 备注 |
| --- | --- | --- | --- |
| `test/training/modeTransitions.test.js` | controller/state transition contract | 是，真实 `modeTransitions.ts` | 删除 missing-module skip 风险；生产模块缺失会失败。 |
| `test/training/workbenchFlowService.test.js` | service/store transition test | 是，真实 `workbenchFlowService.ts` | Snapshot orchestration 已 analysis-only；focused snapshot rows 绿。 |
| `test/training/snapshotService.test.js` | service input/source contract | 是，真实 `snapshotService.ts` | 修正为非 analysis direct capture 必须拒绝；当前合法 RED。 |
| `test/workbench/wiring/snapshot-null-taskid.test.js` | container wiring / enter-analysis guard | 是，真实 `TrainingWorkbenchContainer` 和 stores | 保留 null-task crash guard，但验证非 analysis Snapshot 先 enter Analysis。 |
| `test/workbench/wiring/command-map-coverage.test.js` | command map / static owner-dispatch guard | 是，真实 command map + Container source scan | 修正 101 真实方法名；仍红在 legacy panel path。 |
| `e2e/workbench-command-acceptance.spec.js` | Playwright Electron command acceptance | 是，真实 renderer + stores + tabService | 增加 import/repository/tabService 接口存在性 guard，避免 monkey patch 掩盖接口漂移。 |
| `test/training/modeStateResolver.test.js` | resolver contract | 是，目标 production module | 未修改；继续合法 RED，等待 step3.1。 |
| `test/workbench/wiring/six-screen-projection.test.js` | Container projection anti-fake-green | 是，真实 Container/Shell/stores | 未修改；继续合法 RED，等待 step8/9 projection wiring。 |

## 3. 阻塞问题

无。

## 4. 弱测试与虚假通过风险

| 测试/位置 | 风险 | 为什么会误导 | 要求修改 |
| --- | --- | --- | --- |
| `test/training/modeTransitions.test.js:19`-`39` | 已修复：生产模块缺失时旧测试会 skip | 删除/导出错误可能被 `describe.skip` 掩盖 | 现在 `assert.ifError`，缺模块会红。 |
| `test/training/snapshotService.test.js:445`-`483` | 已修复：旧测试固化任意 mode direct snapshot | 与 PRD/step2 source truth 冲突，会把 legacy 过宽入口写绿 | 现在 play/problem/recall direct capture 期望 reject。 |
| `test/workbench/wiring/snapshot-null-taskid.test.js:212`-`247` | 已修复：旧 null-task 测试验证 direct snapshot | 会保留 null-task crash path 的老语义 | 现在验证 Container 调 `enterAnalysis`、不调 `snapshotFromCurrentContext/openTask`。 |
| `test/workbench/wiring/command-map-coverage.test.js:129`-`180` | 已修复：101 正则未包含真实 `import101Problem` | 实现若调用真实接口仍会假红/假红失败 | 已加入 `import101Problem`。 |
| `e2e/workbench-command-acceptance.spec.js:64`-`78` | 已修复：monkey patch 可掩盖生产接口删除 | 测试会临时创建不存在的方法，接口漂移仍通过 | 已加入生产方法存在性 guard。 |
| `test/workbench/wiring/snapshot-null-taskid.test.js:73`-`109` | 容器测试使用 flowService fake | 这是 Container command routing 层，不能声称真实 flow persistence covered | Manifest 已声明层级；真实 flow analysis-only 由 `workbenchFlowService.test.js` 覆盖。 |

## 5. 覆盖矩阵审计

| Source Row | Required Behavior | Test ID/File | Status | Notes |
| --- | --- | --- | --- | --- |
| step1.1 snapshot transition | `snapshot` 只允许 analysis；play/problem/recall 不进入 direct persistence。 | `modeTransitions.test.js:307`-`324`, `workbenchFlowService.test.js` snapshot grep run | covered | Focused run 绿。 |
| step2 stale snapshot removal | 删除“任意 mode captureSnapshotInput succeeds”旧断言。 | `snapshotService.test.js:445`-`483` | covered | 当前 RED 合法：production 尚未拒绝非 analysis capture。 |
| step2 null-task crash guard | `taskId:null` 的非 analysis Snapshot 不直接 snapshot，不创建 child task，先进入 Analysis scratch workspace。 | `snapshot-null-taskid.test.js:212`-`247` | covered | 当前 RED 合法：Container 仍直调 snapshot persistence。 |
| step1.4 external command owner | Fox/101 command 必须 `taskImportService -> tabService.openTask`，禁止 legacy panel。 | `command-map-coverage.test.js:129`-`180` | covered | 当前 RED 合法：Container 仍 `toggleThirdPartyPanel`。 |
| step1.5 E2E library command | Fox/101 click import/lookup synced tasks, forbid legacy panel, open Workbench task tabs。 | `e2e/workbench-command-acceptance.spec.js:213`-`249` | covered | 当前 RED 合法：legacy panel calls recorded。 |
| WMSR resolver | ModeState resolver from tab/runtime/overlay/engine/Sabaki snapshot is pure and mode-truthful。 | `modeStateResolver.test.js` | covered | 0 passing / 16 failing because target module absent; legal RED. |
| S6P projection | Six-screen panels show high-entropy source data, not static fallback; presentational boundary clean。 | `six-screen-projection.test.js` | covered | 1 passing / 7 failing against current static projections; legal RED. |
| Edit-bar scratch mutation | Edit bar writes Analysis scratch/current and feeds Snapshot/Problem material。 | `e2e/workbench-command-acceptance.spec.js:15`-`17`, `:252`-end | deferred-with-approved-reason | This suite remains smoke only. Approved by step1.review; exit in step8.5/step9.2. |

## 6. Red/Green 检查

| 检查 | 结论 | 证据 |
| --- | --- | --- |
| 生产模块删除或导出错误时，核心测试会失败还是跳过/通过？ | 会失败。 | `modeTransitions.test.js:19`-`39` 已去掉 missing-module skip；`modeStateResolver` 缺模块当前 16 RED。 |
| 被测 handler 改成 noop 时，测试会失败吗？ | 会。 | Null-task guard 要求 `enterAnalysis` call + store mode update；command-map/E2E 要求 Fox/101 owner path。 |
| Container 不传关键 props 时，测试会失败吗？ | 会。 | Six-screen projection 断言真实高熵文本；null-task guard 通过 Container shell `onSnapshot` 路径。 |
| resolver 忽略 mode/context 时，测试会失败吗？ | 会。 | `modeStateResolver.test.js` 覆盖 legal/illegal mode matrix、legacy mismatch、purity。 |
| executor/service 写错 store 或漏写 store 时，测试会失败吗？ | 部分会，scratch mutation deferred。 | WorkbenchFlow snapshot rows assert analysis-only + child tab; edit-bar scratch mutation deferred to step8.5/9.2。 |
| store 更新后 UI projection 不变时，测试会失败吗？ | 会。 | Six-screen projection current RED 证明静态 projection 会失败。 |
| 当前未完成实现是否导致目标 contract 测试红灯？ | 会。 | Snapshot source guard 5 RED, resolver 16 RED, six-screen 7 RED, command E2E 1 RED。 |

Focused verification:

| Command | Result | Interpretation |
| --- | --- | --- |
| `npx mocha --require tsx test/training/modeTransitions.test.js test/training/snapshotService.test.js test/workbench/wiring/snapshot-null-taskid.test.js test/workbench/wiring/command-map-coverage.test.js` | 77 passing / 5 failing | Legal RED: 3 snapshotService non-analysis guards, 1 null-task enter-analysis guard, 1 legacy library command guard。 |
| `npx mocha --require tsx --grep "snapshotFromCurrentContext\|P1G-T15\|Snapshot persistence\|Snapshot null-task\|external material" ...` | 34 passing / 5 failing | Same focused legal RED; flow-service snapshot orchestration rows are green。 |
| `npx mocha --require tsx test/training/modeStateResolver.test.js` | 0 passing / 16 failing | Legal RED: target module absent until step3.1。 |
| `npx mocha --require tsx test/workbench/wiring/six-screen-projection.test.js` | 1 passing / 7 failing | Legal RED: current UI still static/fallback and boundary leak exists。 |
| `npx playwright test --project=workbench-command` | 2 passing / 1 failing | Legal RED: Fox/101 still call legacy third-party panel。 |

## 7. Human Gate

- 是否接受当前 RED 作为实现入口：建议接受；红灯都对应已知 step3/5/8/9 缺口。
- 是否重试上游 step1：不需要；本 step 已直接修正 stale snapshot、null-task guard、101 method drift、E2E interface guard。
- 是否允许进入 implementation-agent：建议允许进入 `step3.1`，并保留 snapshot RED 给后续 `step5.1` / `step5.2`。
- Deferred 项：edit-bar scratch/current mutation仍按 `step8.5` / `step9.2` 退出，不把当前 smoke 当作完整覆盖。

测试质量可以进入人工确认。
