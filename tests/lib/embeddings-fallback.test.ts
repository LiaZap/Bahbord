import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// `lib/embeddings.ts` imports `./db` (which connects to Postgres at module load).
// We mock it BEFORE importing the SUT so the test stays purely unit-level.
vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}));

// Same for the OpenAI client — we never want a real network call.
vi.mock('openai', () => {
  const create = vi.fn();
  class FakeOpenAI {
    embeddings = { create };
  }
  return { default: FakeOpenAI };
});

import {
  cosineSimilarity,
  isEmbeddingAvailable,
  findSimilarTickets,
  upsertTicketEmbedding,
} from '@/lib/embeddings';
import { query } from '@/lib/db';

describe('lib/embeddings — pure helpers & unavailable-key fallbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('cosineSimilarity', () => {
    it('returns 1 for identical unit vectors', () => {
      expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBe(1);
    });

    it('returns 0 for orthogonal vectors', () => {
      expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBe(0);
    });

    it('returns -1 for antiparallel vectors', () => {
      expect(cosineSimilarity([1, 0], [-1, 0])).toBe(-1);
    });

    it('returns ~0.5 for known vectors (sanity)', () => {
      // [1,1] vs [1,0] → cos = 1 / sqrt(2) ≈ 0.7071
      const v = cosineSimilarity([1, 1], [1, 0]);
      expect(v).toBeCloseTo(0.7071, 3);
    });

    it('returns 0 when both arrays are empty', () => {
      expect(cosineSimilarity([], [])).toBe(0);
    });

    it('returns 0 when dimensions differ', () => {
      expect(cosineSimilarity([1, 2, 3], [1, 2])).toBe(0);
    });

    it('returns 0 when one vector is zero (avoids div-by-zero)', () => {
      expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
      expect(cosineSimilarity([1, 2, 3], [0, 0, 0])).toBe(0);
    });

    it('returns 0 when an arg is null/undefined (defensive)', () => {
      expect(cosineSimilarity(null as unknown as number[], [1, 2])).toBe(0);
      expect(cosineSimilarity([1, 2], undefined as unknown as number[])).toBe(0);
    });
  });

  describe('isEmbeddingAvailable', () => {
    it('returns false when OPENAI_API_KEY is unset', () => {
      vi.stubEnv('OPENAI_API_KEY', '');
      expect(isEmbeddingAvailable()).toBe(false);
    });

    it('returns true when OPENAI_API_KEY is set to a non-empty string', () => {
      vi.stubEnv('OPENAI_API_KEY', 'sk-test-key');
      expect(isEmbeddingAvailable()).toBe(true);
    });
  });

  describe('upsertTicketEmbedding (no-key fallback)', () => {
    it('silently skips DB write when OPENAI_API_KEY is missing', async () => {
      vi.stubEnv('OPENAI_API_KEY', '');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await upsertTicketEmbedding('ticket-123', 'title', 'desc');

      expect(query).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('findSimilarTickets (no-key fallback)', () => {
    it('throws when OPENAI_API_KEY is missing (generateEmbedding gate)', async () => {
      vi.stubEnv('OPENAI_API_KEY', '');
      // findSimilarTickets calls generateEmbedding first which throws when no key.
      await expect(
        findSimilarTickets('Login broken', '11111111-2222-4333-8444-555555555555')
      ).rejects.toThrow(/OPENAI_API_KEY/);
      // No DB call should have happened — we failed before query().
      expect(query).not.toHaveBeenCalled();
    });
  });
});
