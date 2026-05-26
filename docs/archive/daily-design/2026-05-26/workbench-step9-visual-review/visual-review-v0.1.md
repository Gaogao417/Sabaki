# 视觉还原审查

## 1. 结论

REQUEST_CHANGES

当前 diff 的 focused six-screen projection 单元测试已经能证明 Problem、Recall、Checkpoint、Analysis、Library 和 edit bar 的主要高熵数据不再只靠静态面板样例；但本 gate 不能放行，原因有两个用户可见阻塞：

1. Library drawer 的真实 Electron/Playwright command path 失败。`npx playwright test --project=workbench-command` 中 `library Fox and 101 commands import or resolve synced tasks...` 点击 `打开资料库` 后 5 秒内找不到 `[data-testid="library-side-drawer"]`，101/Fox 打开/import 路径无法到达可见 drawer。
2. 截图验收 harness 当前不能跑完桌面 Problem 场景，更没有 compact breakpoint screenshot guard。`node docs/.visual-acceptance/workbench-harness/capture.js` 在 `#problem` 等待 `.workbench-shell` 超时。

唯一 retry 建议：把 upstream `step8.4` 的 Library 可见 drawer command 路径和 `step9.1` 的现有 screenshot harness/compact guard 合并成一次修复重试；修复后重跑本文第 6 节命令。

## 2. 严重视觉阻塞问题

1. **Library drawer 真实入口不可见**
   - Upstream: `step8.4` Library / external data wiring。
   - 证据：`e2e/workbench-command-acceptance.spec.js:245-248` 点击 `button[aria-label="打开资料库"]` 后断言 drawer 可见失败；Playwright 结果为 2 passed, 1 failed。
   - 影响：即使 `S6P-T06` 能用 `libraryProjection` 直接渲染 drawer 数据，用户从顶部资料库按钮无法进入 drawer，101/Fox 同步和打开任务路径没有真实可见验收。

2. **compact breakpoint screenshot guard 未建立**
   - Upstream: `step9.1` visual guard 集成。
   - 证据：`docs/.visual-acceptance/workbench-harness/capture.js` 仍固定 `1448 x 1086`，且执行时在 Problem 场景等待 `.workbench-shell` 超时；`docs/.visual-acceptance/workbench-harness/entry.js` 仍是静态 props harness，不是 compact projection guard。
   - 影响：无法证明 1279px/compact 折叠、board 居中、bottom bar、right drawer overlay 和文本溢出在真实截图下稳定。

## 3. Spec 对齐审查

| 区域 | 状态 | 证据 | 关注点 |
| --- | --- | --- | --- |
| Problem projection | PASS | `S6P-T01/T02` 通过；`TrainingWorkbenchContainer.js:1270-1288` 从 task cache/repository 投影 prompt/goal/passRule/side/reference；`ProblemModePanel.js:40-54` 消费 props | `ProblemRightPanel.js:28-39` 在缺源时仍有 `3.6`/`0.0 目`/`1/5` fallback，但 active sourced state 有负向测试守住。 |
| Recall normal | PASS | `S6P-T03` 通过；`TrainingWorkbenchContainer.js:1183-1215` 从 active `recallView` 投影 progress/count/status/error records | 可见状态来自 runtime view，非 `23 / 180` 静态样例。 |
| Recall checkpoint | PASS | `S6P-T04` 通过；`TrainingWorkbenchContainer.js:1312-1347` 异步加载 checkpoint projection，`1378-1436` join checkpoint/badMove/evaluation/comment | Unit guard 通过；full screenshot harness 仍未能跑。 |
| Analysis | APPROVE_WITH_NOTES | `S6P-T05` 通过；`AnalysisModePanel.js:157-181` 和 `AnalysisRightPanel.js:121-139` 从 `analysisProjection`/board projection 消费源数据 | 测试仍允许 `containerProps.analysisProjection` 直传，证明 props projection 可显示，但没有完整覆盖 repository/overlay/engine mapper 真实回流。 |
| Library | REQUEST_CHANGES | `S6P-T06` 单元通过；Playwright `workbench-command` Library case 失败 | Drawer 数据 props 能渲染，但真实 topbar command 无法打开 drawer。 |
| Analysis edit bar | PASS | Playwright `analysis edit-bar tool command mutates scratch/current...` 通过；`BottomActionBar.js:197-213` 渲染 annotation strip/actions | 已证明 scratch/current 变更且 source game tree 不变。 |
| Compact breakpoint | REQUEST_CHANGES | `capture.js` 固定 desktop viewport；`css-responsive.test.js` 只检查 media query 字符串 | 没有 Playwright screenshot/computed layout guard。 |

