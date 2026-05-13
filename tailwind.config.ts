import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#0a0a0a",
        paper: "#fafaf7",
        muted: "#6b6b66",
        line: "#e6e6e0",
        top: "#1f7a3a",
        ok: "#c79a1f",
        uncool: "#cf6a1a",
        nogo: "#b3261e",
      },
    },
  },
  plugins: [],
};

export default config;
