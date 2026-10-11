import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0D1B2A",
        primary: {
          DEFAULT: "#0F7A45",
          dark: "#0B5C34",
          soft: "#E6F5ED",
        },
        ink: "#0D1B2A",
        muted: "#5C6B7A",
        line: "#D5E0DA",
        canvas: "#F3F6F4",
        danger: "#B42318",
        warning: "#9A6700",
      },
      borderRadius: {
        card: "14px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(13, 27, 42, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
