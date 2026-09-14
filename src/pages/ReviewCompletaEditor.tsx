import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProduto } from '@/hooks/useProdutos';
import { ArrowLeft, BookOpen, Lock, Users, Save, Loader2, Eye, Image, Bold, Italic, Underline, List, X, Plus, History, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import SpoilerComposerControls from '@/components/spoiler/SpoilerComposerControls';
import SelectSimples from '@/components/SelectSimples';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { dbWrite } from '@/lib/dbWrite';
import { stripImageExif } from '@/lib/stripImageExif';

type Visibility = 'friends' | 'private';

const STATUS_OPTS = ['jogando', 'zerado', 'pausado', 'abandonado', 'rejogando'];
const PLATAFORMA_OPTS = ['PC', 'PlayStation', 'Xbox', 'Switch', 'Mobile', 'Outro'];
const DIFICULDADE_OPTS = ['Fácil', 'Normal', 'Difícil', 'Muito Difícil', 'Brutal'];
const RECOMENDACAO_OPTS = ['Recomendo muito', 'Recomendo', 'Talvez', 'Não recomendo'];
const TAGS = ['Emocionante', 'Nostálgico', 'Frustrante', 'Relaxante', 'Sombrio', 'Inspirador', 'Engraçado', 'Profundo', 'Viciante'];

// GAP-591: Toolbar de formatação
function FormatToolbar({ onFormat, textareaRef }: { onFormat: (tag: string) => void; textareaRef: React.RefObject<HTMLTextAreaElement> }) {
  const buttons = [
    { icon: Bold, tag: '**', label: 'Negrito' },
    { icon: Italic, tag: '*', label: 'Itálico' },
    { icon: Underline, tag: '__', label: 'Sublinhado' },
    { icon: List, tag: '- ', label: 'Lista' },
  ];

  return (
    <div className="flex items-center gap-1 p-1 border border-border rounded-t-lg bg-secondary/30">
      {buttons.map((btn) => {
        const Icon = btn.icon;
        return (
          <button
            key={btn.label}
            type="button"
            onClick={() => onFormat(btn.tag)}
            className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
            title={btn.label}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}

// GAP-590: Upload de imagens
function ImageUpload({ onUpload, uploading }: { onUpload: (url: string) => void; uploading: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem deve ter no máximo 5MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Apenas imagens são permitidas');
      return;
    }

    try {
      const processed = await stripImageExif(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
        onUpload(reader.result as string);
        toast.success('Imagem adicionada!');
      };
      reader.readAsDataURL(processed);
    } catch {
      toast.error('Erro ao processar imagem');
    }
    e.target.value = '';
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:border-primary/40 transition-colors disabled:opacity-50"
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Image className="h-3.5 w-3.5" />}
        Adicionar imagem
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      {preview && (
        <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-border">
          <img src={preview} alt="Preview" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => { setPreview(null); onUpload(''); }}
            className="absolute top-0 right-0 p-0.5 bg-destructive/80 text-destructive-foreground rounded-bl-lg"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// GAP-588: Modal de preview
function PreviewModal({ open, onClose, content }: { open: boolean; onClose: () => void; content: any }) {
  if (!open) return null;

  const formatText = (text: string) => {
    const escapeHtmlLocal = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
    if (!text) return '';
    // Aplicar formatação básica
    let formatted = escapeHtmlLocal(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/__(.*?)__/g, '<u>$1</u>')
      .replace(/^- (.*?)(\n|$)/gm, '<li>$1</li>');
    if (formatted.includes('<li>')) {
      formatted = `<ul>${formatted}</ul>`;
    }
    return formatted;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" /> Preview da Review
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {content.analise && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-1">Análise</h4>
              <div 
                className="text-sm text-muted-foreground prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: formatText(content.analise) }}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {content.horas && <div><span className="text-muted-foreground">Horas:</span> {content.horas}h</div>}
            {content.plataforma && <div><span className="text-muted-foreground">Plataforma:</span> {content.plataforma}</div>}
            {content.dificuldade && <div><span className="text-muted-foreground">Dificuldade:</span> {content.dificuldade}</div>}
            {content.status && <div><span className="text-muted-foreground">Status:</span> {content.status}</div>}
            {content.recomendacao && <div><span className="text-muted-foreground">Recomendação:</span> {content.recomendacao}</div>}
          </div>
          {content.pros && (
            <div>
              <h4 className="text-sm font-semibold text-success mb-1">✅ Prós</h4>
              <ul className="text-xs text-muted-foreground list-disc pl-4">
                {content.pros.split('\n').filter(Boolean).map((p: string, i: number) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {content.contras && (
            <div>
              <h4 className="text-sm font-semibold text-destructive mb-1">❌ Contras</h4>
              <ul className="text-xs text-muted-foreground list-disc pl-4">
                {content.contras.split('\n').filter(Boolean).map((c: string, i: number) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {content.tags?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-1">Tags emocionais</h4>
              <div className="flex flex-wrap gap-1">
                {content.tags.map((t: string) => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{t}</span>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {content.visibility === 'private' ? <Lock className="h-3 w-3" /> : <Users className="h-3 w-3" />}
            {content.visibility === 'private' ? 'Apenas Close Friends' : 'Amigos'}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// GAP-592: Histórico de edições (simplificado)
function VersionHistory({ versions, onRestore }: { versions: any[]; onRestore: (version: any) => void }) {
  if (versions.length === 0) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <History className="h-3 w-3" /> Histórico de edições
      </p>
      {versions.slice(0, 5).map((v, i) => (
        <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-secondary/40">
          <span className="text-muted-foreground">
            {new Date(v.created_at).toLocaleDateString('pt-BR')} {new Date(v.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            type="button"
            onClick={() => onRestore(v)}
            className="text-primary hover:underline text-[10px]"
          >
            Restaurar
          </button>
        </div>
      ))}
    </div>
  );
}

export default function ReviewCompletaEditor() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: game } = useProduto(id);

  const [analise, setAnalise] = useState('');
  const [horas, setHoras] = useState<string>('');
  const [plataforma, setPlataforma] = useState('');
  const [dificuldade, setDificuldade] = useState('');
  const [status, setStatus] = useState('');
  const [recomendacao, setRecomendacao] = useState('');
  const [personagens, setPersonagens] = useState('');
  const [trilha, setTrilha] = useState('');
  const [momentos, setMomentos] = useState('');
  const [pros, setPros] = useState('');
  const [contras, setContras] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<Visibility>('friends');
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [spoilerAch, setSpoilerAch] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // GAP-588: Preview
  const [showPreview, setShowPreview] = useState(false);

  // GAP-589: Confirmação de publicação
  const [showConfirm, setShowConfirm] = useState(false);

  // GAP-592: Versões (histórico)
  const [versions, setVersions] = useState<any[]>([]);

  const { data: existing, isLoading } = useQuery({
    queryKey: ['review-completa', id, user?.id],
    enabled: !!id && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('reviews_completas' as any)
        .select('*')
        .eq('product_id', id!)
        .eq('user_id', user!.id)
        .maybeSingle();
      return data as any;
    },
  });

  // GAP-592: Buscar histórico de versões
  const { data: versionHistory } = useQuery({
    queryKey: ['review-versions', existing?.id],
    enabled: !!existing?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('review_versions' as any)
        .select('*')
        .eq('review_id', existing.id)
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  useEffect(() => {
    if (versionHistory) {
      setVersions(versionHistory);
    }
  }, [versionHistory]);

  const draftKey = user && id ? `review-draft:${user.id}:${id}` : null;

  // Restaura rascunho
  useEffect(() => {
    if (existing) {
      setAnalise(existing.analise || '');
      setHoras(existing.horas_jogadas?.toString() || '');
      setPlataforma(existing.plataforma || '');
      setDificuldade(existing.dificuldade || '');
      setStatus(existing.status || '');
      setRecomendacao(existing.recomendacao || '');
      setPersonagens(existing.personagens_favoritos || '');
      setTrilha(existing.trilha_sonora_favorita || '');
      setMomentos(existing.momentos_favoritos || '');
      setPros((existing.pros || []).join('\n'));
      setContras((existing.contras || []).join('\n'));
      setTags(existing.tags_emocionais || []);
      setVisibility((existing.visibility as Visibility) || 'friends');
      setIsSpoiler(!!existing.is_spoiler);
      setSpoilerAch(existing.spoiler_achievement_name || null);
      return;
    }
    if (!draftKey) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.analise) setAnalise(d.analise);
      if (d.horas) setHoras(d.horas);
      if (d.plataforma) setPlataforma(d.plataforma);
      if (d.dificuldade) setDificuldade(d.dificuldade);
      if (d.status) setStatus(d.status);
      if (d.recomendacao) setRecomendacao(d.recomendacao);
      if (d.personagens) setPersonagens(d.personagens);
      if (d.trilha) setTrilha(d.trilha);
      if (d.momentos) setMomentos(d.momentos);
      if (d.pros) setPros(d.pros);
      if (d.contras) setContras(d.contras);
      if (Array.isArray(d.tags)) setTags(d.tags);
      if (d.visibility) setVisibility(d.visibility);
      if (typeof d.isSpoiler === 'boolean') setIsSpoiler(d.isSpoiler);
      if (d.spoilerAch) setSpoilerAch(d.spoilerAch);
      toast.info('Rascunho restaurado do dispositivo.');
    } catch { /* ignore */ }
  }, [existing, draftKey]);

  // Autosave
  useEffect(() => {
    if (!draftKey || existing) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({
          analise, horas, plataforma, dificuldade, status, recomendacao,
          personagens, trilha, momentos, pros, contras, tags,
          visibility, isSpoiler, spoilerAch,
        }));
      } catch { /* ignore */ }
    }, 800);
    return () => clearTimeout(t);
  }, [draftKey, existing, analise, horas, plataforma, dificuldade, status, recomendacao, personagens, trilha, momentos, pros, contras, tags, visibility, isSpoiler, spoilerAch]);

  // GAP-591: Aplicar formatação
  const applyFormat = (tag: string) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);

    let newText = '';
    if (tag === '- ') {
      // Lista
      const lines = selectedText.split('\n');
      const formatted = lines.map(line => `- ${line}`).join('\n');
      newText = before + formatted + after;
    } else {
      newText = before + tag + selectedText + tag + after;
    }
    setAnalise(newText);
    // Focar e selecionar o texto formatado
    setTimeout(() => {
      textarea.focus();
      const newStart = start + tag.length;
      const newEnd = end + tag.length;
      textarea.setSelectionRange(newStart, newEnd);
    }, 10);
  };

  // GAP-590: Upload de imagem
  const handleImageUpload = (url: string) => {
    if (url) {
      setAnalise(prev => prev + `\n\n![Imagem](${url})\n\n`);
    }
  };

  // GAP-592: Restaurar versão
  const restoreVersion = (version: any) => {
    setAnalise(version.analise || '');
    setHoras(version.horas_jogadas?.toString() || '');
    setPlataforma(version.plataforma || '');
    setDificuldade(version.dificuldade || '');
    setStatus(version.status || '');
    setRecomendacao(version.recomendacao || '');
    setPersonagens(version.personagens_favoritos || '');
    setTrilha(version.trilha_sonora_favorita || '');
    setMomentos(version.momentos_favoritos || '');
    setPros((version.pros || []).join('\n'));
    setContras((version.contras || []).join('\n'));
    setTags(version.tags_emocionais || []);
    toast.success('Versão restaurada!');
  };

  // GAP-589: Confirmar publicação
  const handlePublish = () => {
    if (!analise.trim()) {
      toast.error('Escreva sua análise antes de salvar');
      return;
    }
    setShowConfirm(true);
  };

  // GAP-589: Salvar após confirmação
  const handleSave = async () => {
    setShowConfirm(false);
    setSaving(true);

    const payload = {
      user_id: user.id,
      product_id: id!,
      analise: analise.trim(),
      horas_jogadas: horas ? parseInt(horas, 10) : null,
      plataforma: plataforma || null,
      dificuldade: dificuldade || null,
      status: status || null,
      recomendacao: recomendacao || null,
      personagens_favoritos: personagens.trim() || null,
      trilha_sonora_favorita: trilha.trim() || null,
      momentos_favoritos: momentos.trim() || null,
      pros: pros.split('\n').map(s => s.trim()).filter(Boolean),
      contras: contras.split('\n').map(s => s.trim()).filter(Boolean),
      tags_emocionais: tags,
      visibility,
      is_spoiler: isSpoiler,
      spoiler_achievement_name: spoilerAch,
    };

    // GAP-592: Salvar versão atual no histórico
    if (existing) {
      await dbWrite(
        supabase
          .from('review_versions' as any)
          .insert({
            review_id: existing.id,
            ...payload,
          })
      );
    }

    const { error } = existing
      ? await supabase.from('reviews_completas' as any).update(payload).eq('id', existing.id)
      : await supabase.from('reviews_completas' as any).insert(payload);

    setSaving(false);

    if (error) {
      toast.error('Erro ao salvar');
      return;
    }

    if (draftKey) {
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
    }

    toast.success(existing ? 'Review atualizada!' : 'Review publicada!');
    navigate(`/jogo/${id}/social`);
  };

  // GAP-588: Conteúdo para preview
  const previewContent = {
    analise,
    horas,
    plataforma,
    dificuldade,
    status,
    recomendacao,
    personagens,
    trilha,
    momentos,
    pros,
    contras,
    tags,
    visibility,
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">
        Faça login para escrever uma Review Completa.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Link to={`/jogo/${id}/social`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
        <ArrowLeft className="h-4 w-4" /> Voltar ao Hub
      </Link>

      <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl p-5 mb-6">
        <p className="text-xs text-primary font-semibold uppercase tracking-wider flex items-center gap-1">
          <BookOpen className="h-3 w-3" /> Review Completa · Diário gamer privado
        </p>
        <h1 className="text-2xl font-bold text-foreground mt-1">
          {game?.title ?? 'Carregando...'}
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Só seus amigos (ou close friends) podem ler. Diferente da Review pública mobile.
        </p>
      </motion.header>

      <div className="space-y-5">
        {/* GAP-588: Botão de preview */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:border-primary/40 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" /> Visualizar
          </button>
        </div>

        <Field label="Análise detalhada *">
          {/* GAP-591: Toolbar de formatação */}
          <FormatToolbar onFormat={applyFormat} textareaRef={textareaRef} />
          <textarea
            ref={textareaRef}
            value={analise}
            onChange={e => setAnalise(e.target.value)}
            rows={6}
            placeholder="Conte sua experiência completa com o jogo... Use **negrito**, *itálico* e - listas"
            className="w-full rounded-b-lg bg-background border border-t-0 border-border p-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </Field>

        {/* GAP-590: Upload de imagens */}
        <Field label="Imagens">
          <ImageUpload onUpload={handleImageUpload} uploading={uploadingImage} />
          <p className="text-[10px] text-muted-foreground mt-1">Imagens serão inseridas como Markdown no texto</p>
        </Field>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Horas jogadas">
            <input type="number" min={0} value={horas} onChange={e => setHoras(e.target.value)}
              className="w-full rounded-lg bg-background border border-border p-2 text-sm" />
          </Field>
          <Select label="Plataforma" value={plataforma} onChange={setPlataforma} options={PLATAFORMA_OPTS} />
          <Select label="Dificuldade" value={dificuldade} onChange={setDificuldade} options={DIFICULDADE_OPTS} />
          <Select label="Status" value={status} onChange={setStatus} options={STATUS_OPTS} />
        </div>

        <Select label="Recomendação" value={recomendacao} onChange={setRecomendacao} options={RECOMENDACAO_OPTS} />

        <Field label="Personagens favoritos">
          <input value={personagens} onChange={e => setPersonagens(e.target.value)}
            className="w-full rounded-lg bg-background border border-border p-2 text-sm" />
        </Field>
        <Field label="Trilha sonora favorita">
          <input value={trilha} onChange={e => setTrilha(e.target.value)}
            className="w-full rounded-lg bg-background border border-border p-2 text-sm" />
        </Field>
        <Field label="Momentos favoritos">
          <textarea value={momentos} onChange={e => setMomentos(e.target.value)} rows={3}
            className="w-full rounded-lg bg-background border border-border p-2 text-sm" />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Prós (um por linha)">
            <textarea value={pros} onChange={e => setPros(e.target.value)} rows={4}
              className="w-full rounded-lg bg-background border border-border p-2 text-sm" />
          </Field>
          <Field label="Contras (um por linha)">
            <textarea value={contras} onChange={e => setContras(e.target.value)} rows={4}
              className="w-full rounded-lg bg-background border border-border p-2 text-sm" />
          </Field>
        </div>

        <Field label="Tags emocionais">
          <div className="flex flex-wrap gap-1.5">
            {TAGS.map(t => (
              <button key={t} type="button" onClick={() => setTags(tags.includes(t) ? tags.filter(x => x !== t) : [...tags, t])}
                className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                  tags.includes(t) ? 'border-primary bg-primary/10 text-primary glow-primary' : 'border-border text-muted-foreground'
                }`}>{t}</button>
            ))}
          </div>
        </Field>

        <Field label="Visibilidade">
          <div className="flex gap-2">
            {(['friends', 'private'] as Visibility[]).map(v => (
              <button key={v} type="button" onClick={() => setVisibility(v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  visibility === v ? 'border-primary bg-primary/10 text-primary glow-primary' : 'border-border text-muted-foreground'
                }`}>
                {v === 'friends' ? <><Users className="h-3 w-3" /> Amigos</> : <><Lock className="h-3 w-3" /> Close Friends</>}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Aviso de spoiler">
          <SpoilerComposerControls
            isSpoiler={isSpoiler}
            onIsSpoilerChange={setIsSpoiler}
            achievementName={spoilerAch}
            onAchievementNameChange={setSpoilerAch}
            productId={id}
          />
        </Field>

        {/* GAP-592: Histórico de versões */}
        {versions.length > 0 && (
          <VersionHistory versions={versions} onRestore={restoreVersion} />
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={() => navigate(-1)} className="px-4 py-2 rounded-lg text-sm border border-border text-muted-foreground">
            Cancelar
          </button>
          <button
            onClick={handlePublish}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-semibold flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {existing ? 'Atualizar' : 'Publicar'}
          </button>
        </div>
      </div>

      {/* GAP-588: Modal de preview */}
      <PreviewModal
        open={showPreview}
        onClose={() => setShowPreview(false)}
        content={previewContent}
      />

      {/* GAP-589: Dialog de confirmação */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" /> Publicar review?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {existing
                ? 'Tem certeza que deseja atualizar esta review? Ela será atualizada para seus amigos.'
                : 'Tem certeza que deseja publicar esta review? Ela será visível para seus amigos.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSave} className="bg-primary hover:bg-primary/90">
              {existing ? 'Atualizar' : 'Publicar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-foreground block mb-1">{label}</span>
      {children}
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <Field label={label}>
      <SelectSimples
        value={value}
        onChange={onChange}
        className="w-full"
        placeholder="—"
        options={options.map(o => ({ value: o, label: o }))}
      />
    </Field>
  );
}