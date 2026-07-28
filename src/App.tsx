import { useEffect, useState } from 'react';
import { BoardView } from './components/BoardView';
import { useGame } from './hooks/useGame';
import { getLevels } from './levels/levels';

/**
 * 应用入口组件
 *
 * 状态管理：当前关卡 ID、已完成关卡集合。
 * 后续可扩展：关卡选择页、设置页、关卡编辑器等。
 */
export function App() {
  const levels = getLevels();
  const [currentLevelId, setCurrentLevelId] = useState(1);
  const [completed, setCompleted] = useState<Set<number>>(new Set());

  const level = levels.find((l) => l.id === currentLevelId)!;
  const game = useGame(level);

  // 切换关卡时重置游戏
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
            <span className="label">{level.name}</span>
          </span>
          <span>
            步数 <span className="label">{game.moveCount}</span>
          </span>
        </div>

        <BoardView
          board={game.board}
          knobs={game.knobs}
          onKnobClick={game.handleKnobClick}
          disabled={game.won}
        />

        <p className="goal-hint">{level.goal.describe?.()}</p>

        <div className="controls">
          <button className="btn" onClick={game.reset}>
            重置
          </button>
        </div>
      </div>

      {game.won && (
        <div className="win-overlay" onClick={() => {}}>
          <div className="win-card">
            <h2 className="win-title">🎉 通关！</h2>
            <p className="win-stats">
              第 {level.id} 关 · {level.name} · 用了 {game.moveCount} 步
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
              <button
                className="btn"
                onClick={() => game.reset()}
              >
                再玩一次
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
