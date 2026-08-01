/**
 * 关卡数据
 *
 * v0.2.1：扩展为 20 关——10 个 4x4 + 10 个 6x6，各从易到难。
 * v0.3.0：新增第 21 关——六边形三角形拓扑（54 三角形 / 19 旋钮）。
 * v0.3.1：扩展第 21-25 关——六边形三角形，打乱步数 40→55→70→85→100。
 * v0.3.2：新增第 26 关——六边形三角形简单版（N=2，24 三角形 / 7 旋钮）。
 * 使用 v0.2.1 新增的 generatePuzzle 统一接口生成题目，
 * 无需在文件内重复访问 getTopologyEntry / generateLevel / SeededRNG。
 *
 * 关卡结构化定义，便于后续扩展到 50+ 关时只需补充数据。
 */

import type { GeneratedLevel, Level } from '../core/types';
import { generatePuzzle } from '../core/generator';
import { QuadrantUniformGoal, HexUniformGoal } from '../core/goals';

interface LevelSpec {
  id: number;
  /** 拓扑类型，从注册表获取 */
  topologyKind: string;
  scramble: number;
  seed: number;
}

const LEVEL_SPECS: LevelSpec[] = [
  // 第 1-10 关：4x4 网格（打乱步数递增）
  { id: 1,  topologyKind: 'square-4x4', scramble: 3,  seed: 101 },
  { id: 2,  topologyKind: 'square-4x4', scramble: 5,  seed: 102 },
  { id: 3,  topologyKind: 'square-4x4', scramble: 7,  seed: 103 },
  { id: 4,  topologyKind: 'square-4x4', scramble: 9,  seed: 104 },
  { id: 5,  topologyKind: 'square-4x4', scramble: 12, seed: 105 },
  { id: 6,  topologyKind: 'square-4x4', scramble: 15, seed: 106 },
  { id: 7,  topologyKind: 'square-4x4', scramble: 18, seed: 107 },
  { id: 8,  topologyKind: 'square-4x4', scramble: 22, seed: 108 },
  { id: 9,  topologyKind: 'square-4x4', scramble: 26, seed: 109 },
  { id: 10, topologyKind: 'square-4x4', scramble: 30, seed: 110 },
  // 第 11-20 关：6x6 网格
  { id: 11, topologyKind: 'square-6x6', scramble: 5,  seed: 201 },
  { id: 12, topologyKind: 'square-6x6', scramble: 8,  seed: 202 },
  { id: 13, topologyKind: 'square-6x6', scramble: 12, seed: 203 },
  { id: 14, topologyKind: 'square-6x6', scramble: 16, seed: 204 },
  { id: 15, topologyKind: 'square-6x6', scramble: 20, seed: 205 },
  { id: 16, topologyKind: 'square-6x6', scramble: 25, seed: 206 },
  { id: 17, topologyKind: 'square-6x6', scramble: 30, seed: 207 },
  { id: 18, topologyKind: 'square-6x6', scramble: 36, seed: 208 },
  { id: 19, topologyKind: 'square-6x6', scramble: 42, seed: 209 },
  { id: 20, topologyKind: 'square-6x6', scramble: 50, seed: 210 },
  // 第 21-25 关：六边形三角形（v0.3.0 新玩法）
  // v0.3.1：扩展 21-25 关，打乱步数递增，拓扑与第 21 关相同
  { id: 21, topologyKind: 'hex-triangle', scramble: 40,  seed: 301 },
  { id: 22, topologyKind: 'hex-triangle', scramble: 55,  seed: 302 },
  { id: 23, topologyKind: 'hex-triangle', scramble: 70,  seed: 303 },
  { id: 24, topologyKind: 'hex-triangle', scramble: 85,  seed: 304 },
  { id: 25, topologyKind: 'hex-triangle', scramble: 100, seed: 305 },
  // 第 26 关：六边形三角形简单版（v0.3.2 新拓扑，N=2，24 三角形 / 7 旋钮）
  // 作为六边形玩法的入门关，地图更小，打乱步数低
  { id: 26, topologyKind: 'hex-small-triangle', scramble: 20, seed: 401 },
];

let _cache: Level[] | null = null;

export function getLevels(): Level[] {
  if (_cache) return _cache;

  const levels: Level[] = LEVEL_SPECS.map((spec) => {
    // v0.2.1：一行调用，无需重复访问注册表/RNG
    const gen: GeneratedLevel = generatePuzzle(
      spec.topologyKind,
      spec.scramble,
      spec.seed,
    );
    // v0.3.0/v0.3.2：根据拓扑类型选择对应 Goal
    // 两种六边形拓扑（hex-triangle / hex-small-triangle）均使用 HexUniformGoal
    const goal =
      spec.topologyKind === 'hex-triangle' ||
      spec.topologyKind === 'hex-small-triangle'
        ? new HexUniformGoal()
        : new QuadrantUniformGoal();
    return {
      id: spec.id,
      name: `第 ${spec.id} 关`, // v0.2.1：不再单独取名
      difficulty: gen.difficulty,
      topologyKind: spec.topologyKind,
      initial: gen.initial,
      goal,
      solution: gen.solution,
    };
  });

  _cache = levels;
  return levels;
}

/** 获取指定关卡 */
export function getLevel(id: number): Level | undefined {
  return getLevels().find((l) => l.id === id);
}
