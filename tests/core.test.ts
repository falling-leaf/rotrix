/**
 * 冒烟测试 - 核心逻辑层
 *
 * 覆盖：棋盘创建、旋转操作、拓扑结构、目标判定、关卡生成。
 * 这些是纯函数测试，快速且确定性。
 */
import { describe, it, expect } from 'vitest';
import {
  createSolvedSquare4x4,
  createSolvedSquare6x6,
  createSolvedDice4x4,
  applyMove,
  applyMoves,
  cloneBoard,
  boardsEqual,
  rotateCellsCW,
  rotateCellsCCW,
  swapCells,
} from '../src/core/board';
import { square4x4, square6x6 } from '../src/core/topology';
import { hexTriangle, createSolvedHexTriangle } from '../src/core/hex-topology';
import { hexSmallTriangle, createSolvedHexSmallTriangle } from '../src/core/hex-topology-small';
import { QuadrantUniformGoal, HexUniformGoal, DiceQuadrantGoal } from '../src/core/goals';
import { generateLevel, generateDifficultyCurve, generateRandomPuzzle, generatePuzzle, displacementRate } from '../src/core/generator';
import { SeededRNG } from '../src/core/rng';
import { getLevels } from '../src/levels/levels';
import type { Cell } from '../src/core/types';

describe('Board - 基础棋盘操作', () => {
  it('createSolvedSquare4x4 创建 4x4 棋盘，4 象限纯色', () => {
    const board = createSolvedSquare4x4();
    expect(board.dims).toEqual([4, 4]);
    expect(board.cells).toHaveLength(16);

    // 左上 (0-1, 4-5) 全红
    const tl = [0, 1, 4, 5];
    const tr = [2, 3, 6, 7];
    const bl = [8, 9, 12, 13];
    const br = [10, 11, 14, 15];

    tl.forEach((i) => expect(board.cells[i].color).toBe('red'));
    tr.forEach((i) => expect(board.cells[i].color).toBe('yellow'));
    bl.forEach((i) => expect(board.cells[i].color).toBe('blue'));
    br.forEach((i) => expect(board.cells[i].color).toBe('green'));
  });

  it('cloneBoard 深拷贝不共享引用', () => {
    const board = createSolvedSquare4x4();
    const clone = cloneBoard(board);
    expect(clone).not.toBe(board);
    expect(clone.cells).not.toBe(board.cells);
    expect(boardsEqual(clone, board)).toBe(true);
  });

  it('boardsEqual 正确比较', () => {
    const a = createSolvedSquare4x4();
    const b = createSolvedSquare4x4();
    expect(boardsEqual(a, b)).toBe(true);
    b.cells[0].color = 'blue';
    expect(boardsEqual(a, b)).toBe(false);
  });

  it('rotateCellsCW 顺时针旋转 4 块', () => {
    // [A, B, C, D] -> [D, A, B, C]
    const cells: Cell[] = [
      { color: 'red' },
      { color: 'yellow' },
      { color: 'blue' },
      { color: 'green' },
    ];
    const rotated = rotateCellsCW(cells);
    expect(rotated.map((c) => c.color)).toEqual(['green', 'red', 'yellow', 'blue']);
  });

  it('rotateCellsCCW 逆时针旋转 4 块', () => {
    // [A, B, C, D] -> [B, C, D, A]
    const cells: Cell[] = [
      { color: 'red' },
      { color: 'yellow' },
      { color: 'blue' },
      { color: 'green' },
    ];
    const rotated = rotateCellsCCW(cells);
    expect(rotated.map((c) => c.color)).toEqual(['yellow', 'blue', 'green', 'red']);
  });

  it('CW 旋转 4 次回到初始状态', () => {
    const cells: Cell[] = [
      { color: 'red' },
      { color: 'yellow' },
      { color: 'blue' },
      { color: 'green' },
    ];
    let cur = cells;
    cur = rotateCellsCW(cur);
    cur = rotateCellsCW(cur);
    cur = rotateCellsCW(cur);
    cur = rotateCellsCW(cur);
    expect(cur.map((c) => c.color)).toEqual(['red', 'yellow', 'blue', 'green']);
  });
});

describe('Topology - 4x4 拓扑', () => {
  it('square4x4 有 9 个旋钮', () => {
    const topo = square4x4();
    const knobs = topo.knobs();
    expect(knobs).toHaveLength(9);
  });

  it('每个旋钮覆盖 4 个色块', () => {
    const topo = square4x4();
    for (const knob of topo.knobs()) {
      expect(knob.cells).toHaveLength(4);
    }
  });

  it('有 4 个目标区域', () => {
    const topo = square4x4();
    expect(topo.regions()).toHaveLength(4);
  });

  it('目标区域覆盖全部 16 格', () => {
    const topo = square4x4();
    const all = topo.regions().flatMap((r) => r.cells);
    expect(all).toHaveLength(16);
    const unique = new Set(all);
    expect(unique.size).toBe(16);
  });

  it('旋钮 K00 覆盖 [0,1,5,4]（左上2x2，顺时针）', () => {
    const topo = square4x4();
    const k00 = topo.knobs().find((k) => k.id === 'K00');
    expect(k00).toBeDefined();
    expect(k00!.cells).toEqual([0, 1, 5, 4]);
  });
});

