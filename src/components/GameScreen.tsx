import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BoardViewRouter as BoardView } from './BoardView';
import { RotationDirectionSwitch } from './RotationDirectionSwitch';
import { SwapButton } from './SwapButton';
import { TutorialGuide, type TutorialPose } from './TutorialGuide';
import { useGame } from '../hooks/useGame';
import { getLevels } from '../levels/levels';
import { getTopologyEntry } from '../core/goals';

interface GameScreenProps {
  levelId: number;
  onWin: (levelId: number) => void;
  onBack: () => void;
  onNext: (nextLevelId: number) => void;
  onTutorialComplete: () => void;
}

/**
 * v0.6.2：游戏页面视觉重设计。
 * 固定 375×667 画布，缩放适配屏幕。
 * 移动端布局：操作地图在上，目标地图和金币并列，对换和重置在底部。
 * PC 端也显示为移动端版面。
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

  // 教程步骤
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

  const nextLevelId = useMemo(() => {
    if (levelId === 0) return 1;
    if (levelId < 40) return levelId + 1;
    if (levelId === 40) return 50;
    return null;
  }, [levelId]);

  const isTutorial = levelId === 0;
  const isLastLevel = levelId === 50;

  // 教程步骤对应的禁用状态
  const tutorialDisableKnobs = isTutorial && (tutorialStep === 0 || tutorialStep === 1 || tutorialStep === 4);
  const tutorialDisableSwitch = isTutorial && (tutorialStep === 0 || tutorialStep === 2 || tutorialStep === 3 || tutorialStep === 4);
  const tutorialDisableControls = isTutorial;

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

        {/* ===== 顶部行：返回按钮 | 步数 | 关卡标签 ===== */}
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

        <div className="gs-level-label">
          <div className="gs-level-outer">
            <div className="gs-level-inner">
              <span className="gs-level-text">第 {levelId} 关</span>
            </div>
          </div>
        </div>

        {/* ===== 操作地图面板 ===== */}
        <div className="gs-board-panel">
          <div className="gs-board-panel-outer">
            <div className="gs-board-panel-inner">
              <div className="gs-board-label">操作地图</div>
              <div ref={boardRef} className="gs-board-area">
                <BoardView
                  board={game.board}
                  knobs={game.knobs}
                  onKnobClick={game.handleKnobClick}
                  onAnimationEnd={game.onAnimationEnd}
                  animating={game.animating}
                  disabled={game.won || tutorialDisableKnobs}
                  celebrating={game.celebrating}
                  direction={game.rotationDirection}
                  swapMode={game.swapMode}
                  swapSelection={game.swapSelection}
                  swapAnimating={game.swapAnimating}
                  onCellClick={game.handleCellClick}
                  onSwapAnimationEnd={game.onSwapAnimationEnd}
                  pictureId={level.topologyKind === 'square-6x6-picture' ? level.id : undefined}
                  allowedKnobId={tutorialDisableKnobs ? null : (tutorialConfig?.highlightKnobId ?? null)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ===== 目标地图面板（目标地图 + 金币并列） ===== */}
        <div className="gs-target-panel">
          <div className="gs-target-panel-outer">
            <div className="gs-target-panel-inner">
              {/* 左侧：目标地图 */}
              <div className="gs-target-board">
                <div className="board-label">目标地图</div>
                <BoardView
                  board={solvedBoard}
                  knobs={[]}
                  onKnobClick={() => {}}
                  preview
                />
              </div>
              {/* 右侧：金币 + 切换方向 */}
              <div className="gs-target-coin">
                <div ref={directionSwitchRef}>
                  <RotationDirectionSwitch
                    direction={game.rotationDirection}
                    onToggle={game.toggleRotationDirection}
                    disabled={game.won || tutorialDisableSwitch}
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
                disabled={game.won || tutorialDisableControls}
                onClick={game.toggleSwapMode}
              />
              <button className="gs-reset-btn" onClick={game.reset} disabled={tutorialDisableControls}>
                重置
              </button>
            </div>
          </div>
        </div>

        {/* ===== 教程引导 ===== */}
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

        {/* ===== 胜利弹窗 ===== */}
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
    </div>
  );
}
