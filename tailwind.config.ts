import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#fbfaf6',
        paper: '#ffffff',
        'paper-2': '#f7f2eb',
        ink: '#1d1410',
        'ink-2': '#5a4a40',
        'ink-3': '#9a8a80',
        line: '#ede4d6',
        'line-2': '#ddd2c0',
        realty: {
          DEFAULT: '#e87722',
          dark: '#b8581a',
          deep: '#7a3a10',
          bg: '#fdf1e3',
        },
        comp: {
          DEFAULT: '#c0392b',
          direct: '#e84118',
          dark: '#8e2418',
        },
        good: '#2e7d32',
        warn: '#d97706',
        bad: '#c0392b',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(40,20,10,0.06), 0 8px 24px rgba(40,20,10,0.10)',
      },
    },
  },
  plugins: [],
};

export default config;
