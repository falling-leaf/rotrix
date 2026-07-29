# Rotrix 修复报告 #3 — v0.1.2 → v0.1.3

> 日期：2026-07-29
> 版本：v0.1.3
> 基线：v0.1.2 (commit 6cafc6b)

---

## 1. 修复概要

本轮针对 v0.1.2 中用户反馈的视觉体验问题进行修复，共 4 项：

| # | 类型 | 描述 |
|---|------|------|
| 1 | UX | 全场景文字字号放大，原字号过小影响可读性 |
| 2 | UX | 旋转动画时长 350ms → 200ms，缩减单次旋转开销 |
| 3 | UX | 深色主题 → 浅色主题（含旋转 overlay 底色适配） |

---

## 2. 字号放大

### 2.1 原状

v0.1.2 各处字号偏小，移动端 H5 游戏可读性不足：

| 元素 | 原字号 | 新字号 |
|------|--------|--------|
| 标题 ROTRIX | 28px | 52px |
| 副标题 | 13px | 22px |
| 关卡 chip | 13px | 20px |
| 关卡难度 ★ | 10px | 16px |
| info-bar（关卡名/步数） | 14px | 22px |
| board-label（操作地图/目标地图） | 12px | 20px |
| 按钮 | 14px | 22px |
| 胜利标题 🎉通关 | 32px | 56px |
| 胜利统计 | 14px | 22px |
| 旋钮 ⟳ 图标 | 18px | 24px |

### 2.2 改动

`src/index.css` 中各选择器的 `font-size` 值统一上调。同时伴随 padding 微调（`.level-chip` 6px 14px → 10px 22px、`.btn` 8px 20px → 12px 28px）使按钮比例协调。`.app-title` 的 `letter-spacing` 从 2px 调至 3px 配合更大字号。

### 2.3 验证

- 浏览器目视：标题、关卡选择、信息栏、按钮、胜利弹窗字号均明显增大，移动端可读性显著提升。
- 单元测试无断言依赖具体字号值，全量通过。

---

## 3. 旋转动画时长缩减

### 3.1 原状

v0.1.2 旋转动画时长为 350ms（`ROTATE_DURATION = 350`），用户反馈单次旋转耗费时间太长，连续操作时节奏拖沓。

### 3.2 改动

`src/components/BoardView.tsx` 的 `ROTATE_DURATION` 常量从 `350` 改为 `200`：

```typescript
/** 旋转动画时长（ms）——v0.1.3：350ms → 200ms，缩减单次旋转开销 */
const ROTATE_DURATION = 200;
```

`src/index.css` 的 `--rotate-duration` CSS 变量同步更新为 `200ms`（该变量当前仅作文档参考，实际动画时长由 BoardView 的 `ROTATE_DURATION` 常量驱动 rAF tick，CSS 变量不直接参与动画——保留是为了与未来可能的 CSS 动画回退方案保持一致）。

### 3.3 时长选择依据

- 200ms 仍高于人类视觉感知阈值（~100ms），旋转过程清晰可见。
- 相比 350ms 节省 43% 时间，连续旋转操作（高难度关卡）的节奏感明显提升。
- 缓动函数 `ease-out cubic`（`1-(1-t)³`）不变——先快后慢的物理旋转感在 200ms 内依然成立，只是收尾更快。
- `SETTLE_FRAMES = 3`（≈50ms 停留帧）保持不变，确保 board commit 落到 DOM 后再卸载 overlay。

### 3.4 验证

- 浏览器手动测试：点击旋钮 → 旋转过程可见且明显更快 → 色块到位 → 步数+1，无跳变、无闪烁。
- 单元测试中 rAF 不可靠，仍手动调 `onAnimationEnd()` 模拟动画结束，测试逻辑不依赖具体时长值，全量通过。

---

## 4. 浅色主题

### 4.1 原状

v0.1.2 为深色主题（`--bg: #1a1a2e`，`--panel: #16213e`），用户要求改为浅色主题。

### 4.2 改动

`src/index.css` 的 `:root` CSS 变量全面更新为浅色色板：

| 变量 | 原值（深色） | 新值（浅色） |
|------|-------------|-------------|
| `--bg` | `#1a1a2e` | `#eef2f7` |
| `--panel` | `#16213e` | `#ffffff` |
| `--panel-light` | `#1f2b4a` | `#f0f3f8` |
| `--text` | `#e8e8e8` | `#2d3748` |
| `--text-dim` | `#8888aa` | `#718096` |
| `--grid-line` | `#2a2a4a` | `#d1dae8` |
| `--accent-soft` | `rgba(233,69,96,0.15)` | `rgba(233,69,96,0.12)` |

四色色块（`--color-red/yellow/blue/green`）保持不变——这四种颜色在浅色背景上对比度依然足够。

### 4.3 伴随调整

