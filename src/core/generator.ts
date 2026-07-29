/**
 * 关卡生成器
 *
 * 算法：从目标棋盘出发，执行 N 次随机旋转得到题目。
 * 这样生成的题目天然可解（逆序执行即可还原）。
 *
 * 难度量化：
 * 1. 用"有效旋转步数"作为基础难度——去除了立即回退（连续对同一旋钮
 *    正反旋转抵消）和导致恒等状态的旋转。
 * 2. 进一步用"色块错位率"作为辅助度量：与目标相比有多少色块不在
 *    目标位置，归一化到 [0,1]。
 *
 * 后续可替换随机旋转策略为更智能的扰动机（如 BFS 保证最短解 = 指定步数）。
 */

import type { Board, GeneratedLevel, Knob, Move, Topology } from './types';
import { applyMove, cloneBoard, defaultRNG, type RNG } from './board';
import { boardsEqual } from './board';
// v0.2.1：generatePuzzle 统一接口所需的注册表与 RNG
import { getTopologyEntry } from './goals';
import { SeededRNG } from './rng';

export interface GenerateOptions {
  /** 目标棋盘（生成起点） */
  solved: Board;
  topology: Topology;
  /** 期望的旋转次数（越大越难） */
  scrambleCount: number;
  /** RNG，测试可注入 */
  rng?: RNG;
  /** 最大重试次数（避免极小概率生成与目标相同） */
  maxAttempts?: number;
}

/**
 * 执行一次生成。
 * 返回题目棋盘 + 使用的（有效）旋转序列 + 难度。
 */
export function generateLevel(opts: GenerateOptions): GeneratedLevel {
  const { solved, topology, scrambleCount } = opts;
  const rng = opts.rng ?? defaultRNG();
  const maxAttempts = opts.maxAttempts ?? 50;
  const knobs = topology.knobs();

  let best: GeneratedLevel | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let board = cloneBoard(solved);
    const moves: Move[] = [];
    let lastKnobId: string | null = null;
    let lastDir: 'CW' | 'CCW' | null = null;

    for (let step = 0; step < scrambleCount; step++) {
      // 随机选择旋钮，避免与上一步相同旋钮 + 相反方向（立即回退）
      let knob: Knob;
      let dir: 'CW' | 'CCW';
      let guard = 0;
      do {
        knob = knobs[rng.int(knobs.length)];
        const dirs = knob.directions ?? ['CW'];
        dir = dirs[rng.int(dirs.length)] ?? 'CW';
        guard++;
      } while (
        lastKnobId === knob.id &&
        lastDir &&
        lastDir !== dir &&
        guard < 10
      );

      // 跳过导致立即回到旋转前状态的旋转（仅 CW 一步即可逆为 CCW，
      // 但当前旋钮只有 CW，故 CW*4 = 恒等。此处简单跳过 4 次连续同旋钮）
      board = applyMove(board, knob, dir);
      moves.push({ knobId: knob.id, direction: dir });
      lastKnobId = knob.id;
      lastDir = dir;
    }

    // 检查是否与目标相同（难度太低，重试）
    if (boardsEqual(board, solved)) {
      continue;
    }

    // 计算有效步数：去除"同一旋钮连续 CW 满三次"等恒等
    const effective = effectiveMoves(moves);
    const difficulty = effective.length;

    const candidate: GeneratedLevel = {
      initial: board,
      solution: moves,
      difficulty,
    };

    if (!best || candidate.difficulty > best.difficulty) {
      best = candidate;
    }
    if (best && best.difficulty >= Math.floor(scrambleCount * 0.6)) {
      break; // 已足够打乱
    }
  }

  if (!best) {
    // 兜底：返回最后一次结果
    let board = cloneBoard(solved);
    const moves: Move[] = [];
    const knobs2 = topology.knobs();
    for (let step = 0; step < scrambleCount; step++) {
      const knob = knobs2[rng.int(knobs2.length)];
      board = applyMove(board, knob, 'CW');
      moves.push({ knobId: knob.id, direction: 'CW' });
    }
    best = { initial: board, solution: moves, difficulty: effectiveMoves(moves).length };
  }

  return best;
}

