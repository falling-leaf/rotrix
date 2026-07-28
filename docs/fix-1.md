# Rotrix 修复报告 #1 — v0.1.0 → v0.1.1

> 日期：2026-07-28
> 版本：v0.1.1
> 基线：v0.1.0 (commit 0066fa0)

---

## 1. 修复概要

本轮针对 v0.1.0 迭代中发现的问题进行修复，共 3 项：

| # | 类型 | 描述 |
|---|------|------|
| 1 | Bug | 步数显示错误：点击一次旋钮步数 +2 |
| 2 | UI | 去除操作地图下方文字说明，改为右侧目标地图预览 |
| 3 | UX | 旋转动画效果不明显，改为动态旋转过程 |

---

## 2. Bug #1：步数 +2

### 2.1 现象

点击一次旋钮，步数计数器增加 2 而非 1。

### 2.2 根因

原实现 `useGame.ts` 的 `handleKnobClick` 中，`setHistory` 被嵌套在 `setBoard` 的 updater 函数体内：

```typescript
// 原代码（有bug）
const handleKnobClick = useCallback((knob: Knob) => {
  setBoard((prev) => {
    const next = applyMove(prev, knob, 'CW');
    setHistory((h) => [...h, move]);  // ← 嵌套在 updater 内
    if (level.goal.satisfied(next, topology)) {
      setWon(true);                  // ← 嵌套在 updater 内
    }
    return next;
  });
}, [level, topology]);
```

**React 18 StrictMode** 在开发模式下会双调用 state updater 函数以检测副作用。`setBoard` 的 updater 被调用两次，导致其 body 内的 `setHistory` 也被派发两次 → 步数 +2。

### 2.3 修复方案

将所有 state setter 从 `setBoard` updater body 中移出，改为在顶层独立调用。同时引入 `useRef` 存储动画状态，避免动画流程中的 setState 嵌套：

```typescript
// 修复后
const animatingRef = useRef<AnimationState | null>(null);

const onAnimationEnd = useCallback(() => {
  const current = animatingRef.current;
  if (!current) return;
  animatingRef.current = null;

  const { knob, direction } = current;
  const move: Move = { knobId: knob.id, direction };

  // setBoard updater 是纯函数，StrictMode 双调用无副作用
  // setWon 幂等（true → true），放在 updater 内安全
  setBoard((prev) => {
    const next = applyMove(prev, knob, direction);
    if (level.goal.satisfied(next, topology)) setWon(true);
    return next;
  });

  // 顶层独立调用，StrictMode 不双调事件处理器
  setHistory((h) => [...h, move]);
  setMoveCount((c) => c + 1);
  setAnimating(null);
}, [level, topology]);
```

### 2.4 验证

- 浏览器手动测试：点击1次 → 步数=1，点击2次 → 步数=2 ✓
- 单元测试新增断言：`expect(capturedGame!.moveCount).toBe(movesBefore + 1)` ✓

---

## 3. UI #2：目标地图预览

### 3.1 原状

操作地图下方有一行文字说明（`level.goal.describe()`），不够直观。

### 3.2 改动

去除文字说明，改为在操作地图右侧并排显示一个缩小的"目标地图"预览：

- `BoardView` 新增 `preview` prop：预览模式下缩小尺寸、禁用旋钮、不渲染 knob-layer
- `BoardView` 新增 `label` prop：显示"操作地图"/"目标地图"标题
- `App.tsx` 使用 `boards-layout` flex 容器并排放置两个棋盘
- 目标棋盘由 `createSolvedSquare4x4()` 生成

### 3.3 布局

```
[操作地图 4x4 + 9旋钮]   [目标地图 4x4 缩小版]
```

响应式：窄屏（<320px）自动换为上下排列。

### 3.4 验证

- DOM 检查：2 个 `.board-wrapper`，标签分别为"操作地图"和"目标地图" ✓
- 预览模式无旋钮：`.knob` 数量为 0 ✓
- 视觉确认：左右并排，目标地图缩小且无旋钮 ✓

---

## 4. UX #3：旋转动画

### 4.1 原状

v0.1.0 的旋转是即时 CSS `background-color` 过渡，色块直接跳变，用户无法感知旋转过程。

### 4.2 改动

引入完整的旋转动画机制：

