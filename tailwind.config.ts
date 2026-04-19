import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        lavender: { DEFAULT: "#C8B6FF", light: "#E8DEFF" },
        mint: { DEFAULT: "#B8F0E6", light: "#DFFFF8" },
        peach: { DEFAULT: "#FFD6E0", light: "#FFEEF2" },
        cream: { DEFAULT: "#FFF3BF", light: "#FFFBE6" },
        "deep-purple": { DEFAULT: "#7C5CFC", hover: "#6A4AE8" },
        coral: { DEFAULT: "#FF6B6B", hover: "#E85555" },
        charcoal: "#2D2D3F",
        snow: "#FAFBFF",
      },
      borderRadius: {
        card: "16px",
        button: "12px",
      },
      fontFamily: {
        sans: ["Pretendard", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
