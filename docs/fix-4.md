# Rotrix 修复报告 #4 — v0.2.0 → v0.2.1

> 日期：2026-07-29
> 版本：v0.2.1
> 基线：v0.2.0 (commit edeb008)

---

## 1. 修复概要

本轮针对 v0.2.0 进行功能扩展与体验优化，共 2 项：

| # | 类型 | 描述 |
|---|------|------|
| 1 | 功能 | 4x4 和 6x6 各扩展为 10 关，共 20 关，难度从易到难 |
| 2 | UX | 胜利后播放对角线波纹庆祝动画，动画结束后再弹窗 |

同时进行了内部架构优化：新增 `generatePuzzle` 统一接口，避免关卡定义代码重复访问注册表/RNG。

---

## 2. 关卡扩展至 20 关

### 2.1 原状

v0.2.0 共 10 关：5 个 4x4（第 1-5 关）+ 5 个 6x6（第 6-10 关）。每关有单独的名称。

### 2.2 改动

扩展为 20 关：10 个 4x4（第 1-10 关）+ 10 个 6x6（第 11-20 关）。不再为每关单独取名，info-bar 显示"第 N 关"。

| 关卡范围 | 网格 | scramble 范围 | seed 范围 |
|----------|------|--------------|-----------|
| 1-10 | 4x4 | 3 → 30 | 101-110 |
| 11-20 | 6x6 | 5 → 50 | 201-210 |

4x4 难度梯度（scramble 递增）：3, 5, 7, 9, 12, 15, 18, 22, 26, 30
6x6 难度梯度：5, 8, 12, 16, 20, 25, 30, 36, 42, 50

### 2.3 验证

- 单元测试：20 关全生成，ID 1-20，4x4/6x6 各 10 关，同拓扑内难度递增 ✓
- 每关题目非已解决状态 ✓

---

## 3. generatePuzzle 统一接口

### 3.1 原状

v0.2.0 的 `levels.ts` 中，每关生成都需重复调用 `getTopologyEntry` → `entry.topology()` → `entry.defaultSolvedBoard()` → `entry.defaultGoal()` → `new SeededRNG` → `generateLevel`，代码冗长且每加一个拓扑都要修改。

### 3.2 改动

`src/core/generator.ts` 新增 `generatePuzzle` 函数：

```typescript
export function generatePuzzle(
  topologyKind: string,
  scramble: number,
  seed: number,
): GeneratedLevel {
  const entry = getTopologyEntry(topologyKind);
  const topology = entry.topology();
  const solved = entry.defaultSolvedBoard();
  const rng = new SeededRNG(seed);
  return generateLevel({ solved, topology, scrambleCount: scramble, rng });
}
```

`levels.ts` 的关卡生成从 7 行缩减为 1 行：

```typescript
const gen = generatePuzzle(spec.topologyKind, spec.scramble, spec.seed);
```

### 3.3 验证

- tsc 零类型错误
- 生成器测试全通过（4x4 + 6x6 题目可解性、确定性均保持）

---

## 4. 胜利庆祝动画

### 4.1 原状

v0.2.0 胜利后直接弹出 win-overlay，没有动画过渡，缺乏"成功"的视觉反馈。

### 4.2 设计

胜利后，操作地图的色块按**对角线波纹**依次脉冲——从左上角到右下角，每个色块根据其 (row+col) 值计算延迟，形成波浪扫过棋盘的效果。

**动画参数：**
- 单个色块动画：scale 1 → 1.18 → 1 + brightness 1 → 1.25 → 1 + border-radius 6px → 12px → 6px
- 单次时长：400ms，ease-in-out
- 延迟：`(row + col) * 60ms`
  - 4x4：左上角(0,0)=0ms，右下角(3,3)=360ms
  - 6x6：左上角(0,0)=0ms，右下角(5,5)=600ms
- 总时长：4x4 约 760ms，6x6 约 1000ms
- 庆祝状态持续 1400ms（CELEBRATE_DURATION），覆盖波纹扫完 + 短暂停留
- 庆祝结束后自动清除，弹窗显示

