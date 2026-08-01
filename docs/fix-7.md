# Rotrix 修复报告 #7 — v0.3.0 → v0.3.1

> 日期：2026-08-01
> 版本：v0.3.1
> 基线：v0.3.0 (commit 5ca512e)

---

## 1. 修复概要

本轮针对六边形三角形玩法上线后发现的两项问题进行修复，共 2 项：

| # | 类型 | 描述 |
|---|------|------|
| 1 | Bug | 第 21 关六边形旋转结束时再次出现"旋转过程快结束→闪现原始状态→变为最终状态"的闪烁。根因与 v0.1.2（fix-2）正方形版的闪烁同源：CSS 有 `transition: fill` 但 `.board.animating` 作用域的禁用规则只匹配 `.cell`，六边形底层是 `<polygon>`（无 `.cell` class），未被禁用，导致旋转提交瞬间底层 polygon 仍用 150ms 渐变，闪现原始色。 |
| 2 | 功能 | 扩展第 22-25 关，均为六边形三角形拓扑（与第 21 关同模板），打乱步数从低到高（55/70/85/100），形成六边形关卡难度曲线。 |

---

## 2. Bug #1：六边形旋转结束闪烁

### 2.1 现象

点击六边形旋钮 → 旋转动画播放 → 临近结束时闪现一次原始（旋转前）色块排列 → 变为目标状态。与 v0.1.2 正方形版的"旋转 → 闪现原始 → 目标"三段式症状一致。

### 2.2 根因（代码逻辑推理）

沿用 fix-2 在正方形版总结出的闪烁机制，对照六边形版的代码路径：

旋转结束到最终状态之间发生的事（`HexBoardView.tsx` / `useGame.ts` / `index.css`）：

1. rAF `tick` 在 `progress === 1` 后停留 `SETTLE_FRAMES`（3 帧 ≈ 50ms）调 `onAnimationEnd`。`useGame.onAnimationEnd` 顶层独立调用 `setBoard(next)` + `setAnimating(null)`，React 18 批处理成一次 render → overlay 卸载 + 底层 SVG `<polygon>` 用新 board 渲染。这一步与正方形版一致，HexBoardView 的 `keepAnimating` 机制也已就绪（`animating || keepAnimating` 维持 `.board.animating` class ~30ms）。
2. **根因在 `index.css`**：六边形底层是 `<polygon>`，有 `.hex-svg polygon { transition: fill 0.15s ease; }`（index.css:378）。旋转提交、polygon 的 `fill` 从旧色变新色时，走 150ms 渐变。overlay 在同一 commit 被移除，移除瞬间底层 polygon 仍是旧色（渐变刚开始），用户看到的"一瞬间原始状态"就是这 150ms 渐变的起始帧。
3. 正方形版在 v0.1.2 已用 `.board.animating .cell { transition: none; }`（index.css:224）禁用 `.cell` 的过渡——但这条选择器**只匹配带 `.cell` class 的元素**，六边形的 `<polygon>` 不带 `.cell` class，所以没被禁用，闪烁复发。

> 本质上不是新 bug，是 v0.3.0 引入六边形渲染层时遗漏了正方形版已有的"旋转提交时禁用底层过渡"规则的对应版本。HexBoardView 的 JS 动画机制（rAF + SETTLE_FRAMES + keepAnimating）是从 BoardView 完整移植的，唯一漏的是 CSS 选择器。

### 2.3 修复

补一条 CSS 规则，让 `.board.animating` 作用域内的 `<polygon>` 也不做 fill 过渡：

```css
/* v0.3.1：旋转动画提交棋盘时，禁用 polygon 的 fill 过渡。
 * 与 v0.1.2 的 `.board.animating .cell { transition: none }` 同源——
 * hex 版底层是 <polygon>（无 .cell class），原规则匹配不到，导致旋转
 * 结束 overlay 卸载瞬间底层 polygon 仍用 150ms 渐变到目标色，闪现原始状态。
 * keepAnimating 机制已在 HexBoardView 就绪，此处补齐 CSS 即可消除闪烁。 */
.board.animating .hex-svg polygon {
  transition: none;
}
```

修复后的完整时序（与正方形版对齐）：

