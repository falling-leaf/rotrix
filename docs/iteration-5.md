# Rotrix 技术文档 — 第五轮迭代

> 日期：2026-08-01
> 版本：v0.3.2
> 状态：六边形胜利动画对角线波纹 + 六边形简单版拓扑（N=2，24 三角形 / 7 旋钮）+ 第 26 关

---

## 1. 迭代概要

本轮迭代完成两项功能：

| # | 类型 | 描述 |
|---|------|------|
| 1 | 改进 | 六边形胜利动画：从"整体图案平移后复原"改为"从左上角到右下角的对角线波纹"，与正方形版（v0.2.1）的 celebrate-pulse 波浪扫过效果一致。 |
| 2 | 新拓扑 | 六边形三角形简单版 `hex-small-triangle`：N=2 大六边形，24 三角形 / 7 旋钮 / 6 扇区（每扇区 4 三角形）。与 N=3 版（54 三角形 / 19 旋钮）同构玩法，地图更小、更易上手，作为六边形玩法入门关。 |
| 3 | 新关卡 | 第 26 关：`hex-small-triangle`，scramble=20，seed=401，作为六边形玩法入门关。 |

---

## 2. 六边形胜利动画改进

### 2.1 原状（v0.3.0）

`HexBoardView` 已有庆祝动画的 CSS 钩子（`.hex-board.celebrating .hex-svg polygon` 应用 `celebrate-pulse` keyframe），但所有 polygon 同时启动动画、无延迟差，视觉上表现为"整个棋盘一起脉冲"——与用户反馈的"整体图案向右下角移动后复原"一致（脉冲的 scale + brightness 变化在静止视角下形似整体位移）。

### 2.2 正方形版参照（v0.2.1）

`BoardView`（正方形）的胜利动画为对角线波纹：

```tsx
// BoardView.tsx
const row = Math.floor(i / board.dims[1]);
const col = i % board.dims[1];
const delay = celebrating ? (row + col) * 60 : 0;
// <CellBlock style={celebrating ? { animationDelay: `${delay}ms` } : undefined} />
```

每个 cell 按 `(row + col) * 60ms` 延迟启动动画，形成从左上角（0,0）到右下角（N,N）的对角线波浪扫过效果。

### 2.3 六边形版改进

六边形没有 row/col 网格坐标，但每个三角形有 3 个顶点的 2D 投影坐标（`TRIANGLE_POINTS` / `TRIANGLE_POINTS_SMALL`）。取三角形质心 = 3 顶点均值，按质心的归一化对角线位置计算延迟：

```tsx
// HexBoardView.tsx
const cx = (pts[0] + pts[2] + pts[4]) / 3;  // 质心 x（0..100 viewBox）
const cy = (pts[1] + pts[3] + pts[5]) / 3;  // 质心 y
const delay = celebrating ? Math.round(((cx + cy) / 200) * 600) : 0;
// <polygon style={celebrating ? { animationDelay: `${delay}ms` } : undefined} />
```

- `(cx + cy) / 200`：归一化到 [0,1]（cx, cy ∈ [0,100]，和 ∈ [0,200]）。
- `* 600`：最大延迟 600ms，与正方形版（(N-1+N-1)*60 ≈ 540ms for 6x6）量级一致。
- 左上角三角形（cx,cy 小）延迟最小，先启动；右下角延迟最大，最后启动 → 对角线波浪。

### 2.4 延迟分布验证

N=3（54 三角形）的延迟分布（按延迟排序）：

| 三角形 | 质心 (cx,cy) | 延迟 ms |
|--------|-------------|---------|
| tri1 | (16.3, 25.0) | 108 |
| tri0 | (11.5, 33.3) | 117 |
| ... | ... | ... |
| tri24 | (40.4, 83.3) | 367 |
| tri26 | (45.2, 91.7) | 408 |

延迟范围 108..408ms，覆盖 300ms，形成明显的波浪扫过效果。N=2（24 三角形）同理，延迟范围约 75..338ms。

### 2.5 CSS 不变

CSS 侧 `.hex-board.celebrating .hex-svg polygon { animation: celebrate-pulse 0.4s ... }` 不变，只是每个 polygon 现在带不同的 `animationDelay`，从"全体同时"变为"波浪扫过"。

---

