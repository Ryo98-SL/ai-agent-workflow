import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
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
  // Production static hosting (e.g. Railway): bind to 0.0.0.0 and the
  // platform-provided $PORT, and skip Vite 6's host allowlist so the custom
  // domain isn't rejected. The preview server only serves built static files.
  preview: {
    host: true,
    port: Number(process.env.PORT) || 4173,
    allowedHosts: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