- rAF 到目标角度 → 停留 3 帧 → `onAnimationEnd` → `setBoard(next)` + `setAnimating(null)`（同一次 React commit）→ overlay 卸载 + 底层 polygon 立即变目标色（无渐变，`.board.animating` 仍在，`transition: none` 生效）→ `keepAnimating` 30ms 后清除 → `.board.animating` 移除 → `transition` 恢复 `0.15s`（此时 polygon 已是目标色，不触发任何渐变）。

### 2.4 验证

- 代码逻辑验证：`HexBoardView` 的 `.board` className 计算 `${animating || keepAnimating ? 'animating' : ''}`（HexBoardView.tsx:138）与正方形版完全一致，`keepAnimating` 的 setTimeout(30ms) 清除逻辑也一致（HexBoardView.tsx:117-125）。补齐 CSS 选择器后，时序与正方形版逐行对应。
- 单元测试：六边形旋转动画的现有测试（点击旋钮启动动画 + onAnimationEnd 后步数+1 + animating 清除）全通过，逻辑层无回归。

---

## 3. 第 22-25 关扩展

### 3.1 设计

| 关卡 | 拓扑 | 打乱步数 | 种子 | 实际有效难度 |
|------|------|---------|------|-------------|
| 21 | hex-triangle | 40  | 301 | 40 |
| 22 | hex-triangle | 55  | 302 | 55 |
| 23 | hex-triangle | 70  | 303 | 70 |
| 24 | hex-triangle | 85  | 304 | 85 |
| 25 | hex-triangle | 100 | 305 | 100 |

- 模板与第 21 关相同：`topologyKind: 'hex-triangle'`，Goal 为 `HexUniformGoal`。
- 打乱步数 40 → 55 → 70 → 85 → 100，步长 15，从低到高递增。
- 种子 301-305 连续，保证确定性（同种子同题目）。
- 实际有效难度（`effectiveMoves` 压缩后）与 scramble 完全相等——因为六边形旋钮 6 块，`effectiveMoves` 只压缩"连续对同一旋钮的同方向操作 mod 6"，而 generator 的 `lastKnobId` 去重已避免连续同旋钮，故压缩几乎不生效。

### 3.2 改动

`src/levels/levels.ts` — `LEVEL_SPECS` 数组追加 4 条：

```typescript
{ id: 22, topologyKind: 'hex-triangle', scramble: 55,  seed: 302 },
{ id: 23, topologyKind: 'hex-triangle', scramble: 70,  seed: 303 },
{ id: 24, topologyKind: 'hex-triangle', scramble: 85,  seed: 304 },
{ id: 25, topologyKind: 'hex-triangle', scramble: 100, seed: 305 },
```

`getLevels()` 的 Goal 选择逻辑无需改动——已按 `topologyKind === 'hex-triangle'` 分发 `HexUniformGoal`（levels.ts:64-67）。

### 3.3 文案更新

`StartScreen.tsx` 闯关模式描述从 "20 关由易到难 / 4x4 → 6x6" 改为 "25 关由易到难 / 4x4 → 6x6 → 六边形"。

### 3.4 可解性验证

每关均通过"逆向还原"测试：从题目棋盘出发，逆序执行 solution 的每一步（每步用 5 次 CW = 1 次 CCW，因为六边形旋钮 6 块），最终应还原为 solved 棋盘并满足 `HexUniformGoal`。5 关全部通过（见回归测试）。

### 3.5 难度递增验证

运行期检查（vitest 临时测试）确认 5 关有效难度严格递增：

```
第21关 hex difficulty=40 solutionLen=40
第22关 hex difficulty=55 solutionLen=55
第23关 hex difficulty=70 solutionLen=70
第24关 hex difficulty=85 solutionLen=85
第25关 hex difficulty=100 solutionLen=100
```

---

## 4. 回归测试

### 4.1 测试更新

`tests/core.test.ts`：

