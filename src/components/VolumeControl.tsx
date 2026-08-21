/**
 * v0.9.0：音量调节弹窗组件
 * 调节音乐音量、音效音量、一键静音
 */
import { memo } from 'react';
import type { AudioSettings } from '../hooks/useAudio';

interface VolumeControlProps {
  visible: boolean;
  settings: AudioSettings;
  onClose: () => void;
  onMusicVolumeChange: (v: number) => void;
  onSfxVolumeChange: (v: number) => void;
  onToggleMute: () => void;
}

function VolumeControlInner({
  visible,
  settings,
  onClose,
  onMusicVolumeChange,
  onSfxVolumeChange,
  onToggleMute,
}: VolumeControlProps) {
  if (!visible) return null;

  return (
    <div className="win-overlay" onClick={onClose}>
      <div className="volume-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="volume-title">音量设置</h2>

        <div className="volume-row">
          <span className="volume-label">🎵 音乐</span>
          <input
            type="range"
            className="volume-slider"
            min="0"
            max="1"
            step="0.05"
            value={settings.musicVolume}
            onChange={(e) => onMusicVolumeChange(parseFloat(e.target.value))}
            disabled={settings.muted}
          />
          <span className="volume-value">{Math.round(settings.musicVolume * 100)}%</span>
        </div>

        <div className="volume-row">
          <span className="volume-label">🔊 音效</span>
          <input
            type="range"
            className="volume-slider"
            min="0"
            max="1"
            step="0.05"
            value={settings.sfxVolume}
            onChange={(e) => onSfxVolumeChange(parseFloat(e.target.value))}
            disabled={settings.muted}
          />
          <span className="volume-value">{Math.round(settings.sfxVolume * 100)}%</span>
        </div>

        <div className="volume-row">
          <span className="volume-label">🔇 静音</span>
          <label className="volume-toggle">
            <input
              type="checkbox"
              checked={settings.muted}
              onChange={onToggleMute}
            />
            <span className="volume-toggle-slider" />
          </label>
        </div>

        <button className="btn primary volume-close-btn" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  );
}

export const VolumeControl = memo(VolumeControlInner);