/**
 * 关卡数据
 *
 * 5 个由易到难的关卡。使用确定性种子生成，保证关卡内容固定。
 * 难度梯度：scramble 次数递增，有效旋转步数（difficulty）随之上升。
 *
 * 关卡结构化定义，便于后续扩展到 50 关时只需补充数据。
 */

import type { GeneratedLevel, Level } from '../core/types';
import { createSolvedSquare4x4 } from '../core/board';
import { square4x4 } from '../core/topology';
import { QuadrantUniformGoal } from '../core/goals';
import { generateLevel } from '../core/generator';
import { SeededRNG } from '../core/rng';

interface LevelSpec {
  id: number;
  name: string;
  scramble: number;
  seed: number;
}

const LEVEL_SPECS: LevelSpec[] = [
  { id: 1, name: '初探旋钮', scramble: 3, seed: 101 },
  { id: 2, name: '渐入佳境', scramble: 6, seed: 202 },
  { id: 3, name: '错综复杂', scramble: 9, seed: 303 },
  { id: 4, name: '混沌迷局', scramble: 12, seed: 404 },
  { id: 5, name: '终极挑战', scramble: 18, seed: 505 },
];

let _cache: Level[] | null = null;

export function getLevels(): Level[] {
  if (_cache) return _cache;

  const solved = createSolvedSquare4x4();
  const topo = square4x4();
  const goal = new QuadrantUniformGoal();

  const levels: Level[] = LEVEL_SPECS.map((spec) => {
    const rng = new SeededRNG(spec.seed);
    const gen: GeneratedLevel = generateLevel({
      solved,
      topology: topo,
      scrambleCount: spec.scramble,
      rng,
    });
    return {
      id: spec.id,
      name: spec.name,
      difficulty: gen.difficulty,
      topologyKind: topo.kind,
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
