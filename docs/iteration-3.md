# Rotrix 技术文档 — 第三轮迭代

> 日期：2026-07-29
> 版本：v0.2.3
> 状态：初始界面 + 无尽模式上线

---

## 1. 迭代概要

本轮迭代新增**模式选择系统**：游戏启动后先进入初始界面，玩家可选择闯关模式或无尽模式。无尽模式使用随机种子生成无限题目，记录通关总数与历史最佳。

| # | 类型 | 描述 |
|---|------|------|
| 1 | 新功能 | 初始界面（StartScreen）：闯关模式 / 4x4 无尽 / 6x6 无尽 三入口 |
| 2 | 新功能 | 无尽模式（EndlessScreen）：随机题目生成 + 通关计数 + localStorage 持久化 |
| 3 | 架构 | App 重构为视图状态机（start / campaign / endless） |
| 4 | 兼容 | 闯关模式逻辑完整保留，仅新增"返回主菜单"按钮 |

---

## 2. 模式选择设计

### 2.1 视图状态机

App 组件管理一个 `View` 联合类型状态：

```typescript
type View =
  | { mode: 'start' }
  | { mode: 'campaign' }
  | { mode: 'endless'; kind: EndlessKind };

type EndlessKind = '4x4' | '6x6';
```

- **start**：初始界面，展示三个模式入口卡片
- **campaign**：原闯关模式（v0.2.1 逻辑完整保留）
- **endless**：无尽模式，kind 区分 4x4 / 6x6

### 2.2 初始界面布局

```
        ROTRIX
   旋转拼图 · 选择你的挑战

  ┌─────────────────────┐
  │         ★           │
  │    闯关模式          │
  │  20关由易到难        │
  │   4x4 → 6x6         │
  └─────────────────────┘

       无尽模式
  ┌──────────┐  ┌──────────┐
  │  4×4     │  │  6×6     │
  │ 4x4无尽  │  │ 6x6无尽  │
  │ 随机30步 │  │ 随机60步 │
  │最佳:0关  │  │最佳:0关  │
  └──────────┘  └──────────┘
```

闯关模式卡片使用 accent 色高亮，无尽模式卡片紧凑排列。

### 2.3 无尽模式难度配置

| 模式 | 拓扑 | 打乱步数 | 说明 |
|------|------|----------|------|
| 4x4 无尽 | square-4x4 | 30 | 与闯关第 10 关同等难度 |
| 6x6 无尽 | square-6x6 | 60 | 超过闯关第 20 关（50 步），持续挑战 |

---

## 3. 无尽模式实现

### 3.1 随机题目生成

`src/core/generator.ts` 新增 `generateRandomPuzzle`：

```typescript
export function generateRandomPuzzle(
  topologyKind: string,
  scramble: number,
): GeneratedLevel {
  const entry = getTopologyEntry(topologyKind);
  const topology = entry.topology();
  const solved = entry.defaultSolvedBoard();
  const rng = defaultRNG();  // Math.random，非确定性
  return generateLevel({ solved, topology, scrambleCount: scramble, rng });
}
```

与 `generatePuzzle` 的区别：
- `generatePuzzle` 使用 `SeededRNG(seed)`，确定性——同 seed 产生同题目
- `generateRandomPuzzle` 使用 `defaultRNG()`（Math.random），每次调用产生不同题目

两者共用 `generateLevel` 核心逻辑（scramble → 检查非已解 → 返回），保证题目可解性。

### 3.2 EndlessScreen 组件

`src/components/EndlessScreen.tsx` 实现：

**游戏循环：**
1. 初始化：`createEndlessLevel(kind)` 生成第一题
2. 玩家旋转旋钮，`useGame` 管理棋盘/动画/胜利判定（复用闯关模式全部逻辑）
3. 胜利后播放庆祝动画（与闯关一致），弹窗显示"第 N 关 · 用了 M 步"
4. 点击"下一题"→ `cleared++` → 生成新题目 → 游戏重置

**通关计数与持久化：**
- `cleared`：本次会话已通关数
- `best`：历史最佳（localStorage `rotrix:endless:4x4` / `6x6`）
- 每次通关时 `cleared > best` 则更新 localStorage
- 初始界面读取 best 显示在模式卡片上

**状态管理：**
```typescript
const [level, setLevel] = useState<Level>(() => createEndlessLevel(kind));
const [cleared, setCleared] = useState(0);
const [best, setBest] = useState(() => loadBest(kind));
const [nextLoading, setNextLoading] = useState(false);
```

切换 kind 时重置全部状态并生成新题目。`useGame` 复用闯关模式同一 hook，零改动。

### 3.3 兼容性

