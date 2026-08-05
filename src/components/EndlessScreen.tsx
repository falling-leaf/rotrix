import { useCallback, useEffect, useMemo, useState } from 'react';
import { BoardViewRouter as BoardView } from './BoardView';
import { RotationDirectionSwitch } from './RotationDirectionSwitch';
import { SwapButton } from './SwapButton';
import { useGame } from '../hooks/useGame';
import { getTopologyEntry } from '../core/goals';
import { generateRandomPuzzle } from '../core/generator';
import { QuadrantUniformGoal } from '../core/goals';
import type { Board, Level } from '../core/types';
import type { EndlessKind } from '../App';

/** 无尽模式难度配置 */
const ENDLESS_CONFIG: Record<EndlessKind, { topologyKind: string; scramble: number }> = {
  '4x4': { topologyKind: 'square-4x4', scramble: 30 },
  '6x6': { topologyKind: 'square-6x6', scramble: 60 },
};

/** localStorage key 前缀 */
const LS_PREFIX = 'rotrix:endless:';

function loadBest(kind: EndlessKind): number {
  try {
    const v = localStorage.getItem(LS_PREFIX + kind);
    return v ? parseInt(v, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

function saveBest(kind: EndlessKind, val: number): void {
  try {
    localStorage.setItem(LS_PREFIX + kind, String(val));
  } catch {
    // localStorage 不可用时静默
  }
}

/** 生成一个无尽模式关卡 */
function createEndlessLevel(kind: EndlessKind): Level {
  const { topologyKind, scramble } = ENDLESS_CONFIG[kind];
  const gen = generateRandomPuzzle(topologyKind, scramble);
  return {
    id: Date.now(),
    name: `无尽 ${kind}`,
    difficulty: gen.difficulty,
    topologyKind,
    initial: gen.initial,
    goal: new QuadrantUniformGoal(),
    solution: gen.solution,
  };
}

interface EndlessScreenProps {
  kind: EndlessKind;
  onBack: () => void;
}

export function EndlessScreen({ kind, onBack }: EndlessScreenProps) {
  const [level, setLevel] = useState<Level>(() => createEndlessLevel(kind));
  const [cleared, setCleared] = useState(0);
  const [best, setBest] = useState(() => loadBest(kind));

  const game = useGame(level);
  const solvedBoard = useMemo<Board>(
    () => getTopologyEntry(level.topologyKind).defaultSolvedBoard(),
    [level.topologyKind],
  );

  // v0.2.3 fix: level 变化时重置游戏状态。
  // useGame 的 useState 不会因 level prop 变化而重新初始化，
  // 必须显式调用 reset() 清除 won/board/moveCount 等状态，
  // 否则上一关的 won=true 会残留，导致新关卡直接判定为已通关。
  useEffect(() => {
    game.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  // 切换 kind 时重新生成
  useEffect(() => {
    setLevel(createEndlessLevel(kind));
    setCleared(0);
    setBest(loadBest(kind));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  // 通关后 +1 并生成下一题。
  // setLevel 触发上面的 useEffect 调用 game.reset()，清除 won 状态。
  const handleNext = useCallback(() => {
    const newCleared = cleared + 1;
    setCleared(newCleared);
    if (newCleared > best) {
      setBest(newCleared);
      saveBest(kind, newCleared);
    }
    setLevel(createEndlessLevel(kind));
  }, [cleared, best, kind]);

  return (
    <div className="app">
      <div className="endless-header">
        <button className="btn back-btn" onClick={onBack}>
          ← 返回
        </button>
        <div className="endless-stats">
          <span>已通关 <strong>{cleared}</strong> 关</span>
          <span>最佳 <strong>{best}</strong></span>
        </div>
      </div>

      <div className="game-area">
        <div className="info-bar">
          <span>
            <span className="label">无尽 {kind}</span>
          </span>
          <span>
            步数 <span className="label">{game.moveCount}</span>
          </span>
        </div>

        <div className="boards-layout">
          <BoardView
            board={game.board}
            knobs={game.knobs}
            onKnobClick={game.handleKnobClick}
            onAnimationEnd={game.onAnimationEnd}
            animating={game.animating}
            disabled={game.won}
            celebrating={game.celebrating}
            label="操作地图"
            direction={game.rotationDirection}
            swapMode={game.swapMode}
            swapSelection={game.swapSelection}
            swapAnimating={game.swapAnimating}
            onCellClick={game.handleCellClick}
            onSwapAnimationEnd={game.onSwapAnimationEnd}
          />
          <div className="right-panel">
            <BoardView
              board={solvedBoard}
              knobs={[]}
              onKnobClick={() => {}}
              preview
              label="目标地图"
            />
            <RotationDirectionSwitch
              direction={game.rotationDirection}
              onToggle={game.toggleRotationDirection}
              disabled={game.won}
            />
          </div>
        </div>

        <div className="controls">
          <SwapButton
            active={game.swapMode}
            swapsLeft={game.swapsLeft}
            disabled={game.won}
            onClick={game.toggleSwapMode}
          />
          <button className="btn" onClick={game.reset}>
            重置
          </button>
        </div>
      </div>

      {/* 胜利弹窗：庆祝动画结束后显示，点击"下一题"生成新题目 */}
      {game.won && !game.celebrating && (
        <div className="win-overlay" onClick={() => {}}>
          <div className="win-card">
            <h2 className="win-title">🎉 通关！</h2>
            <p className="win-stats">
              无尽 {kind} · 第 {cleared + 1} 关 · 用了 {game.moveCount} 步
            </p>
            <div className="win-actions">
              <button className="btn primary" onClick={handleNext}>
                下一题 →
              </button>
              <button className="btn" onClick={() => game.reset()}>
                再玩一次
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
