# Rotrix 技术文档 — 第四轮迭代

> 日期：2026-07-31
> 版本：v0.3.0
> 状态：六边形三角形玩法上线

---

## 1. 迭代概要

本轮迭代引入全新的**六边形三角形拓扑**：将正方形 2x2 旋钮旋转扩展为六边形 6 三角形旋钮旋转。地图为边长 3 的大六边形，由 54 个小三角形组成，6 个大三角形扇区（各 9 个小三角形）围绕中心排列。19 个旋钮位于 6 三角形交汇的顶点。

| # | 类型 | 描述 |
|---|------|------|
| 1 | 新拓扑 | 六边形三角形拓扑 `hex-triangle`：54 三角形 / 19 旋钮 / 6 扇区 |
| 2 | 新目标 | `HexUniformGoal`：6 扇区分别纯色，且颜色与目标位置一致 |
| 3 | 通用化 | `rotateCellsCW/CCW` 支持 n=4 与 n=6；`effectiveMoves` 按旋钮大小自动取模 |
| 4 | 新关卡 | 第 21 关：六边形三角形，scramble=40，seed=301 |
| 5 | 扩展 | Color 类型新增 cyan/magenta；HEX_COLORS 6 色数组 |

---

## 2. 几何设计

### 2.1 六边形结构

边长 N=3 的六边形（flat-top），由小三角形组成：

| 属性 | 值 | 说明 |
|------|-----|------|
| 小三角形总数 | 54 | = 6 × N² = 6 × 9 |
| 旋钮数 | 19 | = 3N(N-1)+1 = 3×3×2+1 |
| 扇区数 | 6 | 每个扇区是一个大三角形 |
| 每扇区三角形数 | 9 | = N² = 3² |
| 每旋钮三角形数 | 6 | 6 三角形围绕一个顶点 |

### 2.2 坐标系

使用 cube 坐标 (x, y, z)，约束 x+y+z=0，max(|x|,|y|,|z|) ≤ 3。

- **顶点**：37 个，满足上述约束的整数三元组
- **三角形**：3 个互相相邻的顶点（差值为一个 edge 向量）组成的 frozenset
- **edge 向量**：e1=(1,-1,0), e2=(1,0,-1), e3=(0,1,-1) 及其反向
- **三角形编号**：按顶点排序后的字典序编号 0..53

### 2.3 扇区划分

6 条从中心 (0,0,0) 出发的射线沿 cube 方向将六边形分为 6 个 60° 楔形。每个楔形是一个大三角形（顶点在中心，底边为六边形的一条外边）。扇区按 CW 顺序编号 0..5：

| 扇区 | 颜色 | 三角形索引 |
|------|------|-----------|
| 0 | red | 32,34,35,36,37,43,45,46,52 |
| 1 | yellow | 6,13,14,15,22,23,24,25,26 |
| 2 | green | 0,2,3,4,5,9,11,12,20 |
| 3 | cyan | 1,7,8,10,16,17,18,19,21 |
| 4 | blue | 27,28,29,30,31,38,39,40,47 |
| 5 | magenta | 33,41,42,44,48,49,50,51,53 |

### 2.4 旋钮

19 个旋钮（H0..H18），每个旋钮的 cells 为 6 个三角形索引，按 CW 顺序排列。中心旋钮 H9 位于 (0,0,0)，其 6 三角形索引为 [21,30,33,32,23,20]。

旋钮中心 2D 坐标（cube → pixel 投影 `[x, (y-z)/2]`）用于渲染定位。

---

## 3. 核心改动

### 3.1 类型扩展 (`src/core/types.ts`)

Color 类型新增 `'cyan'` 和 `'magenta'`：

```typescript
export type Color = 'red' | 'yellow' | 'blue' | 'green' | 'cyan' | 'magenta';
```

新增 `HEX_COLORS` 6 色数组，顺序对应 6 扇区 [TL, TR, BL, BR] 的扩展。

Knob.cells 注释更新为"长度为 4 或 6"。

### 3.2 旋转通用化 (`src/core/board.ts`)

`rotateCellsCW` / `rotateCellsCCW` 从硬编码 n=4 改为通用循环：

