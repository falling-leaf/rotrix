/**
 * 六边形三角形棋盘渲染组件 (v0.3.0)
 *
 * 使用 SVG polygon 渲染 54 个小三角形，每个三角形填充对应颜色。
 * 旋钮层与正方形版相同，用绝对定位的 button 覆盖在 SVG 上。
 *
 * 旋转动画：
 * - 6 个三角形围绕旋钮中心旋转 60°（CW）
 * - rAF 逐帧驱动 SVG <g> 的 transform: rotate()
 * - 到达目标角度后停留几帧再 onAnimationEnd（与正方形版同模式）
 * - 旋转期间底层三角形隐藏，overlay 上的 6 三角形覆盖
 */
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { Board, Knob, Color } from '../core/types';
import type { AnimationState } from '../hooks/useGame';
import { TRIANGLE_POINTS } from '../core/hex-topology';
import { TRIANGLE_POINTS_SMALL } from '../core/hex-topology-small';

const ROTATE_DURATION = 200;
const SETTLE_FRAMES = 3;

interface HexBoardViewProps {
  board: Board;
  knobs: Knob[];
  onKnobClick: (knob: Knob) => void;
  onAnimationEnd?: () => void;
  animating?: AnimationState | null;
  disabled?: boolean;
  preview?: boolean;
  label?: string;
  celebrating?: boolean;
}

const COLOR_HEX: Record<Color, string> = {
  red: '#e94560',
  yellow: '#f5d547',
  blue: '#4d8df6',
  green: '#4ecdc4',
  cyan: '#22d3ee',
  magenta: '#e056fd',
};

function HexBoardViewInner({
  board,
  knobs,
  onKnobClick,
  onAnimationEnd,
  animating,
  disabled,
  preview = false,
  label,
  celebrating = false,
}: HexBoardViewProps) {
  const cells = useMemo(() => board.cells, [board.cells]);

  // v0.3.2：根据 dims 选择三角形顶点坐标数组（N=3: 54 三角形 / N=2: 24 三角形）
  const trianglePoints = useMemo(
    () => (board.dims[0] === 24 ? TRIANGLE_POINTS_SMALL : TRIANGLE_POINTS),
    [board.dims],
  );

  // 计算旋转动画 overlay 数据
  const rotateOverlay = useMemo(() => {
    if (!animating || preview) return null;
    const knob = animating.knob;
    const indices = knob.cells;
    const colors = indices.map((i) => board.cells[i].color);
    const cx = knob.center[0];
    const cy = knob.center[1];
    // CW = +60°, CCW = -60°
    const targetAngle = animating.direction === 'CW' ? 60 : -60;
    return { indices, colors, cx, cy, targetAngle };
  }, [animating, board, preview]);

  // rAF 驱动
  const [angle, setAngle] = useState(0);
  const [keepAnimating, setKeepAnimating] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!rotateOverlay) {
      setAngle(0);
      startRef.current = null;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }
    startRef.current = null;
    const target = rotateOverlay.targetAngle;
    let settled = 0;
    const tick = (now: number) => {
      if (startRef.current == null) startRef.current = now;
      const elapsed = now - startRef.current;
      const progress = Math.min(1, elapsed / ROTATE_DURATION);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAngle(target * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        settled++;
        if (settled < SETTLE_FRAMES) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          rafRef.current = null;
          onAnimationEnd?.();
        }
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotateOverlay]);

  // settle 帧逻辑
  useEffect(() => {
    if (!rotateOverlay && keepAnimating) {
      const id = setTimeout(() => setKeepAnimating(false), 30);
      return () => clearTimeout(id);
    }
    if (rotateOverlay && !keepAnimating) {
      setKeepAnimating(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotateOverlay]);

  // 旋转 overlay 中的三角形索引集合（用于底层隐藏）
  const rotatingSet = useMemo(() => {
    if (!rotateOverlay) return new Set<number>();
    return new Set(rotateOverlay.indices);
  }, [rotateOverlay]);

  return (
    <div className={`board-wrapper ${preview ? 'preview' : ''}`}>
      {label && <div className="board-label">{label}</div>}
      <div
        className={`board hex-board ${
          animating || keepAnimating ? 'animating' : ''
        } ${celebrating ? 'celebrating' : ''}`}
      >
        <svg
          className="hex-svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          {/* 底层三角形：旋转中的三角形隐藏（由 overlay 显示） */}
          {cells.map((cell, i) => {
            const pts = trianglePoints[i];
            if (!pts) return null;
            const hidden = rotatingSet.has(i);
            const pointsStr = `${pts[0]},${pts[1]} ${pts[2]},${pts[3]} ${pts[4]},${pts[5]}`;
            // v0.3.2：胜利庆祝——对角线波纹延迟，与正方形版一致。
            // 每个三角形的延迟按其质心的归一化对角线位置计算（左上→右下），
            // 而非全体同时脉冲，形成从左上角到右下角的波浪扫过效果。
            const cx = (pts[0] + pts[2] + pts[4]) / 3;
            const cy = (pts[1] + pts[3] + pts[5]) / 3;
            const delay = celebrating
              ? Math.round(((cx + cy) / 200) * 600)
              : 0;
            return (
              <polygon
                key={i}
                points={pointsStr}
                fill={COLOR_HEX[cell.color]}
                stroke="#ffffff"
                strokeWidth={preview ? 0.3 : 0.4}
                strokeLinejoin="round"
                className={`hex-tri tri-${i}`}
                style={
                  hidden
                    ? { opacity: 0 }
                    : celebrating
                      ? { animationDelay: `${delay}ms` }
                      : undefined
                }
              />
            );
          })}

          {/* 旋转 overlay：6 个三角形围绕旋钮中心旋转 */}
          {rotateOverlay && (
            <g
              style={{
                transform: `rotate(${angle}deg)`,
                transformOrigin: `${rotateOverlay.cx}% ${rotateOverlay.cy}%`,
              }}
            >
              {rotateOverlay.indices.map((triIdx, pos) => {
                const pts = trianglePoints[triIdx];
                if (!pts) return null;
                const pointsStr = `${pts[0]},${pts[1]} ${pts[2]},${pts[3]} ${pts[4]},${pts[5]}`;
                return (
                  <polygon
                    key={triIdx}
                    points={pointsStr}
                    fill={COLOR_HEX[rotateOverlay.colors[pos]]}
                    stroke="#ffffff"
                    strokeWidth={0.4}
                    strokeLinejoin="round"
                  />
                );
              })}
            </g>
          )}
        </svg>

        {!preview && (
          <div className="knob-layer">
            {knobs.map((knob) => {
              const left = knob.center[0];
              const top = knob.center[1];
              return (
                <button
                  key={knob.id}
                  className="knob"
                  style={{
                    top: `${top}%`,
                    left: `${left}%`,
                  }}
                  onClick={() => onKnobClick(knob)}
                  disabled={disabled || !!animating}
                  aria-label={`旋钮 ${knob.id}`}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export const HexBoardView = memo(HexBoardViewInner);