describe('Goal - 目标判定', () => {
  it('已解决棋盘判定为胜利', () => {
    const board = createSolvedSquare4x4();
    const topo = square4x4();
    const goal = new QuadrantUniformGoal();
    expect(goal.satisfied(board, topo)).toBe(true);
  });

  it('打乱后的棋盘不满足胜利', () => {
    const board = createSolvedSquare4x4();
    const topo = square4x4();
    const goal = new QuadrantUniformGoal();
    // K11 是中心旋钮，覆盖 [5,6,10,9]，跨四个象限的交汇点
    const knob = topo.knobs().find((k) => k.id === 'K11')!;
    const moved = applyMove(board, knob, 'CW');
    expect(goal.satisfied(moved, topo)).toBe(false);
  });

  it('旋转 4 次后恢复满足胜利', () => {
    const board = createSolvedSquare4x4();
    const topo = square4x4();
    const goal = new QuadrantUniformGoal();
    const knob = topo.knobs()[0];
    let cur = board;
    for (let i = 0; i < 4; i++) cur = applyMove(cur, knob, 'CW');
    expect(goal.satisfied(cur, topo)).toBe(true);
  });

  // v0.2.4 fix 回归：四象限各自纯色但颜色轮换，必须判负
  it('颜色轮换的棋盘不判胜（左上黄/右上红/左下绿/右下蓝）', () => {
    const topo = square4x4();
    const goal = new QuadrantUniformGoal();
    const solved = createSolvedSquare4x4();
    // 构造一个四象限内部统一、但颜色与目标不符的棋盘：
    // TL=yellow, TR=red, BL=green, BR=blue
    const wrong: Cell[] = solved.cells.map((c) => ({ ...c }));
    const tl = [0, 1, 4, 5];
    const tr = [2, 3, 6, 7];
    const bl = [8, 9, 12, 13];
    const br = [10, 11, 14, 15];
    tl.forEach((i) => (wrong[i].color = 'yellow'));
    tr.forEach((i) => (wrong[i].color = 'red'));
    bl.forEach((i) => (wrong[i].color = 'green'));
    br.forEach((i) => (wrong[i].color = 'blue'));
    const wrongBoard = { dims: [...solved.dims], cells: wrong };
    expect(goal.satisfied(wrongBoard, topo)).toBe(false);
  });

  it('只有目标地图完全一致才判胜', () => {
    const topo = square4x4();
    const goal = new QuadrantUniformGoal();
    expect(goal.satisfied(createSolvedSquare4x4(), topo)).toBe(true);
    // 任意一格改色都不应判胜
    const b = createSolvedSquare4x4();
    const cells = b.cells.map((c) => ({ ...c }));
    cells[0].color = 'yellow'; // TL 出现一格黄
    expect(goal.satisfied({ dims: [...b.dims], cells }, topo)).toBe(false);
  });
});

describe('Generator - 关卡生成', () => {
  it('生成的题目与目标不同', () => {
    const solved = createSolvedSquare4x4();
    const topo = square4x4();
    const gen = generateLevel({
      solved,
      topology: topo,
      scrambleCount: 5,
      rng: new SeededRNG(42),
    });
    expect(boardsEqual(gen.initial, solved)).toBe(false);
  });

  it('题目可解（逆序执行 solution 可还原）', () => {
    const solved = createSolvedSquare4x4();
    const topo = square4x4();
    const goal = new QuadrantUniformGoal();
    const gen = generateLevel({
      solved,
      topology: topo,
      scrambleCount: 8,
      rng: new SeededRNG(42),
    });

    // 题目 → 逆序执行（每个 CW 用 3 次 CW 等价 1 次 CCW）
    const knobs = topo.knobs();
    let cur = gen.initial;
    for (let i = gen.solution.length - 1; i >= 0; i--) {
      const move = gen.solution[i];
      const knob = knobs.find((k) => k.id === move.knobId)!;
      // 逆 CW = 3 次 CW（或 1 次 CCW）
      cur = applyMove(cur, knob, 'CW');
      cur = applyMove(cur, knob, 'CW');
      cur = applyMove(cur, knob, 'CW');
    }
    expect(goal.satisfied(cur, topo)).toBe(true);
  });

  it('difficulty 随 scramble 增加而上升', () => {
    const solved = createSolvedSquare4x4();
    const topo = square4x4();
    const levels = generateDifficultyCurve(solved, topo, 5, 3, 3, new SeededRNG(999));
    // 整体趋势递增
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i].difficulty).toBeGreaterThanOrEqual(levels[i - 1].difficulty * 0.5);
    }
    // 最难的至少比最简单的高
    expect(levels[4].difficulty).toBeGreaterThan(levels[0].difficulty);
  });

  it('displacementRate 返回 [0,1] 区间值', () => {
    const solved = createSolvedSquare4x4();
    expect(displacementRate(solved, solved)).toBe(0);
    const topo = square4x4();
    const gen = generateLevel({
      solved,
      topology: topo,
      scrambleCount: 5,
      rng: new SeededRNG(7),
    });
    const rate = displacementRate(gen.initial, solved);
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThanOrEqual(1);
  });

  it('相同种子生成相同题目（确定性）', () => {
    const solved = createSolvedSquare4x4();
    const topo = square4x4();
    const gen1 = generateLevel({ solved, topology: topo, scrambleCount: 8, rng: new SeededRNG(123) });
    const gen2 = generateLevel({ solved, topology: topo, scrambleCount: 8, rng: new SeededRNG(123) });
    expect(boardsEqual(gen1.initial, gen2.initial)).toBe(true);
  });
});

