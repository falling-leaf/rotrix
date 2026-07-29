import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Board, Knob, Level, Move, Topology } from '../core/types';
import { applyMove } from '../core/board';
import { getTopologyEntry } from '../core/goals';

/** 动画状态：正在旋转哪个旋钮 */
export interface AnimationState {
  knob: Knob;
  direction: 'CW' | 'CCW';
}

/**
 * v0.2.1：庆祝动画状态。
 * won 为 true 后，BoardView 根据此状态启动对角线波纹动画。
 * 动画持续 CELEBRATE_DURATION 后自动清除。
 */
const CELEBRATE_DURATION = 1400;

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
  // v0.2.0：从拓扑注册表按 level.topologyKind 动态获取拓扑，
  // 不再硬编码 square4x4()，支持 6x6 等新拓扑。
  const topology = useMemo<Topology>(
    () => getTopologyEntry(level.topologyKind).topology(),
    [level.topologyKind],
  );
  const knobs = useMemo(() => topology.knobs(), [topology]);
  const [board, setBoard] = useState<Board>(() => ({
    dims: [...level.initial.dims],
    cells: level.initial.cells.map((c) => ({ ...c })),
  }));
  const [history, setHistory] = useState<Move[]>([]);
  const [won, setWon] = useState(false);
  const [animating, setAnimating] = useState<AnimationState | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  // v0.2.1：庆祝动画状态——won 置 true 后启动，CELEBRATE_DURATION 后清除
  const [celebrating, setCelebrating] = useState(false);

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

    // v0.1.2 修复：原实现把 setWon 嵌套在 setBoard 的 updater 函数体内，
    // 违反 React 纯函数 updater 规则。StrictMode 下 updater 被双调用，
    // 嵌套 setState 使批处理顺序不可预测，可能导致 board commit 与
    // animating 清除之间存在一帧间隙——overlay 卸载但棋盘尚未更新，
    // 表现为"一瞬间回到原始状态"的闪烁。
    //
    // 修复：先用 board 的当前值（闭包捕获的 board）计算下一态与胜利判定，
    // 再在顶层独立调用 setBoard / setWon / setHistory / setMoveCount / setAnimating，
    // 全部为顶层独立 setState，React 18 automatic batching 合并成一次 render，
    // overlay 卸载与 cell-grid 更新在同一 commit，无中间原始态。
    const next = applyMove(board, knob, direction);
    const won = level.goal.satisfied(next, topology);
    setBoard(next);
    if (won) {
      setWon(true);
      // v0.2.1：启动庆祝动画，弹窗在 App 层延迟显示
      setCelebrating(true);
    }
    setHistory((h) => [...h, move]);
    setMoveCount((c) => c + 1);
    setAnimating(null);
  }, [level, topology, board]);

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
    setCelebrating(false);
  }, [level]);

  // v0.2.1：庆祝动画自动清除——celebrating 置 true 后，
  // 经 CELEBRATE_DURATION 毫秒自动清 false。
  useEffect(() => {
    if (!celebrating) return;
    const id = setTimeout(() => setCelebrating(false), CELEBRATE_DURATION);
    return () => clearTimeout(id);
  }, [celebrating]);

  return {
    board,
    knobs,
    topology,
    history,
    moveCount,
    won,
    animating,
    celebrating,
    handleKnobClick,
    onAnimationEnd,
    reset,
    checkWin,
  };
}
