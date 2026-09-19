/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      fontSize: {
        'step-0': '13px',
        'step-1': '15px',
        'step-2': '18px',
        'step-3': '24px',
        'step-4': '34px',
        'step-5': '56px',
        'step-6': '84px',
      },
      maxWidth: {
        prose: '66ch',
      },
      // Set at runtime from src/theme.ts (see useThemeVariables), so the UI
      // follows the dusk toggle and never drifts from the scene's palette.
      colors: {
        ink: 'rgb(var(--ui-ink) / <alpha-value>)',
        paper: 'rgb(var(--ui-paper) / <alpha-value>)',
        sky: 'rgb(var(--ui-sky) / <alpha-value>)',
        accent: 'rgb(var(--ui-accent) / <alpha-value>)',
        'on-accent': 'rgb(var(--ui-on-accent) / <alpha-value>)',
        glow: 'rgb(var(--ui-glow) / <alpha-value>)',
      },
      keyframes: {
        // Two copies of a row side by side, moved one copy's width, loop
        // without a seam.
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        'marquee-reverse': { from: { transform: 'translateX(-50%)' }, to: { transform: 'translateX(0)' } },
        // A soft light drifting slowly about its place.
        drift: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '33%': { transform: 'translate3d(6%, -4%, 0) scale(1.06)' },
          '66%': { transform: 'translate3d(-5%, 5%, 0) scale(0.96)' },
        },
        // Light running once across gradient type.
        sheen: { from: { backgroundPosition: '100% 0' }, to: { backgroundPosition: '0% 0' } },
        spin: { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        marquee: 'marquee 38s linear infinite',
        'marquee-reverse': 'marquee-reverse 44s linear infinite',
        drift: 'drift 18s ease-in-out infinite',
        sheen: 'sheen 2.4s cubic-bezier(0.22, 1, 0.36, 1) 1.2s 1 both',
        'spin-slow': 'spin 9s linear infinite',
      },
    },
  },
  plugins: [],
}
