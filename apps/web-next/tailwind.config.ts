import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        glow: "0 0 0 1px rgba(99,102,241,.35), 0 12px 40px rgba(0,0,0,.55)"
      }
    }
  },
  plugins: []
} satisfies Config;