```typescript
export function rotateCellsCW(cells: Cell[]): Cell[] {
  const n = cells.length;
  if (n !== 4 && n !== 6) return cells;
  const result: Cell[] = [];
  for (let i = 0; i < n; i++) {
    result.push(cells[(i + n - 1) % n]);
  }
  return result;
}
```

CW: `new[i] = old[(i + n - 1) % n]`，对 n=4 和 n=6 均正确。

### 3.3 六边形拓扑 (`src/core/hex-topology.ts`)

新建文件，包含：
- `KNOB_CELLS`：19 个旋钮的三角形索引数组（硬编码，由 cube 坐标枚举预计算）
- `KNOB_CENTERS`：19 个旋钮的 2D 中心坐标
- `SECTOR_CELLS`：6 个扇区的三角形索引列表
- `createSolvedHexTriangle()`：生成已解决棋盘（54 三角形，每扇区填对应颜色）
- `HexTriangleTopology` 类：实现 Topology 接口

### 3.4 目标判定 (`src/core/goals.ts`)

新增 `HexUniformGoal`，逻辑与 `QuadrantUniformGoal` 同理：

```typescript
satisfied(board, topology): boolean {
  const regions = topology.regions();
  if (regions.length !== HEX_COLORS.length) return false;
  for (let i = 0; i < regions.length; i++) {
    const expected = HEX_COLORS[i];
    for (const idx of regions[i].cells) {
      if (board.cells[idx]?.color !== expected) return false;
    }
  }
  return true;
}
```

注册六边形拓扑到 `topologyRegistry`。

### 3.5 有效步数 (`src/core/generator.ts`)

`effectiveMoves` 从硬编码 `% 4` 改为按旋钮大小自动取模：

```typescript
function effectiveMoves(moves: Move[], knobs: Knob[]): Move[] {
  const knobMap = new Map(knobs.map((k) => [k.id, k]));
  // ... 按 n = knob.cells.length 取模
}
```

### 3.6 关卡数据 (`src/levels/levels.ts`)

新增第 21 关：`{ id: 21, topologyKind: 'hex-triangle', scramble: 40, seed: 301 }`。根据拓扑类型选择对应的 Goal 实例。

---

## 4. 第 21 关验证

### 4.1 生成参数

| 参数 | 值 |
|------|-----|
| 拓扑 | hex-triangle |
| 打乱步数 | 40 |
| 种子 | 301 |
| 有效难度 | 40 |

### 4.2 可解性验证

- **正向**：从 solved 棋盘执行 40 步 CW → 得到题目棋盘 ✓
- **逆向**：从题目棋盘逆向执行（每步 5 次 CW = 1 次 CCW）→ 还原为 solved ✓

### 4.3 题目棋盘

54 个三角形的颜色排列（按索引 0..53）：

```
扇区 0 (red):    [0]gre [1]cya [2]gre [3]gre [4]yel [5]yel [6]gre [7]cya [8]cya
扇区 1 (yellow): [9]gre [10]yel [11]gre [12]mag [13]gre [14]blu [15]yel [16]cya [17]blu
扇区 2 (green):  [18]gre [19]gre [20]red [21]mag [22]red [23]yel [24]red [25]red [26]red
扇区 3 (cyan):   [27]cya [28]blu [29]blu [30]cya [31]blu [32]mag [33]blu [34]yel [35]mag
扇区 4 (blue):   [36]red [37]red [38]cya [39]cya [40]cya [41]mag [42]blu [43]yel [44]red
扇区 5 (magenta):[45]yel [46]yel [47]blu [48]blu [49]mag [50]red [51]mag [52]mag [53]mag
```

正确位置 21/54 (38%)，错误位置 33/54。

### 4.4 解法

40 步 CW 旋转序列（H0..H18 对应 19 个旋钮）：

```
步 1: H12  步 2: H6   步 3: H8   步 4: H7   步 5: H3
步 6: H13  步 7: H8   步 8: H7   步 9: H17  步 10: H10
步 11: H18 步 12: H11 步 13: H11 步 14: H8  步 15: H18
步 16: H4  步 17: H2  步 18: H7  步 19: H12 步 20: H2
步 21: H1  步 22: H13 步 23: H1  步 24: H15 步 25: H10
步 26: H7  步 27: H15 步 28: H4  步 29: H12 步 30: H10
步 31: H12 步 32: H1  步 33: H8  步 34: H15 步 35: H10
步 36: H4  步 37: H11 步 38: H15 步 39: H9  步 40: H2
```

