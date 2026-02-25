export type ThemeConfig = {
  id: string;
  name: string;
  description: string;
  icon: string;
  icons: {
    home: string;
    transaction: string;
    session: string;
    statistic: string;
    settings: string;
    profit: string;
    loss: string;
    neutral: string;
    buy: string;
    sell: string;
    target: string;
    theme: string;
    darkMode: string;
    logout: string;
    installApp: string;
  };
  chartType: 'bar' | 'line' | 'area' | 'composed';
  buttonStyle: 'rounded' | 'sharp' | 'pill' | 'gradient';
  progressStyle: 'simple' | 'gradient' | 'striped' | 'glow';
  colors: {
    primary: string;
    primaryDark: string;
    secondary: string;
    secondaryDark: string;
    accent: string;
    accentDark: string;
    success: string;
    successDark: string;
    danger: string;
    dangerDark: string;
    warning: string;
    warningDark: string;
    background: string;
    backgroundDark: string;
    surface: string;
    surfaceDark: string;
    text: string;
    textDark: string;
    textMuted: string;
    textMutedDark: string;
    border: string;
    borderDark: string;
  };
  gradients: {
    primary: string;
    primaryDark: string;
    accent: string;
    accentDark: string;
    success: string;
    successDark: string;
  };
  chartColors: {
    buy: string;
    sell: string;
    profit: string;
    buyDark: string;
    sellDark: string;
    profitDark: string;
  };
};

import { additionalThemes } from './additionalThemes';
import { moreThemes } from './moreThemes';

