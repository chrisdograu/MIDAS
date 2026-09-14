export function timeAgo(dateStr: string | null | undefined) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return 'agora';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day}d`;
  const w = Math.floor(day / 7);
  if (w < 5) return `${w}sem`;
  const m = Math.floor(day / 30);
  if (m < 12) return `${m}mês`;
  return `${Math.floor(day / 365)}a`;
}

export type Period = 'day' | 'week' | 'month' | 'bimester' | 'semester' | 'year' | 'all';

export const PERIOD_OPTIONS: { id: Period; label: string }[] = [
  { id: 'day', label: 'Hoje' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mês' },
  { id: 'bimester', label: 'Bimestre' },
  { id: 'semester', label: 'Semestre' },
  { id: 'year', label: 'Ano' },
  { id: 'all', label: 'Todos' },
];

export function periodSince(p: Period): Date | null {
  if (p === 'all') return null;
  const D = 24 * 3600e3;
  const map: Record<Exclude<Period, 'all'>, number> = {
    day: D,
    week: 7 * D,
    month: 30 * D,
    bimester: 60 * D,
    semester: 180 * D,
    year: 365 * D,
  };
  return new Date(Date.now() - map[p]);
}
