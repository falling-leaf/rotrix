/**
 * 4x4 正方形拓扑
 *
 * 旋钮位于每个 2x2 区域的中心，共 9 个旋钮（3x3 排布）。
 * 每个旋钮旋转其覆盖的 4 个色块。
 *
 * 旋钮编号与覆盖索引：
 *   旋钮 K(r,c) 中心位于 (r+0.5, c+0.5)，覆盖
 *   [r][c], [r][c+1], [r+1][c], [r+1][c+1] —— r,c ∈ {0,1,2}
 *
 * cells 顺序：[左上, 右上, 右下, 左下]（顺时针）以便 rotateCW 语义明确。
 *   左上 = (r, c)
 *   右上 = (r, c+1)
 *   右下 = (r+1, c+1)
 *   左下 = (r+1, c)
 */

import type { Knob, Region, Topology } from './types';

export const SQUARE_4X4_KIND = 'square-4x4';

export class Square4x4Topology implements Topology {
  readonly kind = SQUARE_4X4_KIND;
  private readonly rows = 4;
  private readonly cols = 4;

  size(): number {
    return this.rows * this.cols;
  }

  /** 3x3 = 9 个旋钮 */
  knobs(): Knob[] {
    const result: Knob[] = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const tl = r * this.cols + c;
        const tr = r * this.cols + (c + 1);
        const br = (r + 1) * this.cols + (c + 1);
        const bl = (r + 1) * this.cols + c;
        result.push({
          id: `K${r}${c}`,
          center: [r + 0.5, c + 0.5],
          cells: [tl, tr, br, bl], // 顺时针
          directions: ['CW'],
        });
      }
    }
    return result;
  }

  /** 4 个 2x2 象限作为目标区域 */
  regions(): Region[] {
    const tl = [0, 1, 4, 5];
    const tr = [2, 3, 6, 7];
    const bl = [8, 9, 12, 13];
    const br = [10, 11, 14, 15];
    return [
      { id: 'TL', cells: tl },
      { id: 'TR', cells: tr },
      { id: 'BL', cells: bl },
      { id: 'BR', cells: br },
    ];
  }
}

/** 单例 */
let _instance: Square4x4Topology | null = null;
export function square4x4(): Square4x4Topology {
  if (!_instance) _instance = new Square4x4Topology();
  return _instance;
}

/**
 * 6x6 正方形拓扑
 *
 * 旋钮位于每个 2x2 区域的中心，共 25 个旋钮（5x5 排布）。
 * 每个旋钮旋转其覆盖的 4 个色块。
 *
 * 旋钮编号与覆盖索引：
 *   旋钮 K(r,c) 中心位于 (r+0.5, c+0.5)，覆盖
 *   [r][c], [r][c+1], [r+1][c], [r+1][c+1] —— r,c ∈ {0,1,2,3,4}
 *
 * cells 顺序：[左上, 右上, 右下, 左下]（顺时针）以便 rotateCW 语义明确。
 *
 * 目标区域为 4 个 3x3 象限（非旋钮的 2x2）：
 *   TL: rows 0-2, cols 0-2
 *   TR: rows 0-2, cols 3-5
 *   BL: rows 3-5, cols 0-2
 *   BR: rows 3-5, cols 3-5
 */

export const SQUARE_6X6_KIND = 'square-6x6';

export class Square6x6Topology implements Topology {
  readonly kind = SQUARE_6X6_KIND;
  private readonly rows = 6;
  private readonly cols = 6;

  size(): number {
    return this.rows * this.cols;
  }

  /** 5x5 = 25 个旋钮 */
  knobs(): Knob[] {
    const result: Knob[] = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const tl = r * this.cols + c;
        const tr = r * this.cols + (c + 1);
        const br = (r + 1) * this.cols + (c + 1);
        const bl = (r + 1) * this.cols + c;
        result.push({
          id: `K${r}${c}`,
          center: [r + 0.5, c + 0.5],
          cells: [tl, tr, br, bl], // 顺时针
          directions: ['CW'],
        });
      }
    }
    return result;
  }

  /** 4 个 3x3 象限作为目标区域 */
  regions(): Region[] {
    const tl: number[] = [];
    const tr: number[] = [];
    const bl: number[] = [];
    const br: number[] = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        tl.push(r * this.cols + c);
        tr.push(r * this.cols + (c + 3));
        bl.push((r + 3) * this.cols + c);
        br.push((r + 3) * this.cols + (c + 3));
      }
    }
    return [
      { id: 'TL', cells: tl },
      { id: 'TR', cells: tr },
      { id: 'BL', cells: bl },
      { id: 'BR', cells: br },
    ];
  }
}

/** 单例 */
let _instance6: Square6x6Topology | null = null;
export function square6x6(): Square6x6Topology {
  if (!_instance6) _instance6 = new Square6x6Topology();
  return _instance6;
}

/**
 * 8x8 正方形拓扑
 *
 * 旋钮位于每个 2x2 区域的中心，共 49 个旋钮（7x7 排布）。
 * 每个旋钮旋转其覆盖的 4 个色块。
 *
 * 目标区域为 4 个 4x4 象限：
 *   TL: rows 0-3, cols 0-3
 *   TR: rows 0-3, cols 4-7
 *   BL: rows 4-7, cols 0-3
 *   BR: rows 4-7, cols 4-7
 */
export const SQUARE_8X8_KIND = 'square-8x8';

export class Square8x8Topology implements Topology {
  readonly kind = SQUARE_8X8_KIND;
  private readonly rows = 8;
  private readonly cols = 8;

  size(): number {
    return this.rows * this.cols;
  }

  /** 7x7 = 49 个旋钮 */
  knobs(): Knob[] {
    const result: Knob[] = [];
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const tl = r * this.cols + c;
        const tr = r * this.cols + (c + 1);
        const br = (r + 1) * this.cols + (c + 1);
        const bl = (r + 1) * this.cols + c;
        result.push({
          id: `K${r}${c}`,
          center: [r + 0.5, c + 0.5],
          cells: [tl, tr, br, bl], // 顺时针
          directions: ['CW'],
        });
      }
    }
    return result;
  }

  /** 4 个 4x4 象限作为目标区域 */
  regions(): Region[] {
    const tl: number[] = [];
    const tr: number[] = [];
    const bl: number[] = [];
    const br: number[] = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        tl.push(r * this.cols + c);
        tr.push(r * this.cols + (c + 4));
        bl.push((r + 4) * this.cols + c);
        br.push((r + 4) * this.cols + (c + 4));
      }
    }
    return [
      { id: 'TL', cells: tl },
      { id: 'TR', cells: tr },
      { id: 'BL', cells: bl },
      { id: 'BR', cells: br },
    ];
  }
}

/** 单例 */
let _instance8: Square8x8Topology | null = null;
export function square8x8(): Square8x8Topology {
  if (!_instance8) _instance8 = new Square8x8Topology();
  return _instance8;
}