1. **3 处关卡数断言**：`21 → 25`（"Levels - 关卡数据"、"Levels - 6x6 关卡数据"、"Levels - 六边形关卡数据"各一处）。
2. **2 处 ID 数组**：`[... 21]` → `[... 21, 22, 23, 24, 25]`。
3. **"每个关卡题目非已解决状态"**：原来用三元 `square-4x4 ? solved4 : solved6`，对 hex 关卡错误地用 solved6（36 格）与 54 格棋盘比较（因长度不等恒返回 false，测试侥幸通过但逻辑错误）。改为三分支正确分发 `solvedHex`。
4. **六边形关卡测试重写**：原 4 项（仅第 21 关）扩展为 5 项覆盖 21-25 关：
   - 生成 25 个关卡（含第 21-25 关六边形）
   - 第 21-25 关均为六边形三角形拓扑
   - 第 21-25 关打乱步数递增（effective difficulty 不减，最末 > 首关）
   - 第 21-25 关每关题目非已解决状态
   - 第 21-25 关每关可解（逆向还原）

### 4.2 测试结果

```
✓ tests/core.test.ts  (66 tests) 77ms
✓ tests/ui.test.tsx   (8 tests)  430ms

Test Files  2 passed (2)
     Tests  74 passed (74)
```

从 v0.3.0 的 73 项增至 74 项（+1：六边形关卡测试从 4 项合并/扩展为 5 项，净 +1）。

### 4.3 回归

- 正方形 4x4 / 6x6 玩法零影响：`rotateCellsCW` 对 n=4 行为不变，`QuadrantUniformGoal` 未改动，第 1-20 关测试全通过。
- 第 21 关六边形玩法：闪烁修复为 CSS-only（无 JS 改动），现有六边形 UI 测试（渲染 54 三角形 + 19 旋钮、点击启动动画、预览模式）全通过。
- 无尽模式（4x4/6x6）未改动。

---

## 5. 构建

```
npm run build → tsc 通过，vite build 成功（45 modules，1.32s）
dist/index.html                   0.86 kB │ gzip:  0.58 kB
dist/assets/index-D0V22Os1.css    8.86 kB │ gzip:  2.47 kB
dist/assets/index-BdQwEXHl.js   165.14 kB │ gzip: 52.69 kB
```

相比 v0.3.0（JS 164.91 kB / CSS 8.81 kB）：
- JS +0.23 kB：4 条新关卡 spec（levels.ts）
- CSS +0.05 kB：1 条 `.board.animating .hex-svg polygon { transition: none }` 规则

---

## 6. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `package.json` | 修改 | 版本号 0.3.0 → 0.3.1 |
| `src/index.css` | 修改 | 新增 `.board.animating .hex-svg polygon { transition: none }` 禁用六边形旋转提交时的 fill 过渡（修复闪烁） |
| `src/levels/levels.ts` | 修改 | LEVEL_SPECS 新增第 22-25 关（hex-triangle，scramble 55/70/85/100，seed 302-305）+ 头注释 |
| `src/components/StartScreen.tsx` | 修改 | 闯关模式描述 20 关 → 25 关，补充"→ 六边形" |
| `tests/core.test.ts` | 修改 | 3 处 21→25、ID 数组扩展、"非已解决"三分支分发、六边形关卡测试从 4 项扩展为 5 项覆盖 21-25 关 |
| `docs/fix-7.md` | 新增 | 本修复报告 |

---

## 7. Git 记录

```
5ca512e  v0.3.0: 六边形三角形拓扑（54 三角形 / 19 旋钮 / 6 扇区 + SVG 渲染 + 第 21 关 + 胜利判定修复）
(本次)   v0.3.1: 六边形旋转闪烁修复 + 第 22-25 关扩展
```

---

## 8. 已知限制 / 后续

1. **闪烁修复为 CSS-only**：未改动 HexBoardView 的 JS 动画逻辑。若后续六边形动画时序调整（如改变 SETTLE_FRAMES 或 keepAnimating 时长），需同步确认 `.board.animating` class 的覆盖窗口仍足够覆盖 React commit + 浏览器 paint。
2. **六边形无尽模式**：仍未扩展。StartScreen 的无尽模式入口只有 4x4 / 6x6，无六边形无尽。
3. **关卡数**：现 25 关。levels.ts 的 `LEVEL_SPECS` 结构化定义便于后续继续扩展到 50+ 关。

---

*修复报告结束。*
