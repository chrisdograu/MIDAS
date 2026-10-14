// Customização visual do perfil: banner, cor de destaque e vitrine de troféus.
// Os dados gravam em profiles.theme_color / profile_cover_url / trophy_showcase.
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Loader2, Camera, Palette, Trophy, Save, X, Sparkles, 
  GripVertical, RotateCcw, Check, Image, Trash2, Eye,
  Users, Store, ShieldOff, User, Star
} from 'lucide-react';
import { toast } from 'sonner';
import { stripImageExif } from '@/lib/stripImageExif';
import { CosmeticInventoryGrid } from '@/components/cosmetics/CosmeticInventoryGrid';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const PRESETS = ['#14B8A6', '#A855F7', '#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#EC4899'];

// GAP-CT10: Cores complementares sugeridas
const getComplementaryColors = (hex: string): string[] => {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return [];
  const channels = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
  const encode = (values: number[]) => `#${values.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  return [encode(channels.map(v => 255 - v)), encode(channels.map(v => v + (255 - v) * 0.25))];
};

interface BadgeRow { badge_id: string; name?: string | null; icon?: string | null }
interface TitleRow { id: string; name: string }

// GAP-CT04: Componente SortableItem para vitrine
function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="relative">
      <GripVertical className="absolute -left-1 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/40" />
      {children}
    </div>
  );
}

export default function CustomizacaoTab() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [color, setColor] = useState('#14B8A6');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [showcase, setShowcase] = useState<string[]>([]);
  const [backlogNote, setBacklogNote] = useState('');
  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [titles, setTitles] = useState<TitleRow[]>([]);
  // GAP-CT08: Galeria de banners salvos
  const [savedBanners, setSavedBanners] = useState<string[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  // GAP-CT06: Preview em tempo real
  const [previewMode, setPreviewMode] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // GAP-CT04: Sensors para drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const [{ data: p }, { data: ub }, { data: ut }] = await Promise.all([
        supabase.from('profiles').select('theme_color, profile_cover_url, trophy_showcase, backlog_note').eq('id', user.id).maybeSingle(),
        supabase.from('user_badges').select('badge_id, badge_catalog(name, icon)').eq('user_id', user.id),
        supabase.from('user_titles').select('id, name').eq('user_id', user.id),
      ]);
      const prof = p as any;
      if (prof?.theme_color) setColor(prof.theme_color);
      if (prof?.profile_cover_url) setCoverUrl(prof.profile_cover_url);
      if (prof?.backlog_note) setBacklogNote(prof.backlog_note);
      const sc = (prof?.trophy_showcase as any) || [];
      setShowcase(Array.isArray(sc) ? sc : []);
      setBadges(((ub as any) || []).map((b: any) => ({
        badge_id: b.badge_id, name: b.badge_catalog?.name, icon: b.badge_catalog?.icon,
      })));
      setTitles((ut as any) || []);
      setLoading(false);
    })();
  }, [user?.id]);

  // GAP-CT03: Upload com progresso
  const upload = async (raw: File) => {
    if (!user) return;
    if (raw.size > 5 * 1024 * 1024) { toast.error('Máx 5MB'); return; }
    // GAP-CT02: Validar tipo de imagem
    if (!raw.type.startsWith('image/')) { toast.error('Formato inválido. Envie uma imagem.'); return; }
    
    setUploading(true);
    setUploadProgress(0);
    
    try {
      const f = await stripImageExif(raw);
      const ext = f.name.split('.').pop() || 'jpg';
      const path = `${user.id}/cover-${Date.now()}.${ext}`;
      
      // Simular progresso
      const interval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);
      
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, f, { upsert: true });
      clearInterval(interval);
      
      if (upErr) { toast.error('Erro ao enviar'); setUploading(false); return; }
      
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      setUploadProgress(100);
      
      // GAP-CT08: Salvar na galeria
      setSavedBanners(prev => [publicUrl, ...prev]);
      setCoverUrl(publicUrl);
      
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
        toast.success('Banner enviado!');
      }, 300);
    } catch (err) {
      setUploading(false);
      setUploadProgress(0);
      toast.error('Erro ao processar imagem');
    }
  };

  // GAP-CT06: Preview em tempo real
  const previewData = useMemo(() => ({
    color,
    coverUrl,
    showcase,
  }), [color, coverUrl, showcase]);

  // GAP-CT04: Reordenar vitrine
  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = showcase.indexOf(active.id);
      const newIndex = showcase.indexOf(over.id);
      setShowcase(arrayMove(showcase, oldIndex, newIndex));
    }
  };

  // GAP-CT10: Sugerir cores complementares
  const complementaryColors = useMemo(() => {
    try {
      return getComplementaryColors(color);
    } catch {
      return ['#14B8A6', '#A855F7'];
    }
  }, [color]);

  const save = async () => {
    if (!user) return;
    
    if (saving) return;
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      toast.error('Escolha uma cor válida no formato #RRGGBB.');
      return;
    }
    
    setSaving(true);
    const { data, error } = await supabase.from('profiles').update({
      theme_color: color,
      profile_cover_url: coverUrl,
      trophy_showcase: showcase,
      backlog_note: backlogNote.trim() ? backlogNote.trim().slice(0, 280) : null,
    } as any).eq('id', user.id).select('id').maybeSingle();
    setSaving(false);
    if (error || !data) { toast.error('Não foi possível salvar a personalização. Tente novamente.'); return; }
    toast.success('Personalização salva ✨');
  };

  const toggle = (key: string) => {
    setShowcase(prev => prev.includes(key)
      ? prev.filter(x => x !== key)
      : prev.length >= 6 ? prev : [...prev, key]);
  };

  const removeBanner = (url: string) => {
    setSavedBanners(prev => prev.filter(b => b !== url));
    if (coverUrl === url) setCoverUrl(null);
  };

  // GAP-CT05: Verificar se cosmético está equipado
  const isEquipped = (id: string) => showcase.includes(id);

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const showcaseItems = [...showcase];

  return (
    <div className="min-w-0 space-y-6">
      {/* GAP-CT06: Preview em tempo real */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">🎨 Personalização</h2>
        <button
          onClick={() => setPreviewMode(!previewMode)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition",
            previewMode ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-muted"
          )}
        >
          {previewMode ? <Eye className="h-3 w-3 inline mr-1" /> : <Eye className="h-3 w-3 inline mr-1" />}
          {previewMode ? 'Ocultar preview' : 'Preview ao vivo'}
        </button>
      </div>

      {previewMode && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full" style={{ background: color }} />
            <div>
              <p className="text-sm font-medium">Preview do perfil</p>
              <p className="text-xs text-muted-foreground">Cor principal: {color}</p>
              {coverUrl && <p className="text-xs text-muted-foreground">Banner: ✓</p>}
            </div>
          </div>
        </div>
      )}

      {/* Banner */}
      <section className="rounded-xl overflow-hidden border border-border">
        <div className="relative h-32 bg-gradient-to-r from-primary/40 to-accent/40"
             style={coverUrl ? { backgroundImage: `url(${coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${color}30, transparent)` }} />
          
          {/* GAP-CT03: Barra de progresso do upload */}
          {uploading && (
            <div className="absolute inset-0 bg-overlay/50 flex flex-col items-center justify-center">
              <div className="w-48 h-2 bg-on-media/20 rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
              </div>
              <p className="text-on-media text-xs mt-2">{uploadProgress}%</p>
            </div>
          )}
          
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-2 right-2 px-3 py-1.5 rounded-lg bg-background/80 backdrop-blur text-xs font-semibold flex items-center gap-1.5"
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
            {coverUrl ? 'Trocar banner' : 'Enviar banner'}
          </button>
          {coverUrl && (
            <button onClick={() => setCoverUrl(null)} className="absolute top-2 right-2 p-1 rounded-full bg-destructive/80 text-destructive-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
        </div>
        <div className="p-3 text-[10px] text-muted-foreground bg-card flex justify-between">
          <span>Preview do banner — 1920×480 recomendado, máx 5MB.</span>
          {coverUrl && <span className="text-primary">✓ Banner definido</span>}
        </div>
      </section>

      {/* GAP-CT08: Galeria de banners salvos */}
      {savedBanners.length > 0 && (
        <section>
          <button
            onClick={() => setShowGallery(!showGallery)}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Image className="h-3 w-3" />
            {showGallery ? 'Ocultar' : 'Ver'} banners salvos ({savedBanners.length})
          </button>
          {showGallery && (
            <div className="grid grid-cols-4 gap-2 mt-2">
              {savedBanners.map((url, i) => (
                <div key={i} className="relative group aspect-video rounded-lg overflow-hidden border border-border">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-overlay/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                    <button onClick={() => setCoverUrl(url)} className="p-1 bg-primary rounded">
                      <Check className="h-3 w-3 text-on-media" />
                    </button>
                    <button onClick={() => removeBanner(url)} className="p-1 bg-destructive rounded">
                      <Trash2 className="h-3 w-3 text-on-media" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Cor */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Palette className="h-4 w-4" style={{ color }} /> Cor de destaque</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESETS.map(p => (
            <button key={p} onClick={() => setColor(p)}
              className={`w-9 h-9 rounded-full border-2 transition ${color === p ? 'border-foreground scale-110' : 'border-transparent'}`}
              style={{ background: p }} aria-label={p} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-12 h-10 rounded cursor-pointer bg-transparent border border-border" />
          <input type="text" aria-label="Código da cor de destaque" value={color} onChange={e => setColor(e.target.value)} className="min-w-0 flex-1 px-3 py-2 bg-secondary border border-border rounded-lg text-sm font-mono" />
        </div>
        
        {/* GAP-CT10: Cores complementares sugeridas */}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Sugestões:</span>
          {complementaryColors.map((c, i) => (
            <button
              key={i}
              onClick={() => setColor(c)}
              className="w-6 h-6 rounded-full border border-border transition hover:scale-110"
              style={{ background: c }}
            />
          ))}
        </div>
      </section>

      {/* Recado do backlog */}
      <section>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" /> Recado do backlog
        </h3>
        <p className="text-[11px] text-muted-foreground mb-2">
          Uma linha sobre o que você pretende jogar a seguir. Aparece no seu perfil para os amigos.
        </p>
        <textarea
          value={backlogNote}
          onChange={e => setBacklogNote(e.target.value.slice(0, 280))}
          rows={3}
          maxLength={280}
          placeholder="Ex.: terminando o primeiro antes de encostar no DLC..."
          className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm resize-none"
        />
        <p className="text-[10px] text-muted-foreground text-right mt-1">{backlogNote.length}/280</p>
      </section>

      {/* GAP-CT04: Vitrine de Troféus com Drag-and-Drop */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-warning" /> Vitrine de troféus ({showcase.length}/6)
        </h3>
        <p className="text-[11px] text-muted-foreground mb-3">
          Escolha até 6 conquistas e arraste para reordenar. Aparecem no topo do seu perfil público.
        </p>
        
        {badges.length === 0 && titles.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Você ainda não tem conquistas. Jogue, dê reviews e participe de torneios para desbloquear.</p>
        ) : (
          <>
            {/* GAP-CT04: Vitrine ordenável */}
            {showcase.length > 0 && (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={showcase} strategy={verticalListSortingStrategy}>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
                    {showcase.map(key => {
                      const badge = badges.find(b => `badge:${b.badge_id}` === key);
                      const title = titles.find(t => `title:${t.id}` === key);
                      return (
                        <SortableItem key={key} id={key}>
                          <div className="p-3 rounded-xl border border-primary/30 bg-primary/10 text-center">
                            <div className="text-2xl">{badge?.icon || title ? '👑' : '🏆'}</div>
                            <p className="text-[10px] mt-1 line-clamp-2">{badge?.name || title?.name || key}</p>
                            <button
                              onClick={() => toggle(key)}
                              className="mt-1 text-[9px] text-destructive hover:underline"
                            >
                              Remover
                            </button>
                          </div>
                        </SortableItem>
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {/* Disponíveis */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {badges.map(b => {
                const key = `badge:${b.badge_id}`;
                const active = showcase.includes(key);
                const equipped = isEquipped(key);
                return (
                  <button key={key} onClick={() => toggle(key)}
                    className={cn(
                      "p-3 rounded-xl border text-center transition relative",
                      active ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/40',
                      equipped && "ring-1 ring-primary"
                    )}
                  >
                    {/* GAP-CT05: Indicador de equipado */}
                    {equipped && (
                      <span className="absolute -top-1 -right-1 bg-primary text-[8px] text-primary-foreground px-1 rounded-full">
                        ✦
                      </span>
                    )}
                    <div className="text-2xl">{b.icon || '🏆'}</div>
                    <p className="text-[10px] mt-1 line-clamp-2">{b.name || b.badge_id}</p>
                    {active && <Check className="h-3 w-3 mx-auto mt-1 text-primary" />}
                  </button>
                );
              })}
              {titles.map(t => {
                const key = `title:${t.id}`;
                const active = showcase.includes(key);
                const equipped = isEquipped(key);
                return (
                  <button key={key} onClick={() => toggle(key)}
                    className={cn(
                      "p-3 rounded-xl border text-center transition relative",
                      active ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/40',
                      equipped && "ring-1 ring-primary"
                    )}
                  >
                    {equipped && (
                      <span className="absolute -top-1 -right-1 bg-primary text-[8px] text-primary-foreground px-1 rounded-full">
                        ✦
                      </span>
                    )}
                    <div className="text-2xl">👑</div>
                    <p className="text-[10px] mt-1 line-clamp-2">{t.name}</p>
                    {active && <Check className="h-3 w-3 mx-auto mt-1 text-primary" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* GAP-CT07: Botão Salvar com confirmação */}
      <Button onClick={save} disabled={saving || uploading}
        className="w-full min-h-11 gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Salvar personalização
      </Button>

      {/* Inventário de cosméticos */}
      <section className="pt-4 border-t border-border">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Cosméticos de jogos
        </h3>
        <p className="text-[11px] text-muted-foreground mb-3">
          Recompensas desbloqueadas pelos seus jogos. Clique para equipar no perfil.
        </p>
        <CosmeticInventoryGrid />
      </section>
    </div>
  );
}