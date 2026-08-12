/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        void: '#050912',
        abyss: '#0B132B',
        steel: '#101A33',
        hud: '#1B2A4A',
        ice: '#7FB2E5',
        neon: '#00FF41',
        crit: '#FF003C',
        amber: '#FFB300',
        cyan: '#22D3EE',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Cascadia Mono', 'Consolas', 'ui-monospace', 'monospace'],
        thai: ['Noto Sans Thai', 'Leelawadee UI', 'Tahoma', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
