import { timingSafeEqual } from 'crypto';

/**
 * Comparação de strings constante no tempo — evita timing attacks em
 * verificação de secrets/tokens em headers (cron, webhooks públicos, etc).
 *
 * Usar SEMPRE no lugar de `provided !== expected` quando comparar segredos.
 *
 * Detalhes:
 *  - Aceita `a` nullable porque headers podem vir ausentes.
 *  - Comprimentos diferentes → retorna false sem chamar timingSafeEqual
 *    (timingSafeEqual exige Buffers de mesmo tamanho; o leak de tamanho
 *    é considerado aceitável em todos os RFCs relevantes).
 *  - Buffer.from(string) usa utf-8; ambos os lados precisam usar utf-8 puro.
 */
export function safeEqual(a: string | null | undefined, b: string): boolean {
  if (!a) return false;
  const ab = Buffer.from(a, 'utf-8');
  const bb = Buffer.from(b, 'utf-8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
