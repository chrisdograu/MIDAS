import { useEffect, useState } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Loader2,
  ShoppingBag,
  Settings,
  LogOut,
  Send,
  Flag,
  ShieldOff,
  ArrowLeft,
  UserPlus,
  UserCheck,
  Users,
  Lock,
  Star,
  Newspaper,
  BookMarked,
  Palette,
  Edit2,
  Save,
  X,
} from "lucide-react";
import EstadoVazio from "@/components/EstadoVazio";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { HalfStarDisplay } from "@/components/HalfStarRating";
import LevelBadge from "@/components/LevelBadge";
import LevelTitleBadge from "@/components/LevelTitleBadge";
import UserBadges from "@/components/UserBadges";
import { useFollow } from "@/mobile/lib/useFollow";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import CustomizacaoTab from "@/components/perfil/CustomizacaoTab";
import { ProfileCosmeticOverlay } from "@/components/cosmetics/ProfileCosmeticOverlay";
import { CosmeticUnlocksCenter } from "@/components/cosmetics/CosmeticUnlocksCenter";
import { formatCurrency, formatMonthYear } from "@/lib/format";
import { dbWrite } from "@/lib/dbWrite";

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  seller_bio?: string | null;
  username: string | null;
  is_private?: boolean;
  created_at?: string | null;
}
const JA_JOGUEI_STATUSES = ["ja_joguei", "zerado", "jogando", "pausado", "abandonado"];
interface Ad {
  id: string;
  title: string;
  price: number;
  image: string | null;
}
interface ReviewItem {
  id: string;
  product_id: string;
  product: string;
  rating: number;
  comment: string | null;
  created_at: string;
}
interface PostItem {
  id: string;
  product_id: string;
  product: string;
  content: string;
  created_at: string;
  likes_count: number;
}
interface LibItem {
  product_id: string;
  title: string;
  image_url: string | null;
  status: string;
}

