import { useState } from 'react';
import { isLevelUnlocked } from '../hooks/useProgress';

interface LevelSelectScreenProps {
  completed: Set<number>;
  stars: Record<number, number>;
  onSelect: (levelId: number) => void;
  onBack: () => void;
  developerMode: boolean;
}

/** 关卡显示顺序：1-50, 51 */
const DISPLAY_IDS = [
  ...Array.from({ length: 50 }, (_, i) => i + 1),
  51,
];

const LEVELS_PER_PAGE = 24; // 4 columns × 6 rows
const TOTAL_PAGES = Math.ceil(DISPLAY_IDS.length / LEVELS_PER_PAGE);

/** 锁图标 SVG（46×46 viewBox） */
function LockIcon() {
  return (
    <svg width="46" height="46" viewBox="-23 -23 46 46" fill="none">
      {/* Lock ring shadow */}
      <rect x="-14" y="-23" width="28" height="22" rx="10" fill="#D7AF00" opacity="0.3" />
      {/* Lock ring outer */}
      <rect x="-15" y="-24" width="30" height="22" rx="10" fill="#FFD30A" />
      {/* Lock ring highlight */}
      <rect x="-13" y="-26" width="26" height="4" rx="2" fill="#FFE44D" opacity="0.4" />
      {/* Lock ring hole */}
      <rect x="-11" y="-22" width="22" height="18" rx="8" fill="#C900D7" />
      {/* Lock body shadow */}
      <rect x="-18" y="14" width="36" height="8" rx="4" fill="#D7AF00" opacity="0.4" />
      {/* Lock body */}
      <rect x="-19" y="-4" width="38" height="26" rx="9" fill="#FFD30A" />
      {/* Lock body highlight */}
      <rect x="-17" y="-2" width="34" height="6" rx="3" fill="#FFE44D" opacity="0.15" />
      {/* Keyhole */}
      <circle cx="0" cy="8" r="3.5" fill="white" />
      <rect x="-2" y="9" width="4" height="6" rx="2" fill="white" />
      {/* Highlight dots */}
      <circle cx="-12" cy="2" r="2" fill="white" />
      <circle cx="12" cy="2" r="2" fill="white" />
    </svg>
  );
}

/** 已解锁关卡——黄色圆角矩形 + 数字 */
function LevelCell({ id, cleared }: { id: number; cleared: boolean }) {
  return (
    <div className="level-cell-unlocked">
      <span className="level-cell-num">{id}</span>
      {cleared && <span className="level-cell-check">✓</span>}
    </div>
  );
}

/**
 * 单颗星——v0.8.1 改用 star.png
 * 三颗星 + 2×2px 间隙 = 14+2+14+2+14 = 46px，等于关卡方框宽度。
 */
function Star({ filled }: { filled: boolean }) {
  return (
    <img
      src="/star.png"
      width="14"
      height="14"
      alt="★"
      style={{ opacity: filled ? 1 : 0.3, display: 'block' }}
    />
  );
}

/** 三星条（三颗星水平排列，filledCount 控制点亮前几颗） */
function StarBar({ filledCount }: { filledCount: number }) {
  return (
    <div className="level-star-bar">
      <Star filled={filledCount >= 1} />
      <Star filled={filledCount >= 2} />
      <Star filled={filledCount >= 3} />
    </div>
  );
}

/**
 * v0.7.0：选关界面美术设计重构。
 * 设计参考：docs/v0.7.0_level-select_design.svg
 * 固定 375×667 画布，缩放适配屏幕。
 * v0.8.0：新增星级评定——每关下方显示三颗星，白色轮廓，14px 完美嵌入 46px 方框。
 */
