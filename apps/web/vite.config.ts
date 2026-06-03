import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig(async () => {
  const react = (await import("@vitejs/plugin-react")).default;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@workbench": fileURLToPath(new URL("../../packages/workbench-ui/src", import.meta.url)),
      },
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
