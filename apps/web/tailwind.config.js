/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        tg: {
          bg: 'var(--tg-theme-bg-color, #0f1419)',
          text: 'var(--tg-theme-text-color, #e7e9ea)',
          hint: 'var(--tg-theme-hint-color, #71767b)',
          link: 'var(--tg-theme-link-color, #1d9bf0)',
          button: 'var(--tg-theme-button-color, #1d9bf0)',
          'button-text': 'var(--tg-theme-button-text-color, #fff)',
          secondary: 'var(--tg-theme-secondary-bg-color, #16181c)',
        },
      },
      borderRadius: {
        'app': 'var(--app-radius, 16px)',
        'app-sm': 'var(--app-radius-sm, 12px)',
      },
    },
  },
  plugins: [],
};
