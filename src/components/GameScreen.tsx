import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BoardViewRouter as BoardView } from './BoardView';
import { RotationDirectionSwitch } from './RotationDirectionSwitch';
import { SwapButton } from './SwapButton';
import { TutorialGuide, type TutorialPose } from './TutorialGuide';
import { useGame } from '../hooks/useGame';
import { getLevels } from '../levels/levels';
import { getTopologyEntry } from '../core/goals';
import { computeStars, getStarThresholds } from '../hooks/useProgress';

interface GameScreenProps {
  levelId: number;
  coins: number;
  coinsEarned: number;
  developerMode: boolean;
  onWin: (levelId: number, moveCount: number) => void;
  onBack: () => void;
  onNext: (nextLevelId: number) => void;
  onTutorialComplete: () => void;
  onBuySwap: () => boolean;
}

/**
 * v0.8.0：星级进度条组件。
 * 绿色/黄色/红色阈值下方各有一颗星，到达阈值则熄灭一颗。
 * 红色阈值 = 进度条末尾。
 */
function StarProgressBar({
  scramble,
  moveCount,
  topologyKind,
}: {
  scramble: number;
  moveCount: number;
  topologyKind: string;
}) {
  const { threshold3, threshold2 } = getStarThresholds(scramble, topologyKind);
    // 进度条最大值：确保第二颗星与第三颗星间距 ≥ 第一颗与第二颗间距的 2/3
    const max = Math.max(threshold2 + 3, threshold2 + Math.round(1.5 * (threshold2 - threshold3)));
  const barWidth = 321;

  // 各阈值在进度条上的像素位置
  const pos3 = (threshold3 / max) * barWidth;   // 绿色阈值
  const pos2 = (threshold2 / max) * barWidth;   // 黄色阈值
  const posCurrent = Math.min((moveCount / max) * barWidth, barWidth);

  // 当前所在区段的颜色
  const zoneColor =
    moveCount <= threshold3 ? '#4CAF50' :
    moveCount <= threshold2 ? '#FF9800' :
    '#F44336';

  // 三颗星的点亮状态
  const star3Filled = moveCount <= threshold3;  // 绿色阈值下方——未到则亮
  const star2Filled = moveCount <= threshold2;  // 黄色阈值下方——未到则亮

  return (
    <div className="gs-star-bar-wrapper">
      <svg width={barWidth} height="42" viewBox={`0 0 ${barWidth} 42`} fill="none">
        <defs>
          {/* 14px 星星路径（白色轮廓）——v0.8.1 改用 star.png */}
        </defs>

        {/* 背景轨道 */}
        <rect x="0" y="6" width={barWidth} height="8" rx="4" fill="#E0E0E0" />
        {/* 已走部分 */}
        <rect x="0" y="6" width={posCurrent} height="8" rx="4" fill={zoneColor} />
        {/* 绿色阈值标记 */}
        <line x1={pos3} y1="2" x2={pos3} y2="18" stroke="#4CAF50" strokeWidth="1.5" strokeDasharray="3 2" />
        {/* 黄色阈值标记 */}
        <line x1={pos2} y1="2" x2={pos2} y2="18" stroke="#FF9800" strokeWidth="1.5" strokeDasharray="3 2" />
        {/* 当前位置指示器（三角形） */}
        <polygon
          points={`${posCurrent - 5},4 ${posCurrent + 5},4 ${posCurrent},0`}
          fill={zoneColor}
        />
        {/* 当前位置圆点 */}
        <circle cx={posCurrent} cy="10" r="4" fill="white" stroke={zoneColor} strokeWidth="1.5" />

        {/* 三颗星——各在阈值下方，v0.8.1 改用 star.png */}
        {/* 星星 3：绿色阈值下方 */}
        <image
          href="/star.png"
          x={pos3 - 8}
          y="22"
          width="16"
          height="16"
          style={{ opacity: star3Filled ? 1 : 0.3 }}
        />
        {/* 星星 2：黄色阈值下方 */}
        <image
          href="/star.png"
          x={pos2 - 8}
          y="22"
          width="16"
          height="16"
          style={{ opacity: star2Filled ? 1 : 0.3 }}
        />
        {/* 星星 1：红色阈值（末尾）下方 */}
        <image
          href="/star.png"
          x={barWidth - 24}
          y="22"
          width="16"
          height="16"
          style={{ opacity: 1 }}
        />
      </svg>
    </div>
  );
}

/**
 * v0.6.2：游戏页面视觉重设计。
 * 固定 375×667 画布，缩放适配屏幕。
 * 移动端布局：操作地图在上，目标地图和金币并列，对换和重置在底部。
 * PC 端也显示为移动端版面。
 * v0.8.0：顶部栏上移，新增星级进度条。
 * v0.8.1：步数移至进度条下方，原位置显示金币。
 */
export function GameScreen({ levelId, coins, coinsEarned, developerMode, onWin, onBack, onNext, onTutorialComplete, onBuySwap }: GameScreenProps) {
  const levels = getLevels();
  const level = levels.find((l) => l.id === levelId) ?? levels[0];
  const game = useGame(level, coins, developerMode, onBuySwap);
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
      onWin(levelId, game.moveCount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.won, game.celebrating]);

  const nextLevelId = useMemo(() => {
    if (levelId === 0) return 1;
    if (levelId < 50) return levelId + 1;
    if (levelId === 50) return 51;
    return null;
  }, [levelId]);

  const isTutorial = levelId === 0;
  const isLastLevel = levelId === 51;

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

        {/* ===== 顶部行：返回按钮 | 金币 | 关卡标签 ===== */}
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

        <div className="gs-coin-display">
          <div className="gs-coin-outer">
            <div className="gs-coin-inner">
              <img className="gs-coin-icon" src="/coin.png" alt="金币" />
              <span className="gs-coin-text">{coins}</span>
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

        {/* ===== v0.8.0：星级进度条（非教程关卡显示） ===== */}
        {!isTutorial && (
          <StarProgressBar
            scramble={level.scramble}
            moveCount={game.moveCount}
            topologyKind={level.topologyKind}
          />
        )}

        {/* ===== v0.8.1：步数显示——进度条下方，第一颗星星左侧 ===== */}
        <div className="gs-step-counter-below">
          <div className="gs-step-below-outer">
            <div className="gs-step-below-inner">
              <span className="gs-step-below-label">步数</span>
              <span className="gs-step-below-text">{game.moveCount}</span>
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
                  pictureId={level.topologyKind === 'square-6x6-picture' || level.topologyKind === 'square-8x8-picture' || level.topologyKind === 'hex-small-triangle-picture' || level.topologyKind === 'square-4x4-icon' ? level.id : undefined}
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
                swapCost={game.swapCost}
                coins={coins}
                developerMode={developerMode}
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
                第 {level.id} 关 · 用了 {game.moveCount} 步 · 获得{computeStars(level.scramble, game.moveCount, level.topologyKind)}星
              </p>
              {coinsEarned > 0 && (
                <p className="win-coins">
                  <img className="win-coin-icon" src="/coin.png" alt="" />
                  +{coinsEarned} 金币
                </p>
              )}
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