- `useGame` hook 零改动——EndlessScreen 传入动态生成的 Level，hook 不关心来源
- `BoardView` 零改动——接收标准 board/knobs props
- 旋转动画、庆祝动画、胜利判定全部复用
- 闯关模式（CampaignScreen）逻辑从原 App 提取，仅新增 onBack prop

---

## 4. 架构改动

### 4.1 App.tsx 重构

原 App 组件拆分为：
- `App`：视图状态机，路由到 start / campaign / endless
- `CampaignScreen`：原 App 的闯关逻辑（完整保留），新增返回按钮

```typescript
export function App() {
  const [view, setView] = useState<View>({ mode: 'start' });
  if (view.mode === 'start') return <StartScreen ... />;
  if (view.mode === 'endless') return <EndlessScreen ... />;
  return <CampaignScreen onBack={() => setView({ mode: 'start' })} />;
}
```

### 4.2 新增文件

| 文件 | 说明 |
|------|------|
| `src/components/StartScreen.tsx` | 初始界面组件 |
| `src/components/EndlessScreen.tsx` | 无尽模式组件 |

### 4.3 修改文件

| 文件 | 变更 |
|------|------|
| `src/App.tsx` | 重构为状态机 + CampaignScreen 提取 |
| `src/core/generator.ts` | 新增 `generateRandomPuzzle` |
| `src/index.css` | 新增 StartScreen / EndlessScreen 样式 |
| `tests/core.test.ts` | +4 项 generateRandomPuzzle 测试 |

---

## 5. 测试覆盖

### 5.1 测试结果

```
✓ tests/core.test.ts  (45 tests) 68ms
✓ tests/ui.test.tsx   (5 tests)  436ms

Test Files  2 passed (2)
     Tests  50 passed (50)
```

### 5.2 新增测试（+4 项）

**generateRandomPuzzle：**
- 4x4 生成与目标不同的题目
- 6x6 生成与目标不同的题目
- 连续两次调用产生不同题目（非确定性）
- 生成的题目可解（逆序还原到 solved）

### 5.3 回归

46 项原有测试全通过，闯关模式逻辑无改动。

---

## 6. 构建

```
npm run build → tsc 通过，vite build 成功（43 modules，1.27s）
dist/assets/index-nUKGLyYg.js   158.81 kB │ gzip: 50.98 kB
dist/assets/index-DMeNz2fr.css    8.51 kB │ gzip:  2.39 kB
```

相比 v0.2.2（JS 154.34 kB / CSS 6.58 kB）：
- JS +4.47 kB：StartScreen + EndlessScreen 组件代码
- CSS +1.93 kB：初始界面 + 无尽模式样式

---

## 7. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `package.json` | 修改 | 版本号 0.2.2 → 0.2.3 |
| `src/App.tsx` | 重写 | 视图状态机 + CampaignScreen 提取 |
| `src/core/generator.ts` | 修改 | 新增 `generateRandomPuzzle` |
| `src/components/StartScreen.tsx` | 新增 | 初始界面组件 |
| `src/components/EndlessScreen.tsx` | 新增 | 无尽模式组件 |
| `src/index.css` | 修改 | 新增 StartScreen / EndlessScreen / 模式卡片样式 |
| `tests/core.test.ts` | 修改 | +4 项 generateRandomPuzzle 测试 |
| `docs/iteration-3.md` | 新增 | 本迭代文档 |

---

## 8. 已知问题与不足

### 8.1 功能层面

1. **无尽模式无步数评级**：当前只记录通关数，未记录每关步数或三星评级。
2. **无尽模式无难度递增**：难度固定（4x4: 30 步 / 6x6: 60 步），不会随通关数增加而提升。后续可做动态难度。
3. **localStorage 兼容性**：隐私模式下 localStorage 可能不可用，当前已 try-catch 兜底但 best 不会持久。

### 8.2 UX 层面

1. **初始界面无过渡动画**：模式切换是硬切，后续可加 fadeIn 过渡。
2. **无尽模式无"放弃"确认**：返回主菜单会丢失当前会话进度，无确认弹窗。

---

## 9. 下一轮迭代建议

按优先级排序：

### P0 — 体验完善
- [ ] 撤销/重做功能（history 已记录）
- [ ] 通关进度持久化（闯关模式 localStorage）
- [ ] 无尽模式步数评级 + 单关最佳步数

### P1 — 新拓扑 / 玩法
- [ ] 8x8 方形网格
- [ ] 三角/六边形网格拓扑
- [ ] BFS 精确难度计算

### P2 — 渲染层
- [ ] BoardRenderer 接口抽象
- [ ] 初始界面过渡动画

---

## 10. Git 记录

```
ae2514d  v0.2.2: 局域网访问 + 移动端适配
(本次)    v0.2.3: 初始界面 + 无尽模式（随机题目生成 + 通关计数 + localStorage持久化）
```

---

*文档结束。下一轮迭代将聚焦于 P0 体验完善。*
