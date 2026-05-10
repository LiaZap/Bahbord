import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  cachedQuery,
  invalidateCache,
  invalidateCachePrefix,
  clearCache,
} from '@/lib/cache';

describe('lib/cache', () => {
  beforeEach(() => {
    clearCache();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    clearCache();
  });

  describe('cachedQuery', () => {
    it('returns same value on subsequent calls within TTL (executes fn once)', async () => {
      const fn = vi.fn(async () => 'value-1');
      const a = await cachedQuery('k1', fn, 1000);
      const b = await cachedQuery('k1', fn, 1000);
      const c = await cachedQuery('k1', fn, 1000);
      expect(a).toBe('value-1');
      expect(b).toBe('value-1');
      expect(c).toBe('value-1');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('re-executes fn after TTL expires', async () => {
      let counter = 0;
      const fn = vi.fn(async () => `v${++counter}`);
      const first = await cachedQuery('k1', fn, 1000);
      expect(first).toBe('v1');
      // Advance just under TTL — still cached
      vi.advanceTimersByTime(999);
      const stillCached = await cachedQuery('k1', fn, 1000);
      expect(stillCached).toBe('v1');
      expect(fn).toHaveBeenCalledTimes(1);
      // Advance past TTL — must re-execute
      vi.advanceTimersByTime(2);
      const refreshed = await cachedQuery('k1', fn, 1000);
      expect(refreshed).toBe('v2');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('different keys are cached independently', async () => {
      const fnA = vi.fn(async () => 'A');
      const fnB = vi.fn(async () => 'B');
      const a1 = await cachedQuery('alpha', fnA, 5000);
      const b1 = await cachedQuery('beta', fnB, 5000);
      const a2 = await cachedQuery('alpha', fnA, 5000);
      const b2 = await cachedQuery('beta', fnB, 5000);
      expect(a1).toBe('A');
      expect(a2).toBe('A');
      expect(b1).toBe('B');
      expect(b2).toBe('B');
      expect(fnA).toHaveBeenCalledTimes(1);
      expect(fnB).toHaveBeenCalledTimes(1);
    });

    it('does not pollute cache when fn throws (next call re-executes)', async () => {
      let attempt = 0;
      const fn = vi.fn(async () => {
        attempt++;
        if (attempt === 1) throw new Error('boom');
        return 'recovered';
      });

      await expect(cachedQuery('flaky', fn, 1000)).rejects.toThrow('boom');
      const result = await cachedQuery('flaky', fn, 1000);
      expect(result).toBe('recovered');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('uses default TTL of 30s when not specified', async () => {
      const fn = vi.fn(async () => 'default');
      await cachedQuery('default-ttl', fn);
      vi.advanceTimersByTime(29_000);
      await cachedQuery('default-ttl', fn);
      expect(fn).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(2_000);
      await cachedQuery('default-ttl', fn);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('invalidateCache', () => {
    it('forces re-execution on next call', async () => {
      const fn = vi.fn(async () => Math.random());
      const v1 = await cachedQuery('inv', fn, 60_000);
      const v2 = await cachedQuery('inv', fn, 60_000);
      expect(v1).toBe(v2);
      expect(fn).toHaveBeenCalledTimes(1);

      invalidateCache('inv');
      await cachedQuery('inv', fn, 60_000);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('invalidating non-existent key is no-op', () => {
      expect(() => invalidateCache('does-not-exist')).not.toThrow();
    });
  });

  describe('invalidateCachePrefix', () => {
    it('invalidates all keys with given prefix and leaves others', async () => {
      const teamsA = vi.fn(async () => 'teams-A');
      const teamsB = vi.fn(async () => 'teams-B');
      const projects = vi.fn(async () => 'projects');

      await cachedQuery('teams:1', teamsA, 60_000);
      await cachedQuery('teams:2', teamsB, 60_000);
      await cachedQuery('projects:1', projects, 60_000);

      invalidateCachePrefix('teams:');

      await cachedQuery('teams:1', teamsA, 60_000);
      await cachedQuery('teams:2', teamsB, 60_000);
      await cachedQuery('projects:1', projects, 60_000);

      expect(teamsA).toHaveBeenCalledTimes(2);
      expect(teamsB).toHaveBeenCalledTimes(2);
      expect(projects).toHaveBeenCalledTimes(1);
    });

    it('empty-prefix behaviour: invalidates everything (startsWith("") is always true)', async () => {
      const fn = vi.fn(async () => 'x');
      await cachedQuery('a', fn, 60_000);
      await cachedQuery('b', fn, 60_000);
      invalidateCachePrefix('');
      await cachedQuery('a', fn, 60_000);
      await cachedQuery('b', fn, 60_000);
      expect(fn).toHaveBeenCalledTimes(4);
    });
  });

  describe('FIFO eviction (insertion order, not access order)', () => {
    // O cache atual NÃO atualiza posição em get — eviction é puro FIFO
    // (Map mantém ordem de inserção). Read não revive a entrada.
    it('evicts oldest by INSERTION when MAX_ENTRIES (500) is reached', async () => {
      const make = (key: string) => vi.fn(async () => key);

      const fns: Record<string, ReturnType<typeof make>> = {};
      for (let i = 0; i < 500; i++) {
        const key = `k${i}`;
        fns[key] = make(key);
        await cachedQuery(key, fns[key], 60_000);
      }

      // k0 ainda no cache (sanity check)
      await cachedQuery('k0', fns['k0'], 60_000);
      expect(fns['k0']).toHaveBeenCalledTimes(1);

      // Inserir nova key → evicta k0 (mais antigo por insertion order)
      const newFn = make('k500');
      await cachedQuery('k500', newFn, 60_000);

      // k0 evictado — re-executa
      await cachedQuery('k0', fns['k0'], 60_000);
      expect(fns['k0']).toHaveBeenCalledTimes(2);

      // Inserir mais uma key → evicta k1 (próximo na fila FIFO)
      // — note: NÃO é k500 nem k0 (que foi re-inserido como mais novo)
      await cachedQuery('k501', make('k501'), 60_000);

      await cachedQuery('k1', fns['k1'], 60_000);
      expect(fns['k1']).toHaveBeenCalledTimes(2); // re-executou (foi evictado)
    });
  });
});
