# Gabaki / Sabaki 工作台 UI/UX 与前端实现规格

> 目标：在现有 `ui-ux-spec-0.5` 的视觉骨架上，修正信息架构、模式定义、关键交互和验收标准，使 Workbench UI 严格对齐 `gabaki-sabaki-training-prd-v0.5.md` 与 `gabaki-sabaki-training-architecture-v0.5.md`。本文定义前端可实现、可截图验收的工作台规格，但不替代 PRD 或 Architecture 的产品与架构真源。

## 0. 真源与视觉参考关系

产品与架构判断的优先级如下：

1. 产品真源：`docs/design/gabaki-sabaki-training-prd-v0.5.md`
2. 架构真源：`docs/design/gabaki-sabaki-training-architecture-v0.5.md`
3. UI 基础稿：当前 `workbench-ui-ux-spec.md` / `ui-ux-spec-0.5`

`docs/design/workbench-ref-pics/` 已经过时，不能作为 UI/UX 产品真源。历史图片最多作为非约束视觉参考，用于保持浅色桌面应用、三栏工作台、棋盘居中、左右卡片面板和底部工具栏的整体气质。若历史图片与 PRD v0.5 或 Architecture v0.5 冲突，一律以 PRD v0.5 与 Architecture v0.5 为准。

核心原则：

1. Workbench 的产品模式固定为四个：Play / 对局、Problem / 做题、Recall / 回忆、Analysis / 复盘。
2. 棋盘始终是视觉中心，占据页面最大、最稳定的区域。
3. 顶部展示黑白状态、四段 mode segmented control、当前模式动作。
4. Workbench 左侧栏只展示当前 mode 的任务和局部操作；全局材料库不进入左侧栏。
5. 整体保持浅色、干净、桌面应用感，不做成 SaaS 大屏或营销页。
6. 四个模式共享布局和组件语言，通过主色、文案、卡片内容和底部工具差异区分。

## 1. 全局布局与尺寸

以 `1440 x 1000` 左右桌面窗口为基准，页面结构为：

```txt
┌──────────────────────────────────────────────────────────────┐
│ App Chrome: traffic lights | document title | quiet status    │
├──────────────────────────────────────────────────────────────┤
│ Top Toolbar: 黑白提子状态 | 四段模式标签 | 当前模式动作       │
├───────────────┬──────────────────────────────┬───────────────┤
│ Left Panels   │          Board Stage          │ Right Panels  │
│ 当前模式任务  │          木纹棋盘              │ 辅助/分析/反馈 │
├───────────────┴──────────────────────────────┴───────────────┤
│ Bottom Workspace Bar: 工作区状态 / 工具 / 模式局部操作         │
└──────────────────────────────────────────────────────────────┘
```

推荐尺寸：

- 页面背景：全屏极浅灰白，四周留白约 `16px`。
- App chrome / traffic lights 状态栏：高度 `32-40px`，承载窗口控制、标题和轻量状态。
- 顶部工具栏：高度 `72-84px`，白底，细边框，轻阴影。
- 左栏：`290-330px`，卡片纵向排列。
- 右栏：`290-330px`，卡片纵向排列。
- 中央棋盘区：占剩余主空间，棋盘尽量保持正方形。
- 底部工作区栏：高度 `64-76px`，白底，固定在底部。
- 主体区域间距：左右栏与棋盘之间约 `32-44px`，不要挤压棋盘。

### 1.1 棋盘稳定性约束

棋盘是本产品最核心的视觉锚点。以下约束优先级高于侧栏和工具栏需求：

- 切换模式时，棋盘中心点、棋盘尺寸、棋盘坐标位置不得发生明显跳动。
- 左右面板内容变化不能导致棋盘重新布局。
- 底部工具栏展开/收起不能挤压棋盘。
- 棋盘最小可用尺寸不低于 `560px`。
- 当窗口宽度不足时，优先折叠右栏，其次压缩左栏，最后才缩小棋盘。

### 1.2 窄窗口响应式规则

```txt
>= 1280px  三栏全展示
1000-1279  右栏折叠为抽屉，左栏收窄至 260px
< 1000px   左栏也折叠，棋盘居中占满，侧栏变为可唤出抽屉
```

### 1.3 App chrome 状态栏

traffic lights 所在的 app chrome 行可以承载低噪音的全局状态，但不能变成第二个工具栏。

推荐布局：

```txt
[traffic lights]  Gabaki Workbench · 当前 Task 标题       已保存 · 引擎空闲 · Attempt 进行中 · 同步正常
```

可放信息：

- 当前 Task / SGF / tab 的短标题，超长省略。
- 保存状态：`已保存`、`保存中...`、`保存失败`。
- 引擎状态：`未连接`、`连接中`、`引擎空闲`、`AI 思考中`。
- 当前事实状态：`Attempt 进行中`、`Attempt 已冻结`、`Recall 进行中`。
- 后台队列或同步状态：`分析待处理 3`、`同步正常`、`离线`。

限制：

- 不放 mode segmented control，不放 Submit / Snapshot / 认输等主操作。
- 不放全局材料库列表或 Review 队列。
- 状态文案使用 `11-12px`、低对比颜色，最多 4-5 个短状态 chip。
- 警告状态可以用小红点或短文案，但详细错误仍进入对应面板或 toast。
- 窄窗口下只保留标题和最高优先级状态，其余折叠到 tooltip / popover。

### 1.4 全局材料库入口

材料库是全局文件管理能力，不属于任何单个 Workbench mode。

