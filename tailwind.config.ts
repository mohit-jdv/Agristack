import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Earthy green/amber palette — evokes crops & mandis, not generic SaaS blue.
        soil: {
          50: "#f6f4ee",
          100: "#eae4d4",
          600: "#6b5335",
          800: "#3f3220",
          900: "#2a2115",
        },
        leaf: {
          50: "#f0f7ee",
          100: "#dcedd6",
          400: "#6fae52",
          500: "#4f8f37",
          600: "#3e7229",
          700: "#325b21",
        },
        wheat: {
          50: "#fdf8ec",
          200: "#f3e0a8",
          400: "#e4b94a",
          500: "#d4a52f",
          600: "#b3861f",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
