import { defineConfig } from "vite";

export default defineConfig(async () => {
  const react = (await import("@vitejs/plugin-react")).default;

  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: 5174,
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