- 应用菜单入口：`文件 > 材料库...`。
- 点击后打开独立 window / dialog，用于导入、搜索、管理、打开 `TrainingTask`。
- 材料库可包含野狐、本地 SGF、101 错题、本地题库、Review、手动创建等入口。
- 打开材料后统一进入 `TrainingTask`，由 Task 字段或显式参数决定进入 Play 或 Problem。
- Workbench 主界面的左侧栏不展示全局材料列表，只展示当前 mode 的任务、设置、进度和局部操作。

## 2. 顶部工具栏

顶部工具栏是四个模式共用的固定结构。

左侧黑白状态区：

```txt
● 黑棋
  提子 0

○ 白棋
  提子 0
```

要求：

- 黑白棋子使用圆形棋子质感，黑棋深色径向阴影，白棋浅灰立体阴影。
- 黑白状态之间用淡竖线分隔。
- 文案保持小字号、低噪音，不抢中央模式标签。

中间 mode segmented control：

```txt
[ 对局模式 ] [ 做题模式 ] [ 回忆模式 ] [ 复盘模式 ]
```

要求：

- 使用一个整体圆角分段容器，非激活项白底或透明底。
- 激活项使用模式主色实底：对局蓝、做题琥珀、回忆绿、复盘紫。
- 每项可带简洁图标，图标与文字同色。
- 不显示"切换模式""退出本模式""训练模式"。

右侧动作区按模式切换：

| 模式 | 顶部右侧动作 |
|------|--------------|
| Play / 对局 | `+ 新对局`、`对局设置`、`结束当前 attempt`、`认输` |
| Problem / 做题 | `提交答案`、`放弃作答`、`做题设置`、`进入复盘` |
| Recall / 回忆 | `进入复盘`、`结束回忆`、`Snapshot` |
| Analysis / 复盘 | `Snapshot / 派生新 Task`、`复盘设置`、`返回上一个模式` |

按钮要求：

- 主按钮高度约 `44px`。
- 普通按钮白底细边框。
- 当前模式主操作使用模式主色文字或主色实底。
- `认输` 使用红色描边和红色文字，带旗帜图标，仅用于 Play 中放弃当前对局并结束本次 attempt。
- `放弃作答` 不是提交答案，不执行 `passRule`，不创建默认 RecallSession。
- `Snapshot / 派生新 Task` 是全局命令，在任意模式都应有可发现入口；在 Analysis 中通常放在顶部右侧主操作位。

## 3. 中央棋盘舞台

棋盘舞台是每个模式的视觉核心。

棋盘要求：

- 使用浅木纹棋盘，带轻微厚度和阴影。
- 棋盘外框比网格略深，边缘有轻微立体感。
- 网格为细深灰线，星位为小黑点。
- 棋子使用立体阴影，不使用扁平纯色圆。
- 棋盘大小应明显大于任一侧栏卡片组合的单个视觉块。

Play / 对局棋盘：

- 默认不叠加题面、答案、编号或复杂分析标记。
- 可显示普通落子、AI 自动应手、提子和当前手高亮。
- AI overlay 默认隐藏，只在用户主动开启分析视图时显示。

Problem / 做题棋盘：

- 展示题目初始局面、用户答案变化和对方应手。
- 当对方由 AI 控制时，必须能表达题目范围 / problemArea / analysis area 的状态。
- 没有题目范围时，不显示 AI 自动应手候选点；棋盘或侧栏提示用户设置题目范围或改为自己控制。
- 提交前不直接暴露完整 `referenceLines` 答案。

Recall / 回忆棋盘：

- 默认用于逐手复现 frozen `Attempt.userLine`。
- 开启"先复现原线"时，显示用户已正确复现的落子编号；当前需要输入的答案不直接显示。
- 关闭"先复现原线"时，棋盘围绕 checkpoint 当前局面，支持用户摆 correction line。
- 错误、提示和 AI candidates 以侧栏为主，棋盘标记保持克制。

Analysis / 复盘棋盘：

- 用于自由复盘、AI 对比、分支探索和 Snapshot。
- 默认不写回当前 Attempt。
- 可显示候选点、分支、标注工具和对比图，但不能让标记噪音压过棋盘本身。

## 4. 左右面板通用规范

所有侧栏内容使用白色卡片式 Panel：

- 背景：白色或接近白色。
- 边框：`1px` 极浅灰。
- 圆角：`14-16px`。
- 阴影：轻、柔，不使用重投影。
- 内边距：`18-22px`。
- 卡片间距：`14-16px`。
- 标题字号约 `14px`，正文约 `12-13px`。

面板内容密度：

- 左栏卡片承载当前模式任务、局部设置和主流程操作。
- 右栏卡片承载辅助信息、分析空态、提示、反馈和变化树。
- 不要把日志、全局材料列表、长队列或复杂树结构铺满侧栏。
- 图示空态可使用淡色插图或简洁线形图标，但必须低对比。

### 4.1 右栏卡片展开规则

右栏多处出现"展开"按钮（AI 分析、变化树、快照对比），统一行为：

- 默认展开不改变棋盘尺寸和三栏布局。
- 点击"展开"后，打开右侧抽屉覆盖层。
- 抽屉宽度 `420-520px`，从右侧滑出，覆盖在工作台上方。
- 抽屉不触发三栏重新布局。
- `Esc` 或点击关闭按钮收起抽屉。
- 抽屉内容可展示更详细的分析数据、完整变化树、AI candidates 或快照对比视图。

## 5. Play / 对局模式规格

主色：蓝色 `#2563ff` 或接近当前 UI 基础稿的高亮蓝。

顶部：

