/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        parchment: {
          50: '#FDFCF9',
          100: '#FAF7F2',
          DEFAULT: '#F5F0E7',
          200: '#EBE3D3',
          300: '#DED4BE',
        },
        ink: {
          DEFAULT: '#15201D',
          muted: '#4A5854',
          subtle: '#556561',
        },
        wearer: {
          light: '#EBF3F0',
          DEFAULT: '#1F624F',
          dark: '#144336',
          border: '#337D68',
        },
        helper: {
          light: '#F4EEF2',
          DEFAULT: '#70465E',
          dark: '#4F3142',
          border: '#8E5F7A',
        },
        rust: {
          light: '#FBECE8',
          DEFAULT: '#B64A35',
          dark: '#8C3524',
        },
        stone: {
          DEFAULT: '#C8BFAF',
          light: '#E2DBD0',
          dark: '#A69B89',
        },
        success: {
          light: '#E9F5EF',
          DEFAULT: '#216B4B',
          dark: '#164E36',
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'sans-serif',
        ],
        serif: [
          'Playfair Display',
          'Georgia',
          'Cambria',
          'Times New Roman',
          'serif',
        ],
      },
    },
  },
  plugins: [],
}
