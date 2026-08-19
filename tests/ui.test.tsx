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
      const game = useGame(level, 0, false, () => false);
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
      const game = useGame(level, 0, false, () => false);
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
      const game = useGame(level, 0, false, () => false);
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
      const game = useGame(level, 0, false, () => false);
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

  // v0.3.0/v0.3.3/v0.7.1：六边形困难版棋盘渲染（第 41 关，N=3，54 三角形 / 19 旋钮）
  it('六边形棋盘渲染 54 三角形和 19 旋钮', () => {
    const level = getLevel(41)!;
    const Wrapper = () => {
      const game = useGame(level, 0, false, () => false);
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
    const level = getLevel(41)!;
    let capturedGame: ReturnType<typeof useGame> | null = null;

    const Wrapper = () => {
      const game = useGame(level, 0, false, () => false);
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

  it('六边形：预览模式不渲染旋钮', () => {
    const solved = getLevel(41)!.initial;
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

  // v0.3.2/v0.3.3/v0.7.1：六边形简单版棋盘渲染（第 36 关，N=2，24 三角形 / 7 旋钮）
  it('六边形简单版棋盘渲染 24 三角形和 7 旋钮', () => {
    const level = getLevel(36)!;
    const Wrapper = () => {
      const game = useGame(level, 0, false, () => false);
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
    const level = getLevel(36)!;
    let capturedGame: ReturnType<typeof useGame> | null = null;

    const Wrapper = () => {
      const game = useGame(level, 0, false, () => false);
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
    const solved = getLevel(36)!.initial;
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

  // v0.3.4：旋转方向切换组件 + CCW 旋转逻辑测试
  describe('v0.3.4 旋转方向切换', () => {
    it('默认旋转方向为 CW', () => {
      const level = getLevel(1)!;
      const Wrapper = () => {
        const game = useGame(level, 0, false, () => false);
        return (
          <BoardView
            board={game.board}
            knobs={game.knobs}
            onKnobClick={game.handleKnobClick}
            onAnimationEnd={game.onAnimationEnd}
            animating={game.animating}
            direction={game.rotationDirection}
          />
        );
      };
      render(<Wrapper />);
      // 默认方向为 CW，旋钮应带 knob-cw 类（而非 knob-ccw）
      const knobs = document.querySelectorAll('.knob');
      expect(knobs.length).toBeGreaterThan(0);
      expect(knobs[0].classList.contains('knob-cw')).toBe(true);
      expect(knobs[0].classList.contains('knob-ccw')).toBe(false);
    });

    it('切换方向后旋钮类变为 knob-ccw', () => {
      const level = getLevel(1)!;
      let capturedGame: ReturnType<typeof useGame> | null = null;
      const Wrapper = () => {
        const game = useGame(level, 0, false, () => false);
        capturedGame = game;
        return (
          <BoardView
            board={game.board}
            knobs={game.knobs}
            onKnobClick={game.handleKnobClick}
            onAnimationEnd={game.onAnimationEnd}
            animating={game.animating}
            direction={game.rotationDirection}
          />
        );
      };
      const { rerender } = render(<Wrapper />);
      expect(capturedGame!.rotationDirection).toBe('CW');

      act(() => {
        capturedGame!.toggleRotationDirection();
      });
      rerender(<Wrapper />);

      expect(capturedGame!.rotationDirection).toBe('CCW');
      const knobs = document.querySelectorAll('.knob');
      expect(knobs[0].classList.contains('knob-ccw')).toBe(true);
      expect(knobs[0].classList.contains('knob-cw')).toBe(false);
    });

    it('CCW 方向下点击旋钮，动画结束后棋盘按逆时针旋转', () => {
      const level = getLevel(1)!;
      let capturedGame: ReturnType<typeof useGame> | null = null;
      const Wrapper = () => {
        const game = useGame(level, 0, false, () => false);
        capturedGame = game;
        return (
          <BoardView
            board={game.board}
            knobs={game.knobs}
            onKnobClick={game.handleKnobClick}
            onAnimationEnd={game.onAnimationEnd}
            animating={game.animating}
            direction={game.rotationDirection}
          />
        );
      };
      const { rerender } = render(<Wrapper />);

      // 先切换到 CCW
      act(() => {
        capturedGame!.toggleRotationDirection();
      });
      rerender(<Wrapper />);
      expect(capturedGame!.rotationDirection).toBe('CCW');

      // 记录动画状态中的方向
      const colorsBefore = [...capturedGame!.board.cells.map((c) => c.color)];
      const knobButton = screen.getAllByRole('button')[0];
      act(() => {
        fireEvent.click(knobButton);
      });
      rerender(<Wrapper />);

      // animating.direction 应为 CCW
      expect(capturedGame!.animating).not.toBeNull();
      expect(capturedGame!.animating!.direction).toBe('CCW');

      // 模拟动画结束
      act(() => {
        capturedGame!.onAnimationEnd();
      });
      rerender(<Wrapper />);

      // 棋盘应发生改变（CCW 旋转同样改变排列）
      const colorsAfter = capturedGame!.board.cells.map((c) => c.color);
      const changed = colorsBefore.some((c, i) => c !== colorsAfter[i]);
      expect(changed).toBe(true);
    });

    it('CW 旋转后再 CCW 旋转可还原棋盘（CW³=CCW 等价）', () => {
      // 验证切换逻辑正确：3次CW = 1次CCW，因此 1次CW + 1次CCW = 恢复原状
      const level = getLevel(1)!;
      let capturedGame: ReturnType<typeof useGame> | null = null;
      const Wrapper = () => {
        const game = useGame(level, 0, false, () => false);
        capturedGame = game;
        return (
          <BoardView
            board={game.board}
            knobs={game.knobs}
            onKnobClick={game.handleKnobClick}
            onAnimationEnd={game.onAnimationEnd}
            animating={game.animating}
            direction={game.rotationDirection}
          />
        );
      };
      const { rerender } = render(<Wrapper />);

      const colorsBefore = [...capturedGame!.board.cells.map((c) => c.color)];
      const knobButton = screen.getAllByRole('button')[0];

      // 1 次 CW 旋转
      expect(capturedGame!.rotationDirection).toBe('CW');
      act(() => {
        fireEvent.click(knobButton);
      });
      rerender(<Wrapper />);
      act(() => {
        capturedGame!.onAnimationEnd();
      });
      rerender(<Wrapper />);

      // 此时棋盘应已改变
      const colorsAfterCW = capturedGame!.board.cells.map((c) => c.color);
      expect(colorsBefore.some((c, i) => c !== colorsAfterCW[i])).toBe(true);

      // 切换到 CCW
      act(() => {
        capturedGame!.toggleRotationDirection();
      });
      rerender(<Wrapper />);
      expect(capturedGame!.rotationDirection).toBe('CCW');

      // 1 次 CCW 旋转（应恢复原状）
      act(() => {
        fireEvent.click(knobButton);
      });
      rerender(<Wrapper />);
      act(() => {
        capturedGame!.onAnimationEnd();
      });
      rerender(<Wrapper />);

      const colorsAfterCCW = capturedGame!.board.cells.map((c) => c.color);
      expect(colorsAfterCCW).toEqual(colorsBefore);
    });
  });

  // v0.3.5：对换道具测试
  describe('v0.3.5 对换道具', () => {
    it('初始状态：对换模式关闭，剩余次数为 5', () => {
      const level = getLevel(1)!;
      let capturedGame: ReturnType<typeof useGame> | null = null;
      const Wrapper = () => {
        const game = useGame(level, 0, false, () => false);
        capturedGame = game;
        return (
          <BoardView
            board={game.board}
            knobs={game.knobs}
            onKnobClick={game.handleKnobClick}
            onAnimationEnd={game.onAnimationEnd}
            animating={game.animating}
            swapMode={game.swapMode}
            swapSelection={game.swapSelection}
            swapAnimating={game.swapAnimating}
            onCellClick={game.handleCellClick}
            onSwapAnimationEnd={game.onSwapAnimationEnd}
          />
        );
      };
      render(<Wrapper />);
      expect(capturedGame!.swapMode).toBe(false);
      expect(capturedGame!.swapsLeft).toBe(5);
      expect(capturedGame!.swapSelection).toBeNull();
      expect(capturedGame!.swapAnimating).toBeNull();
    });

    it('激活对换模式后，棋盘加 swap-mode 类，格子可点击', () => {
      const level = getLevel(1)!;
      let capturedGame: ReturnType<typeof useGame> | null = null;
      const Wrapper = () => {
        const game = useGame(level, 0, false, () => false);
        capturedGame = game;
        return (
          <BoardView
            board={game.board}
            knobs={game.knobs}
            onKnobClick={game.handleKnobClick}
            onAnimationEnd={game.onAnimationEnd}
            animating={game.animating}
            swapMode={game.swapMode}
            swapSelection={game.swapSelection}
            swapAnimating={game.swapAnimating}
            onCellClick={game.handleCellClick}
            onSwapAnimationEnd={game.onSwapAnimationEnd}
          />
        );
      };
      const { rerender } = render(<Wrapper />);

      act(() => {
        capturedGame!.toggleSwapMode();
      });
      rerender(<Wrapper />);

      expect(capturedGame!.swapMode).toBe(true);
      const board = document.querySelector('.board');
      expect(board!.classList.contains('swap-mode')).toBe(true);
      // 格子应有 swap-clickable 类
      const clickable = document.querySelectorAll('.swap-clickable');
      expect(clickable.length).toBe(16);
    });

    it('对换模式下旋钮被禁用', () => {
      const level = getLevel(1)!;
      let capturedGame: ReturnType<typeof useGame> | null = null;
      const Wrapper = () => {
        const game = useGame(level, 0, false, () => false);
        capturedGame = game;
        return (
          <BoardView
            board={game.board}
            knobs={game.knobs}
            onKnobClick={game.handleKnobClick}
            onAnimationEnd={game.onAnimationEnd}
            animating={game.animating}
            swapMode={game.swapMode}
            swapSelection={game.swapSelection}
            swapAnimating={game.swapAnimating}
            onCellClick={game.handleCellClick}
            onSwapAnimationEnd={game.onSwapAnimationEnd}
          />
        );
      };
      const { rerender } = render(<Wrapper />);

      act(() => {
        capturedGame!.toggleSwapMode();
      });
      rerender(<Wrapper />);

      // 所有旋钮都应 disabled
      const knobs = document.querySelectorAll('.knob');
      knobs.forEach((k) => {
        expect((k as HTMLButtonElement).disabled).toBe(true);
      });
    });

    it('选两个格子后触发对换动画，动画结束后棋盘交换且次数-1', () => {
      const level = getLevel(1)!;
      let capturedGame: ReturnType<typeof useGame> | null = null;
      const Wrapper = () => {
        const game = useGame(level, 0, false, () => false);
        capturedGame = game;
        return (
          <BoardView
            board={game.board}
            knobs={game.knobs}
            onKnobClick={game.handleKnobClick}
            onAnimationEnd={game.onAnimationEnd}
            animating={game.animating}
            swapMode={game.swapMode}
            swapSelection={game.swapSelection}
            swapAnimating={game.swapAnimating}
            onCellClick={game.handleCellClick}
            onSwapAnimationEnd={game.onSwapAnimationEnd}
          />
        );
      };
      const { rerender } = render(<Wrapper />);

      // 记录交换前的颜色
      const colorsBefore = [...capturedGame!.board.cells.map((c) => c.color)];
      const swapsBefore = capturedGame!.swapsLeft;

      // 激活对换模式
      act(() => {
        capturedGame!.toggleSwapMode();
      });
      rerender(<Wrapper />);

      // 点击第一个格子（索引 0）
      act(() => {
        capturedGame!.handleCellClick(0);
      });
      rerender(<Wrapper />);
      expect(capturedGame!.swapSelection).toBe(0);

      // 点击第二个格子（索引 15）——触发对换动画
      act(() => {
        capturedGame!.handleCellClick(15);
      });
      rerender(<Wrapper />);

      // swapAnimating 应有值
      expect(capturedGame!.swapAnimating).not.toBeNull();
      expect(capturedGame!.swapAnimating!.indexA).toBe(0);
      expect(capturedGame!.swapAnimating!.indexB).toBe(15);

      // 模拟对换动画结束
      act(() => {
        capturedGame!.onSwapAnimationEnd();
      });
      rerender(<Wrapper />);

      // 棋盘 0 和 15 的颜色应互换
      const colorsAfter = capturedGame!.board.cells.map((c) => c.color);
      expect(colorsAfter[0]).toBe(colorsBefore[15]);
      expect(colorsAfter[15]).toBe(colorsBefore[0]);

      // 次数 -1
      expect(capturedGame!.swapsLeft).toBe(swapsBefore - 1);

      // swapAnimating 已清除
      expect(capturedGame!.swapAnimating).toBeNull();
    });

    it('reset 后对换状态全部重置', () => {
      const level = getLevel(1)!;
      let capturedGame: ReturnType<typeof useGame> | null = null;
      const Wrapper = () => {
        const game = useGame(level, 0, false, () => false);
        capturedGame = game;
        return (
          <BoardView
            board={game.board}
            knobs={game.knobs}
            onKnobClick={game.handleKnobClick}
            onAnimationEnd={game.onAnimationEnd}
            animating={game.animating}
            swapMode={game.swapMode}
            swapSelection={game.swapSelection}
            swapAnimating={game.swapAnimating}
            onCellClick={game.handleCellClick}
            onSwapAnimationEnd={game.onSwapAnimationEnd}
          />
        );
      };
      const { rerender } = render(<Wrapper />);

      // 先消耗一次对换
      act(() => {
        capturedGame!.toggleSwapMode();
      });
      rerender(<Wrapper />);
      act(() => {
        capturedGame!.handleCellClick(0);
      });
      rerender(<Wrapper />);
      act(() => {
        capturedGame!.handleCellClick(15);
      });
      rerender(<Wrapper />);
      act(() => {
        capturedGame!.onSwapAnimationEnd();
      });
      rerender(<Wrapper />);

      expect(capturedGame!.swapsLeft).toBe(4);

      // 重置
      act(() => {
        capturedGame!.reset();
      });
      rerender(<Wrapper />);

      expect(capturedGame!.swapMode).toBe(false);
      expect(capturedGame!.swapSelection).toBeNull();
      expect(capturedGame!.swapAnimating).toBeNull();
      expect(capturedGame!.swapsLeft).toBe(5);
    });

    it('次数耗尽后无法激活对换模式', () => {
      const level = getLevel(1)!;
      let capturedGame: ReturnType<typeof useGame> | null = null;
      const Wrapper = () => {
        const game = useGame(level, 0, false, () => false);
        capturedGame = game;
        return (
          <BoardView
            board={game.board}
            knobs={game.knobs}
            onKnobClick={game.handleKnobClick}
            onAnimationEnd={game.onAnimationEnd}
            animating={game.animating}
            swapMode={game.swapMode}
            swapSelection={game.swapSelection}
            swapAnimating={game.swapAnimating}
            onCellClick={game.handleCellClick}
            onSwapAnimationEnd={game.onSwapAnimationEnd}
          />
        );
      };
      const { rerender } = render(<Wrapper />);

      // 消耗 5 次对换
      for (let i = 0; i < 5; i++) {
        act(() => {
          capturedGame!.toggleSwapMode();
        });
        rerender(<Wrapper />);
        act(() => {
          capturedGame!.handleCellClick(0);
        });
        rerender(<Wrapper />);
        act(() => {
          capturedGame!.handleCellClick(15);
        });
        rerender(<Wrapper />);
        act(() => {
          capturedGame!.onSwapAnimationEnd();
        });
        rerender(<Wrapper />);
      }
      expect(capturedGame!.swapsLeft).toBe(0);

      // 再次尝试激活——应失败
      act(() => {
        capturedGame!.toggleSwapMode();
      });
      rerender(<Wrapper />);
      expect(capturedGame!.swapMode).toBe(false);
    });
  });
});
