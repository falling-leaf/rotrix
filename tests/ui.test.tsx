/**
 * 冒烟测试 - UI 渲染
 *
 * v0.1.2 更新：
 * - 旋转动画改由 requestAnimationFrame 逐帧驱动 transform，不再用 CSS keyframe。
 * - 新增测试：overlay 在挂载时按正确网格顺序（行优先 TL,TR,BL,BR）渲染色块，
 *   避免旧实现 BL/BR 颜色对调导致动画 0° 时已错位、到 90° 跳变。
 * - 原有"点击启动动画 + 步数+1"测试保留，手动调用 onAnimationEnd 模拟动画结束。
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BoardView, BoardViewRouter } from '../src/components/BoardView';
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
    // 此时棋盘还未更新（动画未提交）
    expect(capturedGame!.board.cells.map((c) => c.color)).toEqual(colorsBefore);

    // 模拟动画结束（rAF 在 jsdom 中行为不稳定，直接调 onAnimationEnd）
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

  it('旋转 overlay 挂载时按行优先顺序（TL,TR,BL,BR）正确放置色块', () => {
    // v0.1.2 回归测试：旧实现按顺时针 tl/tr/br/bl 渲染，
    // 在 2x2 grid（行优先）下 BL/BR 颜色对调，导致动画 0° 已错位、90° 跳变。
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
    render(<Wrapper />);
    const knob = capturedGame!.knobs[0]; // K00
    // 底层棋盘在旋钮覆盖的 4 格（顺时针 [TL,TR,BR,BL]）的颜色
    const underlying = knob.cells.map((i) => capturedGame!.board.cells[i].color);

    act(() => {
      fireEvent.click(screen.getAllByRole('button')[0]);
    });

    // overlay 挂载后，4 个 rot-cell 内 cell 的颜色应与底层一致，
    // 且 DOM 顺序为 tl,tr,bl,br（行优先）——即 overlay[0..3] 对应 [TL,TR,BL,BR]
    const rotCells = document.querySelectorAll('.rot-cell');
    expect(rotCells.length).toBe(4);
    const positions = Array.from(rotCells).map((c) =>
      Array.from(c.classList).filter((x) => ['tl', 'tr', 'bl', 'br'].includes(x as string))[0],
    );
    expect(positions).toEqual(['tl', 'tr', 'bl', 'br']);
    const overlayColors = Array.from(rotCells).map((c) => {
      const cell = c.querySelector('.cell')!;
      return Array.from(cell.classList).filter((x) =>
        ['red', 'yellow', 'blue', 'green'].includes(x as string),
      )[0];
    });
    // overlay 行优先顺序 [TL,TR,BL,BR] 应对应底层 [TL,TR,BR,BL] 中的 [0,1,3,2]
    expect(overlayColors).toEqual([
      underlying[0],
      underlying[1],
      underlying[3],
      underlying[2],
    ]);
  });

  it('6x6 棋盘渲染 36 色块和 25 旋钮', () => {
    // v0.2.0：6x6 网格渲染测试；v0.2.1：6x6 关卡移至第 11 关
    const level = getLevel(11)!;
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
    expect(screen.getAllByRole('button')).toHaveLength(25);
    expect(document.querySelectorAll('.cell')).toHaveLength(36);
  });

  // v0.3.0：六边形三角形棋盘
  it('六边形棋盘渲染 54 三角形和 19 旋钮', () => {
    const level = getLevel(21)!;
    const Wrapper = () => {
      const game = useGame(level);
      return (
        <BoardViewRouter
          board={game.board}
          knobs={game.knobs}
          onKnobClick={game.handleKnobClick}
          onAnimationEnd={game.onAnimationEnd}
          animating={game.animating}
        />
      );
    };
    render(<Wrapper />);
    expect(screen.getAllByRole('button')).toHaveLength(19);
    expect(document.querySelectorAll('polygon')).toHaveLength(54);
  });

  it('六边形：点击旋钮启动动画，动画结束后步数+1', () => {
    const level = getLevel(21)!;
    let capturedGame: ReturnType<typeof useGame> | null = null;

    const Wrapper = () => {
      const game = useGame(level);
      capturedGame = game;
      return (
        <BoardViewRouter
          board={game.board}
          knobs={game.knobs}
          onKnobClick={game.handleKnobClick}
          onAnimationEnd={game.onAnimationEnd}
          animating={game.animating}
        />
      );
    };
    const { rerender } = render(<Wrapper />);
    const movesBefore = capturedGame!.moveCount;

    const knobButton = screen.getAllByRole('button')[0]; // H0
    act(() => {
      fireEvent.click(knobButton);
    });

    rerender(<Wrapper />);
    // 动画启动后，animating 不为空
    expect(capturedGame!.animating).not.toBeNull();

    // 模拟动画结束
    act(() => {
      capturedGame!.onAnimationEnd();
    });
    rerender(<Wrapper />);

    // 步数 +1
    expect(capturedGame!.moveCount).toBe(movesBefore + 1);
    // animating 清除
    expect(capturedGame!.animating).toBeNull();
  });

  it('六边形：预览模式不渲染旋钮', () => {
    const solved = getLevel(21)!.initial; // 用题目棋盘也行
    render(
      <BoardViewRouter
        board={solved}
        knobs={[]}
        onKnobClick={() => {}}
        preview
        label="目标地图"
      />,
    );
    expect(document.querySelectorAll('.knob')).toHaveLength(0);
    expect(document.querySelectorAll('polygon')).toHaveLength(54);
    expect(screen.getByText('目标地图')).toBeTruthy();
  });

  // v0.3.2：六边形简单版棋盘渲染
  it('六边形简单版棋盘渲染 24 三角形和 7 旋钮', () => {
    const level = getLevel(26)!;
    const Wrapper = () => {
      const game = useGame(level);
      return (
        <BoardViewRouter
          board={game.board}
          knobs={game.knobs}
          onKnobClick={game.handleKnobClick}
          onAnimationEnd={game.onAnimationEnd}
          animating={game.animating}
        />
      );
    };
    render(<Wrapper />);
    expect(screen.getAllByRole('button')).toHaveLength(7);
    expect(document.querySelectorAll('polygon')).toHaveLength(24);
  });

  it('六边形简单版：点击旋钮启动动画，动画结束后步数+1', () => {
    const level = getLevel(26)!;
    let capturedGame: ReturnType<typeof useGame> | null = null;

    const Wrapper = () => {
      const game = useGame(level);
      capturedGame = game;
      return (
        <BoardViewRouter
          board={game.board}
          knobs={game.knobs}
          onKnobClick={game.handleKnobClick}
          onAnimationEnd={game.onAnimationEnd}
          animating={game.animating}
        />
      );
    };
    const { rerender } = render(<Wrapper />);
    const movesBefore = capturedGame!.moveCount;

    const knobButton = screen.getAllByRole('button')[0]; // H0
    act(() => {
      fireEvent.click(knobButton);
    });

    rerender(<Wrapper />);
    expect(capturedGame!.animating).not.toBeNull();

    act(() => {
      capturedGame!.onAnimationEnd();
    });
    rerender(<Wrapper />);

    expect(capturedGame!.moveCount).toBe(movesBefore + 1);
    expect(capturedGame!.animating).toBeNull();
  });

  it('六边形简单版：预览模式不渲染旋钮', () => {
    const solved = getLevel(26)!.initial;
    render(
      <BoardViewRouter
        board={solved}
        knobs={[]}
        onKnobClick={() => {}}
        preview
        label="目标地图"
      />,
    );
    expect(document.querySelectorAll('.knob')).toHaveLength(0);
    expect(document.querySelectorAll('polygon')).toHaveLength(24);
    expect(screen.getByText('目标地图')).toBeTruthy();
  });
});