```txt
[ 对局模式(active) ] [ 做题模式 ] [ 回忆模式 ] [ 复盘模式 ]    [ + 新对局 ] [ 对局设置 ] [ 结束当前 attempt ] [ 认输 ]
```

左栏卡片顺序：

1. 当前模式
2. 黑白控制
3. 当前任务

当前模式卡片内容：

```txt
当前模式

对局模式
普通对局、续弈或实战模拟

当前行棋
● 黑棋
您执黑先行

对局状态
● 准备开始
第 0 手
```

黑白控制卡片内容：

```txt
黑白控制

黑方    [ 自己 ] [ AI ]
白方    [ 自己 ] [ AI ]

AI 自动落子    [开关]
引擎 / 用时 / visits 摘要
```

当前任务卡片内容：

```txt
当前任务

开始对局
可在下方操作开始新的对局，或调整设置后开始。

局部操作
[ 标记疑问手 ]
[ 进入复盘 ]
```

右栏卡片顺序：

1. 局面信息
2. AI 分析
3. 变化树

局面信息卡片：

```txt
局面信息

手数        0
提子        黑 0 / 白 0
pending 评价 0
坏棋记录    0
```

AI 分析卡片为空态：

```txt
AI 分析

暂无分析数据
连接引擎后可查看胜率、目数和候选点等分析结果。
```

变化树卡片为空态：

```txt
变化树

暂无变化
在对局过程中将自动记录变化。
```

底部工作区栏：

```txt
对局工作区 | 当前第 0 手 | 未连接引擎
[悔棋] [Pass] [认输] [结束当前 attempt] [标记疑问手]        [选择] [手型] [-] [+] [全屏]
```

### 5.1 Play 运行状态

| 状态 | 顶部右侧 | 左栏状态 | 底部栏 | 棋盘 |
|------|---------|---------|--------|------|
| 未开始 | `+ 新对局` `对局设置` | `● 准备开始` `第 0 手` | `当前第 0 手 / 未连接引擎` | 空棋盘 |
| 对局中 | `结束当前 attempt` `认输` 可用 | `● 对局中` `第 N 手` | `当前第 N 手 / 引擎思考中...` | 正常落子 |
| AI 自动应手 | 同对局中 | 当前轮次标识为 AI | `AI 应手中` | AI 落子后继续 |
| 引擎连接中 | 同未开始 | `● 正在连接引擎...` | `正在连接...` | 空棋盘，可落子 |
| 引擎已连接 | 同对局中 | `● 引擎已连接` | `引擎已连接 / 等待落子` | 正常 |
| 引擎报错 | 同未开始 | `● 引擎连接失败` 红色提示 | `引擎连接失败` | 正常，左栏显示重试按钮 |
| 已终局 | `+ 新对局` 重新可用 | `● 已终局` | `对局已结束，准备进入回忆` | 终局状态 |

### 5.2 Attempt freeze 时机

Play 过程中普通落子、AI 自动应手、后台分析更新、MoveEvaluation 更新和 BadMove 记录都不能 freeze Attempt。

Play Attempt 只在以下情况冻结：

1. 用户认输。
2. 对局自然结束。
3. 用户显式点击 `结束当前 attempt` / `Submit`。

冻结后默认创建 RecallSession，并进入 Recall / 回忆模式。若用户只是进入 Analysis 做临时研究，当前 Attempt 保持可继续状态，Analysis 中的自由摆棋不写回 `Attempt.userLine`。

## 6. Problem / 做题模式规格

主色：琥珀色 `#d97706` 或与设计系统一致的做题强调色。

顶部：

```txt
[ 对局模式 ] [ 做题模式(active) ] [ 回忆模式 ] [ 复盘模式 ]    [ 提交答案 ] [ 放弃作答 ] [ 做题设置 ] [ 进入复盘 ]
```

左栏卡片顺序：

1. 当前模式
2. 题面与目标
3. 对方控制
4. 作答操作

当前模式卡片内容：

```txt
当前模式

做题模式
阅读题面，完成有目标和提交标准的作答
```

题面与目标卡片内容：

```txt
题面
黑先，找出局部最佳应对。

目标
活棋 / 杀棋 / 建立优势 / 达到 passRule

通过标准
passRule 摘要：连续 N 手内达到目标，或胜率/目数不低于阈值。

参考变化
已收录 3 条参考线
提交前仅显示摘要，不展开完整答案。
```

要求：

- `prompt` 必须可见，文案简洁，不做长篇教学页。
- `goal` 必须可见，目标应比题面更醒目。
- `passRule` 显示摘要，不展示实现细节。
- `referenceLines` 显示数量、标签、长度、来源等摘要；提交前不能直接暴露完整答案。
- 可提供 hint card，但默认只给方向性提示，不直接显示 AI 答案或完整参考线。

对方控制卡片内容：

```txt
对方控制

[ 自己 ] [ AI ]

题目范围
problemArea / analysis area：已设置

AI 应手
仅在题目范围内自动应手
```

对方控制规则：

- `自己`：用户手动摆双方变化，适合完整阅读题和自我推演。
- `AI`：用户落子后，AI 在题目范围内自动应手。
- 当对方为 AI 时，必须显示题目范围 / problemArea / analysis area 状态。
- 没有题目范围时，禁用 AI 应手，并显示提示：`未设置题目范围，无法启用 AI 应手。请设置题目范围，或改为自己控制。`
- 若引擎候选全部超出题目范围，系统不得自动落子，应提示用户调整题目范围或关闭 AI 应手。

作答操作卡片内容：

```txt
作答

当前手数      0
答案状态      作答中

[ 提交答案 ]
[ 放弃作答 ]
[ 请求提示 ]
```

右栏卡片顺序：

