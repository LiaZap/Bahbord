/**
 * Cache simples in-memory com TTL pra queries recorrentes do mesmo processo.
 *
 * Usado em endpoints que servem listas estáveis (members, projects, options) onde
 * dado fresh-de-30s é aceitável. NÃO usar pra dados sensíveis a permissão por
 * usuário (chave deve incluir tudo que muda o resultado).
 *
 * Em ambiente serverless cada instância tem seu próprio cache — comportamento
 * intencional: simplicidade > consistência forte. Pra invalidação cross-instance
 * usaríamos Redis, mas pra TTLs de 30-60s o overhead não compensa.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// Map global compartilhado entre invocações dentro do mesmo processo Node.
// Em dev usamos globalThis pra sobreviver hot-reload do Next.
declare global {
  // eslint-disable-next-line no-var
  var __ruflo_cache: Map<string, CacheEntry<unknown>> | undefined;
}

const cache: Map<string, CacheEntry<unknown>> =
  globalThis.__ruflo_cache ?? new Map<string, CacheEntry<unknown>>();
if (process.env.NODE_ENV !== 'production') globalThis.__ruflo_cache = cache;

// Limite pra evitar leak: 500 chaves é suficiente pra cobrir options/projects/members
// com várias variações de query. Se passar, descarta a entrada mais antiga.
const MAX_ENTRIES = 500;

/**
 * Recupera valor do cache ou executa queryFn e armazena por ttlMs.
 *
 * @param key  Chave única (inclua todos os params que afetam o resultado).
 * @param queryFn  Função async que produz o valor quando há miss.
 * @param ttlMs  Tempo de vida em ms. Default 30s.
 *
 * @example
 *   const projects = await cachedQuery(
 *     `projects:ws:${workspaceId}`,
 *     () => query('SELECT id, name FROM projects WHERE workspace_id = $1', [workspaceId]),
 *     60_000
 *   );
 */
export async function cachedQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  ttlMs = 30_000
): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key) as CacheEntry<T> | undefined;

  if (hit && hit.expiresAt > now) {
    return hit.value;
  }

  const value = await queryFn();

  if (cache.size >= MAX_ENTRIES && !cache.has(key)) {
    // Remove a entrada mais antiga (Map mantém ordem de inserção)
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }

  cache.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

/**
 * Invalida explicitamente uma chave (útil após write que afeta cache).
 */
export function invalidateCache(key: string): void {
  cache.delete(key);
}

/**
 * Invalida todas as chaves que comecem com prefix.
 *
 * @example invalidateCachePrefix('projects:') // limpa todas as variações de projects
 */
export function invalidateCachePrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

/**
 * Limpa todo o cache. Usado em testes e shutdown.
 */
export function clearCache(): void {
  cache.clear();
}
