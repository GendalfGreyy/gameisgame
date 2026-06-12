/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        tg: {
          bg: 'var(--tg-bg)',
          text: 'var(--tg-text)',
          accent: 'var(--tg-accent)',
        },
        gig: {
          surface: 'var(--gig-surface)',
          ink: 'var(--gig-ink)',
          muted: 'var(--gig-muted)',
          accent: 'var(--gig-accent)',
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};