describe('Levels - 关卡数据', () => {
  it('生成 31 个关卡', () => {
    const levels = getLevels();
    expect(levels).toHaveLength(31);
  });

  it('关卡 ID 从 1 到 31', () => {
    const levels = getLevels();
    expect(levels.map((l) => l.id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
      11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
      21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
    ]);
  });

  it('关卡难度在同拓扑内递增', () => {
    // v0.2.0：跨拓扑（4x4→6x6）难度会重置，仅在同类拓扑内断言递增
    const levels = getLevels();
    for (let i = 1; i < levels.length; i++) {
      if (levels[i].topologyKind === levels[i - 1].topologyKind) {
        expect(levels[i].difficulty).toBeGreaterThanOrEqual(levels[i - 1].difficulty);
      }
    }
    // 4x4 最难关 > 4x4 最易关
    expect(levels[9].difficulty).toBeGreaterThan(levels[0].difficulty);
    // 6x6 最难关 > 6x6 最易关
    expect(levels[19].difficulty).toBeGreaterThan(levels[10].difficulty);
  });

  it('每个关卡题目非已解决状态', () => {
    const solved4 = createSolvedSquare4x4();
    const solved6 = createSolvedSquare6x6();
    const solvedHex = createSolvedHexTriangle();
    const solvedHexSmall = createSolvedHexSmallTriangle();
    const levels = getLevels();
    for (const level of levels) {
      const solved =
        level.topologyKind === 'square-4x4' ? solved4 :
        level.topologyKind === 'square-6x6' ? solved6 :
        level.topologyKind === 'hex-small-triangle' ? solvedHexSmall : solvedHex;
      expect(boardsEqual(level.initial, solved)).toBe(false);
    }
  });

  it('每个关卡的初始棋盘维度正确', () => {
    const levels = getLevels();
    for (const level of levels) {
      if (level.topologyKind === 'square-4x4') {
        expect(level.initial.dims).toEqual([4, 4]);
        expect(level.initial.cells).toHaveLength(16);
      } else if (level.topologyKind === 'square-6x6') {
        expect(level.initial.dims).toEqual([6, 6]);
        expect(level.initial.cells).toHaveLength(36);
      } else if (level.topologyKind === 'hex-triangle') {
        expect(level.initial.cells).toHaveLength(54);
      } else if (level.topologyKind === 'hex-small-triangle') {
        expect(level.initial.cells).toHaveLength(24);
      }
    }
  });
});

describe('Board - 6x6 棋盘操作', () => {
  it('createSolvedSquare6x6 创建 6x6 棋盘，4 象限纯色', () => {
    const board = createSolvedSquare6x6();
    expect(board.dims).toEqual([6, 6]);
    expect(board.cells).toHaveLength(36);

    // TL: rows 0-2, cols 0-2 (indices 0-2, 6-8, 12-14) → red
    const tl = [0, 1, 2, 6, 7, 8, 12, 13, 14];
    const tr = [3, 4, 5, 9, 10, 11, 15, 16, 17];
    const bl = [18, 19, 20, 24, 25, 26, 30, 31, 32];
    const br = [21, 22, 23, 27, 28, 29, 33, 34, 35];

    tl.forEach((i) => expect(board.cells[i].color).toBe('red'));
    tr.forEach((i) => expect(board.cells[i].color).toBe('yellow'));
    bl.forEach((i) => expect(board.cells[i].color).toBe('blue'));
    br.forEach((i) => expect(board.cells[i].color).toBe('green'));
  });
});

describe('Topology - 6x6 拓扑', () => {
  it('square6x6 有 25 个旋钮', () => {
    const topo = square6x6();
    expect(topo.knobs()).toHaveLength(25);
  });

  it('每个旋钮覆盖 4 个色块', () => {
    const topo = square6x6();
    for (const knob of topo.knobs()) {
      expect(knob.cells).toHaveLength(4);
    }
  });

  it('有 4 个目标区域，各 9 格', () => {
    const topo = square6x6();
    const regions = topo.regions();
    expect(regions).toHaveLength(4);
    for (const r of regions) {
      expect(r.cells).toHaveLength(9);
    }
  });

  it('目标区域覆盖全部 36 格', () => {
    const topo = square6x6();
    const all = topo.regions().flatMap((r) => r.cells);
    expect(all).toHaveLength(36);
    const unique = new Set(all);
    expect(unique.size).toBe(36);
  });

  it('旋钮 K22 覆盖中心 2x2（行优先：14,15,21,20 顺时针）', () => {
    const topo = square6x6();
    const k22 = topo.knobs().find((k) => k.id === 'K22');
    expect(k22).toBeDefined();
    // K22 center=(2.5,2.5), covers r=2,c=2..3 & r=3,c=2..3
    // tl=(2,2)=14, tr=(2,3)=15, br=(3,3)=21, bl=(3,2)=20
    expect(k22!.cells).toEqual([14, 15, 21, 20]);
  });
});

describe('Goal - 6x6 目标判定', () => {
  it('已解决棋盘判定为胜利', () => {
    const board = createSolvedSquare6x6();
    const topo = square6x6();
    const goal = new QuadrantUniformGoal();
    expect(goal.satisfied(board, topo)).toBe(true);
  });

  it('打乱后的棋盘不满足胜利', () => {
    const board = createSolvedSquare6x6();
    const topo = square6x6();
    const goal = new QuadrantUniformGoal();
    // K22 是中心旋钮，覆盖跨四象限的 2x2
    const knob = topo.knobs().find((k) => k.id === 'K22')!;
    const moved = applyMove(board, knob, 'CW');
    expect(goal.satisfied(moved, topo)).toBe(false);
  });

  it('旋转 4 次后恢复满足胜利', () => {
    const board = createSolvedSquare6x6();
    const topo = square6x6();
    const goal = new QuadrantUniformGoal();
    const knob = topo.knobs()[0];
    let cur = board;
    for (let i = 0; i < 4; i++) cur = applyMove(cur, knob, 'CW');
    expect(goal.satisfied(cur, topo)).toBe(true);
  });

  // v0.2.4 fix 回归：四象限各自纯色但颜色轮换，6x6 也要判负
  it('颜色轮换的 6x6 棋盘不判胜', () => {
    const topo = square6x6();
    const goal = new QuadrantUniformGoal();
    const solved = createSolvedSquare6x6();
    const wrong: Cell[] = solved.cells.map((c) => ({ ...c }));
    // TL 区索引全部改成 yellow，TR 改 red，BL 改 green，BR 改 blue
    const regions = topo.regions();
    regions[0].cells.forEach((i) => (wrong[i].color = 'yellow'));
    regions[1].cells.forEach((i) => (wrong[i].color = 'red'));
    regions[2].cells.forEach((i) => (wrong[i].color = 'green'));
    regions[3].cells.forEach((i) => (wrong[i].color = 'blue'));
    const wrongBoard = { dims: [...solved.dims], cells: wrong };
    expect(goal.satisfied(wrongBoard, topo)).toBe(false);
  });
});

