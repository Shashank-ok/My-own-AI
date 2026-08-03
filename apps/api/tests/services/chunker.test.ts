import { describe, it, expect } from 'vitest';
import { chunkText } from '../../src/services/chunker.service';

describe('chunkText Service', () => {
  it('should split text into deterministic chunks with specified size and overlap', () => {
    const text = 'abcdefghijklmnopqrstuvwxyz';
    // chunkSize = 10, overlap = 2 -> step = 8
    // Chunk 0: [0..10] "abcdefghij"
    // Chunk 1: [8..18] "ijklmnopqr"
    // Chunk 2: [16..26] "qrstuvwxyz"
    const chunks = chunkText(text, 10, 2);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toEqual({ chunkIndex: 0, text: 'abcdefghij' });
    expect(chunks[1]).toEqual({ chunkIndex: 1, text: 'ijklmnopqr' });
    expect(chunks[2]).toEqual({ chunkIndex: 2, text: 'qrstuvwxyz' });
  });

  it('should return empty array for empty or whitespace-only text', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n  ')).toEqual([]);
  });

  it('should throw error when chunkSize is <= 0 or overlap >= chunkSize', () => {
    expect(() => chunkText('sample text', 0, 0)).toThrow('chunkSize must be greater than 0');
    expect(() => chunkText('sample text', 10, 10)).toThrow(
      'chunkOverlap must be non-negative and strictly less than chunkSize',
    );
  });
});
