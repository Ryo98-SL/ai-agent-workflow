import { defineConfig } from "prisma/config";
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import path from "node:path";

function loadEnv() {
  const cwd = process.cwd();

  for (const file of [".env"]) {
    expand(config({ path: path.resolve(cwd, file), override: true }));
  }
}

loadEnv();

export default defineConfig({
  experimental: {
    externalTables: true,
  },
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
  tables: {
    external: [
      "public.checkpoint_blobs",
      "public.checkpoint_migrations",
      "public.checkpoint_writes",
      "public.checkpoints",
    ],
  },
});
