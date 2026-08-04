import { useEffect, useMemo, useState } from 'react';
import { BoardViewRouter as BoardView } from './components/BoardView';
import { StartScreen } from './components/StartScreen';
import { EndlessScreen } from './components/EndlessScreen';
import { RotationDirectionSwitch } from './components/RotationDirectionSwitch';
import { useGame } from './hooks/useGame';
import { getLevels } from './levels/levels';
import { getTopologyEntry } from './core/goals';

/** 无尽模式子类型 */
export type EndlessKind = '4x4' | '6x6';

/** 顶层视图状态 */
type View = { mode: 'start' } | { mode: 'campaign' } | { mode: 'endless'; kind: EndlessKind };

/**
 * v0.2.3：App 重构为视图状态机。
 * - start: 初始界面，选择闯关 / 4x4 无尽 / 6x6 无尽
 * - campaign: 原闯关模式（v0.2.1 逻辑完整保留）
 * - endless: 无尽模式，随机生成题目，记录通关数
 *
 * 闯关模式在原有逻辑上加了一个"返回主菜单"按钮，其余不变。
 */
export function App() {
  const [view, setView] = useState<View>({ mode: 'start' });
  const [best4x4, setBest4x4] = useState(0);
  const [best6x6, setBest6x6] = useState(0);

  // 进入初始界面时读取无尽模式历史最佳
  useEffect(() => {
    if (view.mode === 'start') {
      try {
        setBest4x4(parseInt(localStorage.getItem('rotrix:endless:4x4') || '0', 10) || 0);
        setBest6x6(parseInt(localStorage.getItem('rotrix:endless:6x6') || '0', 10) || 0);
      } catch {
        // localStorage 不可用
      }
    }
  }, [view]);

  if (view.mode === 'start') {
    return (
      <StartScreen
        bestScore4x4={best4x4}
        bestScore6x6={best6x6}
        onStart={() => setView({ mode: 'campaign' })}
        onEndless={(kind) => setView({ mode: 'endless', kind })}
      />
    );
  }

  if (view.mode === 'endless') {
    return <EndlessScreen kind={view.kind} onBack={() => setView({ mode: 'start' })} />;
  }

  // campaign 模式
  return <CampaignScreen onBack={() => setView({ mode: 'start' })} />;
}

/**
 * 闯关模式——v0.2.1 的完整逻辑，仅新增 onBack prop。
 */
function CampaignScreen({ onBack }: { onBack: () => void }) {
  const levels = getLevels();
  const [currentLevelId, setCurrentLevelId] = useState(1);
  const [completed, setCompleted] = useState<Set<number>>(new Set());

  const level = levels.find((l) => l.id === currentLevelId)!;
  const game = useGame(level);
  const solvedBoard = useMemo(
    () => getTopologyEntry(level.topologyKind).defaultSolvedBoard(),
    [level.topologyKind],
  );

  useEffect(() => {
    game.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLevelId]);

  const handleNextLevel = () => {
    if (currentLevelId < levels.length) {
      setCompleted((prev) => new Set([...prev, currentLevelId]));
      setCurrentLevelId((id) => id + 1);
    }
  };

  const handleSelectLevel = (id: number) => {
    setCurrentLevelId(id);
  };

  return (
    <div className="app">
      <div className="endless-header">
        <button className="btn back-btn" onClick={onBack}>
          ← 返回
        </button>
      </div>

      <header className="app-header">
        <h1 className="app-title">ROTRIX</h1>
        <p className="app-subtitle">旋转拼图 · 通关挑战</p>
      </header>

      <div className="level-bar">
        {levels.map((l) => (
          <button
            key={l.id}
            className={`level-chip ${l.id === currentLevelId ? 'active' : ''} ${completed.has(l.id) ? 'completed' : ''}`}
            onClick={() => handleSelectLevel(l.id)}
          >
            <span>第{l.id}关</span>
            <span className="diff">★{l.difficulty}</span>
          </button>
        ))}
      </div>

      <div className="game-area">
        <div className="info-bar">
          <span>
            <span className="label">第 {level.id} 关</span>
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
          <button className="btn" onClick={game.reset}>
            重置
          </button>
        </div>
      </div>

      {game.won && !game.celebrating && (
        <div className="win-overlay" onClick={() => {}}>
          <div className="win-card">
            <h2 className="win-title">🎉 通关！</h2>
            <p className="win-stats">
              第 {level.id} 关 · 用了 {game.moveCount} 步
            </p>
            <div className="win-actions">
              {currentLevelId < levels.length ? (
                <button className="btn primary" onClick={handleNextLevel}>
                  下一关 →
                </button>
              ) : (
                <button
                  className="btn primary"
                  onClick={() => setCurrentLevelId(1)}
                >
                  重新开始
                </button>
              )}
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