export const themes: Record<string, ThemeConfig> = {
  default: {
    id: 'default',
    name: 'Default Purple',
    description: 'Tema klasik dengan nuansa ungu',
    icon: '💜',
    icons: {
      home: '🏠',
      transaction: '💳',
      session: '📊',
      statistic: '📈',
      settings: '⚙️',
      profit: '📈',
      loss: '📉',
      neutral: '➖',
      buy: '🛒',
      sell: '💰',
      target: '🎯',
      theme: '🎨',
      darkMode: '🌙',
      logout: '🚪',
      installApp: '📱',
    },
    chartType: 'bar',
    buttonStyle: 'rounded',
    progressStyle: 'gradient',
    colors: {
      primary: 'rgb(147, 51, 234)', // purple-600
      primaryDark: 'rgb(168, 85, 247)', // purple-500
      secondary: 'rgb(139, 92, 246)', // violet-500
      secondaryDark: 'rgb(167, 139, 250)', // violet-400
      accent: 'rgb(147, 51, 234)',
      accentDark: 'rgb(168, 85, 247)',
      success: 'rgb(34, 197, 94)', // green-500
      successDark: 'rgb(74, 222, 128)', // green-400
      danger: 'rgb(239, 68, 68)', // red-500
      dangerDark: 'rgb(248, 113, 113)', // red-400
      warning: 'rgb(245, 158, 11)', // amber-500
      warningDark: 'rgb(251, 191, 36)', // amber-400
      background: 'rgb(249, 250, 251)', // gray-50
      backgroundDark: 'rgb(17, 24, 39)', // gray-900
      surface: 'rgb(255, 255, 255)',
      surfaceDark: 'rgb(31, 41, 55)', // gray-800
      text: 'rgb(17, 24, 39)', // gray-900
      textDark: 'rgb(255, 255, 255)',
      textMuted: 'rgb(107, 114, 128)', // gray-500
      textMutedDark: 'rgb(156, 163, 175)', // gray-400
      border: 'rgb(229, 231, 235)', // gray-200
      borderDark: 'rgb(75, 85, 99)', // gray-600
    },
    gradients: {
      primary: 'linear-gradient(135deg, rgb(147, 51, 234), rgb(139, 92, 246))',
      primaryDark: 'linear-gradient(135deg, rgb(168, 85, 247), rgb(167, 139, 250))',
      accent: 'linear-gradient(135deg, rgb(233, 213, 255), rgb(237, 233, 254))',
      accentDark: 'linear-gradient(135deg, rgba(147, 51, 234, 0.2), rgba(139, 92, 246, 0.2))',
      success: 'linear-gradient(135deg, rgb(34, 197, 94), rgb(74, 222, 128))',
      successDark: 'linear-gradient(135deg, rgb(74, 222, 128), rgb(134, 239, 172))',
    },
    chartColors: {
      buy: '#ef4444', // red-500
      sell: '#22c55e', // green-500
      profit: '#8b5cf6', // violet-500
      buyDark: '#f87171', // red-400
      sellDark: '#4ade80', // green-400
      profitDark: '#a78bfa', // violet-400
    },
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean Blue',
    description: 'Tema dengan warna biru laut yang menenangkan',
    icon: '🌊',
    icons: {
      home: '🌊',
      transaction: '💵',
      session: '📋',
      statistic: '📊',
      settings: '🔧',
      profit: '🔺',
      loss: '🔻',
      neutral: '⏸️',
      buy: '🔵',
      sell: '🟢',
      target: '🎯',
      theme: '🎨',
      darkMode: '🌑',
      logout: '🚀',
      installApp: '⬇️',
    },
    chartType: 'area',
    buttonStyle: 'pill',
    progressStyle: 'glow',
    colors: {
      primary: 'rgb(59, 130, 246)', // blue-500
      primaryDark: 'rgb(96, 165, 250)', // blue-400
      secondary: 'rgb(6, 182, 212)', // cyan-500
      secondaryDark: 'rgb(34, 211, 238)', // cyan-400
      accent: 'rgb(59, 130, 246)',
      accentDark: 'rgb(96, 165, 250)',
      success: 'rgb(16, 185, 129)', // emerald-500
      successDark: 'rgb(52, 211, 153)', // emerald-400
      danger: 'rgb(244, 63, 94)', // rose-500
      dangerDark: 'rgb(251, 113, 133)', // rose-400
      warning: 'rgb(251, 146, 60)', // orange-400
      warningDark: 'rgb(251, 191, 36)', // amber-400
      background: 'rgb(240, 249, 255)', // sky-50
      backgroundDark: 'rgb(7, 89, 133)', // sky-900
      surface: 'rgb(255, 255, 255)',
      surfaceDark: 'rgb(12, 74, 110)', // sky-800
      text: 'rgb(7, 89, 133)', // sky-900
      textDark: 'rgb(255, 255, 255)',
      textMuted: 'rgb(100, 116, 139)', // slate-500
      textMutedDark: 'rgb(148, 163, 184)', // slate-400
      border: 'rgb(186, 230, 253)', // sky-200
      borderDark: 'rgb(2, 132, 199)', // sky-600
    },
    gradients: {
      primary: 'linear-gradient(135deg, rgb(59, 130, 246), rgb(6, 182, 212))',
      primaryDark: 'linear-gradient(135deg, rgb(96, 165, 250), rgb(34, 211, 238))',
      accent: 'linear-gradient(135deg, rgb(224, 242, 254), rgb(207, 250, 254))',
      accentDark: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(6, 182, 212, 0.2))',
      success: 'linear-gradient(135deg, rgb(16, 185, 129), rgb(52, 211, 153))',
      successDark: 'linear-gradient(135deg, rgb(52, 211, 153), rgb(110, 231, 183))',
    },
    chartColors: {
      buy: '#fb7185', // pink-400
      sell: '#34d399', // emerald-400
      profit: '#60a5fa', // blue-400
      buyDark: '#fda4af', // pink-300
      sellDark: '#6ee7b7', // emerald-300
      profitDark: '#93c5fd', // blue-300
    },
  },
  forest: {
    id: 'forest',
    name: 'Forest Green',
    description: 'Tema hijau hutan yang natural dan segar',
    icon: '🌲',
    icons: {
      home: '🌿',
      transaction: '💸',
      session: '🌳',
      statistic: '📊',
      settings: '⚙️',
      profit: '🌱',
      loss: '🍂',
      neutral: '🍃',
      buy: '🟩',
      sell: '🟢',
      target: '🎯',
      theme: '🌲',
      darkMode: '🌙',
      logout: '🍃',
      installApp: '📲',
    },
    chartType: 'line',
    buttonStyle: 'rounded',
    progressStyle: 'striped',
    colors: {
      primary: 'rgb(34, 197, 94)', // green-500
      primaryDark: 'rgb(74, 222, 128)', // green-400
      secondary: 'rgb(16, 185, 129)', // emerald-500
      secondaryDark: 'rgb(52, 211, 153)', // emerald-400
      accent: 'rgb(34, 197, 94)',
      accentDark: 'rgb(74, 222, 128)',
      success: 'rgb(34, 197, 94)',
      successDark: 'rgb(74, 222, 128)',
      danger: 'rgb(239, 68, 68)',
      dangerDark: 'rgb(248, 113, 113)',
      warning: 'rgb(245, 158, 11)',
      warningDark: 'rgb(251, 191, 36)',
      background: 'rgb(240, 253, 244)', // green-50
      backgroundDark: 'rgb(20, 83, 45)', // green-900
      surface: 'rgb(255, 255, 255)',
      surfaceDark: 'rgb(22, 101, 52)', // green-800
      text: 'rgb(20, 83, 45)', // green-900
      textDark: 'rgb(255, 255, 255)',
      textMuted: 'rgb(107, 114, 128)',
      textMutedDark: 'rgb(156, 163, 175)',
      border: 'rgb(187, 247, 208)', // green-200
      borderDark: 'rgb(22, 163, 74)', // green-600
    },
    gradients: {
      primary: 'linear-gradient(135deg, rgb(34, 197, 94), rgb(16, 185, 129))',
      primaryDark: 'linear-gradient(135deg, rgb(74, 222, 128), rgb(52, 211, 153))',
      accent: 'linear-gradient(135deg, rgb(220, 252, 231), rgb(209, 250, 229))',
      accentDark: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(16, 185, 129, 0.2))',
      success: 'linear-gradient(135deg, rgb(34, 197, 94), rgb(74, 222, 128))',
      successDark: 'linear-gradient(135deg, rgb(74, 222, 128), rgb(134, 239, 172))',
    },
    chartColors: {
      buy: '#f87171', // red-400
      sell: '#4ade80', // green-400
      profit: '#34d399', // emerald-400
      buyDark: '#fca5a5', // red-300
      sellDark: '#86efac', // green-300
      profitDark: '#6ee7b7', // emerald-300
    },
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset Orange',
    description: 'Tema hangat dengan gradasi sunset',
    icon: '🌅',
    icons: {
      home: '☀️',
      transaction: '💶',
      session: '📑',
      statistic: '📈',
      settings: '⚡',
      profit: '🔥',
      loss: '❄️',
      neutral: '⚖️',
      buy: '🟠',
      sell: '🟡',
      target: '🏆',
      theme: '🌆',
      darkMode: '🌙',
      logout: '🌅',
      installApp: '💾',
    },
    chartType: 'composed',
    buttonStyle: 'gradient',
    progressStyle: 'gradient',
    colors: {
      primary: 'rgb(249, 115, 22)', // orange-500
      primaryDark: 'rgb(251, 146, 60)', // orange-400
      secondary: 'rgb(236, 72, 153)', // pink-500
      secondaryDark: 'rgb(244, 114, 182)', // pink-400
      accent: 'rgb(249, 115, 22)',
      accentDark: 'rgb(251, 146, 60)',
      success: 'rgb(34, 197, 94)',
      successDark: 'rgb(74, 222, 128)',
      danger: 'rgb(220, 38, 38)', // red-600
      dangerDark: 'rgb(239, 68, 68)', // red-500
      warning: 'rgb(245, 158, 11)',
      warningDark: 'rgb(251, 191, 36)',
      background: 'rgb(255, 247, 237)', // orange-50
      backgroundDark: 'rgb(124, 45, 18)', // orange-900
      surface: 'rgb(255, 255, 255)',
      surfaceDark: 'rgb(154, 52, 18)', // orange-800
      text: 'rgb(124, 45, 18)', // orange-900
      textDark: 'rgb(255, 255, 255)',
      textMuted: 'rgb(115, 115, 115)', // neutral-500
      textMutedDark: 'rgb(163, 163, 163)', // neutral-400
      border: 'rgb(254, 215, 170)', // orange-200
      borderDark: 'rgb(234, 88, 12)', // orange-600
    },
    gradients: {
      primary: 'linear-gradient(135deg, rgb(249, 115, 22), rgb(236, 72, 153))',
      primaryDark: 'linear-gradient(135deg, rgb(251, 146, 60), rgb(244, 114, 182))',
      accent: 'linear-gradient(135deg, rgb(255, 237, 213), rgb(252, 231, 243))',
      accentDark: 'linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(236, 72, 153, 0.2))',
      success: 'linear-gradient(135deg, rgb(34, 197, 94), rgb(74, 222, 128))',
      successDark: 'linear-gradient(135deg, rgb(74, 222, 128), rgb(134, 239, 172))',
    },
    chartColors: {
      buy: '#dc2626', // red-600
      sell: '#22c55e', // green-500
      profit: '#fb923c', // orange-400
      buyDark: '#ef4444', // red-500
      sellDark: '#4ade80', // green-400
      profitDark: '#fdba74', // orange-300
    },
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight Dark',
    description: 'Tema gelap dengan aksen neon',
    icon: '🌃',
    icons: {
      home: '🌌',
      transaction: '💫',
      session: '📱',
      statistic: '⚡',
      settings: '🔮',
      profit: '✨',
      loss: '💔',
      neutral: '🔷',
      buy: '🟦',
      sell: '🟪',
      target: '💎',
      theme: '🌟',
      darkMode: '🌚',
      logout: '🚁',
      installApp: '📲',
    },
    chartType: 'area',
    buttonStyle: 'sharp',
    progressStyle: 'glow',
    colors: {
      primary: 'rgb(99, 102, 241)', // indigo-500
      primaryDark: 'rgb(129, 140, 248)', // indigo-400
      secondary: 'rgb(168, 85, 247)', // purple-500
      secondaryDark: 'rgb(196, 181, 253)', // purple-300
      accent: 'rgb(99, 102, 241)',
      accentDark: 'rgb(129, 140, 248)',
      success: 'rgb(52, 211, 153)', // emerald-400
      successDark: 'rgb(110, 231, 183)', // emerald-300
      danger: 'rgb(251, 113, 133)', // rose-400
      dangerDark: 'rgb(253, 164, 175)', // rose-300
      warning: 'rgb(251, 191, 36)', // amber-400
      warningDark: 'rgb(252, 211, 77)', // amber-300
      background: 'rgb(15, 23, 42)', // slate-900
      backgroundDark: 'rgb(2, 6, 23)', // slate-950
      surface: 'rgb(30, 41, 59)', // slate-800
      surfaceDark: 'rgb(15, 23, 42)', // slate-900
      text: 'rgb(241, 245, 249)', // slate-100
      textDark: 'rgb(248, 250, 252)', // slate-50
      textMuted: 'rgb(148, 163, 184)', // slate-400
      textMutedDark: 'rgb(203, 213, 225)', // slate-300
      border: 'rgb(51, 65, 85)', // slate-700
      borderDark: 'rgb(30, 41, 59)', // slate-800
    },
    gradients: {
      primary: 'linear-gradient(135deg, rgb(99, 102, 241), rgb(168, 85, 247))',
      primaryDark: 'linear-gradient(135deg, rgb(129, 140, 248), rgb(196, 181, 253))',
      accent: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))',
      accentDark: 'linear-gradient(135deg, rgba(129, 140, 248, 0.2), rgba(196, 181, 253, 0.2))',
      success: 'linear-gradient(135deg, rgb(52, 211, 153), rgb(110, 231, 183))',
      successDark: 'linear-gradient(135deg, rgb(110, 231, 183), rgb(167, 243, 208))',
    },
    chartColors: {
      buy: '#fb7185', // pink-400
      sell: '#4ade80', // green-400
      profit: '#a78bfa', // violet-400
      buyDark: '#fda4af', // pink-300
      sellDark: '#86efac', // green-300
      profitDark: '#c4b5fd', // violet-300
    },
  },
  sakura: {
    id: 'sakura',
    name: 'Sakura Pink',
    description: 'Tema pink lembut seperti bunga sakura',
    icon: '🌸',
    icons: {
      home: '🌸',
      transaction: '💴',
      session: '🌺',
      statistic: '💕',
      settings: '🎀',
      profit: '🌹',
      loss: '🥀',
      neutral: '🌷',
      buy: '💗',
      sell: '💖',
      target: '👑',
      theme: '🎨',
      darkMode: '🌙',
      logout: '🚪',
      installApp: '💝',
    },
    chartType: 'line',
    buttonStyle: 'pill',
    progressStyle: 'simple',
    colors: {
      primary: 'rgb(236, 72, 153)', // pink-500
      primaryDark: 'rgb(244, 114, 182)', // pink-400
      secondary: 'rgb(219, 39, 119)', // pink-600
      secondaryDark: 'rgb(236, 72, 153)', // pink-500
      accent: 'rgb(236, 72, 153)',
      accentDark: 'rgb(244, 114, 182)',
      success: 'rgb(134, 239, 172)', // green-300
      successDark: 'rgb(187, 247, 208)', // green-200
      danger: 'rgb(244, 63, 94)', // rose-500
      dangerDark: 'rgb(251, 113, 133)', // rose-400
      warning: 'rgb(252, 211, 77)', // amber-300
      warningDark: 'rgb(254, 240, 138)', // amber-200
      background: 'rgb(253, 242, 248)', // pink-50
      backgroundDark: 'rgb(131, 24, 67)', // pink-900
      surface: 'rgb(255, 255, 255)',
      surfaceDark: 'rgb(157, 23, 77)', // pink-800
      text: 'rgb(131, 24, 67)', // pink-900
      textDark: 'rgb(255, 255, 255)',
      textMuted: 'rgb(107, 114, 128)',
      textMutedDark: 'rgb(156, 163, 175)',
      border: 'rgb(251, 207, 232)', // pink-200
      borderDark: 'rgb(219, 39, 119)', // pink-600
    },
    gradients: {
      primary: 'linear-gradient(135deg, rgb(236, 72, 153), rgb(251, 113, 133))',
      primaryDark: 'linear-gradient(135deg, rgb(244, 114, 182), rgb(253, 164, 175))',
      accent: 'linear-gradient(135deg, rgb(252, 231, 243), rgb(254, 205, 211))',
      accentDark: 'linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(251, 113, 133, 0.2))',
      success: 'linear-gradient(135deg, rgb(134, 239, 172), rgb(187, 247, 208))',
      successDark: 'linear-gradient(135deg, rgb(187, 247, 208), rgb(220, 252, 231))',
    },
    chartColors: {
      buy: '#be185d', // pink-700
      sell: '#86efac', // green-300
      profit: '#f9a8d4', // pink-300
      buyDark: '#db2777', // pink-600
      sellDark: '#bbf7d0', // green-200
      profitDark: '#fbcfe8', // pink-200
    },
  },
  ...additionalThemes,
  ...moreThemes,
};

