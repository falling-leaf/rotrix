/**
 * 目标判定策略
 *
 * 基础玩法：每个目标区域内的 4 个色块颜色相同。
 * 后续扩展：相邻约束、图案匹配等可在此实现新 Goal。
 */

import type { Board, Goal, Topology } from './types';
import { ALL_COLORS } from './types';

export const QUADRANT_GOAL_KIND = 'quadrant-uniform';

/** 基础目标：每个目标区域内颜色统一（象限纯色） */
export class QuadrantUniformGoal implements Goal {
  readonly kind = QUADRANT_GOAL_KIND;

  satisfied(board: Board, topology: Topology): boolean {
    const regions = topology.regions();
    for (const region of regions) {
      const first = board.cells[region.cells[0]]?.color;
      if (!first) return false;
      for (const idx of region.cells) {
        if (board.cells[idx]?.color !== first) return false;
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

/** 注册当前已有的 4x4 方形拓扑 */
import { square4x4, SQUARE_4X4_KIND } from './topology';
import { createSolvedSquare4x4 } from './board';
registerTopology(SQUARE_4X4_KIND, {
  topology: square4x4,
  defaultGoal: () => new QuadrantUniformGoal(),
  defaultSolvedBoard: createSolvedSquare4x4,
});

/** 供外部使用的颜色集合 */
export { ALL_COLORS };
