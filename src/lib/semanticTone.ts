/**
 * Regra 1 do DESIGN-SYSTEM.md — cor tem significado fixo, nunca decorativo.
 * Em vez de cada tela escolher `text-green-400`/`text-yellow-400` à mão,
 * escolhe-se o PAPEL do dado e as classes saem daqui.
 *
 * Papéis:
 *  - success  → deu certo, terminou bem (pedido entregue, pagamento aprovado)
 *  - warning  → precisa de atenção, não é erro (pendente, estoque baixo)
 *  - danger   → erro, crítico, irreversível
 *  - price    → exclusivamente valor monetário
 *  - primary  → ação principal / marca
 *  - accent   → ação secundária, novidade
 *  - muted    → apoio, contagem simples, informativo
 */
export type Tone = 'success' | 'warning' | 'danger' | 'price' | 'primary' | 'accent' | 'muted';

export const toneText: Record<Tone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
  price: 'text-price',
  primary: 'text-primary',
  accent: 'text-accent',
  muted: 'text-muted-foreground',
};

export const toneBadge: Record<Tone, string> = {
  success: 'border-success/50 text-success bg-success/10',
  warning: 'border-warning/50 text-warning bg-warning/10',
  danger: 'border-destructive/50 text-destructive bg-destructive/10',
  price: 'border-price/50 text-price bg-price/10',
  primary: 'border-primary/50 text-primary bg-primary/10',
  accent: 'border-accent/50 text-accent bg-accent/10',
  muted: 'border-border text-muted-foreground bg-muted/40',
};

/** Aviso só é aviso quando há algo a fazer (Regra 1: senão é só contagem). */
export const toneForPending = (count: number): Tone => (count > 0 ? 'warning' : 'muted');

/** Crítico só quando existe de fato item crítico. */
export const toneForCritical = (count: number): Tone => (count > 0 ? 'danger' : 'muted');

/** Tier de hierarquia visual (Regra 2 + Regra 7). */
export type Tier = 1 | 2 | 3 | 4;

export const tierValueClass: Record<Tier, string> = {
  1: 'text-3xl font-bold',
  2: 'text-xl font-semibold',
  3: 'text-lg font-semibold',
  4: 'text-sm font-medium',
};

/**
 * Mapa ÚNICO de status → papel de cor, usado por Web, Mobile e Desktop.
 * Cobre pedidos, denúncias, anúncios, trocas, estoque, tickets e torneios.
 * Qualquer status desconhecido cai em `muted` (informativo), nunca em cor decorativa.
 */
const STATUS_TONE: Record<string, Tone> = {
  // sucesso / concluído
  delivered: 'success', entregue: 'success', confirmed: 'success', confirmado: 'success',
  paid: 'success', pago: 'success', aprovado: 'success', approved: 'success',
  concluido: 'success', concluído: 'success', completed: 'success', completado: 'success',
  ativo: 'success', active: 'success', resolvido: 'success', resolved: 'success',
  aceito: 'success', accepted: 'success', verificado: 'success', disponivel: 'success',
  // atenção / em andamento
  pending: 'warning', pendente: 'warning', processing: 'warning', processando: 'warning',
  shipped: 'warning', enviado: 'warning', em_analise: 'warning', analisando: 'warning',
  aguardando: 'warning', awaiting: 'warning', em_andamento: 'warning', open: 'warning',
  aberto: 'warning', low_stock: 'warning', estoque_baixo: 'warning', em_disputa: 'warning',
  // erro / crítico
  cancelled: 'danger', canceled: 'danger', cancelado: 'danger', failed: 'danger',
  falhou: 'danger', rejected: 'danger', rejeitado: 'danger', recusado: 'danger',
  banido: 'danger', banned: 'danger', bloqueado: 'danger', blocked: 'danger',
  expirado: 'danger', expired: 'danger', sem_estoque: 'danger', out_of_stock: 'danger',
  reprovado: 'danger', critico: 'danger', crítico: 'danger', ao_vivo: 'danger', live: 'danger',
  // informativo
  refunded: 'accent', reembolsado: 'accent',
  arquivado: 'muted', archived: 'muted', fechado: 'muted', closed: 'muted',
  rascunho: 'muted', draft: 'muted', inativo: 'muted', inactive: 'muted',
};

export const statusTone = (status?: string | null): Tone =>
  STATUS_TONE[String(status ?? '').trim().toLowerCase()] ?? 'muted';

/** Classe de texto pronta para um status. */
export const statusTextClass = (status?: string | null) => toneText[statusTone(status)];

/** Classe de badge pronta para um status. */
export const statusBadgeClass = (status?: string | null) => toneBadge[statusTone(status)];

/** Estoque: papel depende do limiar, não de uma cor escolhida na tela. */
export const stockTone = (stock: number, threshold = 5): Tone =>
  stock <= 0 ? 'danger' : stock <= threshold ? 'warning' : 'muted';

/**
 * Preset ÚNICO de status de pedido (rótulo PT-BR + papel de cor).
 * Web (Pedidos.tsx, OrderDetailModal.tsx), Mobile e Desktop leem daqui —
 * nenhuma tela deve manter mapa próprio de status de pedido.
 */
const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  processing: 'Processando',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  canceled: 'Cancelado',
  failed: 'Falhou',
  refunded: 'Reembolsado',
};

export interface OrderStatusPreset {
  label: string;
  tone: Tone;
  /** Classe de badge (borda + texto + fundo) já resolvida pelo papel. */
  badgeClass: string;
}

export const orderStatusTone = (status?: string | null): OrderStatusPreset => {
  const key = String(status ?? '').trim().toLowerCase();
  const tone = statusTone(key);
  return { label: ORDER_STATUS_LABEL[key] ?? (status || 'Desconhecido'), tone, badgeClass: toneBadge[tone] };
};
