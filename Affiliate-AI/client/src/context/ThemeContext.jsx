import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

const themeColors = {
  blue: { primary: '#3b82f6', name: 'Blue' },
  violet: { primary: '#8b5cf6', name: 'Violet' },
  emerald: { primary: '#10b981', name: 'Emerald' },
  rose: { primary: '#f43f5e', name: 'Rose' },
  amber: { primary: '#f59e0b', name: 'Amber' },
  cyan: { primary: '#06b6d4', name: 'Cyan' },
};

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved ? saved === 'dark' : true;
    }
    return true;
  });

  const [accentColor, setAccentColor] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('accentColor') || 'blue';
    }
    return 'blue';
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    localStorage.setItem('accentColor', accentColor);
    document.documentElement.style.setProperty('--accent-color', themeColors[accentColor]?.primary || '#3b82f6');
  }, [accentColor]);

  const toggleTheme = () => setIsDark(!isDark);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, accentColor, setAccentColor, themeColors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
