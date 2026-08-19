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
    scramble,
  };
}

interface EndlessScreenProps {
  kind: EndlessKind;
  onBack: () => void;
}

/**
 * v0.6.2：无尽模式游戏页面视觉重设计。
 * 固定 375×667 画布，与闯关模式游戏页面布局一致。
 */
export function EndlessScreen({ kind, onBack }: EndlessScreenProps) {
  const [level, setLevel] = useState<Level>(() => createEndlessLevel(kind));
  const [cleared, setCleared] = useState(0);
  const [best, setBest] = useState(() => loadBest(kind));

  const game = useGame(level);
  const solvedBoard = useMemo<Board>(
    () => getTopologyEntry(level.topologyKind).defaultSolvedBoard(),
    [level.topologyKind],
  );

  // v0.2.3 fix: level 变化时重置游戏状态
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

  // 通关后 +1 并生成下一题
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
    <div className="game-screen-v6">
      <div className="game-canvas">
        {/* ===== 粉色背景矩形 ===== */}
        <div className="pink-bg" style={{ height: '662px', top: '5px' }} />

        {/* ===== 拼图装饰 ===== */}
        <svg className="puzzle-decorations" viewBox="0 0 375 667" preserveAspectRatio="xMidYMid meet">
          <defs>
            <path id="pz1" d="M0,15 C0,6.7 6.7,0 15,0 h10 c3,0 5,2 5,5 c0,3 2,5 5,5 c3,0 5,-2 5,-5 c0,-3 2,-5 5,-5 h10 c8.3,0 15,6.7 15,15 v10 c0,3 -2,5 -5,5 c-3,0 -5,2 -5,5 c0,3 2,5 5,5 c3,0 5,2 5,5 v10 c0,8.3 -6.7,15 -15,15 h-10 c-3,0 -5,-2 -5,-5 c0,-3 -2,-5 -5,-5 c-3,0 -5,2 -5,5 c0,3 -2,5 -5,5 h-10 c-8.3,0 -15,-6.7 -15,-15 v-10 c0,-3 2,-5 5,-5 c3,0 5,-2 5,-5 c0,-3 -2,-5 -5,-5 c-3,0 -5,-2 -5,-5 z" />
            <path id="pz2" d="M0,12 C0,5.4 5.4,0 12,0 h10 c3,0 5,2 5,5 c0,3 2,5 5,5 c3,0 5,-2 5,-5 c0,-3 2,-5 5,-5 h6 c6.6,0 12,5.4 12,12 v10 c0,3 -2,5 -5,5 c-3,0 -5,2 -5,5 c0,3 2,5 5,5 c3,0 5,2 5,5 v6 c0,6.6 -5.4,12 -12,12 h-6 c-3,0 -5,-2 -5,-5 c0,-3 -2,-5 -5,-5 c-3,0 -5,2 -5,5 c0,3 -2,5 -5,5 h-10 c-6.6,0 -12,-5.4 -12,-12 v-6 c0,-3 2,-5 5,-5 c3,0 5,-2 5,-5 c0,-3 -2,-5 -5,-5 c-3,0 -5,-2 -5,-5 z" />
            <path id="pz3" d="M0,10 C0,4.5 4.5,0 10,0 h10 c3,0 5,2 5,4 c0,2 2,4 5,4 c3,0 5,-2 5,-4 c0,-2 2,-4 5,-4 h10 c5.5,0 10,4.5 10,10 v10 c0,3 -2,5 -5,5 c-3,0 -5,2 -5,5 c0,3 2,5 5,5 c3,0 5,2 5,5 v15 c0,5.5 -4.5,10 -10,10 h-10 c-3,0 -5,-2 -5,-5 c0,-3 -2,-5 -5,-5 c-3,0 -5,2 -5,5 c0,3 -2,5 -5,5 h-10 c-5.5,0 -10,-4.5 -10,-10 v-15 c0,-3 2,-5 5,-5 c3,0 5,-2 5,-5 c0,-3 -2,-5 -5,-5 c-3,0 -5,-2 -5,-5 z" />
            <path id="pz4" d="M0,15 C0,6.7 6.7,0 15,0 h15 c3,0 5,2 5,5 c0,3 2,5 5,5 c3,0 5,-2 5,-5 c0,-3 2,-5 5,-0 h15 c8.3,0 15,6.7 15,15 v10 c0,3 -2,5 -5,5 c-3,0 -5,2 -5,5 c0,3 2,5 5,5 c3,0 5,2 5,5 v10 c0,8.3 -6.7,15 -15,15 h-15 c-3,0 -5,-2 -5,-5 c0,-3 -2,-5 -5,-5 c-3,0 -5,2 -5,5 c0,3 -2,5 -5,5 h-15 c-8.3,0 -15,-6.7 -15,-15 v-10 c0,-3 2,-5 5,-5 c3,0 5,-2 5,-5 c0,-3 -2,-5 -5,-5 c-3,0 -5,-2 -5,-5 z" />
          </defs>
          <use href="#pz1" x="195" y="123" fill="#F2B4F3" opacity="0.65" transform="rotate(8, 235, 158) scale(1.1)" />
          <use href="#pz2" x="278" y="203" fill="#F2B4F3" opacity="0.6" transform="rotate(-5, 308, 233)" />
          <use href="#pz3" x="52" y="303" fill="#F2B4F3" opacity="0.7" transform="rotate(-10, 82, 335) scale(1.2)" />
          <use href="#pz4" x="260" y="383" fill="#F2B4F3" opacity="0.65" transform="rotate(-8, 300, 418)" />
          <use href="#pz3" x="62" y="463" fill="#F2B4F3" opacity="0.7" transform="rotate(6, 92, 495) scale(1.15)" />
          <use href="#pz4" x="235" y="543" fill="#F2B4F3" opacity="0.65" transform="rotate(-12, 275, 578)" />
        </svg>

        {/* ===== 顶部行：返回按钮 | 步数 | 无尽标签 ===== */}
        <div className="gs-back-btn" onClick={onBack}>
          <div className="gs-back-outer">
            <div className="gs-back-inner">
              <svg className="gs-back-arrow" viewBox="0 0 21 21" fill="none">
                <path d="M 0 10.5 L 21 0 L 21 21 Z" fill="#A900D0" opacity="0.25" transform="translate(1, 1)" />
                <path d="M 0 10.5 L 21 0 L 21 21 Z" fill="white" />
              </svg>
              <span className="gs-back-text">返回</span>
            </div>
          </div>
        </div>

        <div className="gs-step-counter">
          <div className="gs-step-outer">
            <div className="gs-step-inner">
              <span className="gs-step-text">步数 {game.moveCount}</span>
            </div>
          </div>
        </div>

        <div className="gs-level-label" style={{ width: '112px', left: '248px' }}>
          <div className="gs-level-outer">
            <div className="gs-level-inner">
              <span className="gs-level-text">无尽 {kind}</span>
            </div>
          </div>
        </div>

        {/* ===== 操作地图面板 ===== */}
        <div className="gs-board-panel">
          <div className="gs-board-panel-outer">
            <div className="gs-board-panel-inner">
              <div className="gs-board-label">操作地图</div>
              <div className="gs-board-area">
                <BoardView
                  board={game.board}
                  knobs={game.knobs}
                  onKnobClick={game.handleKnobClick}
                  onAnimationEnd={game.onAnimationEnd}
                  animating={game.animating}
                  disabled={game.won}
                  celebrating={game.celebrating}
                  direction={game.rotationDirection}
                  swapMode={game.swapMode}
                  swapSelection={game.swapSelection}
                  swapAnimating={game.swapAnimating}
                  onCellClick={game.handleCellClick}
                  onSwapAnimationEnd={game.onSwapAnimationEnd}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ===== 目标地图面板（目标地图 + 金币并列） ===== */}
        <div className="gs-target-panel">
          <div className="gs-target-panel-outer">
            <div className="gs-target-panel-inner">
              <div className="gs-target-board">
                <div className="board-label">目标地图</div>
                <BoardView
                  board={solvedBoard}
                  knobs={[]}
                  onKnobClick={() => {}}
                  preview
                />
              </div>
              <div className="gs-target-coin">
                <div>
                  <RotationDirectionSwitch
                    direction={game.rotationDirection}
                    onToggle={game.toggleRotationDirection}
                    disabled={game.won}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== 底部控制面板 ===== */}
        <div className="gs-controls-panel">
          <div className="gs-controls-panel-outer">
            <div className="gs-controls-panel-inner">
              <SwapButton
                active={game.swapMode}
                swapsLeft={game.swapsLeft}
                disabled={game.won}
                onClick={game.toggleSwapMode}
              />
              <button className="gs-reset-btn" onClick={game.reset}>
                重置
              </button>
            </div>
          </div>
        </div>

        {/* ===== 胜利弹窗 ===== */}
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
    </div>
  );
}