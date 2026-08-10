/**
 * 关卡数据
 *
 * v0.2.1：扩展为 20 关——10 个 4x4 + 10 个 6x6，各从易到难。
 * v0.3.0：新增第 21 关——六边形三角形拓扑（54 三角形 / 19 旋钮）。
 * v0.3.1：扩展第 21-25 关——六边形三角形，打乱步数 40→55→70→85→100。
 * v0.3.2：新增第 26 关——六边形三角形简单版（N=2，24 三角形 / 7 旋钮）。
 * v0.3.3：简单/困难模式交换关卡数——21-25 关为简单版（hex-small-triangle，
 *          24 三角形 / 7 旋钮，scramble 10→15→20→25→30），26-30 关为困难版
 *          （hex-triangle，54 三角形 / 19 旋钮，scramble 40→55→70→85→100）。
 * 使用 v0.2.1 新增的 generatePuzzle 统一接口生成题目，
 * 无需在文件内重复访问 getTopologyEntry / generateLevel / SeededRNG。
 *
 * 关卡结构化定义，便于后续扩展到 50+ 关时只需补充数据。
 */

import type { Level, Board } from '../core/types';
import { generatePuzzle, generatePicturePuzzle } from '../core/generator';
import { QuadrantUniformGoal, HexUniformGoal, DiceQuadrantGoal, PictureGoal } from '../core/goals';
import { createSolvedPicture31, createSolvedPicture32, createSolvedPicture33, createSolvedPicture34, createSolvedPicture35, createSolvedPicture36, createSolvedPicture37, createSolvedPicture38, createSolvedPicture39, createSolvedPicture40 } from '../core/board';

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
  // 第 21-25 关：六边形三角形简单版（v0.3.3，N=2，24 三角形 / 7 旋钮）
  // 简单模式——地图更小、旋钮更少、打乱步数低，作为六边形玩法入门
  // v0.3.3：从原 26 关移至 21-25 关，scramble 10→15→20→25→30 从易到难
  { id: 21, topologyKind: 'hex-small-triangle', scramble: 10, seed: 301 },
  { id: 22, topologyKind: 'hex-small-triangle', scramble: 15, seed: 302 },
  { id: 23, topologyKind: 'hex-small-triangle', scramble: 20, seed: 303 },
  { id: 24, topologyKind: 'hex-small-triangle', scramble: 25, seed: 304 },
  { id: 25, topologyKind: 'hex-small-triangle', scramble: 30, seed: 305 },
  // 第 26-30 关：六边形三角形困难版（v0.3.3，N=3，54 三角形 / 19 旋钮）
  // 困难模式——地图更大、旋钮更多、打乱步数高
  // v0.3.3：从原 21-25 关移至 26-30 关，scramble 40→55→70→85→100
  { id: 26, topologyKind: 'hex-triangle', scramble: 40,  seed: 401 },
  { id: 27, topologyKind: 'hex-triangle', scramble: 55,  seed: 402 },
  { id: 28, topologyKind: 'hex-triangle', scramble: 70,  seed: 403 },
  { id: 29, topologyKind: 'hex-triangle', scramble: 85,  seed: 404 },
  { id: 30, topologyKind: 'hex-triangle', scramble: 100, seed: 405 },
  // 第 31-40 关：图案玩法（v0.4.2）
  // 目标地图为手工设计的像素图案，胜利判定改为拼成目标地图即可。
  // 每关图案布局不同（非仅换色），含可辨识图形（太阳/房子/心形等）。
  // 第 31 关：6x6 同心方框（5 色：品红/红/黄/蓝/绿），scramble=20 入门
  { id: 31, topologyKind: 'square-6x6-picture', scramble: 20, seed: 601 },
  // 第 32 关：6x6 螺旋回字（4 色：红/绿/黄/蓝），scramble=28
  { id: 32, topologyKind: 'square-6x6-picture', scramble: 28, seed: 602 },
  // 第 33 关：太阳（6 色，三层同心圆），scramble=25
  { id: 33, topologyKind: 'square-6x6-picture', scramble: 25, seed: 603 },
  // 第 34 关：房子（红顶黄墙蓝门窗），scramble=30
  { id: 34, topologyKind: 'square-6x6-picture', scramble: 30, seed: 604 },
  // 第 35 关：心形（红心蓝底），scramble=22
  { id: 35, topologyKind: 'square-6x6-picture', scramble: 22, seed: 605 },
  // 第 36 关：三色棋盘（R/Y/G 偏移），scramble=35
  { id: 36, topologyKind: 'square-6x6-picture', scramble: 35, seed: 606 },
  // 第 37 关：钻石（菱形同心层），scramble=26
  { id: 37, topologyKind: 'square-6x6-picture', scramble: 26, seed: 607 },
  // 第 38 关：箭头（右指），scramble=24
  { id: 38, topologyKind: 'square-6x6-picture', scramble: 24, seed: 608 },
  // 第 39 关：树（绿冠红干蓝天），scramble=27
  { id: 39, topologyKind: 'square-6x6-picture', scramble: 27, seed: 609 },
  // 第 40 关：笑脸（黄脸蓝眼红嘴），scramble=29
  { id: 40, topologyKind: 'square-6x6-picture', scramble: 29, seed: 610 },
  // 第 41-49 关：预留，后续版本填充
  // 第 50 关：骰子 4x4 玩法（v0.4.0 起设为第 31 关，v0.4.1 移至第 50 关）
  // 回到 4x4 正方形网格，每色块携带骰子点数 1-4，
  // 胜利需颜色+数字同时匹配目标。scramble=8 中等难度作为骰子玩法入门。
  // v0.4.1：第 50 关为独立挑战关，不参与前 30 关的"下一关/最后一关"线性流程。
  { id: 50, topologyKind: 'square-4x4-dice', scramble: 8, seed: 501 },
];

