# Rotrix 修复报告 #6 — v0.2.3 → v0.2.4

> 日期：2026-07-31
> 版本：v0.2.4
> 基线：v0.2.3 (commit 248a8b4)

---

## 1. 修复概要

本轮针对胜利判定逻辑的一处误判 bug 进行修复，共 1 项：

| # | 类型 | 描述 |
|---|------|------|
| 1 | bug | 胜利判定仅检查"每象限内部纯色"，未校验颜色与目标位置匹配；导致"四象限各自纯色但颜色整体轮换"（如左上黄/右上红/左下绿/右下蓝）被误判为通关。现改为逐象限校验期望颜色，等价于"操作地图与目标地图完全一致"。 |

---

## 2. Bug 分析

### 2.1 复现

目标棋盘（createSolvedSquare4x4）的象限配色为：

```
TL=red    TR=yellow
BL=blue   BR=green
```

但游戏中存在一类操作结果：四个 2×2 象限内部各自纯色，但颜色与目标位置不符，例如：

```
TL=yellow  TR=red
BL=green   BR=blue
```

即"颜色在四个象限间整体轮换"。此种状态原先会被 `QuadrantUniformGoal.satisfied()` 判定为胜利，玩家直接通关——与"操作地图必须与目标地图完全一致"的游戏规则相悖。

### 2.2 根因

`src/core/goals.ts` 中 `QuadrantUniformGoal.satisfied()` 原实现：

```typescript
satisfied(board: Board, topology: Topology): boolean {
  const regions = topology.regions();
  for (const region of regions) {
    const first = board.cells[region.cells[0]]?.color;
    if (!first) return false;
    for (const idx of region.cells) {
      if (board.cells[idx]?.color !== first) return false;
    }
  }
  return true;
}
```

逻辑只检查"每个 region 内部 4 格颜色相同"——即"象限内部统一"。它不关心 region 内部统一成的是哪一种颜色，于是颜色轮换（TL 全黄、TR 全红…）同样满足"内部统一"，被误判为胜利。

### 2.3 设计漏洞

`ALL_COLORS = ['red','yellow','blue','green']` 在 `types.ts` 中已注明"顺序即目标象限的默认分配顺序（TL, TR, BL, BR）"，且 `topology.regions()` 返回顺序也是 `[TL, TR, BL, BR]`。两者天然存在一一对应：region[i] 必须全部为 `ALL_COLORS[i]`。但原 `satisfied()` 完全没用到 `ALL_COLORS`，丢弃了这一约束。

---

## 3. 修复方案

### 3.1 改动

`src/core/goals.ts` — `QuadrantUniformGoal.satisfied()`：

```typescript
satisfied(board: Board, topology: Topology): boolean {
  const regions = topology.regions();
  if (regions.length !== ALL_COLORS.length) return false;
  for (let i = 0; i < regions.length; i++) {
    const expected = ALL_COLORS[i];
    for (const idx of regions[i].cells) {
      if (board.cells[idx]?.color !== expected) return false;
    }
  }
  return true;
}
```

逐象限校验 `ALL_COLORS[i]` 的期望颜色：region 0 (TL) 必须全 red，region 1 (TR) 必须全 yellow，region 2 (BL) 必须全 blue，region 3 (BR) 必须全 green。这等价于"操作棋盘与目标棋盘逐格颜色一致"，因为目标棋盘 `createSolvedSquare4x4` / `createSolvedSquare6x6` 本身就是按 `ALL_COLORS` 着色的。

### 3.2 影响范围

- 判定逻辑：`QuadrantUniformGoal` 是当前 4x4 / 6x6 两个拓扑注册时使用的唯一 Goal，改动对两种网格同时生效。
- 调用点：`useGame.onAnimationEnd` 在每次旋转后调用 `level.goal.satisfied(next, topology)`，即"旋转动画结束后判定"。修改后的语义更严格——玩家必须把操作地图还原到与目标地图逐格一致才会通关。
- UI 层：无需改动。`App.tsx` / `EndlessScreen.tsx` 只读取 `game.won` 布尔值，判定逻辑封装在 hook 内。

---

## 4. 回归测试

### 4.1 新增用例

`tests/core.test.ts` 新增 3 项回归测试（4x4 两条 + 6x6 一条），专门针对"颜色轮换"误判：

1. **颜色轮换的棋盘不判胜（4x4）**：构造 TL=yellow / TR=red / BL=green / BR=blue，四象限各自纯色但颜色与目标不符，断言 `satisfied() === false`。
2. **只有目标地图完全一致才判胜（4x4）**：solved board 判 true；任意改一格颜色判 false。
3. **颜色轮换的 6x6 棋盘不判胜**：对 6x6 拓扑做同样构造，确保 6x6 也修复。

### 4.2 已有用例回归

所有 50 条已有测试全通过（其中"打乱后的棋盘不满足胜利"用例覆盖了非纯色情形，"旋转 4 次后恢复满足胜利"覆盖了正常通关路径，二者均无回归）。

### 4.3 测试结果

```
✓ tests/core.test.ts  (48 tests) 75ms
✓ tests/ui.test.tsx   (5 tests)  483ms

Test Files  2 passed (2)
     Tests  53 passed (53)
```

从 v0.2.3 的 50 项增至 53 项（+3，均为本轮新增的颜色轮换回归测试）。

---

## 5. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/core/goals.ts` | 修改 | `QuadrantUniformGoal.satisfied()` 改为逐象限校验 `ALL_COLORS[i]` 期望颜色 |
| `tests/core.test.ts` | 修改 | 新增 3 项颜色轮换回归测试（4x4 两条 + 6x6 一条） |
| `package.json` | 修改 | 版本号 0.2.3 → 0.2.4 |
| `docs/fix-6.md` | 新增 | 本修复报告 |

---

## 6. Git 记录

```
248a8b4  v0.2.3: 初始界面 + 无尽模式（随机题目生成 + 通关计数 + localStorage持久化 + 修复无尽模式无限通关bug）
(本次)    v0.2.4: 胜利判定修复（四象限各自纯色但颜色轮换不再误判为通关）
```

---

*修复报告结束。*
