import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RadarItem {
  product_id: string;
  title: string;
  image_url: string | null;
  count_24h: number;
  count_72h: number;
  score: number;
  evidence: string;
}

const HOUR = 3600_000;

async function fetchDelta(limit = 8): Promise<RadarItem[]> {
  const now = Date.now();
  const since72 = new Date(now - 72 * HOUR).toISOString();
  const since24 = new Date(now - 24 * HOUR).toISOString();

  type ViewRow = { product_id: string | null; viewed_at: string | null };
  type DatedRow = { product_id: string | null; created_at: string | null };

  const [views, posts, reviews] = await Promise.all([
    supabase.from('product_views').select('product_id, viewed_at').gte('viewed_at', since72),
    supabase.from('forum_posts').select('product_id, created_at').gte('created_at', since72).not('product_id', 'is', null),
    supabase.from('avaliacoes').select('product_id, created_at').gte('created_at', since72),
  ]);

  type Bucket = { v24: number; v72: number; p24: number; p72: number; r24: number; r72: number };
  const agg = new Map<string, Bucket>();
  const bump = (pid: string | null, ts: string | null, kind: 'v' | 'p' | 'r') => {
    if (!pid || !ts) return;
    const b = agg.get(pid) ?? { v24: 0, v72: 0, p24: 0, p72: 0, r24: 0, r72: 0 };
    const is24 = ts >= since24;
    if (kind === 'v') { b.v72++; if (is24) b.v24++; }
    if (kind === 'p') { b.p72++; if (is24) b.p24++; }
    if (kind === 'r') { b.r72++; if (is24) b.r24++; }
    agg.set(pid, b);
  };
  ((views.data ?? []) as ViewRow[]).forEach((r) => bump(r.product_id, r.viewed_at, 'v'));
  ((posts.data ?? []) as DatedRow[]).forEach((r) => bump(r.product_id, r.created_at, 'p'));
  ((reviews.data ?? []) as DatedRow[]).forEach((r) => bump(r.product_id, r.created_at, 'r'));

  const ranked = [...agg.entries()]
    .map(([pid, b]) => {
      const c24 = b.v24 + b.p24 + b.r24;
      const c72 = b.v72 + b.p72 + b.r72;
      return { pid, c24, c72, score: c24 * 3 + (c72 - c24) * 1, b };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (ranked.length === 0) return [];

  const { data: products } = await supabase
    .from('produtos')
    .select('id, title, image_url')
    .in('id', ranked.map(r => r.pid));
  const prodMap = new Map((products || []).map(p => [p.id, p]));

  return ranked
    .map(r => {
      const p = prodMap.get(r.pid);
      if (!p) return null;
      const parts: string[] = [];
      if (r.b.v24) parts.push(`${r.b.v24} views`);
      if (r.b.p24) parts.push(`${r.b.p24} posts`);
      if (r.b.r24) parts.push(`${r.b.r24} reviews`);
      const evidence = parts.length ? `${parts.join(' + ')} nas últimas 24h` : `${r.c72} ações nas últimas 72h`;
      return {
        product_id: r.pid,
        title: p.title,
        image_url: p.image_url,
        count_24h: r.c24,
        count_72h: r.c72,
        score: r.score,
        evidence,
      } as RadarItem;
    })
    .filter((x): x is RadarItem => !!x);
}

export function useRadarDelta(limit = 8) {
  return useQuery({
    queryKey: ['radar-delta', limit],
    queryFn: () => fetchDelta(limit),
    staleTime: 5 * 60_000,
  });
}
