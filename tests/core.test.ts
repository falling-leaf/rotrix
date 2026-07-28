/**
 * 冒烟测试 - 核心逻辑层
 *
 * 覆盖：棋盘创建、旋转操作、拓扑结构、目标判定、关卡生成。
 * 这些是纯函数测试，快速且确定性。
 */
import { describe, it, expect } from 'vitest';
import {
  createSolvedSquare4x4,
  applyMove,
  cloneBoard,
  boardsEqual,
  rotateCellsCW,
  rotateCellsCCW,
} from '../src/core/board';
import { square4x4 } from '../src/core/topology';
import { QuadrantUniformGoal } from '../src/core/goals';
import { generateLevel, generateDifficultyCurve, displacementRate } from '../src/core/generator';
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
  it('生成 5 个关卡', () => {
    const levels = getLevels();
    expect(levels).toHaveLength(5);
  });

  it('关卡 ID 从 1 到 5', () => {
    const levels = getLevels();
    expect(levels.map((l) => l.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('关卡难度递增', () => {
    const levels = getLevels();
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i].difficulty).toBeGreaterThanOrEqual(levels[i - 1].difficulty);
    }
  });

  it('每个关卡题目非已解决状态', () => {
    const solved = createSolvedSquare4x4();
    const levels = getLevels();
    for (const level of levels) {
      expect(boardsEqual(level.initial, solved)).toBe(false);
    }
  });

  it('每个关卡的初始棋盘为 4x4 16 格', () => {
    const levels = getLevels();
    for (const level of levels) {
      expect(level.initial.dims).toEqual([4, 4]);
      expect(level.initial.cells).toHaveLength(16);
    }
  });
});
