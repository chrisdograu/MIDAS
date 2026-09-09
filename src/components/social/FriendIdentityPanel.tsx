import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Gamepad2, Trophy, Clock, Film, Link2, Users, Check, Activity, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface Props { userId: string; }

// GAP-FI03: Ícones por plataforma
const PLATFORM_ICON: Record<string, any> = {
  steam: Gamepad2,
  psn: Trophy,
  xbox: Gamepad2,
  nintendo: Gamepad2,
  epic: Gamepad2,
  battlenet: Gamepad2,
  riot: Gamepad2,
  origin: Gamepad2,
};

const PLATFORM_LABEL: Record<string, string> = {
  steam: 'Steam', psn: 'PlayStation', xbox: 'Xbox', nintendo: 'Nintendo',
  epic: 'Epic Games', battlenet: 'Battle.net', riot: 'Riot', origin: 'EA',
};

// GAP-FI04: Calcular compatibilidade
const calculateCompatibility = (myGames: Set<string>, theirGames: Set<string>): number => {
  if (myGames.size === 0 || theirGames.size === 0) return 0;
  const common = [...myGames].filter(id => theirGames.has(id)).length;
  const total = Math.min(myGames.size, theirGames.size);
  return Math.round((common / total) * 100);
};

export default function FriendIdentityPanel({ userId }: Props) {
  const { user } = useAuth();
  
  const { data: platforms = [] } = useQuery({
    queryKey: ['fi-platforms', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('connected_platforms').select('platform,username,profile_url,is_public')
        .eq('user_id', userId).eq('is_public', true);
      return data || [];
    },
  });
  
  const { data: achievements = [] } = useQuery({
    queryKey: ['fi-achievements', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_achievements' as any).select('*').eq('user_id', userId)
        .order('unlocked_at', { ascending: false }).limit(6);
      return (data as any[]) || [];
    },
  });
  
  const { data: playtime = [] } = useQuery({
    queryKey: ['fi-playtime', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_playtime' as any).select('product_id,hours_played,produto:product_id(title,image_url)')
        .eq('user_id', userId).order('hours_played', { ascending: false }).limit(5);
      return (data as any[]) || [];
    },
  });
  
  const { data: clips = [] } = useQuery({
    queryKey: ['fi-clips', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('game_clips').select('id,title,thumbnail_url,video_url,product_id,created_at')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(6);
      return data || [];
    },
  });

  // GAP-FI04: Jogos em comum
  const { data: commonGames = [] } = useQuery({
    queryKey: ['fi-common', userId, user?.id],
    enabled: !!user && user.id !== userId,
    queryFn: async () => {
      const { data: myGames } = await supabase
        .from('biblioteca_usuario')
        .select('product_id')
        .eq('user_id', user!.id);
      const { data: theirGames } = await supabase
        .from('biblioteca_usuario')
        .select('product_id')
        .eq('user_id', userId);
      const mySet = new Set((myGames || []).map(g => g.product_id));
      const theirSet = new Set((theirGames || []).map(g => g.product_id));
      const common = [...mySet].filter(id => theirSet.has(id));
      const compatibility = calculateCompatibility(mySet, theirSet);
      
      if (common.length === 0) return { games: [], compatibility: 0 };
      
      const { data: prods } = await supabase
        .from('produtos')
        .select('id, title, image_url')
        .in('id', common.slice(0, 6));
      return { games: prods || [], compatibility };
    },
  });

  const totalHours = playtime.reduce((s, p) => s + Number(p.hours_played || 0), 0);
  const nothing = !platforms.length && !achievements.length && !playtime.length && !clips.length && commonGames?.games?.length === 0;
  if (nothing) return null;

  return (
    <div className="space-y-6 mt-6">
      {/* GAP-FI04: Compatibilidade */}
      {commonGames && commonGames.compatibility > 0 && (
        <section className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-sm font-semibold">Compatibilidade gamer</span>
            </div>
            <span className="text-2xl font-bold text-primary">{commonGames.compatibility}%</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {commonGames.games.length} jogos em comum
          </p>
        </section>
      )}

      {platforms.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" /> Plataformas conectadas
          </h2>
          <div className="flex flex-wrap gap-2">
            {platforms.map((p: any, i) => {
              const Icon = PLATFORM_ICON[p.platform] || Gamepad2;
              return (
                <a key={i} href={p.profile_url || '#'} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs bg-card border border-border rounded-full px-3 py-1.5 hover:border-primary/40 transition">
                  <Icon className="h-3 w-3 text-primary" />
                  <span className="font-semibold text-foreground">{PLATFORM_LABEL[p.platform] || p.platform}</span>
                  <span className="text-muted-foreground">· {p.username}</span>
                </a>
              );
            })}
          </div>
        </section>
      )}

      {playtime.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Mais jogados
            <span className="text-xs text-muted-foreground font-normal">({totalHours.toFixed(0)}h totais)</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {playtime.map((p: any) => (
              <div key={p.product_id} className="bg-card border border-border rounded-lg p-2 hover:border-primary/40 transition">
                {p.produto?.image_url && <img src={p.produto.image_url} className="w-full aspect-[3/4] object-cover rounded mb-1" alt="" loading="lazy" />}
                <p className="text-[10px] text-foreground line-clamp-1">{p.produto?.title}</p>
                <p className="text-[10px] text-primary font-bold">{Number(p.hours_played).toFixed(0)}h</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {achievements.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-warning" /> Conquistas recentes
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {achievements.map((a: any) => (
              <div key={a.id} className="bg-card border border-border rounded-lg p-3 hover:border-primary/40 transition">
                <p className="text-xs font-semibold text-foreground line-clamp-1">{a.title || a.name || 'Conquista'}</p>
                {a.description && <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{a.description}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {clips.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Film className="h-4 w-4 text-accent" /> Clipes
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {clips.map(c => (
              <a key={c.id} href={c.video_url} target="_blank" rel="noreferrer"
                className="block bg-card border border-border rounded-lg overflow-hidden group hover:border-primary/40 transition">
                <div className="aspect-video bg-muted relative">
                  {c.thumbnail_url && <img src={c.thumbnail_url} className="w-full h-full object-cover" alt="" loading="lazy" />}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <Gamepad2 className="h-6 w-6 text-white" />
                  </div>
                </div>
                {c.title && <p className="text-[10px] text-foreground p-2 line-clamp-1">{c.title}</p>}
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}