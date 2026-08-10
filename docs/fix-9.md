# fix-9: 图案去抖动 + 胜利动画辅助线勾勒

> 基线：v0.4.2

## 背景

v0.4.2 实现第 31-40 关图案玩法后，用户反馈两个问题：
1. 多个图案背景使用交替抖动填充（checkerboard dither），6x6 网格下抖动效果不明显且画面杂乱
2. 胜利动画缺少图案感——色块拼对后没有"呈现一个完整图案"的视觉反馈

## 改动

### 1. 图案去抖动——全色填充

**`src/core/board.ts`**

8 个图案（33-40）全部重新设计，背景和形状区域改用全色填充（solid fill），
不再使用双棋盘交替抖动。

示例——太阳图案改动前后：
```
前: BCBCBC    后: BBBBBB
   CRMRMB       BBRRBB
   BMYGRC       BRRRRB
   CRGYMB       BRYRYB
   BMRMRC       BBRRBB
   CBCBCB       BBBBBB
```

全色填充会导致部分 2x2 旋钮变为单色（"非活跃旋钮"——旋转无效），
但每个图案仍有 14-25 个活跃旋钮（占总数 25 的 56%-100%），
足以保证 generateLevel 找到有效打乱序列、题目可解。

### 2. 胜利动画辅助线

**`src/core/picture-outlines.ts`**（新增）

每个图案 id 对应一组 SVG path（坐标 0-1 比例），定义图案的轮廓线条：
- 33 太阳：日冕圆环 + 日面圆环
- 34 房子：屋顶三角 + 墙体矩形 + 门
- 35 心形：心形贝塞尔曲线
- 37 钻石：外菱形 + 内菱形
- 38 箭头：箭头三角 + 箭杆矩形
- 39 树：树冠三角 + 树干矩形
- 40 笑脸：圆脸 + 双眼 + 嘴巴弧线

第 31（同心方框）、32（螺旋回字）、36（三色棋盘）为抽象几何图案，
色块本身已构成清晰图形，不额外加辅助线。

**`src/components/BoardView.tsx`**

新增 `pictureId` prop。胜利动画期间（`celebrating && !preview`），
在色块上叠加 SVG overlay，path 用 `stroke-dashoffset` 动画渐入：
- `stroke-dasharray: 4; stroke-dashoffset: 4 → 0`，0.6s ease-out
- 多条路径按顺序延迟 120ms 渐入，形成层次感
- 白色半透明描边 + drop-shadow，在所有色块背景上可读

辅助线只在胜利动画中展现，操作地图和目标地图正常状态下不显示。

**`src/App.tsx`**

操作地图的 BoardView 传入 `pictureId={level.id}`（仅图案关）。

**`src/index.css`**

新增 `.picture-outline-overlay` / `.picture-outline-path` / `@keyframes picture-outline-draw`。

## 测试

- 去掉"无 2x2 单色旋钮"断言（全色填充不再满足此约束）
- 更新 33/34 关像素值断言（图案数据变化）
- 160 测试全过

## 验证

```
npm test  → 160 tests pass
npm run build → tsc + vite build 成功
```

## 文件

- `src/core/board.ts` — 8 个图案全色填充
- `src/core/picture-outlines.ts` — 新增辅助线数据
- `src/components/BoardView.tsx` — pictureId prop + SVG overlay
- `src/App.tsx` — 传 pictureId
- `src/index.css` — 辅助线样式
- `tests/core.test.ts` — 测试更新
- `package.json` — 0.4.2 → 0.4.3
