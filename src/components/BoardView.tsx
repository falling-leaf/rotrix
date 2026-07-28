import { memo, useMemo } from 'react';
import type { Board, Knob, Color } from '../core/types';
import type { AnimationState } from '../hooks/useGame';

/** 旋转动画时长（ms）——足够感知过程，不至卡顿 */
const ROTATE_DURATION = 350;

interface CellProps {
  color: Color;
  className?: string;
}

function CellBlock({ color, className }: CellProps) {
  return <div className={`cell ${color} ${className ?? ''}`} />;
}

/**
 * 棋盘渲染组件。
 * - cell-grid: 渲染 4x4 色块
 * - knob-layer: 绝对定位的旋钮层
 * - rotate-overlay: 旋转动画层，点击旋钮后覆盖在被旋转的 2x2 区域上
 *
 * 旋钮位置：center = [row+0.5, col+0.5]
 * 百分比换算：top/left = (coord + 0.5) / dims * 100
 */
interface BoardViewProps {
  board: Board;
  knobs: Knob[];
  onKnobClick: (knob: Knob) => void;
  onAnimationEnd?: () => void;
  animating?: AnimationState | null;
  disabled?: boolean;
  /** 是否为预览模式（目标地图），缩小尺寸、禁用旋钮 */
  preview?: boolean;
  /** 预览模式标题 */
  label?: string;
}

function BoardViewInner({
  board,
  knobs,
  onKnobClick,
  onAnimationEnd,
  animating,
  disabled,
  preview = false,
  label,
}: BoardViewProps) {
  const cells = useMemo(() => board.cells, [board.cells]);

  // 计算旋转动画 overlay 的位置和内容
  const rotateOverlay = useMemo(() => {
    if (!animating || preview) return null;
    const knob = animating.knob;
    // 旋钮覆盖的 4 个 cell（顺时针：tl, tr, br, bl）
    const indices = knob.cells;
    const colors = indices.map((i) => board.cells[i].color);
    // 旋钮中心坐标 [r+0.5, c+0.5]，2x2 区域的左上角 = [r, c]
    const r = Math.floor(knob.center[0]);
    const c = Math.floor(knob.center[1]);
    // 转百分比：2x2 区域占棋盘的 50%
    const top = (r / board.dims[0]) * 100;
    const left = (c / board.dims[1]) * 100;
    return { colors, top, left, width: 50, height: 50 };
  }, [animating, board, preview]);

  return (
    <div className={`board-wrapper ${preview ? 'preview' : ''}`}>
      {label && <div className="board-label">{label}</div>}
      <div className="board">
        <div className="cell-grid">
          {cells.map((cell, i) => (
            <CellBlock key={i} color={cell.color} />
          ))}
        </div>

        {/* 旋转动画 overlay：在被旋转的 2x2 区域上叠加旋转层 */}
        {rotateOverlay && (
          <div
            className="rotate-overlay"
            style={{
              top: `${rotateOverlay.top}%`,
              left: `${rotateOverlay.left}%`,
              width: `${rotateOverlay.width}%`,
              height: `${rotateOverlay.height}%`,
              animationDuration: `${ROTATE_DURATION}ms`,
            }}
            onAnimationEnd={onAnimationEnd}
          >
            <div className="rotate-inner">
              <div className="rot-cell tl"><div className={`cell ${rotateOverlay.colors[0]}`} /></div>
              <div className="rot-cell tr"><div className={`cell ${rotateOverlay.colors[1]}`} /></div>
              <div className="rot-cell br"><div className={`cell ${rotateOverlay.colors[2]}`} /></div>
              <div className="rot-cell bl"><div className={`cell ${rotateOverlay.colors[3]}`} /></div>
            </div>
          </div>
        )}

        {!preview && (
          <div className="knob-layer">
            {knobs.map((knob) => {
              const top = ((knob.center[0] + 0.5) / board.dims[0]) * 100;
              const left = ((knob.center[1] + 0.5) / board.dims[1]) * 100;
              return (
                <button
                  key={knob.id}
                  className="knob"
                  style={{ top: `${top}%`, left: `${left}%` }}
                  onClick={() => onKnobClick(knob)}
                  disabled={disabled || !!animating}
                  aria-label={`旋钮 ${knob.id}`}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export const BoardView = memo(BoardViewInner);
