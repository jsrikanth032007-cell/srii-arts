/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        nle: {
          bg: '#0B0D13',          // Deepest canvas background
          surface: '#13161F',     // Panel surface
          header: '#181C27',      // Workspace header / command bar
          border: '#242A38',      // Sleek dividers
          hover: '#1E2333',       // Hover states
          active: '#2A3147',      // Active items
          accent: '#3B82F6',      // Linear blue accent
          amber: '#F59E0B',       // Warning / DaVinci Gold
          cyan: '#06B6D4',        // High-tech Cyan
          green: '#10B981',       // Keep / Safe audio
          red: '#EF4444',         // Cut / Alert
          purple: '#8B5CF6',      // AI Director / Gemini
          trackV1: '#1E293B',     // Main video track
          trackV2: '#312E81',     // Overlay track
          trackA1: '#064E3B',     // Audio track
          trackT1: '#701A75',     // Text/Captions track
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