describe('Generator - 6x6 关卡生成', () => {
  it('生成的题目与目标不同', () => {
    const solved = createSolvedSquare6x6();
    const topo = square6x6();
    const gen = generateLevel({
      solved,
      topology: topo,
      scrambleCount: 8,
      rng: new SeededRNG(42),
    });
    expect(boardsEqual(gen.initial, solved)).toBe(false);
  });

  it('题目可解（逆序执行 solution 可还原）', () => {
    const solved = createSolvedSquare6x6();
    const topo = square6x6();
    const goal = new QuadrantUniformGoal();
    const gen = generateLevel({
      solved,
      topology: topo,
      scrambleCount: 12,
      rng: new SeededRNG(42),
    });

    const knobs = topo.knobs();
    let cur = gen.initial;
    for (let i = gen.solution.length - 1; i >= 0; i--) {
      const move = gen.solution[i];
      const knob = knobs.find((k) => k.id === move.knobId)!;
      // 逆 CW = 3 次 CW
      cur = applyMove(cur, knob, 'CW');
      cur = applyMove(cur, knob, 'CW');
      cur = applyMove(cur, knob, 'CW');
    }
    expect(goal.satisfied(cur, topo)).toBe(true);
  });

  it('相同种子生成相同题目（确定性）', () => {
    const solved = createSolvedSquare6x6();
    const topo = square6x6();
    const gen1 = generateLevel({ solved, topology: topo, scrambleCount: 10, rng: new SeededRNG(123) });
    const gen2 = generateLevel({ solved, topology: topo, scrambleCount: 10, rng: new SeededRNG(123) });
    expect(boardsEqual(gen1.initial, gen2.initial)).toBe(true);
  });
});

describe('Levels - 6x6 关卡数据', () => {
  it('生成 31 个关卡（10 个 4x4 + 10 个 6x6 + 10 个六边形 + 1 个骰子）', () => {
    const levels = getLevels();
    expect(levels).toHaveLength(31);
  });

  it('关卡 ID 从 1 到 31', () => {
    const levels = getLevels();
    expect(levels.map((l) => l.id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
      11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
      21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
    ]);
  });

  it('第 11-20 关为 6x6 网格', () => {
    const levels = getLevels();
    for (let i = 10; i < 20; i++) {
      expect(levels[i].topologyKind).toBe('square-6x6');
      expect(levels[i].initial.dims).toEqual([6, 6]);
      expect(levels[i].initial.cells).toHaveLength(36);
    }
  });

  it('第 1-10 关仍为 4x4 网格（回归）', () => {
    const levels = getLevels();
    for (let i = 0; i < 10; i++) {
      expect(levels[i].topologyKind).toBe('square-4x4');
      expect(levels[i].initial.dims).toEqual([4, 4]);
    }
  });

  it('每个 6x6 关卡题目非已解决状态', () => {
    const solved = createSolvedSquare6x6();
    const levels = getLevels();
    for (let i = 10; i < 20; i++) {
      expect(boardsEqual(levels[i].initial, solved)).toBe(false);
    }
  });
});

// v0.2.3：无尽模式题目生成
describe('generateRandomPuzzle - 无尽模式生成', () => {
  it('4x4: 生成与目标不同的题目', () => {
    const solved = createSolvedSquare4x4();
    const gen = generateRandomPuzzle('square-4x4', 30);
    expect(gen.initial.dims).toEqual([4, 4]);
    expect(boardsEqual(gen.initial, solved)).toBe(false);
  });

  it('6x6: 生成与目标不同的题目', () => {
    const solved = createSolvedSquare6x6();
    const gen = generateRandomPuzzle('square-6x6', 60);
    expect(gen.initial.dims).toEqual([6, 6]);
    expect(boardsEqual(gen.initial, solved)).toBe(false);
  });

  it('连续两次调用产生不同题目（非确定性）', () => {
    const a = generateRandomPuzzle('square-4x4', 30);
    const b = generateRandomPuzzle('square-4x4', 30);
    // 极小概率两次相同，但 scramble=30 下基本不可能
    expect(boardsEqual(a.initial, b.initial)).toBe(false);
  });

  it('生成的题目可解（逆序还原）', () => {
    const topo = square4x4();
    const gen = generateRandomPuzzle('square-4x4', 30);
    // 逆向执行 solution 应该还原到 solved
    const knobs = topo.knobs();
    const solved = createSolvedSquare4x4();
    const restored = applyMoves(
      gen.initial,
      knobs,
      gen.solution.map((m) => ({ ...m, direction: 'CCW' as const })).reverse(),
    );
    expect(boardsEqual(restored, solved)).toBe(true);
  });
});

