import { KNOWLEDGE_PARSER_VERSION } from "./constants";

export type TextChunk = {
  ordinal: number;
  content: string;
  title: string;
  metadata: Record<string, unknown>;
};

export type ChunkTextOptions = {
  title: string;
  chunkSize?: number;
  chunkOverlap?: number;
};

const DEFAULT_CHUNK_SIZE_CHARS = 3200;
const DEFAULT_CHUNK_OVERLAP_CHARS = 480;

export function normalizeKnowledgeText(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function parserForMimeType(mimeType?: string | null) {
  return {
    type: mimeType === "text/markdown" ? ("markdown" as const) : ("plainText" as const),
    version: KNOWLEDGE_PARSER_VERSION,
  };
}

export function chunkKnowledgeText(text: string, options: ChunkTextOptions): TextChunk[] {
  const normalized = normalizeKnowledgeText(text);
  if (!normalized) {
    return [];
  }

  const chunkSize = Math.max(200, options.chunkSize ?? DEFAULT_CHUNK_SIZE_CHARS);
  const chunkOverlap = Math.min(Math.max(0, options.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP_CHARS), Math.floor(chunkSize / 2));
  const chunks: TextChunk[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(normalized.length, start + chunkSize);
    if (end < normalized.length) {
      const boundary = Math.max(
        normalized.lastIndexOf("\n\n", end),
        normalized.lastIndexOf("\n", end),
        normalized.lastIndexOf("。", end),
        normalized.lastIndexOf(".", end),
      );
      if (boundary > start + Math.floor(chunkSize * 0.5)) {
        end = boundary + 1;
      }
    }

    const content = normalized.slice(start, end).trim();
    if (content) {
      chunks.push({
        ordinal: chunks.length,
        content,
        title: options.title,
        metadata: { parser: "plainText", characterStart: start, characterEnd: end },
      });
    }

    if (end >= normalized.length) {
      break;
    }
    start = Math.max(0, end - chunkOverlap);
  }

  return chunks;
}
