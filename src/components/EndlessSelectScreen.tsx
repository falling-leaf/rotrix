import type { EndlessKind } from '../App';

interface EndlessStatData {
  cleared: number;
  bestTime: number;  // seconds
  bestSteps: number;
}

interface EndlessSelectScreenProps {
  stats4x4: EndlessStatData;
  stats6x6: EndlessStatData;
  statsHexSmall: EndlessStatData;
  statsHexTri: EndlessStatData;
  onSelect: (kind: EndlessKind) => void;
  onBack: () => void;
}

/** 格式化秒数为 MM:SS */
function fmtTime(seconds: number): string {
  if (seconds <= 0) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** 每行的模式数据 */
const MODE_ROWS: { kind: EndlessKind; name: string; top: number }[] = [
  { kind: '4x4', name: '4×4 矩阵', top: 20 },
  { kind: '6x6', name: '6×6 矩阵', top: 118 },
  { kind: 'hex-small', name: '小型三角矩阵', top: 216 },
  { kind: 'hex-triangle', name: '大型三角矩阵', top: 314 },
];

/** 单个模式行——左侧名称，右侧三列统计 */
function ModeRow({
  name,
  stats,
  top,
  onClick,
}: {
  name: string;
  stats: EndlessStatData;
  top: number;
  onClick: () => void;
}) {
  return (
    <div className="es-row" style={{ top }} onClick={onClick}>
      <div className="es-row-outer">
        <div className="es-row-inner">
          <span className="es-row-name">{name}</span>
          <div className="es-row-stats">
            <div className="es-row-stat">
              <span className="es-row-stat-label">已通过</span>
              <span className="es-row-stat-val">{stats.cleared}</span>
              <span className="es-row-stat-unit">关</span>
            </div>
            <div className="es-row-stat">
              <span className="es-row-stat-label">最短时间</span>
              <span className="es-row-stat-val">{fmtTime(stats.bestTime)}</span>
            </div>
            <div className="es-row-stat">
              <span className="es-row-stat-label">最短步数</span>
              <span className="es-row-stat-val">{stats.bestSteps > 0 ? stats.bestSteps : '--'}</span>
              <span className="es-row-stat-unit">步</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * v0.9.0：无尽模式选择页——4 行垂直排列，每行左侧模式名称 + 右侧三列统计。
 */
export function EndlessSelectScreen({
  stats4x4, stats6x6, statsHexSmall, statsHexTri, onSelect, onBack,
}: EndlessSelectScreenProps) {
  const statsMap: Record<EndlessKind, EndlessStatData> = {
    '4x4': stats4x4,
    '6x6': stats6x6,
    'hex-small': statsHexSmall,
    'hex-triangle': statsHexTri,
  };

  return (
    <div className="level-select-v6">
      <div className="start-canvas">
        {/* ===== 粉色背景矩形 ===== */}
        <div className="pink-bg" />

        {/* ===== 顶部紫色标题牌（多层胶囊） ===== */}
        <div className="ls-title-banner">
          <div className="ls-title-layer1">
            <div className="ls-title-layer2">
              <div className="ls-title-layer3">
                <div className="ls-title-fill">
                  <span className="ls-title-text">选择模式</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== 返回按钮 ===== */}
        <div className="ls-back-btn" onClick={onBack}>
          <div className="ls-back-outer">
            <div className="ls-back-inner">
              <svg className="ls-back-arrow" viewBox="0 0 21 21" fill="none">
                <path d="M 0 10.5 L 21 0 L 21 21 Z" fill="#A900D0" opacity="0.25" transform="translate(1, 1)" />
                <path d="M 0 10.5 L 21 0 L 21 21 Z" fill="white" />
              </svg>
              <span className="ls-back-text">返回</span>
            </div>
          </div>
        </div>

        {/* ===== 面板：4 行垂直排列 ===== */}
        <div className="ls-panel">
          <div className="ls-panel-inner">
            {MODE_ROWS.map((row) => (
              <ModeRow
                key={row.kind}
                name={row.name}
                stats={statsMap[row.kind]}
                top={row.top}
                onClick={() => onSelect(row.kind)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}