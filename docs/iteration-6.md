# Iteration 6 — v0.4.0 骰子 4x4 玩法

| 项目 | 值 |
|------|-----|
| 版本 | v0.4.0 |
| 类型 | 功能迭代（新玩法） |
| 日期 | 2026-08-06 |
| 测试 | 125 通过（+15 新增） |
| 构建 | 176KB JS / 55.7KB gzip |

## 概述

引入全新"骰子 4x4"玩法：回到 4×4 正方形网格，但每个色块除了颜色，
还携带一个骰子标号（1-4），以骰子点数形式（白色圆点）叠加在色块上。
胜利条件从"颜色匹配目标"升级为"颜色+数字同时匹配目标"。

### 核心设计

- **颜色约束**：四象限分别纯色（TL红/TR黄/BL蓝/BR绿），与基础 4x4 一致
- **数字约束**：2×2 周期重复模式 `1 2 / 3 4`，使每个旋钮覆盖的 4 格恰好
  包含 {1,2,3,4} 全集——旋转操作同时打乱颜色和数字排列
- **骰子渲染**：1=中心一点；2=左上+右下对角；3=对角+中心；4=四角
  白色半透明圆点，18% 格子边长，在四种颜色背景上均清晰可读
- **旋转动画**：骰子点数在 rotation overlay 内随父级 `transform: rotate()`
  同步旋转（非平移），满足"骰子点数同步旋转"要求
- **对换道具**：点数随 Cell 对象一起交换，swap overlay 中飞行色块也渲染点数

### 胜利条件变更

旧玩法（QuadrantUniformGoal）：仅检查颜色匹配目标象限
新玩法（DiceQuadrantGoal）：颜色 + 数字同时匹配目标

关键设计：`DiceQuadrantGoal.satisfied()` 内部持有 solvedBoard（通过
`createSolvedDice4x4()` 构造），逐格校验 `board.cells[i].number ===
solvedBoard.cells[i].number`，锚定到具体目标而非结构属性。

### 关卡设计

第 31 关：骰子 4x4 玩法入门关
- topologyKind: `square-4x4-dice`
- scramble: 8（中等难度）
- seed: 501
- Goal: DiceQuadrantGoal

## 代码变更

### 核心层

**src/core/types.ts**
- `Cell` 接口新增 `number?: number` 字段（可选，仅骰子玩法棋盘携带）

**src/core/board.ts**
- 新增 `createSolvedDice4x4()`：构造骰子 4x4 目标棋盘（颜色+数字）
- `boardsEqual()` 扩展为比较数字：`an !== bn` 判断，兼容无 number 的旧棋盘
  （双方都 undefined 时相等，一方有一方无则不等）

**src/core/goals.ts**
- 新增 `DiceQuadrantGoal` 类：颜色四象限纯色 + 数字逐格匹配
- 注册 `square-4x4-dice` 拓扑：复用 square4x4 拓扑，替换 Goal 与 solvedBoard

**src/levels/levels.ts**
- 新增第 31 关 spec：`{ id: 31, topologyKind: 'square-4x4-dice', scramble: 8, seed: 501 }`
- Goal 选择逻辑扩展：`square-4x4-dice` → `DiceQuadrantGoal`

### UI 层

**src/components/BoardView.tsx**
- `CellProps` 新增 `number?: number`
- 新增 `DicePips` 组件：根据点数 1-4 渲染对应数量的白色圆点
- 新增 `PIP_POSITIONS` 常量：骰子点数布局（百分比坐标）
- `CellBlock` 内部渲染 `<DicePips>`（当 number 存在时）
- 旋转 overlay：4 个 rot-cell 内部渲染骰子点数（按行优先交换索引 3/2）
  —— 点数在 `.rotate-inner` 内部，随 `transform: rotate()` 同步旋转
- 对换 overlay：飞行色块使用 `<CellBlock>` 替代裸 `<div>`，携带 number
- 主网格 CellBlock：传递 `cell.number`（对换中原位置不渲染点数）

**src/index.css**
- `.cell` 新增 `position: relative`（为绝对定位的 dice-pips 提供定位上下文）
- 新增 `.dice-pips`（绝对定位容器，inset:0，pointer-events:none）
- 新增 `.dice-pip`（白色圆点，18% 尺寸，translate(-50%,-50%) 居中定位）

## 关键设计决策

### 1. number 字段可选，旧玩法零影响

`Cell.number` 是 `?: number`（可选）。所有旧关卡（1-30）的 Cell 不携带
number，`CellBlock` 通过 `number !== undefined` 判断是否渲染骰子点。
旧关卡的渲染、旋转、对换、胜利判定完全不受影响。

### 2. 数字流转随 Cell 对象，核心逻辑零改动

`applyMove` / `rotateCellsCW` / `swapCells` / `cloneBoard` 都操作整个
`Cell` 对象（`{ ...c }` 展开），number 随 color 一起流转。
核心旋转/交换逻辑无需任何改动——这是"纯核心，哑 UI"架构的回报。

### 3. 旋转 overlay 中骰子点同步旋转

骰子点数 DOM 结构：`.rotate-inner > .rot-cell > .cell > .dice-pips > .dice-pip`
当 `.rotate-inner` 被 rAF 逐帧设置 `transform: rotate(angle)` 时，所有
子元素（包括骰子点）自动随父级同步旋转。无需额外 JS 逻辑驱动点数旋转。

### 4. 2×2 周期数字模式保证旋转有意义

数字模式 `1 2 / 3 4` 按 2×2 周期重复。每个旋钮覆盖的 4 格恰好是 {1,2,3,4}
全集，因此任何 CW 旋转都会改变数字排列（不会恒等）。同时，颜色四象限
设计使旋钮覆盖的 4 格来自不同象限——颜色和数字是两套独立的排列约束，
玩家必须找到同时恢复两者的旋转序列。

## 测试

新增 15 个骰子玩法测试（`Dice4x4` describe block）：
- `createSolvedDice4x4` 创建正确棋盘（颜色+数字）
- 2×2 周期数字模式验证
- 每个旋钮覆盖 {1,2,3,4} 全集
- 已解决判定胜利
- 旋转后不满足胜利
- 颜色正确但数字错位不判胜
- 数字正确但颜色错位不判胜
- 旋转 4 次恢复胜利
- 旋转后数字随 Cell 流转（精确值验证）
- 对换时数字一起交换
- boardsEqual 比较数字
- generatePuzzle 支持 dice 拓扑
- 第 31 关为骰子玩法
- 第 31 关题目非已解决
- 第 31 关题目可解（逆向还原）

更新 3 个关卡计数断言（30→31）。

## 验证

- `npm test`：125 tests passed (2 files)
- `npm run build`：tsc 0 errors，vite build 176KB JS / 55.7KB gzip

## 文件变更

| 文件 | 变更 |
|------|------|
| src/core/types.ts | Cell 接口 +number 字段 |
| src/core/board.ts | +createSolvedDice4x4, boardsEqual 扩展 |
| src/core/goals.ts | +DiceQuadrantGoal, +注册 square-4x4-dice |
| src/levels/levels.ts | +第 31 关 spec, Goal 选择逻辑扩展 |
| src/components/BoardView.tsx | +DicePips 组件, overlay 传递 number |
| src/index.css | +.dice-pip 样式, .cell position:relative |
| tests/core.test.ts | +15 骰子测试, 3 个计数断言更新 |
| package.json | 版本 0.3.5 → 0.4.0 |