// v0.3.0：六边形三角形拓扑
describe('HexTriangle - 六边形三角形拓扑', () => {
  it('createSolvedHexTriangle 创建 54 三角形棋盘', () => {
    const board = createSolvedHexTriangle();
    expect(board.cells).toHaveLength(54);
    // dims 标记总数
    expect(board.dims).toEqual([54]);
  });

  it('已解决棋盘 6 扇区分别纯色', () => {
    const board = createSolvedHexTriangle();
    const regions = hexTriangle().regions();
    expect(regions).toHaveLength(6);
    const COLORS = ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta'];
    for (let i = 0; i < 6; i++) {
      for (const idx of regions[i].cells) {
        expect(board.cells[idx].color).toBe(COLORS[i]);
      }
    }
  });

  it('hexTriangle 有 19 个旋钮，每个 6 三角形', () => {
    const topo = hexTriangle();
    const knobs = topo.knobs();
    expect(knobs).toHaveLength(19);
    for (const knob of knobs) {
      expect(knob.cells).toHaveLength(6);
    }
  });

  it('有 6 个目标区域，各 9 三角形', () => {
    const topo = hexTriangle();
    const regions = topo.regions();
    expect(regions).toHaveLength(6);
    for (const r of regions) {
      expect(r.cells).toHaveLength(9);
    }
  });

  it('目标区域覆盖全部 54 格', () => {
    const topo = hexTriangle();
    const all = topo.regions().flatMap((r) => r.cells);
    expect(all).toHaveLength(54);
    const unique = new Set(all);
    expect(unique.size).toBe(54);
  });

  it('已解决棋盘判定为胜利', () => {
    const board = createSolvedHexTriangle();
    const topo = hexTriangle();
    const goal = new HexUniformGoal();
    expect(goal.satisfied(board, topo)).toBe(true);
  });

  it('打乱后的棋盘不满足胜利', () => {
    const board = createSolvedHexTriangle();
    const topo = hexTriangle();
    const goal = new HexUniformGoal();
    // 中心旋钮 H9 (idx=9) 旋转 6 三角形跨扇区
    const knob = topo.knobs()[9];
    const moved = applyMove(board, knob, 'CW');
    expect(goal.satisfied(moved, topo)).toBe(false);
  });

  it('旋转 6 次后恢复满足胜利', () => {
    const board = createSolvedHexTriangle();
    const topo = hexTriangle();
    const goal = new HexUniformGoal();
    const knob = topo.knobs()[0];
    let cur = board;
    for (let i = 0; i < 6; i++) cur = applyMove(cur, knob, 'CW');
    expect(goal.satisfied(cur, topo)).toBe(true);
  });

  // v0.2.4 fix 同类回归：颜色轮换不判胜
  it('颜色轮换的六边形棋盘不判胜', () => {
    const topo = hexTriangle();
    const goal = new HexUniformGoal();
    const solved = createSolvedHexTriangle();
    const wrong: Cell[] = solved.cells.map((c) => ({ ...c }));
    // 全部扇区颜色轮换一位：S0→yellow, S1→green, ...
    const regions = topo.regions();
    const COLORS = ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta'];
    for (let i = 0; i < 6; i++) {
      const shiftedColor = COLORS[(i + 1) % 6] as Cell['color'];
      for (const idx of regions[i].cells) {
        wrong[idx].color = shiftedColor;
      }
    }
    const wrongBoard = { dims: [...solved.dims], cells: wrong };
    expect(goal.satisfied(wrongBoard, topo)).toBe(false);
  });
});

describe('Generator - 六边形关卡生成', () => {
  it('生成的题目与目标不同', () => {
    const solved = createSolvedHexTriangle();
    const topo = hexTriangle();
    const gen = generateLevel({
      solved,
      topology: topo,
      scrambleCount: 10,
      rng: new SeededRNG(42),
    });
    expect(boardsEqual(gen.initial, solved)).toBe(false);
  });

  it('题目可解（逆序执行 solution 可还原）', () => {
    const solved = createSolvedHexTriangle();
    const topo = hexTriangle();
    const goal = new HexUniformGoal();
    const gen = generateLevel({
      solved,
      topology: topo,
      scrambleCount: 15,
      rng: new SeededRNG(42),
    });
    // 逆 CW = 5 次 CW（六边形旋钮 6 块，CW*5 = CCW*1）
    const knobs = topo.knobs();
    let cur = gen.initial;
    for (let i = gen.solution.length - 1; i >= 0; i--) {
      const move = gen.solution[i];
      const knob = knobs.find((k) => k.id === move.knobId)!;
      // 逆 CW = 5 次 CW（因为 6 块旋钮，CW^5 = CCW）
      for (let k = 0; k < 5; k++) cur = applyMove(cur, knob, 'CW');
    }
    expect(goal.satisfied(cur, topo)).toBe(true);
  });

  it('相同种子生成相同题目（确定性）', () => {
    const solved = createSolvedHexTriangle();
    const topo = hexTriangle();
    const gen1 = generateLevel({ solved, topology: topo, scrambleCount: 10, rng: new SeededRNG(123) });
    const gen2 = generateLevel({ solved, topology: topo, scrambleCount: 10, rng: new SeededRNG(123) });
    expect(boardsEqual(gen1.initial, gen2.initial)).toBe(true);
  });

  it('generatePuzzle 统一接口支持 hex-triangle', () => {
    const solved = createSolvedHexTriangle();
    const gen = generatePuzzle('hex-triangle', 20, 301);
    expect(gen.initial.cells).toHaveLength(54);
    expect(boardsEqual(gen.initial, solved)).toBe(false);
  });
});

