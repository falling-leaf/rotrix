import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Board, Knob, Color } from '../core/types';
import type { AnimationState } from '../hooks/useGame';
import { HexBoardView } from './HexBoardView';

/** 旋转动画时长（ms）——v0.1.3：350ms → 200ms，缩减单次旋转开销 */
const ROTATE_DURATION = 200;
/** 旋转到达目标角度后停留的额外帧数，确保 board commit 后再卸载 overlay */
const SETTLE_FRAMES = 3;

interface CellProps {
  color: Color;
  className?: string;
  style?: CSSProperties;
}

function CellBlock({ color, className, style }: CellProps) {
  return <div className={`cell ${color} ${className ?? ''}`} style={style} />;
}

/**
 * 棋盘渲染组件。
 * - cell-grid: 渲染 4x4 色块
 * - knob-layer: 绝对定位的旋钮层
 * - rotate-overlay: 旋转动画层，点击旋钮后覆盖在被旋转的 2x2 区域上
 *
 * 旋钮位置：center = [row+0.5, col+0.5]
 * 百分比换算：top/left = (coord + 0.5) / dims * 100
 *
 * v0.1.2 动画改造：
 * 原实现用 CSS keyframe 动画，实测在浏览器中表现为"卡顿后跳变"——
 * 根因有二：
 *   1) .rotate-inner 是 2x2 grid，DOM 顺序按行优先（TL, TR, BL, BR），
 *      但代码按顺时针 tl/tr/br/bl 渲染，导致 BL/BR 颜色对调，
 *      动画 0° 时已是错位状态，到 90° 跳变到"正确"排列。
 *   2) 用户反馈希望改为实际的图形旋转操作。
 * 改用 requestAnimationFrame 逐帧驱动 transform: rotate(angle) scale(s)。
 * scale = 1 / (cosθ + sinθ)：使旋转中的正方形始终内切于 2x2 边界框，
 * 避免出格与相邻色块重叠。
 */
interface BoardViewProps {
  board: Board;
  knobs: Knob[];
  onKnobClick: (knob: Knob) => void;
  onAnimationEnd?: () => void;
  animating?: AnimationState | null;
  disabled?: boolean;
  /** 是否为预览模式（目标地图），缩小尺寸、禁用旋钮 */
  preview?: boolean;
  /** 预览模式标题 */
  label?: string;
  /** v0.2.1：是否正在播放胜利庆祝动画 */
  celebrating?: boolean;
}

