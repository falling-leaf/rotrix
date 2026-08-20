/**
 * v0.8.3：成就页面——展示所有成就的金银铜奖杯进度。
 * 固定 375×667 画布，与其余页面风格一致。
 */
import { useMemo } from 'react';
import { getAllAchievements, getUnlockedIds, groupByCategory, sortByTier, getAchievementProgress, TIER_LABEL, TIER_CLASS, type AchievementDef, type AchievementEntry, type AchievementProgress } from '../core/achievements';

interface AchievementScreenProps {
  entries: AchievementEntry[];
  progress: AchievementProgress;
  onBack: () => void;
}

/** 单个成就卡片——含进度条 */
function AchievementCard({
  def,
  unlocked,
  progress,
}: {
  def: AchievementDef;
  unlocked: boolean;
  progress: AchievementProgress;
}) {
  const achProgress = useMemo(() => getAchievementProgress(def, progress), [def, progress]);

  return (
    <div className={`ach-card ${TIER_CLASS[def.tier]} ${unlocked ? 'ach-unlocked' : 'ach-locked'}`}>
      <div className="ach-card-trophy">
        {def.tier === 'gold' ? '🏆' : def.tier === 'silver' ? '🥈' : '🥉'}
      </div>
      <div className="ach-card-body">
        <div className="ach-card-header">
          <span className="ach-card-name">{def.name}</span>
          <span className={`ach-card-tier ach-tier-${def.tier}`}>
            {TIER_LABEL[def.tier]}
          </span>
        </div>
        <div className="ach-card-desc">{def.description}</div>
        {achProgress && (
          <div className="ach-card-progress-wrap">
            <div className="ach-card-progress-bar">
              <div
                className="ach-card-progress-fill"
                style={{ width: `${(achProgress.current / achProgress.target) * 100}%` }}
              />
            </div>
            <span className="ach-card-progress-text">
              {achProgress.current}/{achProgress.target}
            </span>
          </div>
        )}
      </div>
      <div className="ach-card-status">
        {unlocked ? '✓' : '?'}
      </div>
    </div>
  );
}

/** 分类分组渲染 */
function CategoryGroup({
  category,
  defs,
  unlockedIds,
  progress,
}: {
  category: string;
  defs: AchievementDef[];
  unlockedIds: Set<string>;
  progress: AchievementProgress;
}) {
  const sorted = useMemo(() => sortByTier(defs), [defs]);
  const unlockedCount = sorted.filter((d) => unlockedIds.has(d.id)).length;
  const total = sorted.length;

  return (
    <div className="ach-category">
      <div className="ach-category-header">
        <span className="ach-category-name">{category}</span>
        <span className="ach-category-count">{unlockedCount}/{total}</span>
      </div>
      <div className="ach-category-list">
        {sorted.map((def) => (
          <AchievementCard
            key={def.id}
            def={def}
            unlocked={unlockedIds.has(def.id)}
            progress={progress}
          />
        ))}
      </div>
    </div>
  );
}

export function AchievementScreen({ entries, progress, onBack }: AchievementScreenProps) {
  const unlockedIds = useMemo(() => getUnlockedIds(entries), [entries]);
  const groups = useMemo(() => groupByCategory(), []);
  const totalUnlocked = unlockedIds.size;
  const totalAchievements = getAllAchievements().length;

  // 按等级统计
  const allDefs = getAllAchievements();
  const goldUnlocked = allDefs.filter((d) => d.tier === 'gold' && unlockedIds.has(d.id)).length;
  const silverUnlocked = allDefs.filter((d) => d.tier === 'silver' && unlockedIds.has(d.id)).length;
  const bronzeUnlocked = allDefs.filter((d) => d.tier === 'bronze' && unlockedIds.has(d.id)).length;
  const goldTotal = allDefs.filter((d) => d.tier === 'gold').length;
  const silverTotal = allDefs.filter((d) => d.tier === 'silver').length;
  const bronzeTotal = allDefs.filter((d) => d.tier === 'bronze').length;

  return (
    <div className="level-select-v6">
      <div className="start-canvas">
        {/* 粉色背景矩形 */}
        <div className="pink-bg" />

        {/* ===== 顶部标题牌 ===== */}
        <div className="ls-title-banner">
          <div className="ls-title-layer1">
            <div className="ls-title-layer2">
              <div className="ls-title-layer3">
                <div className="ls-title-fill">
                  <span className="ls-title-text">成就</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== 返回按钮 + 统计数据（同一行，固定在标题下方） ===== */}
        <div className="ach-header-row">
          <div className="ach-back-section">
            <div className="ach-back-btn" onClick={onBack}>
              <div className="ach-back-outer">
                <div className="ach-back-inner">
                  <svg className="ach-back-arrow" viewBox="0 0 21 21" fill="none">
                    <path d="M 0 10.5 L 21 0 L 21 21 Z" fill="#A900D0" opacity="0.25" transform="translate(1, 1)" />
                    <path d="M 0 10.5 L 21 0 L 21 21 Z" fill="white" />
                  </svg>
                  <span className="ach-back-text">返回</span>
                </div>
              </div>
            </div>
          </div>
          <div className="ach-stats-section">
            <span className="ach-stat-item ach-stat-gold">🏆 {goldUnlocked}/{goldTotal}</span>
            <span className="ach-stat-item ach-stat-silver">🥈 {silverUnlocked}/{silverTotal}</span>
            <span className="ach-stat-item ach-stat-bronze">🥉 {bronzeUnlocked}/{bronzeTotal}</span>
          </div>
        </div>

        {/* ===== 总进度横幅 ===== */}
        <div className="ach-summary-banner">
          <span className="ach-summary-text">
            已解锁 {totalUnlocked}/{totalAchievements}
          </span>
          <div className="ach-summary-bar">
            <div
              className="ach-summary-fill"
              style={{ width: `${totalAchievements > 0 ? (totalUnlocked / totalAchievements) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* ===== 成就列表 ===== */}
        <div className="ach-scroll-area">
          {Object.entries(groups).map(([category, defs]) => (
            <CategoryGroup
              key={category}
              category={category}
              defs={defs}
              unlockedIds={unlockedIds}
              progress={progress}
            />
          ))}
        </div>
      </div>
    </div>
  );
}