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
import type { AnimationState, SwapAnimationState } from '../hooks/useGame';
import { TRIANGLE_POINTS } from '../core/hex-topology';
import { TRIANGLE_POINTS_SMALL } from '../core/hex-topology-small';

const ROTATE_DURATION = 200;
const SETTLE_FRAMES = 3;
/** v0.3.5：对换动画时长（ms） */
const SWAP_DURATION = 350;

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
  /** v0.3.4：当前旋转方向，用于设置旋钮图标（CW=↻ / CCW=↺） */
  direction?: 'CW' | 'CCW';
  /** v0.3.5：是否处于对换选择模式 */
  swapMode?: boolean;
  /** v0.3.5：对换模式下已选中的第一个格子索引 */
  swapSelection?: number | null;
  /** v0.3.5：对换动画状态 */
  swapAnimating?: SwapAnimationState | null;
  /** v0.3.5：对换模式下的格子点击回调 */
  onCellClick?: (index: number) => void;
  /** v0.3.5：对换动画结束回调 */
  onSwapAnimationEnd?: () => void;
}

const COLOR_HEX: Record<Color, string> = {
  red: '#d93747',
  yellow: '#e8b830',
  blue: '#3a7bd5',
  green: '#1b8a3b',
  cyan: '#1ab5c4',
  magenta: '#c742d6',
};

/** 立体感：三角形色块 3-stop 线性渐变颜色变体。
 * 亮色(混白12%)→本色→暗色(混黑8%)，模拟光源从左上照射。
 * 与正方形 .cell 的 CSS linear-gradient 同思路——仅色阶变化，无投影。 */
