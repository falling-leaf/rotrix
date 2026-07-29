import { useEffect, useMemo, useState } from 'react';
import { BoardView } from './components/BoardView';
import { useGame } from './hooks/useGame';
import { getLevels } from './levels/levels';
import { getTopologyEntry } from './core/goals';

/**
 * 应用入口组件
 *
 * v0.1.1 改动：
 * - 去除操作地图下方的文字说明
 * - 在操作地图右侧添加目标地图预览（缩小版棋盘，无旋钮）
 * - 接入旋转动画 hook（animating / onAnimationEnd）
 */
export function App() {
  const levels = getLevels();
  const [currentLevelId, setCurrentLevelId] = useState(1);
  const [completed, setCompleted] = useState<Set<number>>(new Set());

  const level = levels.find((l) => l.id === currentLevelId)!;
  const game = useGame(level);
  // v0.2.0：从注册表按当前关卡拓扑获取目标棋盘，不再硬编码 4x4
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

        {/* 操作地图（左）+ 目标地图（右）并排 */}
        <div className="boards-layout">
          <BoardView
            board={game.board}
            knobs={game.knobs}
            onKnobClick={game.handleKnobClick}
            onAnimationEnd={game.onAnimationEnd}
            animating={game.animating}
            disabled={game.won}
            label="操作地图"
          />
          <BoardView
            board={solvedBoard}
            knobs={[]}
            onKnobClick={() => {}}
            preview
            label="目标地图"
          />
        </div>

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
