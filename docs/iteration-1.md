# Rotrix 技术文档 — 第一轮迭代

> 日期：2026-07-28
> 版本：v0.1.0
> 状态：基础玩法 MVP 完成

---

## 1. 项目概述

Rotrix 是一款基于旋转机制的 H5 拼图小游戏。玩家通过点击网格中 2x2 区域中心的旋钮，顺时针旋转周围 4 个色块，使同色块聚集到四个象限。

本轮迭代完成了 **4x4 方形网格** 的基础玩法 MVP，并为后续的 6x6、三角形、六边形、三维网格等扩展预留了架构接口。

---

## 2. 技术选型

| 层级 | 技术 | 理由 |
|------|------|------|
| 框架 | React 18 + TypeScript | 组件化便于 UI 复用；类型系统保证扩展期重构安全 |
| 构建 | Vite 5 | 开发服务器秒级启动，HMR 极快 |
| 测试 | Vitest + Testing Library | 与 Vite 共享配置，零额外开销；jsdom 环境支持组件测试 |
| 包管理 | npm | Node 20 兼容性好 |

**为何不用游戏引擎（如 Phaser/PixiJS）？**
- 当前玩法是回合制的网格点击，DOM 渲染足够。
- 后续若需要复杂动画/3D，可在渲染层替换为 Canvas/WebGL 而不触及核心逻辑。
- React 生态的组件化更利于 UI 扩展（关卡选择、设置等）。

---

## 3. 架构设计

### 3.1 分层架构

```
src/
├── core/               # 核心领域逻辑（纯函数，与 UI 无关）
│   ├── types.ts        # 类型定义：Cell, Board, Knob, Topology, Goal, Level
│   ├── board.ts        # 棋盘操作：创建、旋转、比较、RNG 接口
│   ├── topology.ts     # 4x4 拓扑实现（9 旋钮 + 4 目标区域）
│   ├── goals.ts       # 目标判定策略 + 拓扑注册表
│   ├── generator.ts    # 关卡生成器（随机旋转打乱）
│   └── rng.ts          # 确定性种子 RNG（关卡可复现）
├── levels/             # 关卡数据
│   └── levels.ts       # 5 个关卡定义（种子生成，固定内容）
├── hooks/
│   └── useGame.ts      # 游戏状态管理 hook
├── components/
│   └── BoardView.tsx   # 棋盘 + 旋钮渲染组件
├── App.tsx             # 应用入口（关卡选择 + 游戏区 + 胜利弹窗）
├── main.tsx            # React 挂载
└── index.css           # 全局样式（CSS 变量主题化）
```

### 3.2 扩展点设计

核心设计原则：**逻辑与 UI 解耦，拓扑/目标通过接口抽象**。

#### 扩展点 1：新拓扑（6x6 / 三角 / 六边 / 三维）

实现 `Topology` 接口即可：

```typescript
interface Topology {
  readonly kind: string;
  knobs(): Knob[];        // 提供旋钮定义
  regions(): Region[];    // 提供目标区域
  size(): number;         // 棋盘格子数
}
```

然后在 `goals.ts` 的 `topologyRegistry` 中注册：

```typescript
registerTopology('hex-6x6', {
  topology: () => new Hex6x6Topology(),
  defaultGoal: () => new HexagonUniformGoal(),
  defaultSolvedBoard: createSolvedHex6x6,
});
```

#### 扩展点 2：新目标判定（相邻约束 / 图案匹配）

实现 `Goal` 接口：

```typescript
interface Goal {
  readonly kind: string;
  satisfied(board: Board, topology: Topology): boolean;
  describe?(): string;
}
```

基础玩法的 `QuadrantUniformGoal` 判定每个象限纯色。后续可如：

```typescript
class AdjacencyGoal implements Goal {
  satisfied(board, topology) {
    // 检查两个指定 id 的色块是否相邻
  }
}
```

#### 扩展点 3：色块属性

`Cell` 接口已预留 `id` 和 `attrs` 字段：

```typescript
interface Cell {
  color: Color;
  id?: string;                          // 用于相邻约束
  attrs?: Record<string, unknown>;     // 预留扩展
}
```

#### 扩展点 4：50 关数据结构