describe('Levels - 六边形关卡数据', () => {
  it('生成 31 个关卡（含第 21-30 关六边形 + 第 31 关骰子）', () => {
    const levels = getLevels();
    expect(levels).toHaveLength(31);
  });

  it('第 21-25 关为六边形简单版拓扑（N=2，24 三角形 / 7 旋钮）', () => {
    const levels = getLevels();
    for (let i = 20; i < 25; i++) {
      expect(levels[i].topologyKind).toBe('hex-small-triangle');
      expect(levels[i].initial.cells).toHaveLength(24);
      expect(levels[i].goal).toBeInstanceOf(HexUniformGoal);
    }
  });

  it('第 26-30 关为六边形困难版拓扑（N=3，54 三角形 / 19 旋钮）', () => {
    const levels = getLevels();
    for (let i = 25; i < 30; i++) {
      expect(levels[i].topologyKind).toBe('hex-triangle');
      expect(levels[i].initial.cells).toHaveLength(54);
      expect(levels[i].goal).toBeInstanceOf(HexUniformGoal);
    }
  });

  it('第 21-25 关打乱步数递增（scramble 10→15→20→25→30）', () => {
    // v0.3.3：简单版六边形关卡难度曲线
    const levels = getLevels();
    for (let i = 21; i <= 24; i++) {
      expect(levels[i].difficulty).toBeGreaterThanOrEqual(levels[i - 1].difficulty);
    }
    expect(levels[24].difficulty).toBeGreaterThan(levels[20].difficulty);
  });

  it('第 26-30 关打乱步数递增（scramble 40→55→70→85→100）', () => {
    // v0.3.3：困难版六边形关卡难度曲线
    const levels = getLevels();
    for (let i = 26; i <= 29; i++) {
      expect(levels[i].difficulty).toBeGreaterThanOrEqual(levels[i - 1].difficulty);
    }
    expect(levels[29].difficulty).toBeGreaterThan(levels[25].difficulty);
  });

  it('第 21-25 关每关题目非已解决状态', () => {
    const solved = createSolvedHexSmallTriangle();
    const levels = getLevels();
    for (let i = 20; i < 25; i++) {
      expect(boardsEqual(levels[i].initial, solved)).toBe(false);
    }
  });

  it('第 26-30 关每关题目非已解决状态', () => {
    const solved = createSolvedHexTriangle();
    const levels = getLevels();
    for (let i = 25; i < 30; i++) {
      expect(boardsEqual(levels[i].initial, solved)).toBe(false);
    }
  });

  it('第 21-25 关每关可解（逆向还原）', () => {
    const topo = hexSmallTriangle();
    const goal = new HexUniformGoal();
    const knobs = topo.knobs();
    const levels = getLevels();
    for (let lvl = 20; lvl < 25; lvl++) {
      let cur = levels[lvl].initial;
      for (let i = levels[lvl].solution.length - 1; i >= 0; i--) {
        const move = levels[lvl].solution[i];
        const knob = knobs.find((k) => k.id === move.knobId)!;
        // 逆 CW = 5 次 CW（六边形旋钮 6 块，CW*5 = CCW*1）
        for (let k = 0; k < 5; k++) cur = applyMove(cur, knob, 'CW');
      }
      expect(goal.satisfied(cur, topo)).toBe(true);
    }
  });

  it('第 26-30 关每关可解（逆向还原）', () => {
    const topo = hexTriangle();
    const goal = new HexUniformGoal();
    const knobs = topo.knobs();
    const levels = getLevels();
    for (let lvl = 25; lvl < 30; lvl++) {
      let cur = levels[lvl].initial;
      for (let i = levels[lvl].solution.length - 1; i >= 0; i--) {
        const move = levels[lvl].solution[i];
        const knob = knobs.find((k) => k.id === move.knobId)!;
        for (let k = 0; k < 5; k++) cur = applyMove(cur, knob, 'CW');
      }
      expect(goal.satisfied(cur, topo)).toBe(true);
    }
  });
});

// v0.3.2：六边形三角形简单版拓扑（N=2）
describe('HexSmallTriangle - 六边形三角形简单版拓扑', () => {
  it('createSolvedHexSmallTriangle 创建 24 三角形棋盘', () => {
    const board = createSolvedHexSmallTriangle();
    expect(board.cells).toHaveLength(24);
    expect(board.dims).toEqual([24]);
  });

  it('已解决棋盘 6 扇区分别纯色', () => {
    const board = createSolvedHexSmallTriangle();
    const regions = hexSmallTriangle().regions();
    expect(regions).toHaveLength(6);
    const COLORS = ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta'];
    for (let i = 0; i < 6; i++) {
      for (const idx of regions[i].cells) {
        expect(board.cells[idx].color).toBe(COLORS[i]);
      }
    }
  });

  it('hexSmallTriangle 有 7 个旋钮，每个 6 三角形', () => {
    const topo = hexSmallTriangle();
    const knobs = topo.knobs();
    expect(knobs).toHaveLength(7);
    for (const knob of knobs) {
      expect(knob.cells).toHaveLength(6);
    }
  });

  it('有 6 个目标区域，各 4 三角形', () => {
    const topo = hexSmallTriangle();
    const regions = topo.regions();
    expect(regions).toHaveLength(6);
    for (const r of regions) {
      expect(r.cells).toHaveLength(4);
    }
  });

  it('目标区域覆盖全部 24 格', () => {
    const topo = hexSmallTriangle();
    const all = topo.regions().flatMap((r) => r.cells);
    expect(all).toHaveLength(24);
    const unique = new Set(all);
    expect(unique.size).toBe(24);
  });

  it('已解决棋盘判定为胜利', () => {
    const board = createSolvedHexSmallTriangle();
    const topo = hexSmallTriangle();
    const goal = new HexUniformGoal();
    expect(goal.satisfied(board, topo)).toBe(true);
  });

  it('打乱后的棋盘不满足胜利', () => {
    const board = createSolvedHexSmallTriangle();
    const topo = hexSmallTriangle();
    const goal = new HexUniformGoal();
    const knob = topo.knobs()[3]; // 中心旋钮 H3
    const moved = applyMove(board, knob, 'CW');
    expect(goal.satisfied(moved, topo)).toBe(false);
  });

  it('旋转 6 次后恢复满足胜利', () => {
    const board = createSolvedHexSmallTriangle();
    const topo = hexSmallTriangle();
    const goal = new HexUniformGoal();
    const knob = topo.knobs()[3];
    let cur = board;
    for (let i = 0; i < 6; i++) cur = applyMove(cur, knob, 'CW');
    expect(goal.satisfied(cur, topo)).toBe(true);
  });

  it('颜色轮换的六边形棋盘不判胜', () => {
    const topo = hexSmallTriangle();
    const goal = new HexUniformGoal();
    const solved = createSolvedHexSmallTriangle();
    // 构造每个扇区纯色但颜色整体轮换一位
    const rotated = {
      dims: [...solved.dims],
      cells: solved.cells.map((c) => ({ ...c })),
    };
    const regions = topo.regions();
    const HEX_COLORS = ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta'] as const;
    for (let i = 0; i < 6; i++) {
      const color = HEX_COLORS[(i + 1) % 6];
      for (const idx of regions[i].cells) {
        rotated.cells[idx] = { color };
      }
    }
    expect(goal.satisfied(rotated, topo)).toBe(false);
  });
});