1. 答案草稿
2. Hint
3. AI 分析
4. 参考变化摘要

答案草稿卡片：

```txt
答案草稿

当前变化 0 手
对方：自己控制 / AI 应手
```

Hint 卡片：

```txt
Hint

暂无提示
请求提示后显示方向性信息，不直接显示完整答案。
```

AI 分析卡片：

```txt
AI 分析

后台分析可运行，但 AI 答案默认隐藏。
对方为 AI 时，只展示题目范围内的应手状态。
```

参考变化摘要卡片：

```txt
参考变化摘要

3 条参考线
最长 8 手
标签：活棋、正解、失败线

提交后可在 Recall / Analysis 中展开对比。
```

底部工作区栏：

```txt
做题工作区 | 当前第 0 手 | 对方：自己 / AI | 题目范围：已设置
[悔棋] [重做] [Pass] [请求提示] [提交答案] [放弃作答]        [选择] [手型] [-] [+] [全屏]
```

### 6.1 Problem 提交与放弃语义

- `提交答案`：冻结当前 Attempt，执行 `passRule` / Attempt 评价，创建 RecallSession，并默认进入 Recall / 回忆模式。
- `放弃作答`：确认后把本次 Attempt 标记为 `abandoned`，不执行 `passRule`，不创建默认 RecallSession，不把当前答案当成已提交训练结果。
- 放弃后可回到题目初始局面重新开始，或进入 Analysis 自由研究；这两个动作都应创建清晰的新上下文，不继续污染被放弃的 Attempt。

### 6.2 Problem 运行状态

| 状态 | 左栏 | 右栏 | 底部栏 | 棋盘 |
|------|------|------|--------|------|
| 默认空态 | 显示题面、目标、passRule 摘要 | 参考变化仅摘要 | `当前第 0 手` | 题目初始局面 |
| 作答中 | 当前手数更新 | 答案草稿更新 | 悔棋/重做可用 | 用户摆答案 |
| 对方自己控制 | 对方控制为 `自己` | 无 AI 应手状态 | 正常 | 用户控制双方 |
| 对方 AI 且有范围 | 显示范围已设置 | AI 应手状态可见 | `AI 应手中` | AI 只在范围内落子 |
| 对方 AI 但无范围 | AI 选项 disabled | 显示设置范围提示 | 禁用 AI 应手 | 不自动落子 |
| 提交后 | Attempt 已冻结 | 摘要可进入回忆 | `准备进入回忆` | 最终答案线 |
| 放弃后 | Attempt abandoned | 不展示结果评价 | `作答已放弃` | 可重开或复盘 |

## 7. Recall / 回忆模式规格

主色：绿色 `#169b55` 或接近当前 UI 基础稿的高亮绿。

顶部：

```txt
[ 对局模式 ] [ 做题模式 ] [ 回忆模式(active) ] [ 复盘模式 ]    [ 进入复盘 ] [ 结束回忆 ] [ Snapshot ]
```

Recall 有两种使用方式：

1. 默认：先复现原线。用户逐手复现 frozen `Attempt.userLine`。
2. 可选：关闭"先复现原线"。用户不必先浮现完整 attempt userLine，可以直接进入坏棋 / checkpoint 纠错流程，并选择是否 reveal AI candidates。

### 7.1 默认：先复现原线

左栏核心任务卡片：

```txt
当前模式

回忆模式
先复现原线                         [开关：开]

回忆 frozen Attempt.userLine

      50%

进度      4 / 6
正确      3 手
状态      进行中

上一手需要复盘

[ 标记 checkpoint ] [ 校对 / 跳过 ] [ 提示 ] [ 结束回忆 ]
```

要求：

- `先复现原线` 开关放在左栏核心任务卡片标题区域或模式说明下方，默认开启。
- 环形进度图为主要视觉元素，绿色进度。
- 用户输入下一手后，系统校对是否匹配 frozen `Attempt.userLine` 的下一手。
- 默认不显示 AI 候选，也不显示完整参考答案。
- `提示` 只能逐步给出方向性信息；显示明确答案必须由用户主动请求，且有状态记录。
- 命中 major / severe BadMove 时触发 checkpoint，引导用户先自己修正。
- `标记 checkpoint` 可在当前 recall 局面创建手动 checkpoint。

右栏卡片顺序：

1. 回忆提示
2. Checkpoint 摘要
3. 结果反馈
4. 轻量变化树

回忆提示卡片：

```txt
回忆提示

下一手：保持回忆
需要时从左侧打开提示。

尚未 reveal AI candidates。
```

Checkpoint 摘要卡片：

```txt
Checkpoint

系统触发      1
手动标记      0
当前状态      未进入 checkpoint
```

结果反馈卡片：

```txt
结果反馈

正确      3
错误      1

总进度    4 / 6
[progress]
```

底部工作区栏：

```txt
回忆工作区 | 当前进度 4 / 6 | 等待输入下一手
[标记 checkpoint] [提示] [校对/跳过] [进入复盘]        [选择] [手型] [-] [+] [全屏]
```

### 7.2 关闭：直接 checkpoint 纠错

关闭 `先复现原线` 后，左栏核心任务卡片切换为 checkpoint 队列：

```txt
当前模式

回忆模式
先复现原线                         [开关：关]

Checkpoint 队列
1. 第 23 手  系统：severe bad move
2. 第 41 手  用户手动标记

当前 checkpoint
第 23 手，先自己摆修正图

[ 提交修正图 ] [ 查看 AI ] [ 跳过 checkpoint ]
```

要求：

