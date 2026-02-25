"use client";
import { createContext, useContext, useEffect, useState } from 'react';
import { ThemeConfig, themes, getThemeById, applyThemeColors } from '@/lib/themes';

type ThemeContextType = {
  isDark: boolean;
  toggleTheme: () => void;
  currentTheme: ThemeConfig;
  setTheme: (themeId: string) => void;
  availableThemes: typeof themes;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeConfig>(themes.default);

  useEffect(() => {
    // Load theme and mode from localStorage
    const savedMode = localStorage.getItem('theme');
    const savedThemeId = localStorage.getItem('themeId') || 'default';
    const theme = getThemeById(savedThemeId);
    
    setCurrentTheme(theme);
    
    if (savedMode === 'dark') {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
    
    // Apply theme colors
    applyThemeColors(theme, savedMode === 'dark');
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    
    if (newTheme) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    
    // Reapply theme colors with new mode
    applyThemeColors(currentTheme, newTheme);
  };
  
  const setTheme = (themeId: string) => {
    const theme = getThemeById(themeId);
    setCurrentTheme(theme);
    localStorage.setItem('themeId', themeId);
    
    // Apply theme colors
    applyThemeColors(theme, isDark);
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, currentTheme, setTheme, availableThemes: themes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