// v0.3.2：六边形简单版关卡生成
describe('Generator - 六边形简单版关卡生成', () => {
  it('生成的题目与目标不同', () => {
    const solved = createSolvedHexSmallTriangle();
    const topo = hexSmallTriangle();
    const gen = generateLevel({
      solved,
      topology: topo,
      scrambleCount: 15,
      rng: new SeededRNG(401),
    });
    expect(boardsEqual(gen.initial, solved)).toBe(false);
  });

  it('题目可解（逆序执行 solution 可还原）', () => {
    const solved = createSolvedHexSmallTriangle();
    const topo = hexSmallTriangle();
    const goal = new HexUniformGoal();
    const gen = generateLevel({
      solved,
      topology: topo,
      scrambleCount: 20,
      rng: new SeededRNG(401),
    });
    const knobs = topo.knobs();
    let cur = gen.initial;
    for (let i = gen.solution.length - 1; i >= 0; i--) {
      const move = gen.solution[i];
      const knob = knobs.find((k) => k.id === move.knobId)!;
      // 逆 CW = 5 次 CW（六边形旋钮 6 块，CW*5 = CCW*1）
      for (let k = 0; k < 5; k++) cur = applyMove(cur, knob, 'CW');
    }
    expect(goal.satisfied(cur, topo)).toBe(true);
  });

  it('相同种子生成相同题目（确定性）', () => {
    const solved = createSolvedHexSmallTriangle();
    const topo = hexSmallTriangle();
    const gen1 = generateLevel({ solved, topology: topo, scrambleCount: 20, rng: new SeededRNG(123) });
    const gen2 = generateLevel({ solved, topology: topo, scrambleCount: 20, rng: new SeededRNG(123) });
    expect(boardsEqual(gen1.initial, gen2.initial)).toBe(true);
  });

  it('generatePuzzle 统一接口支持 hex-small-triangle', () => {
    const solved = createSolvedHexSmallTriangle();
    const gen = generatePuzzle('hex-small-triangle', 20, 401);
    expect(gen.initial.cells).toHaveLength(24);
    expect(boardsEqual(gen.initial, solved)).toBe(false);
  });
});

// v0.3.5：对换道具 swapCells 纯函数测试
describe('swapCells - 对换格子颜色', () => {
  it('交换两个不同格子，颜色互换', () => {
    const board = createSolvedSquare4x4();
    // 索引 0 = red（左上），索引 15 = green（右下）
    expect(board.cells[0].color).toBe('red');
    expect(board.cells[15].color).toBe('green');
    const swapped = swapCells(board, 0, 15);
    expect(swapped.cells[0].color).toBe('green');
    expect(swapped.cells[15].color).toBe('red');
  });

  it('交换后其余格子不受影响', () => {
    const board = createSolvedSquare4x4();
    const swapped = swapCells(board, 0, 15);
    // 索引 1 仍为 red
    expect(swapped.cells[1].color).toBe('red');
    // 索引 14 仍为 green
    expect(swapped.cells[14].color).toBe('green');
    // 其余全部一致
    for (let i = 0; i < 16; i++) {
      if (i === 0 || i === 15) continue;
      expect(swapped.cells[i].color).toBe(board.cells[i].color);
    }
  });

  it('不修改原棋盘（纯函数）', () => {
    const board = createSolvedSquare4x4();
    const snapshot = cloneBoard(board);
    swapCells(board, 0, 15);
    expect(boardsEqual(board, snapshot)).toBe(true);
  });

  it('同一索引对换返回等价棋盘', () => {
    const board = createSolvedSquare4x4();
    const swapped = swapCells(board, 5, 5);
    expect(boardsEqual(swapped, board)).toBe(true);
  });

  it('二次对换恢复原状（swap ∘ swap = identity）', () => {
    const board = createSolvedSquare4x4();
    const once = swapCells(board, 0, 15);
    const twice = swapCells(once, 0, 15);
    expect(boardsEqual(twice, board)).toBe(true);
  });

  it('六边形棋盘同样支持对换', () => {
    const solved = createSolvedHexTriangle();
    const swapped = swapCells(solved, 0, 53);
    expect(swapped.cells[0].color).toBe(solved.cells[53].color);
    expect(swapped.cells[53].color).toBe(solved.cells[0].color);
    // 其余不变
    for (let i = 1; i < 52; i++) {
      expect(swapped.cells[i].color).toBe(solved.cells[i].color);
    }
  });
});