`Level` 接口已结构化，后续只需在 `levels.ts` 中扩展 `LEVEL_SPECS` 数组，或从 JSON 加载。

### 3.3 旋转操作语义

旋钮的 `cells` 数组按 **[左上, 右上, 右下, 左下]** 顺时针顺序排列。

顺时针旋转 (CW)：
```
new[i] = old[(i + 3) % 4]
// 即 [D, A, B, C] ← [A, B, C, D]
```

逆时针旋转 (CCW)：
```
new[i] = old[(i + 1) % 4]
// 即 [B, C, D, A] ← [A, B, C, D]
```

CW 四次回到初始状态（周期为 4）。

---

## 4. 关卡生成算法

### 4.1 核心思路

从目标棋盘出发，执行 N 次随机旋转得到题目。**题目天然可解**（逆序执行即可还原）。

### 4.2 难度量化

采用 **有效旋转步数** 作为难度指标：

1. 遍历旋转序列，将连续同一旋钮同方向的操作分组。
2. 每组对 4 取模（因为 CW×4 = 恒等），得到压缩后的有效步数。
3. 取多轮生成的最大值，确保打乱充分。

辅助指标 `displacementRate`：色块错位率，衡量与目标的差异比例。

### 4.3 难度梯度

5 个关卡配置：

| 关卡 | 名称 | scramble | 种子 | 实际难度 |
|------|------|----------|------|----------|
| 1 | 初探旋钮 | 3 | 101 | 3 |
| 2 | 渐入佳境 | 6 | 202 | 6 |
| 3 | 错综复杂 | 9 | 303 | 9 |
| 4 | 混沌迷局 | 12 | 404 | 12 |
| 5 | 终极挑战 | 18 | 505 | 18 |

使用确定性种子 RNG，保证关卡内容固定，不会每次刷新变化。

### 4.4 可解性保证

由于题目 = 目标 + 随机旋转序列，逆序执行旋转序列的逆操作即可还原。验证逻辑见冒烟测试中"题目可解"测试用例。

---

## 5. 测试覆盖

### 5.1 冒烟测试结果

```
✓ tests/core.test.ts  (24 tests) 22ms
✓ tests/ui.test.tsx   (2 tests)  184ms

Test Files  2 passed (2)
     Tests  26 passed (26)
```

### 5.2 测试覆盖范围

**核心逻辑 (core.test.ts) — 24 项：**
- Board 创建、深拷贝、相等比较
- CW/CCW 旋转正确性、周期性
- Topology 9 旋钮 4 区域覆盖完整性
- Goal 胜利判定（已解/打乱/恢复）
- Generator 题目非空、可解性、难度递增、确定性
- Levels 5 关完整性、难度递增

**UI 渲染 (ui.test.tsx) — 2 项：**
- 组件渲染 16 色块 + 9 旋钮
- 点击旋钮改变棋盘状态

### 5.3 未覆盖项（后续迭代）

- 完整通关流程的端到端测试
- 不同拓扑的回归测试（待新拓扑实现）
- 性能/边界测试

---

## 6. 本轮成果

1. ✅ 完成项目脚手架（React + TS + Vite + Vitest）
2. ✅ 设计可扩展分层架构（core / levels / hooks / components）
3. ✅ 实现 4x4 拓扑、CW 旋转、象限目标判定
4. ✅ 实现确定性关卡生成器（种子可复现，难度可量化）
5. ✅ 生成 5 个由易到难（难度 3→18）的关卡
6. ✅ 完成游戏 UI（棋盘、旋钮、关卡选择、胜利弹窗）
7. ✅ Vite 开发服务器验证启动成功（http://localhost:5173）
8. ✅ 浏览器验证交互正常（点击旋钮 → 色块旋转 → 步数计数）
9. ✅ 26 项冒烟测试全部通过

---

## 7. 已知问题与不足

### 7.1 设计层面

1. **难度量化较粗糙**
   - 当前仅用"有效旋转步数"，未考虑旋转间交互复杂度。
   - 同一 scramble 数可能因旋转序列差异产生不同实际难度。
   - 后续可引入 BFS 求最短解步数作为精确难度。

2. **生成器重试机制简陋**
   - 最多 50 次重试，极端情况可能未充分打乱。
   - 未做"保证最小难度"的约束。

