/**
 * v0.5.0：通关进度持久化 hook。
 * 使用 localStorage 记录已通关的关卡 id 集合，实现逐关解锁。
 * v0.8.0：新增星级评定——每关最多 3 星，不同玩法类型阈值不同。
 *
 * 星级阈值规则：
 * - 常规玩法（4x4, 6x6）：三星 = ≤scramble×1.5，二星 = ≤scramble×2
 * - 图标/图案玩法（icon, picture）：三星 = ≤scramble×2，二星 = ≤scramble×3
 * - 三角形玩法（hex/triangle）：三星 = ≤scramble×3，二星 = ≤scramble×5
 *
 * 解锁逻辑：第 1 关默认解锁；其余关卡需前一关通关后才解锁。
 * 第 0 关（新手教程）不参与线性解锁，由调用方控制何时进入。
 */
import { useCallback, useEffect, useState } from 'react';

const LS_KEY = 'rotrix:progress:completed';
const LS_STARS_KEY = 'rotrix:progress:stars';

function loadCompleted(): Set<number> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as number[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function saveCompleted(set: Set<number>): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...set]));
  } catch {
    // localStorage 不可用时静默
  }
}

function loadStars(): Record<number, number> {
  try {
    const raw = localStorage.getItem(LS_STARS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<number, number>;
  } catch {
    return {};
  }
}

function saveStars(stars: Record<number, number>): void {
  try {
    localStorage.setItem(LS_STARS_KEY, JSON.stringify(stars));
  } catch {
    // localStorage 不可用时静默
  }
}

/** 根据拓扑类型获取三星和二星阈值 */
export function getStarThresholds(scramble: number, topologyKind: string): { threshold3: number; threshold2: number } {
  const kind = topologyKind || '';
  // 三角形玩法（hex/triangle）：3x 和 5x（含 36-50 关，含 hex-small-triangle-picture）
  if (kind.includes('hex') || kind.includes('triangle')) {
    return {
      threshold3: Math.floor(scramble * 3),
      threshold2: Math.floor(scramble * 5),
    };
  }
  // 图标/图案玩法（icon, picture）：2x 和 3x
  if (kind.includes('icon') || kind.includes('picture')) {
    return {
      threshold3: Math.floor(scramble * 2),
      threshold2: Math.floor(scramble * 3),
    };
  }
  // 常规玩法（4x4, 6x6, dice 等）：1.5x 和 2x
  return {
    threshold3: Math.floor(scramble * 1.5),
    threshold2: Math.floor(scramble * 2),
  };
}

/** 根据打乱步数、实际步数和拓扑类型计算星级（1-3） */
export function computeStars(scramble: number, moveCount: number, topologyKind?: string): number {
  const { threshold3, threshold2 } = getStarThresholds(scramble, topologyKind || '');
  if (moveCount <= threshold3) return 3;
  if (moveCount <= threshold2) return 2;
  return 1;
}

/** 第 n 关是否解锁（可玩） */
export function isLevelUnlocked(levelId: number, completed: Set<number>, developerMode = false): boolean {
  // v0.5.1：开发者模式——所有关卡均解锁
  if (developerMode) return true;
  // 第 1 关始终解锁
  if (levelId === 1) return true;
  // 第 0 关（新手教程）：通关第 1 关后解锁，可供回顾
  if (levelId === 0) return completed.has(1);
  // 其余关卡需前一关通关
  return completed.has(levelId - 1);
}

export function useProgress() {
  const [completed, setCompleted] = useState<Set<number>>(loadCompleted);
  const [stars, setStars] = useState<Record<number, number>>(loadStars);

  // 持久化
  useEffect(() => {
    saveCompleted(completed);
  }, [completed]);

  useEffect(() => {
    saveStars(stars);
  }, [stars]);

  const markCompleted = useCallback((levelId: number, starCount?: number) => {
    setCompleted((prev) => {
      if (prev.has(levelId)) return prev;
      const next = new Set(prev);
      next.add(levelId);
      return next;
    });
    // 更新星级（保留最高分）
    if (starCount !== undefined) {
      setStars((prev) => {
        const current = prev[levelId] ?? 0;
        if (starCount > current) {
          return { ...prev, [levelId]: starCount };
        }
        return prev;
      });
    }
  }, []);

  return { completed, stars, markCompleted };
}