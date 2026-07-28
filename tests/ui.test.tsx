/**
 * 冒烟测试 - UI 渲染
 *
 * 验证 React 组件能正确挂载、渲染棋盘和旋钮、响应交互。
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardView } from '../src/components/BoardView';
import { useGame } from '../src/hooks/useGame';
import { getLevel } from '../src/levels/levels';

describe('BoardView 组件渲染', () => {
  it('渲染 16 个色块和 9 个旋钮', () => {
    const level = getLevel(1)!;
    const Wrapper = () => {
      const game = useGame(level);
      return (
        <BoardView
          board={game.board}
          knobs={game.knobs}
          onKnobClick={game.handleKnobClick}
        />
      );
    };
    render(<Wrapper />);
    expect(screen.getAllByRole('button')).toHaveLength(9);
    expect(document.querySelectorAll('.cell')).toHaveLength(16);
  });

  it('点击旋钮改变棋盘状态', () => {
    const level = getLevel(1)!;
    let capturedColors: string[] = [];

    const Wrapper = () => {
      const game = useGame(level);
      capturedColors = game.board.cells.map((c) => c.color);
      return (
        <BoardView
          board={game.board}
          knobs={game.knobs}
          onKnobClick={game.handleKnobClick}
        />
      );
    };
    const { rerender } = render(<Wrapper />);
    const colorsBefore = [...capturedColors];

    const knobButton = screen.getAllByRole('button')[0]; // K00
    fireEvent.click(knobButton);

    rerender(<Wrapper />);
    const colorsAfter = [...capturedColors];

    // 至少有一个色块颜色位置变化
    const changed = colorsBefore.some((c, i) => c !== colorsAfter[i]);
    expect(changed).toBe(true);
  });
});
