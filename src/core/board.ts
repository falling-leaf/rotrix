/**
 * 棋盘操作 - 纯函数
 *
 * 所有操作不修改输入，返回新棋盘，便于撤销/回放/测试。
 */

import type { Board, Cell, Color, Coord, Knob, Move } from './types';

/** 构建一个已求解的目标棋盘（4x4 基础玩法） */
export function createSolvedSquare4x4(): Board {
  // 目标：左上红、右上黄、左下蓝、右下绿
  // 索引: 0 1 | 2 3
  //       4 5 | 6 7
  //       8 9 | 10 11
  //       12 13 | 14 15
  const colorOf = (r: number, c: number): Color => {
    if (r < 2 && c < 2) return 'red';
    if (r < 2 && c >= 2) return 'yellow';
    if (r >= 2 && c < 2) return 'blue';
    return 'green';
  };
  const cells: Cell[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      cells.push({ color: colorOf(r, c) });
    }
  }
  return { dims: [4, 4], cells };
}

/** 构建一个已求解的目标棋盘（6x6 玩法） */
export function createSolvedSquare6x6(): Board {
  // 目标：左上红、右上黄、左下蓝、右下绿，每区 3x3
  // 索引: 0..8  | 9..17
  //       18..26 | 27..35
  const colorOf = (r: number, c: number): Color => {
    if (r < 3 && c < 3) return 'red';
    if (r < 3 && c >= 3) return 'yellow';
    if (r >= 3 && c < 3) return 'blue';
    return 'green';
  };
  const cells: Cell[] = [];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      cells.push({ color: colorOf(r, c) });
    }
  }
  return { dims: [6, 6], cells };
}

/** 深拷贝棋盘 */
export function cloneBoard(board: Board): Board {
  return {
    dims: [...board.dims],
    cells: board.cells.map((c) => ({ ...c })),
  };
}

/** 判断两个棋盘内容是否相等（忽略 id/attrs，只看颜色排列） */
export function boardsEqual(a: Board, b: Board): boolean {
  if (a.dims.length !== b.dims.length) return false;
  for (let i = 0; i < a.dims.length; i++) {
    if (a.dims[i] !== b.dims[i]) return false;
  }
  if (a.cells.length !== b.cells.length) return false;
  for (let i = 0; i < a.cells.length; i++) {
    if (a.cells[i].color !== b.cells[i].color) return false;
  }
  return true;
}

/**
 * 将旋钮的 cells 数组顺时针旋转一步。
 * cells 按 [左上, 右上, 右下, 左下] 顺时针顺序排列。
 * CW 旋转：左上->右上->右下->左下->左上，
 * 即 new[i] = old[(i + 3) % 4]（取上一个位置的色块放到当前位置）。
 * 等价地：old[0]->new[1], old[1]->new[2], old[2]->new[3], old[3]->new[0]。
 */
export function rotateCellsCW(cells: Cell[]): Cell[] {
  const n = cells.length;
  if (n !== 4) return cells; // 当前仅支持 4 块旋钮
  // new[i] = old[(i + 3) % n]
  return [cells[3], cells[0], cells[1], cells[2]];
}

/** 逆时针旋转（CCW = 顺时针旋转三步，等价于反向一步） */
export function rotateCellsCCW(cells: Cell[]): Cell[] {
  const n = cells.length;
  if (n !== 4) return cells;
  // new[i] = old[(i + 1) % n]
  return [cells[1], cells[2], cells[3], cells[0]];
}

/**
 * 在棋盘上应用一次旋转，返回新棋盘。
 * 不修改原棋盘。
 */
export function applyMove(board: Board, knob: Knob, direction: 'CW' | 'CCW' = 'CW'): Board {
  const next = cloneBoard(board);
  const indices = knob.cells;
  const rotated =
    direction === 'CW'
      ? rotateCellsCW(indices.map((i) => next.cells[i]))
      : rotateCellsCCW(indices.map((i) => next.cells[i]));
  for (let i = 0; i < indices.length; i++) {
    next.cells[indices[i]] = rotated[i];
  }
  return next;
}

/** 批量应用移动序列 */
export function applyMoves(board: Board, knobs: Knob[], moves: Move[]): Board {
  const map = new Map(knobs.map((k) => [k.id, k]));
  let cur = board;
  for (const m of moves) {
    const k = map.get(m.knobId);
    if (!k) continue;
    cur = applyMove(cur, k, m.direction);
  }
  return cur;
}

/** 简单 RNG 接口，便于测试注入确定性随机源 */
export interface RNG {
  next(): number; // [0,1)
  int(maxExclusive: number): number; // [0, max)
}

/** 默认基于 Math.random 的 RNG */
export function defaultRNG(): RNG {
  return {
    next: () => Math.random(),
    int: (n) => Math.floor(Math.random() * n),
  };
}

/** 将坐标转为索引（二维） */
export function coord2index(dims: number[], coord: Coord): number {
  if (dims.length !== 2) throw new Error('only 2D supported in coord2index');
  const [r, c] = coord;
  return r * dims[1] + c;
}

/** 将索引转为坐标（二维） */
export function index2coord(dims: number[], index: number): Coord {
  if (dims.length !== 2) throw new Error('only 2D supported in index2coord');
  return [Math.floor(index / dims[1]), index % dims[1]];
}
