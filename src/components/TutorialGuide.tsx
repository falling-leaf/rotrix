import { useEffect, useState } from 'react';
import poseTalk from '../assets/pose5.png';
import poseHappy from '../assets/pose6.png';
import poseWand from '../assets/pose7.png';
import poseNormal from '../assets/pose4.png';

export type TutorialPose = 'talk' | 'happy' | 'wand' | 'normal';

interface TutorialGuideProps {
  /** 当前教程步骤 */
  step: number;
  /** 角色姿势 */
  pose: TutorialPose;
  /** 提示文本 */
  text: string;
  /** 需要高亮的旋钮 id（如 'K02'），无则 null */
  highlightKnobId?: string | null;
  /** 是否高亮方向切换按钮 */
  highlightDirectionSwitch?: boolean;
  /** 是否显示旋转图标（在被高亮旋钮周围色块上方） */
  showRotateIcon?: boolean;
  /** 棋盘 DOM 引用（用于定位高亮框） */
  boardRef: React.RefObject<HTMLDivElement>;
  /** 方向切换按钮 DOM 引用 */
  directionSwitchRef?: React.RefObject<HTMLDivElement>;
  /** 点击气泡回调（用于推进教程步骤） */
  onBubbleClick?: () => void;
}

const POSE_MAP: Record<TutorialPose, string> = {
  talk: poseTalk,
  happy: poseHappy,
  wand: poseWand,
  normal: poseNormal,
};

/**
 * v0.4.5：新手教程引导组件。
 * 在棋盘旁显示角色形象与文本气泡，并用高亮框/手指图标/旋转图标
 * 指示当前需要操作的旋钮或按钮。
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
  const [knobRect, setKnobRect] = useState<DOMRect | null>(null);
  const [switchRect, setSwitchRect] = useState<DOMRect | null>(null);

  // 定位高亮元素
  useEffect(() => {
    if (!boardRef.current) return;
    const boardEl = boardRef.current;

    if (highlightKnobId) {
      const knobEl = boardEl.querySelector(`[aria-label="旋钮 ${highlightKnobId}"]`);
      if (knobEl) {
        setKnobRect(knobEl.getBoundingClientRect());
      } else {
        setKnobRect(null);
      }
    } else {
      setKnobRect(null);
    }

    if (highlightDirectionSwitch && directionSwitchRef?.current) {
      setSwitchRect(directionSwitchRef.current.getBoundingClientRect());
    } else {
      setSwitchRect(null);
    }
  }, [highlightKnobId, highlightDirectionSwitch, boardRef, directionSwitchRef, step]);

  // 计算高亮框位置（相对 viewport，用 fixed 定位）
  const highlightStyle = (rect: DOMRect | null): React.CSSProperties => {
    if (!rect) return { display: 'none' };
    const padding = 8;
    return {
      position: 'fixed',
      left: rect.left - padding,
      top: rect.top - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
      zIndex: 999,
      pointerEvents: 'none',
    };
  };

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
          {/* v0.4.5：步骤 0/4 显示"点击继续"提示，引导用户点击气泡推进 */}
          {(step === 0 || step === 4) && (
            <div className="tutorial-next-hint">点击继续 →</div>
          )}
        </div>
      </div>

      {/* 旋钮高亮框 */}
      {knobRect && (
        <div className="tutorial-highlight" style={highlightStyle(knobRect)}>
          <div className="tutorial-highlight-ring" />
          {/* 手指图标指向旋钮 */}
          <div className="tutorial-finger">👆</div>
          {/* 旋转图标虚浮在旋钮上方 */}
          {showRotateIcon && <div className="tutorial-rotate-icon">↻</div>}
        </div>
      )}

      {/* 方向切换按钮高亮框 */}
      {switchRect && (
        <div className="tutorial-highlight" style={highlightStyle(switchRect)}>
          <div className="tutorial-highlight-ring" />
          <div className="tutorial-finger">👆</div>
        </div>
      )}
    </>
  );
}
