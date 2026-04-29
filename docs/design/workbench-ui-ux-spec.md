# Gabaki / Sabaki 魔改版 UI/UX 复刻文档

> 目标：让前端 Agent 在不破坏 Sabaki 原有整体气质的前提下，复刻并实现新的模式化工作台 UI。重点是给“对局 / 回忆 / 复盘”三种核心模式提供清晰空间，让功能更易用、更可视、更有层级感。

## 适用范围

本文是 [Gabaki Training PRD](../product/gabaki-training-prd.md) 的阶段性视觉方案，不是产品全量蓝图。

- 覆盖范围：对局模式、回忆模式、复盘 / Analysis 模式的工作台布局与视觉层级。
- 参考图：见 [workbench-ref-pics](workbench-ref-pics/README.md)。
- 不覆盖完整训练模式页面、Problem Editor、Problem Mode、Punishment Problem、Review / 复习队列等全量页面。
- 如果本文与 PRD 出现范围差异，产品能力以 PRD 为准；本阶段的布局、控件优先级和视觉表现以本文和参考图为准。

---

## 0. 设计结论摘要

当前方向不是重做一个全新围棋软件，而是在 Sabaki 原界面基础上做“现代化工作台改造”。

核心原则：

1. **棋盘永远是视觉中心**  
   中央棋盘不被功能面板抢走注意力。任何模式下，棋盘都应该占据页面最大、最稳定的位置。

2. **顶部只保留模式标签 + 当前模式核心动作**  
   删除多余的“切换模式”“退出本模式”。模式切换通过顶部标签完成。

3. **每个模式有自己的主任务区**  
   左侧负责当前模式的任务和操作；右侧负责解释、反馈、AI 分析、变化树等辅助信息。

4. **不改变整体效果，只优化层级和空间**  
   继续保留 Sabaki 的三栏结构、macOS 桌面应用感、中央棋盘、左右信息面板、浅色背景、圆角卡片。

5. **当前主要实现三种模式**  
   - 对局模式：下棋、引擎、认输、新对局、对局设置。
   - 回忆模式：直接回忆全局棋谱，不做复杂分段。
   - 复盘模式：关键点、失误、备注、AI 点评、变化树、快照对比。

训练模式目前可以作为顶部标签保留，但不需要优先实现完整页面。

---

## 1. 全局信息架构

### 1.1 页面整体结构

使用固定三栏工作台结构：

```txt
┌──────────────────────────────────────────────────────────────┐
│ macOS / Electron title bar                                   │
├──────────────────────────────────────────────────────────────┤
│ Top Mode Bar: 对局模式 | 回忆模式 | 复盘模式 | 训练模式       │
│                                      当前模式动作按钮区       │
├───────────────┬──────────────────────────────┬───────────────┤
│ Left Sidebar  │          Board Stage          │ Right Sidebar │
│ 当前模式任务  │          中央棋盘              │ 辅助信息       │
│ 控制/列表/日志│          底部状态/控制          │ 分析/反馈/树   │
└───────────────┴──────────────────────────────┴───────────────┘
```

### 1.2 推荐尺寸比例

以 1440 × 1000 左右的桌面窗口为基准：

- 左栏：280–320px
- 中央棋盘区：自适应，占主要空间，尽可能让棋盘保持正方形
- 右栏：280–320px
- 顶部模式栏：64–72px
- 底部状态区：40–56px

中央棋盘优先级最高。如果窗口变窄，优先压缩左右栏，不压缩棋盘到不可用状态。

---

## 2. 顶部模式栏设计

### 2.1 必须删除的控件

不要实现以下两个按钮：

- `切换模式`
- `退出本模式`

原因：

- 功能语义重复。
- 增加视觉噪音。
- 模式标签本身已经提供明确入口。

### 2.2 顶部模式标签

顶部左侧/中部放模式标签：

```txt
[ 对局模式 ] [ 回忆模式 ] [ 复盘模式 ] [ 训练模式 ]
```

要求：

- 当前模式高亮。
- 非当前模式保持浅灰 / 低强调。
- 每个标签可以带一个简单图标，但图标不应喧宾夺主。
- 标签之间可用细分隔线或轻背景区分。

### 2.3 当前模式动作区

顶部右侧显示当前模式的核心动作。

#### 对局模式顶部动作

```txt
[ + 新对局 ] [ 对局设置 ] [ 认输 ]
```

优先级：

1. `新对局`：蓝色主按钮。
2. `对局设置`：中性按钮，带齿轮图标。
3. `认输`：红色危险按钮，带旗帜图标。

