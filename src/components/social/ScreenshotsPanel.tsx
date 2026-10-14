// Painel de Screenshots (Fase 1.5 — Web). Só permite curtir; sem respostas.
// Rodada 23: vive na página do jogo (não na biblioteca), separa Sem spoiler /
// Com spoiler em abas, espelha a privacidade global e permite editar a
// visibilidade de um post já publicado.
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Heart, MoreHorizontal, Loader2, Upload, Eye, Edit, Image, X, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { stripImageExif } from "@/lib/stripImageExif";
import SpoilerGuard from "@/components/spoiler/SpoilerGuard";
import EstadoVazio from "@/components/EstadoVazio";
import { ImageOff } from "lucide-react";
import SpoilerComposerControls from "@/components/spoiler/SpoilerComposerControls";
import PostVisibilitySelect, { visibilityLabel } from "@/components/social/PostVisibilitySelect";
import VisibilityQuickToggle from "@/components/social/VisibilityQuickToggle";
import { toggleLike as toggleLikeRpc } from '@/lib/toggleLike';
import { formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Shot {
  id: string; 
  user_id: string; 
  product_id: string; 
  caption: string | null;
  images: string[]; 
  likes_count: number; 
  created_at: string;
  updated_at?: string | null;
  is_spoiler?: boolean | null;
  spoiler_achievement_name?: string | null;
  visibility?: string | null;
  views_count?: number;
  author?: { display_name: string | null; avatar_url: string | null };
  liked_by_me?: boolean;
}

// ─── GAP-SP01: LIGHTBOX ──────────────────────────────────────────────────

function ScreenshotLightbox({ 
  images, 
  index, 
  onClose, 
  onNext, 
  onPrev,
  caption,
  author,
  createdAt
}: { 
  images: string[]; 
  index: number; 
  onClose: () => void; 
  onNext: () => void; 
  onPrev: () => void;
  caption?: string | null;
  author?: string | null;
  createdAt?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [isZoomed, setIsZoomed] = useState(false);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY < 0) {
      setZoom(prev => Math.min(prev + 0.1, 3));
      setIsZoomed(true);
    } else {
      setZoom(prev => Math.max(prev - 0.1, 0.5));
      if (zoom <= 0.6) setIsZoomed(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-overlay/95 flex items-center justify-center select-none"
      onClick={onClose}
      onWheel={handleWheel}
    >
      <button 
        onClick={onClose} 
        className="absolute top-4 right-4 p-2 rounded-full bg-on-media/10 hover:bg-on-media/20 text-on-media transition z-10"
      >
        <X className="h-5 w-5" />
      </button>
      
      <div className="absolute top-4 left-4 text-on-media/60 text-sm z-10">
        {index + 1} / {images.length}
        {author && <span className="ml-2">· {author}</span>}
        {createdAt && <span className="ml-2 text-on-media/40">{formatRelativeTime(createdAt)}</span>}
      </div>

      {index > 0 && (
        <button 
          onClick={(e) => { e.stopPropagation(); onPrev(); }} 
          className="absolute left-4 p-3 rounded-full bg-on-media/10 hover:bg-on-media/20 text-on-media transition z-10"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {index < images.length - 1 && (
        <button 
          onClick={(e) => { e.stopPropagation(); onNext(); }} 
          className="absolute right-4 p-3 rounded-full bg-on-media/10 hover:bg-on-media/20 text-on-media transition z-10"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      <div className="max-w-[92vw] max-h-[92vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        {loading && (
          <div className="flex items-center justify-center w-32 h-32">
            <Loader2 className="h-8 w-8 text-on-media/40 animate-spin" />
          </div>
        )}
        
        <img 
          src={images[index]} 
          alt={caption || ''} 
          className={cn(
            "max-w-full max-h-[80vh] rounded-lg object-contain transition-transform duration-200",
            isZoomed ? "cursor-zoom-out" : "cursor-zoom-in"
          )}
          style={{ transform: `scale(${zoom})` }}
          onLoad={() => setLoading(false)}
          onClick={() => { setIsZoomed(!isZoomed); setZoom(isZoomed ? 1 : 2); }}
          loading="lazy"
        />
        
        {caption && (
          <div className="text-center text-sm text-on-media/80 bg-overlay/50 backdrop-blur px-4 py-2 rounded-lg max-w-lg">
            {caption}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────

export function ScreenshotsPanel({ productId }: { productId: string }) {
  const { user } = useAuth();
  const [shots, setShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(true);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [spoilerAch, setSpoilerAch] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<string | null>(null);
  const [tab, setTab] = useState<"clean" | "spoiler">("clean");
  const [editing, setEditing] = useState<Shot | null>(null);
  const [editVis, setEditVis] = useState<string | null>(null);
  const [savingVis, setSavingVis] = useState(false);
  
  // GAP-SP01: Lightbox
  const [lightbox, setLightbox] = useState<{ open: boolean; index: number; images: string[] }>({
    open: false,
    index: 0,
    images: [],
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("game_screenshots")
      .select("*, author:profiles!user_id(display_name, avatar_url)")
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (user && data?.length) {
      const ids = data.map((s: any) => s.id);
      const { data: likes } = await supabase
        .from("game_screenshot_likes").select("screenshot_id").in("screenshot_id", ids).eq("user_id", user.id);
      const liked = new Set((likes ?? []).map((l: any) => l.screenshot_id));
      setShots(data.map((s: any) => ({ ...s, liked_by_me: liked.has(s.id) })));
    } else {
      setShots((data as any) ?? []);
    }
    setLoading(false);
  }, [productId, user]);

  useEffect(() => { void load(); }, [load]);

  const clean = useMemo(() => shots.filter(s => !s.is_spoiler), [shots]);
  const spoilers = useMemo(() => shots.filter(s => !!s.is_spoiler), [shots]);
  const visible = tab === "clean" ? clean : spoilers;

  // ─── UPLOAD ──────────────────────────────────────────────────────────────

  const onFiles = async (files: FileList | null) => {
    if (!files?.length || !user) return;
    setUploading(true);
    const urls: string[] = [];
    
    for (const raw of Array.from(files).slice(0, 10)) {
      // ❌ APENAS IMAGENS — sem vídeos
      if (!raw.type.startsWith('image/')) {
        toast.warning(`"${raw.name}" não é uma imagem e foi ignorado`);
        continue;
      }
      
      const f = await stripImageExif(raw);
      const path = `screenshots/${user.id}/${Date.now()}-${f.name}`;
      const { error } = await supabase.storage.from("product-images").upload(path, f);
      if (error) { toast.error("Erro no upload"); continue; }
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    
    if (urls.length) {
      const { error } = await supabase.from("game_screenshots").insert({
        user_id: user.id, 
        product_id: productId, 
        caption: caption.trim() || null, 
        images: urls,
        is_spoiler: isSpoiler, 
        spoiler_achievement_name: spoilerAch,
        visibility,
      } as any);
      if (error) toast.error("Erro ao publicar");
      else { 
        setCaption(""); 
        setIsSpoiler(false); 
        setSpoilerAch(null); 
        void load();
        toast.success(`${urls.length} screenshot(s) publicado(s)!`);
      }
    }
    setUploading(false);
  };

  // ─── GAP-SP01: ABRIR LIGHTBOX ──────────────────────────────────────────

  const openLightbox = (shot: Shot, index: number) => {
    setLightbox({
      open: true,
      index,
      images: shot.images,
    });
  };

  const closeLightbox = () => setLightbox({ open: false, index: 0, images: [] });
  const nextImage = () => {
    setLightbox(prev => ({
      ...prev,
      index: (prev.index + 1) % prev.images.length,
    }));
  };
  const prevImage = () => {
    setLightbox(prev => ({
      ...prev,
      index: (prev.index - 1 + prev.images.length) % prev.images.length,
    }));
  };

  const toggleLike = async (s: Shot) => {
    if (!user) return;
    if (!(await toggleLikeRpc("screenshot", s.id))) { toast.error("Não foi possível curtir"); return; }
    void load();
  };

  const saveEditedVisibility = async () => {
    if (!editing) return;
    setSavingVis(true);
    const { error } = await supabase.from("game_screenshots").update({ visibility: editVis } as never).eq("id", editing.id);
    setSavingVis(false);
    if (error) { toast.error("Não foi possível alterar a visibilidade"); return; }
    toast.success("Visibilidade do post atualizada");
    setEditing(null);
    void load();
  };

  if (!user) return <p className="text-muted-foreground text-sm">Entre para ver screenshots.</p>;

  return (
    <section className="space-y-4">
      {/* Lightbox */}
      {lightbox.open && (
        <ScreenshotLightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={closeLightbox}
          onNext={nextImage}
          onPrev={prevImage}
          caption={shots.find(s => s.images === lightbox.images)?.caption}
          author={shots.find(s => s.images === lightbox.images)?.author?.display_name}
          createdAt={shots.find(s => s.images === lightbox.images)?.created_at}
        />
      )}

      {/* Compositor */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">Prints da comunidade</p>
          <VisibilityQuickToggle
            column="screenshots_visibility"
            title="Quem vê seus prints"
            description="Vale para todos os prints que você publica nesta plataforma."
          />
        </div>
        <input
          type="text" 
          value={caption} 
          onChange={e => setCaption(e.target.value)}
          maxLength={500} 
          placeholder="Legenda (opcional)…"
          className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
        />
        <SpoilerComposerControls
          isSpoiler={isSpoiler} 
          onIsSpoilerChange={setIsSpoiler}
          achievementName={spoilerAch} 
          onAchievementNameChange={setSpoilerAch}
          productId={productId}
        />
        <div className="flex flex-wrap items-center gap-3">
          <PostVisibilitySelect value={visibility} onChange={setVisibility} />
          
          <label className="inline-flex items-center gap-2 cursor-pointer text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? 'Enviando...' : 'Enviar screenshot(s)'}
            <input 
              type="file" 
              accept="image/*" 
              multiple 
              className="hidden" 
              onChange={e => onFiles(e.target.files)} 
              disabled={uploading} 
            />
          </label>
          <span className="text-[10px] text-muted-foreground">Apenas imagens (máx 10)</span>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-2" role="tablist" aria-label="Filtro de spoiler">
        {([["clean", `Sem spoiler (${clean.length})`], ["spoiler", `Com spoiler (${spoilers.length})`]] as const).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === id ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : visible.length === 0 ? (
        <EstadoVazio
          icone={ImageOff}
          titulo={tab === "clean" ? "Nenhum print ainda" : "Nenhum print com spoiler"}
          descricao={tab === "clean"
            ? "Seja o primeiro a postar um print deste jogo para a comunidade."
            : "Nada marcado como spoiler por aqui. Prints com spoiler ficam nesta aba."}
        />
      ) : (
        <ul className="grid sm:grid-cols-2 gap-4">
          {visible.map(s => (
            <li key={s.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <SpoilerGuard
                isSpoiler={!!s.is_spoiler}
                achievementName={s.spoiler_achievement_name}
                productId={productId}
              >
                <div className="relative grid grid-cols-2 gap-0.5 cursor-pointer group">
                  {s.images.slice(0, 4).map((src, i) => (
                    <div key={i} className="relative aspect-video">
                      <img 
                        src={src} 
                        alt="" 
                        className="w-full h-full object-cover group-hover:opacity-90 transition"
                        loading="lazy"
                        onClick={() => openLightbox(s, i)}
                      />
                      {i === 3 && s.images.length > 4 && (
                        <div 
                          className="absolute inset-0 flex items-center justify-center bg-overlay/50 text-on-media font-bold text-sm cursor-pointer"
                          onClick={() => openLightbox(s, 0)}
                        >
                          +{s.images.length - 3}
                        </div>
                      )}
                    </div>
                  ))}
                  {/* GAP-SP01: Botão expandir */}
                  <button 
                    onClick={() => openLightbox(s, 0)}
                    className="absolute bottom-2 right-2 p-1.5 rounded bg-overlay/50 text-on-media/70 hover:text-on-media transition opacity-0 group-hover:opacity-100"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </SpoilerGuard>
              
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <span className="font-medium">{s.author?.display_name || "Amigo"}</span>
                  <span className="text-xs text-muted-foreground">{formatRelativeTime(s.created_at)}</span>
                  
                  {/* GAP-SP02: Indicador de editado */}
                  {s.updated_at && s.updated_at !== s.created_at && (
                    <span className="text-[9px] text-muted-foreground/60 flex items-center gap-0.5">
                      <Edit className="h-2.5 w-2.5" /> editado
                    </span>
                  )}
                  
                  {/* GAP-SP03: Visualizações */}
                  {s.views_count !== undefined && s.views_count > 0 && (
                    <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                      <Eye className="h-2.5 w-2.5" /> {s.views_count}
                    </span>
                  )}
                  
                  {s.user_id === user.id && s.visibility && (
                    <span className="text-[10px] uppercase tracking-wide border border-border rounded px-1.5 py-0.5 text-muted-foreground">
                      {visibilityLabel(s.visibility)}
                    </span>
                  )}
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button aria-label="Mais ações do print" className="ml-auto text-muted-foreground">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {s.user_id === user.id && (
                        <DropdownMenuItem onClick={() => { setEditing(s); setEditVis(s.visibility ?? null); }}>
                          Editar visibilidade
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => { if (s.caption) navigator.clipboard.writeText(s.caption); toast.success("Copiado"); }}>
                        Copiar descrição
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={async () => { 
                        await supabase.from("opinion_mutes").insert({ user_id: user.id, target_product_id: productId, kind: "screenshot_game" }); 
                        toast.success("Silenciado"); 
                      }}>
                        Silenciar screenshots deste jogo
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={async () => { 
                        await supabase.from("opinion_mutes").insert({ user_id: user.id, target_user_id: s.user_id, kind: "screenshot_user" }); 
                        toast.success("Silenciado"); 
                      }}>
                        Silenciar screenshots deste usuário
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast("Denúncia registrada")}>Denunciar</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                {/* Descrição da screenshot (sempre visível) */}
                {s.caption && <p className="text-sm">{s.caption}</p>}
                
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <button onClick={() => toggleLike(s)} className="inline-flex items-center gap-1 hover:text-primary transition">
                    <Heart className={`h-4 w-4 ${s.liked_by_me ? "fill-current text-primary" : ""}`} /> {s.likes_count}
                  </button>
                  <button onClick={() => openLightbox(s, 0)} className="inline-flex items-center gap-1 hover:text-primary transition">
                    <Eye className="h-3.5 w-3.5" /> Ver
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Dialog de Edição */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar visibilidade do print</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">
            Muda quem pode ver este print específico, sem alterar sua configuração geral.
          </p>
          <PostVisibilitySelect value={editVis} onChange={setEditVis} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveEditedVisibility} disabled={savingVis}>
              {savingVis && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

// ─── FEATURED SCREENSHOTS STRIP ──────────────────────────────────────────

export function FeaturedScreenshotsStrip({ productId, onSeeAll }: { productId: string; onSeeAll?: () => void }) {
  const [images, setImages] = useState<{ src: string; shotId: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("game_screenshots")
        .select("id, images, likes_count, is_spoiler")
        .eq("product_id", productId)
        .eq("is_spoiler", false)
        .order("likes_count", { ascending: false })
        .limit(6);
      if (cancel) return;
      const result = (data ?? [])
        .flatMap((s: any) => (s.images ?? []).slice(0, 1).map((src: string) => ({ src, shotId: s.id })))
        .slice(0, 6);
      setImages(result);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [productId]);

  if (loading || images.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Destaques da comunidade</h3>
        {onSeeAll && (
          <button onClick={onSeeAll} className="text-xs text-primary hover:underline">Ver todos os prints</button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">Prints sem spoiler, ordenados pelos mais curtidos.</p>
      <ul className="mt-3 flex snap-x gap-3 overflow-x-auto pb-2">
        {images.map((item, i) => (
          <li key={i} className="shrink-0 snap-start">
            <img 
              src={item.src} 
              alt={`Print da comunidade ${i + 1}`} 
              loading="lazy" 
              className="h-28 w-44 rounded-lg border border-border object-cover hover:opacity-90 transition cursor-pointer"
              onClick={() => window.location.href = `/jogo/${productId}?tab=screenshots`}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}