/**
 * 有效移动数：压缩连续对同一旋钮的操作。
 * 由于当前每个旋钮只支持 CW，连续 4 次 CW = 恒等。
 * 我们把连续同旋钮的次数对 4 取模作为有效步数。
 */
function effectiveMoves(moves: Move[]): Move[] {
  const result: Move[] = [];
  for (const m of moves) {
    const last = result[result.length - 1];
    if (last && last.knobId === m.knobId && last.direction === m.direction) {
      // 合并：连续同向同旋钮
      // 用计数标记（这里简化为保留一条，计数通过 length 差异体现）
      // 实际：CW 4 次 = 0，所以我们直接在末尾累计
      // 为简单起见，直接 push，后续对同旋钮 group 计数
      result.push(m);
    } else {
      result.push(m);
    }
  }
  // 按连续同旋钮同方向分组，每组对 4 取模
  const compressed: Move[] = [];
  let i = 0;
  while (i < result.length) {
    let j = i;
    while (
      j < result.length &&
      result[j].knobId === result[i].knobId &&
      result[j].direction === result[i].direction
    ) {
      j++;
    }
    const count = j - i;
    const mod = count % 4;
    for (let k = 0; k < mod; k++) {
      compressed.push(result[i]);
    }
    i = j;
  }
  return compressed;
}

/**
 * 辅助难度度量：色块错位率
 * 与目标棋盘相比，有多少比例的色块颜色不同。
 */
export function displacementRate(board: Board, solved: Board): number {
  if (board.cells.length !== solved.cells.length) return 1;
  let diff = 0;
  for (let i = 0; i < board.cells.length; i++) {
    if (board.cells[i].color !== solved.cells[i].color) diff++;
  }
  return diff / board.cells.length;
}
/**
 * 生成一批由易到难的关卡。
 * @param solved 目标棋盘
 * @param topology 拓扑
 * @param count 关卡数
 * @param baseScramble 基础打乱次数
 * @param step 每关增加的打乱次数
 * @param rng 可选 RNG
 */
export function generateDifficultyCurve(
  solved: Board,
  topology: Topology,
  count: number,
  baseScramble: number = 3,
  step: number = 3,
  rng?: RNG,
): GeneratedLevel[] {
  const levels: GeneratedLevel[] = [];
  for (let i = 0; i < count; i++) {
    const scramble = baseScramble + i * step;
    levels.push(
      generateLevel({ solved, topology, scrambleCount: scramble, rng }),
    );
  }
  return levels;
}

/**
 * v0.2.1：题目生成统一接口。
 *
 * 输入拓扑类型 + 打乱步数 + 种子，输出一个完整的 GeneratedLevel
 * （含题目棋盘、旋转序列、难度）。内部从注册表自动获取 topology /
 * solved，调用方无需重复访问 getTopologyEntry / generateLevel / SeededRNG。
 *
 * @param topologyKind 拓扑类型（如 'square-4x4'）
 * @param scramble 打乱步数
 * @param seed 种子（保证确定性）
 */
export function generatePuzzle(
  topologyKind: string,
  scramble: number,
  seed: number,
): GeneratedLevel {
  const entry = getTopologyEntry(topologyKind);
  const topology = entry.topology();
  const solved = entry.defaultSolvedBoard();
  const rng = new SeededRNG(seed);
  return generateLevel({ solved, topology, scrambleCount: scramble, rng });
}

/**
 * v0.2.3：无尽模式题目生成。
 *
 * 与 generatePuzzle 不同，使用 defaultRNG()（Math.random）而非确定性种子，
 * 每次调用产生不同的题目。拓扑与打乱步数固定（4x4: 30 步 / 6x6: 60 步），
 * 保证难度一致而布局各异。
 *
 * @param topologyKind 拓扑类型（'square-4x4' 或 'square-6x6'）
 * @param scramble 打乱步数
 */
export function generateRandomPuzzle(
  topologyKind: string,
  scramble: number,
): GeneratedLevel {
  const entry = getTopologyEntry(topologyKind);
  const topology = entry.topology();
  const solved = entry.defaultSolvedBoard();
  const rng = defaultRNG();
  return generateLevel({ solved, topology, scrambleCount: scramble, rng });
}
