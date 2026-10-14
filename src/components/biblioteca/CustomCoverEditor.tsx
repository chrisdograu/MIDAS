// Modal de capa customizada para um jogo da biblioteca.
// Grava em library_custom_covers; quando existe, sobrescreve a capa padrão do produto.
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Camera, Loader2, X, Trash2, Image, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { stripImageExif } from '@/lib/stripImageExif';
import { dbWrite } from '@/lib/dbWrite';

interface Props {
  productId: string;
  productTitle: string;
  defaultImage: string | null;
  open: boolean;
  onClose: () => void;
  onSaved?: (newUrl: string | null) => void;
}

// GAP-M027: Capas sugeridas
const SUGGESTED_COVERS = [
  'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=300&h=400&fit=crop',
  'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=300&h=400&fit=crop',
  'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=300&h=400&fit=crop',
];

export default function CustomCoverEditor({ productId, productTitle, defaultImage, open, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [current, setCurrent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedSuggested, setSelectedSuggested] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const { data } = await supabase
        .from('library_custom_covers' as any)
        .select("cover_url")
        .eq('user_id', user.id).eq('product_id', productId).maybeSingle();
      setCurrent((data as any)?.cover_url || null);
      setSelectedSuggested(null);
      setLoading(false);
    })();
  }, [open, user?.id, productId]);

  // GAP-M027: Selecionar capa sugerida
  const selectSuggested = async (url: string) => {
    if (!user) return;
    setSelectedSuggested(url);
    setUploading(true);
    setUploadProgress(50);
    
    const { error } = await supabase.from('library_custom_covers' as any).upsert({
      user_id: user.id, product_id: productId, cover_url: url,
    }, { onConflict: 'user_id,product_id' });
    
    setUploading(false);
    setUploadProgress(0);
    if (error) { toast.error('Erro ao salvar'); return; }
    setCurrent(url);
    onSaved?.(url);
    toast.success('Capa custom salva!');
  };

  // GAP-M028: Progresso de upload
  const handleFile = async (raw: File) => {
    if (!user) return;
    if (raw.size > 3 * 1024 * 1024) { toast.error('Máx 3MB'); return; }
    setUploading(true);
    setUploadProgress(10);
    
    try {
      const f = await stripImageExif(raw);
      setUploadProgress(30);
      const ext = f.name.split('.').pop() || 'jpg';
      const path = `custom-covers/${user.id}/${productId}-${Date.now()}.${ext}`;
      
      // Simular progresso de upload
      const interval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 80));
      }, 200);
      
      const { error: upErr } = await supabase.storage.from('product-images').upload(path, f, { upsert: true });
      clearInterval(interval);
      setUploadProgress(90);
      
      if (upErr) { toast.error('Erro ao enviar'); setUploading(false); setUploadProgress(0); return; }
      
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);
      const { error } = await supabase.from('library_custom_covers' as any).upsert({
        user_id: user.id, product_id: productId, cover_url: publicUrl,
      }, { onConflict: 'user_id,product_id' });
      
      setUploading(false);
      setUploadProgress(0);
      if (error) { toast.error('Erro ao salvar'); return; }
      setCurrent(publicUrl);
      setSelectedSuggested(null);
      onSaved?.(publicUrl);
      toast.success('Capa custom salva!');
    } catch (err) {
      setUploading(false);
      setUploadProgress(0);
      toast.error('Erro ao processar imagem');
    }
  };

  const remove = async () => {
    if (!user) return;
    await dbWrite(supabase.from('library_custom_covers' as any).delete().eq('user_id', user.id).eq('product_id', productId));
    setCurrent(null);
    setSelectedSuggested(null);
    onSaved?.(null);
    toast.success('Voltou à capa padrão');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-overlay/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3 sticky top-0 bg-card z-10 pb-2">
          <h2 className="font-bold text-sm">Capa customizada · {productTitle}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <>
            {/* Preview atual */}
            <div className="aspect-[3/4] max-h-48 mx-auto rounded-xl overflow-hidden bg-secondary mb-3 relative group">
              <img 
                src={current || defaultImage || '/placeholder.svg'} 
                alt={productTitle} 
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {current && (
                <div className="absolute inset-0 bg-overlay/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-on-media text-xs font-medium px-3 py-1 bg-overlay/50 rounded-lg">Capa custom</span>
                </div>
              )}
            </div>

            {/* GAP-M028: Barra de progresso */}
            {uploading && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>Enviando...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* GAP-M027: Capas sugeridas */}
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-2">Ou escolha uma capa sugerida:</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {SUGGESTED_COVERS.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => selectSuggested(url)}
                    disabled={uploading}
                    className={cn(
                      "relative shrink-0 w-16 h-24 rounded-lg overflow-hidden border-2 transition-all",
                      selectedSuggested === url ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
                    )}
                  >
                    <img src={url} alt={`Sugestão ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                    {selectedSuggested === url && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <Check className="h-6 w-6 text-primary" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button 
                onClick={() => fileRef.current?.click()} 
                disabled={uploading}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {current ? 'Trocar capa custom' : 'Enviar capa custom'}
              </button>
              {current && (
                <button 
                  onClick={remove} 
                  disabled={uploading}
                  className="w-full py-2 rounded-lg bg-destructive/10 text-destructive font-medium flex items-center justify-center gap-2 text-sm hover:bg-destructive/20 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Voltar à capa padrão
                </button>
              )}
              <input 
                ref={fileRef} 
                type="file" 
                accept="image/*" 
                hidden 
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} 
                disabled={uploading}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-3 text-center">Visível só para você na sua biblioteca.</p>
          </>
        )}
      </div>
    </div>
  );
}

const cn = (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' ');