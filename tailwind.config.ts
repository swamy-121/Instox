import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#013316",
        primary: {
          DEFAULT: "#027332",
          dark: "#025A28",
          bright: "#0194A8",
          soft: "#E5F6EC",
        },
        brand: {
          DEFAULT: "#027332",
          soft: "#E6F4EC",
        },
        ink: {
          DEFAULT: "#013316",
          hover: "#024422",
        },
        muted: "#4F6B5E",
        line: "#D3E3DB",
        canvas: "#F3F8F5",
        profit: "#0F7A45",
        loss: "#B42318",
        warning: "#9A6700",
      },
      borderRadius: {
        card: "16px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(1, 51, 22, 0.04), 0 8px 24px rgba(1, 51, 22, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
