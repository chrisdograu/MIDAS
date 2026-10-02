import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProdutos } from '@/hooks/useProdutos';
import { useAuth } from '@/hooks/useAuth';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { HalfStarDisplay } from '@/components/HalfStarRating';
import { 
  ArrowLeft, Loader2, User, Star, Library, ShoppingBag, Lock, Calendar, 
  Gamepad2, UserPlus, UserCheck, Share2, Clock, Circle, Users, 
  UserX, Crown, ShieldCheck
} from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import LevelTitleBadge from '@/components/LevelTitleBadge';
import FriendIdentityPanel from '@/components/social/FriendIdentityPanel';
import SellerProfileSwitcher from '@/components/seller/SellerProfileSwitcher';
import HighlightsStrip from '@/components/social/HighlightsStrip';
import { formatCurrency, formatMonthYear, formatRelativeTime } from '@/lib/format';
import { toast } from 'sonner';
import { dbWrite } from '@/lib/dbWrite';

const JA_JOGUEI = ['ja_joguei', 'zerado', 'jogando', 'pausado', 'abandonado'];
const formatMemberSince = (iso?: string | null) => {
  if (!iso) return null;
  try {
    return formatMonthYear(iso);
  } catch { return null; }
};

// GAP-580/581: Função unificada de visibilidade (4 níveis)
function canViewContent(
  visibility: string | null | undefined,
  viewerId: string | null | undefined,
  ownerId: string,
  isFriend: boolean,
  isCloseFriend: boolean,
  hasException: boolean,
  isOwn: boolean
): boolean {
  // Se é o próprio usuário, sempre vê
  if (isOwn) return true;
  
  // Se não tem viewer, não vê
  if (!viewerId) return false;
  
  // Se não há configuração, padrão é 'friends'
  const level = visibility || 'friends';
  
  switch (level) {
    case 'public':
    case 'todos':
      return true;
    case 'friends':
    case 'amigos':
      return isFriend;
    case 'close_friends':
    case 'amigos_favoritos':
      return isCloseFriend;
    case 'exceptions':
    case 'excecoes':
      return hasException;
    case 'private':
    case 'ninguem':
    case 'nobody':
      return false;
    default:
      return isFriend; // fallback
  }
}

// GAP-578: Buscar amigos em comum (respeita visibilidade de AMBOS)
async function getMutualFriends(
  userId: string, 
  currentUserId: string,
  targetFriendListVisibility: string | null,
  myFriendListVisibility: string | null,
  isFriend: boolean,
  isCloseFriend: boolean,
  hasException: boolean
): Promise<{ id: string; display_name: string; avatar_url: string | null }[]> {
  
  // Verificar se o usuário atual PODE ver a lista de amigos do alvo
  const canSeeTargetFriends = canViewContent(
    targetFriendListVisibility,
    currentUserId,
    userId,
    isFriend,
    isCloseFriend,
    hasException,
    false
  );
  
  if (!canSeeTargetFriends) return [];
  
  // Verificar se o alvo PODE ver a lista de amigos do usuário atual
  const canSeeMyFriends = canViewContent(
    myFriendListVisibility,
    userId,
    currentUserId,
    isFriend,
    isCloseFriend,
    hasException,
    false
  );
  
  if (!canSeeMyFriends) return [];
  
  // Buscar amigos do usuário visualizado
  const { data: userFriends } = await supabase
    .from('conversas')
    .select('participant_1, participant_2')
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
    .eq('status', 'accepted');
  
  const userFriendIds = new Set<string>();
  (userFriends || []).forEach((c: any) => {
    userFriendIds.add(c.participant_1 === userId ? c.participant_2 : c.participant_1);
  });
  userFriendIds.delete(userId);
  
  if (userFriendIds.size === 0) return [];
  
  // Buscar amigos do usuário atual
  const { data: myFriends } = await supabase
    .from('conversas')
    .select('participant_1, participant_2')
    .or(`participant_1.eq.${currentUserId},participant_2.eq.${currentUserId}`)
    .eq('status', 'accepted');
  
  const myFriendIds = new Set<string>();
  (myFriends || []).forEach((c: any) => {
    myFriendIds.add(c.participant_1 === currentUserId ? c.participant_2 : c.participant_1);
  });
  myFriendIds.delete(currentUserId);
  
  // Interseção
  const mutual = [...userFriendIds].filter(id => myFriendIds.has(id));
  if (mutual.length === 0) return [];
  
  // Buscar perfis dos amigos em comum
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', mutual.slice(0, 6));
  
  return profiles || [];
}