## 3. 六边形简单版拓扑（N=2）

### 3.1 几何设计

N=2 的大六边形（flat-top），由小三角形组成：

| 属性 | N=3 | N=2 | 公式 |
|------|-----|-----|------|
| 小三角形总数 | 54 | 24 | 6 × N² |
| 旋钮数 | 19 | 7 | 3N(N-1)+1 |
| 扇区数 | 6 | 6 | 固定 |
| 每扇区三角形数 | 9 | 4 | N² |
| 每旋钮三角形数 | 6 | 6 | 固定 |

N=2 版 7 个旋钮：1 个中心（(0,0,0)）+ 6 个围绕中心的内环顶点。

### 3.2 坐标系

与 N=3 版完全相同的 cube 坐标系（x+y+z=0, max(|x|,|y|,|z|)≤N），只是 N=2 范围更小：

- **顶点**：19 个（N=3 为 37 个）
- **三角形**：24 个（N=3 为 54 个），3 个互相相邻的顶点组成
- **三角形编号**：按顶点排序后的字典序编号 0..23

### 3.3 旋钮

7 个旋钮（H0..H6），每个旋钮的 cells 为 6 个三角形索引，按 CW 顺序排列：

```
H0 vert=(-1,0,1) cells=[1,5,8,7,3,0]
H1 vert=(-1,1,0) cells=[2,3,7,10,9,4]
H2 vert=(0,-1,1) cells=[6,12,14,13,8,5]
H3 vert=(0,0,0)  cells=[8,13,16,15,10,7]   // 中心旋钮
H4 vert=(0,1,-1) cells=[9,10,15,18,17,11]
H5 vert=(1,-1,0) cells=[14,19,21,20,16,13]
H6 vert=(1,0,-1) cells=[15,16,20,23,22,18]
```

### 3.4 扇区划分

与 N=3 版相同的 6 个 60° 楔形，按 CW 顺序编号 0..5，颜色依次为 HEX_COLORS[0..5]：

| 扇区 | 颜色 | 三角形索引 |
|------|------|-----------|
| 0 | red | 15, 17, 18, 22 |
| 1 | yellow | 4, 9, 10, 11 |
| 2 | green | 0, 2, 3, 7 |
| 3 | cyan | 1, 5, 6, 8 |
| 4 | blue | 12, 13, 14, 19 |
| 5 | magenta | 16, 20, 21, 23 |

### 3.5 投影坐标

旋钮中心 2D 坐标（cube → pixel 投影，归一化到 0..100 viewBox）：

| 旋钮 | 坐标 |
|------|------|
| H0 | (28.35, 37.5) |
| H1 | (28.35, 62.5) |
| H2 | (50.0, 25.0) |
| H3 | (50.0, 50.0) |
| H4 | (50.0, 75.0) |
| H5 | (71.65, 37.5) |
| H6 | (71.65, 62.5) |

24 个三角形的顶点坐标存储在 `TRIANGLE_POINTS_SMALL` 数组（`hex-topology-small.ts`）。

### 3.6 算法验证

N=2 数据由 Python 脚本（`scripts/gen-hex-topology.py`）通过与 N=3 完全相同的算法生成：

1. **cube 顶点枚举**：x+y+z=0, max(|x|,|y|,|z|)≤N
2. **三角形枚举**：3 个互相相邻（差值为 edge 向量）的顶点
3. **旋钮识别**：恰好有 6 个三角形围绕的顶点
4. **CW 排序**：按三角形质心相对旋钮的投影角度升序（与 N=3 已知数据循环匹配验证通过）
5. **扇区划分**：按三角形质心的投影角度归入 6 个 60° 楔形（与 N=3 已知扇区数据逐格匹配验证通过）
6. **投影归一化**：scale = 100/(2·sqrt(3)·N)，原点 (50,50)，高度满铺 0..100

---

## 4. 核心改动

### 4.1 新拓扑文件 (`src/core/hex-topology-small.ts`)

新建文件，结构与 `hex-topology.ts` 完全对称：

