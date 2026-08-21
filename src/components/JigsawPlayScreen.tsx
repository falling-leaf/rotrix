/**
 * v0.9.0：拼图模式——单个区块玩法页面。
 *
 * 对应一个 6×6 拼图区块的完整游戏页面。
 * 包含：操作地图、目标地图、旋转方向切换、对换、重置、胜利检测。
 * 完成后标记区块为已完成，自动返回拼图总览页面。
 *
 * 状态同步：每次 board/moveCount 变化时同步回父组件，
 * 以便拼图总览页面显示最新状态，且重新进入时保留进度。
 *
 * 注意：useGame 初始化时使用 modifiedLevel.initial 作为起点，
 * 组件通过 key={tileId} 在切换区块时强制重新挂载。
 * 不要添加监听 modifiedLevel 变化并 reset 的 effect——
 * 那会在每次 board 同步回父组件时重置游戏，导致旋钮点击无效。
 */

import { useEffect, useMemo, useRef } from 'react';
import { BoardViewRouter as BoardView } from './BoardView';
import { RotationDirectionSwitch } from './RotationDirectionSwitch';
import { SwapButton } from './SwapButton';
import { useGame } from '../hooks/useGame';
import type { JigsawTileState, JigsawTileId } from '../core/jigsaw';
import type { Board } from '../core/types';

interface JigsawPlayScreenProps {
  tile: JigsawTileState;
  coins: number;
  /** 修改后的关卡（使用当前棋盘作为 initial） */
  modifiedLevel: JigsawTileState['level'];
  onBack: () => void;
  onTileComplete: (tileId: JigsawTileId, moveCount: number) => void;
  /** v0.9.0：同步棋盘变化回父组件 */
  onBoardChange: (tileId: JigsawTileId, board: Board, moveCount: number) => void;
  onPlaySfx?: (name: 'complete' | 'finish' | 'tutorial') => void;
}

export function JigsawPlayScreen({
  tile,
  coins,
  modifiedLevel,
  onBack,
  onTileComplete,
  onBoardChange,
  onPlaySfx,
}: JigsawPlayScreenProps) {
  const game = useGame(modifiedLevel, coins, false, () => false);

  // 目标棋盘
  const solvedBoard = useMemo<Board>(
    () => tile.solvedBoard,
    [tile.solvedBoard],
  );

  // v0.9.0：同步 board 和 moveCount 回父组件（仅在 board 引用变化时触发）
  const prevBoardRef = useRef<Board | null>(null);
  const prevMoveCountRef = useRef(0);
  useEffect(() => {
    if (prevBoardRef.current === null) {
      prevBoardRef.current = game.board;
      prevMoveCountRef.current = game.moveCount;
      return;
    }
    const boardChanged = game.board.cells !== prevBoardRef.current.cells;
    const moveCountChanged = game.moveCount !== prevMoveCountRef.current;
    if (boardChanged || moveCountChanged) {
      prevBoardRef.current = game.board;
      prevMoveCountRef.current = game.moveCount;
      onBoardChange(tile.id, game.board, game.moveCount);
    }
  });

  // 通关时通知父组件
  useEffect(() => {
    if (game.won && !game.celebrating) {
      onTileComplete(tile.id, game.moveCount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.won, game.celebrating]);

  // 胜利动画播放音效
  useEffect(() => {
    if (game.celebrating) {
      onPlaySfx?.('complete');
    }
  }, [game.celebrating, onPlaySfx]);

  useEffect(() => {
    if (game.won && !game.celebrating) {
      onPlaySfx?.('finish');
    }
  }, [game.won, game.celebrating, onPlaySfx]);

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

        {/* ===== 顶部行：返回按钮 | 金币 | 区块标签 ===== */}
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
              <span className="gs-level-text">区块 {tile.id + 1}</span>
            </div>
          </div>
        </div>

        {/* ===== 步数显示 ===== */}
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

        {/* ===== 目标地图面板 ===== */}
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
                coins={coins}
                developerMode={false}
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
            <div className="win-card" style={{ paddingLeft: '8px', paddingRight: '8px' }}>
              <h2 className="win-title" style={{ fontSize: '40px' }}>🎉 区块完成！</h2>
              <p className="win-stats">
                区块 {tile.id + 1} · 用了 {game.moveCount} 步
              </p>
              <div className="win-actions">
                <button className="btn primary" onClick={onBack}>
                  返回拼图 →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}