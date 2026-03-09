/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'brand-navy': '#1E3A5F',
        'brand-blue': '#3B82F6',
      },
      fontFamily: {
        body: ['"DM Sans"', 'sans-serif'],
        heading: ['Syne', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