#### 回忆模式顶部动作

回忆模式不要堆太多顶部动作，最多保留：

```txt
[ 对局设置 ]
```

也可以不放动作按钮，把所有操作放左栏。

#### 复盘模式顶部动作

```txt
[ + 新建复盘 ] [ 复盘设置 ]
```

不要放“退出本模式”。

---

## 3. 通用视觉风格

### 3.1 设计气质

关键词：

- 现代桌面应用
- 浅色
- 清爽
- 有卡片层级
- 不花哨
- 不游戏化
- 不做成网页 SaaS 大屏
- 保留 Sabaki 的棋盘中心感

### 3.2 色彩建议

```css
:root {
  --bg-app: #f6f7f8;
  --bg-panel: #ffffff;
  --bg-panel-soft: #fafafa;
  --border-subtle: rgba(15, 23, 42, 0.08);
  --border-strong: rgba(15, 23, 42, 0.14);

  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --text-tertiary: #9ca3af;

  --accent-blue: #1677ff;
  --accent-blue-soft: #eaf3ff;

  --accent-green: #20b26b;
  --accent-green-soft: #eaf8f0;

  --accent-purple: #6d5dfc;
  --accent-purple-soft: #f0edff;

  --danger-red: #dc3b31;
  --danger-red-soft: #fff0ef;
}
```

模式色建议：

- 对局模式：蓝色
- 回忆模式：绿色
- 复盘模式：紫色
- 训练模式：可以暂用灰蓝或橙色，但当前不优先实现

### 3.3 圆角与阴影

```css
:root {
  --radius-panel: 14px;
  --radius-card: 10px;
  --radius-button: 8px;

  --shadow-panel: 0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.04);
  --shadow-board: 0 10px 28px rgba(15, 23, 42, 0.16);
}
```

不要用重阴影。整体应该轻、干净、稳定。

### 3.4 字体层级

推荐：

- 面板标题：13–14px，600 weight
- 正文：12–13px，400–500 weight
- 说明文字：12px，颜色 `--text-secondary`
- 数字状态：18–28px，根据重要性放大
- 按钮文字：13px，500–600 weight

---

## 4. 通用组件规范

### 4.1 Panel 面板

所有左右栏模块使用统一 Panel：

```tsx
<Panel title="当前对局" actions={...}>
  ...
</Panel>
```

样式：

- 白色背景
- 1px 细边框
- 10–14px 圆角
- 内边距 12–16px
- 模块之间 10–12px 间距

Panel Header：

- 左侧标题
- 右侧可放状态点、折叠按钮、更多按钮
- 不要在 Header 放太多操作

### 4.2 Button 按钮

按钮分三类：

1. Primary：主操作，如 `新对局`、`开始回忆`、`保存笔记`
2. Secondary：普通操作，如 `对局设置`、`校对答案`
3. Danger：危险操作，如 `认输`

按钮高度：

- 顶部主按钮：40–44px
- 面板内按钮：34–40px
- 小按钮：28–32px

### 4.3 ModeTab 模式标签

```tsx
<ModeTab active icon label="对局模式" />
```

要求：

- 当前模式使用轻背景 + 模式主色描边/底线。
- 非当前模式低对比，不要太抢眼。
- 不要额外加“进行中”状态，除非该状态真的有强业务意义。

### 4.4 BoardStage 棋盘舞台

棋盘舞台由三层组成：

```txt
BoardStage
  ├── BoardFrame  // 绿色/灰绿色棋盘外框，保留原 Sabaki 气质
  │   └── GoBoard // 木纹棋盘
  └── BoardFooter // 当前手数、胜率条、播放控制等
```

要求：

- 棋盘始终居中。
- 棋盘外框不要太厚。
- 棋盘底部信息不要挤占太多空间。
- 不要在棋盘上叠过多 UI；高亮、候选点、编号必须克制。

---

## 5. 对局模式 UI 规范

### 5.1 对局模式目标

对局模式是“实际下棋 / 引擎对弈 / 控制局面”的模式。

用户在这里最关心：

1. 当前谁执黑白。
2. 当前轮到谁。
3. 引擎是否在思考。
4. 是否需要新开局、设置、认输。
5. 当前棋局基本分析和变化树。

### 5.2 顶部区域

```txt
[ 对局模式(active) ] [ 回忆模式 ] [ 复盘模式 ] [ 训练模式 ]
                                      [ + 新对局 ] [ 对局设置 ] [ 认输 ]
```

