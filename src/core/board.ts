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

/**
 * v0.4.0：构建一个已求解的骰子 4x4 目标棋盘。
 *
 * 颜色与 createSolvedSquare4x4 一致（四象限纯色），
 * 叠加 2x2 周期重复的数字模式 1 2 / 3 4，
 * 使得每个 2x2 旋钮覆盖的 4 格恰好包含 {1,2,3,4} 全集。
 *
 * 数字排列（行优先）：
 *   1 2 | 1 2
 *   3 4 | 3 4
 *   ───┼───
 *   1 2 | 1 2
 *   3 4 | 3 4
 */
export function createSolvedDice4x4(): Board {
  const colorOf = (r: number, c: number): Color => {
    if (r < 2 && c < 2) return 'red';
    if (r < 2 && c >= 2) return 'yellow';
    if (r >= 2 && c < 2) return 'blue';
    return 'green';
  };
  // 2x2 周期：(0,0)=1 (0,1)=2 (1,0)=3 (1,1)=4
  const numberOf = (r: number, c: number): number => {
    const rr = r % 2;
    const cc = c % 2;
    if (rr === 0 && cc === 0) return 1;
    if (rr === 0 && cc === 1) return 2;
    if (rr === 1 && cc === 0) return 3;
    return 4;
  };
  const cells: Cell[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      cells.push({ color: colorOf(r, c), number: numberOf(r, c) });
    }
  }
  return { dims: [4, 4], cells };
}

/**
 * v0.4.2：构建第 31 关目标图案——6x6 同心方框。
 *
 * 3 色同心方框，由外向内：
 *   外圈品红 → 红圈 → 中心绿/黄对角分色
 *
 *   MMMMMM
 *   MRRRRM
 *   MRGYRM
 *   MRGYRM
 *   MRRRRM
 *   MMMMMM
 */
export function createSolvedPicture31(): Board {
  return pictureFromString([
    'MMMMMM',
    'MRRRRM',
    'MRGYRM',
    'MRGYRM',
    'MRRRRM',
    'MMMMMM',
  ]);
}

/**
 * v0.4.2：构建第 32 关目标图案——6x6 螺旋回字。
 *
 * 4 色螺旋，从外圈向内圈颜色递变：
 *   外圈红 → 次外圈绿 → 内 2x2 黄/蓝对角
 *
 *   RRRRRR
 *   RGGGGR
 *   RGYBGR
 *   RGYBGR
 *   RGGGGR
 *   RRRRRR
 */
export function createSolvedPicture32(): Board {
  return pictureFromString([
    'RRRRRR',
    'RGGGGR',
    'RGYBGR',
    'RGYBGR',
    'RGGGGR',
    'RRRRRR',
  ]);
}

/**
 * v0.4.2：从字符串数组构建 6x6 图案棋盘的辅助函数。
 *
 * 每个字符代表一个色块颜色：R=red, Y=yellow, B=blue, G=green, C=cyan, M=magenta。
 * 用于手工设计像素图案——将可视化的图案文本转为 Board 数据结构。
 */
const CHAR_TO_COLOR: Record<string, Color> = {
  R: 'red', Y: 'yellow', B: 'blue', G: 'green', C: 'cyan', M: 'magenta',
};

function pictureFromString(rows: string[]): Board {
  const cells: Cell[] = [];
  for (const row of rows) {
    for (const ch of row) {
      const color = CHAR_TO_COLOR[ch];
      if (!color) throw new Error(`Unknown color char: ${ch}`);
      cells.push({ color });
    }
  }
  return { dims: [6, 6], cells };
}

/**
 * v0.4.2 第 33 关：太阳图案。
 *
 * 蓝色天空 + 红色日冕 + 黄色日面。
 *
 *   BBBBBB
 *   BBRRBB
 *   BRRRRB
 *   BRYRYB
 *   BBRRBB
 *   BBBBBB
 */
export function createSolvedPicture33(): Board {
  return pictureFromString([
    'BBBBBB',
    'BBRRBB',
    'BRRRRB',
    'BRYRYB',
    'BBRRBB',
    'BBBBBB',
  ]);
}

/**
 * v0.4.2 第 34 关：房子图案。
 *
 * 红色屋顶 + 黄色墙体 + 蓝色门 + 青色窗。
 *
 *   BBRRBB
 *   BRRRRB
 *   RRYYRR
 *   YYBCYY
 *   YYBCYY
 *   YYBBYY
 */
export function createSolvedPicture34(): Board {
  return pictureFromString([
    'BBRRBB',
    'BRRRRB',
    'RRYYRR',
    'YYBCYY',
    'YYBCYY',
    'YYBBYY',
  ]);
}

/**
 * v0.4.3 第 35 关：心形图案。
 *
 * 红色爱心位于蓝色背景上（饱满心形）。
 *
 *   BRBBRB
 *   RRRRRR
 *   RRRRRR
 *   BRRRRB
 *   BBRRBB
 *   BBBRBB
 */
export function createSolvedPicture35(): Board {
  return pictureFromString([
    'BRBBRB',
    'RRRRRR',
    'RRRRRR',
    'BRRRRB',
    'BBRRBB',
    'BBBRBB',
  ]);
}

/**
 * v0.4.2 第 36 关：三色棋盘图案。
 *
 * R/Y/G 三色偏移棋盘，每格与其上下左右邻居均不同色。
 *
 *   RYGRYG
 *   GRYGRY
 *   RYGRYG
 *   GRYGRY
 *   RYGRYG
 *   GRYGRY
 */