- 用户直接进入 checkpoint 当前局面，不要求先完整复现 attempt userLine。
- 当前 checkpoint 必须显示来源、moveNumber、局面摘要和状态。
- 用户先摆 correction line，再提交修正图。
- `查看 AI` 默认不高亮，用户未提交修正图前应弱化或二次确认。
- Reveal AI candidates 后，右栏显示用户原线、用户修正线、AI candidates 的对比。
- 不在默认状态直接暴露 AI 答案。

### 7.3 Checkpoint 来源与手动标记

Checkpoint 来源分为两类：

1. 系统根据 major / severe BadMove 自动触发。
2. 用户在 Recall UI 中点击 `标记 checkpoint` 手动创建。

手动 checkpoint 可以没有 `badMoveId`，但必须绑定：

- 当前 `recallSessionId`
- 当前 `moveNumber`
- 当前 recall 局面或 position snapshot
- 可选用户备注

手动 checkpoint 创建后进入 checkpoint 队列，可立即纠错，也可稍后处理。它不能伪装成系统 bad move，也不能要求必须存在 AI 评价。

### 7.4 Recall 运行状态

| 状态 | 左栏核心区域 | 右栏 | 底部栏 | 棋盘 |
|------|------------|------|--------|------|
| 等待输入 | 进度正常，无错误提示 | 提示卡片隐藏结论 | `等待输入下一手` | 正常显示已有棋子 |
| 输入正确 | `上一手：正确` 绿色 | 无变化 | `正确，继续下一手` | 落子动画后显示编号 |
| 输入错误 | `上一手需要复盘` 红色 | 提示卡片不直接 reveal AI | `输入错误，可校对或跳过` | 错误位置克制标记 |
| 系统 checkpoint | 进入 checkpoint 子状态 | 显示 badMove 来源 | `先自己摆修正图` | 定位问题局面 |
| 手动 checkpoint | 创建队列项 | 显示用户标记来源 | `checkpoint 已标记` | 绑定当前局面 |
| 查看 AI | 需要用户主动触发 | 显示 candidates 对比 | `AI candidates 已显示` | 可显示候选点 |
| 回忆完成 | `回忆完成` 绿色 | 结果反馈显示总结 | `可进入复盘` | 完整棋局 |

## 8. Analysis / 复盘模式规格

主色：紫色 `#7c3aed` 或接近当前 UI 基础稿的高亮紫。

顶部：

```txt
[ 对局模式 ] [ 做题模式 ] [ 回忆模式 ] [ 复盘模式(active) ]    [ Snapshot / 派生新 Task ] [ 复盘设置 ] [ 返回上一个模式 ]
```

Analysis 是自由复盘、AI 对比和分支探索空间。它可以围绕 Task、Attempt、BadMove、Recall comment、Checkpoint 或当前局面展开，但默认不修改当前 `Attempt.userLine`。

左栏卡片顺序：

1. 当前模式
2. 复盘上下文
3. 关键点筛选
4. 复盘笔记
5. Snapshot / 派生新 Task

当前模式区：

```txt
当前模式

复盘模式
自由研究、比较变化、沉淀笔记
```

复盘上下文卡片：

```txt
复盘上下文

来源      Attempt / Checkpoint / Snapshot / 当前局面
当前手数  0
关联评论  0
```

关键点筛选卡片：

```txt
关键点筛选

[ 全部 ] [ 坏棋 ] [ checkpoint ] [ 备注 ]
使用右侧变化树和局面点评辅助筛选。
```

复盘笔记卡片：

```txt
复盘笔记
[编辑图标]

记录这一手的想法、对局思路与改进方向。
```

Snapshot 卡片：

```txt
Snapshot

捕获当前局面，派生为新的 TrainingTask。
新 Task 根据 prompt / goal / passRule / referenceLines 默认进入 Problem，否则进入 Play。

[ Snapshot / 派生新 Task ]
```

右栏卡片顺序：

1. AI 分析
2. 局面点评
3. 变化树
4. 原线 / 修正图 / AI 图对比
5. 快照对比

AI 分析卡片为空态：

```txt
AI 分析                         展开

暂无分析数据
选择关键局面后，AI 将在此提供形势判断、推荐手段与变化建议。
```

局面点评卡片：

```txt
局面点评

手数        0
提子        黑 0 / 白 0
综合评价    --
```

变化树卡片：

```txt
变化树                         展开

暂无变化
自由摆棋或进入分支后将记录变化。
```

对比卡片：

```txt
对比

用户原线      --
用户修正      --
AI candidates --
```

快照对比卡片：

```txt
快照对比                       展开

捕捉参考局面后可进行快照对比。
[ 添加快照 ]
```

底部工作区栏：

```txt
复盘工作区 | 当前第 0 手 | 关键点 0 · Snapshot 0

标注工具 [黑白] [X] [△] [□] [○] [线] [箭头] [A] [1]

[撤销] [重做 disabled] [清空] [Edit position] [Snapshot] [100%]
```

要求：

- 标注工具条居中，白色浮层按钮组。
- 当前选中工具有浅灰/浅紫背景。
- 撤销、重做、清空、缩放放右侧。
- Snapshot 创建的是普通 `TrainingTask`，不是独立 Problem 实体。
- Analysis 中自由摆棋默认使用 scratch / exploration 上下文，不污染 Attempt。

### 8.1 Analysis 运行状态

