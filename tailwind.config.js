/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        red: {
          50: '#FFEBEE',
          100: '#FFCDD2',
          200: '#EF9A9A',
          300: '#E57373',
          400: '#EF5350',
          500: '#FE0000',
          600: '#FE0000',
          700: '#E50000',
          750: '#D20000',
          800: '#B70000',
          900: '#7F0000',
        },
      },
    },
  },
  plugins: [],
}