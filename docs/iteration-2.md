# Rotrix 技术文档 — 第二轮迭代

> 日期：2026-07-29
> 版本：v0.2.0
> 状态：6x6 网格新玩法上线

---

## 1. 迭代概要

本轮迭代在 4x4 基础玩法之上，新增 **6x6 方形网格**玩法，作为第 6-10 关。6x6 网格的目标是使四种颜色分别填满四个 3x3 象限。

| # | 类型 | 描述 |
|---|------|------|
| 1 | 新功能 | 6x6 网格题目生成（25 旋钮、4 个 3x3 目标区域） |
| 2 | 新功能 | 第 6-10 关 6x6 关卡（由易到难） |
| 3 | 架构 | useGame / levels / App 从拓扑注册表动态获取拓扑，不再硬编码 4x4 |
| 4 | 架构 | BoardView 的 cell-grid 列数和旋转 overlay 尺寸按 board.dims 动态计算 |
| 5 | 兼容 | 4x4 关卡（第 1-5 关）行为完全不变，回归测试覆盖 |

---

## 2. 6x6 玩法设计

### 2.1 棋盘

6x6 = 36 格，4 色各占 9 格。目标排列：

```
R R R | Y Y Y
R R R | Y Y Y     R=红  Y=黄
R R R | Y Y Y
------+------
B B B | G G G     B=蓝  G=绿
B B B | G G G
B B B | G G G
```

### 2.2 旋钮

25 个旋钮（5x5 排布），每个旋钮旋转其中心 2x2 区域的 4 个色块。旋钮机制与 4x4 完全相同——顺时针旋转 [TL, TR, BR, BL] 四块。

```
旋钮 K(r,c) 中心 (r+0.5, c+0.5)，r,c ∈ {0,1,2,3,4}
覆盖: (r,c), (r,c+1), (r+1,c+1), (r+1,c)  顺时针
```

### 2.3 目标区域

4 个 3x3 象限：

| 区域 | 行范围 | 列范围 | 索引 |
|------|--------|--------|------|
| TL (红) | 0-2 | 0-2 | 0,1,2, 6,7,8, 12,13,14 |
| TR (黄) | 0-2 | 3-5 | 3,4,5, 9,10,11, 15,16,17 |
| BL (蓝) | 3-5 | 0-2 | 18,19,20, 24,25,26, 30,31,32 |
| BR (绿) | 3-5 | 3-5 | 21,22,23, 27,28,29, 33,34,35 |

胜利条件：每个 3x3 区域内 9 格同色（`QuadrantUniformGoal`，与 4x4 共用，拓扑无关）。

### 2.4 难度梯度

| 关卡 | 名称 | 网格 | scramble | seed |
|------|------|------|----------|------|
| 6 | 六六初探 | 6x6 | 5 | 606 |
| 7 | 矩阵迷踪 | 6x6 | 10 | 707 |
| 8 | 星罗棋布 | 6x6 | 15 | 808 |
| 9 | 万象旋转 | 6x6 | 22 | 909 |
| 10 | 六维终极 | 6x6 | 30 | 1001 |

6x6 起始 scramble=5（比 4x4 的 3 高），因为 6x6 有 25 个旋钮、36 格，需要更多步数才能产生有意义的打乱。

---

## 3. 架构改动

### 3.1 拓扑注册表落地（消除硬编码）

v0.1.x 中 `useGame` 硬编码 `square4x4()`，`levels.ts` 硬编码 4x4 的 solved/topology/goal，`App.tsx` 硬编码 `createSolvedSquare4x4()`。这些都是 iteration-1.md §7.3 指出的架构债。

v0.2.0 全面落地注册表模式：

**`useGame.ts`**：
```typescript
const topology = useMemo<Topology>(
  () => getTopologyEntry(level.topologyKind).topology(),
  [level.topologyKind],
);
```

**`levels.ts`**：
```typescript
const entry = getTopologyEntry(spec.topologyKind);
const topology = entry.topology();
const solved = entry.defaultSolvedBoard();
const goal = entry.defaultGoal();
```

**`App.tsx`**：
```typescript
const solvedBoard = useMemo(
  () => getTopologyEntry(level.topologyKind).defaultSolvedBoard(),
  [level.topologyKind],
);
```

新增拓扑只需在 `goals.ts` 注册，不需要改动 useGame / levels / App。

### 3.2 BoardView 动态化

**cell-grid 列数**：从 CSS 硬编码 `repeat(4, 1fr)` 改为内联 style 按 `board.dims` 动态设置：

```tsx
<div className="cell-grid" style={{
  gridTemplateColumns: `repeat(${board.dims[1]}, 1fr)`,
  gridTemplateRows: `repeat(${board.dims[0]}, 1fr)`,
}}>
```

**旋转 overlay 尺寸**：从硬编码 `width: 50, height: 50`（4x4 的 2/4=50%）改为按网格维度计算：

```typescript
const overlayPct = (2 / board.dims[0]) * 100;
// 4x4: 50%, 6x6: 33.3%
```

### 3.3 新增文件/代码

| 文件 | 新增内容 |
|------|----------|
| `src/core/board.ts` | `createSolvedSquare6x6()` 函数 |
| `src/core/topology.ts` | `Square6x6Topology` 类 + `square6x6()` 单例 |
| `src/core/goals.ts` | 注册 `square-6x6` 到 `topologyRegistry` |
| `src/levels/levels.ts` | `LevelSpec` 增加 `topologyKind` 字段，第 6-10 关定义 |

---

## 4. 兼容性

### 4.1 4x4 回归

