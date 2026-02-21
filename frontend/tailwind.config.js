/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Obscurité souterraine — fond de la sidebar
        cave: {
          DEFAULT: '#111208',
          900: '#111208',
          800: '#1c1b0f',
          700: '#2c2b1e',
          text: '#a8a599',
          'text-active': '#f5f3ee',
        },
        // Frontale / ambre — couleur primaire
        lamp: {
          50:  '#fffbeb',
          100: '#fef3c7',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        // Eau de caverne / teal — couleur secondaire (liens de partage)
        pool: {
          50:  '#f0fdfa',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
