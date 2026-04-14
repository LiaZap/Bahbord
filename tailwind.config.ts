import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        surface: '#1a1c1e',
        surface2: '#22252a',
        sidebar: '#161819',
        column: '#1e2024',
        input: '#2a2d33',
        border: '#2d3036',
        accent: '#3b82f6',
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444'
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.3)',
      }
    }
  },
  plugins: [require('@tailwindcss/typography')]
};

export default config;
