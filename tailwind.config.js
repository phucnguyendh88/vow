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
        // Brand palette – warm neutral + gold accent
        primary: '#4A7C59', // sage/forest green
        accent: '#D97706', // warm gold/orange
        background: '#FAF9F6', // ivory soft background
        surface: '#FFFFFF',
        muted: '#F5F5F4',
        text: {
          DEFAULT: '#1F2937', // gray-800
          secondary: '#4B5563', // gray-600
        },
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'serif'],
        handwritten: ['"Cormorant Garamond"', 'serif'],
      },
      borderRadius: {
        DEFAULT: '0.5rem', // 8px – not over‑rounded
      },
      spacing: {
        xs: '0.25rem', // 4px
        sm: '0.5rem', // 8px
        md: '1rem', // 16px
        lg: '1.5rem', // 24px
        xl: '2rem', // 32px
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