不要出现：

- 切换模式
- 退出本模式

### 5.3 左栏结构

左栏建议顺序：

```txt
当前对局
局面控制
引擎日志
```

#### 当前对局 Panel

内容：

```txt
黑方         VS       白方
AI 引擎(B)           AI 引擎(W)
提子：0              提子：1

贴目：6.5目     规则：中国规则     [对局设置]
```

要求：

- 黑白双方以两个小卡片展示。
- 中间 `VS` 弱化。
- 当前执子方可以用小状态点或轻描边提示。

#### 局面控制 Panel

内容：

```txt
AI 思考中...
[|<] [<] [播放] [>] [>|] [自动]
[ 分析此局面 ]
```

要求：

- AI 状态条要可见但不夸张。
- 播放控制保持紧凑。
- `分析此局面` 是次级主按钮，不要比顶部 `新对局` 更抢眼。

#### 引擎日志 Panel

内容：

```txt
引擎日志                         ● 引擎已连接
1 kata-genmove_analyze B 50
  = info move (...)
  = play N3
2 kata-genmove_analyze W 50
  = info move (...)
  = play E9
...
[输入命令...] [send]
[收起日志]
```

要求：

- 日志可滚动。
- 字体使用等宽或近似等宽。
- 命令输入区放底部。
- 日志不要过度抢占左栏，可以默认高度固定。

### 5.4 中央棋盘区

棋盘下方：

```txt
● 黑方胜率 52.3%   [胜率条]   白方胜率 47.7% ○
最后落子：C8（第 8 手）                  [胜率变化图 v]
```

要求：

- 胜率条薄一点，不要做成大组件。
- 最后落子信息清晰。
- `胜率变化图` 可以是下拉或弹出图表入口。

### 5.5 右栏结构

```txt
分析
局面信息
变化树
```

#### 分析 Panel

未分析状态：

```txt
暂无分析数据
开始分析以查看胜率和分支走势。
[ 开始分析 ]
自动分析 toggle   设置
```

#### 局面信息 Panel

```txt
最后落子    C8
落子编号    第 8 手
当前轮次    黑方
提子数      黑 0 / 白 1
```

#### 变化树 Panel

保留 Sabaki 原有纵向变化树气质，但要卡片化：

- 当前节点高亮。
- 底部保留缩放 / 居中 / 展开按钮。
- 不要让树过于复杂。

---

## 6. 回忆模式 UI 规范

### 6.1 回忆模式目标

回忆模式不是刷分段任务，而是训练用户对整局棋谱的回忆能力。

**当前方向：直接回忆全局棋谱。**

不要做：

- 阶段选择
- 1–20 / 21–40 / 54–63 这种复杂分段
- 多层任务目标
- 太复杂的提示等级系统

### 6.2 顶部区域

```txt
[ 对局模式 ] [ 回忆模式(active) ] [ 复盘模式 ] [ 训练模式 ]                  [对局设置]
```

顶部只保留轻量设置入口即可，甚至可以不放动作按钮。

### 6.3 左栏结构

左栏只放一个核心任务面板：

```txt
回忆任务

回忆全局棋谱
请尽量回忆整局棋谱的落子位置

已回忆手数
63 / 120
[========------] 52%

[ ▶ 开始回忆 ]
[ ✓ 校对答案 ]
[ 💡 显示提示 ]

小贴士
回忆时可在棋盘上点击落子，
不确定的位置可以先跳过。
```

要求：

- 左栏极简。
- `63 / 120` 是最重要的数据，应放大。
- `开始回忆` 用绿色主按钮。
- `校对答案` 和 `显示提示` 是次级按钮。
- 小贴士放底部，文字弱化。

### 6.4 中央棋盘区

棋盘是回忆交互主体。

交互逻辑：

1. 用户点击棋盘空点落子。
2. 系统根据当前应回忆手数判断颜色。
3. 用户可以跳过不确定位置。
4. 用户点击“校对答案”后显示正确 / 错误 / 未回忆。

棋盘标记：

- 当前要落的位置可以用绿色细描边方框。
- 候选点最多显示 3 个。
- 不要在棋盘上显示大量编号，除非用户开启“显示手数”。
- 错误点可以在校对后用红色轻标记。

棋盘底部状态栏：

```txt
当前棋谱：示例对局.sgf          共 120 手       ● 黑先       贴目：6.5       规则：数子法
```

### 6.5 右栏结构

右栏建议：

