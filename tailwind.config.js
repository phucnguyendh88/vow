/* Tailwind CSS configuration for VOW app */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // VOW Dark Luxury Design System tokens
        ink: 'var(--color-ink)',
        background: 'var(--background)',
        surface: 'var(--surface)',
        surface2: 'var(--surface-2)',
        surface3: 'var(--surface-3)',
        gold: 'var(--gold)',
        cream: 'var(--foreground)',
        muted: 'var(--text-muted)',
        danger: 'var(--color-danger)',
        success: 'var(--color-success)',
        primary: {
          DEFAULT: '#f5b301',
          foreground: '#0b0b0f',
        },
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