| 状态 | 左栏 | 右栏 | 底部栏 |
|------|------|------|--------|
| 未选择关键局面 | 仅显示上下文 | 全部空态 | 标注工具禁用 |
| 已选择关键局面 | 关键点筛选更新 | 局面点评更新手数和提子 | 标注工具激活 |
| AI 分析中 | 无变化 | AI 分析卡片显示 loading | 无变化 |
| 已生成点评 | 无变化 | 局面点评显示综合评价 | 无变化 |
| 已添加快照 | Snapshot 计数更新 | 快照对比显示缩略图 | Snapshot 计数增加 |
| 已派生新 Task | Snapshot 卡片显示新 Task 链接 | 无变化 | `Snapshot 已创建` |

## 9. 模式切换规则

模式之间存在自然流程，同时也支持用户手动切换。

### 9.1 默认流程

```txt
Play / 对局
  → 用户认输 / 对局结束 / 显式结束当前 attempt
  → freeze Attempt
  → Recall / 回忆

Problem / 做题
  → 提交答案
  → freeze Attempt
  → Recall / 回忆

Recall / 回忆
  → 完成回忆或 checkpoint 纠错
  → 可进入 Analysis / 复盘，但不强制

任意模式
  → Snapshot
  → 创建普通 TrainingTask
  → 根据 Task 字段进入 Play 或 Problem
```

### 9.2 手动切换规则

- 点击顶部模式标签只切换工作视图，不销毁当前棋谱状态。
- 每个模式保留自己的内部状态，切换回来时恢复到离开时的状态。
- 进入 Recall 需要存在 frozen Attempt；没有时应 disabled 或引导用户先完成 Play / Problem attempt。
- Problem-like Task 默认以 Problem 打开；无题面任务默认以 Play 打开。
- Analysis 可从 Play / Problem / Recall 临时进入，返回时应恢复上一个模式上下文。
- 如果当前有未保存棋局，切换模式前先自动保存；保存失败才弹确认提示。
- 在 Recall / Analysis 下点击 `+ 新对局` 等同于创建新的 Play Task，会弹出确认。

### 9.3 模式切换视觉行为

- 切换模式时，仅左右栏内容、主色、底部工具和顶部右侧动作变化。
- 棋盘保持不动，无跳动、无缩放、无重新布局。
- 顶部工具栏结构不变，仅右侧动作按钮和模式标签高亮切换。
- 底部工具栏结构不变，仅文案和模式相关工具切换。

## 10. 底部工作区栏

底部栏四个模式共用白色浮层风格。

通用要求：

- 固定在页面底部，左右留白与顶部工具栏一致。
- 高度约 `64-76px`。
- 白底、细边框、轻阴影、圆角。
- 左侧显示当前工作区和状态。
- 中部显示当前模式的局部棋盘操作。
- 右侧显示选择、拖拽、缩放、全屏等视图控制。

Play / 对局底部：

```txt
对局工作区 | 当前第 N 手 | 引擎状态
[悔棋] [Pass] [认输] [结束当前 attempt] [标记疑问手]        [选择] [手型] [-] [+] [全屏]
```

Problem / 做题底部：

```txt
做题工作区 | 当前第 N 手 | 对方：自己 / AI | 题目范围：已设置
[悔棋] [重做] [Pass] [请求提示] [提交答案] [放弃作答]        [选择] [手型] [-] [+] [全屏]
```

Recall / 回忆底部：

```txt
回忆工作区 | 当前进度 N / M | 等待输入下一手 / checkpoint
[标记 checkpoint] [提示] [校对/跳过] [进入复盘]              [选择] [手型] [-] [+] [全屏]
```

Analysis / 复盘底部：

```txt
复盘工作区 | 当前第 N 手 | 关键点 X · Snapshot Y
标注工具组 + Edit position + Snapshot + 撤销/重做/清空 + 缩放
```

### 10.1 底部栏动作边界

底部栏可以放模式局部操作，但必须满足：

- 所有会结束 attempt、提交答案、认输、放弃作答的动作必须有明确文案和确认策略。
- 底部动作与顶部主动作语义一致，不能出现两个不同含义的 Submit。
- Snapshot 在底部出现时必须走与顶部同一条 command path。
- 底部不放全局材料库、全局 Review 队列或跨任务管理入口。

## 11. 状态覆盖要求

每个模式至少实现以下状态变体，确保不只是静态截图：

1. **默认空态**：首屏无数据或初始任务状态。
2. **进行中状态**：对局第 N 手、做题作答中、回忆进度 N/M、复盘选中关键局面。
3. **成功反馈状态**：Attempt 已冻结、做题提交成功、回忆正确、Snapshot 已创建。
4. **错误/警告状态**：引擎连接失败、Problem 缺少题目范围、回忆输入错误、保存失败。
5. **Loading 状态**：引擎思考中、AI 分析中、保存中、AI 应手中。
6. **Disabled 状态**：未连接引擎时的分析按钮、Problem 无 problemArea 时的 AI 应手、未选择局面时的标注工具、无 frozen Attempt 时的 Recall 入口。

## 12. 组件结构与命名

建议的组件拆分层次，避免写成巨型组件：

