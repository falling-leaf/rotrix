/**
 * v0.8.3：成就系统持久化 hook。
 *
 * 管理成就解锁状态的读取、检查与持久化。
 * 每次获得新成就时通过回调通知调用方，便于弹窗展示。
 * 统计信息（总对换次数等）也在此持久化。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AchievementEntry, AchievementProgress } from '../core/achievements';
import { checkAchievements, computeProgress, getReward, getAllAchievements } from '../core/achievements';

const LS_ACHIEVEMENTS = 'rotrix:achievements:entries';
const LS_SWAP_TOTAL = 'rotrix:achievements:totalSwaps';
const LS_TUTORIAL = 'rotrix:achievements:tutorialDone';

/** 从 localStorage 读取成就条目 */
function loadEntries(): AchievementEntry[] {
  try {
    const raw = localStorage.getItem(LS_ACHIEVEMENTS);
    if (!raw) return [];
    return JSON.parse(raw) as AchievementEntry[];
  } catch {
    return [];
  }
}

function saveEntries(entries: AchievementEntry[]): void {
  try {
    localStorage.setItem(LS_ACHIEVEMENTS, JSON.stringify(entries));
  } catch {
    // 静默
  }
}

/** 读取累计对换次数 */
function loadTotalSwaps(): number {
  try {
    return parseInt(localStorage.getItem(LS_SWAP_TOTAL) || '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveTotalSwaps(n: number): void {
  try {
    localStorage.setItem(LS_SWAP_TOTAL, String(n));
  } catch {
    // 静默
  }
}

/** 是否已完成新手教程 */
function loadTutorialDone(): boolean {
  try {
    return localStorage.getItem(LS_TUTORIAL) === '1';
  } catch {
    return false;
  }
}

function saveTutorialDone(v: boolean): void {
  try {
    localStorage.setItem(LS_TUTORIAL, v ? '1' : '0');
  } catch {
    // 静默
  }
}

export function useAchievements() {
  const [entries, setEntries] = useState<AchievementEntry[]>(loadEntries);
  const [totalSwaps, setTotalSwaps] = useState(loadTotalSwaps);
  const [tutorialDone, setTutorialDone] = useState(loadTutorialDone);
  // 新解锁的成就 ID（用于弹窗展示）
  const [newlyUnlocked, setNewlyUnlocked] = useState<string[]>([]);
  // 新解锁成就的金币奖励总额
  const newlyUnlockedCoins = useMemo(() => {
    const defMap = new Map(getAllAchievements().map((d) => [d.id, d]));
    let total = 0;
    for (const id of newlyUnlocked) {
      const def = defMap.get(id);
      if (def) total += getReward(def.tier);
    }
    return total;
  }, [newlyUnlocked]);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  // 持久化
  useEffect(() => { saveEntries(entries); }, [entries]);
  useEffect(() => { saveTotalSwaps(totalSwaps); }, [totalSwaps]);
  useEffect(() => { saveTutorialDone(tutorialDone); }, [tutorialDone]);

  /** 清除新成就提示 */
  const clearNewlyUnlocked = useCallback(() => setNewlyUnlocked([]), []);

  /**
   * 检查所有成就。
   * 传入当前进度快照，返回新解锁的成就 ID 列表。
   */
  const check = useCallback((progress: AchievementProgress): string[] => {
    const newEntries = checkAchievements(entriesRef.current, progress);
    if (newEntries.length > 0) {
      setEntries((prev) => {
        // 合并新旧条目，避免重复
        const existing = new Map(prev.map((e) => [e.id, e]));
        for (const ne of newEntries) {
          existing.set(ne.id, ne);
        }
        return [...existing.values()];
      });
      const ids = newEntries.map((e) => e.id);
      setNewlyUnlocked((prev) => [...prev, ...ids]);
      return ids;
    }
    return [];
  }, []);

  /** 手动标记成就已解锁（用于测试/调试） */
  const forceUnlock = useCallback((id: string) => {
    setEntries((prev) => {
      if (prev.some((e) => e.id === id)) return prev;
      return [...prev, { id, unlocked: true, unlockedAt: Date.now() }];
    });
  }, []);

  /** 增加对换使用次数 */
  const addSwap = useCallback(() => {
    setTotalSwaps((n) => n + 1);
  }, []);

  /** 标记新手教程完成 */
  const markTutorialDone = useCallback(() => {
    setTutorialDone(true);
  }, []);

  /**
   * 构建统一进度快照并检查成就。
   * 各组件传入自己的数据，由 hook 汇总后调用 check。
   */
  const checkAll = useCallback(
    (params: {
      completed: Set<number>;
      stars: Record<number, number>;
      totalLevels: number;
      endlessTotalCleared: number;
      endlessClearedByKind: Record<string, number>;
      endlessBestTime: Record<string, number>;
      endlessBestSteps: Record<string, number>;
    }): string[] => {
      const progress = computeProgress(
        params.completed,
        params.stars,
        params.totalLevels,
        params.endlessTotalCleared,
        params.endlessClearedByKind,
        params.endlessBestTime,
        params.endlessBestSteps,
        totalSwaps,
        tutorialDone,
      );
      return check(progress);
    },
    [check, totalSwaps, tutorialDone],
  );

  return {
    entries,
    totalSwaps,
    tutorialDone,
    newlyUnlocked,
    newlyUnlockedCoins,
    clearNewlyUnlocked,
    check,
    checkAll,
    forceUnlock,
    addSwap,
    markTutorialDone,
  };
}

export type UseAchievementsReturn = ReturnType<typeof useAchievements>;