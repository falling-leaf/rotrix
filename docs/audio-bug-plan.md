# 音频首次启动 Bug 分析 Plan

## 问题
页面初次加载（或刷新）后，BGM 不会自动播放，需要手动进入音量设置 → 静音 ON → 静音 OFF 才有声音。

## 1. 数据流追踪

### 1.1 useAudio 初始化流程

```
App.tsx 渲染
  → useAudio() 调用
    → useState(loadSettings)  // 从 localStorage 读取
    → 两个 useEffect 按顺序注册

1st useEffect ([] deps):
  - getBgm() → 创建/复用 <audio> 元素，volume=0.3
  - tryPlay() 立即执行
    - bgm.play() → 失败（无用户手势）
    - .catch() → bgm.volume=0, 再次 play() → 仍然失败
    - **volume 停留在 0！**
  - 添加 click/touchstart 监听器 { once: true }

2nd useEffect ([settings] deps, 在 1st 之后同步执行):
  - bgm.volume = 0.3  ← 恢复音量
  - bgm.play() → 失败（无用户手势）
  - .catch() → 不做任何事

**关键时序问题**:
  1st useEffect 的 .catch() 是微任务，在 2nd useEffect 同步执行之后才执行。
  所以实际顺序是：
    ① 1st effect: volume=0.3, play()→promise(待定)
    ② 2nd effect: volume=0.3, play()→promise(待定)  
    ③ 微任务: 1st effect 的 .catch() → volume=0 !!! ← 覆盖了 2nd effect 的设置
    ④ 微任务: 2nd effect 的 .catch() → 不做任何事
  最终 volume = 0

用户点击时:
  - tryPlay 触发（来自 { once: true } 监听器）
  - bgm.play() → 成功（用户手势）
  - .then() → startedRef.current = true
  - **但 volume 仍然是 0，用户听不到声音！**
```

### 1.2 为什么静音→取消静音能工作

```
用户进入音量设置 → 点击"静音"开关
  → toggleMute() → setSettings({ muted: true })
  → 2nd useEffect 触发:
    - bgm.pause(), startedRef.current = false

用户再次点击取消静音
  → toggleMute() → setSettings({ muted: false })
  → 2nd useEffect 触发:
    - bgm.volume = 0.3
    - !startedRef.current → true → bgm.play() → 成功（按钮点击是用户手势）
    - startedRef.current = true
  → 音乐播放！
```

## 2. 修复方案

### 方案 A：在 .catch() 中恢复音量（最小改动）
在 1st useEffect 的 tryPlay() 的 .catch() 中，保存并恢复音量，即使第二次 play() 也失败。

### 方案 B：移除立即 tryPlay()，只靠用户交互
不移除，因为用户期望的 mute/unmute 激活策略需要立即尝试。

### 方案 C：使用 AudioContext 解锁
创建 AudioContext，在用户首次交互时 resume() 来解锁音频系统。

**选择方案 A + C 组合**：修复音量恢复问题，同时添加 AudioContext 解锁作为后备。