```txt
WorkbenchShell
  AppMenuBridge
    MaterialLibraryCommand     ← 文件 > 材料库...
  AppChrome
    TrafficLights
    DocumentTitle
    QuietStatusChips           ← 保存 / 引擎 / Attempt / 同步状态
  TopToolbar
    StoneStatus
    ModeSegmentedControl       ← Play / Problem / Recall / Analysis
    ModeActions
  WorkbenchMain
    LeftSidebar
      ModePanel                ← "当前模式" 卡片
      PlayTaskPanel
      ProblemTaskPanel
      RecallTaskPanel
      AnalysisTaskPanel
    BoardStage                 ← 棋盘容器，四模式共享
    RightSidebar
      AnalysisPanel            ← AI 分析（含展开抽屉）
      CommentaryPanel          ← 局面点评
      VariationTreePanel       ← 变化树（含展开抽屉）
      CheckpointPanel          ← Recall checkpoint 状态
      SnapshotPanel            ← 快照对比（含展开抽屉）

BottomWorkspaceBar
  StatusBar                    ← 左侧状态文案
  ModeCommandGroup             ← 模式局部操作
  ToolGroup                    ← 棋盘工具和标注工具
  ZoomControls                 ← 缩放和全屏

MaterialLibraryDialog          ← 独立 window / dialog

共享组件:
  EmptyStatePanel              ← 空态卡片
  ProgressRing                 ← 环形进度
  ModeToggle                   ← 先复现原线等开关
  OpponentControl              ← Problem 对方：自己 / AI
  ProblemAreaStatus            ← problemArea / analysis area 状态
  ReferenceLineSummary         ← 提交前摘要
  CheckpointQueue              ← 系统 + 手动 checkpoint
  AnnotationToolbar            ← 标注工具栏
  RightDrawer                  ← 右侧抽屉覆盖层
```

## 13. 视觉 Token / CSS 建议

```css
:root {
  --bg-app: #f7f8fa;
  --bg-toolbar: rgba(255, 255, 255, 0.94);
  --bg-panel: #ffffff;
  --bg-panel-soft: #fafafa;

  --border-subtle: rgba(15, 23, 42, 0.08);
  --border-strong: rgba(15, 23, 42, 0.14);

  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --text-tertiary: #9ca3af;

  --accent-play: #2563ff;
  --accent-play-soft: #eef4ff;
  --accent-problem: #d97706;
  --accent-problem-soft: #fff7ed;
  --accent-recall: #169b55;
  --accent-recall-soft: #eaf8f0;
  --accent-analysis: #7c3aed;
  --accent-analysis-soft: #f2edff;
  --danger-red: #dc3b31;
  --danger-red-soft: #fff0ef;

  --radius-shell: 16px;
  --radius-panel: 16px;
  --radius-card: 12px;
  --radius-button: 10px;

  --shadow-shell: 0 10px 30px rgba(15, 23, 42, 0.08);
  --shadow-panel: 0 1px 2px rgba(15, 23, 42, 0.04), 0 10px 24px rgba(15, 23, 42, 0.04);
  --shadow-board: 0 12px 28px rgba(15, 23, 42, 0.18);
}
```

布局建议：

```css
.workbench-shell {
  height: 100vh;
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  gap: 14px;
  padding: 28px 16px 16px;
  background: var(--bg-app);
  color: var(--text-primary);
}

.app-chrome {
  min-height: 32px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  color: var(--text-tertiary);
  font-size: 12px;
}

.app-chrome-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-secondary);
}

.app-chrome-status {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.top-toolbar,
.bottom-workspace-bar {
  background: var(--bg-toolbar);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-shell);
  box-shadow: var(--shadow-panel);
}

.workbench-main {
  min-height: 0;
  display: grid;
  grid-template-columns: 300px minmax(560px, 1fr) 300px;
  gap: 40px;
  align-items: center;
}

.left-sidebar,
.right-sidebar {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.panel {
  background: var(--bg-panel);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-panel);
  box-shadow: var(--shadow-panel);
}

/* 右侧抽屉覆盖层 */
.right-drawer {
  position: fixed;
  top: 0;
  right: 0;
  width: 480px;
  height: 100vh;
  background: var(--bg-panel);
  border-left: 1px solid var(--border-subtle);
  box-shadow: -4px 0 24px rgba(15, 23, 42, 0.1);
  z-index: 100;
  transform: translateX(0);
  transition: transform 200ms ease;
}
```

## 14. 验收标准

### 14.1 视觉验收 checklist

全局验收：

- [ ] 四个模式首屏分别有明确差异，而不是旧版 Sabaki 默认布局。
- [ ] traffic lights / app chrome 行展示标题和轻量状态，不抢顶部工具栏职责。
- [ ] 顶部工具栏包含黑白状态、四段 mode segmented control、右侧动作按钮。
- [ ] 顶部没有"切换模式""退出本模式""训练模式"。
- [ ] 棋盘是页面最大视觉中心，左右栏没有压缩棋盘。
- [ ] 左右面板为白色圆角卡片，边框和阴影克制。
- [ ] 底部工作区栏存在，并按四个模式展示状态和工具。
- [ ] `文件 > 材料库...` 打开独立材料库 window / dialog。
- [ ] Workbench 左侧栏只显示当前 mode 相关内容，不显示全局材料列表。

Play / 对局验收：

- [ ] `对局模式` 标签为蓝色激活态。
- [ ] 左栏显示当前模式、当前行棋、对局状态、黑白控制和当前任务。
- [ ] 黑方、白方均可选择自己 / AI。
- [ ] 普通落子、AI 自动应手、后台分析更新不会冻结 Attempt。
- [ ] 用户认输、对局结束、显式结束当前 attempt 后才冻结，并默认进入 Recall。
- [ ] 右栏显示局面信息、AI 分析空态、变化树空态。
- [ ] 底部显示对局工作区、当前手数、引擎状态和局部操作。

Problem / 做题验收：

- [ ] `做题模式` 标签为琥珀色激活态。
- [ ] 左栏独立显示题面 prompt、目标 goal、passRule 摘要和 referenceLines 摘要。
- [ ] 提交前不直接暴露完整 referenceLines 或 AI 答案。
- [ ] 对方控制可在自己 / AI 间切换。
- [ ] 对方为 AI 时显示题目范围 / problemArea / analysis area 状态。
- [ ] 没有题目范围时禁用 AI 应手，并提示设置题目范围或改为自己控制。
- [ ] 提交答案后冻结 Attempt，并默认进入 Recall。
- [ ] 放弃作答标记 Attempt 为 abandoned，不执行 passRule，不创建默认 RecallSession。
- [ ] 底部显示做题工作区、对方控制状态、题目范围状态和局部操作。