## 4. Token / CSS 审查

- `style/workbench.css:28-36` 声明 mode accent token，`43-66` 通过 `[data-mode]` 绑定 mode accent，方向正确。
- 旧 token/硬编码色仍在扩散：grep 命中 `--ui-blue`、`#2563ff`、`#145cff`，包括 drawer active tab/primary button 和 bottom action primary（例如 `style/workbench.css:1417-1420`, `1471-1477`, `3040-3044`）。这不是本次主要阻塞，但下一轮视觉修复应把 drawer/button/progress/toggle 状态统一到 `--mode-accent` 或明确的 library token。
- 未发现本次改动在 JS 中硬编码 mode 色；主要风险集中在 CSS。

## 5. 响应式与状态审查

- `style/workbench.css:3180-3194` 在 `max-width: 1279px` 直接隐藏当前 shell 的 left/right panels；没有截图或 computed layout 证明 compact 下有等价 drawer/overlay入口。
- `test/workbench/css-responsive.test.js:44-55` 和 `74-115` 只检查 `.wb-right-panel` / `.wb-left-panel` 字符串，未覆盖当前 `.workbench-shell__right-panel` / `.workbench-shell__left-panel` 的真实 computed layout，属于弱 guard。
- `LibrarySideDrawer.js:668-681` 有 backdrop/close button，但未看到 Escape 关闭处理；通用 `RightDrawer` 有 Esc 测试，Library drawer 没有复用该行为。
- Loading/empty/error/syncing 文案在 unit projection 中可见，但 Playwright 真实 drawer 打不开，因此不能作为用户可达状态放行。

## 6. 测试质量审查

已执行：

- `npx mocha --require tsx test/workbench/wiring/six-screen-projection.test.js`：8 passing。
- `npx mocha --require tsx test/workbench/panels/ProblemModePanel.test.js test/workbench/panels/ProblemRightPanel.test.js test/workbench/panels/RecallModePanel.test.js test/workbench/panels/RecallRightPanel.test.js test/workbench/panels/AnalysisModePanel.test.js test/workbench/panels/AnalysisRightPanel.test.js test/workbench/shell/BottomActionBar.test.js`：41 passing。
- `npx mocha --require tsx test/workbench/wiring/command-map-coverage.test.js`：5 passing。
- `npx mocha --require tsx test/workbench/shell/ModeBar.test.js`：6 passing。
- `npx mocha --require tsx test/workbench/css-responsive.test.js`：4 passing，但该测试是 class/media-query 字符串 guard，不能替代 compact screenshot。
- `npm run bundle`：webpack production bundle compiled successfully。
- `npx playwright test --project=workbench-command`：2 passing, 1 failing；Library drawer command case failed。
- `node docs/.visual-acceptance/workbench-harness/capture.js`：failed；Problem scenario timed out waiting `.workbench-shell`。

测试评价：

- `six-screen-projection.test.js` 的 sentinel 和 fallback negative assertions 能击穿多数静态样例假绿。
- Panel focused tests 多数仍是 component existence/callback 层，只能作为辅助。
- Library 的 unit projection 和 command-map coverage 没有覆盖到真实 Electron 可见 drawer；Playwright 已暴露断线。
- 截图验收当前既非 projection-sentinel，也非 compact。

## 7. 截图/人工验收缺口

- 没有成功生成本轮 Problem/Recall/Checkpoint/Play+Library/Analysis/Analysis+Library 截图。
- 没有 compact breakpoint 截图或 computed layout guard。
- 没有 drawer open/close/Esc close 的真实浏览器验收。
- 现有 visual harness `entry.js` 使用静态 `scenarioProps`，不能证明六屏数据来自真实 projection mapper。

## 8. 建议操作

1. 修复 `step8.4`：保证 `button[aria-label="打开资料库"]` 在真实 Electron Workbench 中打开 `LibrarySideDrawer`，并让 101/Fox click path 继续通过 `taskImportService -> tabService.openTask`。
2. 修复 `step9.1` guard：在现有 harness 或 Playwright 项目中补一个轻量 compact screenshot/computed layout guard，至少覆盖 1279px 或更窄视口的 board stage、bottom bar、drawer overlay 和无文本溢出。
3. 让 screenshot harness 使用高熵 projection fixture 或真实 Container projection，避免继续用静态 `scenarioProps` 当视觉真源。
4. 修复后重跑第 6 节所有命令，尤其是 `npx playwright test --project=workbench-command` 和 screenshot harness。

请先审查标注的视觉风险后再继续。