export function getThemeById(themeId: string): ThemeConfig {
  return themes[themeId] || themes.default;
}

export function applyThemeColors(theme: ThemeConfig, isDark: boolean) {
  const root = document.documentElement;
  
  // Apply CSS variables
  root.style.setProperty('--color-primary', isDark ? theme.colors.primaryDark : theme.colors.primary);
  root.style.setProperty('--color-secondary', isDark ? theme.colors.secondaryDark : theme.colors.secondary);
  root.style.setProperty('--color-accent', isDark ? theme.colors.accentDark : theme.colors.accent);
  root.style.setProperty('--color-success', isDark ? theme.colors.successDark : theme.colors.success);
  root.style.setProperty('--color-danger', isDark ? theme.colors.dangerDark : theme.colors.danger);
  root.style.setProperty('--color-warning', isDark ? theme.colors.warningDark : theme.colors.warning);
  root.style.setProperty('--color-background', isDark ? theme.colors.backgroundDark : theme.colors.background);
  root.style.setProperty('--color-surface', isDark ? theme.colors.surfaceDark : theme.colors.surface);
  root.style.setProperty('--color-text', isDark ? theme.colors.textDark : theme.colors.text);
  root.style.setProperty('--color-text-muted', isDark ? theme.colors.textMutedDark : theme.colors.textMuted);
  root.style.setProperty('--color-border', isDark ? theme.colors.borderDark : theme.colors.border);
  
  // Apply gradients
  root.style.setProperty('--gradient-primary', isDark ? theme.gradients.primaryDark : theme.gradients.primary);
  root.style.setProperty('--gradient-accent', isDark ? theme.gradients.accentDark : theme.gradients.accent);
  root.style.setProperty('--gradient-success', isDark ? theme.gradients.successDark : theme.gradients.success);
  
  // Apply chart colors
  root.style.setProperty('--chart-buy', isDark ? theme.chartColors.buyDark : theme.chartColors.buy);
  root.style.setProperty('--chart-sell', isDark ? theme.chartColors.sellDark : theme.chartColors.sell);
  root.style.setProperty('--chart-profit', isDark ? theme.chartColors.profitDark : theme.chartColors.profit);
}
