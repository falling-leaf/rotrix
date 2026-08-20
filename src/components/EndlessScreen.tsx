import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BoardViewRouter as BoardView } from './BoardView';
import { RotationDirectionSwitch } from './RotationDirectionSwitch';
import { SwapButton } from './SwapButton';
import { useGame } from '../hooks/useGame';
import { getTopologyEntry } from '../core/goals';
import { generateRandomPuzzle } from '../core/generator';
import { QuadrantUniformGoal, HexUniformGoal } from '../core/goals';
import type { Board, Level } from '../core/types';
import type { EndlessKind } from '../App';

/** 无尽模式难度配置 */
const ENDLESS_CONFIG: Record<EndlessKind, { topologyKind: string; scramble: number }> = {
  '4x4': { topologyKind: 'square-4x4', scramble: 30 },
  '6x6': { topologyKind: 'square-6x6', scramble: 60 },
  'hex-small': { topologyKind: 'hex-small-triangle', scramble: 20 },
  'hex-triangle': { topologyKind: 'hex-triangle', scramble: 60 },
};

/** localStorage key 前缀 */
const LS_PREFIX = 'rotrix:endless:';

/** 格式化时间为 MM:SS */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** 读取无尽模式历史统计 */
function loadCleared(kind: EndlessKind): number {
  try {
    const v = localStorage.getItem(LS_PREFIX + kind + ':cleared')
      || localStorage.getItem(LS_PREFIX + kind) // 兼容旧版
      || '0';
    return parseInt(v, 10) || 0;
  } catch { return 0; }
}

function loadBestTime(kind: EndlessKind): number {
  try {
    const v = localStorage.getItem(LS_PREFIX + kind + ':bestTime');
    return v ? parseInt(v, 10) || 0 : 0;
  } catch { return 0; }
}

function loadBestSteps(kind: EndlessKind): number {
  try {
    const v = localStorage.getItem(LS_PREFIX + kind + ':bestSteps');
    return v ? parseInt(v, 10) || 0 : 0;
  } catch { return 0; }
}

function saveCleared(kind: EndlessKind, val: number): void {
  try {
    localStorage.setItem(LS_PREFIX + kind + ':cleared', String(val));
    localStorage.setItem(LS_PREFIX + kind, String(val)); // 兼容旧版
  } catch { /* ignore */ }
}

function saveBestTime(kind: EndlessKind, val: number): void {
  try {
    localStorage.setItem(LS_PREFIX + kind + ':bestTime', String(val));
  } catch { /* ignore */ }
}

function saveBestSteps(kind: EndlessKind, val: number): void {
  try {
    localStorage.setItem(LS_PREFIX + kind + ':bestSteps', String(val));
  } catch { /* ignore */ }
}

/** 生成一个无尽模式关卡 */
function createEndlessLevel(kind: EndlessKind): Level {
  const { topologyKind, scramble } = ENDLESS_CONFIG[kind];
  const gen = generateRandomPuzzle(topologyKind, scramble);
  const isHex = topologyKind === 'hex-small-triangle' || topologyKind === 'hex-triangle';
  return {
    id: Date.now(),
    name: `无尽 ${kind}`,
    difficulty: gen.difficulty,
    topologyKind,
    initial: gen.initial,
    goal: isHex ? new HexUniformGoal() : new QuadrantUniformGoal(),
    solution: gen.solution,
    scramble,
  };
}

interface EndlessScreenProps {
  kind: EndlessKind;
  onBack: () => void;
  /** v0.8.3：对换使用回调——记录成就用 */
  onSwapUsed?: () => void;
}

/**
 * v0.6.2：无尽模式游戏页面视觉重设计。
 * v0.9.0：新增计时器与统计追踪（已通过关数、最短时间、最短步数）。
 * 固定 375×667 画布，与闯关模式游戏页面布局一致。
 */
