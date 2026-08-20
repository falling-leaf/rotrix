/**
 * v0.8.3：成就系统核心定义
 * v0.8.4：无尽极速重构——每个模式独立金银铜成就（时间+步数）
 *
 * 成就分为三个等级：金（Gold）、银（Silver）、铜（Bronze）。
 * 成就通过检查器函数（check）判定是否达成，检查器接收一个统一的
 * 进度快照（AchievementProgress），返回 true 表示达成。
 *
 * 设计原则：成就定义与 UI 解耦，全部为纯数据 + 纯函数，便于单元测试。
 * 新增成就只需在 ACHIEVEMENT_DEFS 数组中添加一项即可。
 */

/** 成就等级 */
export type AchievementTier = 'bronze' | 'silver' | 'gold';

/** 成就定义——check 函数接收当前进度快照，返回是否达成 */
export interface AchievementDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tier: AchievementTier;
  /** 成就分类 */
  readonly category: string;
  readonly check: (progress: AchievementProgress) => boolean;
}

/** 每个成就的解锁状态 */
export interface AchievementEntry {
  id: string;
  unlocked: boolean;
  unlockedAt: number; // Date.now() 时间戳
}

/**
 * 成就系统所需的全局进度快照。
 * 每次检查时由 useAchievements 从 localStorage 及各组件汇总。
 * 所有字段为基本类型或数组，便于序列化与测试。
 */
export interface AchievementProgress {
  /** 已通关的关卡 ID 列表 */
  campaignCompleted: number[];
  /** 每关获得的星级，key 为关卡 ID 字符串，value 为 1-3 */
  campaignStars: Record<string, number>;
  /** 闯关总关数 */
  campaignTotalLevels: number;
  /** 无尽模式总通关次数（所有子模式之和） */
  endlessTotalCleared: number;
  /** 无尽模式各子模式通关次数 { kind: count } */
  endlessClearedByKind: Record<string, number>;
  /** 无尽模式各子模式最短时间（秒） { kind: seconds } */
  endlessBestTime: Record<string, number>;
  /** 无尽模式各子模式最少步数 { kind: steps } */
  endlessBestSteps: Record<string, number>;
  /** 累计使用对换道具次数 */
  totalSwapsUsed: number;
  /** 三星通关数 */
  threeStarCount: number;
  /** 总星数（所有关卡星级之和） */
  totalStars: number;
  /** 是否完成新手教程 */
  tutorialCompleted: boolean;
  /** 是否通关所有关卡 */
  allCampaignCleared: boolean;
  /** 是否所有关卡全部三星 */
  allThreeStar: boolean;
}

/** 成就等级的中文描述 */
export const TIER_LABEL: Record<AchievementTier, string> = {
  bronze: '铜',
  silver: '银',
  gold: '金',
};

/** 成就等级的排序权重（金＞银＞铜） */
export const TIER_ORDER: Record<AchievementTier, number> = {
  gold: 0,
  silver: 1,
  bronze: 2,
};

/** 成就等级对应的 CSS 类名 */
export const TIER_CLASS: Record<AchievementTier, string> = {
  gold: 'ach-gold',
  silver: 'ach-silver',
  bronze: 'ach-bronze',
};

/** 成就解锁金币奖励 */
export const TIER_REWARD: Record<AchievementTier, number> = {
  gold: 150,
  silver: 100,
  bronze: 50,
};

/** 获取成就等级对应的金币奖励 */
export function getReward(tier: AchievementTier): number {
  return TIER_REWARD[tier];
}

// ============================================================
// 无尽极速——每个模式的金银铜时间/步数阈值
// ============================================================

/** 无尽模式子类型列表 */
export const ENDLESS_KINDS = ['4x4', '6x6', 'hex-small', 'hex-triangle'] as const;

/** 模式中文名映射 */
const KIND_LABEL: Record<string, string> = {
  '4x4': '4×4',
  '6x6': '6×6',
  'hex-small': '小三角',
  'hex-triangle': '大三角',
};

