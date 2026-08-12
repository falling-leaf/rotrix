import { isLevelUnlocked } from '../hooks/useProgress';

interface LevelSelectScreenProps {
  /** 已通关的关卡 id 集合 */
  completed: Set<number>;
  /** 选择关卡 */
  onSelect: (levelId: number) => void;
  /** 返回主菜单 */
  onBack: () => void;
}

/** 关卡显示顺序：1-40, 50（第 0 关教程不在此列表，由弹窗触发） */
const DISPLAY_IDS = [
  ...Array.from({ length: 40 }, (_, i) => i + 1), // 1-40
  50,
];

/**
 * v0.5.0：关卡选择界面。
 * 50 个关卡格子（含第 0 关新手教程），逐关解锁。
 * 已通关显示绿色对勾，未解锁显示锁图标。
 */
export function LevelSelectScreen({ completed, onSelect, onBack }: LevelSelectScreenProps) {
  return (
    <div className="app level-select-app">
      <div className="level-select-header">
        <button className="btn back-btn" onClick={onBack}>
          ← 返回
        </button>
        <h1 className="app-title">ROTRIX</h1>
        <p className="app-subtitle">选择关卡</p>
      </div>

      <div className="level-grid">
        {DISPLAY_IDS.map((id) => {
          const unlocked = isLevelUnlocked(id, completed);
          const cleared = completed.has(id);
          return (
            <button
              key={id}
              className={`level-cell ${unlocked ? 'unlocked' : 'locked'} ${cleared ? 'cleared' : ''}`}
              onClick={() => unlocked && onSelect(id)}
              disabled={!unlocked}
            >
              {unlocked ? (
                <>
                  <span className="level-cell-num">{id}</span>
                  {cleared && <span className="level-cell-check">✓</span>}
                </>
              ) : (
                <span className="level-cell-lock">🔒</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
