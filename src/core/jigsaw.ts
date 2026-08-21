/**
 * v0.9.0：拼图模式数据模型。
 *
 * 拼图模式：一个图像由 9 个 6×6 网格拼图玩法构成（3×3 排列），
 * 每个玩法完成后对应图像的一个区域。9 个区域都完成后拼成完整图像。
 *
 * 当前阶段：所有 9 个小关卡以第 2 关为模板（6×6 正方形，scramble=8）。
 */

import type { Board, Level } from './types';
import { generatePuzzle } from './generator';
import { PictureGoal } from './goals';
import { createSolvedSquare6x6 } from './board';

/** 每个拼图区块的标识（0-11，行优先，4行×3列） */
export type JigsawTileId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

/** 单个拼图区块状态 */
export interface JigsawTileState {
  /** 区块 ID（0-8） */
  id: JigsawTileId;
  /** 当前棋盘（可修改） */
  board: Board;
  /** 目标棋盘 */
  solvedBoard: Board;
  /** 是否已完成 */
  completed: boolean;
  /** 步数 */
  moveCount: number;
  /** 关卡定义（用于 useGame） */
  level: Level;
}

/** 拼图模式整体状态 */
export interface JigsawState {
  /** 9 个区块 */
  tiles: JigsawTileState[];
  /** 当前选中的区块索引（0-8） */
  activeTile: number;
  /** 是否全部完成 */
  allCompleted: boolean;
}

/** 每个区块的独特种子，保证确定性的不同布局 */
const TILE_SEEDS: number[] = [901, 902, 903, 904, 905, 906, 907, 908, 909, 910, 911, 912];

/**
 * 生成一个拼图区块的关卡定义。
 * 使用 6×6 正方形拓扑，scramble=8，每块有独立种子保证不同布局。
 */
function createTileLevel(tileId: JigsawTileId, scramble: number = 8): Level {
  const seed = TILE_SEEDS[tileId];
  // 使用标准 6×6 四象限纯色目标棋盘
  const solvedBoard = createSolvedSquare6x6();
  const gen = generatePuzzle('square-6x6', scramble, seed);
  const goal = new PictureGoal(solvedBoard);
  return {
    id: 100 + tileId, // 拼图区块 ID 从 100 开始，不与主关卡冲突
    name: `拼图块 ${tileId + 1}`,
    difficulty: gen.difficulty,
    topologyKind: 'square-6x6',
    initial: gen.initial,
    goal,
    solution: gen.solution,
    solvedBoard,
    scramble,
  };
}

/**
 * 初始化拼图模式状态。
 * 9 个区块全部使用 6×6 正方形拓扑，scramble=8，各有独立种子。
 */
export function createJigsawState(scramble: number = 8): JigsawState {
  const tiles: JigsawTileState[] = [];
  for (let i = 0; i < 12; i++) {
    const id = i as JigsawTileId;
    const level = createTileLevel(id, scramble);
    tiles.push({
      id,
      board: {
        dims: [...level.initial.dims],
        cells: level.initial.cells.map((c) => ({ ...c })),
      },
      solvedBoard: level.solvedBoard!,
      completed: false,
      moveCount: 0,
      level,
    });
  }
  return {
    tiles,
    activeTile: 0,
    allCompleted: false,
  };
}

/**
 * 获取拼图区块在 3×3 网格中的行列位置（用于渲染）。
 */
export function getTilePosition(tileId: JigsawTileId): { row: number; col: number } {
  return {
    row: Math.floor(tileId / 3),
    col: tileId % 3,
  };
}

/** localStorage key */
const LS_KEY = 'rotrix:jigsaw:state';

/** 将 JigsawState 保存到 localStorage（仅保存可序列化的字段） */
export function saveJigsawState(state: JigsawState): void {
  const data = {
    tiles: state.tiles.map((t) => ({
      id: t.id,
      board: { dims: t.board.dims, cells: t.board.cells.map((c) => ({ color: c.color })) },
      completed: t.completed,
      moveCount: t.moveCount,
    })),
    allCompleted: state.allCompleted,
  };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {
    // localStorage 不可用时静默
  }
}

/** 从 localStorage 恢复 JigsawState */
export function loadJigsawState(): JigsawState | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.tiles || !Array.isArray(data.tiles)) return null;
    // 用 createJigsawState 重建完整结构（含 Level、goal 等非序列化字段）
    const state = createJigsawState(8);
    for (const saved of data.tiles) {
      if (saved.id >= 0 && saved.id < state.tiles.length) {
        const tile = state.tiles[saved.id];
        tile.board = saved.board;
        tile.completed = saved.completed;
        tile.moveCount = saved.moveCount;
      }
    }
    state.allCompleted = !!data.allCompleted;
    return state;
  } catch {
    return null;
  }
}

/** 清除 localStorage 中的拼图模式存档 */
export function clearJigsawState(): void {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    // ignore
  }
}