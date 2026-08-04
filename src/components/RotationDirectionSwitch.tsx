/**
 * v0.3.4：旋转方向切换组件
 *
 * UI 设计为硬币样式：
 * - 硬币正反两面分别显示顺时针（↻）和逆时针（↺）符号
 * - 当前方向对应的面朝上；切换时硬币翻转动画
 * - 下方"切换旋转方向"按钮，点击后切换 CW ↔ CCW
 *
 * 该组件与目标地图共同位于操作地图的右侧（由父层布局控制），
 * 因此本身只负责硬币可视化与按钮交互，不关心布局定位。
 */
import { memo } from 'react';
import type { RotationDirection } from '../hooks/useGame';

interface RotationDirectionSwitchProps {
  direction: RotationDirection;
  onToggle: () => void;
  disabled?: boolean;
}

function RotationDirectionSwitchInner({
  direction,
  onToggle,
  disabled = false,
}: RotationDirectionSwitchProps) {
  // 硬币翻转角度：CW 时正面朝上（0deg），CCW 时翻转 180deg 露出背面
  const coinAngle = direction === 'CW' ? 0 : 180;

  return (
    <div className="rotation-switch">
      <div className={`coin ${disabled ? 'disabled' : ''}`}>
        <div
          className="coin-inner"
          style={{ transform: `rotateY(${coinAngle}deg)` }}
        >
          {/* 正面：顺时针 ↻ */}
          <div className="coin-face coin-front" aria-hidden="true">
            <span className="coin-symbol">↻</span>
            <span className="coin-label">顺时针</span>
          </div>
          {/* 背面：逆时针 ↺ */}
          <div className="coin-face coin-back" aria-hidden="true">
            <span className="coin-symbol">↺</span>
            <span className="coin-label">逆时针</span>
          </div>
        </div>
      </div>
      <button
        className="btn coin-toggle-btn"
        onClick={onToggle}
        disabled={disabled}
      >
        切换旋转方向
      </button>
    </div>
  );
}

export const RotationDirectionSwitch = memo(RotationDirectionSwitchInner);
