import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const react = (await import("@vitejs/plugin-react")).default;

  return {
    plugins: [react()],
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["tests/setup.ts"],
      css: true,
    },
  };
});