```txt
回忆提示
结果反馈
变化树
```

#### 回忆提示 Panel

```txt
点击棋盘上的空点查看提示
[显示候选点（3个） toggle]
```

不要做复杂提示等级。

#### 结果反馈 Panel

```txt
总体正确率 83%
正确 52
错误 6
未回忆 62
```

可以使用小环形图，但不要做得太大。

#### 变化树 Panel

只显示当前附近手数：

```txt
53
54 active
55
56
57
58
59
60
...
```

变化树只做轻量导航，不要在回忆模式里承担太多分析任务。

---

## 7. 复盘模式 UI 规范

### 7.1 复盘模式目标

复盘模式是当前最重要、也最成熟的方向。它需要支持：

1. 按关键点理解一局棋。
2. 标记失误、疑问手、最佳点。
3. 结合 AI 分析看候选手。
4. 记录复盘笔记。
5. 通过变化树和快照对比理解局面变化。

### 7.2 顶部区域

```txt
[ 对局模式 ] [ 回忆模式 ] [ 复盘模式(active) ] [ 训练模式 ]       [ + 新建复盘 ] [ 复盘设置 ]
```

不要出现：

- 切换模式
- 退出本模式

### 7.3 左栏结构

左栏建议顺序：

```txt
复盘流程
复盘笔记
底部辅助按钮
```

#### 复盘流程 Panel

顶部：

```txt
复盘流程                 18 / 42 手    42.9%
[progress]
第 18 手（黑 C8）        关键点
```

筛选标签：

```txt
[全部 42] [关键点 8] [失误 3] [备注 5]
```

节点列表：

```txt
12 第 12 手（白 F4）    最佳点
白棋拆二有力，奠定右下基础。

15 第 15 手（黑 Q4）    疑问手
此处有更强的选择，注意右边厚势。

18 第 18 手（黑 C8）    关键点
左上定式变化关键手，影响全局平衡。
[小棋盘缩略图]

24 第 24 手（白 D16）   失误
应考虑连接，避免被黑厚势压制。

31 第 31 手（黑 R13）   疑问手
可先手占角，收益更大。

[ + 添加新节点 ]
```

要求：

- 当前节点用紫色轻背景和描边高亮。
- 标签颜色：
  - 最佳点：绿色
  - 关键点：紫色
  - 失误：红色
  - 疑问手：橙色
- 节点文案最多两行，避免左栏过满。
- 小棋盘缩略图只在当前节点或 hover 时显示。

#### 复盘笔记 Panel

```txt
复盘笔记
[在此输入复盘笔记...]
[B] [I] [列表] [链接] [图片]
0 / 2000
[保存笔记]
```

要求：

- 笔记区不要太高，避免压缩上面的复盘流程。
- 保存按钮用紫色。

### 7.4 中央棋盘区

棋盘上：

- 当前手用紫色圆环高亮。
- 只高亮当前关键手，不要同时显示太多候选点。
- 如果显示分支，使用轻量标记，不要覆盖棋子。

棋盘下方控制：

```txt
[上一步] [下一步] [跳转到] [自动播放]             [显示分支 toggle]
---------------- timeline slider ----------------
● 黑方胜率 52.3%             18 / 42             白方胜率 47.7% ○
```

要求：

- 播放控制紧凑。
- 时间轴是复盘模式的重要组件，应清晰可拖动。
- 当前手数 `18 / 42` 居中显示。

### 7.5 右栏结构

右栏建议顺序：

```txt
AI 分析
局面点评
变化树
快照对比
```

#### AI 分析 Panel

```txt
AI 分析
黑方胜率 52.3%       白方胜率 47.7%
[胜率条]

推荐手（白棋）
1 P16    胜率 53.7%    目差 +1.4
2 R16    胜率 52.1%    目差 +0.2
3 P16    胜率 50.8%    目差 -0.6

[查看全部候选手]
```

#### 局面点评 Panel

```txt
局面点评    AI 点评
黑棋下在 C8 是本局的关键手，左上定形基本完成。
此时局面相对均衡。建议继续巩固整体厚势，注意右下白棋的潜在反击。

[有帮助] [没帮助] [添加备注]
```

要求：

- 点评文字最多 3–4 行。
- `添加备注` 应能把当前点评转入左侧笔记。

#### 变化树 Panel

```txt
主变化                      胜率 52.3%
16 — 17 — 18(active) — 19 — 20 — 21

变化 1（白 Q16）             胜率 52.3%
变化 2（白 R16）             胜率 52.1%
[展开全部]
```

