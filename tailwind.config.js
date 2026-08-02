/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nirbhay: {
          navy: '#0B0F2E',
          purple: '#8B7FD4',
          accent: '#6C5CE7',
          dark: '#121838',
          light: '#F8FAFC',
          card: '#FFFFFF',
          danger: '#FF4D4D',
          warning: '#FFA500',
          safe: '#10B981'
        }
      },
      fontFamily: {
        sans: ['Inter', 'Manrope', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