export function EndlessScreen({ kind, onBack, onSwapUsed }: EndlessScreenProps) {
  const [level, setLevel] = useState<Level>(() => createEndlessLevel(kind));
  const [cleared, setCleared] = useState(() => loadCleared(kind));
  const [bestTime, setBestTime] = useState(() => loadBestTime(kind));
  const [bestSteps, setBestSteps] = useState(() => loadBestSteps(kind));
  // v0.9.0：计时器——当前关卡已用秒数
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const game = useGame(level, 0, false, () => false, onSwapUsed);
  const solvedBoard = useMemo<Board>(
    () => getTopologyEntry(level.topologyKind).defaultSolvedBoard(),
    [level.topologyKind],
  );

  // v0.9.0：金币
  const [coins] = useState(() => {
    try {
      return parseInt(localStorage.getItem('rotrix:coins') || '0', 10) || 0;
    } catch { return 0; }
  });

  // v0.2.3 fix: level 变化时重置游戏状态
  useEffect(() => {
    game.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  // v0.9.0：计时器——每秒更新，赢后停止
  useEffect(() => {
    if (game.won) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    } else {
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          setElapsed((s) => s + 1);
        }, 1000);
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [game.won]);

  // 切换 kind 时重新生成
  useEffect(() => {
    setLevel(createEndlessLevel(kind));
    setCleared(loadCleared(kind));
    setBestTime(loadBestTime(kind));
    setBestSteps(loadBestSteps(kind));
    setElapsed(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  // 通关后 +1 并生成下一题，记录最佳成绩
  const handleNext = useCallback(() => {
    const newCleared = cleared + 1;
    const steps = game.moveCount;
    const time = elapsed;
    setCleared(newCleared);
    saveCleared(kind, newCleared);

    // 更新最短步数
    if (bestSteps === 0 || steps < bestSteps) {
      setBestSteps(steps);
      saveBestSteps(kind, steps);
    }

    // 更新最短时间
    if (bestTime === 0 || time < bestTime) {
      setBestTime(time);
      saveBestTime(kind, time);
    }

    setElapsed(0);
    setLevel(createEndlessLevel(kind));
  }, [cleared, bestSteps, bestTime, kind, game.moveCount, elapsed]);

  // 重置时重置计时器
  const handleReset = useCallback(() => {
    game.reset();
    setElapsed(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  // 胜利弹窗中点击"返回"——先保存当前关卡成绩再返回
  const handleWinBack = useCallback(() => {
    const newCleared = cleared + 1;
    const steps = game.moveCount;
    const time = elapsed;
    saveCleared(kind, newCleared);
    if (bestSteps === 0 || steps < bestSteps) {
      saveBestSteps(kind, steps);
    }
    if (bestTime === 0 || time < bestTime) {
      saveBestTime(kind, time);
    }
    onBack();
  }, [cleared, bestSteps, bestTime, kind, game.moveCount, elapsed, onBack]);

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

        {/* ===== 第一行：返回 | 金币 | 4x4矩阵无尽 ===== */}
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

        {/* 金币（第一行中间） */}
        <div className="es-coin-display">
          <div className="es-coin-outer">
            <div className="es-coin-inner">
              <img className="gs-coin-icon" src="/coin.png" alt="金币" />
              <span className="gs-coin-text">{coins}</span>
            </div>
          </div>
        </div>

        {/* 模式全称（第一行右侧） */}
        <div className="es-mode-fullname">
          <div className="es-mode-fullname-outer">
            <div className="es-mode-fullname-inner">
              <span className="es-mode-fullname-text">{kind === '4x4' ? '4×4 矩阵' : kind === '6x6' ? '6×6 矩阵' : kind === 'hex-small' ? '小型三角' : '大型三角'}</span>
            </div>
          </div>
        </div>

        {/* ===== 第二行：左侧大第1关 | 右侧步数（上）+ 时间（下）居中 ===== */}
        {/* 第1关（大，占满第二行高度） */}
        <div className="es-level-badge">
          <div className="es-level-badge-outer">
            <div className="es-level-badge-inner">
              <span className="es-level-badge-text">第 {cleared + 1} 关</span>
            </div>
          </div>
        </div>

        {/* 步数（第1关右侧上方） */}
        <div className="es-steps-badge">
          <div className="es-steps-badge-outer">
            <div className="es-steps-badge-inner">
              <span className="es-steps-badge-text">{game.moveCount} 步</span>
            </div>
          </div>
        </div>

        {/* 时间（第1关右侧下方） */}
        <div className="es-time-badge">
          <div className="es-time-badge-outer">
            <div className="es-time-badge-inner">
              <span className="es-time-badge-text">{formatTime(elapsed)}</span>
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
                swapCost={game.swapCost}
                coins={0}
                developerMode={false}
                disabled={game.won}
                onClick={game.toggleSwapMode}
              />
              <button className="gs-reset-btn" onClick={handleReset}>
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
                {kind === '4x4' ? '4×4 矩阵' : kind === '6x6' ? '6×6 矩阵' : kind === 'hex-small' ? '小型三角' : '大型三角'} · 第 {cleared + 1} 关 · 用了 {game.moveCount} 步 · {formatTime(elapsed)}
              </p>
              <div className="win-actions">
                <button className="btn primary" onClick={handleNext}>
                  下一题 →
                </button>
                <button className="btn" onClick={handleWinBack}>
                  返回
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}