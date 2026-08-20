/**
 * v0.8.3：成就系统测试
 * v0.8.4：无尽极速重构——合并为 6 个成就（3 时间金银铜 + 3 步数金银铜）
 *
 * 覆盖：成就定义完整性、检查函数、进度计算、分组/排序工具函数。
 */
import { describe, it, expect } from 'vitest';
import {
  getAllAchievements,
  getUnlockedIds,
  checkAchievements,
  groupByCategory,
  sortByTier,
  computeProgress,
  getAchievementProgress,
  getReward,
  ACHIEVEMENT_DEFS,
  ENDLESS_KINDS,
  type AchievementEntry,
  type AchievementProgress,
} from '../src/core/achievements';

describe('AchievementDef - 成就定义完整性', () => {
  it('所有成就定义有唯一 id', () => {
    const ids = ACHIEVEMENT_DEFS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('所有成就定义有 name、description、tier、category', () => {
    for (const def of ACHIEVEMENT_DEFS) {
      expect(def.name).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(['bronze', 'silver', 'gold']).toContain(def.tier);
      expect(def.category).toBeTruthy();
      expect(typeof def.check).toBe('function');
    }
  });

  it('每个分类至少有一个成就', () => {
    const categories = new Set(ACHIEVEMENT_DEFS.map((d) => d.category));
    expect(categories.size).toBeGreaterThanOrEqual(1);
    for (const cat of categories) {
      expect(ACHIEVEMENT_DEFS.filter((d) => d.category === cat).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('至少有一个金、银、铜成就', () => {
    expect(ACHIEVEMENT_DEFS.filter((d) => d.tier === 'gold').length).toBeGreaterThanOrEqual(1);
    expect(ACHIEVEMENT_DEFS.filter((d) => d.tier === 'silver').length).toBeGreaterThanOrEqual(1);
    expect(ACHIEVEMENT_DEFS.filter((d) => d.tier === 'bronze').length).toBeGreaterThanOrEqual(1);
  });

  it('无尽极速分类有 6 个成就（3 时间 + 3 步数金银铜）', () => {
    const speedDefs = ACHIEVEMENT_DEFS.filter((d) => d.category === '无尽极速');
    expect(speedDefs.length).toBe(6);
    const speedIds = speedDefs.map((d) => d.id).sort();
    expect(speedIds).toEqual([
      'speed_bronze', 'speed_gold', 'speed_silver',
      'steps_bronze', 'steps_gold', 'steps_silver',
    ]);
  });

  it('所有无尽极速成就的描述包含所有模式的阈值', () => {
    const speedDefs = ACHIEVEMENT_DEFS.filter((d) => d.category === '无尽极速');
    for (const def of speedDefs) {
      for (const kind of ENDLESS_KINDS) {
        // 每个模式应出现在描述中（如"4×4≤8s"）
        expect(def.description).toContain(kind === '4x4' ? '4×4' : kind === '6x6' ? '6×6' : kind === 'hex-small' ? '小三角' : '大三角');
      }
    }
  });
});

describe('getUnlockedIds - 已解锁 ID 集合', () => {
  it('空列表返回空集合', () => {
    expect(getUnlockedIds([])).toEqual(new Set());
  });

  it('只返回已解锁的', () => {
    const entries: AchievementEntry[] = [
      { id: 'a', unlocked: true, unlockedAt: 100 },
      { id: 'b', unlocked: false, unlockedAt: 0 },
    ];
    expect(getUnlockedIds(entries)).toEqual(new Set(['a']));
  });
});

describe('checkAchievements - 成就检查', () => {
  const emptyProgress: AchievementProgress = {
    campaignCompleted: [],
    campaignStars: {},
    campaignTotalLevels: 0,
    endlessTotalCleared: 0,
    endlessClearedByKind: {},
    endlessBestTime: {},
    endlessBestSteps: {},
    totalSwapsUsed: 0,
    threeStarCount: 0,
    totalStars: 0,
    tutorialCompleted: false,
    allCampaignCleared: false,
    allThreeStar: false,
  };

  it('没有任何进度时不解锁任何成就', () => {
    const result = checkAchievements([], emptyProgress);
    expect(result).toHaveLength(0);
  });

  it('通关第 1 关解锁"初出茅庐"', () => {
    const progress: AchievementProgress = {
      ...emptyProgress,
      campaignCompleted: [1],
      campaignTotalLevels: 1,
    };
    const result = checkAchievements([], progress);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('first_clear');
  });

  it('全部过关已解锁则不解锁"初出茅庐"', () => {
    const entries: AchievementEntry[] = [
      { id: 'first_clear', unlocked: true, unlockedAt: 100 },
    ];
    const progress: AchievementProgress = {
      ...emptyProgress,
      campaignCompleted: [1],
      campaignTotalLevels: 1,
    };
    const result = checkAchievements(entries, progress);
    expect(result).toHaveLength(0);
  });

  it('通关 10 关解锁"渐入佳境"', () => {
    const progress: AchievementProgress = {
      ...emptyProgress,
      campaignCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      campaignTotalLevels: 10,
    };
    const result = checkAchievements([], progress);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('clear_10');
  });

  it('通关 9 关不解锁"渐入佳境"', () => {
    const progress: AchievementProgress = {
      ...emptyProgress,
      campaignCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      campaignTotalLevels: 10,
    };
    const result = checkAchievements([], progress);
    const ids = result.map((r) => r.id);
    expect(ids).not.toContain('clear_10');
  });

  it('allCampaignCleared=true 解锁"常胜将军"', () => {
    const progress: AchievementProgress = {
      ...emptyProgress,
      allCampaignCleared: true,
    };
    const result = checkAchievements([], progress);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('clear_all');
  });

  it('无尽模式累计 10 次解锁"小试牛刀"', () => {
    const progress: AchievementProgress = {
      ...emptyProgress,
      endlessTotalCleared: 10,
    };
    const result = checkAchievements([], progress);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('endless_10');
  });

  it('无尽模式累计 50 次解锁"乐此不疲"', () => {
    const progress: AchievementProgress = {
      ...emptyProgress,
      endlessTotalCleared: 50,
    };
    const result = checkAchievements([], progress);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('endless_50');
  });

  it('无尽模式累计 100 次解锁"生生不息"', () => {
    const progress: AchievementProgress = {
      ...emptyProgress,
      endlessTotalCleared: 100,
    };
    const result = checkAchievements([], progress);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('endless_100');
  });

  it('4x4 无尽通关 10 次解锁"矩阵达人"', () => {
    const progress: AchievementProgress = {
      ...emptyProgress,
      endlessClearedByKind: { '4x4': 10 },
    };
    const result = checkAchievements([], progress);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('endless_4x4_10');
  });

  it('6x6 无尽通关 10 次解锁"矩阵大师"', () => {
    const progress: AchievementProgress = {
      ...emptyProgress,
      endlessClearedByKind: { '6x6': 10 },
    };
    const result = checkAchievements([], progress);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('endless_6x6_10');
  });

  it('小型三角无尽通关 10 次解锁"三角高手"', () => {
    const progress: AchievementProgress = {
      ...emptyProgress,
      endlessClearedByKind: { 'hex-small': 10 },
    };
    const result = checkAchievements([], progress);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('endless_hex_small_10');
  });

  it('大型三角无尽通关 10 次解锁"三角至尊"', () => {
    const progress: AchievementProgress = {
      ...emptyProgress,
      endlessClearedByKind: { 'hex-triangle': 10 },
    };
    const result = checkAchievements([], progress);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('endless_hex_tri_10');
  });

  // ===== 无尽极速——合并金银铜，任意模式满足阈值即可 =====

  describe('无尽极速 - 时间成就', () => {
    it('4×4 最短时间 ≤ 8 秒解锁金牌（电光石火）', () => {
      const progress: AchievementProgress = {
        ...emptyProgress,
        endlessBestTime: { '4x4': 8 },
      };
      const result = checkAchievements([], progress);
      expect(result.map((r) => r.id)).toContain('speed_gold');
    });

    it('4×4 最短时间 ≤ 15 秒解锁银牌（风驰电掣）', () => {
      const progress: AchievementProgress = {
        ...emptyProgress,
        endlessBestTime: { '4x4': 12 },
      };
      const result = checkAchievements([], progress);
      expect(result.map((r) => r.id)).toContain('speed_silver');
    });

    it('4×4 最短时间 ≤ 30 秒解锁铜牌（初露锋芒）', () => {
      const progress: AchievementProgress = {
        ...emptyProgress,
        endlessBestTime: { '4x4': 25 },
      };
      const result = checkAchievements([], progress);
      expect(result.map((r) => r.id)).toContain('speed_bronze');
    });

    it('6×6 最短时间 ≤ 15 秒解锁金牌', () => {
      const progress: AchievementProgress = {
        ...emptyProgress,
        endlessBestTime: { '6x6': 15 },
      };
      const result = checkAchievements([], progress);
      expect(result.map((r) => r.id)).toContain('speed_gold');
    });

    it('6×6 最短时间 ≤ 30 秒解锁银牌', () => {
      const progress: AchievementProgress = {
        ...emptyProgress,
        endlessBestTime: { '6x6': 30 },
      };
      const result = checkAchievements([], progress);
      expect(result.map((r) => r.id)).toContain('speed_silver');
    });

    it('6×6 最短时间 ≤ 60 秒解锁铜牌', () => {
      const progress: AchievementProgress = {
        ...emptyProgress,
        endlessBestTime: { '6x6': 60 },
      };
      const result = checkAchievements([], progress);
      expect(result.map((r) => r.id)).toContain('speed_bronze');
    });

    it('hex-small 最短时间 ≤ 10 秒解锁金牌', () => {
      const progress: AchievementProgress = {
        ...emptyProgress,
        endlessBestTime: { 'hex-small': 10 },
      };
      const result = checkAchievements([], progress);
      expect(result.map((r) => r.id)).toContain('speed_gold');
    });

    it('hex-triangle 最短时间 ≤ 25 秒解锁金牌', () => {
      const progress: AchievementProgress = {
        ...emptyProgress,
        endlessBestTime: { 'hex-triangle': 25 },
      };
      const result = checkAchievements([], progress);
      expect(result.map((r) => r.id)).toContain('speed_gold');
    });

    it('hex-triangle 最短时间 ≤ 45 秒解锁银牌', () => {
      const progress: AchievementProgress = {
        ...emptyProgress,
        endlessBestTime: { 'hex-triangle': 45 },
      };
      const result = checkAchievements([], progress);
      expect(result.map((r) => r.id)).toContain('speed_silver');
    });

    it('hex-triangle 最短时间 ≤ 90 秒解锁铜牌', () => {
      const progress: AchievementProgress = {
        ...emptyProgress,
        endlessBestTime: { 'hex-triangle': 90 },
      };
      const result = checkAchievements([], progress);
      expect(result.map((r) => r.id)).toContain('speed_bronze');
    });

    it('4×4 最短时间 31 秒不解锁任何时间成就', () => {
      const progress: AchievementProgress = {
        ...emptyProgress,
        endlessBestTime: { '4x4': 31 },
      };
      const result = checkAchievements([], progress);
      expect(result.map((r) => r.id)).not.toContain('speed_gold');
      expect(result.map((r) => r.id)).not.toContain('speed_silver');
      expect(result.map((r) => r.id)).not.toContain('speed_bronze');
    });

    it('6×6 最短时间 61 秒不解锁任何时间成就', () => {
      const progress: AchievementProgress = {
        ...emptyProgress,
        endlessBestTime: { '6x6': 61 },
      };
      const result = checkAchievements([], progress);
      expect(result.map((r) => r.id)).not.toContain('speed_gold');
      expect(result.map((r) => r.id)).not.toContain('speed_silver');
      expect(result.map((r) => r.id)).not.toContain('speed_bronze');
    });

    it('hex-small 最短时间 46 秒不解锁任何时间成就', () => {
      const progress: AchievementProgress = {
        ...emptyProgress,
        endlessBestTime: { 'hex-small': 46 },
      };
      const result = checkAchievements([], progress);
      expect(result.map((r) => r.id)).not.toContain('speed_gold');
      expect(result.map((r) => r.id)).not.toContain('speed_silver');
      expect(result.map((r) => r.id)).not.toContain('speed_bronze');
    });

    it('hex-triangle 最短时间 91 秒不解锁任何时间成就', () => {
      const progress: AchievementProgress = {
        ...emptyProgress,
        endlessBestTime: { 'hex-triangle': 91 },
      };
      const result = checkAchievements([], progress);
      expect(result.map((r) => r.id)).not.toContain('speed_gold');
      expect(result.map((r) => r.id)).not.toContain('speed_silver');
      expect(result.map((r) => r.id)).not.toContain('speed_bronze');
    });
  });

  describe('无尽极速 - 步数成就', () => {
    it('4×4 最少步数 ≤ 3 步解锁金牌（妙手回春）', () => {
      const progress: AchievementProgress = {
        ...emptyProgress,
        endlessBestSteps: { '4x4': 3 },
      };
      const result = checkAchievements([], progress);
      expect(result.map((r) => r.id)).toContain('steps_gold');
    });

    it('4×4 最少步数 ≤ 6 步解锁银牌（举重若轻）', () => {
      const progress: AchievementProgress = {
        ...emptyProgress,
        endlessBestSteps: { '4x4': 5 },
      };
      const result = checkAchievements([], progress);
      expect(result.map((r) => r.id)).toContain('steps_silver');
    });

    it('4×4 最少步数 ≤ 10 步解锁铜牌（轻车熟路）', () => {
      const progress: AchievementProgress = {
        ...emptyProgress,
        endlessBestSteps: { '4x4': 9 },
      };
      const result = checkAchievements([], progress);
      expect(result.map((r) => r.id)).toContain('steps_bronze');
    });

    it('6×6 最少步数 ≤ 6 步解锁金牌', () => {
      const progress: AchievementProgress = {
        ...emptyProgress,
        endlessBestSteps: { '6x6': 6 },
      };
      const result = checkAchievements([], progress);
      expect(result.map((r) => r.id)).toContain('steps_gold');
    });

    it('hex-small 最少步数 ≤ 4 步解锁金牌', () => {
      const progress: AchievementProgress = {
        ...emptyProgress,
        endlessBestSteps: { 'hex-small': 4 },
      };
      const result = checkAchievements([], progress);
      expect(result.map((r) => r.id)).toContain('steps_gold');
    });

    it('hex-triangle 最少步数 ≤ 8 步解锁金牌', () => {
      const progress: AchievementProgress = {
        ...emptyProgress,
        endlessBestSteps: { 'hex-triangle': 8 },
      };
      const result = checkAchievements([], progress);
      expect(result.map((r) => r.id)).toContain('steps_gold');
    });

    it('hex-triangle 最少步数 ≤ 15 步解锁银牌', () => {
      const progress: AchievementProgress = {
        ...emptyProgress,
        endlessBestSteps: { 'hex-triangle': 15 },
      };
      const result = checkAchievements([], progress);
      expect(result.map((r) => r.id)).toContain('steps_silver');
    });

    it('hex-triangle 最少步数 ≤ 30 步解锁铜牌', () => {
      const progress: AchievementProgress = {
        ...emptyProgress,
        endlessBestSteps: { 'hex-triangle': 30 },
      };
      const result = checkAchievements([], progress);
      expect(result.map((r) => r.id)).toContain('steps_bronze');
    });

    it('4×4 最少步数 11 步不解锁任何步数成就', () => {
      const progress: AchievementProgress = {
        ...emptyProgress,
        endlessBestSteps: { '4x4': 11 },
      };
      const result = checkAchievements([], progress);
      expect(result.map((r) => r.id)).not.toContain('steps_gold');
      expect(result.map((r) => r.id)).not.toContain('steps_silver');
      expect(result.map((r) => r.id)).not.toContain('steps_bronze');
    });

    it('6×6 最少步数 21 步不解锁任何步数成就', () => {
      const progress: AchievementProgress = {
        ...emptyProgress,
        endlessBestSteps: { '6x6': 21 },
      };
      const result = checkAchievements([], progress);
      expect(result.map((r) => r.id)).not.toContain('steps_gold');
      expect(result.map((r) => r.id)).not.toContain('steps_silver');
      expect(result.map((r) => r.id)).not.toContain('steps_bronze');
    });

    it('hex-small 最少步数 16 步不解锁任何步数成就', () => {
      const progress: AchievementProgress = {
        ...emptyProgress,
        endlessBestSteps: { 'hex-small': 16 },
      };
      const result = checkAchievements([], progress);
      expect(result.map((r) => r.id)).not.toContain('steps_gold');
      expect(result.map((r) => r.id)).not.toContain('steps_silver');
      expect(result.map((r) => r.id)).not.toContain('steps_bronze');
    });

    it('hex-triangle 最少步数 31 步不解锁任何步数成就', () => {
      const progress: AchievementProgress = {
        ...emptyProgress,
        endlessBestSteps: { 'hex-triangle': 31 },
      };
      const result = checkAchievements([], progress);
      expect(result.map((r) => r.id)).not.toContain('steps_gold');
      expect(result.map((r) => r.id)).not.toContain('steps_silver');
      expect(result.map((r) => r.id)).not.toContain('steps_bronze');
    });
  });

  it('bestTime=0 时不解锁任何时间成就（从未通关）', () => {
    const progress: AchievementProgress = {
      ...emptyProgress,
      endlessBestTime: { '4x4': 0 },
    };
    const result = checkAchievements([], progress);
    expect(result.map((r) => r.id)).not.toContain('speed_gold');
    expect(result.map((r) => r.id)).not.toContain('speed_silver');
    expect(result.map((r) => r.id)).not.toContain('speed_bronze');
  });

  it('bestSteps=0 时不解锁任何步数成就（从未通关）', () => {
    const progress: AchievementProgress = {
      ...emptyProgress,
      endlessBestSteps: { '4x4': 0 },
    };
    const result = checkAchievements([], progress);
    expect(result.map((r) => r.id)).not.toContain('steps_gold');
    expect(result.map((r) => r.id)).not.toContain('steps_silver');
    expect(result.map((r) => r.id)).not.toContain('steps_bronze');
  });

  it('4×4 达到金牌条件时自动同时解锁金银铜', () => {
    const progress: AchievementProgress = {
      ...emptyProgress,
      endlessBestTime: { '4x4': 5 },
    };
    const result = checkAchievements([], progress);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('speed_gold');
    expect(ids).toContain('speed_silver');
    expect(ids).toContain('speed_bronze');
  });

  it('小型三角达到金牌条件时自动同时解锁金银铜（跨模式）', () => {
    const progress: AchievementProgress = {
      ...emptyProgress,
      endlessBestTime: { 'hex-small': 8 },
    };
    const result = checkAchievements([], progress);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('speed_gold');
    expect(ids).toContain('speed_silver');
    expect(ids).toContain('speed_bronze');
  });

  it('4×4 达到银牌条件时只解锁银牌铜牌（不包含金牌）', () => {
    const progress: AchievementProgress = {
      ...emptyProgress,
      endlessBestTime: { '4x4': 10 }, // 8 < 10 ≤ 15
    };
    const result = checkAchievements([], progress);
    const ids = result.map((r) => r.id);
    expect(ids).not.toContain('speed_gold');
    expect(ids).toContain('speed_silver');
    expect(ids).toContain('speed_bronze');
  });

  it('不同模式达到不同时间阈值：4×4 银牌 + 6×6 铜牌解锁 gold/silver/bronze', () => {
    // 4×4 bestTime=10（银牌，≤15），6×6 bestTime=50（铜牌，≤60）
    // 没有模式达到金牌（4×4 需≤8，6×6 需≤15，hs 需≤10，ht 需≤25）
    const progress: AchievementProgress = {
      ...emptyProgress,
      endlessBestTime: { '4x4': 10, '6x6': 50 },
    };
    const result = checkAchievements([], progress);
    const ids = result.map((r) => r.id);
    expect(ids).not.toContain('speed_gold');
    expect(ids).toContain('speed_silver');
    expect(ids).toContain('speed_bronze');
  });

  it('不同模式达到不同步数阈值：4×4 金牌 + 6×6 铜牌解锁全部步数成就', () => {
    // 4×4 bestSteps=3（金牌，≤3），6×6 bestSteps=15（铜牌，≤20）
    const progress: AchievementProgress = {
      ...emptyProgress,
      endlessBestSteps: { '4x4': 3, '6x6': 15 },
    };
    const result = checkAchievements([], progress);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('steps_gold');
    expect(ids).toContain('steps_silver');
    expect(ids).toContain('steps_bronze');
  });

  it('对换 1 次解锁"初次尝试"', () => {
    const progress: AchievementProgress = {
      ...emptyProgress,
      totalSwapsUsed: 1,
    };
    const result = checkAchievements([], progress);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('swap_first');
  });

  it('对换 10 次解锁"惯用伎俩"', () => {
    const progress: AchievementProgress = {
      ...emptyProgress,
      totalSwapsUsed: 10,
    };
    const result = checkAchievements([], progress);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('swap_10');
  });

  it('对换 50 次解锁"乾坤大挪移"', () => {
    const progress: AchievementProgress = {
      ...emptyProgress,
      totalSwapsUsed: 50,
    };
    const result = checkAchievements([], progress);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('swap_50');
  });

  it('3 个三星解锁"三星初现"', () => {
    const progress: AchievementProgress = {
      ...emptyProgress,
      threeStarCount: 3,
    };
    const result = checkAchievements([], progress);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('three_star_3');
  });

  it('10 个三星解锁"三星收藏家"', () => {
    const progress: AchievementProgress = {
      ...emptyProgress,
      threeStarCount: 10,
    };
    const result = checkAchievements([], progress);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('three_star_10');
  });

  it('30 个三星解锁"三星大师"', () => {
    const progress: AchievementProgress = {
      ...emptyProgress,
      threeStarCount: 30,
    };
    const result = checkAchievements([], progress);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('three_star_30');
  });

  it('50 颗星解锁"星光初现"', () => {
    const progress: AchievementProgress = {
      ...emptyProgress,
      totalStars: 50,
    };
    const result = checkAchievements([], progress);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('star_50');
  });

  it('100 颗星解锁"星光璀璨"', () => {
    const progress: AchievementProgress = {
      ...emptyProgress,
      totalStars: 100,
    };
    const result = checkAchievements([], progress);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('star_100');
  });

  it('150 颗星解锁"星河闪耀"', () => {
    const progress: AchievementProgress = {
      ...emptyProgress,
      totalStars: 150,
    };
    const result = checkAchievements([], progress);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('star_150');
  });

  it('allThreeStar=true 解锁"完美通关"', () => {
    const progress: AchievementProgress = {
      ...emptyProgress,
      allThreeStar: true,
    };
    const result = checkAchievements([], progress);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('perfect_all');
  });

  it('tutorialCompleted=true 解锁"初识 Rotrix"', () => {
    const progress: AchievementProgress = {
      ...emptyProgress,
      tutorialCompleted: true,
    };
    const result = checkAchievements([], progress);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('tutorial_done');
  });

  it('一次检查可同时解锁多个成就', () => {
    const progress: AchievementProgress = {
      campaignCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      campaignStars: { '1': 3, '2': 3, '3': 3 },
      campaignTotalLevels: 10,
      endlessTotalCleared: 10,
      endlessClearedByKind: { '4x4': 10 },
      endlessBestTime: { '4x4': 5, '6x6': 25, 'hex-small': 8, 'hex-triangle': 20 },
      endlessBestSteps: { '4x4': 3, '6x6': 6, 'hex-small': 4, 'hex-triangle': 8 },
      totalSwapsUsed: 1,
      threeStarCount: 3,
      totalStars: 50,
      tutorialCompleted: true,
      allCampaignCleared: false,
      allThreeStar: false,
    };
    const result = checkAchievements([], progress);
    // 闯关模式
    expect(result.map((r) => r.id)).toContain('first_clear');
    expect(result.map((r) => r.id)).toContain('clear_10');
    // 无尽模式
    expect(result.map((r) => r.id)).toContain('endless_10');
    expect(result.map((r) => r.id)).toContain('endless_4x4_10');
    // 无尽极速——全部模式达到金牌阈值，金银铜全解锁
    expect(result.map((r) => r.id)).toContain('speed_gold');
    expect(result.map((r) => r.id)).toContain('speed_silver');
    expect(result.map((r) => r.id)).toContain('speed_bronze');
    expect(result.map((r) => r.id)).toContain('steps_gold');
    expect(result.map((r) => r.id)).toContain('steps_silver');
    expect(result.map((r) => r.id)).toContain('steps_bronze');
    // 对换道具
    expect(result.map((r) => r.id)).toContain('swap_first');
    // 三星挑战
    expect(result.map((r) => r.id)).toContain('three_star_3');
    // 星星总数
    expect(result.map((r) => r.id)).toContain('star_50');
    // 其他
    expect(result.map((r) => r.id)).toContain('tutorial_done');
  });
});

describe('computeProgress - 进度计算', () => {
  it('计算 threeStarCount 和 totalStars', () => {
    const completed = new Set([1, 2, 3]);
    const stars: Record<number, number> = { 1: 3, 2: 2, 3: 3 };
    const progress = computeProgress(completed, stars, 3, 0, {}, {}, {}, 0, false);
    expect(progress.threeStarCount).toBe(2); // 关卡 1 和 3
    expect(progress.totalStars).toBe(8); // 3+2+3
    expect(progress.allCampaignCleared).toBe(true);
    expect(progress.allThreeStar).toBe(false);
  });

  it('allCampaignCleared 判断', () => {
    const completed = new Set([1, 2, 3]);
    const progress = computeProgress(completed, {}, 3, 0, {}, {}, {}, 0, false);
    expect(progress.allCampaignCleared).toBe(true);
  });

  it('allCampaignCleared=false 未通关全部', () => {
    const completed = new Set([1, 2]);
    const progress = computeProgress(completed, {}, 3, 0, {}, {}, {}, 0, false);
    expect(progress.allCampaignCleared).toBe(false);
  });

  it('allThreeStar 判断', () => {
    const completed = new Set([1, 2, 3]);
    const stars: Record<number, number> = { 1: 3, 2: 3, 3: 3 };
    const progress = computeProgress(completed, stars, 3, 0, {}, {}, {}, 0, false);
    expect(progress.allThreeStar).toBe(true);
  });

  it('totalLevels=0 时 allThreeStar=false', () => {
    const progress = computeProgress(new Set(), {}, 0, 0, {}, {}, {}, 0, false);
    expect(progress.allThreeStar).toBe(false);
    expect(progress.allCampaignCleared).toBe(false);
  });
});

describe('groupByCategory - 分类分组', () => {
  it('按分类正确分组', () => {
    const groups = groupByCategory();
    const expectedCategories = ['闯关模式', '无尽模式', '无尽极速', '对换道具', '三星挑战', '星星总数', '其他'];
    for (const cat of expectedCategories) {
      expect(groups[cat]).toBeDefined();
      expect(groups[cat].length).toBeGreaterThanOrEqual(1);
    }
  });

  it('无尽极速分类有 6 个成就', () => {
    const groups = groupByCategory();
    expect(groups['无尽极速'].length).toBe(6);
  });
});

describe('sortByTier - 按等级排序', () => {
  it('金排前、银居中、铜排后', () => {
    const defs = getAllAchievements();
    const categoryDefs = defs.filter((d) => d.category === '闯关模式');
    const sortedCat = sortByTier(categoryDefs);
    const tiers = sortedCat.map((d) => d.tier);
    const firstGold = tiers.indexOf('gold');
    const firstSilver = tiers.indexOf('silver');
    const firstBronze = tiers.indexOf('bronze');
    expect(firstGold).toBeLessThan(firstSilver);
    expect(firstSilver).toBeLessThan(firstBronze);
  });
});

describe('getAchievementProgress - 无尽极速进度', () => {
  const emptyProgress: AchievementProgress = {
    campaignCompleted: [],
    campaignStars: {},
    campaignTotalLevels: 0,
    endlessTotalCleared: 0,
    endlessClearedByKind: {},
    endlessBestTime: {},
    endlessBestSteps: {},
    totalSwapsUsed: 0,
    threeStarCount: 0,
    totalStars: 0,
    tutorialCompleted: false,
    allCampaignCleared: false,
    allThreeStar: false,
  };

  it('时间金牌显示最佳模式的时间 vs 该模式阈值', () => {
    const def = ACHIEVEMENT_DEFS.find((d) => d.id === 'speed_gold')!;
    const progress: AchievementProgress = {
      ...emptyProgress,
      endlessBestTime: { '4x4': 5, '6x6': 40 },
    };
    const result = getAchievementProgress(def, progress);
    // 最佳模式是 4×4（5s < 40s），4×4 金牌阈值为 8s
    expect(result).toEqual({ current: 5, target: 8 });
  });

  it('时间铜牌显示最佳模式的时间 vs 该模式阈值', () => {
    const def = ACHIEVEMENT_DEFS.find((d) => d.id === 'speed_bronze')!;
    const progress: AchievementProgress = {
      ...emptyProgress,
      endlessBestTime: { '4x4': 25, '6x6': 50 },
    };
    const result = getAchievementProgress(def, progress);
    // 最佳模式是 4×4（25s < 50s），4×4 铜牌阈值为 30s
    expect(result).toEqual({ current: 25, target: 30 });
  });

  it('步数金牌显示最佳模式的步数 vs 该模式阈值', () => {
    const def = ACHIEVEMENT_DEFS.find((d) => d.id === 'steps_gold')!;
    const progress: AchievementProgress = {
      ...emptyProgress,
      endlessBestSteps: { '6x6': 6, 'hex-triangle': 12 },
    };
    const result = getAchievementProgress(def, progress);
    // 最佳模式是 6×6（6步 < 12步），6×6 金牌阈值为 6步
    expect(result).toEqual({ current: 6, target: 6 });
  });

  it('从未通关时进度为 0/最小目标值', () => {
    const def = ACHIEVEMENT_DEFS.find((d) => d.id === 'speed_gold')!;
    const result = getAchievementProgress(def, emptyProgress);
    // 金牌时间最小阈值是 min(8, 15, 10, 25) = 8
    expect(result).toEqual({ current: 0, target: 8 });
  });
});

describe('getReward - 金币奖励', () => {
  it('金奖励 150 金币', () => {
    expect(getReward('gold')).toBe(150);
  });

  it('银奖励 100 金币', () => {
    expect(getReward('silver')).toBe(100);
  });

  it('铜奖励 50 金币', () => {
    expect(getReward('bronze')).toBe(50);
  });
});