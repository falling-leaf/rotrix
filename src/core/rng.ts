/**
 * 确定性线性同余生成器（LCRNG）
 *
 * 用于生成可复现的关卡：给定相同种子，产生相同的旋转序列，
 * 从而 5 个关卡内容固定，不会每次刷新变化。
 */

import type { RNG } from './board';

export class SeededRNG implements RNG {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** LCG: x = (a*x + c) mod m，参数同 glibc rand() */
  next(): number {
    // 32-bit LCG
    this.state = (Math.imul(this.state, 1103515245) + 12345) & 0x7fffffff;
    return this.state / 0x7fffffff;
  }

  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }
}
