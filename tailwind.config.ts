import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        accent: 'var(--color-accent)',
        success: 'var(--color-success)',
        danger: 'var(--color-danger)',
        warning: 'var(--color-warning)',
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        text: 'var(--color-text)',
        'text-muted': 'var(--color-text-muted)',
        border: 'var(--color-border)',
      },
      scale: {
        '98': '0.98',
        '102': '1.02',
      },
      animation: {
        'spin-fast': 'spin 0.5s linear infinite',
      },
      transitionDuration: {
        '0': '0ms',
        '2000': '2000ms',
      },
      borderRadius: {
        "3xl": "1.5rem"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,0.12)"
      }
    },
  },
  darkMode: ["class"],
  plugins: [],
};
export default config;
