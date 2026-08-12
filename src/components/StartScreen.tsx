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

export function StartScreen({ onStart, onEndless, bestScore4x4, bestScore6x6, developerMode, onToggleDeveloperMode }: StartScreenProps) {
  return (
    <div className="start-screen">
      <div className="start-logo">ROTRIX</div>
      <p className="start-tagline">旋转拼图 · 选择你的挑战</p>

      <div className="mode-cards">
        <button className="mode-card campaign" onClick={() => onStart('campaign')}>
          <div className="mode-icon">★</div>
          <div className="mode-name">闯关模式</div>
          <div className="mode-desc">50 关由易到难<br />4x4 → 6x6 → 六边形 → 图案</div>
        </button>

        <div className="mode-group">
          <div className="mode-group-title">无尽模式</div>
          <button className="mode-card endless" onClick={() => onEndless('4x4')}>
            <div className="mode-icon">4×4</div>
            <div className="mode-name">4x4 无尽</div>
            <div className="mode-desc">随机 30 步打乱<br />最佳：{bestScore4x4} 关</div>
          </button>
          <button className="mode-card endless" onClick={() => onEndless('6x6')}>
            <div className="mode-icon">6×6</div>
            <div className="mode-name">6x6 无尽</div>
            <div className="mode-desc">随机 60 步打乱<br />最佳：{bestScore6x6} 关</div>
          </button>
        </div>
      </div>

      {/* v0.5.1：开发者模式开关——调试用，最终版本删除 */}
      <div className="dev-mode-toggle" onClick={onToggleDeveloperMode}>
        <div className={`dev-mode-checkbox ${developerMode ? 'checked' : ''}`}>
          {developerMode && <span className="dev-mode-checkmark">✓</span>}
        </div>
        <span className="dev-mode-label">开发者模式（解锁所有关卡，始终提示教程）</span>
      </div>
    </div>
  );
}
