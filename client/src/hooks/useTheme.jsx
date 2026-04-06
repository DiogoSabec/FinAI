/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';
import { THEME_STORAGE_KEY } from '../utils/themes.js';

const ThemeCtx = createContext({ themeId: 'gold', setThemeId: () => {} });

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => localStorage.getItem(THEME_STORAGE_KEY) ?? 'gold');
  return <ThemeCtx.Provider value={{ themeId, setThemeId }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}
