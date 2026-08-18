/**
 * Rotrix 核心类型定义
 *
 * 设计原则：核心领域模型与 UI 框架解耦，全部为纯数据 + 纯函数，
 * 便于单元测试与后续拓扑扩展（6x6 / 三角 / 六边 / 三维）。
 */

/** 色块颜色。后续可扩展更多颜色。 */
export type Color = 'red' | 'yellow' | 'blue' | 'green' | 'cyan' | 'orange';

/** 正方形玩法可用颜色，顺序即"目标象限"的默认分配顺序（TL, TR, BL, BR）。 */
export const ALL_COLORS: Color[] = ['red', 'yellow', 'blue', 'green'];

/** 六边形玩法可用颜色（6 色），顺序即 6 个大三角形（扇区）的默认配色。
 * 扇区 0..5 按 CW 顺序，由各扇区三角形中心角度决定。 */
export const HEX_COLORS: Color[] = ['red', 'yellow', 'green', 'cyan', 'blue', 'orange'];

/** 单个色块。id 用于后续"相邻约束"等属性玩法，当前可不填。 */
export interface Cell {
  color: Color;
  /** v0.4.0：骰子点数 1-4（可选，仅骰子玩法棋盘携带） */
  number?: number;
  /** v0.7.2：图标标记（可选，仅图标玩法棋盘携带） */
  icon?: boolean;
  id?: string;
  /** 预留：后续属性玩法（相邻、固定、不可旋转等） */
  attrs?: Record<string, unknown>;
}

/**
 * 坐标。二维为 [row, col]；三维扩展为 [row, col, layer]。
 * 使用数组而非对象，便于跨维度统一处理。
 */
export type Coord = number[];

/**
 * 旋钮：位于若干色块的中心，点击后按顺时针旋转其 cells。
 * cells 为 board.cells 中的索引数组，按顺时针顺序排列，
 * 长度可为 4（正方形 2x2）或 6（六边形 6 三角形）。
 */
export interface Knob {
  id: string;
  /** 旋钮中心坐标（渲染/命中用，逻辑层可忽略） */
  center: Coord;
  /** 被旋转的色块索引，顺时针顺序，长度为 4 或 6 */
  cells: number[];
  /** 可选：旋转方向支持（默认仅 CW，后续可扩展 CCW 旋钮） */
  directions?: ('CW' | 'CCW')[];
}

/**
 * 目标区域：一组色块索引。基础玩法为 4 个 2x2 象限。
 * 后续目标图案改变时，只需替换 regions / goal 策略。
 */
export interface Region {
  id: string;
  cells: number[];
}

/** 棋盘：维度 + 扁平色块数组（行优先）。二维 dims=[rows,cols]。 */
export interface Board {
  dims: number[];
  cells: Cell[];
}

/** 拓扑抽象：不同网格形状实现该接口，提供旋钮与目标区域。 */
export interface Topology {
  /** 拓扑类型标识，用于序列化与注册表 */
  readonly kind: string;
  /** 生成该拓扑下的全部旋钮 */
  knobs(): Knob[];
  /** 生成该拓扑下的目标区域（基础玩法：4 个象限） */
  regions(): Region[];
  /** 棋盘总格子数 */
  size(): number;
}

/** 目标判定策略：给定棋盘与拓扑，返回是否胜利。 */
export interface Goal {
  readonly kind: string;
  satisfied(board: Board, topology: Topology): boolean;
  /** 可选：人类可读的目标描述 */
  describe?(): string;
}

/** 一次旋转操作记录（用于撤销/回放/统计） */
export interface Move {
  knobId: string;
  direction: 'CW' | 'CCW';
}

/** 关卡定义 */
export interface Level {
  id: number;
  name: string;
  /** 难度量化值（由生成器给出，约等于有效随机旋转步数） */
  difficulty: number;
  /** 拓扑类型，当前固定 'square-4x4'，后续扩展 */
  topologyKind: string;
  /** 初始棋盘（题目） */
  initial: Board;
  /** 目标判定策略 */
  goal: Goal;
  /** 生成时使用的旋转序列（便于回放/调试/保证可解） */
  solution: Move[];
  /** v0.4.2：图案关卡的目标棋盘（可选，用于预览渲染。
   * 非图案关卡为 undefined，App 从注册表 defaultSolvedBoard 获取。 */
  solvedBoard?: Board;
}

/** 生成结果 */
export interface GeneratedLevel {
  initial: Board;
  solution: Move[];
  /** 有效旋转步数（已去除立即回退与恒等） */
  difficulty: number;
}
