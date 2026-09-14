/**
 * Formatação centralizada (PT-BR).
 *
 * Antes desta camada, 32 arquivos concatenavam `R$ ${v.toLocaleString('pt-BR', ...)}`
 * na mão, cada um com opções próprias. Aqui existe uma única definição de cada
 * formato — moeda via `Intl.NumberFormat` nativo e as 3 variações de data que já
 * estavam espalhadas pelo projeto.
 */

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dateShortFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const monthYearFmt = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

function toDate(date: string | number | Date): Date | null {
  if (date === null || date === undefined || date === '') return null;
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** R$ 1.234,50 */
export function formatCurrency(valor: number | null | undefined): string {
  return currencyFmt.format(Number(valor) || 0);
}

/** 09/08/2026 */
export function formatDate(date: string | number | Date | null | undefined): string {
  const d = toDate(date as string);
  return d ? dateFmt.format(d) : '—';
}

/** 09/08 */
export function formatDateShort(date: string | number | Date | null | undefined): string {
  const d = toDate(date as string);
  return d ? dateShortFmt.format(d) : '—';
}

/** 09/08/2026 22:35 */
export function formatDateTime(date: string | number | Date | null | undefined): string {
  const d = toDate(date as string);
  return d ? dateTimeFmt.format(d) : '—';
}

/** agosto de 2026 */
export function formatMonthYear(date: string | number | Date | null | undefined): string {
  const d = toDate(date as string);
  return d ? monthYearFmt.format(d) : '—';
}

/** 22:35 */
export function formatTime(date: string | number | Date | null | undefined): string {
  const d = toDate(date as string);
  return d ? timeFmt.format(d) : '—';
}

/** "há 5 min", "há 2 h", "há 3 d" */
export function formatRelativeTime(date: string | number | Date | null | undefined): string {
  const d = toDate(date as string);
  if (!d) return '—';
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const dd = Math.floor(h / 24);
  if (dd < 30) return `há ${dd} d`;
  const m = Math.floor(dd / 30);
  if (m < 12) return `há ${m} mês${m > 1 ? 'es' : ''}`;
  return `há ${Math.floor(m / 12)} ano(s)`;
}


export const timeAgo = formatRelativeTime;
