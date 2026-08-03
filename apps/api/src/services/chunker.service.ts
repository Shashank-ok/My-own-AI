import { config } from '../config/env';

export interface TextChunk {
  chunkIndex: number;
  text: string;
}

export function chunkText(
  text: string,
  chunkSize: number = config.defaultChunkSize,
  chunkOverlap: number = config.defaultChunkOverlap,
): TextChunk[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  if (chunkSize <= 0) {
    throw new Error('chunkSize must be greater than 0');
  }

  if (chunkOverlap < 0 || chunkOverlap >= chunkSize) {
    throw new Error('chunkOverlap must be non-negative and strictly less than chunkSize');
  }

  const step = chunkSize - chunkOverlap;
  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < trimmed.length) {
    const end = Math.min(start + chunkSize, trimmed.length);
    const chunkContent = trimmed.substring(start, end).trim();

    if (chunkContent.length > 0) {
      chunks.push({
        chunkIndex: index++,
        text: chunkContent,
      });
    }

    if (end === trimmed.length) {
      break;
    }

    start += step;
  }

  return chunks;
}
