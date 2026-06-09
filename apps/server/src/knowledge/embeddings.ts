import { RuntimeModelError } from "../runtime/errors";
import { getPlatformEmbeddingConfig, type PlatformEmbeddingConfig } from "../config";

export type EmbeddingAdapter = {
  embedTexts(texts: string[]): Promise<number[][]>;
};

export function createDeterministicEmbeddingAdapter(dimensions = 16): EmbeddingAdapter {
  return {
    async embedTexts(texts) {
      return texts.map((text) => deterministicEmbedding(text, dimensions));
    },
  };
}

export function createPlatformEmbeddingAdapter(
  fetchImpl: typeof fetch = fetch,
  config: PlatformEmbeddingConfig | null = getPlatformEmbeddingConfig(),
): EmbeddingAdapter {
  return {
    async embedTexts(texts) {
      if (texts.length === 0) {
        return [];
      }
      if (!config) {
        throw new RuntimeModelError("Platform embedding API key is not configured.");
      }

      const response = await fetchImpl(`${config.baseURL.replace(/\/$/, "")}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({ model: config.model, input: texts }),
      });

      if (!response.ok) {
        throw new RuntimeModelError(`Embedding request failed with HTTP ${response.status}.`);
      }

      const payload = (await response.json()) as { data?: Array<{ embedding?: unknown }> };
      const embeddings = payload.data?.map((item) => item.embedding).filter(Array.isArray) as number[][] | undefined;
      if (!embeddings || embeddings.length !== texts.length) {
        throw new RuntimeModelError("Embedding response did not include one vector per input.");
      }
      return embeddings;
    },
  };
}

function deterministicEmbedding(text: string, dimensions: number): number[] {
  const vector = Array.from({ length: dimensions }, () => 0);
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    vector[index % dimensions] += ((code % 97) + 1) / 97;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / norm).toFixed(8)));
}
