# fix-8: 骰子关移至第50关 + 旋转中点数保持正立

> 基线：v0.4.0 (commit cc2b12d)

## 背景

v0.4.0 引入骰子 4x4 玩法（第31关），用户反馈：
1. 第31关难度太大，作为骰子玩法入门关位置不当
2. 旋转过程中色块上的骰子点数随色块一起旋转，视觉上不自然——
   点数应像贴纸一样保持正立，仅随色块平移

## 改动

### 1. 关卡布局重构

**`src/levels/levels.ts`**

骰子关从第31关移至第50关，31-49关预留（后续版本填充）：

```diff
-  // 第 31 关：骰子 4x4 玩法（v0.4.0）
-  { id: 31, topologyKind: 'square-4x4-dice', scramble: 8, seed: 501 },
+  // 第 31-49 关：预留，后续版本填充
+  // 第 50 关：骰子 4x4 玩法（v0.4.0 起设为第 31 关，v0.4.1 移至第 50 关）
+  { id: 50, topologyKind: 'square-4x4-dice', scramble: 8, seed: 501 },
```

关卡总数仍为 31（30 + 1），但 ID 数组变为 `1..30, 50`。

### 2. 线性流程与结算逻辑

**`src/App.tsx`**

线性"下一关"流程限于前 30 关。第 50 关为独立挑战关：

- 前 30 关：通关后显示"下一关 →"，第 30 关通关后显示"重新开始"
- 第 50 关：通关后不显示"下一关"或"重新开始"，仅显示"恭喜挑战通过！"
  + "再玩一次"按钮，不参与线性循环

```tsx
const isLastInCampaign = currentLevelId >= 30;
const isFinalChallenge = currentLevelId === 50;
```

通关弹窗三态：
1. `isFinalChallenge` → 仅"恭喜挑战通过！" + "再玩一次"
2. `isLastInCampaign`（第30关）→ "重新开始" + "再玩一次"
3. 其他（1-29关）→ "下一关 →" + "再玩一次"

### 3. 旋转中骰子点数保持正立

**`src/components/BoardView.tsx`**

`DicePips` 组件新增 `counterRotate` prop。旋转 overlay 内的 4 个
`DicePips` 调用传入 `counterRotate={angle}`，组件内对 `.dice-pips`
容器施加 `transform: rotate(-angle)` 抵消父级 `.rotate-inner` 的
`rotate(angle)`，使点数仅随色块平移、朝向不变。

**原理**：
- 父级 `.rotate-inner`：`transform: rotate(angle) scale(scale)`
- 子级 `.dice-pips`：`transform: rotate(-angle)`
- 合成效果：点数朝向 = rotate(0)，但位置随父级旋转平移
- `scale` 不抵消——色块缩放时点数按比例缩放，视觉自然

**`src/index.css`**

更新 `.rotate-overlay .dice-pip` 注释，反映新的反向旋转策略。

## 测试

**`tests/core.test.ts`**

- 3 处"关卡 ID 从 1 到 31"改为"关卡 ID：1-30 + 50"
- 3 处 describe 描述更新（骰子移至第50关）
- "第 31 关"系列测试改为"第 50 关"系列测试
- "每个关卡题目非已解决状态"增加 `square-4x4-dice` 分支
- "每个关卡的初始棋盘维度正确"增加 `square-4x4-dice` 分支

## 验证

```
npm test  → 125 tests pass（数量不变，仅断言更新）
npm run build → tsc + vite build 成功
```

## 文件

- `src/levels/levels.ts` — 关卡数据
- `src/App.tsx` — 下一关/结算逻辑
- `src/components/BoardView.tsx` — DicePips 反向旋转
- `src/index.css` — 注释更新
- `tests/core.test.ts` — 测试更新
- `package.json` — 版本 0.4.0 → 0.4.1
