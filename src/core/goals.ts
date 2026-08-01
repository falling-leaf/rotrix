/**
 * 目标判定策略
 *
 * 基础玩法：每个目标区域内的 4 个色块颜色相同。
 * 后续扩展：相邻约束、图案匹配等可在此实现新 Goal。
 */

import type { Board, Goal, Topology } from './types';
import { ALL_COLORS } from './types';

export const QUADRANT_GOAL_KIND = 'quadrant-uniform';

/**
 * 基础目标：每个目标区域内颜色统一，且必须与目标地图一致。
 *
 * regions() 返回顺序为 [TL, TR, BL, BR]，ALL_COLORS 同序对应
 * [red, yellow, blue, green]。因此 region[i] 必须全部为 ALL_COLORS[i]。
 *
 * v0.2.4 fix: 此前仅检查每象限内部统一，未校验颜色与目标位置匹配，
 * 导致"四象限各自纯色但颜色整体轮换"（如左上黄、右上红…）被误判为胜利。
 * 现改为逐象限校验期望颜色，等价于"操作地图与目标地图完全一致"。
 */
export class QuadrantUniformGoal implements Goal {
  readonly kind = QUADRANT_GOAL_KIND;

  satisfied(board: Board, topology: Topology): boolean {
    const regions = topology.regions();
    if (regions.length !== ALL_COLORS.length) return false;
    for (let i = 0; i < regions.length; i++) {
      const expected = ALL_COLORS[i];
      for (const idx of regions[i].cells) {
        if (board.cells[idx]?.color !== expected) return false;
      }
    }
    return true;
  }

  describe(): string {
    return '使四个象限分别纯色（左上红、右上黄、左下蓝、右下绿）';
  }
}

/**
 * 拓扑注册表：后续新增 6x6 / 三角 / 六边 / 三维 时，
 * 只需在此注册新的 Topology 实现与对应默认 Goal。
 */
export interface TopologyRegistryEntry {
  topology: () => Topology;
  defaultGoal: () => Goal;
  defaultSolvedBoard: () => Board;
}

export const topologyRegistry = new Map<string, TopologyRegistryEntry>();

export function registerTopology(kind: string, entry: TopologyRegistryEntry): void {
  topologyRegistry.set(kind, entry);
}

export function getTopologyEntry(kind: string): TopologyRegistryEntry {
  const entry = topologyRegistry.get(kind);
  if (!entry) throw new Error(`Unknown topology: ${kind}`);
  return entry;
}

/** 注册当前已有的方形拓扑 */
import { square4x4, SQUARE_4X4_KIND, square6x6, SQUARE_6X6_KIND } from './topology';
import { createSolvedSquare4x4, createSolvedSquare6x6 } from './board';
registerTopology(SQUARE_4X4_KIND, {
  topology: square4x4,
  defaultGoal: () => new QuadrantUniformGoal(),
  defaultSolvedBoard: createSolvedSquare4x4,
});
registerTopology(SQUARE_6X6_KIND, {
  topology: square6x6,
  defaultGoal: () => new QuadrantUniformGoal(),
  defaultSolvedBoard: createSolvedSquare6x6,
});

/** 供外部使用的颜色集合 */
export { ALL_COLORS };

/**
 * v0.3.0：六边形三角形玩法的目标判定策略。
 *
 * 与 QuadrantUniformGoal 同理：regions() 返回 6 个扇区（大三角形），
 * HEX_COLORS 同序对应 6 种颜色。region[i] 必须全部为 HEX_COLORS[i]。
 * 等价于"操作地图与目标地图完全一致"。
 */
export const HEX_GOAL_KIND = 'hex-uniform';

export class HexUniformGoal implements Goal {
  readonly kind = HEX_GOAL_KIND;

  satisfied(board: Board, topology: Topology): boolean {
    const regions = topology.regions();
    if (regions.length !== HEX_COLORS.length) return false;
    for (let i = 0; i < regions.length; i++) {
      const expected = HEX_COLORS[i];
      for (const idx of regions[i].cells) {
        if (board.cells[idx]?.color !== expected) return false;
      }
    }
    return true;
  }

  describe(): string {
    return '使六个大三角形分别纯色（红、黄、绿、青、蓝、品红）';
  }
}

/** 注册六边形三角形拓扑 */
import {
  hexTriangle,
  HEX_TRIANGLE_KIND,
  createSolvedHexTriangle,
} from './hex-topology';
import { HEX_COLORS } from './types';
registerTopology(HEX_TRIANGLE_KIND, {
  topology: hexTriangle,
  defaultGoal: () => new HexUniformGoal(),
  defaultSolvedBoard: createSolvedHexTriangle,
});

/**
 * v0.3.2：六边形三角形简单版拓扑（N=2，24 三角形 / 7 旋钮）。
 * 复用 HexUniformGoal——6 扇区分别纯色且颜色匹配，与 N=3 版判定逻辑一致，
 * 只是 regions() 返回 4 三角形/扇区而非 9。
 */
import {
  hexSmallTriangle,
  HEX_SMALL_TRIANGLE_KIND,
  createSolvedHexSmallTriangle,
} from './hex-topology-small';
registerTopology(HEX_SMALL_TRIANGLE_KIND, {
  topology: hexSmallTriangle,
  defaultGoal: () => new HexUniformGoal(),
  defaultSolvedBoard: createSolvedHexSmallTriangle,
});
