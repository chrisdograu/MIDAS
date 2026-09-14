import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, X, ShieldCheck, ImagePlus, Edit } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { z } from 'zod';
import { stripImageExif } from '@/lib/stripImageExif';
import { averageHash } from '@/lib/perceptualHash';
import EstadoVazio from '@/components/EstadoVazio';
import SelectSimples from '@/components/SelectSimples';

const PLATAFORMAS = ['PC', 'PS5', 'PS4', 'Xbox Series', 'Xbox One', 'Switch', 'Mobile'];
const CATEGORIAS = ['jogo_digital', 'jogo_fisico', 'console', 'acessorio', 'colecionavel', 'outros'];

const schema = z.object({
  title: z.string().trim().min(3, 'Título muito curto').max(120),
  description: z.string().max(2000).optional(),
  price: z.number().nonnegative('Preço inválido'),
});

export default function MNewAd() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const [isEditing, setIsEditing] = useState(false);
  const [adType, setAdType] = useState<'venda' | 'troca'>('venda');
  const [protegido, setProtegido] = useState(false);
  const [hasCert, setHasCert] = useState(false);
  const [hasSeller, setHasSeller] = useState<boolean | null>(null);
  const [form, setForm] = useState({
    title: '', description: '', price: '', condition: 'novo', category: 'jogo_digital',
    desired_item: '', accepts_counteroffer: false,
  });
  const [plataformas, setPlataformas] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [expiresInDays, setExpiresInDays] = useState<30 | 60 | 90>(60);
  const [submitting, setSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<{ id: string; title: string; cover_url: string | null }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameTitle, setGameTitle] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);

  // GAP-1091: Carregar dados para edição
  useEffect(() => {
    if (!editId || !user) return;
    (async () => {
      setLoadingEdit(true);
      const { data: ad, error } = await supabase
        .from('anuncios')
        .select('*')
        .eq('id', editId)
        .eq('seller_id', user.id)
        .maybeSingle();
      if (error || !ad) {
        toast.error('Anúncio não encontrado ou você não tem permissão para editá-lo');
        navigate('/m/marketplace');
        return;
      }
      setIsEditing(true);
      setAdType(ad.ad_type);
      setProtegido(ad.certificate_type !== 'sem_certificado');
      setForm({
        title: ad.title || '',
        description: ad.description || '',
        price: ad.price?.toString() || '',
        condition: ad.condition || 'novo',
        category: ad.category || 'jogo_digital',
        desired_item: ad.desired_item || '',
        accepts_counteroffer: ad.accepts_counteroffer || false,
      });
      setPlataformas(ad.plataformas || []);
      setExpiresInDays(ad.expires_in_days || 60);
      setGameId((ad as any).forum_game_ids?.[0] || null);
      setGameTitle((ad as any).game_title || null);
      
      // Carregar fotos existentes
      const { data: photos } = await supabase
        .from('fotos_anuncio')
        .select('image_url')
        .eq('anuncio_id', editId)
        .order('position');
      setExistingPhotos(photos?.map(p => p.image_url) || []);
      
      setLoadingEdit(false);
    })();
  }, [editId, user]);

  useEffect(() => {
    if (!user) return;
    supabase.from('certificados').select('status').eq('user_id', user.id).eq('status', 'ativo').limit(1)
      .then(({ data }) => setHasCert(!!data?.length));
    supabase.from('seller_profiles').select('id').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setHasSeller(!!data));
  }, [user]);

  // Autocomplete
  useEffect(() => {
    const q = form.title.trim();
    if (q.length < 2) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('games_catalog')
        .select('id, title, cover_url')
        .ilike('title', `%${q}%`)
        .order('popularity', { ascending: false })
        .limit(5);
      setSuggestions(data || []);
    }, 250);
    return () => clearTimeout(t);
  }, [form.title]);

  const togglePlatform = (p: string) =>
    setPlataformas(plataformas.includes(p) ? plataformas.filter(x => x !== p) : [...plataformas, p]);

  // GAP-1092: Validação de arquivo
  const validateFile = (file: File): boolean => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];
    if (!validTypes.includes(file.type)) {
      toast.error(`Formato não suportado: ${file.type}. Use JPG, PNG, WebP, GIF ou HEIC.`);
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 10MB por foto.');
      return false;
    }
    return true;
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const newFiles = Array.from(list);
    // Dedup por nome + tamanho
    const existing = new Set(files.map(f => `${f.name}-${f.size}`));
    const unique = newFiles.filter(f => !existing.has(`${f.name}-${f.size}`));
    const validFiles = unique.filter(validateFile);
    if (validFiles.length === 0) return;
    const total = files.length + validFiles.length + existingPhotos.length;
    if (total > 6) {
      toast.error(`Máximo de 6 fotos. Você já tem ${files.length + existingPhotos.length}.`);
      return;
    }
    setFiles([...files, ...validFiles]);
  };

  // GAP-1091: Remover foto existente
  const removeExistingPhoto = async (url: string) => {
    if (!editId) return;
    const { error } = await supabase
      .from('fotos_anuncio')
      .delete()
      .eq('image_url', url)
      .eq('anuncio_id', editId);
    if (error) {
      toast.error('Erro ao remover foto');
      return;
    }
    setExistingPhotos(prev => prev.filter(p => p !== url));
    toast.success('Foto removida');
  };

  // GAP-1091: Atualizar anúncio
  const updateAd = async (adId: string) => {
    const { error } = await supabase
      .from('anuncios')
      .update({
        title: form.title.trim(),
        description: form.description.trim() || null,
        price: Number(form.price || 0),
        ad_type: adType,
        condition: form.condition,
        category: form.category,
        certificate_type: protegido ? 'verificado' : 'sem_certificado',
        desired_item: adType === 'troca' ? form.desired_item.trim() || null : null,
        plataformas: plataformas.length ? plataformas : null,
        accepts_counteroffer: form.accepts_counteroffer,
        expires_in_days: expiresInDays,
        forum_game_ids: gameId ? [gameId] : [],
        game_title: gameTitle,
        updated_at: new Date().toISOString(),
      })
      .eq('id', adId)
      .eq('seller_id', user.id);
    if (error) throw error;
  };

  const submit = async () => {
    if (!user) return;
    if (!hasSeller) {
      toast.error('Você precisa criar um perfil de vendedor ($) antes de anunciar');
      navigate('/m/vendedor');
      return;
    }
    const parsed = schema.safeParse({
      title: form.title, description: form.description, price: Number(form.price || 0),
    });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    if (protegido && !hasCert) { toast.error('Você precisa de certificação ativa para anúncio protegido'); return; }

    setSubmitting(true);

    // Anti-duplicação apenas para criação
    if (!isEditing) {
      const { data: dup } = await supabase
        .from('anuncios').select('id').eq('seller_id', user.id).eq('status', 'active')
        .ilike('title', form.title.trim()).limit(1);
      if (dup && dup.length) {
        setSubmitting(false);
        toast.error('Você já tem um anúncio ativo com esse título. Edite o existente em vez de duplicar.');
        return;
      }
    }

    try {
      let adId: string;
      
      if (isEditing && editId) {
        await updateAd(editId);
        adId = editId;
      } else {
        const expiresAt = new Date(Date.now() + expiresInDays * 24 * 3600 * 1000).toISOString();
        const { data: ad, error } = await supabase.from('anuncios').insert({
          seller_id: user.id, user_id: user.id, title: form.title.trim(),
          description: form.description.trim() || null, price: Number(form.price || 0),
          ad_type: adType, condition: form.condition, category: form.category,
          certificate_type: protegido ? 'verificado' : 'sem_certificado',
          desired_item: adType === 'troca' ? form.desired_item.trim() || null : null,
          plataformas: plataformas.length ? plataformas : null,
          accepts_counteroffer: form.accepts_counteroffer,
          expires_at: expiresAt,
          expires_in_days: expiresInDays,
          image_hash: files.length ? await averageHash(files[0]) : null,
          forum_game_ids: gameId ? [gameId] : [],
          game_title: gameTitle,
          status: 'active',
        } as any).select('id').single();
        if (error || !ad) throw error;
        adId = ad.id;
      }

      // Upload de novas imagens
      const uploadedCount = await Promise.all(files.map(async (rawFile, i) => {
        const f = await stripImageExif(rawFile);
        const ext = f.name.split('.').pop() || 'jpg';
        const path = `${user.id}/${adId}/${Date.now()}-${i}.${ext}`;
        const { error: upErr } = await supabase.storage.from('ad-images').upload(path, f);
        if (upErr) return false;
        const { data: pub } = supabase.storage.from('ad-images').getPublicUrl(path);
        await supabase.from('fotos_anuncio').insert({ anuncio_id: adId, image_url: pub.publicUrl, position: i + existingPhotos.length });
        return true;
      })).then(results => results.filter(Boolean).length);

      toast.success(isEditing ? 'Anúncio atualizado!' : 'Anúncio publicado!');
      navigate(`/m/marketplace/${adId}`);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao publicar');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return <div className="p-6 text-center text-muted-foreground">Entre para anunciar.</div>;
  if (loadingEdit) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (hasSeller === false) return (
    <div className="px-4 py-10 text-center space-y-4">
      <h2 className="font-display text-lg font-bold gradient-text">Crie seu perfil de vendedor</h2>
      <p className="text-sm text-muted-foreground">Para publicar anúncios no marketplace você precisa primeiro criar seu perfil de vendedor — separado do seu perfil pessoal.</p>
      <button onClick={() => navigate('/m/vendedor')} className="px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold">
        Criar perfil de vendedor
      </button>
    </div>
  );

  return (
    <div className="px-4 py-5 space-y-4 pb-12">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Voltar</button>
      <h1 className="font-display text-xl font-bold gradient-text">
        {isEditing ? 'Editar anúncio' : 'Novo anúncio'}
      </h1>

      <div className="glass rounded-xl p-3 space-y-3">
        <div className="flex p-1 bg-secondary rounded-lg">
          <button onClick={() => setAdType('venda')} className={`flex-1 py-2 rounded-md text-xs font-semibold ${adType === 'venda' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>💰 Venda</button>
          <button onClick={() => setAdType('troca')} className={`flex-1 py-2 rounded-md text-xs font-semibold ${adType === 'troca' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}>🔄 Troca</button>
        </div>

        <div className="space-y-2 border border-border rounded-lg p-3">
          <button onClick={() => setProtegido(!protegido)} className="w-full flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-success" />Protegido pela loja</span>
            <span className={`relative w-10 h-5 rounded-full ${protegido ? 'bg-success' : 'bg-secondary'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-background transition-transform ${protegido ? 'translate-x-5' : ''}`} />
            </span>
          </button>
          <p className="text-[11px] text-muted-foreground">
            {protegido
              ? hasCert ? '✅ Você tem certificação ativa.' : '⚠️ Você precisa solicitar certificação em Configurações.'
              : 'Sem certificação. A loja não responde por problemas — risco do comprador e vendedor.'}
          </p>
        </div>
      </div>

      <div className="relative">
        <input
          value={form.title}
          onChange={e => { setForm({ ...form, title: e.target.value }); setGameId(null); setGameTitle(null); setShowSuggestions(true); }}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onFocus={() => setShowSuggestions(true)}
          maxLength={120}
          placeholder="Título do anúncio (digite o nome do jogo)"
          className="w-full p-3 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-card border border-border rounded-lg overflow-hidden shadow-lg">
            {suggestions.map(s => (
              <button key={s.id} type="button" onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setForm({ ...form, title: s.title }); setGameId(s.id); setGameTitle(s.title); setShowSuggestions(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-left">
                {s.cover_url && <img src={s.cover_url} alt="" className="w-6 h-8 object-cover rounded" loading="lazy" />}
                <span className="text-sm">{s.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {gameTitle && (
        <p className="text-[11px] text-muted-foreground -mt-2">
          Marcado no jogo <span className="font-semibold text-primary">{gameTitle}</span> — aparece no filtro por jogo do marketplace.
        </p>
      )}
      <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} maxLength={2000} rows={4} placeholder="Descrição detalhada..." className="w-full p-3 bg-card border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50" />
      <input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="Preço (R$)" className="w-full p-3 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />

      {adType === 'troca' && (
        <input value={form.desired_item} onChange={e => setForm({ ...form, desired_item: e.target.value })} maxLength={200} placeholder="O que você procura?" className="w-full p-3 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50" />
      )}

      <div className="grid grid-cols-2 gap-2">
        <SelectSimples
          label="Categoria"
          value={form.category}
          onChange={(v) => setForm({ ...form, category: v })}
          options={CATEGORIAS.map((c) => ({ value: c, label: c.replace('_', ' ') }))}
        />
        <SelectSimples
          label="Condição do item"
          value={form.condition}
          onChange={(v) => setForm({ ...form, condition: v })}
          options={[
            { value: 'novo', label: 'Novo (lacrado)' },
            { value: 'seminovo', label: 'Seminovo' },
            { value: 'usado', label: 'Usado' },
            { value: 'recondicionado', label: 'Recondicionado' },
          ]}
        />
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Plataformas</label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {PLATAFORMAS.map(p => (
            <button key={p} onClick={() => togglePlatform(p)} className={`text-xs px-2.5 py-1 rounded-full border ${plataformas.includes(p) ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border'}`}>{p}</button>
          ))}
        </div>
      </div>

      <button onClick={() => setForm({ ...form, accepts_counteroffer: !form.accepts_counteroffer })} className="w-full flex items-center justify-between p-3 glass rounded-lg">
        <span className="text-sm">💬 Aceitar contraofertas</span>
        <span className={`relative w-10 h-5 rounded-full ${form.accepts_counteroffer ? 'bg-primary' : 'bg-secondary'}`}>
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-background transition-transform ${form.accepts_counteroffer ? 'translate-x-5' : ''}`} />
        </span>
      </button>

      {/* GAP-1091: Fotos existentes + novas */}
      <div>
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Fotos (até 6)</label>
        <div className="grid grid-cols-3 gap-2 mt-1">
          {/* Fotos existentes */}
          {existingPhotos.map((url, i) => (
            <div key={`existing-${i}`} className="relative aspect-square rounded-lg overflow-hidden">
              <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
              {isEditing && (
                <button onClick={() => removeExistingPhoto(url)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          {/* Novas fotos */}
          {files.map((f, i) => (
            <div key={`new-${i}`} className="relative aspect-square rounded-lg overflow-hidden">
              <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" loading="lazy" />
              <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"><X className="h-3 w-3" /></button>
            </div>
          ))}
          {(files.length + existingPhotos.length) < 6 && (
            <label className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary text-muted-foreground">
              <Plus className="h-6 w-6" />
              <input type="file" accept="image/*" multiple hidden onChange={e => addFiles(e.target.files)} />
            </label>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Formatos: JPG, PNG, WebP, GIF, HEIC · Máx 10MB por foto</p>
      </div>

      {/* Expiração */}
      <div>
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Expirar em</label>
        <div className="flex gap-1.5 mt-1">
          {([30, 60, 90] as const).map(d => (
            <button key={d} onClick={() => setExpiresInDays(d)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold border ${expiresInDays === d ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border'}`}>
              {d} dias
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Após expirar, o anúncio é ocultado. Você pode renovar a qualquer momento.</p>
      </div>

      {/* Completude */}
      {(() => {
        const checks = [
          { ok: files.length > 0 || existingPhotos.length > 0, label: 'Pelo menos 1 foto' },
          { ok: !!form.condition, label: 'Condição' },
          { ok: (form.description || '').trim().length >= 40, label: 'Descrição com 40+ caracteres' },
          { ok: Number(form.price) > 0 || adType === 'troca', label: adType === 'troca' ? 'Item desejado' : 'Preço' },
          { ok: adType === 'troca' ? !!form.desired_item.trim() : true, label: 'Item desejado (troca)' },
          { ok: plataformas.length > 0, label: 'Plataforma' },
          { ok: form.title.trim().length >= 3, label: 'Título' },
        ].filter((c, i) => !(adType !== 'troca' && i === 4));
        const done = checks.filter(c => c.ok).length;
        const pct = Math.round((done / checks.length) * 100);
        return (
          <div className="glass rounded-xl p-3">
            <div className="flex items-center justify-between text-xs font-semibold mb-2">
              <span>Completude do anúncio</span>
              <span className={pct === 100 ? 'text-success' : pct >= 70 ? 'text-warning' : 'text-muted-foreground'}>{done}/{checks.length} · {pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div className={`h-full transition-all ${pct === 100 ? 'bg-success' : 'bg-gradient-to-r from-primary to-accent'}`} style={{ width: `${pct}%` }} />
            </div>
            <ul className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
              {checks.map(c => (
                <li key={c.label} className={c.ok ? 'text-success' : 'text-muted-foreground'}>
                  {c.ok ? '✓' : '○'} {c.label}
                </li>
              ))}
            </ul>
            {pct < 100 && <p className="text-[10px] text-muted-foreground mt-1.5">Anúncios completos vendem até 3× mais rápido.</p>}
          </div>
        );
      })()}

      <button onClick={submit} disabled={submitting} className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold glow-primary disabled:opacity-50">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : (isEditing ? 'Atualizar anúncio' : 'Publicar anúncio')}
      </button>
    </div>
  );
}