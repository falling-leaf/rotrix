import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Board, Knob, Color } from '../core/types';
import type { AnimationState, SwapAnimationState } from '../hooks/useGame';
import { HexBoardView } from './HexBoardView';

/** 旋转动画时长（ms）——v0.1.3：350ms → 200ms，缩减单次旋转开销 */
const ROTATE_DURATION = 200;
/** 旋转到达目标角度后停留的额外帧数，确保 board commit 后再卸载 overlay */
const SETTLE_FRAMES = 3;
/** v0.3.5：对换动画时长（ms）——飞出 + 飞入合计 */
const SWAP_DURATION = 350;

interface CellProps {
  color: Color;
  className?: string;
  style?: CSSProperties;
  /** v0.4.0：骰子点数 1-4（可选，有则渲染骰子点） */
  number?: number;
}

/**
 * v0.4.0：骰子点数布局定义。
 * 每种点数对应一组 [x%, y%] 坐标，用 CSS 百分比定位白色圆点。
 * 1: 中心；2: 左上+右下；3: 左上+中心+右下；4: 四角。
 */
const PIP_POSITIONS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
};

function DicePips({ number, counterRotate }: { number: number; counterRotate?: number }) {
  const pips = PIP_POSITIONS[number];
  if (!pips) return null;
  // v0.4.1：旋转 overlay 内的骰子点数需保持正立（不随色块旋转），
  // 仅随色块平移。父级 .rotate-inner 应用了 rotate(angle) scale(scale)，
  // 此处对 .dice-pips 容器施加反向旋转 rotate(-angle) 抵消朝向变化。
  // transform-origin 默认 center = .cell 中心，绕自身中心反向旋转
  // 不改变圆点位置（位置随父级旋转平移），仅归零朝向。
  // scale 不抵消——色块缩放时点数按比例缩放，视觉自然。
  const style: CSSProperties | undefined =
    counterRotate !== undefined
      ? { transform: `rotate(${-counterRotate}deg)` }
      : undefined;
  return (
    <div className="dice-pips" aria-label={`点数 ${number}`} style={style}>
      {pips.map(([x, y], i) => (
        <span
          key={i}
          className="dice-pip"
          style={{ left: `${x}%`, top: `${y}%` }}
        />
      ))}
    </div>
  );
}

