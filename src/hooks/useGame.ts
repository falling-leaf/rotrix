import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Board, Knob, Level, Move, Topology } from '../core/types';
import { applyMove, swapCells } from '../core/board';
import { getTopologyEntry } from '../core/goals';

/** 动画状态：正在旋转哪个旋钮 */
export interface AnimationState {
  knob: Knob;
  direction: 'CW' | 'CCW';
}

/** v0.3.4：旋钮旋转方向（全局开关，用户通过硬币组件切换） */
export type RotationDirection = 'CW' | 'CCW';

/** v0.3.5：对换动画状态 */
export interface SwapAnimationState {
  /** 对换的第一个格子索引 */
  indexA: number;
  /** 对换的第二个格子索引 */
  indexB: number;
}

/** v0.3.5：对换道具每关可用次数（v0.8.1：5次免费，之后使用金币购买） */
const MAX_FREE_SWAPS = 5;
const SWAP_COST = 100;

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
export function useGame(level: Level, coins: number, developerMode: boolean, onBuySwap: () => boolean) {
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
  // v0.3.4：全局旋转方向开关（CW / CCW），用户通过硬币组件切换。
  // 初始为 CW（顺时针），与历史版本默认行为一致。
  const [rotationDirection, setRotationDirection] =
    useState<RotationDirection>('CW');

  // v0.3.5：对换道具状态
  // swapMode — 是否处于"选择对换格子"模式（用户点了魔法棒按钮后激活）
  // swapSelection — 已选中的第一个格子索引（选了第一个还没选第二个时持有）
  // swapAnimating — 对换动画进行中（两个格子已选，播放飞移动画）
  // swapsLeft — 本关剩余对换次数（初始 MAX_SWAPS，reset 时重置）
  const [swapMode, setSwapMode] = useState(false);
  const [swapSelection, setSwapSelection] = useState<number | null>(null);
  const [swapAnimating, setSwapAnimating] = useState<SwapAnimationState | null>(null);
  const [swapsLeft, setSwapsLeft] = useState(MAX_FREE_SWAPS);
  // 用 ref 存动画状态，避免在 updater body 内嵌套 setState
  const animatingRef = useRef<AnimationState | null>(null);
  // v0.3.5：swapAnimating 的 ref，供 onSwapAnimationEnd 读取
  const swapAnimatingRef = useRef<SwapAnimationState | null>(null);

  const checkWin = useCallback(
    (b: Board) => level.goal.satisfied(b, topology),
    [level, topology],
  );

  /**
   * 点击旋钮：启动旋转动画，不立即修改棋盘。
   * v0.3.4：旋转方向由全局 rotationDirection 决定，
   * 用户可通过硬币组件在 CW / CCW 之间切换。
   */
  const handleKnobClick = useCallback(
    (knob: Knob) => {
      if (animatingRef.current || won) return;
      // v0.3.5：对换模式下禁用旋钮点击
      if (swapMode || swapAnimatingRef.current) return;
      const state: AnimationState = { knob, direction: rotationDirection };
      animatingRef.current = state;
      setAnimating(state);
    },
    [won, rotationDirection, swapMode],
  );

  /**
   * v0.3.4：切换全局旋转方向（CW ↔ CCW）。
   * 切换后，后续点击旋钮将使用新方向旋转，旋钮图标也相应更新。
   */
  const toggleRotationDirection = useCallback(() => {
    setRotationDirection((d) => (d === 'CW' ? 'CCW' : 'CW'));
  }, []);

  /**
   * v0.3.5：进入/退出对换模式。
   * v0.8.1：免费次数用完后可使用金币购买（100金币/次），开发者模式无限使用。
   */
  const toggleSwapMode = useCallback(() => {
    if (won || animatingRef.current) return;
    if (swapAnimatingRef.current) return;
    // 检查是否可以用对换：有免费次数 / 开发者模式 / 金币足够
    if (swapsLeft <= 0 && !developerMode && coins < SWAP_COST) return;
    setSwapMode((m) => {
      const next = !m;
      if (!next) setSwapSelection(null);
      return next;
    });
  }, [won, swapsLeft, developerMode, coins]);

  /**
   * v0.3.5：用户在操作地图上点击了一个格子。
   * 仅在对换模式下响应，用于选择两个格子进行对换。
   * 第一次点击：记录 indexA；第二次点击：触发对换动画。
   */
  const handleCellClick = useCallback((index: number) => {
    if (!swapMode || swapAnimatingRef.current || animatingRef.current || won) return;
    setSwapSelection((prev) => {
      if (prev === null) {
        return index;
      }
      // 已选第一个，现在选第二个——触发对换动画
      if (prev !== index) {
        const state: SwapAnimationState = { indexA: prev, indexB: index };
        swapAnimatingRef.current = state;
        setSwapAnimating(state);
        setSwapMode(false);
        setSwapSelection(null);
      }
      // 同一格再点 = 取消选择
      return null;
    });
  }, [swapMode, won]);

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

  /**
   * v0.3.5：对换动画结束后调用：交换两个格子的颜色，提交棋盘，判定胜利。
   * 与旋转动画 onAnimationEnd 同模式——所有 setState 在顶层独立调用。
   * 不增加 moveCount（对换是道具，不计步数），但消耗一次 swapsLeft。
   * v0.8.1：免费次数用完后消费金币购买对换。
   */
  const onSwapAnimationEnd = useCallback(() => {
    const current = swapAnimatingRef.current;
    if (!current) return;
    swapAnimatingRef.current = null;

    const { indexA, indexB } = current;
    const next = swapCells(board, indexA, indexB);
    const won = level.goal.satisfied(next, topology);
    setBoard(next);
    if (won) {
      setWon(true);
      setCelebrating(true);
    }
    // 免费次数用完则扣金币
    if (swapsLeft <= 0) {
      if (!developerMode) {
        onBuySwap();
      }
    } else {
      setSwapsLeft((n) => Math.max(0, n - 1));
    }
    setSwapAnimating(null);
  }, [level, topology, board, swapsLeft, developerMode, onBuySwap]);

  const reset = useCallback(() => {
    animatingRef.current = null;
    swapAnimatingRef.current = null;
    setBoard({
      dims: [...level.initial.dims],
      cells: level.initial.cells.map((c) => ({ ...c })),
    });
    setHistory([]);
    setMoveCount(0);
    setWon(false);
    setAnimating(null);
    setCelebrating(false);
    // v0.3.5：重置对换道具状态
    setSwapMode(false);
    setSwapSelection(null);
    setSwapAnimating(null);
    setSwapsLeft(MAX_FREE_SWAPS);
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
    // v0.3.4：全局旋转方向 + 切换函数
    rotationDirection,
    toggleRotationDirection,
    handleKnobClick,
    onAnimationEnd,
    reset,
    checkWin,
    // v0.3.5：对换道具
    swapMode,
    swapSelection,
    swapAnimating,
    swapsLeft,
    toggleSwapMode,
    handleCellClick,
    onSwapAnimationEnd,
    // v0.8.1：对换道具常量
    swapCost: SWAP_COST,
    isDeveloperMode: developerMode,
  };
}