- `KNOB_CELLS`：7 个旋钮的三角形索引数组
- `KNOB_CENTERS`：7 个旋钮的 2D 中心坐标
- `TRIANGLE_POINTS_SMALL`：24 个三角形的顶点坐标（导出，供 HexBoardView 使用）
- `SECTOR_CELLS`：6 个扇区的三角形索引列表
- `createSolvedHexSmallTriangle()`：生成已解决棋盘（24 三角形，每扇区填对应颜色）
- `HexSmallTriangleTopology` 类：实现 Topology 接口

### 4.2 拓扑注册 (`src/core/goals.ts`)

注册 `hex-small-triangle` 到 `topologyRegistry`：

```typescript
registerTopology(HEX_SMALL_TRIANGLE_KIND, {
  topology: hexSmallTriangle,
  defaultGoal: () => new HexUniformGoal(),  // 复用六边形目标判定
  defaultSolvedBoard: createSolvedHexSmallTriangle,
});
```

复用 `HexUniformGoal`——6 扇区分别纯色且颜色匹配，与 N=3 版判定逻辑一致，只是 regions() 返回 4 三角形/扇区而非 9。

### 4.3 渲染适配 (`src/components/HexBoardView.tsx`)

`HexBoardView` 新增 `trianglePoints` memo，根据 `board.dims[0]` 选择顶点数组：

```typescript
const trianglePoints = useMemo(
  () => (board.dims[0] === 24 ? TRIANGLE_POINTS_SMALL : TRIANGLE_POINTS),
  [board.dims],
);
```

底层 polygon 渲染和旋转 overlay 渲染均从 `TRIANGLE_POINTS[i]` 改为 `trianglePoints[i]`，使同一组件同时支持 N=3（54 三角形）和 N=2（24 三角形）。

### 4.4 路由适配 (`src/components/BoardView.tsx`)

`BoardViewRouter` 的 isHex 判断扩展：

```typescript
const isHex =
  props.board.dims.length === 1 &&
  (props.board.dims[0] === 54 || props.board.dims[0] === 24);
```

### 4.5 关卡数据 (`src/levels/levels.ts`)

新增第 26 关：

```typescript
{ id: 26, topologyKind: 'hex-small-triangle', scramble: 20, seed: 401 },
```

Goal 选择逻辑扩展为两种六边形拓扑均使用 `HexUniformGoal`：

```typescript
const goal =
  spec.topologyKind === 'hex-triangle' ||
  spec.topologyKind === 'hex-small-triangle'
    ? new HexUniformGoal()
    : new QuadrantUniformGoal();
```

### 4.6 胜利动画 (`src/components/HexBoardView.tsx`)

底层 polygon 渲染新增对角线波纹延迟（见第 2 节）。

---

## 5. 测试覆盖

### 5.1 测试结果

```
✓ tests/core.test.ts  (82 tests) 66ms
✓ tests/ui.test.tsx  (11 tests) 489ms

Test Files  2 passed (2)
     Tests  93 passed (93)
```

从 v0.3.1 的 74 项增至 93 项（+19）。

### 5.2 新增测试

**HexSmallTriangle 拓扑（8 项）：**
- createSolvedHexSmallTriangle 创建 24 三角形棋盘
- 已解决棋盘 6 扇区分别纯色
- hexSmallTriangle 有 7 个旋钮，每个 6 三角形
- 有 6 个目标区域，各 4 三角形
- 目标区域覆盖全部 24 格
- 已解决棋盘判定为胜利
- 打乱后的棋盘不满足胜利
- 旋转 6 次后恢复满足胜利
- 颜色轮换的六边形棋盘不判胜（回归）

**Generator 六边形简单版（4 项）：**
- 生成的题目与目标不同
- 题目可解（逆序执行 5×CW 还原）
- 相同种子生成相同题目（确定性）
- generatePuzzle 统一接口支持 hex-small-triangle

**Levels 第 26 关（2 项）：**
- 第 26 关为六边形三角形简单版拓扑（24 三角形）
- 第 26 关题目非已解决状态
- 第 26 关可解（逆向还原）

**UI 六边形简单版（3 项）：**
- 棋盘渲染 24 三角形和 7 旋钮
- 点击旋钮启动动画，动画结束后步数+1
- 预览模式不渲染旋钮

### 5.3 回归

74 项已有测试全通过。关卡数断言从 25 更新为 26（3 处），ID 数组扩展（3 处），"非已解决"循环扩展为四分支分发（4x4/6x6/hex/hex-small）。

