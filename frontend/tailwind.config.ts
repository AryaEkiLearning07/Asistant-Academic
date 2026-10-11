import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ["Newsreader", "Georgia", "Cambria", "serif"],
        sans: ["Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      colors: {
        epiona: {
          bgLight: "#F7F9FA",
          bgDark: "#12161A",
          surfaceLight: "#FFFFFF",
          surfaceDark: "#1B2127",
          textLight: "#12202B",
          textDark: "#E6EDF2",
          mutedLight: "#5B6B78",
          mutedDark: "#9AA9B5",
          borderLight: "#DCE3E8",
          borderDark: "#2A333B",
          tealLight: "#0F766E",
          tealDark: "#34D3BE",
          coralLight: "#E8684A",
          coralDark: "#F08A70",
        },
        primary: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
        },
      },
    },
  },
  plugins: [],
};

export default config;
