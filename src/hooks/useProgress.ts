/**
 * v0.5.0：通关进度持久化 hook。
 * 使用 localStorage 记录已通关的关卡 id 集合，实现逐关解锁。
 *
 * 解锁逻辑：第 1 关默认解锁；其余关卡需前一关通关后才解锁。
 * 第 0 关（新手教程）不参与线性解锁，由调用方控制何时进入。
 */
import { useCallback, useEffect, useState } from 'react';

const LS_KEY = 'rotrix:progress:completed';

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

/** 第 n 关是否解锁（可玩） */
export function isLevelUnlocked(levelId: number, completed: Set<number>): boolean {
  // 第 1 关始终解锁
  if (levelId === 1) return true;
  // 第 0 关（新手教程）：通关第 1 关后解锁，可供回顾
  if (levelId === 0) return completed.has(1);
  // 其余关卡需前一关通关
  return completed.has(levelId - 1);
}

export function useProgress() {
  const [completed, setCompleted] = useState<Set<number>>(loadCompleted);

  // 持久化
  useEffect(() => {
    saveCompleted(completed);
  }, [completed]);

  const markCompleted = useCallback((levelId: number) => {
    setCompleted((prev) => {
      if (prev.has(levelId)) return prev;
      const next = new Set(prev);
      next.add(levelId);
      return next;
    });
  }, []);

  return { completed, markCompleted };
}