---

## 5. 测试覆盖

### 5.1 测试结果

```
✓ tests/core.test.ts  (65 tests) 88ms
✓ tests/ui.test.tsx   (8 tests)  843ms

Test Files  2 passed (2)
     Tests  73 passed (73)
```

### 5.2 新增测试（+20 项）

**HexTriangle 拓扑（8 项）：**
- createSolvedHexTriangle 创建 54 三角形棋盘
- 已解决棋盘 6 扇区分别纯色
- hexTriangle 有 19 个旋钮，每个 6 三角形
- 有 6 个目标区域，各 9 三角形
- 目标区域覆盖全部 54 格
- 已解决棋盘判定为胜利
- 打乱后的棋盘不满足胜利
- 旋转 6 次后恢复满足胜利
- 颜色轮换的六边形棋盘不判胜（v0.2.4 fix 回归）

**Generator 六边形（4 项）：**
- 生成的题目与目标不同
- 题目可解（逆序执行 5×CW 还原）
- 相同种子生成相同题目
- generatePuzzle 统一接口支持 hex-triangle

**Levels 六边形（4 项）：**
- 生成 21 个关卡
- 第 21 关为六边形三角形拓扑
- 第 21 关题目非已解决状态
- 第 21 关可解（逆向还原）

**UI 六边形（3 项）：**
- 六边形棋盘渲染 54 三角形和 19 旋钮
- 点击旋钮启动动画，动画结束后步数+1
- 预览模式不渲染旋钮

### 5.3 回归

53 项已有测试全通过（含 v0.2.4 胜利判定修复的回归测试），正方形 4x4/6x6 玩法零影响。

---

## 6. 构建

```
npm run build → tsc 通过，vite build 成功（45 modules，1.48s）
dist/assets/index-h1w9ZRTb.js   164.91 kB │ gzip: 52.63 kB
dist/assets/index-B5PDqCuC.css    8.81 kB │ gzip:  2.47 kB
```

相比 v0.2.4（JS 158.74 kB / CSS 8.51 kB）：
- JS +6.17 kB：hex-topology.ts + HexBoardView.tsx（含旋转动画）+ HexUniformGoal + 类型扩展
- CSS +0.30 kB：六边形样式 + cyan/magenta 色变量

---

## 7. 六边形棋盘渲染

### 7.1 SVG polygon 方案

六边形棋盘使用 SVG 而非 CSS grid 渲染。54 个小三角形各为一个 `<polygon>`，顶点坐标由 cube 坐标经 pointy-top 投影预计算为 0..100 viewBox 百分比。

```
cube 顶点 (x,y,z) → 2D 像素 (1.5*x, sqrt(3)/2*(y-z))
                  → 归一化到 0..100 viewBox
```

`TRIANGLE_POINTS` 数组存储 54 个三角形的 3 顶点坐标（6 个数字/三角形），在 `hex-topology.ts` 中导出。

### 7.2 HexBoardView 组件

`src/components/HexBoardView.tsx`：
- `<svg viewBox="0 0 100 100">` 内渲染 54 个 `<polygon>`
- 每个 polygon 的 fill 为 `COLOR_HEX[color]`（6 色十六进制映射）
- 旋钮层与正方形版共用 `.knob` CSS，位置按 `center[0]%` / `center[1]%` 绝对定位
- 预览模式（目标地图）隐藏旋钮层
- **旋转动画**：与正方形版同模式的 rAF 逐帧驱动
  - 点击旋钮 → `animating` 置位 → 计算 `rotateOverlay`（6 个三角形索引 + 颜色 + 旋钮中心坐标）
  - SVG `<g>` 元素围绕 `transformOrigin: cx% cy%` 旋转，目标角度 CW=+60°
  - 旋转期间底层 6 个三角形 `opacity: 0`（由 overlay 覆盖）
  - 到达目标角度后停留 3 帧（SETTLE_FRAMES）再调 `onAnimationEnd`
  - `keepAnimating` 机制防止 transition 恢复时闪现原始色

