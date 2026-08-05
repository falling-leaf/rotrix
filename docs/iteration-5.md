# v0.3.5 — 对换道具（魔法棒）

## 概述

| 项目 | 内容 |
|------|------|
| 版本 | v0.3.5（iteration） |
| 日期 | 2026-08-05 |
| 特性 | 对换道具——选择任意两个格子互换位置 |
| 动画 | rAF 驱动的双格飞移动画（350ms ease-in-out cubic） |
| 限制 | 每关最多 3 次，reset 后重置 |
| 测试 | 110 pass（89 core + 21 UI），新增 11 tests |
| 构建 | 174KB JS / 55KB gzip |

## 需求分析

用户需求：
1. 重置按钮旁边新增"对换"按钮，正方形图标 + 魔法棒图案
2. 点击后进入"对换模式"，可选择操作地图上任意两个单元（正方形或三角形）
3. 互换过程有动画
4. 图案下方显示剩余次数，每关最多 3 次

## 设计

### 核心层：swapCells 纯函数

`src/core/board.ts` 新增 `swapCells(board, indexA, indexB): Board`：
- 纯函数，不修改输入，返回新棋盘
- 交换 `cells[indexA]` 与 `cells[indexB]` 的整个 Cell 对象（含 color + id + attrs）
- `indexA === indexB` 时返回克隆（无变化）
- 与 `applyMove` 同模式，便于测试

### 状态层：useGame hook 扩展

`src/hooks/useGame.ts` 新增对换状态：

```
swapMode        — 是否处于"选择对换格子"模式
swapSelection   — 已选中的第一个格子索引（null = 尚未选）
swapAnimating   — 对换动画状态 { indexA, indexB }
swapsLeft       — 本关剩余次数（初始 MAX_SWAPS=3）
```

新增 3 个回调：
- `toggleSwapMode()` — 切换对换模式（次数 0 / 已胜利 / 动画中时拒绝）
- `handleCellClick(index)` — 对换模式下的格子选择逻辑（第一次记录，第二次触发动画）
- `onSwapAnimationEnd()` — 动画结束后提交棋盘交换 + 判定胜利 + 次数-1

关键设计决策：
- **对换不计入 moveCount**：对换是道具，不应影响步数统计
- **对换与旋转互斥**：对换模式下旋钮禁用，旋转动画中也不响应对换
- **swapAnimatingRef**：与 animatingRef 同模式，用 ref 传递动画状态给 onSwapAnimationEnd，避免嵌套 setState

### UI 层

#### SwapButton 组件（新建）

`src/components/SwapButton.tsx`：
- 正方形按钮，内联 SVG 魔法棒图标（棒身 + 柄端圆点 + 棒尖五角星）
- 图标下方显示 `swapsLeft/maxSwaps`（如 "3/3" → "2/3" → "0/3"）
- 激活态：accent 描边 + 背景柔光 + 图标变色
- 禁用态：opacity 0.4，次数 0 或已胜利时禁用

#### BoardView 扩展（正方形棋盘）

新增 props：`swapMode`, `swapSelection`, `swapAnimating`, `onCellClick`, `onSwapAnimationEnd`

渲染变化：
- **cell-slot 包装**：每个 cell 外层加 `.cell-slot` div，对换模式下附加 `swap-clickable` / `swap-selected` 类
- **swap-overlay**：两个 `.swap-piece` div，通过 rAF 驱动 `left/top` 百分比从 A→B 和 B→A 飞移
- **keepSwapAnimating**：与旋转同模式的 settle 帧保持，避免 commit 后的 transition 闪烁
- **knob disabled**：对换模式下旋钮全部 disabled

动画参数：
- `SWAP_DURATION = 350ms`
- `SETTLE_FRAMES = 3`（与旋转一致）
- ease-in-out cubic（先加速后减速，模拟抛出+落下）

#### HexBoardView 扩展（六边形棋盘）

与 BoardView 同模式，但飞行元素是 SVG `<polygon>`：
- 每个 `.swap-piece` 是一个 `<g>` + `<polygon>`，通过 `transform: translate(dx, dy)` 移动
- 质心计算：`cx = (pts[0]+pts[2]+pts[4])/3`，已在胜利庆祝中使用过同一模式
- 对换中底层两个三角形 opacity:0 隐藏（与旋转隐藏同机制）

### CSS（index.css 追加）

- `.swap-btn` — 正方形按钮样式
- `.swap-btn.active` — 激活态高亮
- `.board.swap-mode .cell-slot` — 对换模式下格子可点击
- `.swap-selected .cell` — 脉冲高亮边框（@keyframes swap-pulse）
- `.swap-overlay` / `.swap-piece` — 飞移动画 overlay
- `.hex-tri.swap-clickable` / `.hex-tri.swap-selected` — 六边形棋盘的对换高亮
- 移动端 `@media (max-width: 768px)` 适配

## 文件变更

| 文件 | 变更 |
|------|------|
| `src/core/board.ts` | +swapCells() 纯函数 |
| `src/hooks/useGame.ts` | +swap 状态 + 3 个回调 + reset 扩展 |
| `src/components/SwapButton.tsx` | 新建 |
| `src/components/BoardView.tsx` | +swap props + swapOverlay + rAF + cell-slot |
| `src/components/HexBoardView.tsx` | +swap props + swapOverlay + rAF + polygon click |
| `src/App.tsx` | +SwapButton + swap props 传入 BoardView |
| `src/components/EndlessScreen.tsx` | +SwapButton + swap props 传入 BoardView |
| `src/index.css` | +swap UI 样式 |
| `tests/core.test.ts` | +6 swapCells 纯函数测试 |
| `tests/ui.test.tsx` | +5 对换道具 UI 测试 |
| `package.json` | 0.3.4 → 0.3.5 |

## 测试结果

```
Test Files  2 passed (2)
     Tests  110 passed (110)
  Duration  12.19s
```

新增测试（11 个）：

**core.test.ts — swapCells 纯函数（6 个）**：
1. 交换两个不同格子，颜色互换
2. 交换后其余格子不受影响
3. 不修改原棋盘（纯函数）
4. 同一索引对换返回等价棋盘
5. 二次对换恢复原状（swap ∘ swap = identity）
6. 六边形棋盘同样支持对换

**ui.test.tsx — 对换道具 UI（5 个）**：
1. 初始状态：对换模式关闭，剩余次数为 3
2. 激活对换模式后，棋盘加 swap-mode 类，格子可点击
3. 对换模式下旋钮被禁用
4. 选两个格子后触发对换动画，动画结束后棋盘交换且次数-1
5. reset 后对换状态全部重置
6. 次数耗尽后无法激活对换模式

## 构建输出

```
dist/index.html                   0.86 kB │ gzip:  0.58 kB
dist/assets/index-Cq4-ytVD.css   11.95 kB │ gzip:  3.08 kB
dist/assets/index-B5U2652m.js   174.47 kB │ gzip:  55.31 kB
✓ built in 1.81s
```

Bundle 174KB / gzip 55KB，符合 ~150KB 预期。
