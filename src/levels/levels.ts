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
 * v0.7.1：关卡顺序调整——26-30 关改为 6x6 图案（精选 5 个），31-35 关改为 8x8 图案（精选 5 个），
  * 16-25 关保留原 6x6 图案待 0.7.2 更新新玩法。
 */

import type { Level, Board } from '../core/types';
import { generatePuzzle, generatePicturePuzzle } from '../core/generator';
import { QuadrantUniformGoal, HexUniformGoal, DiceQuadrantGoal, PictureGoal } from '../core/goals';
import { createSolvedPicture31, createSolvedPicture32, createSolvedPicture33, createSolvedPicture34, createSolvedPicture35, createSolvedPicture36, createSolvedPicture37, createSolvedPicture38, createSolvedPicture39, createSolvedPicture40, createSolvedPicture41, createSolvedPicture42, createSolvedPicture43, createSolvedPicture44, createSolvedPicture45, createSolvedPicture46, createSolvedPicture47, createSolvedPicture48, createSolvedPicture49, createSolvedPicture50, createSolvedHexPicture46, createSolvedHexPicture47, createSolvedHexPicture48, createSolvedHexPicture49, createSolvedHexPicture50 } from '../core/board';

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
  // 第 11-15 关：6x6 网格
  { id: 11, topologyKind: 'square-6x6', scramble: 5,  seed: 201 },
  { id: 12, topologyKind: 'square-6x6', scramble: 8,  seed: 202 },
  { id: 13, topologyKind: 'square-6x6', scramble: 12, seed: 203 },
  { id: 14, topologyKind: 'square-6x6', scramble: 16, seed: 204 },
  { id: 15, topologyKind: 'square-6x6', scramble: 20, seed: 205 },
  // 第 16-25 关：6x6 图案玩法（v0.7.1：原 31-40 关移至此处）
  // 目标地图为手工设计的 6x6 像素图案，胜利判定为拼成目标地图即可。
  // 每关图案布局不同（含可辨识图形：同心方框/螺旋回字/太阳/房子/心形/三色棋盘/钻石/箭头/树/笑脸）。
  { id: 16, topologyKind: 'square-6x6-picture', scramble: 20, seed: 601 },
  { id: 17, topologyKind: 'square-6x6-picture', scramble: 28, seed: 602 },
  { id: 18, topologyKind: 'square-6x6-picture', scramble: 25, seed: 603 },
  { id: 19, topologyKind: 'square-6x6-picture', scramble: 30, seed: 604 },
  { id: 20, topologyKind: 'square-6x6-picture', scramble: 22, seed: 605 },
  { id: 21, topologyKind: 'square-6x6-picture', scramble: 35, seed: 606 },
  { id: 22, topologyKind: 'square-6x6-picture', scramble: 26, seed: 607 },
  { id: 23, topologyKind: 'square-6x6-picture', scramble: 24, seed: 608 },
  { id: 24, topologyKind: 'square-6x6-picture', scramble: 27, seed: 609 },
  { id: 25, topologyKind: 'square-6x6-picture', scramble: 29, seed: 610 },
  // 第 26-30 关：6x6 图案玩法（v0.7.1：精选 5 个图案，0.7.2 改为新玩法）
    // 目标地图为手工设计的 6x6 像素图案
    { id: 26, topologyKind: 'square-6x6-picture', scramble: 20, seed: 601 },
    { id: 27, topologyKind: 'square-6x6-picture', scramble: 30, seed: 604 },
    { id: 28, topologyKind: 'square-6x6-picture', scramble: 22, seed: 605 },
    { id: 29, topologyKind: 'square-6x6-picture', scramble: 27, seed: 609 },
    { id: 30, topologyKind: 'square-6x6-picture', scramble: 29, seed: 610 },
    // 第 31-35 关：8x8 图案玩法（v0.7.1：精选 5 个图案，0.7.2 改为新玩法）
    // 正方形网格扩展至 8x8，49 个 2x2 旋钮
    { id: 31, topologyKind: 'square-8x8-picture', scramble: 20, seed: 701 },
    { id: 32, topologyKind: 'square-8x8-picture', scramble: 26, seed: 702 },
    { id: 33, topologyKind: 'square-8x8-picture', scramble: 35, seed: 707 },
    { id: 34, topologyKind: 'square-8x8-picture', scramble: 30, seed: 708 },
    { id: 35, topologyKind: 'square-8x8-picture', scramble: 32, seed: 710 },
  // 第 36-40 关：六边形三角形简单版（v0.7.1：原 21-25 关移至此处）
  // 简单模式——地图更小、旋钮更少、打乱步数低，作为六边形玩法入门
  { id: 36, topologyKind: 'hex-small-triangle', scramble: 10, seed: 301 },
  { id: 37, topologyKind: 'hex-small-triangle', scramble: 15, seed: 302 },
  { id: 38, topologyKind: 'hex-small-triangle', scramble: 20, seed: 303 },
  { id: 39, topologyKind: 'hex-small-triangle', scramble: 25, seed: 304 },
  { id: 40, topologyKind: 'hex-small-triangle', scramble: 30, seed: 305 },
  // 第 41-45 关：六边形三角形困难版（v0.7.1：原 26-30 关移至此处）
  // 困难模式——地图更大、旋钮更多、打乱步数高
  { id: 41, topologyKind: 'hex-triangle', scramble: 40,  seed: 401 },
  { id: 42, topologyKind: 'hex-triangle', scramble: 55,  seed: 402 },
  { id: 43, topologyKind: 'hex-triangle', scramble: 70,  seed: 403 },
  { id: 44, topologyKind: 'hex-triangle', scramble: 85,  seed: 404 },
  { id: 45, topologyKind: 'hex-triangle', scramble: 100, seed: 405 },
  // 第 46-50 关：六边形三角形简单版图案玩法（v0.7.1：替换原 8x8 占位符）
    // 使用 hex-small-triangle 拓扑（24 三角形 / 7 旋钮），每个图案为手工设计的像素图案
    { id: 46, topologyKind: 'hex-small-triangle-picture', scramble: 18, seed: 801 },
    { id: 47, topologyKind: 'hex-small-triangle-picture', scramble: 22, seed: 802 },
    { id: 48, topologyKind: 'hex-small-triangle-picture', scramble: 20, seed: 803 },
    { id: 49, topologyKind: 'hex-small-triangle-picture', scramble: 25, seed: 804 },
    { id: 50, topologyKind: 'hex-small-triangle-picture', scramble: 28, seed: 805 },
  // 第 51 关：骰子 4x4 玩法（v0.4.0 起设为第 31 关，v0.4.1 移至第 50 关，v0.6.3 移至第 51 关）
  // 回到 4x4 正方形网格，每色块携带骰子点数 1-4，
  // 胜利需颜色+数字同时匹配目标。scramble=8 中等难度作为骰子玩法入门。
  // v0.4.1：第 51 关为独立挑战关，不参与前 50 关的"下一关/最后一关"线性流程。
  { id: 51, topologyKind: 'square-4x4-dice', scramble: 8, seed: 501 },
  // 第 0 关：新手教程（v0.4.5）——4x4 仅两次旋转即可通关，
  // 配合 TutorialGuide 组件逐步引导玩家学习旋转操作。
  { id: 0,  topologyKind: 'square-4x4', scramble: 2, seed: 1 },
];

