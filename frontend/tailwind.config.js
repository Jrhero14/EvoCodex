/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bgMain: '#EAE6DF',
        bgPanel: '#F3EFE9',
        bgHover: '#DCD6CE',
        textMain: '#1A1A1A',
        textMuted: '#6B6B6B',
        borderColor: '#1A1A1A',
        primary: '#4F85AC',
        primaryHover: '#3A6B8E',
        danger: '#E35876',
        success: '#E59E2D',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      width: {
        sidebar: '250px',
      },
      height: {
        topbar: '56px',
      }
    },
  },
  plugins: [],
}
