import { useCallback, useEffect, useState } from 'react';
import { StartScreen } from './components/StartScreen';
import { EndlessScreen } from './components/EndlessScreen';
import { LevelSelectScreen } from './components/LevelSelectScreen';
import { GameScreen } from './components/GameScreen';
import { useProgress, computeStars } from './hooks/useProgress';
import { getLevel } from './levels/levels';

/** 无尽模式子类型 */
export type EndlessKind = '4x4' | '6x6';

/** localStorage key：是否已询问过新手教程 */
const LS_TUTORIAL_ASKED = 'rotrix:tutorial:asked';

/**
 * v0.5.0：App 重构为四态视图状态机。
 * - start:       初始界面（闯关模式 / 4x4 无尽 / 6x6 无尽）
 * - levelSelect: 关卡选择界面（50 格 + 逐关解锁）
 * - playing:     游戏关卡界面（带返回选关按钮）
 * - endless:     无尽模式
 *
 * 闯关流程：
 *   start → levelSelect → playing（选关）→ 胜利弹窗 → 下一关 / 返回选关
 *
 * 新手教程流程：
 *   首次进入第 1 关 → 弹窗询问是否需要教程 → 是→playing(0)→教程完成→playing(1)
 *                                                    否→playing(1)
 */
export function App() {
  const [view, setView] = useState<View>({ mode: 'start' });
  const [best4x4, setBest4x4] = useState(0);
  const [best6x6, setBest6x6] = useState(0);
  const { completed, stars, markCompleted } = useProgress();
  // v0.5.0：新手教程询问弹窗
  const [showTutorialPrompt, setShowTutorialPrompt] = useState(false);
  // v0.5.1：开发者模式——调试用，最终版本删除
  const [developerMode, setDeveloperMode] = useState(false);

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

  // v0.5.0：选关回调——首次选第 1 关时弹窗询问是否需要教程
  // v0.5.1：开发者模式下始终弹窗询问教程
  const handleSelectLevel = useCallback((levelId: number) => {
    if (levelId === 1) {
      try {
        const asked = localStorage.getItem(LS_TUTORIAL_ASKED);
        if (!asked || developerMode) {
          setShowTutorialPrompt(true);
          return;
        }
      } catch {
        // localStorage 不可用，直接进入
      }
    }
    setView({ mode: 'playing', levelId });
  }, [developerMode]);

  // v0.5.0：教程询问弹窗——是
  const handleTutorialYes = useCallback(() => {
    try {
      localStorage.setItem(LS_TUTORIAL_ASKED, '1');
    } catch {
      // ignore
    }
    setShowTutorialPrompt(false);
    setView({ mode: 'playing', levelId: 0 });
  }, []);

  // v0.5.0：教程询问弹窗——否
  const handleTutorialNo = useCallback(() => {
    try {
      localStorage.setItem(LS_TUTORIAL_ASKED, '1');
    } catch {
      // ignore
    }
    setShowTutorialPrompt(false);
    setView({ mode: 'playing', levelId: 1 });
  }, []);

  if (view.mode === 'start') {
    return (
      <StartScreen
        bestScore4x4={best4x4}
        bestScore6x6={best6x6}
        onStart={() => setView({ mode: 'levelSelect' })}
        onEndless={(kind) => setView({ mode: 'endless', kind })}
        developerMode={developerMode}
        onToggleDeveloperMode={() => setDeveloperMode((d) => !d)}
      />
    );
  }

  if (view.mode === 'levelSelect') {
    return (
      <>
        <LevelSelectScreen
          completed={completed}
          stars={stars}
          onSelect={handleSelectLevel}
          onBack={() => setView({ mode: 'start' })}
          developerMode={developerMode}
        />
        {showTutorialPrompt && (
          <div className="win-overlay" onClick={() => {}}>
            <div className="win-card">
              <h2 className="win-title">🎯 新手教程</h2>
              <p className="win-stats">
                这是你第一次进入闯关模式。<br />
                是否先体验一下新手教程？
              </p>
              <div className="win-actions">
                <button className="btn primary" onClick={handleTutorialYes}>
                  是，先学操作
                </button>
                <button className="btn" onClick={handleTutorialNo}>
                  否，直接挑战
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (view.mode === 'playing') {
    return (
      <GameScreen
        key={view.levelId}
        levelId={view.levelId}
        onWin={(levelId, moveCount) => {
          // v0.8.0：计算星级并与通关状态一起保存
          const level = getLevel(levelId);
          const starCount = level ? computeStars(level.scramble, moveCount, level.topologyKind) : 1;
          markCompleted(levelId, starCount);
        }}
        onBack={() => setView({ mode: 'levelSelect' })}
        onNext={(nextId) => setView({ mode: 'playing', levelId: nextId })}
        onTutorialComplete={() => setView({ mode: 'playing', levelId: 1 })}
      />
    );
  }

  // endless 模式
  return <EndlessScreen kind={view.kind} onBack={() => setView({ mode: 'start' })} />;
}

type View =
  | { mode: 'start' }
  | { mode: 'levelSelect' }
  | { mode: 'playing'; levelId: number }
  | { mode: 'endless'; kind: EndlessKind };