export default function MProfile() {
  const { userId } = useParams();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetId = userId || user?.id;
  const isOwn = !userId || userId === user?.id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sellerProfile, setSellerProfile] = useState<any | null>(null);
  const [rating, setRating] = useState(0);
  const [ads, setAds] = useState<Ad[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [library, setLibrary] = useState<LibItem[]>([]);
  const [reviewsCount, setReviewsCount] = useState(0);
  const [postsCount, setPostsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"ads" | "reviews" | "posts" | "lib">("reviews");
  const [mode, setMode] = useState<"pessoal" | "vendedor">(() => {
    try {
      return (localStorage.getItem("m:profileMode") as any) || "pessoal";
    } catch {
      return "pessoal";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("m:profileMode", mode);
    } catch {}
    setTab(mode === "vendedor" ? "ads" : "reviews");
  }, [mode]);
  const [libFilter, setLibFilter] = useState<"all" | "quero_jogar" | "ja_joguei">(() => {
    try {
      return (localStorage.getItem("m:libFilter") as any) || "all";
    } catch {
      return "all";
    }
  });
  const [libPage, setLibPage] = useState(1);
  const LIB_PAGE_SIZE = 18;
  useEffect(() => {
    try {
      localStorage.setItem("m:libFilter", libFilter);
    } catch {}
    setLibPage(1);
  }, [libFilter]);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [customizeOpen, setCustomizeOpen] = useState(false);
  useEffect(() => {
    if (isOwn && searchParams.get("tab") === "customizacao") setCustomizeOpen(true);
  }, [isOwn, searchParams]);
  const handleCustomizeOpen = (open: boolean) => {
    setCustomizeOpen(open);
    if (!open && searchParams.get("tab") === "customizacao") {
      const next = new URLSearchParams(searchParams);
      next.delete("tab");
      setSearchParams(next, { replace: true });
    }
  };
  const [followersOpen, setFollowersOpen] = useState<"followers" | "following" | null>(null);
  const [followList, setFollowList] = useState<
    { id: string; display_name: string | null; avatar_url: string | null }[]
  >([]);

  // GAP-1100: Editar perfil
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ display_name: "", bio: "", username: "", is_private: false });
  const [saving, setSaving] = useState(false);

  const {
    isFollowing,
    requested,
    followersCount,
    followingCount,
    loading: followLoading,
    toggle: toggleFollow,
  } = useFollow(targetId);

  useEffect(() => {
    if (!targetId) {
      setLoading(false);
      return;
    }
    let cancel = false;
    (async () => {
      setLoading(true);
      const [
        { data: p },
        { data: revs },
        { data: adsRaw },
        { data: myReviews },
        { data: myPosts },
        { data: myLib },
        { data: sp },
      ] = await Promise.all([
        isOwn
          ? supabase
              .from("profiles")
              .select("id, display_name, avatar_url, bio, seller_bio, username, is_private, created_at")
              .eq("id", targetId)
              .maybeSingle()
          : supabase.rpc("get_public_profile", { _uid: targetId }).maybeSingle(),
        supabase.from("avaliacoes_usuario").select("rating").eq("reviewed_id", targetId),
        supabase.from("anuncios").select("id, title, price").eq("seller_id", targetId).eq("status", "active").limit(20),
        supabase
          .from("avaliacoes")
          .select("id, product_id, rating, comment, created_at")
          .eq("user_id", targetId)
          .eq("is_approved", true)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("forum_posts")
          .select("id, product_id, content, created_at, likes_count")
          .eq("user_id", targetId)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("biblioteca_usuario")
          .select("product_id, status")
          .eq("user_id", targetId)
          .order("acquired_at", { ascending: false })
          .limit(500),
        supabase
          .from("seller_profiles")
          .select(
            "id, handle, display_name, rating, total_sales, total_trades, vacation_mode, vacation_message, first_listing_at",
          )
          .eq("user_id", targetId)
          .maybeSingle(),
      ]);
      const adIds = adsRaw?.map((a) => a.id) || [];
      const productIds = new Set<string>([
        ...(myReviews || []).map((r) => r.product_id),
        ...(myPosts || []).map((p) => p.product_id),
        ...(myLib || []).map((l) => l.product_id),
      ]);
      const [{ data: photos }, { data: prods }] = await Promise.all([
        adIds.length
          ? supabase
              .from("fotos_anuncio")
              .select("anuncio_id, image_url, position")
              .in("anuncio_id", adIds)
              .order("position")
          : Promise.resolve({ data: [] as any[] }),
        productIds.size
          ? supabase
              .from("produtos")
              .select("id, title, image_url")
              .in("id", [...productIds])
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const photoMap = new Map<string, string>();
      (photos || []).forEach((ph) => {
        if (!photoMap.has(ph.anuncio_id)) photoMap.set(ph.anuncio_id, ph.image_url);
      });
      const prodMap = new Map((prods || []).map((x: any) => [x.id, x]));
      const avg = revs?.length ? revs.reduce((s, r) => s + r.rating, 0) / revs.length : 0;
      if (cancel) return;
      setProfile(p as Profile);
      setSellerProfile(sp || null);
      setRating(avg);
      setAds(
        (adsRaw || []).map((a) => ({
          id: a.id,
          title: a.title,
          price: Number(a.price),
          image: photoMap.get(a.id) || null,
        })),
      );
      setReviews(
        (myReviews || []).map((r) => ({
          id: r.id,
          product_id: r.product_id,
          product: (prodMap.get(r.product_id) as any)?.title || "Jogo",
          rating: Number(r.rating),
          comment: r.comment,
          created_at: r.created_at,
        })),
      );
      setPosts(
        (myPosts || []).map((p) => ({
          id: p.id,
          product_id: p.product_id,
          product: (prodMap.get(p.product_id) as any)?.title || "Jogo",
          content: p.content,
          created_at: p.created_at || "",
          likes_count: p.likes_count,
        })),
      );
      setLibrary(
        (myLib || []).map((l) => ({
          product_id: l.product_id,
          title: (prodMap.get(l.product_id) as any)?.title || "Jogo",
          image_url: (prodMap.get(l.product_id) as any)?.image_url || null,
          status: l.status,
        })),
      );
      setReviewsCount((myReviews || []).length);
      setPostsCount((myPosts || []).length);
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [targetId]);

  // GAP-1100: Abrir edição com dados atuais
  const openEdit = () => {
    if (!profile) return;
    setEditForm({
      display_name: profile.display_name || "",
      bio: profile.bio || "",
      username: profile.username || "",
      is_private: profile.is_private || false,
    });
    setEditOpen(true);
  };

  // GAP-1100: Salvar edição
  const saveEdit = async () => {
    if (!user || !profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: editForm.display_name.trim() || null,
        bio: editForm.bio.trim() || null,
        username: editForm.username.trim() || null,
        is_private: editForm.is_private,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao atualizar perfil");
      return;
    }
    toast.success("Perfil atualizado!");
    setProfile({ ...profile, ...editForm });
    setEditOpen(false);
  };

  const openFollowList = async (kind: "followers" | "following") => {
    if (!targetId) return;
    setFollowersOpen(kind);
    const col = kind === "followers" ? "follower_id" : "following_id";
    const filter = kind === "followers" ? "following_id" : "follower_id";
    const { data } = await supabase.from("user_follows").select(col).eq(filter, targetId);
    const ids = (data || []).map((d: any) => d[col]);
    if (!ids.length) {
      setFollowList([]);
      return;
    }
    const profs = await Promise.all(
      ids.slice(0, 100).map(async (id) => {
        const { data } = await supabase.rpc("get_public_profile", { _uid: id }).maybeSingle();
        return data as { id: string; display_name: string | null; avatar_url: string | null } | null;
      }),
    );
    setFollowList(profs.filter((p): p is NonNullable<typeof p> => p != null));
  };

  const handleBlock = async () => {
    if (!user || !targetId) return;
    const { error } = await supabase.from("blocked_users").insert({ blocker_id: user.id, blocked_id: targetId });
    if (error) toast.error("Erro ao bloquear");
    else toast.success("Usuário bloqueado");
  };
  const handleMessage = async () => {
    if (!user || !targetId) return;
    const { data, error } = await (supabase as any).rpc("start_conversation", {
      _other: targetId,
      _channel: "personal",
    });
    if (error) {
      if ((error.message || "").includes("minor_stranger_blocked"))
        toast.error("Essa conta só aceita mensagens de amigos.");
      else toast.error("Não foi possível abrir a conversa");
      return;
    }
    const row: any = data;
    if (!row?.id) {
      toast.error("Erro ao iniciar conversa");
      return;
    }
    if (row.status === "pending") toast.success("Pedido de conversa enviado");
    else if (row.status === "pending_guardian") toast.success("Aguardando aprovação do responsável");
    navigate(`/m/chat/${row.id}`);
  };
  const submitReport = async () => {
    if (!user || !targetId || !reportText.trim()) return;
    const { error } = await supabase
      .from("denuncias")
      .insert({ reporter_id: user.id, target_type: "profile", target_id: targetId, reason: reportText.trim() });
    if (error) {
      toast.error("Erro ao enviar denúncia");
      return;
    }
    toast.success("Denúncia enviada");
    setReportOpen(false);
    setReportText("");
  };

  if (!user && isOwn)
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground mb-4">Entre para ver seu perfil.</p>
        <Link
          to="/m/auth"
          className="inline-block px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
        >
          Entrar
        </Link>
      </div>
    );
  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  if (!profile) return <div className="p-6 text-center text-muted-foreground">Perfil não encontrado.</div>;

  const isSeller = mode === "vendedor";

  return (
    <div className="px-4 py-5 space-y-5" data-profile-cosmetic={targetId}>
      <ProfileCosmeticOverlay ownerId={targetId} />
      {!isOwn && (
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
      )}

      {isOwn && (
        <div className="flex justify-end">
          <CosmeticUnlocksCenter customizationHref="/m/perfil?tab=customizacao" />
        </div>
      )}

      {/* GAP-1100: Botão Editar perfil */}
      {isOwn && (
        <button
          onClick={openEdit}
          className="w-full py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center gap-2"
        >
          <Edit2 className="h-4 w-4" /> Editar perfil
        </button>
      )}

      {/* Toggle de modo */}
      <div className="flex gap-1 p-1 bg-secondary/40 rounded-full text-[11px] font-semibold">
        <button
          onClick={() => setMode("pessoal")}
          className={`flex-1 py-1.5 rounded-full transition-all ${!isSeller ? "bg-gradient-to-r from-primary to-accent text-primary-foreground" : "text-muted-foreground"}`}
        >
          👤 Pessoal
        </button>
        <button
          onClick={() => setMode("vendedor")}
          className={`flex-1 py-1.5 rounded-full transition-all ${isSeller ? "bg-gradient-to-r from-warning to-warning/70 text-on-media" : "text-muted-foreground"}`}
        >
          🛍️ Vendedor
        </button>
      </div>

      <div
        className={`rounded-2xl p-5 text-center ${isSeller ? "bg-gradient-to-br from-warning/10 via-warning/5 to-transparent border border-warning/30" : "glass"}`}
      >
        <div
          className={`w-20 h-20 rounded-full overflow-hidden mx-auto mb-3 flex items-center justify-center text-3xl font-bold ${isSeller ? "bg-gradient-to-br from-warning to-warning/70 text-on-media ring-2 ring-warning/40" : "bg-gradient-to-br from-primary to-accent text-primary-foreground"}`}
        >
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            profile.display_name?.[0]?.toUpperCase() || "?"
          )}
        </div>
        <h1 className="font-display text-lg font-bold flex items-center justify-center gap-1.5">
          {isSeller && sellerProfile ? sellerProfile.display_name : profile.display_name || "Usuário"}
          {isSeller && (
            <span className="px-1.5 py-0.5 text-[9px] rounded bg-warning/20 text-warning uppercase tracking-wider">
              Vendedor
            </span>
          )}
        </h1>
        {isSeller
          ? sellerProfile?.handle && <p className="text-xs text-warning font-semibold">${sellerProfile.handle}</p>
          : profile.username && <p className="text-xs text-muted-foreground">@{profile.username}</p>}
        {profile.created_at && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            📅 Membro desde {formatMonthYear(profile.created_at)}
          </p>
        )}
        {isSeller ? (
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <HalfStarDisplay rating={Number(sellerProfile?.rating ?? rating) || 0} size={14} />
            <span className="text-xs text-muted-foreground">
              {(sellerProfile?.rating ?? rating) > 0
                ? `${Number(sellerProfile?.rating ?? rating).toFixed(1)} como vendedor`
                : "sem avaliações ainda"}
            </span>
          </div>
        ) : (
          <>
            <div className="mt-2 flex justify-center">
              <LevelTitleBadge userId={targetId} variant="card" />
            </div>
            <UserBadges userId={targetId} max={8} className="mt-3" />
          </>
        )}
        {(() => {
          const shownBio = isSeller ? profile.seller_bio || profile.bio : profile.bio;
          return shownBio ? <p className="text-sm text-muted-foreground mt-3 whitespace-pre-wrap">{shownBio}</p> : null;
        })()}

        {!isSeller ? (
          <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-border/40">
            <button
              onClick={() => openFollowList("followers")}
              className="text-center hover:text-primary transition-colors"
            >
              <div className="text-base font-bold">{followersCount}</div>
              <div className="text-[10px] text-muted-foreground uppercase">Seguidores</div>
            </button>
            <button
              onClick={() => openFollowList("following")}
              className="text-center hover:text-primary transition-colors"
            >
              <div className="text-base font-bold">{followingCount}</div>
              <div className="text-[10px] text-muted-foreground uppercase">Seguindo</div>
            </button>
            <div className="text-center">
              <div className="text-base font-bold">{reviewsCount}</div>
              <div className="text-[10px] text-muted-foreground uppercase">Reviews</div>
            </div>
            <div className="text-center">
              <div className="text-base font-bold">{postsCount}</div>
              <div className="text-[10px] text-muted-foreground uppercase">Posts</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-warning/20">
            <div className="text-center">
              <div className="text-base font-bold text-warning">{ads.length}</div>
              <div className="text-[10px] text-muted-foreground uppercase">Anúncios</div>
            </div>
            <div className="text-center">
              <div className="text-base font-bold text-warning">{sellerProfile?.total_sales ?? 0}</div>
              <div className="text-[10px] text-muted-foreground uppercase">Vendas</div>
            </div>
            <div className="text-center">
              <div className="text-base font-bold text-warning">{sellerProfile?.total_trades ?? 0}</div>
              <div className="text-[10px] text-muted-foreground uppercase">Trocas</div>
            </div>
          </div>
        )}
      </div>

      {isSeller && sellerProfile?.vacation_mode && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 flex items-start gap-2">
          <span className="text-xl">🏖️</span>
          <div className="text-xs flex-1">
            <p className="font-semibold text-warning">Modo férias ativo</p>
            <p className="text-muted-foreground mt-0.5">
              {sellerProfile.vacation_message || "Anúncios ocultos temporariamente."}
            </p>
          </div>
        </div>
      )}

      {!isOwn && user && (
        <div className="flex gap-2">
          <button
            onClick={toggleFollow}
            disabled={followLoading}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${isFollowing || requested ? "bg-card border border-border text-foreground" : "bg-gradient-to-r from-primary to-accent text-primary-foreground glow-primary"}`}
          >
            {isFollowing ? (
              <>
                <UserCheck className="h-4 w-4" />
                Seguindo
              </>
            ) : requested ? (
              <>
                <UserCheck className="h-4 w-4" />
                Solicitado
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Seguir
              </>
            )}
          </button>
          <button
            onClick={handleMessage}
            aria-label="Enviar mensagem"
            className="px-4 rounded-xl bg-card border border-border"
          >
            <Send className="h-4 w-4" />
          </button>
          <button
            onClick={handleBlock}
            aria-label="Bloquear usuário"
            className="px-4 rounded-xl bg-card border border-border text-muted-foreground"
          >
            <ShieldOff className="h-4 w-4" />
          </button>
          <button
            onClick={() => setReportOpen(true)}
            className="px-4 rounded-xl bg-card border border-border text-muted-foreground hover:text-destructive"
          >
            <Flag className="h-4 w-4" />
          </button>
        </div>
      )}

      {isOwn && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setCustomizeOpen(true)}
            className="glass rounded-xl p-3 flex flex-col items-center gap-1 hover:border-primary/40"
          >
            <Palette className="h-5 w-5 text-primary" />
            <span className="text-xs font-semibold">Customização</span>
          </button>
          <Link
            to="/m/favoritos"
            className="glass rounded-xl p-3 flex flex-col items-center gap-1 hover:border-primary/40"
          >
            <span className="text-base">❤️</span>
            <span className="text-xs font-semibold">Favoritos</span>
          </Link>
          <Link to="/m/amigos" className="glass rounded-xl p-3 flex flex-col items-center gap-1 hover:border-accent/40">
            <Users className="h-5 w-5 text-accent" />
            <span className="text-xs font-semibold">Amigos</span>
          </Link>
          <Link
            to="/m/marketplace/novo"
            className="glass rounded-xl p-3 flex flex-col items-center gap-1 hover:border-primary/40"
          >
            <ShoppingBag className="h-5 w-5 text-primary" />
            <span className="text-xs font-semibold">Novo anúncio</span>
          </Link>
          <Link to="/m/config" className="glass rounded-xl p-3 flex flex-col items-center gap-1 hover:border-accent/40">
            <Settings className="h-5 w-5 text-accent" />
            <span className="text-xs font-semibold">Configurações</span>
          </Link>
        </div>
      )}

      <Sheet open={customizeOpen} onOpenChange={handleCustomizeOpen}>
        <SheetContent
          side="right"
          className="w-full max-w-full sm:max-w-md h-[100dvh] overflow-y-auto overflow-x-hidden overscroll-contain"
        >
          <SheetHeader className="pr-8">
            <SheetTitle className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" /> Customização
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <CustomizacaoTab />
          </div>
        </SheetContent>
      </Sheet>

      {profile.is_private && !isOwn ? (
        <div className="glass rounded-xl p-6 text-center text-muted-foreground">
          <Lock className="h-8 w-8 mx-auto mb-2 opacity-60" />
          <p className="text-sm font-semibold text-foreground">Perfil privado</p>
          <p className="text-xs mt-1">Conteúdo oculto. Apenas anúncios ativos são visíveis.</p>
          {ads.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-4 text-left">
              {ads.map((a) => (
                <Link key={a.id} to={`/m/marketplace/${a.id}`} className="glass rounded-lg overflow-hidden">
                  <div className="aspect-square bg-muted">
                    {a.image ? (
                      <img src={a.image} alt={a.title} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-[11px] font-semibold line-clamp-1">{a.title}</p>
                    <p className="text-xs font-bold text-price">{formatCurrency(a.price)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {(() => {
            const allTabs = [
              { id: "ads", label: "Anúncios", icon: ShoppingBag, count: ads.length, mode: "vendedor" },
              { id: "reviews", label: "Reviews", icon: Star, count: reviewsCount, mode: "pessoal" },
              { id: "posts", label: "Posts", icon: Newspaper, count: postsCount, mode: "pessoal" },
              { id: "lib", label: "Lib.", icon: BookMarked, count: library.length, mode: "pessoal" },
            ] as const;
            const visible = allTabs.filter((t) => t.mode === mode);
            return (
              <div
                className={`grid gap-1 p-1 bg-secondary/40 rounded-lg`}
                style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}
              >
                {visible.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`py-2 px-1 rounded-md text-[10px] font-semibold inline-flex flex-col items-center justify-center gap-0.5 ${tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  >
                    <t.icon className="h-3.5 w-3.5" />
                    <span className="truncate max-w-full">
                      {t.label} <span className="opacity-60">({t.count})</span>
                    </span>
                  </button>
                ))}
              </div>
            );
          })()}

          {tab === "ads" &&
            (ads.length === 0 ? (
              <EstadoVazio icone={ShoppingBag} titulo="Nenhum anúncio ativo" />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {ads.map((a) => (
                  <Link key={a.id} to={`/m/marketplace/${a.id}`} className="glass rounded-lg overflow-hidden">
                    <div className="aspect-square bg-muted">
                      {a.image ? (
                        <img src={a.image} alt={a.title} loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-[11px] font-semibold line-clamp-1">{a.title}</p>
                      <p className="text-xs font-bold text-price">{formatCurrency(a.price)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ))}

          {tab === "reviews" &&
            (reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sem reviews.</p>
            ) : (
              <div className="space-y-2">
                {reviews.map((r) => (
                  <Link
                    key={r.id}
                    to={`/m/review/${r.product_id}?focus=${r.id}`}
                    className="block glass rounded-xl p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold">{r.product}</span>
                      <HalfStarDisplay rating={r.rating} size={12} />
                    </div>
                    {r.comment && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{r.comment}</p>}
                  </Link>
                ))}
              </div>
            ))}

          {tab === "posts" &&
            (posts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sem posts.</p>
            ) : (
              <div className="space-y-2">
                {posts.map((p) => (
                  <Link key={p.id} to={`/m/forum/post/${p.id}`} className="block glass rounded-xl p-3">
                    <div className="text-[10px] text-muted-foreground mb-1">
                      em <b className="text-foreground">{p.product}</b>
                    </div>
                    <p className="text-sm line-clamp-2">{p.content}</p>
                  </Link>
                ))}
              </div>
            ))}

          {tab === "lib" &&
            (library.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Biblioteca vazia.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-1 p-1 bg-secondary/40 rounded-lg">
                  {(
                    [
                      { id: "all", label: `Tudo (${library.length})` },
                      {
                        id: "ja_joguei",
                        label: `Já joguei (${library.filter((l) => JA_JOGUEI_STATUSES.includes(l.status)).length})`,
                      },
                      {
                        id: "quero_jogar",
                        label: `Quero jogar (${library.filter((l) => l.status === "quero_jogar").length})`,
                      },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setLibFilter(f.id)}
                      className={`flex-1 py-1.5 rounded-md text-[10px] font-semibold ${libFilter === f.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                {(() => {
                  const filtered =
                    libFilter === "all"
                      ? library
                      : libFilter === "ja_joguei"
                        ? library.filter((l) => JA_JOGUEI_STATUSES.includes(l.status))
                        : library.filter((l) => l.status === libFilter);
                  if (filtered.length === 0)
                    return <p className="text-sm text-muted-foreground text-center py-6">Nada por aqui.</p>;
                  const totalPages = Math.max(1, Math.ceil(filtered.length / LIB_PAGE_SIZE));
                  const page = Math.min(libPage, totalPages);
                  const slice = filtered.slice((page - 1) * LIB_PAGE_SIZE, page * LIB_PAGE_SIZE);
                  return (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        {slice.map((l) => (
                          <Link
                            key={l.product_id}
                            to={`/m/forum/jogo/${l.product_id}`}
                            className="glass rounded-lg overflow-hidden"
                          >
                            <div className="aspect-[3/4] bg-muted relative">
                              {l.image_url ? (
                                <img
                                  src={l.image_url}
                                  alt={l.title}
                                  loading="lazy"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <BookMarked className="h-6 w-6 text-muted-foreground" />
                                </div>
                              )}
                              <span
                                className={`absolute top-1 right-1 text-[8px] px-1.5 py-0.5 rounded-full font-bold ${l.status === "quero_jogar" ? "bg-accent/90 text-accent-foreground" : "bg-success/90 text-success-foreground"}`}
                              >
                                {l.status === "quero_jogar" ? "QUERO" : "JOGUEI"}
                              </span>
                            </div>
                            <p className="text-[10px] font-semibold line-clamp-1 p-1.5">{l.title}</p>
                          </Link>
                        ))}
                      </div>
                      {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-3">
                          <button
                            disabled={page <= 1}
                            onClick={() => setLibPage((p) => Math.max(1, p - 1))}
                            className="px-3 py-1.5 rounded-lg bg-secondary text-xs font-semibold disabled:opacity-40"
                          >
                            ‹ Anterior
                          </button>
                          <span className="text-[11px] text-muted-foreground">
                            {page} / {totalPages}
                          </span>
                          <button
                            disabled={page >= totalPages}
                            onClick={() => setLibPage((p) => Math.min(totalPages, p + 1))}
                            className="px-3 py-1.5 rounded-lg bg-secondary text-xs font-semibold disabled:opacity-40"
                          >
                            Próxima ›
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ))}
        </>
      )}

      {isOwn && (
        <button
          onClick={async () => {
            await signOut();
            navigate("/m/auth");
          }}
          className="w-full py-2.5 rounded-xl bg-destructive/10 text-destructive text-sm font-semibold flex items-center justify-center gap-1.5"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      )}

      {reportOpen && (
        <div className="fixed inset-0 z-50 overlay-scrim flex items-end" onClick={() => setReportOpen(false)}>
          <div className="w-full bg-card rounded-t-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold">Denunciar usuário</h3>
            <textarea
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="Motivo..."
              className="w-full p-3 bg-background border border-border rounded-lg text-sm resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setReportOpen(false)}
                className="flex-1 py-2.5 rounded-lg bg-secondary text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={submitReport}
                className="flex-1 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {followersOpen && (
        <div className="fixed inset-0 z-50 overlay-scrim flex items-end" onClick={() => setFollowersOpen(null)}>
          <div
            className="w-full max-h-[70vh] overflow-y-auto bg-card rounded-t-2xl p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold flex items-center gap-2">
              <Users className="h-4 w-4" />
              {followersOpen === "followers" ? "Seguidores" : "Seguindo"}
            </h3>
            {followList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Lista vazia.</p>
            ) : (
              <div className="space-y-2">
                {followList.map((f) => (
                  <Link
                    key={f.id}
                    to={`/m/perfil/${f.id}`}
                    onClick={() => setFollowersOpen(null)}
                    className="flex items-center gap-3 p-2 glass rounded-lg"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent overflow-hidden flex items-center justify-center text-primary-foreground font-bold">
                      {f.avatar_url ? (
                        <img src={f.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        f.display_name?.[0]?.toUpperCase() || "?"
                      )}
                    </div>
                    <span className="text-sm font-semibold flex-1 truncate">{f.display_name || "Usuário"}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* GAP-1100: Sheet de edição */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Edit2 className="h-4 w-4 text-primary" /> Editar perfil
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs text-muted-foreground">Nome de exibição</label>
              <input
                value={editForm.display_name}
                onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                className="w-full p-3 bg-background border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Username</label>
              <input
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                className="w-full p-3 bg-background border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Bio</label>
              <textarea
                value={editForm.bio}
                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                rows={3}
                className="w-full p-3 bg-background border border-border rounded-lg text-sm resize-none"
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
              <span className="text-sm">Perfil privado</span>
              <button
                onClick={() => setEditForm({ ...editForm, is_private: !editForm.is_private })}
                className={`relative w-10 h-5 rounded-full transition-colors ${editForm.is_private ? "bg-primary" : "bg-secondary"}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-background transition-transform ${editForm.is_private ? "translate-x-5" : ""}`}
                />
              </button>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setEditOpen(false)}
                className="flex-1 py-2.5 rounded-lg bg-secondary text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