要求：

- 当前手 `18` 紫色高亮。
- 分支折叠显示。
- 不要把完整树铺满右栏。

#### 快照对比 Panel

```txt
快照对比
[当前 第18手]  VS  [快照1 第28手]     [对比视图]
[管理快照]
```

快照对比是复盘模式的重要特色，应保留。

### 7.6 复盘模式底部动作

右下角可保留：

```txt
[导出报告] [分享复盘]
```

这两个是复盘成果输出动作，适合放在页面底部，不应放顶部。

---

## 8. 训练模式处理建议

当前不需要实现训练模式完整页面。顶部可保留标签，但点击后可以：

1. 暂时进入占位页；或
2. 暂时隐藏标签；或
3. 保留但标记为“稍后实现”。

如果保留占位页，应该简单：

```txt
训练模式
从复盘中的错误招法自动生成题目。
当前版本暂未开放。
```

不要照之前那张训练模式图实现完整复杂页面。

---

## 9. 交互状态规范

### 9.1 模式切换

模式切换只通过顶部标签完成。

```ts
type AppMode = 'play' | 'recall' | 'review' | 'training'
```

切换时：

- 保持同一局棋上下文。
- 不要重置棋盘。
- 每个模式读取同一个 `gameTree / currentNode`，但有自己的 UI state。

### 9.2 对局模式状态

```ts
interface PlayModeState {
  isEngineAttached: boolean
  isEngineThinking: boolean
  autoAnalyze: boolean
  currentTurn: 'black' | 'white'
  lastMove?: MoveRef
}
```

### 9.3 回忆模式状态

```ts
interface RecallModeState {
  isRecalling: boolean
  totalMoves: number
  recalledMoves: number
  correctCount: number
  wrongCount: number
  skippedCount: number
  showCandidates: boolean
  candidatePoints: Point[]
  currentExpectedMoveIndex: number
}
```

### 9.4 复盘模式状态

```ts
interface AnalysisModeState {
  currentAnalysisMove: number
  filter: 'all' | 'key' | 'mistake' | 'note'
  selectedAnalysisNodeId?: string
  showBranches: boolean
  autoPlay: boolean
  snapshots: Snapshot[]
}
```

---

## 10. 推荐 React 组件结构

```txt
src/renderer/
  app/
    App.tsx
    Workbench.tsx
  features/
    modes/
      ModeBar.tsx
      ModeTab.tsx
    play/
      PlayMode.tsx
      PlayLeftPanel.tsx
      PlayRightPanel.tsx
      CurrentGameCard.tsx
      PositionControlCard.tsx
      EngineLogCard.tsx
    recall/
      RecallMode.tsx
      RecallLeftPanel.tsx
      RecallRightPanel.tsx
      RecallTaskCard.tsx
      RecallFeedbackCard.tsx
    analysis/
      AnalysisMode.tsx
      AnalysisLeftPanel.tsx
      AnalysisRightPanel.tsx
      AnalysisFlowCard.tsx
      AnalysisNoteCard.tsx
      AiAnalysisCard.tsx
      PositionCommentaryCard.tsx
      VariationTreeCard.tsx
      SnapshotCompareCard.tsx
    board/
      BoardStage.tsx
      GoBoard.tsx
      BoardFooter.tsx
      MoveMarker.tsx
      CandidateMarker.tsx
    shared/
      Panel.tsx
      Button.tsx
      Toggle.tsx
      ProgressBar.tsx
      Badge.tsx
      IconButton.tsx
  store/
    workspaceStore.ts
    documentStore.ts
    analysisStore.ts
    studyStore.ts
```

### 10.1 Workbench 伪代码

```tsx
export function Workbench() {
  const mode = useWorkspaceStore(s => s.mode)

  return (
    <div className="app-shell">
      <ModeBar mode={mode} />

      {mode === 'play' && <PlayMode />}
      {mode === 'recall' && <RecallMode />}
      {mode === 'analysis' && <AnalysisMode />}
      {mode === 'training' && <TrainingPlaceholder />}
    </div>
  )
}
```

### 10.2 模式页面统一布局

```tsx
function ModeLayout({ left, board, right, footerActions }) {
  return (
    <main className="mode-layout">
      <aside className="left-sidebar">{left}</aside>
      <section className="board-column">{board}</section>
      <aside className="right-sidebar">{right}</aside>
      {footerActions && <footer>{footerActions}</footer>}
    </main>
  )
}
```

---

## 11. CSS Layout 建议

