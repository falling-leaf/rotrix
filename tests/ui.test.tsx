/**
 * 冒烟测试 - UI 渲染
 *
 * v0.1.1 更新：适配新的动画流程（handleKnobClick → animating → onAnimationEnd）。
 * 测试中需手动调用 onAnimationEnd 来模拟动画结束。
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BoardView } from '../src/components/BoardView';
import { useGame } from '../src/hooks/useGame';
import { getLevel } from '../src/levels/levels';
import { createSolvedSquare4x4 } from '../src/core/board';

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
          onAnimationEnd={game.onAnimationEnd}
          animating={game.animating}
        />
      );
    };
    render(<Wrapper />);
    expect(screen.getAllByRole('button')).toHaveLength(9);
    expect(document.querySelectorAll('.cell')).toHaveLength(16);
  });

  it('预览模式不渲染旋钮', () => {
    const solved = createSolvedSquare4x4();
    render(
      <BoardView
        board={solved}
        knobs={[]}
        onKnobClick={() => {}}
        preview
        label="目标地图"
      />,
    );
    expect(document.querySelectorAll('.knob')).toHaveLength(0);
    expect(document.querySelectorAll('.cell')).toHaveLength(16);
    expect(screen.getByText('目标地图')).toBeTruthy();
  });

  it('点击旋钮启动动画，动画结束后棋盘改变且步数+1', () => {
    const level = getLevel(1)!;
    let capturedGame: ReturnType<typeof useGame> | null = null;

    const Wrapper = () => {
      const game = useGame(level);
      capturedGame = game;
      return (
        <BoardView
          board={game.board}
          knobs={game.knobs}
          onKnobClick={game.handleKnobClick}
          onAnimationEnd={game.onAnimationEnd}
          animating={game.animating}
        />
      );
    };
    const { rerender } = render(<Wrapper />);
    const colorsBefore = [...capturedGame!.board.cells.map((c) => c.color)];
    const movesBefore = capturedGame!.moveCount;

    const knobButton = screen.getAllByRole('button')[0]; // K00
    act(() => {
      fireEvent.click(knobButton);
    });

    rerender(<Wrapper />);
    // 动画启动后，animating 不为空
    expect(capturedGame!.animating).not.toBeNull();
    // 此时棋盘还未更新
    expect(capturedGame!.board.cells.map((c) => c.color)).toEqual(colorsBefore);

    // 模拟动画结束
    act(() => {
      capturedGame!.onAnimationEnd();
    });
    rerender(<Wrapper />);

    // 动画结束后棋盘改变
    const colorsAfter = capturedGame!.board.cells.map((c) => c.color);
    const changed = colorsBefore.some((c, i) => c !== colorsAfter[i]);
    expect(changed).toBe(true);

    // 步数 +1（修复 bug 验证）
    expect(capturedGame!.moveCount).toBe(movesBefore + 1);
  });
});
