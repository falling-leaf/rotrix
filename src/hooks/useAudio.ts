/**
 * v0.9.0：音频管理 hook
 * - BGM 循环播放，全局单例
 * - 音效单次播放
 * - 音量设置持久化到 localStorage
 * - 音乐音量默认 0.3（明显小于音效的 0.8）
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const LS_KEY = 'rotrix:audio';

export interface AudioSettings {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}

const DEFAULT: AudioSettings = {
  musicVolume: 0.3,
  sfxVolume: 0.8,
  muted: false,
};

function loadSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT };
}

function saveSettings(s: AudioSettings) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

/** 创建或复用 BGM Audio 元素 */
function getBgm(): HTMLAudioElement {
  let el = document.getElementById('bgm-audio') as HTMLAudioElement | null;
  if (!el) {
    el = new Audio('/audio/BGM.mp3');
    el.id = 'bgm-audio';
    el.loop = true;
    el.preload = 'auto';
    document.body.appendChild(el);
  }
  return el;
}

export function useAudio() {
  const [settings, setSettings] = useState<AudioSettings>(loadSettings);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const startedRef = useRef(false);

  // 初始化 BGM
  useEffect(() => {
    const bgm = getBgm();
    bgmRef.current = bgm;
    bgm.volume = settings.muted ? 0 : settings.musicVolume;
    bgm.muted = false;
    // 自动播放策略：需要用户交互后才能播放
    // 首次立即尝试播放（可能被浏览器拦截）
    // 被拦截后：利用 HTMLMediaElement.muted 属性，浏览器允许静音自动播放
    const tryPlay = () => {
      if (!startedRef.current && !settings.muted) {
        bgm.play().then(() => {
          startedRef.current = true;
        }).catch(() => {
          // 浏览器拦截——先静音播放激活音频，再取消静音
          bgm.muted = true;
          bgm.play().then(() => {
            bgm.muted = false;
            startedRef.current = true;
          }).catch(() => {
            // 仍然被拦截，恢复 muted 状态，等待用户交互
            bgm.muted = false;
          });
        });
      }
    };
    // 立即尝试
    tryPlay();
    // 监听首次用户交互（不设 once，确保每次点击都尝试直到成功）
    const onInteraction = () => { tryPlay(); };
    document.addEventListener('click', onInteraction);
    document.addEventListener('touchstart', onInteraction);
    return () => {
      document.removeEventListener('click', onInteraction);
      document.removeEventListener('touchstart', onInteraction);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 音量变化时同步到 BGM 和 localStorage
  useEffect(() => {
    saveSettings(settings);
    if (bgmRef.current) {
      bgmRef.current.volume = settings.muted ? 0 : settings.musicVolume;
      bgmRef.current.muted = false;
      if (settings.muted) {
        bgmRef.current.pause();
        startedRef.current = false;
      } else if (!startedRef.current) {
        // 仅在音频完全未播放时尝试（避免与 1st effect 的异步静音播放冲突）
        if (bgmRef.current.paused) {
          bgmRef.current.play().then(() => {
            startedRef.current = true;
          }).catch(() => {});
        }
      }
    }
  }, [settings]);

  const setMusicVolume = useCallback((v: number) => {
    setSettings((s) => ({ ...s, musicVolume: v }));
  }, []);

  const setSfxVolume = useCallback((v: number) => {
    setSettings((s) => ({ ...s, sfxVolume: v }));
  }, []);

  const toggleMute = useCallback(() => {
    setSettings((s) => ({ ...s, muted: !s.muted }));
  }, []);

  const playSfx = useCallback((name: 'complete' | 'finish' | 'tutorial') => {
    if (settings.muted) return;
    const filename = name === 'tutorial' ? '菲比啾比.wav' : `${name}.mp3`;
    const audio = new Audio(`/audio/${filename}`);
    audio.volume = settings.sfxVolume;
    audio.play().catch(() => {});
  }, [settings.muted, settings.sfxVolume]);

  return {
    settings,
    setMusicVolume,
    setSfxVolume,
    toggleMute,
    playSfx,
  };
}