export function createSolvedPicture36(): Board {
  return pictureFromString([
    'RYGRYG',
    'GRYGRY',
    'RYGRYG',
    'GRYGRY',
    'RYGRYG',
    'GRYGRY',
  ]);
}

/**
 * v0.4.2 第 37 关：钻石图案。
 *
 * 蓝色背景 + 红色菱形 + 黄色中心。
 *
 *   BBBBBB
 *   BBRRBB
 *   BRRYRB
 *   BRRYRB
 *   BBRRBB
 *   BBBBBB
 */
export function createSolvedPicture37(): Board {
  return pictureFromString([
    'BBBBBB',
    'BBRRBB',
    'BRRYRB',
    'BRRYRB',
    'BBRRBB',
    'BBBBBB',
  ]);
}

/**
 * v0.4.2 第 38 关：箭头图案。
 *
 * 右指箭头：绿色尾翼 + 红色箭杆 + 黄色箭头 + 蓝色天空。
 *
 *   BBBBBB
 *   BBBYBB
 *   GRRYYB
 *   GRRYYB
 *   BBBYBB
 *   BBBBBB
 */
export function createSolvedPicture38(): Board {
  return pictureFromString([
    'BBBBBB',
    'BBBYBB',
    'GRRYYB',
    'GRRYYB',
    'BBBYBB',
    'BBBBBB',
  ]);
}

/**
 * v0.4.2 第 39 关：树图案。
 *
 * 绿色树冠（两层三角，第四行全绿） + 红色树干 + 蓝色天空。
 *
 *   BBBBBB
 *   BBGGBB
 *   BGGGGB
 *   GGGGGG
 *   BBRRBB
 *   BBRRBB
 */
export function createSolvedPicture39(): Board {
  return pictureFromString([
    'BBBBBB',
    'BBGGBB',
    'BGGGGB',
    'GGGGGG',
    'BBRRBB',
    'BBRRBB',
  ]);
}

/**
 * v0.4.2 第 40 关：笑脸图案。
 *
 * 黄色面孔 + 蓝色眼睛 + 红色嘴巴 + 蓝色背景。
 *
 *   BBBBBB
 *   BYBBYB
 *   YYYYYY
 *   YRRRRY
 *   BYYYYB
 *   BBBBBB
 */
export function createSolvedPicture40(): Board {
  return pictureFromString([
    'BBBBBB',
    'BYBBYB',
    'YYYYYY',
    'YRRRRY',
    'BYYYYB',
    'BBBBBB',
  ]);
}

/** 深拷贝棋盘 */
export function cloneBoard(board: Board): Board {
  return {
    dims: [...board.dims],
    cells: board.cells.map((c) => ({ ...c })),
  };
}

/** 判断两个棋盘内容是否相等（忽略 id/attrs，比较颜色+数字） */
export function boardsEqual(a: Board, b: Board): boolean {
  if (a.dims.length !== b.dims.length) return false;
  for (let i = 0; i < a.dims.length; i++) {
    if (a.dims[i] !== b.dims[i]) return false;
  }
  if (a.cells.length !== b.cells.length) return false;
  for (let i = 0; i < a.cells.length; i++) {
    if (a.cells[i].color !== b.cells[i].color) return false;
    // v0.4.0：骰子玩法需比较数字。若一方有 number 另一方没有则不等，
    // 都有则需相等。都不影响无 number 的旧棋盘。
    const an = a.cells[i].number;
    const bn = b.cells[i].number;
    if (an !== bn) return false;
  }
  return true;
}

/**
 * 将旋钮的 cells 数组顺时针旋转一步。
 * cells 按顺时针顺序排列。
 * CW 旋转：每个位置的色块由其前一位（CW 前一个）的色块替换。
 * 即 new[i] = old[(i + n - 1) % n]。
 * 对于 n=4：new = [old3, old0, old1, old2]（正方形 2x2）。
 * 对于 n=6：new = [old5, old0, old1, old2, old3, old4]（六边形 6 三角形）。
 */
export function rotateCellsCW(cells: Cell[]): Cell[] {
  const n = cells.length;
  if (n !== 4 && n !== 6) return cells; // 当前仅支持 4 块 / 6 块旋钮
  const result: Cell[] = [];
  for (let i = 0; i < n; i++) {
    result.push(cells[(i + n - 1) % n]);
  }
  return result;
}

/** 逆时针旋转（CCW = CW 旋转 n-1 步，等价于反向一步） */
export function rotateCellsCCW(cells: Cell[]): Cell[] {
  const n = cells.length;
  if (n !== 4 && n !== 6) return cells;
  const result: Cell[] = [];
  for (let i = 0; i < n; i++) {
    result.push(cells[(i + 1) % n]);
  }
  return result;
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

/**
 * v0.3.5：交换棋盘上两个格子的颜色（对换道具）。
 * 不修改原棋盘，返回新棋盘。indexA == indexB 时返回克隆（无变化）。
 */
export function swapCells(board: Board, indexA: number, indexB: number): Board {
  const next = cloneBoard(board);
  if (indexA === indexB) return next;
  const tmp = next.cells[indexA];
  next.cells[indexA] = next.cells[indexB];
  next.cells[indexB] = tmp;
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