### 7.3 BoardViewRouter 路由

`BoardView.tsx` 导出 `BoardViewRouter`，根据 `board.dims` 分发：
- `dims=[54]` → `HexBoardView`（六边形三角形）
- 其余 → `BoardView`（正方形 grid）

`App.tsx` 和 `EndlessScreen.tsx` 将 `BoardView` 导入改为 `BoardViewRouter as BoardView`，对调用方透明。

### 7.4 浏览器验证

- 操作地图：340x340px，54 个三角形，19 个旋钮，6 色可见 ✓
- 目标地图：170x170px，54 个三角形，无旋钮 ✓
- DOM 确认：108 个 `<polygon>`（54+54），19 个 `.knob`，6 种 fill 颜色 ✓

### 7.5 单元测试验证

UI 测试使用 `@testing-library/react` 的 `fireEvent.click` 触发 React 合成事件（browser_click 无法触发 React 事件），验证完整动画流程：
- 点击旋钮 H0 → `animating` 不为空 ✓
- 调用 `onAnimationEnd` → 步数 +1，`animating` 清除 ✓
- 预览模式无旋钮，54 个 polygon 可见 ✓

---

## 7. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `package.json` | 修改 | 版本号 0.2.4 → 0.3.0 |
| `src/core/types.ts` | 修改 | Color 新增 cyan/magenta；HEX_COLORS 6 色数组；Knob.cells 注释 |
| `src/core/board.ts` | 修改 | rotateCellsCW/CCW 通用化支持 n=4 和 n=6 |
| `src/core/hex-topology.ts` | 新增 | HexTriangleTopology + createSolvedHexTriangle + TRIANGLE_POINTS |
| `src/core/goals.ts` | 修改 | 新增 HexUniformGoal + 注册 hex-triangle 拓扑 |
| `src/core/generator.ts` | 修改 | effectiveMoves 按旋钮大小自动取模 |
| `src/levels/levels.ts` | 修改 | 新增第 21 关 + Goal 选择逻辑 |
| `src/components/HexBoardView.tsx` | 新增 | SVG polygon 六边形棋盘渲染器 |
| `src/components/BoardView.tsx` | 修改 | 导出 BoardViewRouter，按 dims 路由到 HexBoardView |
| `src/App.tsx` | 修改 | BoardView → BoardViewRouter |
| `src/components/EndlessScreen.tsx` | 修改 | BoardView → BoardViewRouter |
| `src/index.css` | 修改 | 新增 cyan/magenta 色变量 + hex-board 样式 |
| `tests/core.test.ts` | 修改 | +17 项六边形测试 + 关卡数断言更新 |
| `docs/iteration-4.md` | 新增 | 本迭代文档 |

---

## 8. 兼容性保证

- 正方形 4x4 / 6x6 玩法零影响：rotateCellsCW 对 n=4 行为不变（`(i+3)%4` = 原逻辑）
- QuadrantUniformGoal 未改动，4x4/6x6 胜利判定不变
- 无尽模式（4x4/6x6）未改动
- useGame hook 零改动——通过 topologyKind 从注册表获取拓扑
- BoardView 暂未适配六边形渲染（当前仅逻辑层 + 测试层就绪）

---

## 9. 已知限制

1. **无尽模式未扩展**：六边形无尽模式尚未添加（需 StartScreen 新增入口 + EndlessConfig 扩展）。
2. **browser_click 测试局限**：浏览器自动化工具的 `browser_click` 无法触发 React 合成事件，因此无法在浏览器中自动化验证点击交互。旋转动画通过 `@testing-library/react` 的 `fireEvent.click` 单元测试验证。

---

## 10. Git 记录

```
248a8b4  v0.2.3: 初始界面 + 无尽模式
(上轮)   v0.2.4: 胜利判定修复
(本次)   v0.3.0: 六边形三角形拓扑（54 三角形 / 19 旋钮 / 6 扇区 + 第 21 关）
```

---

*文档结束。下一轮迭代将聚焦于六边形棋盘的 UI 渲染适配。*