function BoardViewInner({
  board,
  knobs,
  onKnobClick,
  onAnimationEnd,
  animating,
  disabled,
  preview = false,
  label,
  celebrating = false,
}: BoardViewProps) {
  const cells = useMemo(() => board.cells, [board.cells]);

  // 计算旋转动画 overlay 的位置和内容
  const rotateOverlay = useMemo(() => {
    if (!animating || preview) return null;
    const knob = animating.knob;
    // 旋钮覆盖的 4 个 cell（顺时针：tl, tr, br, bl）
    const indices = knob.cells;
    const colors = indices.map((i) => board.cells[i].color);
    // 旋钮中心坐标 [r+0.5, c+0.5]，2x2 区域的左上角 = [r, c]
    const r = Math.floor(knob.center[0]);
    const c = Math.floor(knob.center[1]);
    // 转百分比：2x2 区域占棋盘的 50%
    const top = (r / board.dims[0]) * 100;
    const left = (c / board.dims[1]) * 100;
    // 目标旋转角度：CW=+90, CCW=-90
    const targetAngle = animating.direction === 'CW' ? 90 : -90;
    // v0.2.0：overlay 尺寸按网格维度动态计算（2x2 区域占整盘比例）
    // 4x4: 2/4=50%，6x6: 2/6≈33.3%
    const overlayPct = (2 / board.dims[0]) * 100;
    return { colors, top, left, width: overlayPct, height: overlayPct, targetAngle };
  }, [animating, board, preview]);

  // rAF 驱动：angle 从 0 度动画到 targetAngle。
  // 完成后调用 onAnimationEnd，由上层提交棋盘状态。
  const [angle, setAngle] = useState(0);
  // 当 animating 清除后，再保持 .board.animating 类几帧，
  // 让旋转提交的 cell 颜色变化在 transition 被禁用期间完成，
  // 避免恢复 transition 后底层从原始色 150ms 渐变到目标色（=闪烁）。
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
    // 启动 rAF 动画
    startRef.current = null;
    const target = rotateOverlay.targetAngle;
    // v0.1.2 修复"旋转后闪现原始状态"：
    // 旋转到目标角度后，再多停留几帧（SETTLE_FRAMES）再调用 onAnimationEnd。
    // 这样 overlay 在 90°（=目标排列）保持覆盖底层棋盘，直到上层 setBoard
    // 真正 commit 到 DOM；避免 overlay 卸载与 cell-grid 更新之间存在
    // 一帧间隙导致底层原始色块短暂可见。3 帧 ≈ 50ms，人眼几乎无感但能跨过
    // React 的 commit 与浏览器 paint 间隙。
    let settled = 0;
    const tick = (now: number) => {
      if (startRef.current == null) startRef.current = now;
      const elapsed = now - startRef.current;
      const progress = Math.min(1, elapsed / ROTATE_DURATION);
      // ease-out cubic: 先快后慢，模拟物理旋转感
      const eased = 1 - Math.pow(1 - progress, 3);
      setAngle(target * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // 到达目标角度后，保持 settle 阶段再结束
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
    // onAnimationEnd 来自上层 useCallback，依赖稳定；rotateOverlay 是 useMemo 派生
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotateOverlay]);

  // 旋转结束后保持 .board.animating 几帧，让 cell 颜色提交在 transition 禁用期间完成。
  // rotateOverlay 变 null 的瞬间（onAnimationEnd 清了 animating）触发，
  // 用 setTimeout 30ms 后清 keepAnimating，恢复 transition（此时 cell 已是目标色）。
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

  // 计算旋转中保持不出格的缩放因子
  // 旋转 θ 的正方形，外接矩形边长 = side*(cosθ + sinθ)
  // 令外接矩形 = 原边界框，则 scale = 1 / (cosθ + sinθ)
  const rad = (angle * Math.PI) / 180;
  const scale = 1 / (Math.cos(rad) + Math.sin(rad));

  return (
    <div className={`board-wrapper ${preview ? 'preview' : ''}`}>
      {label && <div className="board-label">{label}</div>}
      <div className={`board ${(animating || keepAnimating) ? 'animating' : ''} ${celebrating ? 'celebrating' : ''}`}>
        <div
          className="cell-grid"
          style={{
            gridTemplateColumns: `repeat(${board.dims[1]}, 1fr)`,
            gridTemplateRows: `repeat(${board.dims[0]}, 1fr)`,
          }}
        >
          {cells.map((cell, i) => {
            // v0.2.1：胜利庆祝——对角线波纹延迟
            // 每个 cell 的延迟 = (row+col) * 60ms，形成从左上到右下的波浪
            const row = Math.floor(i / board.dims[1]);
            const col = i % board.dims[1];
            const delay = celebrating ? (row + col) * 60 : 0;
            return (
              <CellBlock
                key={i}
                color={cell.color}
                style={celebrating ? { animationDelay: `${delay}ms` } : undefined}
              />
            );
          })}
        </div>

        {/* 旋转动画 overlay：在被旋转的 2x2 区域上叠加旋转层 */}
        {rotateOverlay && (
          <div
            className="rotate-overlay"
            style={{
              top: `${rotateOverlay.top}%`,
              left: `${rotateOverlay.left}%`,
              width: `${rotateOverlay.width}%`,
              height: `${rotateOverlay.height}%`,
            }}
          >
            <div
              className="rotate-inner"
              style={{
                transform: `rotate(${angle}deg) scale(${scale})`,
                transformOrigin: 'center center',
              }}
            >
              {/* 2x2 grid 按 DOM 行优先顺序排列：TL, TR, BL, BR */}
              {/* knob.cells 顺序为 [TL, TR, BR, BL]，因此 3/4 需交换 */}
              <div className="rot-cell tl">
                <div className={`cell ${rotateOverlay.colors[0]}`} />
              </div>
              <div className="rot-cell tr">
                <div className={`cell ${rotateOverlay.colors[1]}`} />
              </div>
              <div className="rot-cell bl">
                <div className={`cell ${rotateOverlay.colors[3]}`} />
              </div>
              <div className="rot-cell br">
                <div className={`cell ${rotateOverlay.colors[2]}`} />
              </div>
            </div>
          </div>
        )}

        {!preview && (
          <div className="knob-layer">
            {knobs.map((knob) => {
              const top = ((knob.center[0] + 0.5) / board.dims[0]) * 100;
              const left = ((knob.center[1] + 0.5) / board.dims[1]) * 100;
              return (
                <button
                  key={knob.id}
                  className="knob"
                  style={{ top: `${top}%`, left: `${left}%` }}
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

export const BoardView = memo(BoardViewInner);

/**
 * v0.3.0：BoardView 路由器——根据 board.dims 分发到正方形或六边形渲染器。
 * 六边形三角形拓扑 (dims=[54]) 使用 HexBoardView，其余使用正方形 BoardViewInner。
 * 在 memo 之上包装一层，避免提前 return 违反 hooks 规则。
 */
export function BoardViewRouter(props: BoardViewProps) {
  const isHex = props.board.dims.length === 1 && props.board.dims[0] === 54;
  if (isHex) {
    return <HexBoardView {...props} />;
  }
  return <BoardView {...props} />;
}