export function LevelSelectScreen({
  completed, stars, onSelect, onBack, developerMode,
}: LevelSelectScreenProps) {
  const [page, setPage] = useState(0);
  const isFirstPage = page === 0;
  const isLastPage = page === TOTAL_PAGES - 1;

  const pageLevels = DISPLAY_IDS.slice(
    page * LEVELS_PER_PAGE,
    (page + 1) * LEVELS_PER_PAGE,
  );

  // 4×6 grid positions
  const gridCols = [90, 155, 220, 285];
  const gridRows = [218, 288, 358, 428, 498, 568];

  return (
    <div className="level-select-v6">
      <div className="start-canvas">
        {/* ===== 粉色背景矩形 ===== */}
        <div className="pink-bg" />

        {/* ===== 顶部紫色标题牌 ===== */}
        <div className="ls-title-banner">
          <div className="ls-title-layer1">
            <div className="ls-title-layer2">
              <div className="ls-title-layer3">
                <div className="ls-title-fill">
                  <span className="ls-title-text">选择关卡</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== 返回按钮（圆角矩形，左侧箭头 + 右侧"返回"） ===== */}
        <div className="ls-back-btn" onClick={onBack}>
          <div className="ls-back-outer">
            <div className="ls-back-inner">
              {/* 左侧箭头 */}
              <svg className="ls-back-arrow" viewBox="0 0 21 21" fill="none">
                <path d="M 0 10.5 L 21 0 L 21 21 Z" fill="#A900D0" opacity="0.25" transform="translate(1, 1)" />
                <path d="M 0 10.5 L 21 0 L 21 21 Z" fill="white" />
              </svg>
              {/* 右侧文字 */}
              <span className="ls-back-text">返回</span>
            </div>
          </div>
        </div>

        {/* ===== 选关面板 ===== */}
        <div className="ls-panel">
          <div className="ls-panel-inner">
            {/* 4×6 关卡网格 */}
            {pageLevels.map((id, index) => {
              const row = Math.floor(index / 4);
              const col = index % 4;
              const cx = gridCols[col];
              const cy = gridRows[row];
              const unlocked = isLevelUnlocked(id, completed, developerMode);
              const cleared = completed.has(id);
              const starCount = stars[id] ?? 0;

              return (
                <div
                  key={id}
                  className={`ls-cell-wrapper ${unlocked ? 'ls-unlocked' : 'ls-locked'}`}
                  style={{
                    left: cx - 27 - 23,
                    top: cy - 178 - 23,
                    width: 46,
                    height: 46,
                  }}
                  onClick={() => unlocked && onSelect(id)}
                >
                  {unlocked ? (
                    <>
                      <LevelCell id={id} cleared={cleared} />
                      {/* v0.8.0：星级显示——仅已通关关卡显示星星，与关卡方框下界重叠 */}
                      {cleared && (
                        <div
                          className="ls-star-container"
                          style={{
                            position: 'absolute',
                            bottom: -7,
                            left: '50%',
                            transform: 'translateX(-50%)',
                          }}
                        >
                          <StarBar filledCount={starCount} />
                        </div>
                      )}
                    </>
                  ) : (
                    <LockIcon />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ===== 底部导航按钮 ===== */}
        {/* 左按钮：上一页 */}
        <div
          className={`ls-nav-btn ${isFirstPage ? 'ls-nav-disabled' : ''}`}
          style={{ left: 124, top: 610.5 }}
          onClick={() => !isFirstPage && setPage(p => p - 1)}
        >
          <div className="ls-nav-outer">
            <div className="ls-nav-inner">
              <svg className="ls-nav-arrow" viewBox="0 0 21 21" fill="none">
                <path d="M 0 10.5 L 21 0 L 21 21 Z" fill="#A900D0" opacity="0.25" transform="translate(0.5, 0.5)" />
                <path d="M 0 10.5 L 21 0 L 21 21 Z" fill="white" />
              </svg>
            </div>
          </div>
        </div>

        {/* 右按钮：下一页 */}
        <div
          className={`ls-nav-btn ${isLastPage ? 'ls-nav-disabled' : ''}`}
          style={{ left: 197, top: 610.5 }}
          onClick={() => !isLastPage && setPage(p => p + 1)}
        >
          <div className="ls-nav-outer">
            <div className="ls-nav-inner">
              <svg className="ls-nav-arrow" viewBox="0 0 21 21" fill="none">
                <path d="M 21 10.5 L 0 0 L 0 21 Z" fill="#A900D0" opacity="0.25" transform="translate(-0.5, 0.5)" />
                <path d="M 21 10.5 L 0 0 L 0 21 Z" fill="white" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}