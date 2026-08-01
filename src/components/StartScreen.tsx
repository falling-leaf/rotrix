import type { EndlessKind } from '../App';

interface StartScreenProps {
  onStart: (mode: 'campaign') => void;
  onEndless: (kind: EndlessKind) => void;
  /** 无尽模式历史最高通关数 */
  bestScore4x4: number;
  bestScore6x6: number;
}

export function StartScreen({ onStart, onEndless, bestScore4x4, bestScore6x6 }: StartScreenProps) {
  return (
    <div className="start-screen">
      <div className="start-logo">ROTRIX</div>
      <p className="start-tagline">旋转拼图 · 选择你的挑战</p>

      <div className="mode-cards">
        <button className="mode-card campaign" onClick={() => onStart('campaign')}>
          <div className="mode-icon">★</div>
          <div className="mode-name">闯关模式</div>
          <div className="mode-desc">30 关由易到难<br />4x4 → 6x6 → 六边形</div>
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
    </div>
  );
}
