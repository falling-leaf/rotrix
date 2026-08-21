/**
 * v0.9.0：拼图模式主页面。
 *
 * 显示 3×3 网格，每个格子对应一个 6×6 拼图区块的当前状态。
 * 底部有左右切换按钮和（1/1）计数。
 * 点击区块进入该区块的拼图玩法页面。
 */

import type { JigsawState, JigsawTileId } from '../core/jigsaw';
import type { Color } from '../core/types';

interface JigsawScreenProps {
  jigsawState: JigsawState;
  onBack: () => void;
  onSelectTile: (tileId: JigsawTileId) => void;
}

/** 颜色映射到 CSS 类名 */
const COLOR_CLASS: Record<Color, string> = {
  red: 'cell red',
  yellow: 'cell yellow',
  blue: 'cell blue',
  green: 'cell green',
  cyan: 'cell cyan',
  orange: 'cell orange',
};

/** 迷你 6×6 棋盘渲染（只显示色块，无交互） */
function MiniBoard({ cells, dims }: { cells: { color: Color }[]; dims: number[] }) {
  const cols = dims[1] ?? 6;
  return (
    <div
      className="jigsaw-mini-board"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${dims[0] ?? 6}, 1fr)`,
      }}
    >
      {cells.map((cell, i) => (
        <div key={i} className={COLOR_CLASS[cell.color]} />
      ))}
    </div>
  );
}

/** 已完成区块上的勾选标记 */
function CompletedOverlay() {
  return (
    <div className="jigsaw-tile-completed">
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <circle cx="18" cy="18" r="18" fill="#4CAF50" opacity="0.9" />
        <path d="M10 18 L16 24 L26 12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/**
 * 网格居中计算：
 * 粉色背景区域 left=14, width=347, top=80, height=587
 * 标题容器 left=14, width=347 → 中轴在容器内 347/2=173.5px
 * 网格容器 .jigsaw-grid 同样是 left=14, width=347
 * 网格水平中轴 = 173.5px（从容器左边缘算）= 标题中轴
 * 网格 3×100=300px → grid_left = 173.5 - 150 = 23.5px
 *
 * 垂直：导航按钮上界 = 610px
 * 网格下界 = 610 - 15 = 595px
 * 网格 top = 595 - 300 = 295px
 *
 * 区块之间无空隙，仅靠白色边框划分
 */
const TILE_SIZE = 100;
const GRID_START_X = 23.5;
const GRID_START_Y = 28.5;  // 屏幕中心垂直：333.5 - 150(网格半高) - 155(容器top) = 28.5

export function JigsawScreen({ jigsawState, onBack, onSelectTile }: JigsawScreenProps) {
  const { tiles } = jigsawState;

  return (
    <div className="jigsaw-screen">
      <div className="start-canvas">
        {/* ===== 粉色背景矩形 ===== */}
        <div className="pink-bg" style={{ height: '587px', top: '80px' }} />

        {/* ===== 顶部紫色标题牌 ===== */}
        <div className="ls-title-banner">
          <div className="ls-title-layer1">
            <div className="ls-title-layer2">
              <div className="ls-title-layer3">
                <div className="ls-title-fill">
                  <span className="ls-title-text">拼图模式</span>
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

        {/* ===== 3×3 拼图区块网格（无空隙，白色边框划分） ===== */}
        <div className="jigsaw-grid">
          {tiles.map((tile) => {
            const idx = tile.id;
            const row = Math.floor(idx / 3);
            const col = idx % 3;
            const left = GRID_START_X + col * TILE_SIZE;
            const top = GRID_START_Y + row * TILE_SIZE;

            return (
              <div
                key={tile.id}
                className="jigsaw-tile-wrapper"
                style={{
                  left,
                  top,
                  width: TILE_SIZE,
                  height: TILE_SIZE,
                }}
                onClick={() => !tile.completed && onSelectTile(tile.id)}
              >
                <MiniBoard cells={tile.board.cells} dims={tile.board.dims} />
                {tile.completed && <CompletedOverlay />}
              </div>
            );
          })}
        </div>

        {/* ===== 底部导航 ===== */}
        {/* 左箭头（禁用，仅一个拼图） */}
        <div className="ls-nav-btn ls-nav-disabled" style={{ left: 84, top: 610 }}>
          <div className="ls-nav-outer">
            <div className="ls-nav-inner">
              <svg className="ls-nav-arrow" viewBox="0 0 21 21" fill="none">
                <path d="M 0 10.5 L 21 0 L 21 21 Z" fill="#A900D0" opacity="0.25" transform="translate(0.5, 0.5)" />
                <path d="M 0 10.5 L 21 0 L 21 21 Z" fill="white" />
              </svg>
            </div>
          </div>
        </div>

        {/* 计数提示矩形 1/1 */}
        <div className="jigsaw-counter" style={{ left: 141, top: 610 }}>
          <div className="jigsaw-counter-outer">
            <div className="jigsaw-counter-inner">
              <span className="jigsaw-counter-text">1 / 1</span>
            </div>
          </div>
        </div>

        {/* 右箭头（禁用，仅一个拼图） */}
        <div className="ls-nav-btn ls-nav-disabled" style={{ left: 222, top: 610 }}>
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