import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        surface: 'var(--bg-primary)',
        surface2: 'var(--bg-secondary)',
        sidebar: 'var(--bg-sidebar)',
        column: 'var(--bg-column)',
        input: 'var(--bg-input)',
        border: 'var(--border-color)',
        accent: '#3b82f6',
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444'
      },
      textColor: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
      },
      boxShadow: {
        'card': '0 1px 3px var(--shadow-color, rgba(0,0,0,0.3)), 0 1px 2px var(--shadow-color, rgba(0,0,0,0.2))',
        'card-hover': '0 4px 12px var(--shadow-color, rgba(0,0,0,0.4)), 0 2px 4px var(--shadow-color, rgba(0,0,0,0.3))',
      }
    }
  },
  plugins: [require('@tailwindcss/typography')]
};

export default config;
