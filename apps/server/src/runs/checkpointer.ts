import type { BaseCheckpointSaver } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { logger } from "../logger";

let cached: BaseCheckpointSaver | null | undefined;

/**
 * Creates the durable LangGraph checkpointer for authenticated runs, backed by
 * the same Postgres database. Returns null when DATABASE_URL is unset or setup
 * fails — callers then fall back to the in-memory MemorySaver (anonymous runs
 * always use MemorySaver).
 *
 * Memoized so `.setup()` (which creates the checkpoint tables) runs once.
 */
export async function createAuthedCheckpointer(): Promise<BaseCheckpointSaver | null> {
  if (cached !== undefined) {
    return cached;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    cached = null;
    return null;
  }

  try {
    const saver = PostgresSaver.fromConnString(connectionString);
    await saver.setup();
    logger.info("checkpointer.postgres.ready");
    cached = saver;
    return saver;
  } catch (error) {
    logger.error("checkpointer.postgres.failed", {
      message: error instanceof Error ? error.message : "Failed to init Postgres checkpointer.",
    });
    cached = null;
    return null;
  }
}
