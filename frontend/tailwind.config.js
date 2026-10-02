/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          orange: '#FF5E00',
          accent: '#FF7A00',
          neon: '#FF8800',
          gold: '#FFAE00'
        },
        dark: {
          bg: '#08080C',
          card: '#12121A',
          lighter: '#1A1A26',
          border: 'rgba(255, 255, 255, 0.12)',
        }
      },
      boxShadow: {
        'orange-glow': '0 0 25px -3px rgba(255, 102, 0, 0.45)',
        'orange-glow-lg': '0 0 45px -5px rgba(255, 94, 0, 0.65)',
        'white-glow': '0 0 20px -2px rgba(255, 255, 255, 0.35)',
        'neon-border': '0 0 15px rgba(255, 122, 0, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 12s linear infinite',
        'float': 'float 4s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        }
      }
    },
  },
  plugins: [],
}

