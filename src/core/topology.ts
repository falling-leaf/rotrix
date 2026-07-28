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
