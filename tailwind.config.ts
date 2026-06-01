import type { Config } from "tailwindcss";

export default {
  content: ["./apps/*/index.html", "./apps/*/src/**/*.{ts,tsx}", "./packages/workbench-ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(214 32% 91%)",
        surface: "hsl(210 40% 98%)",
        ink: "hsl(222 47% 11%)",
      },
    },
  },
  plugins: [],
} satisfies Config;