export default function PublicProfile() {
  const { userId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: games = [] } = useProdutos();

  // Perfil público (RPC segura)
  const { data: profile, isLoading } = useQuery({
    queryKey: ['public-profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await (supabase as any).rpc('get_public_profile', { _uid: userId });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row ?? null;
    },
    enabled: !!userId,
  });

  // Verificar se é amigo
  const { data: isFriend = false } = useQuery({
    queryKey: ['is-friend', userId, user?.id],
    queryFn: async () => {
      if (!user || !userId || user.id === userId) return false;
      const { data } = await supabase
        .from('conversas')
        .select('id')
        .or(`and(participant_1.eq.${userId},participant_2.eq.${user.id}),and(participant_1.eq.${user.id},participant_2.eq.${userId})`)
        .eq('status', 'accepted')
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && !!userId,
  });

  // Verificar se é amigo favorito (close friend)
  const { data: isCloseFriend = false } = useQuery({
    queryKey: ['is-close-friend', userId, user?.id],
    queryFn: async () => {
      if (!user || !userId || user.id === userId) return false;
      const { data } = await supabase
        .from('close_friends' as any)
        .select('id')
        .eq('user_id', userId)
        .eq('friend_id', user.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && !!userId && isFriend,
  });

  // Verificar se tem exceção (privacy_grant)
  const { data: hasException = false } = useQuery({
    queryKey: ['privacy-exception', userId, user?.id],
    queryFn: async () => {
      if (!user || !userId || user.id === userId) return false;
      const { data } = await supabase
        .from('privacy_grants' as any)
        .select('id')
        .eq('user_id', userId)
        .eq('granted_user_id', user.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && !!userId,
  });

  // GAP-577: Verificar status de follow
  const { data: followStatus, refetch: refetchFollow } = useQuery({
    queryKey: ['follow-status', user?.id, userId],
    queryFn: async () => {
      if (!user || !userId || user.id === userId) return { isFollowing: false, isRequested: false };
      const { data } = await supabase.from('user_follows')
        .select('status')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .maybeSingle();
      if (data) {
        return { isFollowing: data.status === 'accepted', isRequested: data.status === 'pending' };
      }
      return { isFollowing: false, isRequested: false };
    },
    enabled: !!user && !!userId,
  });

  // GAP-577: Mutation para seguir
  const followMutation = useMutation({
    mutationFn: async () => {
      if (!user || !userId) return;
      if (followStatus?.isFollowing) {
        await dbWrite(
          supabase
            .from('user_follows')
            .delete()
            .eq('follower_id', user.id)
            .eq('following_id', userId)
        );
        toast.success('Deixou de seguir');
      } else {
        const { data: targetProfile } = await supabase
          .from('profiles')
          .select('require_follow_approval')
          .eq('id', userId)
          .maybeSingle();
        
        const needsApproval = (targetProfile as any)?.require_follow_approval || false;
        const status = needsApproval ? 'pending' : 'accepted';
        
        await dbWrite(
          supabase
            .from('user_follows')
            .insert({ follower_id: user.id, following_id: userId, status })
        );
        
        if (needsApproval) {
          toast.info('Pedido de seguimento enviado! Aguarde aprovação.');
        } else {
          toast.success('Seguindo!');
        }
      }
      queryClient.invalidateQueries({ queryKey: ['follow-status', user?.id, userId] });
      refetchFollow();
    },
  });

  // GAP-579: Compartilhar perfil
  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${profile?.display_name || 'Usuário'} - MIDIAS`,
          text: `Confira o perfil de ${profile?.display_name || 'usuário'} na MIDIAS!`,
          url: url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copiado para a área de transferência!');
      }
    } catch {
      // Usuário cancelou ou navegador não suporta
    }
  };

  // GAP-578: Amigos em comum
  const { data: mutualFriends = [] } = useQuery({
    queryKey: ['mutual-friends', userId, user?.id],
    queryFn: async (): Promise<any[]> => {
      if (!userId || !user || user.id === userId) return Promise.resolve([]);
      
      const targetVisibility = (profile as any)?.friend_list_visibility || 'friends';
      // Buscar a visibilidade do usuário atual
      return await supabase
        .from('profiles')
        .select('friend_list_visibility')
        .eq('id', user.id)
        .maybeSingle()
        .then(async ({ data: myProfile }) => {
          const myVisibility = (myProfile as any)?.friend_list_visibility || 'friends';
          return (await getMutualFriends(
            userId,
            user.id,
            targetVisibility,
            myVisibility,
            isFriend,
            isCloseFriend,
            hasException
          )) as any[];
        });
    },
    enabled: !!userId && !!user && user.id !== userId,
    staleTime: 60_000,
  });

  const isOwn = user?.id === userId;

  useDocumentMeta({
    title: profile?.display_name ? `${profile.display_name} · MIDIAS` : 'Perfil · MIDIAS',
    description: (profile?.bio || `Perfil de ${profile?.display_name || 'gamer'} no MIDIAS.`).slice(0, 160),
    image: profile?.avatar_url || profile?.profile_cover_url || undefined,
    type: 'profile',
  });

  // GAP-580: Verificar se o usuário está online (4 níveis)
  const onlineVisibility = (profile as any)?.online_status_visibility || 'friends';
  const canSeeOnline = canViewContent(
    onlineVisibility,
    user?.id,
    userId || '',
    isFriend,
    isCloseFriend,
    hasException,
    isOwn
  );
  
  const isUserOnline = canSeeOnline && profile?.last_seen_at 
    ? new Date(profile.last_seen_at).getTime() > Date.now() - 5 * 60 * 1000
    : false;

  // GAP-581: Verificar se pode ver última atividade (4 níveis)
  const lastActivityVisibility = (profile as any)?.last_activity_visibility || 'friends';
  const canSeeLastActivity = canViewContent(
    lastActivityVisibility,
    user?.id,
    userId || '',
    isFriend,
    isCloseFriend,
    hasException,
    isOwn
  );

  // Configurações de visibilidade para biblioteca (já existem)
  const libraryVisibility = (profile as any)?.library_visibility || 'friends';
  const canSeeLibrary = canViewContent(
    libraryVisibility,
    user?.id,
    userId || '',
    isFriend,
    isCloseFriend,
    hasException,
    isOwn
  );

  // Buscar biblioteca (apenas se puder ver)
  const { data: biblioteca = [] } = useQuery({
    queryKey: ['public-biblioteca', userId, canSeeLibrary],
    queryFn: async () => {
      if (!userId || !canSeeLibrary) return [];
      const { data, error } = await supabase
        .from('biblioteca_usuario')
        .select('product_id, status')
        .eq('user_id', userId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && canSeeLibrary,
  });

  // Reputação (sempre pública)
  const { data: reputation } = useQuery({
    queryKey: ['user-reputation', userId],
    queryFn: async () => {
      if (!userId) return { avg: 0, count: 0 };
      const { data, error } = await supabase
        .from('avaliacoes_usuario')
        .select('rating')
        .eq('reviewed_id', userId);
      if (error) throw error;
      const ratings = data || [];
      const avg = ratings.length ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : 0;
      return { avg, count: ratings.length };
    },
    enabled: !!userId,
  });

  // Anúncios (sempre públicos)
  const { data: anuncios = [] } = useQuery({
    queryKey: ['user-anuncios', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('anuncios')
        .select('*')
        .eq('seller_id', userId)
        .eq('status', 'active');
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // Seller handle
  const { data: sellerHandle } = useQuery({
    queryKey: ['public-seller-handle', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from('seller_profiles' as any)
        .select('handle').eq('user_id', userId!).maybeSingle();
      return ((data as any)?.handle as string | undefined) ?? null;
    },
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!profile) return <div className="container mx-auto px-4 py-16 text-center"><p className="text-muted-foreground">Perfil não encontrado.</p></div>;

  const memberSince = formatMemberSince((profile as any).created_at);

  const libGames = biblioteca.map(b => ({ ...b, game: games.find(g => g.id === b.product_id) })).filter(b => b.game);
  const jaJoguei = libGames.filter(b => JA_JOGUEI.includes(b.status));
  const queroJogar = libGames.filter(b => b.status === 'quero_jogar');
  const favoritos = libGames.filter(b => b.status === 'favoritos');

  const themeColor = (profile as any).theme_color || null;
  const coverUrl = (profile as any).profile_cover_url || null;
  const accentStyle = themeColor ? ({ ['--profile-accent' as any]: themeColor } as React.CSSProperties) : undefined;

  // GAP-578: Ver se pode ver amigos em comum
  const canSeeMutualFriends = mutualFriends.length > 0;

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl" style={accentStyle}>
      <div className="flex items-center justify-between mb-6">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        {/* GAP-579: Compartilhar perfil */}
        <button
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium hover:border-primary/40 transition-colors"
        >
          <Share2 className="h-3.5 w-3.5" /> Compartilhar
        </button>
      </div>

      <SellerProfileSwitcher
        userId={userId}
        personalHandle={(profile.display_name || '').toLowerCase() || null}
        sellerHandle={sellerHandle ?? null}
        hasSeller={!!sellerHandle}
        isOwn={isOwn}
      />

      {/* Banner customizado */}
      {coverUrl && (
        <div className="rounded-xl overflow-hidden mb-4 h-32 sm:h-40 relative">
          <img src={coverUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
          {themeColor && <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${themeColor}30, transparent)` }} />}
        </div>
      )}

      {/* Profile header */}
      <div className="bg-card border-2 rounded-xl p-6 mb-6 text-center" style={themeColor ? { borderColor: `${themeColor}60` } : undefined}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: themeColor ? `${themeColor}30` : undefined }}>
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" loading="lazy" />
          ) : (
            <User className="h-8 w-8" style={themeColor ? { color: themeColor } : undefined} />
          )}
        </div>
        <h1 className="text-xl font-bold text-foreground">{profile.display_name || 'Usuário'}</h1>
        
        {/* GAP-580: Online agora + GAP-581: Última atividade */}
        {canSeeOnline && (
          <div className="flex items-center justify-center gap-2 mt-1">
            <div className={`flex items-center gap-1 text-xs ${isUserOnline ? 'text-success' : 'text-muted-foreground'}`}>
              <Circle className={`h-2.5 w-2.5 ${isUserOnline ? 'fill-success' : ''}`} />
              {isUserOnline ? 'Online agora' : 'Offline'}
            </div>
            {!isUserOnline && canSeeLastActivity && profile.last_seen_at && (
              <span className="text-xs text-muted-foreground">
                · visto por último {formatRelativeTime(profile.last_seen_at)}
              </span>
            )}
          </div>
        )}
        
        <div className="mt-2 flex justify-center"><LevelTitleBadge userId={profile.id} variant="card" /></div>
        {memberSince && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" /> Membro desde {memberSince}
          </p>
        )}
        {profile.bio && <p className="text-sm text-muted-foreground mt-2">{profile.bio}</p>}
        {reputation && reputation.count > 0 && (
          <div className="flex items-center justify-center gap-2 mt-3">
            <HalfStarDisplay rating={reputation.avg} size={16} />
            <span className="text-sm text-foreground font-medium">{reputation.avg.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">({reputation.count} avaliações)</span>
          </div>
        )}
        
        {/* GAP-577: Botão Seguir */}
        {!isOwn && user && (
          <div className="mt-4">
            <button
              onClick={() => followMutation.mutate()}
              disabled={followMutation.isPending}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                followStatus?.isFollowing
                  ? 'bg-secondary text-foreground border border-border hover:bg-muted'
                  : followStatus?.isRequested
                  ? 'bg-warning/10 text-warning border border-warning/30'
                  : 'bg-primary text-primary-foreground hover:opacity-90'
              } disabled:opacity-50`}
            >
              {followMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : followStatus?.isFollowing ? (
                <><UserCheck className="h-4 w-4" /> Seguindo</>
              ) : followStatus?.isRequested ? (
                <><Clock className="h-4 w-4" /> Aguardando</>
              ) : (
                <><UserPlus className="h-4 w-4" /> Seguir</>
              )}
            </button>
          </div>
        )}
        
        {/* GAP-578: Amigos em comum */}
        {!isOwn && canSeeMutualFriends && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {mutualFriends.length} {mutualFriends.length === 1 ? 'amigo em comum' : 'amigos em comum'}
            </p>
            <div className="flex items-center justify-center gap-1 mt-1.5">
              {mutualFriends.slice(0, 5).map(f => (
                <Link key={f.id} to={`/perfil/${f.id}`} className="hover:opacity-80 transition-opacity">
                  <div className="w-6 h-6 rounded-full bg-secondary overflow-hidden">
                    {f.avatar_url ? (
                      <img src={f.avatar_url} alt={f.display_name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[8px] font-semibold text-muted-foreground">
                        {(f.display_name || '?')[0]}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
              {mutualFriends.length > 5 && (
                <span className="text-[10px] text-muted-foreground">+{mutualFriends.length - 5}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Biblioteca — respeita library_visibility (4 níveis) */}
      {!canSeeLibrary ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
          <Lock className="h-8 w-8 mx-auto mb-2 opacity-60" />
          <p className="text-sm font-semibold text-foreground">Biblioteca privada</p>
          <p className="text-xs mt-1">Este usuário não compartilha sua biblioteca publicamente.</p>
        </div>
      ) : (
        <>
          {userId && <HighlightsStrip userId={userId} />}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <Library className="h-5 w-5 text-primary mx-auto mb-1" />
              <p className="text-lg font-bold text-foreground">{biblioteca.length}</p>
              <p className="text-[10px] text-muted-foreground">Na biblioteca</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <ShoppingBag className="h-5 w-5 text-accent mx-auto mb-1" />
              <p className="text-lg font-bold text-foreground">{anuncios.length}</p>
              <p className="text-[10px] text-muted-foreground">Anúncios</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <Star className="h-5 w-5 text-price mx-auto mb-1" />
              <p className="text-lg font-bold text-foreground">{reputation?.avg.toFixed(1) || '0'}</p>
              <p className="text-[10px] text-muted-foreground">Reputação</p>
            </div>
          </div>

          {/* Library sections */}
          {[
            { title: 'Já Joguei', items: jaJoguei, emoji: '🎮' },
            { title: 'Quero Jogar', items: queroJogar, emoji: '📋' },
            { title: 'Favoritos', items: favoritos, emoji: '⭐' },
          ].map(section => section.items.length > 0 && (
            <div key={section.title} className="mb-6">
              <h2 className="text-sm font-bold text-foreground mb-3">{section.emoji} {section.title} ({section.items.length})</h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {section.items.map(item => item.game && (
                  <Link key={item.product_id} to={`/jogo/${item.product_id}`} className="group">
                    <img src={item.game.image} alt={item.game.title} className="w-full aspect-[3/4] object-cover rounded-lg group-hover:ring-2 ring-primary transition-all" loading="lazy" />
                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{item.game.title}</p>
                  </Link>
                ))}
              </div>
            </div>
          ))}

          {jaJoguei.length === 0 && queroJogar.length === 0 && favoritos.length === 0 && (
            <EstadoVazio
              icone={Gamepad2}
              titulo="Biblioteca vazia"
              descricao="Este usuário ainda não adicionou jogos à biblioteca."
            />
          )}

          {userId && <FriendIdentityPanel userId={userId} />}
        </>
      )}

      {/* Anúncios (sempre públicos) */}
      {anuncios.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-bold text-foreground mb-3">🏷️ Anúncios Ativos</h2>
          <div className="space-y-2">
            {anuncios.map((a: any) => (
              <Link key={a.id} to={`/m/marketplace/${a.id}`} className="bg-card border border-border rounded-lg p-3 flex justify-between items-center hover:border-primary/40 transition-all block">
                <div>
                  <p className="text-sm font-medium text-foreground">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.platform} • {a.condition}</p>
                </div>
                {a.price > 0 && <span className="text-sm font-bold text-price">{formatCurrency(Number(a.price))}</span>}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}