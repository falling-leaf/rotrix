import { useCallback, useMemo, useState } from 'react';
import type { Board, Knob, Level, Move } from '../core/types';
import { applyMove } from '../core/board';
import { square4x4 } from '../core/topology';

/**
 * 游戏主 hook：管理棋盘状态、旋钮点击、移动历史、胜利判定。
 * 后续扩展：支持撤销、回放、步数统计等。
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

  const checkWin = useCallback(
    (b: Board) => level.goal.satisfied(b, topology),
    [level, topology],
  );

  const handleKnobClick = useCallback(
    (knob: Knob) => {
      setBoard((prev) => {
        const next = applyMove(prev, knob, 'CW');
        const move: Move = { knobId: knob.id, direction: 'CW' };
        setHistory((h) => [...h, move]);
        if (level.goal.satisfied(next, topology)) {
          setWon(true);
        }
        return next;
      });
    },
    [level, topology],
  );

  const reset = useCallback(() => {
    setBoard({
      dims: [...level.initial.dims],
      cells: level.initial.cells.map((c) => ({ ...c })),
    });
    setHistory([]);
    setWon(false);
  }, [level]);

  const moveCount = history.length;

  return {
    board,
    knobs,
    topology,
    history,
    moveCount,
    won,
    handleKnobClick,
    reset,
    checkWin,
  };
}
