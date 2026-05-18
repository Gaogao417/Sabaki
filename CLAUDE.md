# Sabaki — Claude Code 项目上下文

## 项目概要

Sabaki 是一个围棋/SGF 编辑器，基于 Electron + React 架构。
- `src/main.js` — Electron 主进程入口
- `src/modules/sabaki.js` — 核心状态管理（类似 store）
- `src/modules/` — 业务逻辑模块（enginesyncer, gametree, territory 等）
- `src/components/` — React UI 组件
- `src/modules/overlays/` — 解析器/执行器层

## 架构边界（不可违反）

- **resolver 不直接修改状态** — 只做意图解析，交给 executor
- **store（sabaki.js）不调用 engine/UI** — 只管理状态
- **component 不直接修改 core store** — 必须通过 resolver/executor
- **禁止 `window.sabaki` 全局查找**，除非明确允许
- **problem 不是 board mode** — 它是独立的交互模式
- **play/recall/analysis 是 tab phase**，不是 mode
- **recall/analysis 不能修改 game tree**（只读操作）

## 必须遵守的工作流

对于业务、状态、架构边界类功能开发，**禁止直接实施**。一口气跑完以下流程，中途不停等确认：

1. **澄清需求** — 用 contract-designer 生成测试/验收契约
2. **写测试** — 用 test-writer 写测试代码，禁止绑定实现细节，写契约测试
3. **提交测试** — 单独提交初版测试（commit message 标注为测试契约）
4. **implementation-agent 实施** — 按 ticket 范围实施
5. **跑测试** — 确保通过
6. **提交实现** — 单独提交实现代码
7. **architecture-reviewer 审 diff** — 检查架构边界

### 前端视觉工作流（不可用通用业务契约流程替代）

当任务涉及 UI、CSS、布局、设计 token、响应式、截图验收、Figma/截图还原、纯样式偏差修复时，必须使用前端视觉工作流：

1. **读取视觉真源** — 用 frontend-design-source-reader 读取 UI/UX spec、截图、设计稿、现有 CSS/组件，输出视觉真源索引。
2. **生成视觉契约** — 用 frontend-contract-designer 生成前端视觉契约，归档到 `docs/design/YYYY-MM-DD/<task>/frontend-visual-contract-v0.N.md`。
3. **写视觉测试** — 用 visual-test-writer 编写静态 token、computed style、Playwright layout、截图和人工验收测试。
4. **前端实施** — 用 frontend-implementation-agent 实施 UI/CSS/组件，并运行相关测试和浏览器截图验收。
5. **视觉还原审查** — 用 visual-fidelity-reviewer 审查 spec 对齐、token、响应式、截图和弱测试风险。

前端视觉任务要对齐的是用户实际看到的 UI，不是组件是否存在、class 是否存在、`data-testid` 是否存在或 callback 是否触发。

### 提交要求（不可跳过）

- 测试和实现必须分两次提交
- 先提交测试，再提交实现
- **每个 Phase 完成后必须单独提交**（含该 Phase 的测试 + 实现，共两次提交）
- Phase 顺序：4 → 5 → 6 → 7，不得跨 Phase 混合提交

## 测试规范

- 优先写契约测试（测行为/状态流），不写调用顺序测试
- 大量 mock 的测试标记为脆弱
- 保护架构边界的测试优先级最高

## 前端视觉测试规范

前端视觉测试不得只证明结构存在。以下只能作为辅助测试，不能作为主验收：

- 组件存在
- `data-testid` 存在
- class 字符串存在
- 按钮数量正确
- callback 触发
- CSS 中出现某个 media query 字符串

前端主验收应优先覆盖：

- shell 行列、grid 宽度、棋盘最小尺寸、gap、padding
- toolbar、bottom bar、drawer、card 的高度、圆角、阴影、分组
- spec token 名称和值，禁止 JS 硬编码模式色
- 中文文案精确匹配
- hover / active / disabled / empty / loading / success / error 状态
- 指定 viewport 的响应式折叠和截图验收

前端视觉工作流说明见 `.claude/workflows/frontend-visual-workflow.md`。

## 常用命令

- `npm test` — 跑测试
- `npm start` — 启动开发
- `npm run build` — 构建
