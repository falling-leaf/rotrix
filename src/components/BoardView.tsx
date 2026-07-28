import { memo, useMemo } from 'react';
import type { Board, Knob } from '../core/types';

interface BoardViewProps {
  board: Board;
  knobs: Knob[];
  onKnobClick: (knob: Knob) => void;
  disabled?: boolean;
}

/**
 * 棋盘渲染组件。
 * - cell-grid: 渲染 4x4 色块
 * - knob-layer: 绝对定位的旋钮层，位于 2x2 区域中心
 *
 * 旋钮位置计算：center = [row+0.5, col+0.5]，
 * 转换为百分比 = (coord + 0.5) / 4 * 100。
 * 注意 CSS 中 top/left 百分比是相对父容器（board）的。
 */
function BoardViewInner({ board, knobs, onKnobClick, disabled }: BoardViewProps) {
  const cells = useMemo(() => board.cells, [board.cells]);

  return (
    <div className="board-wrapper">
      <div className="board">
        <div className="cell-grid">
          {cells.map((cell, i) => (
            <div key={i} className={`cell ${cell.color}`} />
          ))}
        </div>
        <div className="knob-layer">
          {knobs.map((knob) => {
            // center = [r+0.5, c+0.5] → 百分比
            const top = ((knob.center[0] + 0.5) / board.dims[0]) * 100;
            const left = ((knob.center[1] + 0.5) / board.dims[1]) * 100;
            return (
              <button
                key={knob.id}
                className="knob"
                style={{ top: `${top}%`, left: `${left}%` }}
                onClick={() => onKnobClick(knob)}
                disabled={disabled}
                aria-label={`旋钮 ${knob.id}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const BoardView = memo(BoardViewInner);
