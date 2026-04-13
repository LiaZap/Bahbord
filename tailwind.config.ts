import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        surface: '#1d1f21',
        surface2: '#282a2e',
        sidebar: '#1a1c1e',
        column: '#22242a',
        input: '#373b41',
        border: '#373b41',
        accent: '#3b82f6',
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444'
      }
    }
  },
  plugins: [require('@tailwindcss/typography')]
};

export default config;
