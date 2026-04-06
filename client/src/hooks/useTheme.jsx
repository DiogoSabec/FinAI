/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import { THEME_STORAGE_KEY, applyAccentTheme } from '../utils/themes.js';

const COLOR_MODE_KEY = 'color-mode';

const ThemeCtx = createContext({ themeId: 'gold', setThemeId: () => {}, colorMode: 'dark', setColorMode: () => {} });

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => localStorage.getItem(THEME_STORAGE_KEY) ?? 'gold');
  const [colorMode, setColorMode] = useState(() => {
    const saved = localStorage.getItem(COLOR_MODE_KEY) ?? 'dark';
    document.documentElement.setAttribute('data-color-mode', saved);
    return saved;
  });

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
    applyAccentTheme(themeId);
  }, [themeId]);

  useEffect(() => {
    localStorage.setItem(COLOR_MODE_KEY, colorMode);
    document.documentElement.setAttribute('data-color-mode', colorMode);
  }, [colorMode]);

  return (
    <ThemeCtx.Provider value={{ themeId, setThemeId, colorMode, setColorMode }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx);
}
