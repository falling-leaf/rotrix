import type { EndlessKind } from '../App';

interface StartScreenProps {
  onStart: (mode: 'campaign') => void;
  onEndless: (kind: EndlessKind) => void;
  /** 无尽模式历史最高通关数 */
  bestScore4x4: number;
  bestScore6x6: number;
  /** v0.5.1：开发者模式——所有关卡解锁，始终提示新手教程 */
  developerMode: boolean;
  onToggleDeveloperMode: () => void;
}

/**
 * v0.6.0：首页视觉重设计。
 * 固定 375×667 画布，缩放适配屏幕。
 * 设计参考：docs/v0.6.0_homepage_design.svg
 */
export function StartScreen({
  onStart, onEndless, bestScore4x4, bestScore6x6, developerMode, onToggleDeveloperMode,
}: StartScreenProps) {
  return (
    <div className="start-screen-v6">
      <div className="start-canvas">
        {/* ===== 粉色背景矩形 ===== */}
        <div className="pink-bg" />

        {/* ===== 拼图装饰 ===== */}
        <svg className="puzzle-decorations" viewBox="0 0 375 667" preserveAspectRatio="xMidYMid meet">
          <defs>
            {/* 拼图块 1：矩形带凸起/凹陷 */}
            <path id="pz1" d="M0,15 C0,6.7 6.7,0 15,0 h10 c3,0 5,2 5,5 c0,3 2,5 5,5 c3,0 5,-2 5,-5 c0,-3 2,-5 5,-5 h10 c8.3,0 15,6.7 15,15 v10 c0,3 -2,5 -5,5 c-3,0 -5,2 -5,5 c0,3 2,5 5,5 c3,0 5,2 5,5 v10 c0,8.3 -6.7,15 -15,15 h-10 c-3,0 -5,-2 -5,-5 c0,-3 -2,-5 -5,-5 c-3,0 -5,2 -5,5 c0,3 -2,5 -5,5 h-10 c-8.3,0 -15,-6.7 -15,-15 v-10 c0,-3 2,-5 5,-5 c3,0 5,-2 5,-5 c0,-3 -2,-5 -5,-5 c-3,0 -5,-2 -5,-5 z" />
            <path id="pz2" d="M0,12 C0,5.4 5.4,0 12,0 h10 c3,0 5,2 5,5 c0,3 2,5 5,5 c3,0 5,-2 5,-5 c0,-3 2,-5 5,-5 h6 c6.6,0 12,5.4 12,12 v10 c0,3 -2,5 -5,5 c-3,0 -5,2 -5,5 c0,3 2,5 5,5 c3,0 5,2 5,5 v6 c0,6.6 -5.4,12 -12,12 h-6 c-3,0 -5,-2 -5,-5 c0,-3 -2,-5 -5,-5 c-3,0 -5,2 -5,5 c0,3 -2,5 -5,5 h-10 c-6.6,0 -12,-5.4 -12,-12 v-6 c0,-3 2,-5 5,-5 c3,0 5,-2 5,-5 c0,-3 -2,-5 -5,-5 c-3,0 -5,-2 -5,-5 z" />
            <path id="pz3" d="M0,10 C0,4.5 4.5,0 10,0 h10 c3,0 5,2 5,4 c0,2 2,4 5,4 c3,0 5,-2 5,-4 c0,-2 2,-4 5,-4 h10 c5.5,0 10,4.5 10,10 v10 c0,3 -2,5 -5,5 c-3,0 -5,2 -5,5 c0,3 2,5 5,5 c3,0 5,2 5,5 v15 c0,5.5 -4.5,10 -10,10 h-10 c-3,0 -5,-2 -5,-5 c0,-3 -2,-5 -5,-5 c-3,0 -5,2 -5,5 c0,3 -2,5 -5,5 h-10 c-5.5,0 -10,-4.5 -10,-10 v-15 c0,-3 2,-5 5,-5 c3,0 5,-2 5,-5 c0,-3 -2,-5 -5,-5 c-3,0 -5,-2 -5,-5 z" />
            <path id="pz4" d="M0,15 C0,6.7 6.7,0 15,0 h15 c3,0 5,2 5,5 c0,3 2,5 5,5 c3,0 5,-2 5,-5 c0,-3 2,-5 5,-0 h15 c8.3,0 15,6.7 15,15 v10 c0,3 -2,5 -5,5 c-3,0 -5,2 -5,5 c0,3 2,5 5,5 c3,0 5,2 5,5 v10 c0,8.3 -6.7,15 -15,15 h-15 c-3,0 -5,-2 -5,-5 c0,-3 -2,-5 -5,-5 c-3,0 -5,2 -5,5 c0,3 -2,5 -5,5 h-15 c-8.3,0 -15,-6.7 -15,-15 v-10 c0,-3 2,-5 5,-5 c3,0 5,-2 5,-5 c0,-3 -2,-5 -5,-5 c-3,0 -5,-2 -5,-5 z" />
          </defs>

          {/* 1. 标题牌右下方 */}
          <use href="#pz1" x="195" y="115" fill="#F2B4F3" opacity="0.65" transform="rotate(8, 235, 150) scale(1.1)" />
          {/* 2. 右上 */}
          <use href="#pz2" x="278" y="195" fill="#F2B4F3" opacity="0.6" transform="rotate(-5, 308, 225)" />
          {/* 3. 左中，按钮1和2之间 */}
          <use href="#pz3" x="52" y="340" fill="#F2B4F3" opacity="0.7" transform="rotate(-10, 82, 372) scale(1.2)" />
          {/* 4. 中央，按钮2后面 */}
          <use href="#pz2" x="200" y="360" fill="#F2B4F3" opacity="0.55" transform="rotate(12, 230, 390)" />
          {/* 5. 右中，按钮2和3之间 */}
          <use href="#pz4" x="260" y="430" fill="#F2B4F3" opacity="0.65" transform="rotate(-8, 300, 465)" />
          {/* 6. 左下 */}
          <use href="#pz3" x="62" y="510" fill="#F2B4F3" opacity="0.7" transform="rotate(6, 92, 542) scale(1.15)" />
          {/* 7. 右下 */}
          <use href="#pz4" x="235" y="560" fill="#F2B4F3" opacity="0.65" transform="rotate(-12, 275, 595)" />
        </svg>

        {/* ===== 顶部黄色标题牌（无白色外框，与粉色矩形左右对齐） ===== */}
        <div className="title-banner">
          <div className="title-banner-inner">
            <div className="title-banner-fill">
              <span className="title-text">ROTRIX</span>
              <span className="title-highlight-1" />
              <span className="title-highlight-2" />
            </div>
          </div>
        </div>

        {/* ===== 三个黄色胶囊按钮（1.5x） ===== */}
        <button className="mode-btn" style={{ top: '250px' }} onClick={() => onStart('campaign')}>
          <div className="mode-btn-outer">
            <div className="mode-btn-inner">
              <div className="mode-btn-fill">
                <span className="mode-btn-label">闯关模式</span>
                <span className="btn-highlight" />
              </div>
            </div>
          </div>
        </button>

        <button className="mode-btn" style={{ top: '397px' }} onClick={() => onEndless('4x4')}>
          <div className="mode-btn-outer">
            <div className="mode-btn-inner">
              <div className="mode-btn-fill">
                <span className="mode-btn-label">4x4 无尽</span>
                <span className="mode-btn-sub">最佳：{bestScore4x4} 关</span>
                <span className="btn-highlight" />
              </div>
            </div>
          </div>
        </button>

        <button className="mode-btn" style={{ top: '544px' }} onClick={() => onEndless('6x6')}>
          <div className="mode-btn-outer">
            <div className="mode-btn-inner">
              <div className="mode-btn-fill">
                <span className="mode-btn-label">6x6 无尽</span>
                <span className="mode-btn-sub">最佳：{bestScore6x6} 关</span>
                <span className="btn-highlight" />
              </div>
            </div>
          </div>
        </button>

        {/* ===== 开发者模式开关 ===== */}
        <div className="dev-toggle" onClick={onToggleDeveloperMode}>
          <div className={`dev-toggle-box ${developerMode ? 'checked' : ''}`}>
            {developerMode && <span className="dev-toggle-check">✓</span>}
          </div>
          <span className="dev-toggle-label">开发者模式</span>
        </div>
      </div>
    </div>
  );
}