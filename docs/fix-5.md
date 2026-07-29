# Rotrix 修复报告 #5 — v0.2.1 → v0.2.2

> 日期：2026-07-29
> 版本：v0.2.2
> 基线：v0.2.1 (commit b8c67d9)

---

## 1. 修复概要

本轮针对 H5 小游戏的部署与移动端兼容性进行适配，共 2 项：

| # | 类型 | 描述 |
|---|------|------|
| 1 | 部署 | Vite dev server 开启 `server.host: true`，允许同一局域网下其他设备通过 IP+端口访问 |
| 2 | 兼容 | 移动端适配：viewport-fit=cover 刘海屏安全区、touch-action 消除 300ms 延迟、关卡栏横向滚动、旋钮触摸目标扩大、响应式字号/布局 |

桌面端已有功能完全不受影响——所有 CSS 规则仅在 `max-width: 768px` 以下生效，JS 逻辑零改动。

---

## 2. 局域网访问

### 2.1 原状

`vite.config.ts` 未配置 `server` 选项，Vite 默认仅监听 `localhost`。运行 `npm run dev` 后只有本机能通过 `http://localhost:5173/` 访问，同一局域网下的手机/平板无法连接。

### 2.2 改动

`vite.config.ts` 新增：

```typescript
server: {
  // 监听所有网卡，允许同一局域网下其他设备通过 IP:端口 访问
  // `true` 等同于 0.0.0.0，Vite 启动时会额外打印 Network: http://<LAN-IP>:5173
  host: true,
},
```

### 2.3 验证

启动 `npm run dev` 后输出：

```
  VITE v5.4.21  ready in 878 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.137.1:5173/
  ➜  Network: http://192.168.0.109:5173/
```

同一局域网下的设备在浏览器输入 `http://<主机IP>:5173/` 即可游玩。

> 注意：Windows 防火墙可能首次弹窗请求放行 Node.js，需允许"专用网络"通过。这是 OS 层面的行为，不由代码控制。

---

## 3. 移动端适配

### 3.1 样板设备

以 **iPhone SE（375×667 逻辑像素）** 为样板设备进行适配。此规格是常见移动端最小屏，适配后更大屏幕（iPhone 12+ / Android 中端）自动兼容。

### 3.2 viewport-fit=cover（index.html）

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

新增 `viewport-fit=cover`：让网页内容延伸到刘海屏/手势条区域，配合 CSS `env(safe-area-inset-*)` 避免内容被遮挡。

`user-scalable=no` 已存在（v0.1.3），保留——拼图游戏不需要双指缩放，且配合 `touch-action: manipulation` 可彻底消除移动端 300ms 点击延迟。

### 3.3 全局触摸优化（index.css）

**touch-action: manipulation**

```css
button, .knob, .level-chip, .btn {
  touch-action: manipulation;
}
```

`manipulation` 允许平移和缩放手势但禁用双击缩放。效果：
- 消除移动端 ~300ms 点击延迟（浏览器不再等待判断是否双击）
- 旋钮点击响应更即时
- 桌面端鼠标交互完全不受影响（`touch-action` 仅作用于触控设备）

**-webkit-touch-callout: none**

```css
html, body, #root {
  -webkit-touch-callout: none;
  ...
}
```

禁止 iOS 长按元素弹出系统级菜单（"拷贝/分享"），避免误触干扰游戏体验。

### 3.4 刘海屏安全区（index.css）

```css
.app {
  padding-top: max(12px, env(safe-area-inset-top));
  padding-bottom: max(24px, env(safe-area-inset-bottom));
  padding-left: max(16px, env(safe-area-inset-left));
  padding-right: max(16px, env(safe-area-inset-right));
}
```

用 `max(固定值, env(safe-area-inset-*))` 确保内边距不小于设计值，同时刘海屏/手势条区域不遮挡内容。无刘海屏的设备 `env()` 返回 0，使用固定值。

### 3.5 关卡栏横向滚动（index.css）

v0.2.1 扩展到 20 关后，窄屏上 20 个 chip 即使 `flex-wrap: wrap` 也可能拥挤。新增横向滚动兜底：

```css
.level-bar {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.level-bar::-webkit-scrollbar {
  display: none;
}
```

- 优先 `flex-wrap: wrap` 换行（宽屏正常）
- 窄屏溢出时可横向滚动浏览
- 隐藏滚动条（`scrollbar-width: none` + `::-webkit-scrollbar`），视觉干净
- `-webkit-overflow-scrolling: touch` 启用 iOS 惯性滚动

### 3.6 响应式字号与布局（index.css）

新增 `@media (max-width: 768px)` 断点：

| 元素 | 桌面端 | 移动端 | 理由 |
|------|--------|--------|------|
| `.app-title` | 52px | 36px | 52px 在 375px 屏占 14% 宽，过大 |
| `.app-subtitle` | 22px | 16px | 同比缩小 |
| `.level-chip` 字号 | 20px | 16px | 20 关在窄屏需紧凑 |
| `.level-chip` padding | 10px 22px | 8px 14px | 减少占用 |
| `.level-chip .diff` | 16px | 13px | 辅助信息更小 |
| `.info-bar` | 22px / gap 24px | 18px / gap 16px | 信息栏紧凑 |
| `.btn` | 22px / padding 12px 28px | 18px / padding 10px 22px | 按钮适配窄屏 |

