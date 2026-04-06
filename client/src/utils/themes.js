export const THEME_STORAGE_KEY = 'accent-theme';

export const ACCENT_THEMES = [
  { id: 'gold',    name: 'Gold',    color1: '#d4af37', color2: '#f4df9b', color3: '#8d6a21', textPrimary: '#f6f0dd', textSecondary: '#cfbf93', textMuted: '#8d825f' },
  { id: 'emerald', name: 'Emerald', color1: '#34d399', color2: '#a7f3d0', color3: '#059669', textPrimary: '#eaf4f0', textSecondary: '#92b4a4', textMuted: '#5a7870' },
  { id: 'sapphire',name: 'Sapphire',color1: '#60a5fa', color2: '#bfdbfe', color3: '#2563eb', textPrimary: '#e8eff8', textSecondary: '#8aaec4', textMuted: '#566c80' },
  { id: 'rose',    name: 'Rose',    color1: '#f472b6', color2: '#fbcfe8', color3: '#be185d', textPrimary: '#f8eef4', textSecondary: '#c49ab0', textMuted: '#7a5e6e' },
  { id: 'violet',  name: 'Violet',  color1: '#a78bfa', color2: '#ddd6fe', color3: '#6d28d9', textPrimary: '#f0ecf8', textSecondary: '#a89ac4', textMuted: '#6a6080' },
  { id: 'crimson', name: 'Crimson', color1: '#f87171', color2: '#fecaca', color3: '#b91c1c', textPrimary: '#f8eeee', textSecondary: '#c09898', textMuted: '#785858' },
];

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

export function getChartPalette(theme) {
  const hex = theme.color1;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  // 8 colors spaced 45° apart from the accent hue
  return Array.from({ length: 8 }, (_, i) => {
    const hue = (h + i * 45) % 360;
    const sat = i % 2 === 0 ? 66 : 52;
    const light = [62, 56, 68, 58, 64, 54, 70, 60][i];
    return `hsl(${hue}, ${sat}%, ${light}%)`;
  });
}

export function applyAccentTheme(themeId) {
  const theme = ACCENT_THEMES.find(t => t.id === themeId) ?? ACCENT_THEMES[0];
  const root = document.documentElement;
  root.style.setProperty('--accent-1', theme.color1);
  root.style.setProperty('--accent-2', theme.color2);
  root.style.setProperty('--accent-3', theme.color3);
  root.style.setProperty('--accent', theme.color1);
  root.style.setProperty('--accent-rgb', hexToRgb(theme.color1));
  root.style.setProperty('--accent-2-rgb', hexToRgb(theme.color2));
  root.style.setProperty('--accent-3-rgb', hexToRgb(theme.color3));
  root.style.setProperty('--accent-gradient',
    `linear-gradient(135deg, ${theme.color3} 0%, ${theme.color1} 45%, ${theme.color2} 100%)`
  );
  root.style.setProperty('--text-primary', theme.textPrimary);
  root.style.setProperty('--text-secondary', theme.textSecondary);
  root.style.setProperty('--text-muted', theme.textMuted);
}