| 元素 | 调整 |
|------|------|
| `.board-wrapper` 阴影 | `0 8px 32px rgba(0,0,0,0.3)` → `0 4px 20px rgba(0,0,0,0.08)`（浅色主题阴影需减淡） |
| `.board-wrapper.preview` 阴影 | `0 4px 16px rgba(0,0,0,0.2)` → `0 2px 10px rgba(0,0,0,0.06)` |
| `.knob` 阴影 | `0 2px 8px rgba(0,0,0,0.4)` → `0 2px 8px rgba(0,0,0,0.15)` |
| `.knob` 边框 | `rgba(255,255,255,0.3)` → `rgba(255,255,255,0.5)` |
| `.win-overlay` 遮罩 | `rgba(0,0,0,0.7)` → `rgba(0,0,0,0.5)` |
| `.btn.primary` 文字色 | 继承 `--text`（深色） → `#fff`（白色，保证在 accent 红色按钮上的对比度） |
| `index.html` 内联背景 | `#1a1a2e` → `#eef2f7` |
| `index.html` theme-color | `#1a1a2e` → `#eef2f7` |

### 4.4 旋转 overlay 底色适配

v0.1.2 将 `.rotate-overlay` 的底色设为 `var(--panel)`，用于遮蔽旋转缺口的底层原始色块。浅色主题下 `var(--panel) = #ffffff`，效果一致——旋转缺口显示为白色面板色（与棋盘格子间隙同色），既区分于四色色块，又消除"旋转中闪现原始状态"的视觉跳变。无需额外改动，CSS 变量自动适配。

### 4.5 验证

- 浏览器目视：整体背景为浅蓝灰，棋盘为白色面板，色块色彩鲜明，文字深灰清晰。
- 旋转动画：缺口底色为白色面板色，与棋盘缝隙视觉连贯，无原始色块闪现。
- 胜利弹窗：遮罩减淡后仍聚焦内容，卡片白底绿边框清晰。

---

## 5. 休闲游戏字体

### 5.1 原状

v0.1.2 使用系统字体栈 `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`，风格偏正式，不符合休闲小游戏调性。

### 5.2 字体选择

| 字体 | 用途 | 理由 |
|------|------|------|
| Fredoka | 拉丁字母、数字 | Google Fonts 免费可商用；圆润、活泼、现代，是休闲游戏的典型字体 |
| ZCOOL KuaiLe | 中文汉字 | Google Fonts 免费可商用；笔画圆润饱满、风格轻松俏皮，与 Fredoka 调性一致 |

两者在字形风格上互补：Fredoka 覆盖拉丁/数字字符（ROTRIX 标题、步数数字、关卡 ★ 等），ZCOOL KuaiLe 覆盖中文字符（"旋转拼图 · 通关挑战"、"操作地图"、"目标地图"、"重置"、"通关！"等），fallback 到系统字体保证未加载完成时的可用性。

### 5.3 引入方式

`index.html` 的 `<head>` 中添加 Google Fonts 链接：

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=ZCOOL+KuaiLe&display=swap" rel="stylesheet" />
```

`src/index.css` 的 `html, body, #root` 字体栈更新为：

```css
font-family: 'Fredoka', 'ZCOOL KuaiLe', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

- `display=swap`：字体未加载完成时先用 fallback 系统字体渲染，加载完成后无感切换。
- `preconnect`：预连接 Google Fonts 域名，减少字体请求延迟。
- 标题 ROTRIX 的渐变色 `background-clip: text` 与 Fredoka 兼容，视觉效果正常。

### 5.4 验证

- 浏览器目视：标题、按钮、关卡名等文字呈现圆润活泼的休闲游戏风格，与系统字体的正式感明显区分。
- 离线/字体加载失败时 fallback 到系统字体，功能不受影响。

---

## 6. 测试与构建

### 6.1 单元测试

```
✓ tests/core.test.ts  (24 tests)
✓ tests/ui.test.tsx   (4 tests)

Test Files  2 passed (2)
     Tests  28 passed (28)
```

本轮修复为纯视觉/样式调整，不触及游戏逻辑与组件 DOM 结构，28 项测试全部通过，无回归。

### 6.2 构建

```
npm run build → tsc 通过，vite build 成功
```

---

## 7. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `package.json` | 修改 | 版本号 0.1.2 → 0.1.3 |
| `index.html` | 修改 | 浅色背景 + Google Fonts 引入（Fredoka + ZCOOL KuaiLe） |
| `src/index.css` | 重写 | 浅色主题 CSS 变量 + 字号全面放大 + 休闲字体栈 + 阴影减淡 + 旋转时长变量同步 |
| `src/components/BoardView.tsx` | 修改 | ROTATE_DURATION 350 → 200 |
| `docs/fix-3.md` | 新增 | 本修复报告 |

---

## 8. 遗留问题

1. **字体依赖网络**：Fredoka 和 ZCOOL KuaiLe 通过 Google Fonts CDN 加载，离线环境 fallback 到系统字体。后续可考虑内联字体文件（woff2）实现完全离线可用。
2. **动画期间底层棋盘不可见**：overlay 覆盖原 2×2 区域（有意设计，避免新旧色块重叠的视觉混乱），浅色主题下缺口为白色面板色。
3. **无撤销功能 / 无通关进度持久化**：留待后续迭代。
4. **无音效/触感反馈**：H5 游戏建议补充点击音效和振动反馈。

---

## 9. Git 记录

```
6cafc6b  v0.1.2: 修复旋转动画（色块高度塌陷 + 网格顺序 + rAF逐帧旋转 + 动态缩放防出格 + 禁用cell transition消除原始态闪烁）
(本次)    v0.1.3: 视觉优化（字号放大 + 旋转时长缩短 + 浅色主题 + 休闲字体）
```

---

*修复报告结束。*
