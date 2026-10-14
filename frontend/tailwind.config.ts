import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        border: "var(--border)",
        text: "var(--text)",
        "text-muted": "var(--text-muted)",
        accent: "var(--accent)",
        "accent-soft": "var(--accent-soft)",
        "ev-jurnal": "var(--ev-jurnal)",
        "ev-label": "var(--ev-label)",
        "ev-web": "var(--ev-web)",
        danger: "var(--danger)",
        // Backward compatibility mappings
        epiona: {
          bgLight: "#FAFAF9",
          bgDark: "#0F1115",
          surfaceLight: "#FFFFFF",
          surfaceDark: "#16191F",
          textLight: "#17191C",
          textDark: "#E8EAED",
          mutedLight: "#5F6670",
          mutedDark: "#9AA1AB",
          borderLight: "#E5E7E3",
          borderDark: "#2A2F37",
          tealLight: "#0F766E",
          tealDark: "#2DD4BF",
          coralLight: "#DC2626",
          coralDark: "#F87171",
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
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
        pill: "9999px",
      },
      boxShadow: {
        popover: "0 8px 24px rgba(0, 0, 0, 0.12)",
        overlay: "0 8px 24px rgba(0, 0, 0, 0.12)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
        serif: ["Source Serif 4", "Newsreader", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;

