/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dive-primary': '#2563eb', // blue-600
        'dive-success': '#15803d', // green-700
        'dive-warning': '#9a3412', // orange-800
        'dive-surface': '#f9fafb', // gray-50
        'dive-border': '#f3f4f6',  // gray-100
      },
      boxShadow: {
        'dive-card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'dive-card-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      }
    },
  },
  plugins: [],
}