let _cache: Level[] | null = null;

export function getLevels(): Level[] {
  if (_cache) return _cache;

  // v0.7.1：图案关卡 ID 映射——按新 ID 映射到对应的图案工厂函数
  const PICTURE_SOLVED: Record<number, () => Board> = {
    // 第 16-25 关：6x6 图案（原 31-40 关）
    16: createSolvedPicture31,
    17: createSolvedPicture32,
    18: createSolvedPicture33,
    19: createSolvedPicture34,
    20: createSolvedPicture35,
    21: createSolvedPicture36,
    22: createSolvedPicture37,
    23: createSolvedPicture38,
    24: createSolvedPicture39,
    25: createSolvedPicture40,
    // 第 26-30 关：6x6 图案（精选，对应原第 16/19/20/24/25 关）
        26: createSolvedPicture31,
        27: createSolvedPicture34,
        28: createSolvedPicture35,
        29: createSolvedPicture39,
        30: createSolvedPicture40,
        // 第 31-35 关：8x8 图案（精选，对应原第 26/27/32/33/35 关）
        31: createSolvedPicture41,
        32: createSolvedPicture42,
        33: createSolvedPicture47,
        34: createSolvedPicture48,
        35: createSolvedPicture50,
    // 第 46-50 关：六边形三角形简单版图案
        46: createSolvedHexPicture46,
        47: createSolvedHexPicture47,
        48: createSolvedHexPicture48,
        49: createSolvedHexPicture49,
        50: createSolvedHexPicture50,
  };

  const levels: Level[] = LEVEL_SPECS.map((spec) => {
    if (spec.topologyKind === 'square-6x6-picture') {
      // v0.4.2：图案关卡（6x6）——用自定义目标棋盘生成题目，PictureGoal 逐格校验
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
    if (spec.topologyKind === 'square-8x8-picture') {
      // v0.6.3：图案关卡（8x8）——复用 8x8 拓扑，49 个 2x2 旋钮
      const solvedBoard = PICTURE_SOLVED[spec.id]!();
      const gen = generatePicturePuzzle('square-8x8', solvedBoard, spec.scramble, spec.seed);
      const goal = new PictureGoal(solvedBoard);
      return {
        id: spec.id,
        name: `第 ${spec.id} 关`,
        difficulty: gen.difficulty,
        topologyKind: spec.topologyKind,
        initial: gen.initial,
        goal,
        solution: gen.solution,
        solvedBoard,
              };
            }
            if (spec.topologyKind === 'hex-small-triangle-picture') {
              // v0.7.1：图案关卡（六边形三角形简单版）——复用 hex-small-triangle 拓扑，24 三角形 / 7 旋钮
              const solvedBoard = PICTURE_SOLVED[spec.id]!();
              const gen = generatePicturePuzzle('hex-small-triangle', solvedBoard, spec.scramble, spec.seed);
              const goal = new PictureGoal(solvedBoard);
              return {
                id: spec.id,
                name: `第 ${spec.id} 关`,
                difficulty: gen.difficulty,
                topologyKind: spec.topologyKind,
                initial: gen.initial,
                goal,
                solution: gen.solution,
                solvedBoard,
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