Recall / 回忆验收：

- [ ] `回忆模式` 标签为绿色激活态。
- [ ] 左栏有 `先复现原线` 开关，默认开启。
- [ ] 开启时显示回忆进度、输入状态、提示、校对和 frozen Attempt.userLine 复现流程。
- [ ] 关闭时显示 checkpoint 队列、当前 checkpoint、用户修正和 `查看 AI` 操作。
- [ ] 默认状态不直接暴露 AI candidates 或完整答案。
- [ ] `标记 checkpoint` 可创建手动 checkpoint，并绑定当前局面 / moveNumber / position snapshot。
- [ ] 系统 major / severe BadMove 与用户手动标记的 checkpoint 来源可区分。
- [ ] 底部显示回忆工作区、当前进度或 checkpoint 状态。

Analysis / 复盘验收：

- [ ] `复盘模式` 标签为紫色激活态。
- [ ] 左栏显示复盘上下文、关键点筛选、复盘笔记和 Snapshot / 派生新 Task。
- [ ] 右栏显示 AI 分析、局面点评、变化树、对比和快照对比。
- [ ] Snapshot 创建普通 TrainingTask，并根据 Task 字段进入 Play 或 Problem。
- [ ] 自由摆棋不修改当前 Attempt.userLine。
- [ ] 底部中央显示标注工具条、Edit position、Snapshot 和缩放工具。

### 14.2 交互验收 checklist

模式切换：

- [ ] 点击顶部四段模式标签切换视图，棋盘不跳动。
- [ ] 切换模式后左右栏内容正确更新，主色切换。
- [ ] 切换回来时恢复之前的模式内部状态。
- [ ] 无 frozen Attempt 时 Recall 入口 disabled 或给出明确引导。
- [ ] Problem-like Task 默认进入 Problem；无题面 Task 默认进入 Play。

棋盘稳定性：

- [ ] 左右面板内容变化不导致棋盘重新布局。
- [ ] 底部工具栏展开/收起不挤压棋盘。
- [ ] 右栏"展开"打开抽屉覆盖层，不改变三栏布局。

状态覆盖：

- [ ] 每个模式至少覆盖：空态、进行中、成功、错误、loading、disabled。
- [ ] Problem 的 no problemArea + AI opponent disabled 状态有独立 story。
- [ ] Recall 的 `先复现原线` 开 / 关各有独立 story。
- [ ] Analysis 的 Snapshot / 派生新 Task 成功状态有独立 story。

### 14.3 截图 / Storybook 验收

- 为四个模式分别创建固定 route 或 Storybook story。
- 使用相同 mock data 渲染 Play、Problem、Recall、Analysis。
- 在 `1440x1000` 下截图。
- 与 UI 基础稿和历史参考图片进行人工视觉对比；对比只检查浅色桌面应用、三栏布局、棋盘居中和卡片密度，不反推产品逻辑。
- 重点检查：
  1. 棋盘是否最大且居中稳定。
  2. 左右栏是否低噪音。
  3. 顶部四段模式标签是否清晰。
  4. Problem 是否是独立模式，而不是藏在 Play 或 Analysis 内。
  5. Recall 默认是否先复现原线，且未直接暴露 AI 答案。
  6. Analysis 是否用 Snapshot / 派生新 Task 表达材料沉淀。
  7. 四个模式是否只是主色和内容变化，而不是四套完全不同 UI。

## 15. 非目标

当前复现阶段不要做：

1. 不要大改棋盘木纹、网格和棋子质感之外的核心棋盘行为。
2. 不要实现完整训练管理页面。
3. 不要加入复杂引擎日志作为默认左栏模块。
4. 不要把全局材料库塞进 Workbench 侧栏。
5. 不要把 Problem 做成独立实体系统；Problem-like 字段仍属于普通 `TrainingTask`。
6. 不要在 Recall 默认状态直接展示 AI candidates 或完整答案。
7. 不要把 Analysis 做成纯长列表笔记工具。
8. 不要让 AI 分析、变化树或快照对比比棋盘更抢眼。
9. 不要把历史参考图片当成产品真源。

## 16. 给 Coding Agent 的一句话任务描述

请基于 PRD v0.5 与 Architecture v0.5，实现一个浅色、现代、克制的 Sabaki 四模式三栏工作台：traffic lights 所在 app chrome 行展示当前标题、保存、引擎、Attempt / Recall 等轻量状态；顶部工具栏为黑白状态、Play / Problem / Recall / Analysis 四段 mode segmented control 和当前模式动作；中央木纹棋盘始终最大且切换模式时不跳动；左侧只展示当前 mode 的任务和局部操作；材料库从 `文件 > 材料库...` 打开独立 window / dialog；右侧展示辅助信息、分析空态、checkpoint、对比和快照；底部展示各模式工作区状态与局部工具。Play 用蓝色，Problem 用琥珀色，Recall 用绿色，Analysis 用紫色。Play 只在认输、终局或显式结束 attempt 后 freeze；Problem 提交答案后 freeze 并进入 Recall；Recall 默认先复现 frozen Attempt.userLine，并支持关闭该开关直接处理 checkpoint；Analysis 使用 Snapshot / 派生新 Task 沉淀材料，且自由摆棋不污染 Attempt。
