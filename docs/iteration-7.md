# iteration-7: 图案玩法（第31-32关）

> 基线：v0.4.1 (commit 902d2be)

## 背景

v0.4.1 将骰子关移至第50关后，31-49 关预留空。本次迭代开始填充 31-40 关，
引入全新的"图案玩法"——基于正方形网格，目标地图为手工设计的像素图案
（4-8 色构成的可辨识图形），胜利判定改为"拼成目标地图即可"。

本次先实现第 31、32 关。

## 新增功能

### 1. PictureGoal — 图案目标判定

**`src/core/goals.ts`**

新增 `PictureGoal` 类，持有 solvedBoard，逐格校验颜色一致即胜利：
- 不要求象限纯色
- 不校验 number
- 纯粹拼图还原——最通用的 Goal 实现

同时注册拓扑 `square-6x6-picture`（复用 square6x6 拓扑）。

### 2. generatePicturePuzzle — 图案题目生成接口

**`src/core/generator.ts`**

新增 `generatePicturePuzzle(topologyKind, solved, scramble, seed)`，
接受自定义 solvedBoard（像素图案），从图案出发执行 N 次随机旋转得到题目。
与 `generatePuzzle` 的区别仅在于 solved 来源：后者从注册表默认获取，
前者由调用方传入。

### 3. 像素图案工厂

**`src/core/board.ts`**

- `createSolvedPicture31()` — 6x6 同心方框（5 色：品红/红/黄/蓝/绿）
- `createSolvedPicture32()` — 6x6 螺旋回字（4 色：红/绿/黄/蓝）

两个图案的设计要点：每个 2x2 旋钮覆盖的 4 格不全同色，
保证 25 个旋钮旋转均有效。

### 4. Level.solvedBoard — 可选目标棋盘字段

**`src/core/types.ts`**

`Level` 接口新增可选 `solvedBoard?: Board`。图案关卡携带目标棋盘供
App 预览渲染；非图案关卡为 undefined，App 从注册表 defaultSolvedBoard 获取。

**`src/App.tsx`**

预览棋盘优先用 `level.solvedBoard`，否则 fallback 到注册表默认。

### 5. 第 31、32 关

**`src/levels/levels.ts`**

- 第 31 关：square-6x6-picture，scramble=20，seed=601（同心方框）
- 第 32 关：square-6x6-picture，scramble=28，seed=602（螺旋回字）

关卡总数 31→33（1-30 + 31 + 32 + 50）。

## 图案设计

### 第 31 关：同心方框

```
magenta magenta magenta magenta magenta magenta
magenta red     red     red     red     magenta
magenta red     yellow  yellow  red     magenta
magenta red     yellow  blue    red     magenta   ← 内 2x2 对角分色
magenta red     red     red     red     magenta
magenta magenta magenta magenta magenta magenta
```

### 第 32 关：螺旋回字

```
red    red    red    red    red    red
red    green  green  green  green  red
red    green  yellow yellow green  red   ← 内 2x2 对角分色
red    green  yellow blue   green  red
red    green  green  green  green  red
red    red    red    red    red    red
```

## 测试

**`tests/core.test.ts`**

- 新增 `Picture - 图案玩法` describe 块（9 个测试）
- 更新 3 处关卡数 31→33
- 更新 3 处 ID 数组
- 骰子关索引 levels[30]→levels[32]
- 遍历测试补 `square-6x6-picture` 分支

总计 134 测试全过（+9）。

## 验证

```
npm test  → 134 tests pass
npm run build → tsc + vite build 成功
```

## 文件

- `src/core/board.ts` — createSolvedPicture31/32
- `src/core/generator.ts` — generatePicturePuzzle
- `src/core/goals.ts` — PictureGoal + 拓扑注册
- `src/core/types.ts` — Level.solvedBoard
- `src/levels/levels.ts` — 第 31-32 关
- `src/App.tsx` — 预览棋盘 fallback
- `tests/core.test.ts` — 测试更新
- `package.json` — 版本 0.4.1 → 0.4.2
