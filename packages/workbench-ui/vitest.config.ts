import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const react = (await import("@vitejs/plugin-react")).default;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@workbench": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["tests/setup.ts"],
      css: true,
    },
  };
});
