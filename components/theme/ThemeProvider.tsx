'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeContextValue {
  themeMode: ThemeMode;
  resolvedTheme: 'dark' | 'light';
  setThemeMode: (mode: ThemeMode) => void;
  reducedMotion: boolean;
  setReducedMotion: (val: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeMode: 'light',
  resolvedTheme: 'light',
  setThemeMode: () => {},
  reducedMotion: false,
  setReducedMotion: () => {},
});

const STORAGE_KEY_THEME = 'seisma_theme_preference_v2';
const STORAGE_KEY_MOTION = 'seisma_reduced_motion_v1';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('light');
  const [reducedMotion, setReducedMotionState] = useState<boolean>(false);

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) as ThemeMode | null;
      if (savedTheme === 'dark' || savedTheme === 'light' || savedTheme === 'system') {
        setThemeModeState(savedTheme);
      }
      const savedMotion = localStorage.getItem(STORAGE_KEY_MOTION);
      if (savedMotion === 'true') {
        setReducedMotionState(true);
      } else if (
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        setReducedMotionState(true);
      }
    } catch {
      // Ignore storage access errors in restricted iframes
    }
  }, []);

  useEffect(() => {
    const applyTheme = () => {
      let target: 'dark' | 'light' = 'light';
      if (themeMode === 'system') {
        const prefersDark =
          typeof window !== 'undefined' &&
          window.matchMedia &&
          window.matchMedia('(prefers-color-scheme: dark)').matches;
        target = prefersDark ? 'dark' : 'light';
      } else {
        target = themeMode;
      }

      setResolvedTheme(target);
      const root = document.documentElement;
      root.setAttribute('data-theme', target);
      if (target === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.add('light');
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      }
    };

    applyTheme();

    if (themeMode === 'system' && typeof window !== 'undefined' && window.matchMedia) {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme();
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
  }, [themeMode]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY_THEME, mode);
    } catch {
      // Ignore storage write error
    }
  };

  const setReducedMotion = (val: boolean) => {
    setReducedMotionState(val);
    try {
      localStorage.setItem(STORAGE_KEY_MOTION, String(val));
    } catch {
      // Ignore storage write error
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        resolvedTheme,
        setThemeMode,
        reducedMotion,
        setReducedMotion,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useSeismaTheme() {
  return useContext(ThemeContext);
}