/** 每个模式的金银铜时间阈值（秒） */
const SPEED_THRESHOLDS: Record<string, { gold: number; silver: number; bronze: number }> = {
  '4x4': { gold: 8, silver: 15, bronze: 30 },
  '6x6': { gold: 15, silver: 30, bronze: 60 },
  'hex-small': { gold: 10, silver: 20, bronze: 45 },
  'hex-triangle': { gold: 25, silver: 45, bronze: 90 },
};

/** 每个模式的金银铜步数阈值 */
const STEPS_THRESHOLDS: Record<string, { gold: number; silver: number; bronze: number }> = {
  '4x4': { gold: 3, silver: 6, bronze: 10 },
  '6x6': { gold: 6, silver: 10, bronze: 20 },
  'hex-small': { gold: 4, silver: 8, bronze: 15 },
  'hex-triangle': { gold: 8, silver: 15, bronze: 30 },
};

/** 构建描述文本：模式A时间≤T1 / 模式B时间≤T2 / ... */
function thresholdDesc(
  thresholds: Record<string, { gold: number; silver: number; bronze: number }>,
  tier: 'gold' | 'silver' | 'bronze',
  unit: string,
): string {
  return ENDLESS_KINDS
    .map((k) => `${KIND_LABEL[k]}≤${thresholds[k][tier]}${unit}`)
    .join(' / ');
}

/** 检查任意模式是否满足阈值（best > 0 确保有记录） */
function anyModeWithin(
  best: Record<string, number>,
  thresholds: Record<string, { gold: number; silver: number; bronze: number }>,
  tier: 'gold' | 'silver' | 'bronze',
): boolean {
  return ENDLESS_KINDS.some(
    (k) => (best[k] ?? 0) > 0 && (best[k] ?? 999) <= thresholds[k][tier],
  );
}

