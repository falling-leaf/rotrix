/**
 * 关卡数据
 *
 * 5 个由易到难的关卡。使用确定性种子生成，保证关卡内容固定。
 * 难度梯度：scramble 次数递增，有效旋转步数（difficulty）随之上升。
 *
 * 关卡结构化定义，便于后续扩展到 50 关时只需补充数据。
 */

import type { GeneratedLevel, Level } from '../core/types';
import { getTopologyEntry } from '../core/goals';
import { generateLevel } from '../core/generator';
import { SeededRNG } from '../core/rng';

interface LevelSpec {
  id: number;
  name: string;
  /** 拓扑类型，从注册表获取 */
  topologyKind: string;
  scramble: number;
  seed: number;
}

const LEVEL_SPECS: LevelSpec[] = [
  // 第 1-5 关：4x4 网格
  { id: 1, name: '初探旋钮', topologyKind: 'square-4x4', scramble: 3, seed: 101 },
  { id: 2, name: '渐入佳境', topologyKind: 'square-4x4', scramble: 6, seed: 202 },
  { id: 3, name: '错综复杂', topologyKind: 'square-4x4', scramble: 9, seed: 303 },
  { id: 4, name: '混沌迷局', topologyKind: 'square-4x4', scramble: 12, seed: 404 },
  { id: 5, name: '终极挑战', topologyKind: 'square-4x4', scramble: 18, seed: 505 },
  // 第 6-10 关：6x6 网格（新玩法）
  { id: 6, name: '六六初探', topologyKind: 'square-6x6', scramble: 5, seed: 606 },
  { id: 7, name: '矩阵迷踪', topologyKind: 'square-6x6', scramble: 10, seed: 707 },
  { id: 8, name: '星罗棋布', topologyKind: 'square-6x6', scramble: 15, seed: 808 },
  { id: 9, name: '万象旋转', topologyKind: 'square-6x6', scramble: 22, seed: 909 },
  { id: 10, name: '六维终极', topologyKind: 'square-6x6', scramble: 30, seed: 1001 },
];

let _cache: Level[] | null = null;

export function getLevels(): Level[] {
  if (_cache) return _cache;

  const levels: Level[] = LEVEL_SPECS.map((spec) => {
    const entry = getTopologyEntry(spec.topologyKind);
    const topology = entry.topology();
    const solved = entry.defaultSolvedBoard();
    const goal = entry.defaultGoal();
    const rng = new SeededRNG(spec.seed);
    const gen: GeneratedLevel = generateLevel({
      solved,
      topology,
      scrambleCount: spec.scramble,
      rng,
    });
    return {
      id: spec.id,
      name: spec.name,
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
