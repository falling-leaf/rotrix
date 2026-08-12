import { useEffect, useState } from 'react';
import poseTalk from '../../pics/speaking.png';
import poseHappy from '../../pics/smiling.png';
import poseWand from '../../pics/magic.png';
import poseNormal from '../../pics/normal_state.png';

export type TutorialPose = 'talk' | 'happy' | 'wand' | 'normal';

interface TutorialGuideProps {
  step: number;
  pose: TutorialPose;
  text: string;
  highlightKnobId?: string | null;
  highlightDirectionSwitch?: boolean;
  showRotateIcon?: boolean;
  boardRef: React.RefObject<HTMLDivElement>;
  directionSwitchRef?: React.RefObject<HTMLDivElement>;
  onBubbleClick?: () => void;
}

const POSE_MAP: Record<TutorialPose, string> = {
  talk: poseTalk,
  happy: poseHappy,
  wand: poseWand,
  normal: poseNormal,
};

/**
 * v0.5.2：新手教程引导组件。
 * - 暗色遮罩使用 box-shadow 挖洞，高亮区域透明露出组件本色
 * - 手指图标位于高亮区域下方
 * - 旋转图标为两个弯曲箭头覆盖在旋钮的2x2区域上
 */
export function TutorialGuide({
  step,
  pose,
  text,
  highlightKnobId,
  highlightDirectionSwitch = false,
  showRotateIcon = false,
  boardRef,
  directionSwitchRef,
  onBubbleClick,
}: TutorialGuideProps) {
  // 2x2 旋转区域（旋钮 + 周围四个色块）
  const [rotateAreaRect, setRotateAreaRect] = useState<DOMRect | null>(null);
  // 方向切换组件区域
  const [switchRect, setSwitchRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!boardRef.current) return;
    const boardEl = boardRef.current;

    if (highlightKnobId) {
      const knobEl = boardEl.querySelector(`[aria-label="旋钮 ${highlightKnobId}"]`);
      if (knobEl) {
        const kRect = knobEl.getBoundingClientRect();

        // 计算 2x2 区域：旋钮在中心，2x2 区域 = board 尺寸的一半（4x4 网格）
        const boardInner = boardEl.querySelector('.board');
        if (boardInner) {
          const bRect = boardInner.getBoundingClientRect();
          const knobCx = kRect.left + kRect.width / 2;
          const knobCy = kRect.top + kRect.height / 2;
          const areaSize = bRect.width * 0.5;
          setRotateAreaRect(new DOMRect(
            knobCx - areaSize / 2,
            knobCy - areaSize / 2,
            areaSize,
            areaSize,
          ));
        }
      } else {
        setRotateAreaRect(null);
      }
    } else {
      setRotateAreaRect(null);
    }

    if (highlightDirectionSwitch && directionSwitchRef?.current) {
      const switchEl = directionSwitchRef.current.querySelector('.rotation-switch');
      if (switchEl) {
        setSwitchRect(switchEl.getBoundingClientRect());
      } else {
        setSwitchRect(directionSwitchRef.current.getBoundingClientRect());
      }
    } else {
      setSwitchRect(null);
    }
  }, [highlightKnobId, highlightDirectionSwitch, boardRef, directionSwitchRef, step]);

  return (
    <>
      {/* 角色 + 气泡 */}
      <div className="tutorial-guide">
        <img
          src={POSE_MAP[pose]}
          alt="引导角色"
          className="tutorial-character"
          draggable={false}
        />
        <div className="tutorial-bubble" onClick={onBubbleClick}>
          <div className="tutorial-text">{text}</div>
          {(step === 0 || step === 4) && (
            <div className="tutorial-next-hint">点击继续 →</div>
          )}
        </div>
      </div>

      {/* 全屏暗化遮罩：无高亮目标时（step 0 介绍/step 4 完成），整个界面暗化 */}
      {!rotateAreaRect && !switchRect && (
        <div className="tutorial-overlay-full" />
      )}

      {/* 遮罩挖洞：暗色遮罩覆盖全屏，仅高亮区域（挖洞）露出组件本色 */}
      {rotateAreaRect && (
        <div
          className="tutorial-overlay-hole"
          style={{
            position: 'fixed',
            left: rotateAreaRect.left - 8,
            top: rotateAreaRect.top - 8,
            width: rotateAreaRect.width + 16,
            height: rotateAreaRect.height + 16,
            borderRadius: 14,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
            zIndex: 999,
            pointerEvents: 'none',
          }}
        />
      )}
      {switchRect && (
        <div
          className="tutorial-overlay-hole"
          style={{
            position: 'fixed',
            left: switchRect.left - 8,
            top: switchRect.top - 8,
            width: switchRect.width + 16,
            height: switchRect.height + 16,
            borderRadius: 14,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
            zIndex: 999,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* 手指图标（旋钮下方） */}
      {rotateAreaRect && (
        <div
          className="tutorial-finger"
          style={{
            position: 'fixed',
            left: rotateAreaRect.left + rotateAreaRect.width / 2,
            top: rotateAreaRect.bottom + 8,
            transform: 'translateX(-50%)',
            zIndex: 1002,
            pointerEvents: 'none',
          }}
        >
          👆
        </div>
      )}

      {/* 旋转箭头：两个弯曲箭头覆盖在 2x2 区域上 */}
      {showRotateIcon && rotateAreaRect && (
        <div
          className="tutorial-rotate-area"
          style={{
            position: 'fixed',
            left: rotateAreaRect.left,
            top: rotateAreaRect.top,
            width: rotateAreaRect.width,
            height: rotateAreaRect.height,
            zIndex: 1002,
            pointerEvents: 'none',
          }}
        >
          <svg
            viewBox="0 0 100 100"
            className="tutorial-rotate-svg"
          >
            {/*
             * v0.5.2：根据用户精确坐标重新设计旋转箭头。
             * 2x2 区域编号（从左到右，从上到下）：
             *   [1] [2]
             *   [3] [4]
             *
             * 第一个箭头（左侧，半圆式，向下，箭头向右指向 4）：
             *   起始：1 的中右部分 → (37, 25)
             *   中间：1 和 3 的交界处左侧 → (13, 50)
             *   结束：3 的中右部分 → (37, 75)，箭头向右
             *
             * 第二个箭头（右侧，半圆式，向上，箭头向左指向 1）：
             *   起始：4 的中左部分 → (63, 75)
             *   中间：2 和 4 的交界处右侧 → (87, 50)
             *   结束：2 的中左部分 → (63, 25)，箭头向左
             *
             * 箭头身体粗细 = 色块宽度 1/6（stroke-width: 8）
             * 起始/结束点距边界 ≥ 色块宽度 1/8（≥7px）
             * 中间位置距边界 ≥ 色块宽度 1/4（≥13px）
             * 末端箭头：第一箭头向右（3→4），第二箭头向左（2→1）
             * 箭头同样保证 1/8 边距，允许覆盖在 stroke 之上
             */}
            {/* 左侧弯曲箭头（向下，箭头向右指向 4） */}
            <path
              d="M 37 25 Q 13 25 13 50 Q 13 75 37 75"
              stroke="var(--knob)"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
            />
            <polygon points="37,68 37,82 48,75" fill="var(--knob)" />

            {/* 右侧弯曲箭头（向上，箭头向左指向 1） */}
            <path
              d="M 63 75 Q 87 75 87 50 Q 87 25 63 25"
              stroke="var(--knob)"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
            />
            <polygon points="63,18 63,32 56,25" fill="var(--knob)" />
          </svg>
        </div>
      )}

      {/* 手指图标（方向切换按钮下方） */}
      {switchRect && (
        <div
          className="tutorial-finger"
          style={{
            position: 'fixed',
            left: switchRect.left + switchRect.width / 2,
            top: switchRect.bottom + 8,
            transform: 'translateX(-50%)',
            zIndex: 1002,
            pointerEvents: 'none',
          }}
        >
          👆
        </div>
      )}
    </>
  );
}