// v0.4.0：骰子 4x4 玩法测试
describe('Dice4x4 - 骰子 4x4 玩法', () => {
  it('createSolvedDice4x4 创建 4x4 棋盘，颜色四象限纯色', () => {
    const board = createSolvedDice4x4();
    expect(board.dims).toEqual([4, 4]);
    expect(board.cells).toHaveLength(16);
    // 颜色与基础 4x4 一致
    const basic = createSolvedSquare4x4();
    for (let i = 0; i < 16; i++) {
      expect(board.cells[i].color).toBe(basic.cells[i].color);
    }
  });

  it('每格携带 number 1-4，2x2 周期模式 1 2 / 3 4', () => {
    const board = createSolvedDice4x4();
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const idx = r * 4 + c;
        const expected = [1, 2, 3, 4][(r % 2) * 2 + (c % 2)];
        expect(board.cells[idx].number).toBe(expected);
      }
    }
  });

  it('每个旋钮覆盖的 4 格恰好包含 {1,2,3,4} 全集', () => {
    const board = createSolvedDice4x4();
    const topo = square4x4();
    for (const knob of topo.knobs()) {
      const nums = knob.cells.map((i) => board.cells[i].number);
      const sorted = [...nums].sort();
      expect(sorted).toEqual([1, 2, 3, 4]);
    }
  });

  it('已解决棋盘判定为胜利', () => {
    const board = createSolvedDice4x4();
    const topo = square4x4();
    const goal = new DiceQuadrantGoal();
    expect(goal.satisfied(board, topo)).toBe(true);
  });

  it('旋转后棋盘不满足胜利（颜色或数字被打乱）', () => {
    const board = createSolvedDice4x4();
    const topo = square4x4();
    const goal = new DiceQuadrantGoal();
    // 中心旋钮 K11 跨四象限
    const knob = topo.knobs().find((k) => k.id === 'K11')!;
    const moved = applyMove(board, knob, 'CW');
    expect(goal.satisfied(moved, topo)).toBe(false);
  });

  it('颜色正确但数字错位不判胜', () => {
    const board = createSolvedDice4x4();
    const topo = square4x4();
    const goal = new DiceQuadrantGoal();
    // 交换两个相同颜色但不同数字的格子
    // (0,0)=red/1, (0,1)=red/2 —— 同在 TL 红色象限，交换后颜色不变但数字错位
    const wrong = cloneBoard(board);
    const tmp = wrong.cells[0];
    wrong.cells[0] = { ...wrong.cells[1] };
    wrong.cells[1] = { ...tmp };
    // 颜色仍满足象限纯色
    const colorGoal = new QuadrantUniformGoal();
    expect(colorGoal.satisfied(wrong, topo)).toBe(true);
    // 但骰子 goal 不满足
    expect(goal.satisfied(wrong, topo)).toBe(false);
  });

  it('数字正确但颜色错位不判胜', () => {
    const board = createSolvedDice4x4();
    const topo = square4x4();
    const goal = new DiceQuadrantGoal();
    // 交换 (0,0)=red/1 与 (2,0)=blue/1 —— 数字同为 1 但颜色不同
    const wrong = cloneBoard(board);
    const tmp = wrong.cells[0];
    wrong.cells[0] = { ...wrong.cells[8] };
    wrong.cells[8] = { ...tmp };
    expect(goal.satisfied(wrong, topo)).toBe(false);
  });

  it('旋转 4 次后恢复满足胜利', () => {
    const board = createSolvedDice4x4();
    const topo = square4x4();
    const goal = new DiceQuadrantGoal();
    const knob = topo.knobs()[0];
    let cur = board;
    for (let i = 0; i < 4; i++) cur = applyMove(cur, knob, 'CW');
    expect(goal.satisfied(cur, topo)).toBe(true);
  });

  it('旋转后数字随 Cell 对象一起流转', () => {
    const board = createSolvedDice4x4();
    const topo = square4x4();
    // K00 覆盖 [0,1,5,4]，顺时针
    // 原始：0→{red,1}, 1→{red,2}, 5→{red,4}, 4→{red,3}
    const knob = topo.knobs()[0];
    const moved = applyMove(board, knob, 'CW');
    // CW 旋转：new[0]=old[3], new[1]=old[0], new[2]=old[1], new[3]=old[2]
    // 即 new[0]=old[4]={red,3}, new[1]=old[0]={red,1}, new[2]=old[1]={red,2}, new[3]=old[5]={red,4}
    // 对应格子索引 [0,1,5,4]:
    //   cell 0 → {red,3}（原 cell 4 的 number）
    //   cell 1 → {red,1}（原 cell 0 的 number）
    //   cell 5 → {red,2}（原 cell 1 的 number）
    //   cell 4 → {red,4}（原 cell 5 的 number）
    expect(moved.cells[0].number).toBe(3);
    expect(moved.cells[1].number).toBe(1);
    expect(moved.cells[5].number).toBe(2);
    expect(moved.cells[4].number).toBe(4);
  });

  it('对换两个格子时数字也一起交换', () => {
    const board = createSolvedDice4x4();
    // 索引 0 = {red,1}, 索引 15 = {green,4}
    expect(board.cells[0].number).toBe(1);
    expect(board.cells[15].number).toBe(4);
    const swapped = swapCells(board, 0, 15);
    expect(swapped.cells[0].number).toBe(4);
    expect(swapped.cells[15].number).toBe(1);
    expect(swapped.cells[0].color).toBe('green');
    expect(swapped.cells[15].color).toBe('red');
  });

  it('boardsEqual 比较骰子棋盘需数字一致', () => {
    const a = createSolvedDice4x4();
    const b = createSolvedDice4x4();
    expect(boardsEqual(a, b)).toBe(true);
    // 修改数字 → 不等
    const c = cloneBoard(a);
    c.cells[0].number = 4;
    expect(boardsEqual(a, c)).toBe(false);
  });

  it('generatePuzzle 支持 square-4x4-dice 拓扑', () => {
    const solved = createSolvedDice4x4();
    const gen = generatePuzzle('square-4x4-dice', 8, 501);
    expect(gen.initial.dims).toEqual([4, 4]);
    expect(gen.initial.cells).toHaveLength(16);
    // 每格应携带 number
    expect(gen.initial.cells[0].number).toBeDefined();
    expect(boardsEqual(gen.initial, solved)).toBe(false);
  });

  it('第 31 关为骰子 4x4 玩法', () => {
    const levels = getLevels();
    const level31 = levels.find((l) => l.id === 31)!;
    expect(level31).toBeDefined();
    expect(level31.topologyKind).toBe('square-4x4-dice');
    expect(level31.goal).toBeInstanceOf(DiceQuadrantGoal);
    expect(level31.initial.dims).toEqual([4, 4]);
    expect(level31.initial.cells).toHaveLength(16);
  });

  it('第 31 关题目非已解决状态', () => {
    const solved = createSolvedDice4x4();
    const levels = getLevels();
    expect(boardsEqual(levels[30].initial, solved)).toBe(false);
  });

  it('第 31 关题目可解（逆向还原）', () => {
    const topo = square4x4();
    const goal = new DiceQuadrantGoal();
    const knobs = topo.knobs();
    const levels = getLevels();
    let cur = levels[30].initial;
    for (let i = levels[30].solution.length - 1; i >= 0; i--) {
      const move = levels[30].solution[i];
      const knob = knobs.find((k) => k.id === move.knobId)!;
      // 逆 CW = 3 次 CW
      for (let k = 0; k < 3; k++) cur = applyMove(cur, knob, 'CW');
    }
    expect(goal.satisfied(cur, topo)).toBe(true);
  });
});
