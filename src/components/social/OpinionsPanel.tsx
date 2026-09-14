// Painel de Opiniões — conversas privadas par-a-par persistentes.
// Cada resposta cria/abre uma conversa permanente vinculada à opinião.
// Terceiros só veem o contador "X pessoas responderam".
// REGRA: respostas são SEMPRE privadas entre autor e respondente.
import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Heart, MessageSquare, MoreHorizontal, Loader2, ArrowRight, Eye, Edit, Image, Lock, Users, AlertTriangle } from "lucide-react";
import EstadoVazio from "@/components/EstadoVazio";
import { MessagesSquare } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import SpoilerGuard from "@/components/spoiler/SpoilerGuard";
import SpoilerComposerControls from "@/components/spoiler/SpoilerComposerControls";
import PostVisibilitySelect, { visibilityLabel } from "@/components/social/PostVisibilitySelect";
import VisibilityQuickToggle from "@/components/social/VisibilityQuickToggle";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { dbWrite } from '@/lib/dbWrite';
import { toggleLike as toggleLikeRpc } from '@/lib/toggleLike';
import { formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Opinion {
  id: string;
  user_id: string;
  product_id: string;
  text: string;
  images: string[];
  likes_count: number;
  replies_count: number;
  created_at: string;
  updated_at?: string | null;
  is_spoiler?: boolean | null;
  spoiler_achievement_name?: string | null;
  visibility?: string | null;
  views_count?: number;
  author?: { display_name: string | null; avatar_url: string | null };
  liked_by_me?: boolean;
}

export function OpinionsPanel({ productId }: { productId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [opinions, setOpinions] = useState<Opinion[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState("");
  const [posting, setPosting] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [spoilerAch, setSpoilerAch] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<string | null>(null);
  const [editing, setEditing] = useState<Opinion | null>(null);
  const [editVis, setEditVis] = useState<string | null>(null);
  const [savingVis, setSavingVis] = useState(false);
  // GAP-OP01: Imagens
  const [newImages, setNewImages] = useState<string[]>([]);
  // GAP-OP05: Denúncia
  const [reportDialog, setReportDialog] = useState<{ open: boolean; opinionId: string; reason: string }>({
    open: false,
    opinionId: '',
    reason: '',
  });
  const [reporting, setReporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("game_opinions")
      .select("*, author:profiles!user_id(display_name, avatar_url)")
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (user && data?.length) {
      const ids = data.map((o: any) => o.id);
      const { data: likes } = await supabase
        .from("game_opinion_likes").select("opinion_id").in("opinion_id", ids).eq("user_id", user.id);
      const liked = new Set((likes ?? []).map((l: any) => l.opinion_id));
      setOpinions(data.map((o: any) => ({ ...o, liked_by_me: liked.has(o.id) })));
    } else {
      setOpinions((data as any) ?? []);
    }
    setLoading(false);
  }, [productId, user]);

  useEffect(() => { void load(); }, [load]);

  // ─── PUBLICAR OPINIÃO ────────────────────────────────────────────────────

  const publish = async () => {
    if (!user || !newText.trim()) return;
    setPosting(true);
    const { error } = await supabase.from("game_opinions").insert({
      user_id: user.id,
      product_id: productId,
      text: newText.trim(),
      images: newImages,
      is_spoiler: isSpoiler,
      spoiler_achievement_name: spoilerAch,
      visibility,
    } as any);
    setPosting(false);
    if (error) { toast.error("Erro ao publicar"); return; }
    setNewText("");
    setNewImages([]);
    setIsSpoiler(false);
    setSpoilerAch(null);
    void load();
    toast.success("Opinião publicada!");
  };

  // ─── CURTIR ──────────────────────────────────────────────────────────────

  const toggleLike = async (op: Opinion) => {
    if (!user) return;
    if (!(await toggleLikeRpc("opinion", op.id))) { toast.error("Não foi possível curtir"); return; }
    void load();
  };

  // ─── ABRIR CONVERSA PRIVADA ─────────────────────────────────────────────

  const openConversation = async (op: Opinion) => {
    if (!user) { toast.error("Entre para responder"); return; }
    setOpeningId(op.id);
    try {
      const isAuthor = op.user_id === user.id;
      
      // Se for o autor: vai para o painel de conversas
      if (isAuthor) {
        navigate(`/conversas-opinioes?opinion=${op.id}`);
        return;
      }
      
      // Se for outro usuário: cria/abre conversa privada
      let { data: conv } = await supabase
        .from("opinion_conversations")
        .select("id")
        .eq("opinion_id", op.id)
        .eq("responder_id", user.id)
        .maybeSingle();
      
      if (!conv) {
        const ins = await supabase
          .from("opinion_conversations")
          .insert({ opinion_id: op.id, author_id: op.user_id, responder_id: user.id })
          .select("id").single();
        if (ins.error) { toast.error("Não foi possível abrir a conversa"); return; }
        conv = ins.data;
      }
      
      navigate(`/conversas-opinioes/${conv!.id}`);
    } finally {
      setOpeningId(null);
    }
  };

  // ─── MUTAR ───────────────────────────────────────────────────────────────

  const muteUser = async (uid: string) => {
    if (!user) return;
    await dbWrite(supabase.from("opinion_mutes").insert({ user_id: user.id, target_user_id: uid, kind: "opinion_user" }));
    toast.success("Opiniões deste usuário silenciadas");
    void load();
  };

  const muteGame = async () => {
    if (!user) return;
    await dbWrite(supabase.from("opinion_mutes").insert({ user_id: user.id, target_product_id: productId, kind: "opinion_game" }));
    toast.success("Opiniões deste jogo silenciadas");
  };

  // ─── GAP-OP05: DENUNCIAR ────────────────────────────────────────────────

  const reportOpinion = async () => {
    if (!reportDialog.opinionId || !reportDialog.reason.trim()) {
      toast.error("Descreva o motivo da denúncia");
      return;
    }
    setReporting(true);
    const { error } = await supabase.from("opinion_reports").insert({
      opinion_id: reportDialog.opinionId,
      user_id: user!.id,
      reason: reportDialog.reason.trim(),
    });
    setReporting(false);
    if (error) { toast.error("Erro ao enviar denúncia"); return; }
    toast.success("Denúncia registrada! Nossa equipe vai analisar.");
    setReportDialog({ open: false, opinionId: '', reason: '' });
  };

  if (!user) return <p className="text-muted-foreground text-sm">Entre para ver opiniões.</p>;

  return (
    <section className="space-y-4">
      {/* Compositor */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">Opiniões</p>
          <VisibilityQuickToggle
            column="opinions_visibility"
            title="Quem vê suas opiniões"
            description="Mesmo controle da Central de Privacidade — vale para tudo que já publicou."
          />
        </div>
        
        <Textarea
          value={newText}
          onChange={e => setNewText(e.target.value)}
          placeholder="Compartilhe uma opinião curta sobre este jogo… (respostas viram conversas privadas)"
          rows={3}
          maxLength={2000}
        />

        {/* GAP-OP01: Upload de imagens */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition"
            onClick={() => {
              const url = prompt('URL da imagem (ou deixe em branco):');
              const trimmed = (url || '').trim();
              if (trimmed) {
                if (!/^https?:\/\//i.test(trimmed)) {
                  toast.error('A URL deve começar com http:// ou https://');
                } else {
                  setNewImages(prev => [...prev, trimmed]);
                }
              }
            }}
          >
            <Image className="h-3.5 w-3.5" /> Adicionar imagem
          </button>
          {newImages.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {newImages.map((img, i) => (
                <span key={i} className="text-[10px] bg-secondary px-1.5 py-0.5 rounded flex items-center gap-1">
                  📷 {i + 1}
                  <button 
                    onClick={() => setNewImages(prev => prev.filter((_, idx) => idx !== i))} 
                    className="text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <SpoilerComposerControls
          isSpoiler={isSpoiler}
          onIsSpoilerChange={setIsSpoiler}
          achievementName={spoilerAch}
          onAchievementNameChange={setSpoilerAch}
          productId={productId}
        />
        
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PostVisibilitySelect value={visibility} onChange={setVisibility} />
          <Button onClick={publish} disabled={posting || !newText.trim()}>
            {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publicar"}
          </Button>
        </div>
      </div>

      {/* Lista de Opiniões */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : opinions.length === 0 ? (
        <EstadoVazio
          icone={MessagesSquare}
          titulo="Nenhuma opinião ainda"
          descricao="Compartilhe o que você achou deste jogo — sua opinião abre a conversa da comunidade."
        />
      ) : (
        <ul className="space-y-3">
          {opinions.map(op => (
            <li key={op.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden shrink-0">
                  {op.author?.avatar_url ? (
                    <img src={op.author.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-bold text-muted-foreground">
                      {(op.author?.display_name || "?")[0].toUpperCase()}
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Link to={`/perfil/${op.user_id}`} className="font-semibold text-sm hover:text-primary">
                      {op.author?.display_name || "Amigo"}
                    </Link>
                    <span className="text-xs text-muted-foreground">{formatRelativeTime(op.created_at)}</span>
                    
                    {/* GAP-OP02: Indicador de editado */}
                    {op.updated_at && op.updated_at !== op.created_at && (
                      <span className="text-[9px] text-muted-foreground/60 flex items-center gap-0.5">
                        <Edit className="h-2.5 w-2.5" /> editado
                      </span>
                    )}
                    
                    {/* GAP-OP03: Visualizações */}
                    {op.views_count !== undefined && op.views_count > 0 && (
                      <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                        <Eye className="h-2.5 w-2.5" /> {op.views_count}
                      </span>
                    )}
                    
                    {/* GAP-OP04: Indicador de visibilidade */}
                    {op.user_id === user.id && op.visibility && (
                      <span className="text-[10px] uppercase tracking-wide border border-border rounded px-1.5 py-0.5 text-muted-foreground">
                        {visibilityLabel(op.visibility)}
                      </span>
                    )}
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="ml-auto text-muted-foreground hover:text-foreground" aria-label="Ações">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {op.user_id === user.id && (
                          <DropdownMenuItem onClick={() => { setEditing(op); setEditVis(op.visibility ?? null); }}>
                            Editar visibilidade
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(op.text); toast.success("Texto copiado"); }}>
                          Copiar texto
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={muteGame}>Silenciar opiniões deste jogo</DropdownMenuItem>
                        {op.user_id !== user.id && (
                          <DropdownMenuItem onClick={() => muteUser(op.user_id)}>Silenciar opiniões deste usuário</DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setReportDialog({ open: true, opinionId: op.id, reason: '' })}>
                          Denunciar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Conteúdo com Spoiler Guard */}
                  <SpoilerGuard
                    isSpoiler={!!op.is_spoiler}
                    achievementName={op.spoiler_achievement_name}
                    productId={op.product_id}
                  >
                    <p className="text-sm whitespace-pre-wrap">{op.text}</p>
                    
                    {/* GAP-OP01: Imagens da opinião */}
                    {op.images?.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {op.images.map((src, i) => (
                          <img 
                            key={i} 
                            src={src} 
                            alt="" 
                            className="h-24 w-24 rounded-lg object-cover cursor-pointer hover:opacity-90 transition"
                            onClick={() => window.open(src, '_blank')}
                            loading="lazy" 
                          />
                        ))}
                      </div>
                    )}
                  </SpoilerGuard>

                  {/* Ações */}
                  <div className="flex items-center gap-4 mt-3 text-sm">
                    <button 
                      onClick={() => toggleLike(op)} 
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition"
                    >
                      <Heart className={`h-4 w-4 ${op.liked_by_me ? "fill-current text-primary" : ""}`} /> 
                      {op.likes_count}
                    </button>
                    
                    {/* Contador de respostas — apenas número, sem lista */}
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <MessageSquare className="h-4 w-4" /> 
                      {op.replies_count} {op.replies_count === 1 ? 'pessoa respondeu' : 'pessoas responderam'}
                    </span>
                    
                    {/* Botão Responder — sempre visível para usuários logados */}
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="ml-auto" 
                      disabled={openingId === op.id}
                      onClick={() => openConversation(op)}
                    >
                      {openingId === op.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          {op.user_id === user.id ? 'Ver conversas' : 'Responder em privado'} 
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Dialog de Edição de Visibilidade */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar visibilidade da opinião</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Muda quem pode ver esta opinião específica, sem alterar sua configuração geral.
          </p>
          <PostVisibilitySelect value={editVis} onChange={setEditVis} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              disabled={savingVis}
              onClick={async () => {
                if (!editing) return;
                setSavingVis(true);
                const { error } = await supabase.from("game_opinions").update({ visibility: editVis } as never).eq("id", editing.id);
                setSavingVis(false);
                if (error) { toast.error("Não foi possível alterar a visibilidade"); return; }
                toast.success("Visibilidade do post atualizada");
                setEditing(null);
                void load();
              }}
            >
              {savingVis && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GAP-OP05: Dialog de Denúncia */}
      <Dialog open={reportDialog.open} onOpenChange={(open) => !open && setReportDialog({ open: false, opinionId: '', reason: '' })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Denunciar opinião
            </DialogTitle>
            <DialogDescription>
              Conte-nos o motivo da denúncia. Nossa equipe vai analisar e tomar as medidas cabíveis.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reportDialog.reason}
            onChange={e => setReportDialog(prev => ({ ...prev, reason: e.target.value }))}
            placeholder="Descreva o motivo da denúncia (ex: conteúdo ofensivo, spoiler sem aviso, etc.)"
            rows={3}
            maxLength={500}
          />
          <p className="text-[10px] text-muted-foreground text-right">{reportDialog.reason.length}/500</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReportDialog({ open: false, opinionId: '', reason: '' })}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={reportOpinion} 
              disabled={reporting || !reportDialog.reason.trim()}
            >
              {reporting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Denunciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}