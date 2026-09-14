// Item 3 — Radar PESSOAL (coexiste com o "Em Alta" geral do useRadarDelta).
// Só considera sinais que têm a ver COM VOCÊ:
//   1. produtos de gêneros que já estão na sua biblioteca;
//   2. ações de quem você segue (user_follows).
// Peso por tipo de sinal (não só recência): view=1, like=2, review=4, post=6.
// Ação de quem você segue ganha bônus multiplicador em cima do peso base.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface RadarPessoalItem {
  product_id: string;
  title: string;
  image_url: string | null;
  score: number;
  evidence: string;
  friends: number;
  source?: 'friends' | 'genres' | 'trending' | string;
  recent_date?: number;
}

const W = { view: 1, like: 2, review: 4, post: 6 } as const;
const FOLLOW_BONUS = 2.5;

export function useRadarPessoal(limit = 6) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['radar-pessoal', user?.id, limit],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<RadarPessoalItem[]> => {
      const uid = user!.id;
      const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

      const [{ data: lib }, { data: follows }] = await Promise.all([
        supabase.from('biblioteca_usuario').select('product_id').eq('user_id', uid),
        supabase.from('user_follows').select('following_id').eq('follower_id', uid),
      ]);

      const libIds = (lib || []).map((r: { product_id: string }) => r.product_id);
      const followIds = new Set((follows || []).map((r: { following_id: string }) => r.following_id));

      // gêneros da biblioteca
      let genres: string[] = [];
      if (libIds.length) {
        const { data: libProds } = await supabase.from('produtos').select('category').in('id', libIds);
        genres = [...new Set(((libProds || []) as { category: string | null }[])
          .map(p => p.category).filter(Boolean) as string[])];
      }
      if (!genres.length && !followIds.size) return [];

      const [views, posts, reviews] = await Promise.all([
        supabase.from('product_views').select('product_id, user_id, viewed_at').gte('viewed_at', since),
        supabase.from('forum_posts').select('product_id, user_id, likes_count, created_at')
          .gte('created_at', since).not('product_id', 'is', null),
        supabase.from('avaliacoes').select('product_id, user_id, created_at').gte('created_at', since),
      ]);

      type Agg = { score: number; friends: Set<string>; posts: number; reviews: number; views: number };
      const agg = new Map<string, Agg>();
      const bump = (pid: string | null | undefined, actor: string | null | undefined, weight: number, kind: 'view' | 'post' | 'review') => {
        if (!pid) return;
        const isFriend = !!actor && followIds.has(actor);
        const a = agg.get(pid) ?? { score: 0, friends: new Set<string>(), posts: 0, reviews: 0, views: 0 };
        a.score += weight * (isFriend ? FOLLOW_BONUS : 1);
        if (isFriend && actor) a.friends.add(actor);
        if (kind === 'post') a.posts++;
        if (kind === 'review') a.reviews++;
        if (kind === 'view') a.views++;
        agg.set(pid, a);
      };

      ((views.data || []) as any[]).forEach(r => bump(r.product_id, r.user_id, W.view, 'view'));
      ((reviews.data || []) as any[]).forEach(r => bump(r.product_id, r.user_id, W.review, 'review'));
      ((posts.data || []) as any[]).forEach(r => {
        bump(r.product_id, r.user_id, W.post, 'post');
        const likes = Number(r.likes_count || 0);
        if (likes > 0) bump(r.product_id, r.user_id, likes * W.like, 'post');
      });

      const ids = [...agg.keys()];
      if (!ids.length) return [];
      const { data: prods } = await supabase.from('produtos')
        .select('id, title, image_url, category').in('id', ids).eq('is_active', true);

      const owned = new Set(libIds);
      return ((prods || []) as any[])
        .filter(p => !owned.has(p.id))
        .map(p => {
          const a = agg.get(p.id)!;
          const relevant = genres.includes(p.category) || a.friends.size > 0;
          if (!relevant) return null;
          const f = a.friends.size;
          const evidence = f > 0
            ? `${f} ${f === 1 ? 'pessoa que você segue interagiu' : 'pessoas que você segue interagiram'} com isso essa semana`
            : `Combina com ${p.category} — ${a.posts} discussões e ${a.reviews} reviews recentes`;
          return {
            product_id: p.id, title: p.title, image_url: p.image_url,
            score: Math.round(a.score), evidence, friends: f,
          } as RadarPessoalItem;
        })
        .filter(Boolean as unknown as (x: RadarPessoalItem | null) => x is RadarPessoalItem)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    },
  });
}
