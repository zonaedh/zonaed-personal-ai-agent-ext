/**
 * Auto-Lock Security Engine for Zonaed AI.
 * Automatically locks the workspace after 10 minutes of inactivity
 * and prompts for the Master PIN.
 */

import { useSettingsStore } from '@/store/settings-store';
import { useChatStore } from '@/store/chat-store';
import { useEffect, useRef } from 'react';

/** 10 minutes in milliseconds */
export const AUTO_LOCK_INACTIVITY_MS = 10 * 60 * 1000;

const STORAGE_KEY = 'zonaed_ai_last_activity_ts';

let inMemoryLastActivity = Date.now();

/**
 * Record user activity (keystroke, mouse movement, touch, click, scroll).
 */
export function recordUserActivity(): void {
  inMemoryLastActivity = Date.now();
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY, inMemoryLastActivity.toString());
    }
  } catch {
    // sessionStorage might fail in restricted iframe/sandbox
  }
}

/**
 * Retrieve the last recorded activity timestamp.
 */
export function getLastUserActivity(): number {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed > 0) {
          inMemoryLastActivity = Math.max(inMemoryLastActivity, parsed);
        }
      }
    }
  } catch {
    // ignore
  }
  return inMemoryLastActivity;
}

/**
 * Check if inactivity threshold has elapsed and lock the app if necessary.
 * Returns true if the app was locked.
 */
export function checkAutoLock(): boolean {
  const { isLocked, pinLockEnabled, lock } = useSettingsStore.getState();

  // If already locked or PIN lock is disabled, nothing to do
  if (isLocked || !pinLockEnabled) {
    return false;
  }

  // Do not lock out while an AI streaming generation is in progress
  if (useChatStore.getState().isGenerating) {
    recordUserActivity();
    return false;
  }

  const lastActivity = getLastUserActivity();
  const elapsed = Date.now() - lastActivity;

  if (elapsed >= AUTO_LOCK_INACTIVITY_MS) {
    console.warn(`[Security] Inactivity timeout reached (${Math.round(elapsed / 1000)}s). Auto-locking workspace.`);
    lock();
    return true;
  }

  return false;
}

/**
 * React hook to attach global user activity listeners and periodic auto-lock timers.
 */
export function useAutoLock(): void {
  const lastEventLoggedRef = useRef(0);

  useEffect(() => {
    // Reset activity timer upon mounting hook
    recordUserActivity();

    // Throttled activity handler to prevent high-frequency event overhead
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastEventLoggedRef.current > 2000) {
        lastEventLoggedRef.current = now;
        recordUserActivity();
      }
    };

    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        checkAutoLock();
      }
    };

    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'pointerdown',
      'click',
    ];

    events.forEach((evt) => {
      window.addEventListener(evt, handleActivity, { passive: true });
    });

    window.addEventListener('focus', handleVisibilityOrFocus);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    }

    // Periodic check every 15 seconds
    const intervalId = window.setInterval(() => {
      checkAutoLock();
    }, 15000);

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleActivity);
      });
      window.removeEventListener('focus', handleVisibilityOrFocus);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      }
      window.clearInterval(intervalId);
    };
  }, []);
}
