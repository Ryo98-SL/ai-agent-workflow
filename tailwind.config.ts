import type { Config } from "tailwindcss";
import shadcnPreset from "./tailwind.shadcn-preset";

export default {
  presets: [shadcnPreset],
  content: ["./apps/*/index.html", "./apps/*/src/**/*.{ts,tsx}", "./packages/workbench-ui/src/**/*.{ts,tsx}"],
} satisfies Config;
