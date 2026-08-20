/**
 * v0.8.3：成就达成提示弹窗组件。
 *
 * 在屏幕底部偏上位置显示，自动 3 秒后消失，
 * z-index 置于最顶层（高于所有暗化遮罩）。
 */
import { useEffect, useState } from 'react';
import { getAllAchievements, TIER_LABEL, TIER_CLASS, getReward, type AchievementDef } from '../core/achievements';

interface AchievementToastProps {
  /** 新解锁的成就 ID 列表 */
  newIds: string[];
  /** 清除通知回调 */
  onDismiss: () => void;
}

/** 单条成就提示 */
function ToastItem({ def, onDone }: { def: AchievementDef; onDone: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 300); // 等待淡出动画
    }, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className={`ach-toast-item ${TIER_CLASS[def.tier]} ${visible ? 'ach-toast-enter' : 'ach-toast-exit'}`}>
      <span className="ach-toast-icon">
        {def.tier === 'gold' ? '🏆' : def.tier === 'silver' ? '🥈' : '🥉'}
      </span>
      <div className="ach-toast-body">
        <div className="ach-toast-title">
          成就达成！
          <span className={`ach-toast-tier ach-tier-${def.tier}`}>{TIER_LABEL[def.tier]}</span>
        </div>
        <div className="ach-toast-name">{def.name}</div>
        <div className="ach-toast-desc">{def.description}</div>
        <div className="ach-toast-reward">+{getReward(def.tier)} 金币</div>
      </div>
    </div>
  );
}

export function AchievementToast({ newIds, onDismiss }: AchievementToastProps) {
  const allDefs = getAllAchievements();
  const defMap = new Map(allDefs.map((d) => [d.id, d]));

  // 当 newIds 变化时，如果有新成就，展示
  if (newIds.length === 0) return null;

  return (
    <div className="ach-toast-container">
      {newIds.map((id) => {
        const def = defMap.get(id);
        if (!def) return null;
        return (
          <ToastItem
            key={id}
            def={def}
            onDone={() => {
              // 所有项都消失后通知父组件清除
              // 由父组件管理生命周期
            }}
          />
        );
      })}
      {/* 自动清除——最后一个 ToastItem 的 onDone 触发后，父组件调用 onDismiss */}
      <AutoDismissTrigger count={newIds.length} onDismiss={onDismiss} />
    </div>
  );
}

/** 在最后一个成就通知消失后触发 onDismiss */
function AutoDismissTrigger({ count, onDismiss }: { count: number; onDismiss: () => void }) {
  useEffect(() => {
    // 每个 toast 显示 3s，全部显示完再加 300ms 淡出
    const totalDelay = count * 3000 + 300;
    const timer = setTimeout(onDismiss, totalDelay);
    return () => clearTimeout(timer);
  }, [count, onDismiss]);
  return null;
}