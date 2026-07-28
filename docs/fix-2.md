# Rotrix 修复报告 #2 — v0.1.1 → v0.1.2

> 日期：2026-07-28
> 版本：v0.1.2
> 基线：v0.1.1 (commit a31d357)

---

## 1. 修复概要

本轮针对 v0.1.1 中"旋转动画无法正常加载，表现为卡顿一段时间后变为目标状态"的问题进行修复。

| # | 类型 | 描述 |
|---|------|------|
| 1 | Bug（根因） | 旋转 overlay 内色块 `.cell` 高度塌陷为 0，整个旋转层不可见——动画在播放但用户看不到，350ms 结束后提交棋盘即"跳变" |
| 2 | Bug | overlay 色块网格顺序按顺时针渲染，与 2×2 grid 的行优先 DOM 顺序不符，BL/BR 颜色对调 |
| 3 | UX | 旋转动画由 CSS keyframe 改为 requestAnimationFrame 逐帧驱动的实际图形旋转，并加入动态缩放避免出格/重叠 |
| 4 | UX | 旋转缺口的底色从透明（露出底层原始色块，造成"原始状态闪现"）改为 `var(--panel)` 中性面板色，既区分于色块又消除闪现 |

---

## 2. 现象与调试

### 2.1 现象

点击旋钮 → 停顿 ~350ms → 棋盘突然变为目标状态，看不到旋转过程。

### 2.2 调试方案与执行

采用 DOM 级取证，避免肉眼/截图的主观偏差：

1. **环境对齐**：确认本地 dev server 提供的是 v0.1.2 源码（`curl .../BoardView.tsx` 命中 `requestAnimationFrame`/`tick`/`Math.cos`），排除"看旧代码"的信息差。
2. **动画是否在跑**：用 `MutationObserver` 捕获 overlay 挂载，`getComputedStyle` 逐帧采样 `.rotate-inner.transform`。
   - 结果：transform 矩阵从 `matrix(1,0,0,1,...)` 平滑递增到接近 45° 的值——**动画确实在运行**。
   - 推论：问题不在"旋转没动"，而在"旋转的东西看不见"。
3. **决定性验证（getBoundingClientRect）**：在 overlay 挂载瞬间测 `.rot-cell .cell` 的几何尺寸。
   - 结果：4 个色块 `width=84, height=0`。
   - 结论：**色块高度塌陷为 0**，旋转层整个不可见——这就是"停顿后跳变"的根因。

### 2.3 根因分析

`.rotate-inner` 是 CSS 2×2 grid，`.rot-cell` 是 grid 项（有正确尺寸 84×84），色块 `.cell` 是 `.rot-cell` 的子元素。

`.cell` 的 CSS 规则只定义了 `border-radius` 和 `transition`，没有显式 `width/height`。在主棋盘的 `.cell-grid`（也是 grid）里，grid 项靠 `1fr` 自动拉伸，所以有尺寸；但在 `.rot-cell`（普通 div，非 grid，无 `align-items`）里，`.cell` 是无内容的块级 div，**高度塌陷为 0**。

后果：v0.1.1 的 CSS keyframe 动画、v0.1.2 初版的 rAF 动画都"白跑"——transform 在变，但旋转的是零高度的空方块。350ms 后 `onAnimationEnd` 提交棋盘，用户看到"停顿后跳变"。

> 这也解释了为什么从 v0.1.1 改到 rAF 后症状没变：根因不在动画驱动方式，而在色块可见性。

---

## 3. 修复方案

### 3.1 修复 #1：色块可见性（根因修复）

`.rot-cell` 设为 flex 容器，`.cell` 在 overlay 上下文内 `width:100%; height:100%`：

```css
.rot-cell {
  display: flex;
}
.rotate-overlay .cell {
  width: 100%;
  height: 100%;
  border-radius: 6px;
}
```

验证（浏览器 getBoundingClientRect）：修复前 `w=84,h=0` → 修复后 `w=84,h=84`，4 块全部可见。

### 3.2 修复 #2：网格顺序

`knob.cells` 是顺时针 `[TL, TR, BR, BL]`，但 CSS 2×2 grid 的 DOM 顺序是行优先 `[TL, TR, BL, BR]`。v0.1.1 按 tl/tr/br/bl 渲染导致 BL/BR 颜色对调。v0.1.2 按行优先渲染，取 `colors[0,1,3,2]`：

