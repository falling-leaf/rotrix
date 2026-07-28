import { useCallback, useMemo, useRef, useState } from 'react';
import type { Board, Knob, Level, Move } from '../core/types';
import { applyMove } from '../core/board';
import { square4x4 } from '../core/topology';

/** 动画状态：正在旋转哪个旋钮 */
export interface AnimationState {
  knob: Knob;
  direction: 'CW' | 'CCW';
}

/**
 * 游戏主 hook：管理棋盘状态、旋钮点击、移动历史、胜利判定、旋转动画。
 *
 * 旋转动画流程：
 * 1. 点击旋钮 → 设 animatingRef + setAnimating（不立即改棋盘）
 * 2. 动画结束 onAnimationEnd → 读 ref 获取旋钮，更新棋盘/历史/步数，清 ref + setAnimating(null)
 *
 * 步数 bug 修复（v0.1.1）：
 * 原实现将 setHistory/setMoveCount 放在 setBoard 的 updater 函数内，
 * React 18 StrictMode 开发模式下双调用 updater body 导致步数 +2。
 * 修复：用 ref 存储动画状态，所有 state setter 在顶层独立调用，
 * 不嵌套在任何 updater body 内。
 */
export function useGame(level: Level) {
  const topology = useMemo(() => square4x4(), []);
  const knobs = useMemo(() => topology.knobs(), [topology]);
  const [board, setBoard] = useState<Board>(() => ({
    dims: [...level.initial.dims],
    cells: level.initial.cells.map((c) => ({ ...c })),
  }));
  const [history, setHistory] = useState<Move[]>([]);
  const [won, setWon] = useState(false);
  const [animating, setAnimating] = useState<AnimationState | null>(null);
  const [moveCount, setMoveCount] = useState(0);

  // 用 ref 存动画状态，避免在 updater body 内嵌套 setState
  const animatingRef = useRef<AnimationState | null>(null);

  const checkWin = useCallback(
    (b: Board) => level.goal.satisfied(b, topology),
    [level, topology],
  );

  /**
   * 点击旋钮：启动旋转动画，不立即修改棋盘。
   */
  const handleKnobClick = useCallback(
    (knob: Knob) => {
      if (animatingRef.current || won) return;
      const state: AnimationState = { knob, direction: 'CW' };
      animatingRef.current = state;
      setAnimating(state);
    },
    [won],
  );

  /**
   * 旋转动画结束后调用：更新棋盘、记录步数、判定胜利。
   * 所有 state setter 在顶层独立调用，不嵌套在任何 updater body 内。
   * setWon 是幂等的，即使被 StrictMode 双调用 updater 时在内部触发也无害。
   */
  const onAnimationEnd = useCallback(() => {
    const current = animatingRef.current;
    if (!current) return;
    animatingRef.current = null;

    const { knob, direction } = current;
    const move: Move = { knobId: knob.id, direction };

    // 更新棋盘（updater 是纯函数，StrictMode 双调用无副作用）
    // setWon 放在 updater 内是安全的：它是幂等的（true → true）
    setBoard((prev) => {
      const next = applyMove(prev, knob, direction);
      if (level.goal.satisfied(next, topology)) {
        setWon(true);
      }
      return next;
    });

    // 更新历史和步数 —— 顶层独立调用，各只派发一次
    setHistory((h) => [...h, move]);
    setMoveCount((c) => c + 1);

    setAnimating(null);
  }, [level, topology]);

  const reset = useCallback(() => {
    animatingRef.current = null;
    setBoard({
      dims: [...level.initial.dims],
      cells: level.initial.cells.map((c) => ({ ...c })),
    });
    setHistory([]);
    setMoveCount(0);
    setWon(false);
    setAnimating(null);
  }, [level]);

  return {
    board,
    knobs,
    topology,
    history,
    moveCount,
    won,
    animating,
    handleKnobClick,
    onAnimationEnd,
    reset,
    checkWin,
  };
}
