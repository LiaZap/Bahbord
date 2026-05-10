'use client';

/**
 * Wrapper fino sobre react-window pra virtualizar listas longas (>50 itens).
 *
 * Estratégia:
 *  - Se a lista tiver menos itens que `threshold` (default 50), renderiza
 *    direto sem virtualização — o overhead do react-window não compensa pra
 *    listas curtas e perdemos features nativas (Cmd+F, scroll-into-view).
 *  - Acima do threshold, usa FixedSizeList do react-window com altura por
 *    item igual a `itemSize` (default 56px — ~uma linha de tabela média).
 *
 * Uso típico:
 *   <VirtualList items={tickets} itemSize={48} height={600}>
 *     {(ticket) => <TicketRow ticket={ticket} />}
 *   </VirtualList>
 *
 * O componente assume que cada item já tem altura fixa via CSS. Se as linhas
 * mudarem de altura, troque por VariableSizeList (não exposto aqui pra manter
 * a API simples).
 */

import { useEffect, useRef, useState, type ReactElement } from 'react';

interface VirtualListProps<T> {
  items: T[];
  /** Altura fixa de cada linha em px. Default 56 (linha de tabela compacta). */
  itemSize?: number;
  /** Altura visível do container em px. Default 600. */
  height?: number;
  /**
   * Mínimo de itens pra virtualizar. Abaixo disso renderiza tudo direto pra
   * preservar Cmd+F nativo e evitar overhead. Default 50.
   */
  threshold?: number;
  /** Render function por item. Recebe o item e o index. */
  children: (item: T, index: number) => ReactElement;
  /** Classe extra pro container. */
  className?: string;
  /** Função de extração de key. Default: index. */
  itemKey?: (item: T, index: number) => string | number;
}

// Tipos mínimos pra react-window — usamos apenas FixedSizeList. Quando o
// pacote estiver instalado o tsc resolve normalmente; antes disso este shim
// evita erro de "module not found".
type ListChildComponent<P> = (props: { index: number; style: React.CSSProperties; data: P }) => ReactElement;

interface FixedSizeListProps<P> {
  height: number;
  itemCount: number;
  itemSize: number;
  width: number | string;
  itemData?: P;
  children: ListChildComponent<P>;
}

type FixedSizeListComponent = <P,>(props: FixedSizeListProps<P>) => ReactElement;

export default function VirtualList<T>({
  items,
  itemSize = 56,
  height = 600,
  threshold = 50,
  children,
  className,
  itemKey,
}: VirtualListProps<T>) {
  const [Mod, setMod] = useState<{ FixedSizeList: FixedSizeListComponent } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Só carrega o pacote se de fato vamos virtualizar.
    if (items.length < threshold) return;
    let cancelled = false;
    import('react-window')
      .then((mod) => {
        if (!cancelled) {
          setMod({ FixedSizeList: (mod as unknown as { FixedSizeList: FixedSizeListComponent }).FixedSizeList });
        }
      })
      .catch(() => {
        // Falha em carregar (pacote não instalado): degrada gracefully pro
        // render não-virtualizado abaixo.
      });
    return () => { cancelled = true; };
  }, [items.length, threshold]);

  // Lista pequena ou pacote ainda não carregou → render direto
  if (items.length < threshold || !Mod) {
    return (
      <div ref={containerRef} className={className}>
        {items.map((item, idx) => (
          <div key={itemKey ? itemKey(item, idx) : idx}>
            {children(item, idx)}
          </div>
        ))}
      </div>
    );
  }

  const Row: ListChildComponent<{ items: T[]; render: (item: T, index: number) => ReactElement }> = ({ index, style, data }) => (
    <div style={style}>{data.render(data.items[index], index)}</div>
  );

  return (
    <div ref={containerRef} className={className}>
      <Mod.FixedSizeList
        height={height}
        itemCount={items.length}
        itemSize={itemSize}
        width="100%"
        itemData={{ items, render: children }}
      >
        {Row}
      </Mod.FixedSizeList>
    </div>
  );
}