- 4x4 拓扑代码（`Square4x4Topology`）完全未改动
- 4x4 关卡（第 1-5 关）的 spec 只增加了 `topologyKind: 'square-4x4'` 字段，生成逻辑等价
- 旋转动画、overlay、cell transition 等机制完全复用
- 回归测试：4x4 的 24 项核心测试 + 4 项 UI 测试全部通过

### 4.2 布局兼容

6x6 棋盘的 `--board-size` 与 4x4 相同（`min(82vw, 340px)`），CSS grid 自动将 36 格均匀分布。色块、旋钮、旋转 overlay 的样式全部复用，无需新增 CSS 规则。视觉上 6x6 格子更小更密，但整体布局不变。

### 4.3 旋转动画兼容

旋转 overlay 的 `scale = 1/(cosθ+sinθ)` 内切公式与网格维度无关，在 6x6 的 2x2 旋转区域上同样成立。overlay 尺寸动态计算后，6x6 的旋转动画行为与 4x4 一致。

---

## 5. 测试覆盖

### 5.1 测试结果

```
✓ tests/core.test.ts  (41 tests) 60ms
✓ tests/ui.test.tsx   (5 tests)  492ms

Test Files  2 passed (2)
     Tests  46 passed (46)
```

### 5.2 新增测试（+18 项）

**6x6 棋盘操作（1 项）：**
- `createSolvedSquare6x6` 创建 6x6 棋盘，4 象限纯色

**6x6 拓扑（5 项）：**
- 25 个旋钮
- 每个旋钮覆盖 4 块
- 4 个目标区域各 9 格
- 目标区域覆盖全部 36 格
- K22 覆盖中心 2x2

**6x6 目标判定（3 项）：**
- 已解决棋盘判定胜利
- 打乱后不满足
- 旋转 4 次恢复

**6x6 关卡生成（3 项）：**
- 题目与目标不同
- 题目可解（逆序还原）
- 相同种子确定性

**6x6 关卡数据（5 项，含回归更新）：**
- 生成 10 关
- ID 1-10
- 第 6-10 关为 6x6
- 第 1-5 关仍为 4x4（回归）
- 6x6 题目非已解决

**6x6 UI 渲染（1 项）：**
- 36 色块 + 25 旋钮

### 5.3 更新的测试

- "关卡难度递增" → "关卡难度在同拓扑内递增"：跨拓扑（4x4→6x6）难度重置是合理的，改为仅在同类拓扑内断言递增，另加 4x4/6x6 各自首尾对比。

---

## 6. 构建

```
npm run build → tsc 通过，vite build 成功（41 modules，1.31s）
dist/assets/index-DibLneI_.js   153.51 kB │ gzip:  49.92 kB
```

相比 v0.1.3（151.74 kB）增加 ~2 kB，来自 6x6 拓扑/棋盘代码 + 测试。

---

## 7. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `package.json` | 修改 | 版本号 0.1.3 → 0.2.0 |
| `src/core/board.ts` | 修改 | 新增 `createSolvedSquare6x6()` |
| `src/core/topology.ts` | 修改 | 新增 `Square6x6Topology` + `square6x6()` |
| `src/core/goals.ts` | 修改 | 注册 `square-6x6` 拓扑 |
| `src/levels/levels.ts` | 重写 | 注册表模式 + `topologyKind` 字段 + 第 6-10 关 |
| `src/hooks/useGame.ts` | 修改 | 从注册表按 `topologyKind` 获取拓扑 |
| `src/components/BoardView.tsx` | 修改 | 动态 grid 列数 + 动态 overlay 尺寸 |
| `src/App.tsx` | 修改 | 动态 `solvedBoard` 预览 |
| `tests/core.test.ts` | 修改 | +17 项 6x6 测试，更新关卡测试 |
| `tests/ui.test.tsx` | 修改 | +1 项 6x6 渲染测试 |
| `docs/iteration-2.md` | 新增 | 本迭代文档 |

---

## 8. 已知问题与不足

### 8.1 设计层面

1. **6x6 难度仍用有效旋转步数**：25 旋钮的搜索空间远大于 9 旋钮，但难度量化方式未升级。后续可引入 BFS 精确最短解。
2. **6x6 起始难度可能偏高**：scramble=5 在 25 旋钮上可能仍较难，需玩家反馈调整。

### 8.2 功能层面

1. **无撤销功能**：`history` 已记录但 UI 未暴露。
2. **无通关进度持久化**：刷新重置。
3. **无音效/触感反馈**。

### 8.3 架构层面

1. **BoardView 渲染仍适配方形网格**：`grid-template-columns: repeat(N, 1fr)` 假设均匀方形。三角/六边形需独立渲染策略组件。
2. **旋钮位置渲染假设方形均匀网格**：百分比定位 `((center+0.5)/dims)*100` 仅适配方形。

---

## 9. 下一轮迭代建议

按优先级排序：

### P0 — 完善体验
- [ ] 撤销/重做功能
- [ ] 通关进度持久化（localStorage）
- [ ] 步数评级（三星机制）

### P1 — 新拓扑
- [ ] 8x8 方形网格（49 旋钮，4 个 4x4 区域）
- [ ] 三角/六边形网格拓扑
- [ ] BFS 精确难度计算

### P2 — 渲染层抽象
- [ ] `BoardRenderer` 接口，支持不同网格形状
- [ ] 拆分 `registry.ts`，解耦 goals 与注册

---

## 10. Git 记录

```
0534b6a  v0.1.3: 视觉优化（字号放大 + 旋转时长缩短 + 浅色主题 + 字体回退系统栈）
(本次)    v0.2.0: 6x6 网格新玩法（25旋钮 + 4个3x3区域 + 注册表模式落地 + 动态渲染）
```

---

*文档结束。下一轮迭代将聚焦于 P0 体验完善与新拓扑扩展。*