```tsx
<div className="rot-cell tl"><div className={`cell ${colors[0]}`} /></div>  // TL
<div className="rot-cell tr"><div className={`cell ${colors[1]}`} /></div>  // TR
<div className="rot-cell bl"><div className={`cell ${colors[3]}`} /></div>  // BL（行优先第3位）
<div className="rot-cell br"><div className={`cell ${colors[2]}`} /></div>  // BR（行优先第4位）
```

验证：overlay 挂载时 `rot-cell` DOM 顺序为 `['tl','tr','bl','br']`，颜色与底层棋盘一致（回归测试覆盖）。

### 3.3 修复 #3：requestAnimationFrame 逐帧旋转 + 动态缩放

不再用 CSS `@keyframes`，BoardView 用 `useState` 维护 `angle`，`useEffect`+`requestAnimationFrame` 逐帧驱动：

- 时长 350ms，缓动 `ease-out cubic`（`1-(1-t)³`）。
- 目标角度：CW=+90°，CCW=−90°（为后续 CCW 旋钮预留）。
- 到 90° 后调用 `onAnimationEnd`，由上层 `useGame` 提交棋盘。

**动态缩放避免出格/重叠**：旋转正方形 θ 角时外接矩形边长 = `side·(cosθ+sinθ)`。令外接矩形=原边界框，缩放因子：

```
scale(θ) = 1 / (cosθ + sinθ)
```

- θ=0°/90°：scale=1；θ=45°：scale=1/√2≈0.707（内切菱形）。
- 全程旋转正方形始终内切于 2×2 边界框，不出格、不与相邻色块重叠。
- 叠加 `.rotate-overlay { overflow: hidden }` 作为亚像素兜底。

```tsx
const rad = (angle * Math.PI) / 180;
const scale = 1 / (Math.cos(rad) + Math.sin(rad));
// <div className="rotate-inner" style={{ transform: `rotate(${angle}deg) scale(${scale})` }} />
```

CSS 侧移除 `@keyframes rotate-cw` 与 `.rotate-inner` 的 `animation` 属性，`transform` 由 JS 内联。

### 3.4 防连点与生命周期

- 防连点：`useGame.handleKnobClick` 在 `animatingRef.current` 非空时 return（v0.1.1 已有）。
- rAF 生命周期：`useEffect` cleanup 取消未完成的 `requestAnimationFrame`；`reset` 清 `animating` → overlay 卸载 → cleanup 触发，无泄漏。

### 3.5 修复 #4：旋转结束闪现原始状态（CSS transition 根因）

**现象（用户反馈）**：旋转过程能看到 3 个状态——旋转 → 闪现原始状态 → 变为目标状态。要求去掉中间的"原始状态闪现"。

**代码逻辑推理**：

旋转结束到最终状态确定之间发生的事（BoardView.tsx, useGame.ts, index.css）：

1. rAF tick 在 progress=1 时调 `onAnimationEnd`，useGame 执行 `setBoard(next)` + `setAnimating(null)`，React 18 批处理成一次 render：overlay 卸载 + cell-grid 用新 board 渲染。
2. **真正的根因在 index.css**：`.cell { transition: background-color 0.15s ease; }`。当 board commit、cell class 从 red 变 blue 时，`.cell` 的背景色不是立即跳变，而是用 150ms 渐变。overlay 在同一 commit 被移除，移除瞬间底层 cell 仍是原始色（渐变刚开始），用户看到的"一瞬间原始状态"就是这 150ms 渐变的起始帧。
3. 之前的两处辅助修复（消除 useGame 嵌套 setState、BoardView settle 3 帧）虽然让 overlay 在 90° 多停留到 commit 完成，但 cell 的 transition 仍让底层在 overlay 移除后渐变——直到本处禁用 transition 才彻底消除。

**修复**：

- **index.css**：`.board.animating .cell { transition: none; }`——旋转动画提交棋盘时禁用 cell 的 background-color 过渡，让 cell 在 commit 帧立即变目标色。
- **BoardView.tsx**：`.board` 加 `animating` class（`animating || keepAnimating`）；新增 `keepAnimating` 状态，在 `animating` 清除后再保持 ~30ms（`setTimeout`），确保 commit 落到 DOM 且 cell 已是目标色后，才恢复 transition。恢复 transition 时底层已是目标色，不触发任何渐变。

```css
.cell { transition: background-color 0.15s ease; }
.board.animating .cell { transition: none; }   /* 旋转提交瞬时变色 */
```

```tsx
<div className={`board ${animating || keepAnimating ? 'animating' : ''}`}>
// keepAnimating：rotateOverlay 变 null 后 setTimeout 30ms 清除
```

