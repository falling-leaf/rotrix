/**
 * v0.3.5：对换道具按钮组件
 * v0.8.1：5次免费，之后100金币/次，开发者模式无限使用。
 *
 * UI 设计：
 * - 显示剩余免费次数（x/5）
 * - 免费次数用完后显示金币消耗（100金币/次）
 * - 开发者模式显示 ∞
 * - 金币不足时禁用并显示提示
 */
import { memo } from 'react';

interface SwapButtonProps {
  /** 是否处于对换选择模式（激活态高亮） */
  active: boolean;
  /** 剩余免费次数 */
  swapsLeft: number;
  /** 金币购买单价 */
  swapCost: number;
  /** 当前金币持有量 */
  coins: number;
  /** 是否开发者模式 */
  developerMode: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 点击切换对换模式 */
  onClick: () => void;
}

/** 内联魔法棒 SVG 图标——一颗五角星 + 斜向棒身 */
const WandIcon = () => (
  <svg
    className="swap-icon"
    viewBox="0 0 24 24"
    width="24"
    height="24"
    aria-hidden="true"
  >
    {/* 棒身：从左下到右上的圆角矩形 */}
    <rect
      x="3"
      y="13"
      width="14"
      height="3.2"
      rx="1.6"
      transform="rotate(-45 10 14.6)"
      fill="currentColor"
    />
    {/* 棒柄末端圆点 */}
    <circle cx="4.5" cy="19.5" r="2.2" fill="currentColor" />
    {/* 棒尖五角星 */}
    <path
      d="M18 2.2 L19.6 6.2 L23.8 6.5 L20.5 9.3 L21.6 13.4 L18 11.2 L14.4 13.4 L15.5 9.3 L12.2 6.5 L16.4 6.2 Z"
      fill="currentColor"
    />
  </svg>
);

function SwapButtonInner({
  active,
  swapsLeft,
  swapCost,
  coins,
  developerMode,
  disabled = false,
  onClick,
}: SwapButtonProps) {
  // 禁用条件：已禁用 / 无免费次数且非开发者模式且金币不足
  const canAfford = developerMode || swapsLeft > 0 || coins >= swapCost;
  const isDisabled = disabled || !canAfford;

  return (
    <button
      className={`btn swap-btn ${active ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
      onClick={onClick}
      disabled={isDisabled}
      aria-label="对换道具"
      aria-pressed={active}
      title={isDisabled && !developerMode && swapsLeft <= 0 ? `金币不足！需要 ${swapCost} 金币` : '选择两个格子进行对换'}
    >
      <WandIcon />
      <span className="swap-label">对换</span>
      <span className="swap-count">
        {developerMode ? (
          '∞'
        ) : swapsLeft > 0 ? (
          <>x{swapsLeft}</>
        ) : (
          <span className="swap-cost">
            <img className="swap-coin-icon" src="/coin.png" alt="" />
            {swapCost}
          </span>
        )}
      </span>
    </button>
  );
}

export const SwapButton = memo(SwapButtonInner);