// ============================================================
// 成就定义
// ============================================================

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // ===== 闯关模式 =====
  {
    id: 'first_clear',
    name: '初出茅庐',
    description: '通关第 1 关',
    tier: 'bronze',
    category: '闯关模式',
    check: (p) => p.campaignCompleted.includes(1),
  },
  {
    id: 'clear_10',
    name: '渐入佳境',
    description: '通关 10 个关卡',
    tier: 'silver',
    category: '闯关模式',
    check: (p) => p.campaignCompleted.length >= 10,
  },
  {
    id: 'clear_all',
    name: '常胜将军',
    description: '通关所有关卡',
    tier: 'gold',
    category: '闯关模式',
    check: (p) => p.allCampaignCleared,
  },

  // ===== 无尽模式 =====
  {
    id: 'endless_10',
    name: '小试牛刀',
    description: '无尽模式累计通关 10 次',
    tier: 'bronze',
    category: '无尽模式',
    check: (p) => p.endlessTotalCleared >= 10,
  },
  {
    id: 'endless_50',
    name: '乐此不疲',
    description: '无尽模式累计通关 50 次',
    tier: 'silver',
    category: '无尽模式',
    check: (p) => p.endlessTotalCleared >= 50,
  },
  {
    id: 'endless_100',
    name: '生生不息',
    description: '无尽模式累计通关 100 次',
    tier: 'gold',
    category: '无尽模式',
    check: (p) => p.endlessTotalCleared >= 100,
  },
  {
    id: 'endless_4x4_10',
    name: '矩阵达人',
    description: '4×4 无尽通关 10 次',
    tier: 'silver',
    category: '无尽模式',
    check: (p) => (p.endlessClearedByKind['4x4'] ?? 0) >= 10,
  },
  {
    id: 'endless_6x6_10',
    name: '矩阵大师',
    description: '6×6 无尽通关 10 次',
    tier: 'gold',
    category: '无尽模式',
    check: (p) => (p.endlessClearedByKind['6x6'] ?? 0) >= 10,
  },
  {
    id: 'endless_hex_small_10',
    name: '三角高手',
    description: '小型三角无尽通关 10 次',
    tier: 'silver',
    category: '无尽模式',
    check: (p) => (p.endlessClearedByKind['hex-small'] ?? 0) >= 10,
  },
  {
    id: 'endless_hex_tri_10',
    name: '三角至尊',
    description: '大型三角无尽通关 10 次',
    tier: 'gold',
    category: '无尽模式',
    check: (p) => (p.endlessClearedByKind['hex-triangle'] ?? 0) >= 10,
  },

  // ===== 无尽极速（3 时间 + 3 步数，任意模式满足阈值即可） =====
  {
    id: 'speed_gold',
    name: '电光石火',
    description: `最短时间 ${thresholdDesc(SPEED_THRESHOLDS, 'gold', 's')}`,
    tier: 'gold',
    category: '无尽极速',
    check: (p) => anyModeWithin(p.endlessBestTime, SPEED_THRESHOLDS, 'gold'),
  },
  {
    id: 'speed_silver',
    name: '风驰电掣',
    description: `最短时间 ${thresholdDesc(SPEED_THRESHOLDS, 'silver', 's')}`,
    tier: 'silver',
    category: '无尽极速',
    check: (p) => anyModeWithin(p.endlessBestTime, SPEED_THRESHOLDS, 'silver'),
  },
  {
    id: 'speed_bronze',
    name: '初露锋芒',
    description: `最短时间 ${thresholdDesc(SPEED_THRESHOLDS, 'bronze', 's')}`,
    tier: 'bronze',
    category: '无尽极速',
    check: (p) => anyModeWithin(p.endlessBestTime, SPEED_THRESHOLDS, 'bronze'),
  },
  {
    id: 'steps_gold',
    name: '妙手回春',
    description: `最少步数 ${thresholdDesc(STEPS_THRESHOLDS, 'gold', '步')}`,
    tier: 'gold',
    category: '无尽极速',
    check: (p) => anyModeWithin(p.endlessBestSteps, STEPS_THRESHOLDS, 'gold'),
  },
  {
    id: 'steps_silver',
    name: '举重若轻',
    description: `最少步数 ${thresholdDesc(STEPS_THRESHOLDS, 'silver', '步')}`,
    tier: 'silver',
    category: '无尽极速',
    check: (p) => anyModeWithin(p.endlessBestSteps, STEPS_THRESHOLDS, 'silver'),
  },
  {
    id: 'steps_bronze',
    name: '轻车熟路',
    description: `最少步数 ${thresholdDesc(STEPS_THRESHOLDS, 'bronze', '步')}`,
    tier: 'bronze',
    category: '无尽极速',
    check: (p) => anyModeWithin(p.endlessBestSteps, STEPS_THRESHOLDS, 'bronze'),
  },

  // ===== 对换道具 =====
  {
    id: 'swap_first',
    name: '初次尝试',
    description: '使用对换道具 1 次',
    tier: 'bronze',
    category: '对换道具',
    check: (p) => p.totalSwapsUsed >= 1,
  },
  {
    id: 'swap_10',
    name: '惯用伎俩',
    description: '使用对换道具 10 次',
    tier: 'silver',
    category: '对换道具',
    check: (p) => p.totalSwapsUsed >= 10,
  },
  {
    id: 'swap_50',
    name: '乾坤大挪移',
    description: '使用对换道具 50 次',
    tier: 'gold',
    category: '对换道具',
    check: (p) => p.totalSwapsUsed >= 50,
  },

  // ===== 三星挑战 =====
  {
    id: 'three_star_3',
    name: '三星初现',
    description: '获得 3 个三星通关',
    tier: 'bronze',
    category: '三星挑战',
    check: (p) => p.threeStarCount >= 3,
  },
  {
    id: 'three_star_10',
    name: '三星收藏家',
    description: '获得 10 个三星通关',
    tier: 'silver',
    category: '三星挑战',
    check: (p) => p.threeStarCount >= 10,
  },
  {
    id: 'three_star_30',
    name: '三星大师',
    description: '获得 30 个三星通关',
    tier: 'gold',
    category: '三星挑战',
    check: (p) => p.threeStarCount >= 30,
  },

  // ===== 星星总数 =====
  {
    id: 'star_50',
    name: '星光初现',
    description: '累计获得 50 颗星',
    tier: 'bronze',
    category: '星星总数',
    check: (p) => p.totalStars >= 50,
  },
  {
    id: 'star_100',
    name: '星光璀璨',
    description: '累计获得 100 颗星',
    tier: 'silver',
    category: '星星总数',
    check: (p) => p.totalStars >= 100,
  },
  {
    id: 'star_150',
    name: '星河闪耀',
    description: '累计获得 150 颗星',
    tier: 'gold',
    category: '星星总数',
    check: (p) => p.totalStars >= 150,
  },

  // ===== 其他 =====
  {
    id: 'perfect_all',
    name: '完美通关',
    description: '所有关卡全部三星通关',
    tier: 'gold',
    category: '其他',
    check: (p) => p.allThreeStar,
  },
  {
    id: 'tutorial_done',
    name: '初识 Rotrix',
    description: '完成新手教程',
    tier: 'bronze',
    category: '其他',
    check: (p) => p.tutorialCompleted,
  },
];

