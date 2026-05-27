# Sabaki — Codex 仓库上下文

本文件只保留 Sabaki 的基础项目上下文和架构边界。

Workflow skills 只在用户明确要求时使用；不要因为任务属于 Sabaki 就自动进入 workflow。

## Agent / Skill 提交规则

- 每个 Codex agent 或 skill 完成一次独立职责后，必须先创建一次 git commit，再进入下一个 agent、skill 或 workflow step。
- 提交只包含该 agent/skill 本次实际负责的文件；不得把工作区中已有的无关改动一起提交。
- 如果该 agent/skill 是只读审查、规划或没有产生文件改动，也必须使用空提交记录完成状态，例如 `git commit --allow-empty -m "<agent-or-skill>: <step summary>"`。
- workflow 调度时，主会话负责在每个 agent/skill 返回后完成提交，并在 checklist 中记录该步骤已提交。

## 项目概要

Sabaki 是一个围棋/SGF 编辑器，基于 Electron + React 架构。

- `src/main.js` — Electron 主进程入口
- `src/modules/sabaki.js` — 核心状态管理（类似 store）
- `src/modules/` — 业务逻辑模块（enginesyncer, gametree, territory 等）
- `src/components/` — React UI 组件
- `src/modules/overlays/` — 解析器/执行器层

## 架构边界

- **resolver 不直接修改状态** — 只做意图解析，交给 executor
- **store（sabaki.js）不调用 engine/UI** — 只管理状态
- **component 不直接修改 core store** — 必须通过 resolver/executor
- **禁止 `window.sabaki` 全局查找**，除非明确允许
- **problem 不是 board mode** — 它是独立的交互模式
- **play/problem/recall/analysis 是 WorkbenchMode 主状态**，不要新增 review/checkpoint/punishment 等运行态 mode
- **recall/analysis 不能修改 game tree**（只读操作）

## Workbench 状态机实现原则

- WorkbenchMode 是用户可感知的父状态机；mode 迁移必须走 `workbenchFlowService` 或后续同职责的 `workbenchModeService`。
- `modeTransitions.ts` 只做纯 transition policy；`assertTransition` 只做 service-level 薄适配和拒绝，不承载新的业务规则。
- `modeStateResolver.ts` 只做 read-only projection / invariant diagnostics；它可以发现非法 companion state，但不能写 store、调用 service 或自动修复状态。
- mode 迁移时同步 companion state；同步逻辑应通过 owner service/region 执行，不要让 `workbenchFlowService` 直接变成巨型状态桶。
- 适合自动同步的是 transient companion / projection / cache，例如 `problemView`、`recallView`、checkpoint runtime、territory/compare overlay、analysis scratch workspace。
- 不得静默修复业务事实或用户产物，例如 `Attempt.userLine/result/status`、RecallSession、Task/Problem、MoveEvaluation/BadMove、SGF game tree、comment、review schedule。
- overlay、engine、analysis scratch、recall checkpoint、problem runtime 可作为 child region state machine；父状态机只发送 transition intent，child region 自己处理清理、async generation/target guard 和通知。
- child region 不能反向修改 WorkbenchMode；需要切 mode 时必须回到 `workbenchFlowService` / `workbenchModeService`。
- 测试要验证最终 outcome，而不是只断言 `mode` 或 setter 顺序：业务事实、tab/runtime active id、projection、rendered UI、overlay/scratch/engine cleanup 都要与目标 mode 匹配。
- 日志用于审计和排查，不能作为主要测试 oracle；推荐记录 transition requested/rejected/committed、region transition/recovered/invalid_after_commit、async stale ignored，并带 `tabId/fromMode/toMode/reason/region/correlationId/workspaceId/sessionId/generation`。

## 常用命令

- `npm test` — 跑测试
- `npm start` — 启动开发
- `npm run build` — 构建
