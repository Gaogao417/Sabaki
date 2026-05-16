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

对于功能开发，**禁止直接实施**。必须遵循：

1. **澄清需求** — 用 test-contract-designer 生成测试/验收契约
2. **人工确认测试契约** — 用户分类：必须自动化 / 手动验收 / 暂不测试
3. **确认后写测试** — 禁止绑定实现细节，写契约测试
4. **人工确认测试** — 用户确认测试不过度指定
5. **implementation-agent 实施** — 按确认的 ticket 范围实施
6. **跑测试** — 确保通过
7. **architecture-reviewer 审 diff** — 检查架构边界
8. **输出人工验收清单** — 用户最终验收

### 人工闸门（不可跳过）

- 测试契约生成后 → 等待用户确认
- 测试分类后 → 等待用户确认
- 代码实施后 → 等待用户确认

## 测试规范

- 优先写契约测试（测行为/状态流），不写调用顺序测试
- 大量 mock 的测试标记为脆弱
- 保护架构边界的测试优先级最高

## 常用命令

- `npm test` — 跑测试
- `npm start` — 启动开发
- `npm run build` — 构建