// ============================================================
// 纯函数——成就检查
// ============================================================

/** 获取所有成就定义 */
export function getAllAchievements(): AchievementDef[] {
  return ACHIEVEMENT_DEFS;
}

/** 获取已解锁的成就 ID 集合 */
export function getUnlockedIds(entries: AchievementEntry[]): Set<string> {
  return new Set(entries.filter((e) => e.unlocked).map((e) => e.id));
}

/**
 * 检查所有成就，返回新解锁的成就项列表。
 * 只返回从「未解锁」变为「解锁」的成就。
 */
export function checkAchievements(
  entries: AchievementEntry[],
  progress: AchievementProgress,
): AchievementEntry[] {
  const unlockedIds = getUnlockedIds(entries);
  const now = Date.now();
  const newlyUnlocked: AchievementEntry[] = [];

  for (const def of ACHIEVEMENT_DEFS) {
    if (unlockedIds.has(def.id)) continue;
    if (def.check(progress)) {
      newlyUnlocked.push({ id: def.id, unlocked: true, unlockedAt: now });
    }
  }

  return newlyUnlocked;
}

/** 按分类分组成就 */
export function groupByCategory(): Record<string, AchievementDef[]> {
  const groups: Record<string, AchievementDef[]> = {};
  for (const def of ACHIEVEMENT_DEFS) {
    if (!groups[def.category]) groups[def.category] = [];
    groups[def.category].push(def);
  }
  return groups;
}

/** 按等级排序（金→银→铜） */
export function sortByTier(defs: AchievementDef[]): AchievementDef[] {
  return [...defs].sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);
}

/** 计算总进度 */
export function computeProgress(
  completed: Set<number>,
  stars: Record<number, number>,
  totalLevels: number,
  endlessTotalCleared: number,
  endlessClearedByKind: Record<string, number>,
  endlessBestTime: Record<string, number>,
  endlessBestSteps: Record<string, number>,
  totalSwapsUsed: number,
  tutorialCompleted: boolean,
): AchievementProgress {
  const campaignCompleted = [...completed];
  const starValues = Object.values(stars);
  const threeStarCount = starValues.filter((s) => s >= 3).length;
  const totalStars = starValues.reduce((a, b) => a + b, 0);
  const allCampaignCleared = totalLevels > 0 && campaignCompleted.length >= totalLevels;
  const allThreeStar = totalLevels > 0 && threeStarCount >= totalLevels;

  return {
    campaignCompleted,
    campaignStars: Object.fromEntries(
      Object.entries(stars).map(([k, v]) => [k, v]),
    ),
    campaignTotalLevels: totalLevels,
    endlessTotalCleared,
    endlessClearedByKind,
    endlessBestTime,
    endlessBestSteps,
    totalSwapsUsed,
    threeStarCount,
    totalStars,
    tutorialCompleted,
    allCampaignCleared,
    allThreeStar,
  };
}

/**
 * 获取成就当前进度（用于可量化成就的进度展示）。
 * 返回 { current, target } 或 null（不可量化成就）。
 */