```css
.app-shell {
  height: 100vh;
  display: grid;
  grid-template-rows: 64px 1fr;
  background: var(--bg-app);
  color: var(--text-primary);
}

.mode-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 24px;
  border-bottom: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(16px);
}

.mode-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mode-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mode-layout {
  min-height: 0;
  display: grid;
  grid-template-columns: 300px minmax(560px, 1fr) 300px;
  gap: 16px;
  padding: 14px 20px 18px;
}

.left-sidebar,
.right-sidebar {
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.board-column {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}

.panel {
  background: var(--bg-panel);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-panel);
  box-shadow: var(--shadow-panel);
}
```

响应式收缩：

```css
@media (max-width: 1180px) {
  .mode-layout {
    grid-template-columns: 260px minmax(480px, 1fr) 260px;
  }
}
```

---

## 12. 验收标准

### 12.1 全局验收

- [ ] 顶部没有“切换模式”。
- [ ] 顶部没有“退出本模式”。
- [ ] 顶部模式标签清晰可见。
- [ ] 当前模式高亮明确。
- [ ] 棋盘是页面最大视觉中心。
- [ ] 左右栏不抢棋盘注意力。
- [ ] 整体仍然像 Sabaki，而不是全新 SaaS 网站。
- [ ] 三种模式视觉语言一致。

### 12.2 对局模式验收

- [ ] `新对局`、`对局设置`、`认输` 在顶部清晰可见。
- [ ] 左侧有当前对局、局面控制、引擎日志。
- [ ] 右侧有分析、局面信息、变化树。
- [ ] 引擎日志不显得杂乱。
- [ ] 胜率条、最后落子信息清楚。

### 12.3 回忆模式验收

- [ ] 回忆模式是“全局回忆”，不是分段回忆。
- [ ] 没有阶段选择、范围选择等复杂控件。
- [ ] 左侧只显示任务摘要、进度、开始/校对/提示。
- [ ] 右侧只显示提示、结果反馈、轻量变化树。
- [ ] 棋盘上提示点克制，不喧宾夺主。

### 12.4 复盘模式验收

- [ ] 左侧复盘流程清晰。
- [ ] 关键点 / 失误 / 备注筛选清楚。
- [ ] 当前复盘节点有明显高亮。
- [ ] 中央棋盘有当前手高亮和时间轴控制。
- [ ] 右侧有 AI 分析、局面点评、变化树、快照对比。
- [ ] `导出报告`、`分享复盘` 放底部，不放顶部。

---

## 13. Agent 实施顺序建议

推荐分 4 步做，不要一次性全部重构。

### Step 1：只改全局外壳

目标：实现 ModeBar + ModeLayout。

- 删除“切换模式”“退出本模式”。
- 建立顶部模式标签。
- 建立三栏通用布局。
- 不动具体业务逻辑。

### Step 2：改对局模式

目标：把当前功能整理成现代卡片。

- 当前对局卡片。
- 局面控制卡片。
- 引擎日志卡片。
- 右侧分析 / 局面信息 / 变化树卡片。

### Step 3：改回忆模式

目标：做极简全局回忆。

- 左侧回忆任务卡片。
- 右侧回忆提示 + 结果反馈。
- 棋盘候选点和校对标记。

### Step 4：改复盘模式

目标：复刻当前概念图中较成熟的复盘工作台。

- 左侧复盘流程。
- 复盘笔记。
- 中央时间轴。
- 右侧 AI 分析、点评、变化树、快照对比。

---

## 14. 非目标 / 不要做的事

当前阶段不要做：

1. 不要大改棋盘视觉。
2. 不要做全新的复杂训练模式。
3. 不要把顶部塞满入口。
4. 不要把模式切换做成二级菜单。
5. 不要让右侧 AI 分析比棋盘更抢眼。
6. 不要在回忆模式里做复杂阶段任务系统。
7. 不要把复盘模式做成纯文本笔记软件。
8. 不要牺牲 Sabaki 原有桌面应用感。

---

## 15. 给 Coding Agent 的一句话任务描述

请在保留 Sabaki 原有三栏棋盘工作台气质的前提下，实现一个更现代、更有层级感的模式化 UI。顶部只保留模式标签，不要“切换模式”和“退出本模式”。对局模式突出“新对局 / 对局设置 / 认输”；回忆模式简化为全局棋谱回忆；复盘模式保留关键点列表、笔记、AI 分析、变化树和快照对比。整体要清爽、克制、棋盘优先。
