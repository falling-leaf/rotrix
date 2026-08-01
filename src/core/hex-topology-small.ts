// Reference generator (algorithm provenance): see scripts/gen-hex-topology.py
// Reproduces N=3 data and generates this N=2 data via the same cube-coordinate
// algorithm: vertices = integer triples (x,y,z), x+y+z=0, max(|x|,|y|,|z|)<=N;
// triangles = 3 mutually-adjacent vertices; knobs = vertices with exactly 6
// surrounding triangles (ordered CW by projected centroid angle); sectors =
// 60° wedges around center; projection = pointy-top (1.5x, sqrt(3)/2*(y-z))
// normalized to 0..100 viewBox with scale = 100/(2*sqrt(3)*N), origin at (50,50).

/**
 * 六边形三角形拓扑 — 简单版 (v0.3.2)
 *
 * 边长 N=2 的大六边形，由 24 个小三角形组成（N=3 版的缩小版）。
 * 6 个扇区各 4 个三角形（N=3 版为 9 个），7 个旋钮（N=3 版为 19 个），
 * 每旋钮旋转其周围的 6 个三角形。
 *
 * 与 N=3 版完全同构的玩法，仅地图更小、更易上手，作为六边形玩法的入门关卡。
 *
 * 几何参数对照（N=3 → N=2）：
 * | 属性 | N=3 | N=2 |
 * |------|-----|-----|
 * | 小三角形总数 | 54 | 24 |
 * | 旋钮数 | 19 | 7 |
 * | 扇区数 | 6 | 6 |
 * | 每扇区三角形数 | 9 | 4 |
 * | 每旋钮三角形数 | 6 | 6 |
 */

import type { Knob, Region, Topology, Board, Cell, Color } from './types';
import { HEX_COLORS } from './types';

export const HEX_SMALL_TRIANGLE_KIND = 'hex-small-triangle';

/** 旋钮的 cells 数组（7 个旋钮，每个 6 个三角形索引，CW 顺序） */
const KNOB_CELLS: number[][] = [
  [1, 5, 8, 7, 3, 0],
  [2, 3, 7, 10, 9, 4],
  [6, 12, 14, 13, 8, 5],
  [8, 13, 16, 15, 10, 7],
  [9, 10, 15, 18, 17, 11],
  [14, 19, 21, 20, 16, 13],
  [15, 16, 20, 23, 22, 18],
];

/** 旋钮中心 2D 坐标（0..100 viewBox 百分比），用于渲染 */
const KNOB_CENTERS: number[][] = [
  [28.35, 37.5],
  [28.35, 62.5],
  [50.0, 25.0],
  [50.0, 50.0],
  [50.0, 75.0],
  [71.65, 37.5],
  [71.65, 62.5],
];

/**
 * 24 个三角形的顶点坐标（0..100 viewBox 百分比）。
 * 每个三角形的 3 个顶点 × 2 坐标 = 6 个数字。
 * 由 cube 坐标经 pointy-top 投影 + 归一化预计算得到。
 */
export const TRIANGLE_POINTS_SMALL: number[][] = [
  [6.7, 25.0, 6.7, 50.0, 28.35, 37.5],
  [6.7, 25.0, 28.35, 12.5, 28.35, 37.5],
  [6.7, 50.0, 6.7, 75.0, 28.35, 62.5],
  [6.7, 50.0, 28.35, 37.5, 28.35, 62.5],
  [6.7, 75.0, 28.35, 62.5, 28.35, 87.5],
  [28.35, 12.5, 28.35, 37.5, 50.0, 25.0],
  [28.35, 12.5, 50.0, 0.0, 50.0, 25.0],
  [28.35, 37.5, 28.35, 62.5, 50.0, 50.0],
  [28.35, 37.5, 50.0, 25.0, 50.0, 50.0],
  [28.35, 62.5, 28.35, 87.5, 50.0, 75.0],
  [28.35, 62.5, 50.0, 50.0, 50.0, 75.0],
  [28.35, 87.5, 50.0, 75.0, 50.0, 100.0],
  [50.0, 0.0, 50.0, 25.0, 71.65, 12.5],
  [50.0, 25.0, 50.0, 50.0, 71.65, 37.5],
  [50.0, 25.0, 71.65, 12.5, 71.65, 37.5],
  [50.0, 50.0, 50.0, 75.0, 71.65, 62.5],
  [50.0, 50.0, 71.65, 37.5, 71.65, 62.5],
  [50.0, 75.0, 50.0, 100.0, 71.65, 87.5],
  [50.0, 75.0, 71.65, 62.5, 71.65, 87.5],
  [71.65, 12.5, 71.65, 37.5, 93.3, 25.0],
  [71.65, 37.5, 71.65, 62.5, 93.3, 50.0],
  [71.65, 37.5, 93.3, 25.0, 93.3, 50.0],
  [71.65, 62.5, 71.65, 87.5, 93.3, 75.0],
  [71.65, 62.5, 93.3, 50.0, 93.3, 75.0],
];

/** 6 个扇区的三角形索引列表（每扇区 4 个三角形） */
const SECTOR_CELLS: number[][] = [
  [15, 17, 18, 22],
  [4, 9, 10, 11],
  [0, 2, 3, 7],
  [1, 5, 6, 8],
  [12, 13, 14, 19],
  [16, 20, 21, 23],
];

/** 已解决的六边形三角形棋盘（简单版）：每个扇区填充对应颜色 */
export function createSolvedHexSmallTriangle(): Board {
  const cells: Cell[] = new Array(24);
  for (let s = 0; s < 6; s++) {
    const color: Color = HEX_COLORS[s];
    for (const idx of SECTOR_CELLS[s]) {
      cells[idx] = { color };
    }
  }
  return { dims: [24], cells };
}

export class HexSmallTriangleTopology implements Topology {
  readonly kind = HEX_SMALL_TRIANGLE_KIND;

  size(): number {
    return 24;
  }

  /** 7 个旋钮 */
  knobs(): Knob[] {
    return KNOB_CELLS.map((cells, i) => ({
      id: `H${i}`,
      center: KNOB_CENTERS[i],
      cells: [...cells],
      directions: ['CW'],
    }));
  }

  /** 6 个扇区作为目标区域 */
  regions(): Region[] {
    return SECTOR_CELLS.map((cells, i) => ({
      id: `S${i}`,
      cells: [...cells],
    }));
  }
}

/** 单例 */
let _hexSmallInstance: HexSmallTriangleTopology | null = null;
export function hexSmallTriangle(): HexSmallTriangleTopology {
  if (!_hexSmallInstance) _hexSmallInstance = new HexSmallTriangleTopology();
  return _hexSmallInstance;
}