export function getAchievementProgress(
  def: AchievementDef,
  progress: AchievementProgress,
): { current: number; target: number } | null {
  switch (def.id) {
    // 闯关模式
    case 'first_clear':
      return { current: progress.campaignCompleted.includes(1) ? 1 : 0, target: 1 };
    case 'clear_10':
      return { current: Math.min(progress.campaignCompleted.length, 10), target: 10 };
    case 'clear_all':
      return { current: progress.campaignCompleted.length, target: progress.campaignTotalLevels };

    // 无尽模式
    case 'endless_10':
      return { current: Math.min(progress.endlessTotalCleared, 10), target: 10 };
    case 'endless_50':
      return { current: Math.min(progress.endlessTotalCleared, 50), target: 50 };
    case 'endless_100':
      return { current: Math.min(progress.endlessTotalCleared, 100), target: 100 };
    case 'endless_4x4_10':
      return { current: Math.min(progress.endlessClearedByKind['4x4'] ?? 0, 10), target: 10 };
    case 'endless_6x6_10':
      return { current: Math.min(progress.endlessClearedByKind['6x6'] ?? 0, 10), target: 10 };
    case 'endless_hex_small_10':
      return { current: Math.min(progress.endlessClearedByKind['hex-small'] ?? 0, 10), target: 10 };
    case 'endless_hex_tri_10':
      return { current: Math.min(progress.endlessClearedByKind['hex-triangle'] ?? 0, 10), target: 10 };

    // 对换道具
    case 'swap_first':
      return { current: Math.min(progress.totalSwapsUsed, 1), target: 1 };
    case 'swap_10':
      return { current: Math.min(progress.totalSwapsUsed, 10), target: 10 };
    case 'swap_50':
      return { current: Math.min(progress.totalSwapsUsed, 50), target: 50 };

    // 三星挑战
    case 'three_star_3':
      return { current: Math.min(progress.threeStarCount, 3), target: 3 };
    case 'three_star_10':
      return { current: Math.min(progress.threeStarCount, 10), target: 10 };
    case 'three_star_30':
      return { current: Math.min(progress.threeStarCount, 30), target: 30 };

    // 星星总数
    case 'star_50':
      return { current: Math.min(progress.totalStars, 50), target: 50 };
    case 'star_100':
      return { current: Math.min(progress.totalStars, 100), target: 100 };
    case 'star_150':
      return { current: Math.min(progress.totalStars, 150), target: 150 };

    // 其他（不可量化）
    case 'perfect_all':
    case 'tutorial_done':
      return null;

    // 无尽极速——显示最佳模式的时间/步数 vs 该模式对应阈值
    case 'speed_gold':
    case 'speed_silver':
    case 'speed_bronze': {
      const tier = def.id.split('_')[1] as 'gold' | 'silver' | 'bronze';
      // 找出所有已记录模式中，与目标阈值差距最小的模式
      let best = 0;
      let target = 0;
      for (const kind of ENDLESS_KINDS) {
        const t = progress.endlessBestTime[kind] ?? 0;
        if (t <= 0) continue;
        const th = SPEED_THRESHOLDS[kind][tier];
        if (best === 0 || t < best) {
          best = t;
          target = th;
        }
      }
      if (best > 0) return { current: Math.min(best, target), target };
      return { current: 0, target: Math.min(...ENDLESS_KINDS.map((k) => SPEED_THRESHOLDS[k][tier])) };
    }

    case 'steps_gold':
    case 'steps_silver':
    case 'steps_bronze': {
      const tier = def.id.split('_')[1] as 'gold' | 'silver' | 'bronze';
      let best = 0;
      let target = 0;
      for (const kind of ENDLESS_KINDS) {
        const s = progress.endlessBestSteps[kind] ?? 0;
        if (s <= 0) continue;
        const th = STEPS_THRESHOLDS[kind][tier];
        if (best === 0 || s < best) {
          best = s;
          target = th;
        }
      }
      if (best > 0) return { current: Math.min(best, target), target };
      return { current: 0, target: Math.min(...ENDLESS_KINDS.map((k) => STEPS_THRESHOLDS[k][tier])) };
    }

    default:
      return null;
  }
}