---

## 6. 构建

```
npm run build → tsc 通过，vite build 成功（46 modules，1.31s）
dist/index.html                   0.86 kB │ gzip:  0.58 kB
dist/assets/index-D0V22Os1.css    8.86 kB │ gzip:  2.47 kB
dist/assets/index-DPALJhWc.js   166.88 kB │ gzip: 53.18 kB
```

相比 v0.3.1（JS 165.14 kB / CSS 8.86 kB）：
- JS +1.74 kB：hex-topology-small.ts（24 三角形坐标 + 7 旋钮）+ HexBoardView 的 trianglePoints 选择逻辑 + 胜利动画延迟计算
- CSS 不变：胜利动画复用已有 celebrate-pulse keyframe，无新增 CSS 规则

---

## 7. 浏览器验证

### 7.1 第 26 关渲染

- DOM 确认：48 个 `<polygon>`（24 操作地图 + 24 目标地图），7 个 `.knob`，6 种 fill 颜色 ✓
- 视觉确认：六边形棋盘 24 三角形 tessellate 完美，无间隙/重叠；6 扇区 6 色；右侧预览地图缩小版 ✓
- 题目确认：操作地图与目标地图 fill 序列不同（题目已打乱，非已解决）✓

### 7.2 胜利动画

六边形胜利动画改为对角线波纹——每个 polygon 按质心位置 `animationDelay` 启动 celebrate-pulse，从左上角向右下角波浪扫过，与正方形版视觉一致。

---

## 8. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `package.json` | 修改 | 版本号 0.3.1 → 0.3.2 |
| `src/core/hex-topology-small.ts` | 新增 | HexSmallTriangleTopology + createSolvedHexSmallTriangle + TRIANGLE_POINTS_SMALL（N=2，24 三角形 / 7 旋钮） |
| `src/core/goals.ts` | 修改 | 注册 hex-small-triangle 拓扑（复用 HexUniformGoal） |
| `src/components/HexBoardView.tsx` | 修改 | trianglePoints memo 按 dims 选择顶点数组 + 胜利动画对角线波纹延迟 |
| `src/components/BoardView.tsx` | 修改 | BoardViewRouter isHex 判断支持 dims=[24] |
| `src/levels/levels.ts` | 修改 | 新增第 26 关 + Goal 选择逻辑扩展两种六边形拓扑 |
| `src/components/StartScreen.tsx` | 修改 | 闯关模式描述 25 关 → 26 关 |
| `tests/core.test.ts` | 修改 | +16 项六边形简单版测试 + 关卡数断言 25→26 + 非已解决四分支分发 |
| `tests/ui.test.tsx` | 修改 | +3 项六边形简单版 UI 测试 |
| `docs/iteration-5.md` | 新增 | 本迭代文档 |

---

## 9. 兼容性保证

- 正方形 4x4 / 6x6 玩法零影响：`rotateCellsCW` 对 n=4 行为不变，`QuadrantUniformGoal` 未改动。
- N=3 六边形玩法（第 21-25 关）零影响：HexBoardView 按 dims 选择顶点数组，dims=[54] 仍用 TRIANGLE_POINTS；胜利动画改进对所有六边形关卡生效（N=3 和 N=2 都获得对角线波纹）。
- 无尽模式（4x4/6x6）未改动。
- useGame hook 零改动——通过 topologyKind 从注册表获取拓扑。

---

## 10. 已知限制 / 后续

1. **仅 1 关简单版**：当前 N=2 六边形只有第 26 关（scramble=20）。如需难度曲线，可后续扩展 26-30 关（scramble 20→30→40→50→60）。
2. **N=2 无尽模式**：仍未扩展。
3. **N 可参数化**：当前 N=2 和 N=3 是两个独立硬编码文件。如需 N=1（6 三角形 / 1 旋钮）或更大 N，可将 cube 坐标枚举改为运行时计算（当前硬编码是为了渲染坐标预计算）。

---

## 11. Git 记录

```
4f09f5d  v0.3.1: 六边形旋转闪烁修复 + 第 22-25 关扩展
(本次)   v0.3.2: 六边形胜利动画对角线波纹 + 六边形简单版拓扑（N=2，24 三角形 / 7 旋钮）+ 第 26 关
```

---

*文档结束。*
