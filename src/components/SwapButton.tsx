/**
 * v0.3.5：对换道具按钮组件
 *
 * UI 设计：
 * - 正方形图标按钮，上方为魔法棒图案（SVG 内联，无需图片资源）
 * - 图标下方显示剩余次数（"3/3" → "2/3" → ... → "0/3"）
 * - 激活对换模式时按钮高亮（accent 描边 + 背景柔光）
 * - 次数为 0 或已胜利时禁用
 *
 * 放置位置：与"重置"按钮同处 .controls 容器，紧邻在重置按钮左侧。
 */
import { memo } from 'react';

interface SwapButtonProps {
  /** 是否处于对换选择模式（激活态高亮） */
  active: boolean;
  /** 剩余可用次数 */
  swapsLeft: number;
  /** 每关最大次数（用于显示 x/max） */
  maxSwaps?: number;
  /** 是否禁用（已胜利 / 动画中） */
  disabled?: boolean;
  /** 点击切换对换模式 */
  onClick: () => void;
}

/** 内联魔法棒 SVG 图标——一颗五角星 + 斜向棒身 */
const WandIcon = () => (
  <svg
    className="swap-icon"
    viewBox="0 0 24 24"
    width="28"
    height="28"
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
  maxSwaps = 3,
  disabled = false,
  onClick,
}: SwapButtonProps) {
  const isDisabled = disabled || swapsLeft <= 0;
  return (
    <button
      className={`btn swap-btn ${active ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
      onClick={onClick}
      disabled={isDisabled}
      aria-label="对换道具"
      aria-pressed={active}
      title="选择两个格子进行对换"
    >
      <WandIcon />
      <span className="swap-label">对换</span>
      <span className="swap-count">
        {swapsLeft}/{maxSwaps}
      </span>
    </button>
  );
}

export const SwapButton = memo(SwapButtonInner);