let _cache: Level[] | null = null;

export function getLevels(): Level[] {
  if (_cache) return _cache;

  // v0.4.2：图案关卡的目标棋盘映射表——id → 工厂函数
  const PICTURE_SOLVED: Record<number, () => Board> = {
    31: createSolvedPicture31,
    32: createSolvedPicture32,
    33: createSolvedPicture33,
    34: createSolvedPicture34,
    35: createSolvedPicture35,
    36: createSolvedPicture36,
    37: createSolvedPicture37,
    38: createSolvedPicture38,
    39: createSolvedPicture39,
    40: createSolvedPicture40,
  };

  const levels: Level[] = LEVEL_SPECS.map((spec) => {
    if (spec.topologyKind === 'square-6x6-picture') {
      // v0.4.2：图案关卡——用自定义目标棋盘生成题目，PictureGoal 逐格校验
      const solvedBoard = PICTURE_SOLVED[spec.id]!();
      const gen = generatePicturePuzzle('square-6x6', solvedBoard, spec.scramble, spec.seed);
      const goal = new PictureGoal(solvedBoard);
      return {
        id: spec.id,
        name: `第 ${spec.id} 关`,
        difficulty: gen.difficulty,
        topologyKind: spec.topologyKind,
        initial: gen.initial,
        goal,
        solution: gen.solution,
        solvedBoard, // 图案关卡携带目标棋盘供 App 预览
      };
    }
    // v0.2.1：一行调用，无需重复访问注册表/RNG
    const gen = generatePuzzle(spec.topologyKind, spec.scramble, spec.seed);
    // v0.3.0/v0.3.2/v0.4.0：根据拓扑类型选择对应 Goal
    // 两种六边形拓扑用 HexUniformGoal，骰子拓扑用 DiceQuadrantGoal
    const goal =
      spec.topologyKind === 'hex-triangle' ||
      spec.topologyKind === 'hex-small-triangle'
        ? new HexUniformGoal()
        : spec.topologyKind === 'square-4x4-dice'
          ? new DiceQuadrantGoal()
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
