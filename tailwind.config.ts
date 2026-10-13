import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#17211C",
        primary: {
          DEFAULT: "#07864B",
          dark: "#075C3B",
          bright: "#0B7A43",
          soft: "#E7F4EC",
        },
        brand: {
          DEFAULT: "#07864B",
          soft: "#E7F4EC",
        },
        ink: {
          DEFAULT: "#17211C",
          hover: "#075C3B",
        },
        muted: "#64716A",
        line: "#E1E8E3",
        canvas: "#F6F8F7",
        profit: "#0B7A43",
        loss: "#C62F2F",
        warning: "#9A6700",
      },
      borderRadius: {
        card: "12px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(23, 33, 28, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