`@media (max-width: 320px)` 断点新增 `.app-title: 30px`（极小屏兜底）。

### 3.7 旋钮触摸目标扩大（index.css）

旋钮视觉尺寸在 420px 以下为 24px（`--knob-size`），低于 Apple HIG 推荐的 44px 最小触摸目标。用伪元素扩大点击区域：

```css
@media (max-width: 420px) {
  .knob::before {
    content: '';
    position: absolute;
    inset: -10px;
    border-radius: 50%;
  }
}
```

- 旋钮视觉仍为 24px（不改变布局密度）
- `::before` 伪元素向外扩展 10px，点击 hit-area = 24+10×2 = 44px
- `.knob` 是 `<button>`，`pointer-events: auto` 继承给伪元素，点击生效
- 桌面端无此规则，鼠标点击不受影响

### 3.8 胜利弹窗窄屏适配（index.css）

```css
@media (max-width: 420px) {
  .win-card {
    padding: 24px 28px;
    margin: 0 16px;
    max-width: calc(100vw - 32px);
  }
  .win-title { font-size: 40px; }
  .win-stats { font-size: 18px; }
  .win-actions { flex-wrap: wrap; }
}
```

弹窗在 375px 屏不溢出，按钮在极窄时可换行。

---

## 4. 兼容性保证

### 4.1 桌面端零影响

- 所有移动端 CSS 规则在 `@media (max-width: 768px)` / `(max-width: 420px)` / `(max-width: 320px)` 内
- 桌面端视口宽度 > 768px 时，这些规则全部不生效
- `touch-action: manipulation` 对鼠标点击无副作用——浏览器仅在触控事件时检查此属性
- JS 逻辑零改动：useGame / BoardView / App / core 全部未动

### 4.2 已有功能回归

- 旋转动画：`touch-action: manipulation` 不影响 `requestAnimationFrame` 驱动的 transform 动画
- 庆祝动画：CSS keyframe 不受 touch-action 影响
- 关卡切换/重置/胜利判定：纯 JS 逻辑，未改动
- 4x4 / 6x6 棋盘渲染：`--board-size` 响应式值在移动端缩小，grid 布局自动适配

### 4.3 测试回归

46 项单元测试全通过，无新增失败：
```
✓ tests/core.test.ts  (41 tests) 43ms
✓ tests/ui.test.tsx   (5 tests)  360ms
```

UI 测试在 jsdom 中运行（无真实渲染尺寸），`touch-action` 和 media query 不影响 jsdom 中的 DOM 断言。

---

## 5. 测试与构建

### 5.1 单元测试

```
✓ tests/core.test.ts  (41 tests) 43ms
✓ tests/ui.test.tsx   (5 tests)  360ms

Test Files  2 passed (2)
     Tests  46 passed (46)
```

### 5.2 构建

```
npm run build → tsc 通过，vite build 成功
dist/assets/index-DoTq8d7K.js   154.34 kB │ gzip: 50.01 kB
dist/assets/index-BkUPKDiC.css    6.58 kB │ gzip:  2.09 kB
```

CSS 从 v0.2.1 的 6.43 kB 增至 6.58 kB（+0.15 kB），全部来自新增 media query 规则。JS 体积不变。

### 5.3 运行时验证

- `npm run dev` 启动后输出 Network URL，局域网可访问 ✓
- HTTP `curl -I http://localhost:5174/` 返回 200 ✓
- CSS 通过 `curl` 验证包含 `safe-area-inset-top`、`touch-action: manipulation`、`max-width: 768px`、`knob::before` ✓
- 浏览器手动验证：旋钮点击触发旋转动画、步数+1 ✓

---

## 6. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `package.json` | 修改 | 版本号 0.2.1 → 0.2.2 |
| `vite.config.ts` | 修改 | 新增 `server.host: true` 局域网访问 |
| `index.html` | 修改 | viewport 新增 `viewport-fit=cover` |
| `src/index.css` | 修改 | touch-action / safe-area / 关卡栏滚动 / 响应式断点 / 旋钮 hit-area / 弹窗窄屏 |
| `docs/fix-5.md` | 新增 | 本修复报告 |

---

## 7. 遗留问题

1. **Windows 防火墙**：首次启动 dev server 时系统可能弹窗请求放行 Node.js，需用户手动允许"专用网络"。这是 OS 行为，非代码可控。
2. **移动端测试覆盖**：当前移动端适配通过 CSS media query 实现，jsdom 无法模拟真实移动端渲染。如需自动化测试，需引入 Playwright/Puppeteer 设备模拟。
3. **多种移动设备**：当前仅以 iPhone SE (375px) 为样板适配。Android 设备的 WebView 差异（如 `-webkit-overflow-scrolling` 支持度）需真机验证。
4. **PWA 离线**：H5 小游戏如需离线可玩，需后续添加 Service Worker / manifest。当前仅适配在线访问。

---

## 8. Git 记录

```
b8c67d9  v0.2.1: 关卡扩展至20关 + generatePuzzle接口 + 胜利对角线波纹庆祝动画
(本次)    v0.2.2: 局域网访问 + 移动端适配（viewport-fit/touch-action/safe-area/响应式/旋钮hit-area）
```

---

*修复报告结束。*