**架构层面：**
- `useGame` 新增 `animating` 状态和 `onAnimationEnd` 回调
- 点击旋钮 → 设置 animating（不立即改棋盘）
- CSS 动画结束 → `onAnimationEnd` 更新棋盘 + 记录步数 + 判定胜利

**渲染层面（BoardView.tsx）：**
- 旋转开始时，在被旋转的 2x2 区域上叠加 `.rotate-overlay`
- overlay 内部是 `.rotate-inner`——一个 2x2 网格，包含旋转前的 4 个色块
- CSS keyframe 动画 `rotate-cw`：0° → 35°(scale 0.92) → 90°(scale 1)，350ms
- 缓动函数 `cubic-bezier(0.33, 1, 0.68, 1)`：先快后慢，模拟物理旋转感
- 动画结束后 overlay 移除，真实棋盘已更新

**CSS 动画定义：**
```css
@keyframes rotate-cw {
  from { transform: rotate(0deg) scale(1); }
  40%  { transform: rotate(35deg) scale(0.92); }
  to   { transform: rotate(90deg) scale(1); }
}
.rotate-inner {
  animation: rotate-cw var(--rotate-duration) cubic-bezier(0.33, 1, 0.68, 1) forwards;
}
```

**动画时长选择：**
- 350ms：足够感知旋转过程（人类视觉感知阈值约 100ms）
- 不超过 500ms：避免操作卡顿感
- 40% 处加 scale(0.92)：旋转中轻微缩小，模拟"聚焦"效果，增加质感

### 4.3 防连点

动画期间 `animatingRef.current !== null`，`handleKnobClick` 直接 return，防止动画未完成时重复触发。

### 4.4 验证

- 单元测试：点击后 `animating !== null`，`onAnimationEnd` 后棋盘改变 + 步数+1 ✓
- 浏览器手动验证：旋转 overlay 在动画期间存在，结束后移除 ✓

---

## 5. 测试更新

### 5.1 新增测试

| 文件 | 测试项 | 说明 |
|------|--------|------|
| ui.test.tsx | 预览模式不渲染旋钮 | 验证目标地图无 knob |
| ui.test.tsx | 点击启动动画+步数+1 | 验证完整动画流程及步数修复 |

### 5.2 测试结果

```
✓ tests/core.test.ts  (24 tests) 20ms
✓ tests/ui.test.tsx   (3 tests)  203ms

Test Files  2 passed (2)
     Tests  27 passed (27)
```

27/27 全部通过，无警告。

---

## 6. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `.gitignore` | 新增 | 忽略 node_modules/dist/log 等 |
| `package.json` | 修改 | 版本号 0.1.0 → 0.1.1 |
| `src/hooks/useGame.ts` | 重写 | 修复步数bug + 动画状态管理 + ref解耦 |
| `src/components/BoardView.tsx` | 重写 | 旋转动画 overlay + preview 模式 + label |
| `src/App.tsx` | 修改 | 去文字说明 + 目标地图预览布局 |
| `src/index.css` | 修改 | 旋转动画 keyframe + 预览样式 + 并排布局 |
| `tests/ui.test.tsx` | 重写 | 适配动画流程 + 新增预览和步数测试 |
| `docs/fix-1.md` | 新增 | 本修复报告 |

---

## 7. 遗留问题

以下问题在 v0.1.1 中未修复，留待后续迭代：

1. **StrictMode 生产环境**：步数 bug 仅在开发模式（StrictMode）出现，生产构建不受影响。但代码修复对两种模式都正确。
2. **动画期间棋盘不可见**：旋转 overlay 覆盖了原 2x2 区域，动画期间看不到底层棋盘。这是有意设计——避免新旧色块重叠造成的视觉混乱。
3. **无撤销功能**：`history` 已记录但 UI 未暴露撤销按钮。
4. **无通关进度持久化**：刷新页面后进度丢失。
5. **CSS 动画在 jsdom 中无法测试**：动画效果依赖真实浏览器渲染，单元测试仅验证状态转换逻辑。

---

## 8. Git 记录

```
0066fa0  v0.1.0: 初始版本 - Rotrix 4x4旋转拼图基础玩法MVP
(本次)    v0.1.1: 修复步数bug + 目标地图预览 + 旋转动画
```

---

*修复报告结束。*
