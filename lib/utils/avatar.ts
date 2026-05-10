/**
 * Avatar helpers — initials e cores determinísticas a partir do nome.
 *
 * Use em qualquer componente que renderize avatar fallback (sem imagem).
 * Mantenha estes helpers como única fonte de verdade pra evitar variações
 * sutis de comportamento (ex.: como tratar nomes vazios, acentos, multi-word).
 */

/**
 * Returns 1-2 letter initials from a display name.
 * Uses first letter of first word + first letter of last word.
 * Falls back to "?" for empty/null.
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

/**
 * Deterministic color from name string (for avatar background fallback).
 * Returns a CSS HSL color string.
 */
export function colorFromName(name: string | null | undefined): string {
  if (!name) return 'hsl(220, 30%, 60%)';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 50%, 60%)`;
}
