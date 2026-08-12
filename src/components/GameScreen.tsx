import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BoardViewRouter as BoardView } from './BoardView';
import { RotationDirectionSwitch } from './RotationDirectionSwitch';
import { SwapButton } from './SwapButton';
import { TutorialGuide, type TutorialPose } from './TutorialGuide';
import { useGame } from '../hooks/useGame';
import { getLevels } from '../levels/levels';
import { getTopologyEntry } from '../core/goals';

interface GameScreenProps {
  /** 当前关卡 id */
  levelId: number;
  /** 通关回调（由父组件记录进度） */
  onWin: (levelId: number) => void;
  /** 返回选关界面 */
  onBack: () => void;
  /** 进入下一关 */
  onNext: (nextLevelId: number) => void;
  /** 教程完成后回调（从教程直接进入第 1 关） */
  onTutorialComplete: () => void;
}

/**
 * v0.5.0：游戏关卡界面。
 * 替代原 CampaignScreen，移除关卡选择条，仅保留：
 * - 返回按钮（退回选关界面）
 * - 当前关卡棋盘 + 目标棋盘 + 操作控件
 * - 胜利弹窗：[下一关] + [返回选关界面]
 * - 新手教程引导（仅第 0 关）
 */
export function GameScreen({ levelId, onWin, onBack, onNext, onTutorialComplete }: GameScreenProps) {
  const levels = getLevels();
  const level = levels.find((l) => l.id === levelId) ?? levels[0];
  const game = useGame(level);
  const solvedBoard = useMemo(
    () =>
      level.solvedBoard ?? getTopologyEntry(level.topologyKind).defaultSolvedBoard(),
    [level.topologyKind, level.solvedBoard],
  );

  // v0.4.5：教程步骤
  const [tutorialStep, setTutorialStep] = useState(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const directionSwitchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    game.reset();
    if (levelId === 0) {
      setTutorialStep(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelId]);

  // 教程步骤自动推进
  useEffect(() => {
    if (levelId !== 0) return;
    if (tutorialStep === 1 && game.rotationDirection === 'CCW') {
      setTutorialStep(2);
    }
    if (tutorialStep === 2 && game.moveCount >= 1) {
      setTutorialStep(3);
    }
    if (tutorialStep === 3 && game.won) {
      setTutorialStep(4);
    }
  }, [levelId, tutorialStep, game.rotationDirection, game.moveCount, game.won]);

  const handleTutorialBubbleClick = useCallback(() => {
    if (levelId !== 0) return;
    if (tutorialStep === 0) {
      setTutorialStep(1);
    } else if (tutorialStep === 4) {
      onTutorialComplete();
    }
  }, [levelId, tutorialStep, onTutorialComplete]);

  // 通关时通知父组件
  useEffect(() => {
    if (game.won && !game.celebrating) {
      onWin(levelId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.won, game.celebrating]);

  // 下一关 id：第 0 关→1，1-39→id+1，40→50，50→无（已是最后）
  const nextLevelId = useMemo(() => {
    if (levelId === 0) return 1;
    if (levelId < 40) return levelId + 1;
    if (levelId === 40) return 50;
    return null; // 第 50 关无下一关
  }, [levelId]);

  const isTutorial = levelId === 0;
  const isLastLevel = levelId === 50;

  const tutorialConfig = useMemo(() => {
    if (levelId !== 0) return null;
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
  }, [levelId, tutorialStep]);

  return (
    <div className="app game-screen-app">
      <div className="game-header">
        <button className="btn back-btn" onClick={onBack}>
          ← 返回
        </button>
        <span className="game-level-label">第 {levelId} 关</span>
      </div>

      <div className="game-area">
        <div className="info-bar">
          <span>
            步数 <span className="label">{game.moveCount}</span>
          </span>
        </div>

        <div className="boards-layout">
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
            <div ref={directionSwitchRef}>
              <RotationDirectionSwitch
                direction={game.rotationDirection}
                onToggle={game.toggleRotationDirection}
                disabled={game.won}
              />
            </div>
          </div>
        </div>

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
                <button className="btn primary" onClick={onTutorialComplete}>
                  进入第 1 关 →
                </button>
              ) : isLastLevel || nextLevelId === null ? (
                <button className="btn primary" onClick={onBack}>
                  返回选关 →
                </button>
              ) : (
                <button className="btn primary" onClick={() => onNext(nextLevelId!)}>
                  下一关 →
                </button>
              )}
              <button className="btn" onClick={onBack}>
                返回选关
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