### 4.3 实现

**useGame.ts：**
- 新增 `celebrating` state + `CELEBRATE_DURATION = 1400`
- `onAnimationEnd` 中判定胜利时同步 `setCelebrating(true)`
- `useEffect` 自动在 1400ms 后清除 `celebrating`
- `reset` 清除 `celebrating`
- 返回值新增 `celebrating`

**BoardView.tsx：**
- 新增 `celebrating` prop
- `.board` 元素在 celebrating 时加 `.celebrating` class
- 每个 `CellBlock` 在 celebrating 时按 `(row+col)*60ms` 设置 `animationDelay`
- `CellBlock` 新增 `style` prop 支持内联 `animationDelay`

**App.tsx：**
- 传 `celebrating={game.celebrating}` 给操作地图 BoardView
- win-overlay 渲染条件从 `game.won` 改为 `game.won && !game.celebrating`——庆祝动画期间不弹窗
- info-bar 从显示 `level.name` 改为显示"第 N 关"

**index.css：**
```css
@keyframes celebrate-pulse {
  0%   { transform: scale(1);    filter: brightness(1);    border-radius: 6px; }
  40%  { transform: scale(1.18); filter: brightness(1.25); border-radius: 12px; }
  100% { transform: scale(1);    filter: brightness(1);    border-radius: 6px; }
}
.board.celebrating .cell {
  animation: celebrate-pulse 0.4s ease-in-out forwards;
}
```

### 4.4 验证

- 单元测试全通过（celebrating 不影响棋盘逻辑/旋转动画/步数计数）
- 浏览器手动验证：胜利后色块从左上到右下依次脉冲，动画结束后弹窗显示

---

## 5. 测试与构建

### 5.1 单元测试

```
✓ tests/core.test.ts  (41 tests) 71ms
✓ tests/ui.test.tsx   (5 tests)  586ms

Test Files  2 passed (2)
     Tests  46 passed (46)
```

关卡测试更新为 20 关断言，6x6 渲染测试改用 `getLevel(11)`。无新增失败。

### 5.2 构建

```
npm run build → tsc 通过，vite build 成功
```

---

## 6. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `package.json` | 修改 | 版本号 0.2.0 → 0.2.1 |
| `src/core/generator.ts` | 修改 | 新增 `generatePuzzle` 统一接口 |
| `src/levels/levels.ts` | 重写 | 20 关定义 + 使用 generatePuzzle + 去除关卡名 |
| `src/hooks/useGame.ts` | 修改 | 新增 celebrating 状态 + 自动清除 effect |
| `src/components/BoardView.tsx` | 修改 | 新增 celebrating prop + 对角线延迟 + CellBlock style prop |
| `src/App.tsx` | 修改 | 传 celebrating + 延迟弹窗 + 去除 name 显示 |
| `src/index.css` | 修改 | 新增 celebrate-pulse keyframes + .board.celebrating .cell 规则 |
| `tests/core.test.ts` | 修改 | 关卡断言 10→20，6x6 范围 6-10→11-20 |
| `tests/ui.test.tsx` | 修改 | 6x6 渲染测试 getLevel(6)→getLevel(11) |
| `docs/fix-4.md` | 新增 | 本修复报告 |

---

## 7. 遗留问题

1. **庆祝动画在 jsdom 中无法测试**：CSS animation 在 jsdom 中不执行，无法用单元测试验证动画效果，仅验证状态转换逻辑。
2. **无撤销功能 / 无通关进度持久化**：留待后续迭代。
3. **6x6 起始难度**：scramble=5 在 25 旋钮上是否合适，需玩家反馈。

---

## 8. Git 记录

```
edeb008  v0.2.0: 6x6网格新玩法（25旋钮 + 4个3x3区域 + 注册表模式落地 + 动态渲染）
(本次)    v0.2.1: 关卡扩展至20关 + generatePuzzle接口 + 胜利对角线波纹庆祝动画
```

---

*修复报告结束。*
