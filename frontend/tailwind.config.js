/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEEDFE',
          100: '#CECBF6',
          400: '#7F77DD',
          600: '#534AB7',
          800: '#3C3489',
        },
        // Status colours are reserved for state and always ship with an icon + label.
        status: {
          good: '#0ca30c',
          'good-text': '#006300',
          warning: '#fab219',
          serious: '#ec835a',
          critical: '#d03b3b',
        },
        // Chart series (validated categorical slots 1–2) and chart chrome.
        series: {
          1: '#2a78d6',
          2: '#eb6834',
        },
        chart: {
          grid: '#e1e0d9',
          axis: '#c3c2b7',
          muted: '#898781',
        },
      },
    },
  },
  plugins: [],
}