**辅助修复（降低 commit 间隙风险）**：

- **useGame.ts**：原 `setBoard(prev => {...; setWon(true); ...})` 的 setWon 嵌套在 updater 内，违反 React 纯函数 updater 规则。改为先用闭包 `board` 计算 `next` 与胜利判定，顶层独立 `setBoard(next)` / `setWon(true)`。
- **BoardView.tsx**：rAF 到达目标角度后停留 3 帧（SETTLE_FRAMES≈50ms）再调 onAnimationEnd，让 board commit 充分落到 DOM。

**审美选择（旋转缺口底色）**：`.rotate-overlay { background: var(--panel); }`（#16213e，与棋盘正常格子间隙同色），而非引入第七种区分色——旋转缺口与静止棋盘缝隙视觉连贯，与四色对比度均足够。

验证（浏览器采样）：点击后 `.board` 加 `animating` class、cell transition 立即变 `none`；~400ms 后（350 旋转 + 30 保持）class 移除、transition 恢复 `0.15s`——此时 cell 已是目标色，无渐变触发。中间无原始色 150ms 渐变 ✓。

---

## 4. 验证

### 4.1 浏览器 DOM 级验证

| 项 | 修复前 | 修复后 |
|---|--------|--------|
| `.cell` 高度 | 0 | 84 |
| `.rot-cell` 尺寸 | 84×84 | 84×84 |
| `transform` 逐帧 | 平滑递增 | 平滑递增 |
| overlay `rot-cell` 顺序 | — | `['tl','tr','bl','br']` ✓ |
| overlay 缺口底色 | 透明（露原始色块） | `var(--panel)` #16213e ✓ |
| 旋转中底层是否可见 | 是（闪现原始） | 否（面板色遮蔽） ✓ |
| 动画结束 | overlay 移除、棋盘更新、步数+1 | 同左 ✓ |

### 4.2 出格/重叠

`scale=1/(cosθ+sinθ)` 对 θ∈[0°,90°] 恒有 1≥scale≥1/√2，旋转正方形外接矩形边长恒 ≤ 原边界框，数学上保证不出格、不重叠。

### 4.3 单元测试

```
✓ tests/core.test.ts  (24 tests) 29ms
✓ tests/ui.test.tsx   (4 tests)  234ms

Test Files  2 passed (2)
     Tests  28 passed (28)
```

新增 1 项回归测试：`旋转 overlay 挂载时按行优先顺序（TL,TR,BL,BR）正确放置色块`，防止网格顺序再次错位。

> 注：色块高度塌陷属布局问题，jsdom 不加载 CSS、不做布局，无法用 `getBoundingClientRect` 复现，故未加单元测试，改由浏览器 DOM 级测量验证。

### 4.4 构建

```
npm run build → tsc 通过，vite build 成功（41 modules，1.25s）
```

---

## 5. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `package.json` | 修改 | 版本号 0.1.1 → 0.1.2 |
| `src/components/BoardView.tsx` | 重写 | rAF 逐帧旋转 + 动态缩放 + 网格顺序修复 + settle 3 帧 + keepAnimating 禁用 cell transition |
| `src/hooks/useGame.ts` | 修改 | 消除 setBoard updater 内嵌套 setState，顶层独立 setBoard/setWon |
| `src/index.css` | 修改 | 色块塌陷修复 + 移除 keyframe + overlay overflow + 缺口底色 `var(--panel)` + `.board.animating .cell { transition:none }` |
| `tests/ui.test.tsx` | 修改 | 新增 overlay 网格顺序回归测试 |
| `docs/fix-2.md` | 新增 | 本修复报告 |

---

## 6. 遗留问题

1. **rAF 在 jsdom 中不可靠**：单元测试仍手动调 `onAnimationEnd()` 模拟动画结束，未覆盖逐帧 transform 中间值。
2. **动画期间底层棋盘不可见**：overlay 覆盖原 2×2 区域（有意设计，避免新旧色块重叠的视觉混乱）。因 3.3 缩放 + 3.5 面板底色，旋转缺口显示为面板色而非原始色块。
3. **无撤销功能 / 无通关进度持久化**：留待后续迭代。

---

## 7. Git 记录

```
a31d357  v0.1.1: 修复步数bug + 目标地图预览 + 旋转动画
(本次)    v0.1.2: 修复旋转动画（色块高度塌陷 + 网格顺序 + rAF逐帧旋转 + 动态缩放防出格 + 禁用cell transition消除原始态闪烁）
```

---

*修复报告结束。*
