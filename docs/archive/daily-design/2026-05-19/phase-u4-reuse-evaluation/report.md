# Phase U4: 已有控件复用评估报告

## 复用可行性汇总

| 控件 | 可行性 | 方式 | 建议时机 |
|------|--------|------|---------|
| TripleSplitContainer | 高 | 直接导入 + 状态管理适配 | 第一阶段：布局优化 |
| SplitContainer | 中 | 局部嵌入 | 第二阶段：面板二次分栏 |
| GameGraph | 高 | 接口适配 + 包装组件 | 第二阶段：变化树面板 |
| BoardOverlayStack | 高 | 直接复用 + 配置适配 | 第二阶段：棋盘功能 |
| Goban + MiniGoban | 高 | Goban 通过 OverlayStack 间接复用；MiniGoban 直接导入 | 第二阶段：棋盘核心 |
| BoardToolbar | 低-中 | 部分功能提取 | 第三阶段：UI 细节优化 |

## 路线图

### 第一阶段（布局优化）
- TripleSplitContainer 替换固定 grid 布局

### 第二阶段（核心功能）
- BoardOverlayStack + Goban → 棋盘功能
- GameGraph → 变化树面板（需 gameTree 适配器）
- MiniGoban → 快照对比

### 第三阶段（优化）
- SplitContainer → 面板内部二次分栏
- BoardToolbar 细节提取

## 关键风险
1. GameGraph 依赖 immutable-gametree，需要适配层
2. 状态管理需要从 sabaki.state 迁移到 workbench store
3. 事件系统需要桥接
