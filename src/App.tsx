import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BoardViewRouter as BoardView } from './components/BoardView';
import { StartScreen } from './components/StartScreen';
import { EndlessScreen } from './components/EndlessScreen';
import { RotationDirectionSwitch } from './components/RotationDirectionSwitch';
import { SwapButton } from './components/SwapButton';
import { TutorialGuide, type TutorialPose } from './components/TutorialGuide';
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
  // v0.4.5：默认从第 0 关（新手教程）开始
  const [currentLevelId, setCurrentLevelId] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  // v0.4.5：教程步骤（仅第 0 关有效）
  // 0=欢迎介绍 1=教切换方向 2=教转K02 3=激励+教转K11 4=完成
  const [tutorialStep, setTutorialStep] = useState(0);

  const level = levels.find((l) => l.id === currentLevelId)!;
  const game = useGame(level);
  const solvedBoard = useMemo(
    () =>
      level.solvedBoard ?? getTopologyEntry(level.topologyKind).defaultSolvedBoard(),
    [level.topologyKind, level.solvedBoard],
  );

  // v0.4.5：用于教程高亮定位的 DOM 引用
  const boardRef = useRef<HTMLDivElement>(null);
  const directionSwitchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    game.reset();
    // v0.4.5：进入第 0 关时重置教程步骤
    if (currentLevelId === 0) {
      setTutorialStep(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLevelId]);

  // v0.4.5：教程步骤自动推进——根据游戏状态变化
  useEffect(() => {
    if (currentLevelId !== 0) return;
    if (tutorialStep === 1 && game.rotationDirection === 'CCW') {
      setTutorialStep(2);
    }
    if (tutorialStep === 2 && game.moveCount >= 1) {
      setTutorialStep(3);
    }
    if (tutorialStep === 3 && game.won) {
      setTutorialStep(4);
    }
  }, [currentLevelId, tutorialStep, game.rotationDirection, game.moveCount, game.won]);

  // v0.4.5：点击教程气泡推进步骤（仅步骤 0/4 需要手动推进）
  const handleTutorialBubbleClick = useCallback(() => {
    if (currentLevelId !== 0) return;
    if (tutorialStep === 0) {
      setTutorialStep(1);
    } else if (tutorialStep === 4) {
      // 教程完成，进入第 1 关
      setCompleted((prev) => new Set([...prev, 0]));
      setCurrentLevelId(1);
    }
  }, [currentLevelId, tutorialStep]);

  // v0.4.1：线性"下一关"流程限于前 30 关。第 50 关为独立挑战关，
  // 通关后不自动进入"下一关"，仅显示通过提示。
  // v0.4.5：第 0 关为新手教程，通关后进入第 1 关，不受 30 关限制。
  const isLastInCampaign = currentLevelId >= 30;
  const isFinalChallenge = currentLevelId === 50;
  const isTutorial = currentLevelId === 0;

  const handleNextLevel = () => {
    if (!isLastInCampaign) {
      setCompleted((prev) => new Set([...prev, currentLevelId]));
      setCurrentLevelId((id) => id + 1);
    }
  };

  const handleSelectLevel = (id: number) => {
    setCurrentLevelId(id);
  };

  // v0.4.5：教程内容配置
  const tutorialConfig = useMemo(() => {
    if (currentLevelId !== 0) return null;
    const steps: Array<{
      pose: TutorialPose;
      text: string;
      highlightKnobId?: string | null;
      highlightDirectionSwitch?: boolean;
      showRotateIcon?: boolean;
    }> = [
      {
        pose: 'talk',
        text: '你好呀！我是菲比。欢迎来到 Rotrix！\n目标很简单：把左边的大地图，转成右边目标地图的样子。\n每个象限都要变成同一种颜色哦！',
      },
      {
        pose: 'talk',
        text: '首先，看到这个金色的硬币开关了吗？\n点击它，把旋转方向切换成「逆时针 ↺」。',
        highlightDirectionSwitch: true,
      },
      {
        pose: 'talk',
        text: '很好！现在点击右上角这个闪亮的旋钮，\n让它逆时针转一次。',
        highlightKnobId: 'K02',
        showRotateIcon: true,
      },
      {
        pose: 'happy',
        text: '太棒了！左上角已经变红了！\n接下来点击中间这个旋钮，再逆时针转一次。',
        highlightKnobId: 'K11',
        showRotateIcon: true,
      },
      {
        pose: 'happy',
        text: '完美！你成功了！🎉\n这就是 Rotrix 的基本玩法。接下来进入第 1 关，\n继续挑战吧！',
      },
    ];
    return steps[tutorialStep] ?? steps[0];
  }, [currentLevelId, tutorialStep]);

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
          {/* v0.4.5：棋盘区域包一层 div 供教程高亮定位 */}
          <div ref={boardRef} className="board-with-guide">
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
              pictureId={level.topologyKind === 'square-6x6-picture' ? level.id : undefined}
            />
          </div>
          <div className="right-panel">
            <BoardView
              board={solvedBoard}
              knobs={[]}
              onKnobClick={() => {}}
              preview
              label="目标地图"
            />
            {/* v0.4.5：方向切换按钮包一层 div 供教程高亮定位 */}
            <div ref={directionSwitchRef}>
              <RotationDirectionSwitch
                direction={game.rotationDirection}
                onToggle={game.toggleRotationDirection}
                disabled={game.won}
              />
            </div>
          </div>
        </div>

        {/* v0.4.5：新手教程引导——仅在第 0 关显示 */}
        {tutorialConfig && (
          <TutorialGuide
            step={tutorialStep}
            pose={tutorialConfig.pose}
            text={tutorialConfig.text}
            highlightKnobId={tutorialConfig.highlightKnobId}
            highlightDirectionSwitch={tutorialConfig.highlightDirectionSwitch}
            showRotateIcon={tutorialConfig.showRotateIcon}
            boardRef={boardRef}
            directionSwitchRef={directionSwitchRef}
            onBubbleClick={handleTutorialBubbleClick}
          />
        )}

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

      {game.won && !game.celebrating && (
        <div className="win-overlay" onClick={() => {}}>
          <div className="win-card">
            <h2 className="win-title">🎉 通关！</h2>
            <p className="win-stats">
              第 {level.id} 关 · 用了 {game.moveCount} 步
            </p>
            <div className="win-actions">
              {isTutorial ? (
                // v0.4.5：新手教程通关后，引导进入第 1 关
                <button
                  className="btn primary"
                  onClick={() => setCurrentLevelId(1)}
                >
                  进入第 1 关 →
                </button>
              ) : isFinalChallenge ? (
                // v0.4.1：第 50 关为独立挑战关，通关后仅提示通过，
                // 不提供"下一关"（线性流程已在前 30 关结束），
                // 也不提供"重新开始"循环；只能"再玩一次"或返回关卡选择。
                <>
                  <p className="win-final-hint">恭喜挑战通过！</p>
                  <button className="btn" onClick={() => game.reset()}>
                    再玩一次
                  </button>
                </>
              ) : isLastInCampaign ? (
                <button
                  className="btn primary"
                  onClick={() => setCurrentLevelId(1)}
                >
                  重新开始
                </button>
              ) : (
                <button className="btn primary" onClick={handleNextLevel}>
                  下一关 →
                </button>
              )}
              {!isFinalChallenge && !isTutorial && (
                <button className="btn" onClick={() => game.reset()}>
                  再玩一次
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