function lighten(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
}
function darken(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const dr = Math.round(r * (1 - amount));
  const dg = Math.round(g * (1 - amount));
  const db = Math.round(b * (1 - amount));
  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
}
const COLOR_LIGHT: Record<Color, string> = {
  red: lighten('#d93747', 0.12),
  yellow: lighten('#e8b830', 0.12),
  blue: lighten('#3a7bd5', 0.12),
  green: lighten('#1b8a3b', 0.12),
  cyan: lighten('#1ab5c4', 0.12),
  magenta: lighten('#c742d6', 0.12),
};
const COLOR_DARK: Record<Color, string> = {
  red: darken('#d93747', 0.08),
  yellow: darken('#e8b830', 0.08),
  blue: darken('#3a7bd5', 0.08),
  green: darken('#1b8a3b', 0.08),
  cyan: darken('#1ab5c4', 0.08),
  magenta: darken('#c742d6', 0.08),
};
function hexGradId(color: Color): string {
  return `hex-grad-${color}`;
}

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
  direction = 'CW',
  swapMode = false,
  swapSelection = null,
  swapAnimating = null,
  onCellClick,
  onSwapAnimationEnd,
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

  // v0.3.5：对换动画 overlay 数据——两个三角形格子的质心坐标和颜色
  const swapOverlay = useMemo(() => {
    if (!swapAnimating || preview) return null;
    const { indexA, indexB } = swapAnimating;
    const ptsA = trianglePoints[indexA];
    const ptsB = trianglePoints[indexB];
    if (!ptsA || !ptsB) return null;
    // 质心 = 三顶点坐标平均
    const cxA = (ptsA[0] + ptsA[2] + ptsA[4]) / 3;
    const cyA = (ptsA[1] + ptsA[3] + ptsA[5]) / 3;
    const cxB = (ptsB[0] + ptsB[2] + ptsB[4]) / 3;
    const cyB = (ptsB[1] + ptsB[3] + ptsB[5]) / 3;
    const colorA = board.cells[indexA].color;
    const colorB = board.cells[indexB].color;
    // 保存两三角形的顶点（用于在动画 overlay 中绘制飞行的三角形）
    const polyA = `${ptsA[0]},${ptsA[1]} ${ptsA[2]},${ptsA[3]} ${ptsA[4]},${ptsA[5]}`;
    const polyB = `${ptsB[0]},${ptsB[1]} ${ptsB[2]},${ptsB[3]} ${ptsB[4]},${ptsB[5]}`;
    return { cxA, cyA, cxB, cyB, colorA, colorB, polyA, polyB };
  }, [swapAnimating, board, preview, trianglePoints]);

  // v0.3.5：对换动画 progress（0→1）
  const [swapProgress, setSwapProgress] = useState(0);
  const [keepSwapAnimating, setKeepSwapAnimating] = useState(false);
  const swapRafRef = useRef<number | null>(null);
  const swapStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!swapOverlay) {
      setSwapProgress(0);
      swapStartRef.current = null;
      if (swapRafRef.current != null) {
        cancelAnimationFrame(swapRafRef.current);
        swapRafRef.current = null;
      }
      return;
    }
    swapStartRef.current = null;
    let settled = 0;
    const tick = (now: number) => {
      if (swapStartRef.current == null) swapStartRef.current = now;
      const elapsed = now - swapStartRef.current;
      const progress = Math.min(1, elapsed / SWAP_DURATION);
      const eased =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      setSwapProgress(eased);
      if (progress < 1) {
        swapRafRef.current = requestAnimationFrame(tick);
      } else {
        settled++;
        if (settled < SETTLE_FRAMES) {
          swapRafRef.current = requestAnimationFrame(tick);
        } else {
          swapRafRef.current = null;
          onSwapAnimationEnd?.();
        }
      }
    };
    swapRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (swapRafRef.current != null) {
        cancelAnimationFrame(swapRafRef.current);
        swapRafRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapOverlay]);

  useEffect(() => {
    if (!swapOverlay && keepSwapAnimating) {
      const id = setTimeout(() => setKeepSwapAnimating(false), 30);
      return () => clearTimeout(id);
    }
    if (swapOverlay && !keepSwapAnimating) {
      setKeepSwapAnimating(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapOverlay]);

  // v0.3.5：swapHiddenSet 不再需要——对换中的三角形改为填充面板色，不隐藏

  return (
    <div className={`board-wrapper ${preview ? 'preview' : ''}`}>
      {label && <div className="board-label">{label}</div>}
      <div
        className={`board hex-board ${
          animating || keepAnimating || swapOverlay || keepSwapAnimating ? 'animating' : ''
        } ${celebrating ? 'celebrating' : ''} ${swapMode ? 'swap-mode' : ''}`}
      >
        <svg
          className="hex-svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          {/* 渐变定义——每种颜色一个 linearGradient，
           * 亮色(左上0%)→本色(50%)→暗色(右下100%)，模拟光源从左上照射。
           * 无 feDropShadow 投影——仅靠色阶变化产生立体感。 */}
          <defs>
            {(['red', 'yellow', 'blue', 'green', 'cyan', 'magenta'] as Color[]).map((c) => (
              <linearGradient key={c} id={hexGradId(c)} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLOR_LIGHT[c]} />
                <stop offset="50%" stopColor={COLOR_HEX[c]} />
                <stop offset="100%" stopColor={COLOR_DARK[c]} />
              </linearGradient>
            ))}
          </defs>
          {/* 底层三角形：旋转中的三角形隐藏（由 overlay 显示）。
           * v0.3.5：对换中的三角形也隐藏（由 swap overlay 显示飞行版） */}
          {cells.map((cell, i) => {
            const pts = trianglePoints[i];
            if (!pts) return null;
            const isRotatingHidden = rotatingSet.has(i);
            // v0.3.5：对换动画中，参与对换的两个三角形底层填充为面板色（白色），
            // 而非隐藏为透明——这样原位置显示白色底，与棋盘背景一致，
            // 避免飞行色块与底层同色叠影。
            const isSwapping = !!swapAnimating && (swapAnimating.indexA === i || swapAnimating.indexB === i);
            const pointsStr = `${pts[0]},${pts[1]} ${pts[2]},${pts[3]} ${pts[4]},${pts[5]}`;
            // v0.3.2：胜利庆祝——对角线波纹延迟，与正方形版一致。
            // 每个三角形的延迟按其质心的归一化对角线位置计算（左上→右下），
            // 而非全体同时脉冲，形成从左上角到右下角的波浪扫过效果。
            const cx = (pts[0] + pts[2] + pts[4]) / 3;
            const cy = (pts[1] + pts[3] + pts[5]) / 3;
            const delay = celebrating
              ? Math.round(((cx + cy) / 200) * 600)
              : 0;
            // v0.3.5：对换模式下，三角形可点击交互
            const swapSelected = swapMode && swapSelection === i;
            const swapClickable = swapMode && !preview && !animating && !swapAnimating;
            // v0.3.5：对换动画中，原位置填充面板色；旋转中仍隐藏
            const fill = isSwapping ? 'var(--panel)' : `url(#${hexGradId(cell.color)})`;
            return (
              <polygon
                key={i}
                points={pointsStr}
                fill={fill}
                stroke={isSwapping ? 'none' : '#ffffff'}
                strokeWidth={preview ? 0.3 : 0.4}
                strokeLinejoin="round"
                className={`hex-tri tri-${i} ${swapSelected ? 'swap-selected' : ''} ${swapClickable ? 'swap-clickable' : ''} ${isSwapping ? 'swapping' : ''}`}
                style={{
                  // v0.3.5：swap-selected 的 transform: scale 需以三角形质心为原点，
                  // 否则 SVG transform-origin 默认为 0,0（viewBox 左上角），
                  // 缩放后三角形会向右下角偏移。
                  // celebrate-pulse 动画同样需要质心为原点，否则缩放向右下偏移。
                  transformOrigin: `${cx}% ${cy}%`,
                  ...(isRotatingHidden
                    ? { opacity: 0 }
                    : celebrating
                      ? { animationDelay: `${delay}ms` }
                      : {}),
                }}
                onClick={swapClickable ? () => onCellClick?.(i) : undefined}
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
                    fill={`url(#${hexGradId(rotateOverlay.colors[pos])})`}
                    stroke="#ffffff"
                    strokeWidth={0.4}
                    strokeLinejoin="round"
                  />
                );
              })}
            </g>
          )}

          {/* v0.3.5：对换动画 overlay——两个三角形互相飞移。
           * 用 SVG <g> 包装每个飞行三角形，通过 translate 移动质心。 */}
          {swapOverlay && (
            <>
              {/* 三角形 A 飞向 B 的位置 */}
              <g
                style={{
                  transform: `translate(${(swapOverlay.cxB - swapOverlay.cxA) * swapProgress}px, ${(swapOverlay.cyB - swapOverlay.cyA) * swapProgress}px)`,
                }}
              >
                <polygon
                  points={swapOverlay.polyA}
                  fill={`url(#${hexGradId(swapOverlay.colorA)})`}
                  stroke="#ffffff"
                  strokeWidth={0.4}
                  strokeLinejoin="round"
                />
              </g>
              {/* 三角形 B 飞向 A 的位置 */}
              <g
                style={{
                  transform: `translate(${(swapOverlay.cxA - swapOverlay.cxB) * swapProgress}px, ${(swapOverlay.cyA - swapOverlay.cyB) * swapProgress}px)`,
                }}
              >
                <polygon
                  points={swapOverlay.polyB}
                  fill={`url(#${hexGradId(swapOverlay.colorB)})`}
                  stroke="#ffffff"
                  strokeWidth={0.4}
                  strokeLinejoin="round"
                />
              </g>
            </>
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
                  className={`knob knob-${direction.toLowerCase()}`}
                  style={{
                    top: `${top}%`,
                    left: `${left}%`,
                  }}
                  onClick={() => onKnobClick(knob)}
                  disabled={disabled || !!animating || swapMode || !!swapAnimating}
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
