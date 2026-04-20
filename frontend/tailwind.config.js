/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Outfit"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // --- Divemap.blue Accessible Theme (Okabe-Ito Palette) ---
        'divemap-blue': '#0072B2', // Okabe-Ito True Blue - Core brand color
        'divemap-sky': '#56B4E9',  // Okabe-Ito Sky Blue - Bright highlight color
        'divemap-deep': '#004d7a', // Deep Ocean Blue - Used for gradients
        'divemap-trench': '#001a2a', // Dark Trench Blue - Used for dark section backgrounds
        'divemap-surface': '#eaf4f9', // Bright Water Tint - Used for light CTA boxes
        
        // --- Interactive Colors ---
        'interactive-hover': 'rgba(219, 234, 254, 0.5)', // blue-100/50
        'interactive-hover-dark': 'rgba(30, 58, 138, 0.4)', // blue-900/40
        
        // --- Legacy Colors ---
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