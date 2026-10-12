import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0A2C30",
        primary: {
          DEFAULT: "#227CB8",
          dark: "#1D6A9D",
          soft: "#E5F4FE",
        },
        ink: {
          DEFAULT: "#0A2C30",
          hover: "#1A3C40",
        },
        muted: "#5A6E71",
        line: "#D5E3E6",
        canvas: "#F4F8F8",
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
        card: "0 1px 2px rgba(10, 44, 48, 0.04), 0 8px 24px rgba(10, 44, 48, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
