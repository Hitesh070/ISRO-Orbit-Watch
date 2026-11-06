/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        space: {
          950: '#030712',
          900: '#070d1d',
          850: '#0b1329',
          800: '#0f1b36',
          700: '#17274b',
          600: '#223868',
        },
        cyan: {
          400: '#22d3ee',
          500: '#06b6d4',
          glow: '#00f2fe',
        },
        orbit: {
          safe: '#10b981',
          caution: '#f59e0b',
          danger: '#ef4444',
          leo: '#38bdf8',
          meo: '#818cf8',
          geo: '#c084fc',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(6, 182, 212, 0.45)',
        'glow-emerald': '0 0 20px rgba(16, 185, 129, 0.45)',
        'glow-rose': '0 0 20px rgba(239, 68, 68, 0.45)',
        'glow-amber': '0 0 20px rgba(245, 158, 11, 0.45)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