function CellBlock({ color, className, style, number }: CellProps) {
  return (
    <div className={`cell ${color} ${className ?? ''}`} style={style}>
      {number !== undefined && <DicePips number={number} />}
    </div>
  );
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
  /** v0.3.4：当前旋转方向，用于设置旋钮图标（CW=↻ / CCW=↺）。
   * 默认 'CW'，保持与历史版本兼容。 */
  direction?: 'CW' | 'CCW';
  /** v0.3.5：是否处于对换选择模式（格子可点击高亮） */
  swapMode?: boolean;
  /** v0.3.5：对换模式下已选中的第一个格子索引（高亮标记） */
  swapSelection?: number | null;
  /** v0.3.5：对换动画状态（两个格子正在飞移） */
  swapAnimating?: SwapAnimationState | null;
  /** v0.3.5：对换模式下的格子点击回调 */
  onCellClick?: (index: number) => void;
  /** v0.3.5：对换动画结束回调 */
  onSwapAnimationEnd?: () => void;
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
  direction = 'CW',
  swapMode = false,
  swapSelection = null,
  swapAnimating = null,
  onCellClick,
  onSwapAnimationEnd,
}: BoardViewProps) {
  const cells = useMemo(() => board.cells, [board.cells]);

  // 计算旋转动画 overlay 的位置和内容
  const rotateOverlay = useMemo(() => {
    if (!animating || preview) return null;
    const knob = animating.knob;
    // 旋钮覆盖的 4 个 cell（顺时针：tl, tr, br, bl）
    const indices = knob.cells;
    const colors = indices.map((i) => board.cells[i].color);
    // v0.4.0：携带骰子点数，旋转 overlay 中同步渲染骰子点
    const numbers = indices.map((i) => board.cells[i].number);
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
    return { colors, numbers, top, left, width: overlayPct, height: overlayPct, targetAngle };
  }, [animating, board, preview]);

  // v0.3.5：计算对换动画 overlay 数据——两个格子的位置和颜色
  const swapOverlay = useMemo(() => {
    if (!swapAnimating || preview) return null;
    const { indexA, indexB } = swapAnimating;
    const colorA = board.cells[indexA].color;
    const colorB = board.cells[indexB].color;
    // v0.4.0：携带骰子点数，对换 overlay 中同步渲染
    const numberA = board.cells[indexA].number;
    const numberB = board.cells[indexB].number;
    // 格子在网格中的位置（行优先）
    const rowA = Math.floor(indexA / board.dims[1]);
    const colA = indexA % board.dims[1];
    const rowB = Math.floor(indexB / board.dims[1]);
    const colB = indexB % board.dims[1];
    // 转百分比坐标（格子中心）
    const cellW = 100 / board.dims[1];
    const cellH = 100 / board.dims[0];
    const ax = (colA + 0.5) * cellW;
    const ay = (rowA + 0.5) * cellH;
    const bx = (colB + 0.5) * cellW;
    const by = (rowB + 0.5) * cellH;
    return { colorA, colorB, numberA, numberB, ax, ay, bx, by, cellW, cellH };
  }, [swapAnimating, board, preview]);

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

  // v0.3.5：对换动画 progress（0→1），驱动两个色块互相飞移。
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
      // ease-in-out cubic：先加速后减速，模拟抛出+落下的物理感
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

  // 对换动画结束后保持 .board.animating 几帧（与旋转同模式）
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

  // 计算旋转中保持不出格的缩放因子
  // 旋转 θ 的正方形，外接矩形边长 = side*(cosθ + sinθ)
  // 令外接矩形 = 原边界框，则 scale = 1 / (cosθ + sinθ)
  const rad = (angle * Math.PI) / 180;
  const scale = 1 / (Math.cos(rad) + Math.sin(rad));

  return (
    <div className={`board-wrapper ${preview ? 'preview' : ''}`}>
      {label && <div className="board-label">{label}</div>}
      <div className={`board ${(animating || keepAnimating || swapOverlay || keepSwapAnimating) ? 'animating' : ''} ${celebrating ? 'celebrating' : ''} ${swapMode ? 'swap-mode' : ''}`}>
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
            // v0.3.5：对换模式下，格子可点击；已选中的格子高亮
            const swapSelected = swapMode && swapSelection === i;
            const swapClickable = swapMode && !preview && !animating && !swapAnimating;
            // v0.3.5：对换动画中，参与对换的两个格子底层显示为面板色（白色），
            // 而非原始色——飞行的色块由 swap overlay 承载，
            // 原位置露出白色底，避免用户看到色块"原地不动+飞行"的叠影。
            const isSwapping = !!swapAnimating && (swapAnimating.indexA === i || swapAnimating.indexB === i);
            const displayColor = isSwapping ? '__panel' : cell.color;
            return (
              <div
                key={i}
                className={`cell-slot ${swapSelected ? 'swap-selected' : ''} ${swapClickable ? 'swap-clickable' : ''} ${isSwapping ? 'swapping' : ''}`}
                onClick={swapClickable ? () => onCellClick?.(i) : undefined}
              >
                <CellBlock
                  color={displayColor as Color}
                  number={isSwapping ? undefined : cell.number}
                  style={celebrating ? { animationDelay: `${delay}ms` } : undefined}
                />
              </div>
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
              {/* v0.4.0：骰子点数也需按行优先交换索引 3/2 */}
              {/* v0.4.1：骰子点数保持正立，仅随色块平移不旋转——
                  传入当前旋转角度，DicePips 内施加反向 rotate(-angle) */}
              <div className="rot-cell tl">
                <div className={`cell ${rotateOverlay.colors[0]}`}>
                  {rotateOverlay.numbers[0] !== undefined && (
                    <DicePips number={rotateOverlay.numbers[0]} counterRotate={angle} />
                  )}
                </div>
              </div>
              <div className="rot-cell tr">
                <div className={`cell ${rotateOverlay.colors[1]}`}>
                  {rotateOverlay.numbers[1] !== undefined && (
                    <DicePips number={rotateOverlay.numbers[1]} counterRotate={angle} />
                  )}
                </div>
              </div>
              <div className="rot-cell bl">
                <div className={`cell ${rotateOverlay.colors[3]}`}>
                  {rotateOverlay.numbers[3] !== undefined && (
                    <DicePips number={rotateOverlay.numbers[3]} counterRotate={angle} />
                  )}
                </div>
              </div>
              <div className="rot-cell br">
                <div className={`cell ${rotateOverlay.colors[2]}`}>
                  {rotateOverlay.numbers[2] !== undefined && (
                    <DicePips number={rotateOverlay.numbers[2]} counterRotate={angle} />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* v0.3.5：对换动画 overlay——两个色块互相飞移 */}
        {swapOverlay && (
          <div className="swap-overlay">
            {/* 格子 A 的色块飞向 B 的位置 */}
            <div
              className="swap-piece"
              style={{
                width: `${swapOverlay.cellW}%`,
                height: `${swapOverlay.cellH}%`,
                left: `${swapOverlay.ax + (swapOverlay.bx - swapOverlay.ax) * swapProgress}%`,
                top: `${swapOverlay.ay + (swapOverlay.by - swapOverlay.ay) * swapProgress}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <CellBlock color={swapOverlay.colorA} number={swapOverlay.numberA} />
            </div>
            {/* 格子 B 的色块飞向 A 的位置 */}
            <div
              className="swap-piece"
              style={{
                width: `${swapOverlay.cellW}%`,
                height: `${swapOverlay.cellH}%`,
                left: `${swapOverlay.bx + (swapOverlay.ax - swapOverlay.bx) * swapProgress}%`,
                top: `${swapOverlay.by + (swapOverlay.ay - swapOverlay.by) * swapProgress}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <CellBlock color={swapOverlay.colorB} number={swapOverlay.numberB} />
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
                  className={`knob knob-${direction.toLowerCase()}`}
                  style={{ top: `${top}%`, left: `${left}%` }}
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

export const BoardView = memo(BoardViewInner);

/**
 * v0.3.0/v0.3.2：BoardView 路由器——根据 board.dims 分发到正方形或六边形渲染器。
 * 六边形三角形拓扑（dims=[54] N=3 / dims=[24] N=2）使用 HexBoardView，
 * 其余使用正方形 BoardViewInner。
 * HexBoardView 内部根据 dims 选择对应的 TRIANGLE_POINTS 数组。
 * 在 memo 之上包装一层，避免提前 return 违反 hooks 规则。
 */
export function BoardViewRouter(props: BoardViewProps) {
  const isHex =
    props.board.dims.length === 1 &&
    (props.board.dims[0] === 54 || props.board.dims[0] === 24);
  if (isHex) {
    return <HexBoardView {...props} />;
  }
  return <BoardView {...props} />;
}