3. **拓扑注册表耦合在 goals.ts**
   - `goals.ts` 同时承担目标判定和注册表职责，后续应拆分 `registry.ts`。

### 7.2 功能层面

1. **无撤销功能**
   - `useGame` 已记录 `history`，但 UI 未暴露撤销按钮。下一步实现。

2. **无旋转动画**
   - 当前色块变化为即时 CSS 过渡，缺乏旋转动效。
   - 后续可加 CSS rotation transform 或 Framer Motion。

3. **无音效/触感反馈**
   - H5 游戏建议补充点击音效和振动反馈。

4. **仅 CW 方向**
   - 旋钮类型预留了 `directions` 字段，但当前全部固定 `['CW']`。
   - 后续可设计 CCW 旋钮或双方向旋钮。

5. **无关卡数据持久化**
   - 通关进度未存 localStorage，刷新即重置。
   - 后续实现 `useProgress` hook。

### 7.3 架构层面

1. **拓扑硬编码为 square4x4**
   - `useGame` 中硬引用 `square4x4()`，应改为根据 `level.topologyKind` 从注册表获取。

2. **旋钮位置渲染仅适配方形网格**
   - `BoardView` 的旋钮百分比定位假设方形均匀网格。
   - 三角/六边形需独立的渲染策略组件。

3. **未支持色块 id/属性渲染**
   - 当前仅渲染颜色，后续相邻约束等需可视化 id 或标记。

---

## 8. 下一轮迭代建议

按优先级排序：

### P0 — 完善基础体验
- [ ] 实现撤销/重做功能
- [ ] 通关进度持久化（localStorage）
- [ ] 旋转动画效果
- [ ] 步数评级（三星机制）

### P1 — 扩展架构落地
- [ ] `useGame` 从拓扑注册表动态获取拓扑
- [ ] 拆分 `registry.ts`，解耦 goals 与注册
- [ ] 渲染层抽象：`BoardRenderer` 接口，支持不同网格形状

### P2 — 新玩法
- [ ] 6x6 方形网格（8x8 旋钮，9 象限目标）
- [ ] BFS 精确难度计算（最短解步数）
- [ ] 扩展到 50 关

### P3 — 高级特性
- [ ] 色块属性（相邻约束、固定块、不可旋转区）
- [ ] 三角/六边形网格拓扑
- [ ] 三维网格
- [ ] 自定义目标图案

---

## 9. 项目结构总览

```
rotrix/
├── index.html              # H5 入口
├── package.json            # 依赖与脚本
├── tsconfig.json           # TypeScript 配置（含路径别名）
├── tsconfig.node.json      # Node 端 TS 配置
├── vite.config.ts          # Vite + Vitest 配置
├── src/
│   ├── core/               # 核心逻辑（纯函数，可测试）
│   │   ├── types.ts        # 类型定义
│   │   ├── board.ts        # 棋盘操作
│   │   ├── topology.ts     # 4x4 拓扑
│   │   ├── goals.ts        # 目标判定 + 注册表
│   │   ├── generator.ts    # 关卡生成
│   │   └── rng.ts          # 种子 RNG
│   ├── levels/             # 关卡数据
│   │   └── levels.ts
│   ├── hooks/              # React hooks
│   │   └── useGame.ts
│   ├── components/         # UI 组件
│   │   └── BoardView.tsx
│   ├── App.tsx             # 应用入口
│   ├── main.tsx            # React 挂载
│   ├── index.css           # 全局样式
│   └── vite-env.d.ts
└── tests/
    ├── setup.ts            # 测试设置
    ├── core.test.ts        # 核心逻辑测试（24 项）
    └── ui.test.tsx         # UI 冒烟测试（2 项）
```

---

## 10. 运行方式

```bash
# 安装依赖
npm install

# 开发服务器
npm run dev          # → http://localhost:5173

# 类型检查
npx tsc --noEmit

# 运行测试
npm test             # 单次运行
npm run test:watch   # 监听模式

# 生产构建
npm run build

# 预览生产构建
npm run preview
```

---

*文档结束。下一轮迭代将聚焦于 P0 项（撤销、持久化、动画）与渲染层抽象。*
