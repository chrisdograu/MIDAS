// Campo de imagens para telas de cadastro que ainda não têm ID no banco.
// Aceita upload (Supabase Storage) e link direto — os dois, não um ou outro.
import { useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Trash2, Loader2, Link2, ImagePlus, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  label?: string;
  hint?: string;
  value: string[];
  onChange: (urls: string[]) => void;
  /** Pasta dentro do bucket product-images. */
  folder?: string;
  maxImages?: number;
  onBlur?: () => void;
  validateImage?: (x: any) => any;
}

// GAP-D379: Tipos de arquivo permitidos
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function ImageGalleryField({ 
  label = 'Imagens', 
  hint, 
  value, 
  onChange, 
  folder = 'catalogo',
  maxImages = 10 
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  // GAP-D380: Compressão básica via canvas
  const compressImage = useCallback((file: File, maxWidth = 1200, maxHeight = 1200): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Falha ao criar contexto')); return; }
          
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (!blob) { reject(new Error('Falha ao comprimir')); return; }
            const compressedFile = new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, {
              type: 'image/webp',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          }, 'image/webp', 0.8);
        };
        img.onerror = () => reject(new Error('Falha ao carregar imagem'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  }, []);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setError(null);

    // GAP-D379: Validação de tipo e tamanho
    const invalidFiles = files.filter(f => {
      const ext = '.' + f.name.split('.').pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_TYPES.includes(f.type)) {
        return true;
      }
      return f.size > MAX_FILE_SIZE;
    });

    if (invalidFiles.length > 0) {
      const names = invalidFiles.map(f => f.name).join(', ');
      toast.error(`${invalidFiles.length} arquivo(s) inválidos: ${names}`);
      return;
    }

    if (value.length + files.length > maxImages) {
      toast.error(`Máximo de ${maxImages} imagens permitidas.`);
      return;
    }

    setUploading(true);
    const added: string[] = [];
    
    for (const file of files) {
      try {
        // GAP-D380: Comprimir imagem
        const compressed = await compressImage(file);
        const ext = compressed.name.split('.').pop();
        const path = `${folder}/${crypto.randomUUID()}.${ext}`;
        
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(path, compressed);
        
        if (uploadError) { 
          toast.error(`${file.name}: ${uploadError.message}`); 
          continue; 
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(path);
        
        added.push(publicUrl);
      } catch (err) {
        toast.error(`Erro ao processar ${file.name}`);
      }
    }
    
    setUploading(false);
    if (ref.current) ref.current.value = '';
    
    if (added.length) { 
      onChange([...value, ...added]); 
      toast.success(`${added.length} imagem(ns) adicionada(s)`);
    }
  };

  const addUrl = () => {
    const v = url.trim();
    setError(null);
    if (!v) return;
    
    try {
      const parsed = new URL(v);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('protocolo inválido');
    } catch {
      setError('Informe uma URL de imagem válida (começando com https://).');
      return;
    }

    if (value.length >= maxImages) {
      toast.error(`Máximo de ${maxImages} imagens permitidas.`);
      return;
    }

    onChange([...value, v]);
    setUrl('');
    toast.success('Link adicionado');
  };

  const removeImage = (src: string) => {
    onChange(value.filter(v => v !== src));
  };

  const isImageLoading = (src: string) => {
    // Verifica se a imagem ainda está carregando
    return false; // Simplificado
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label className="flex items-center gap-2">
          <ImagePlus className="h-4 w-4" aria-hidden /> 
          {label}
          <span className="text-xs text-muted-foreground font-normal">
            ({value.length}/{maxImages})
          </span>
        </Label>
        <Button 
          type="button" 
          size="sm" 
          variant="outline" 
          onClick={() => ref.current?.click()} 
          disabled={uploading || value.length >= maxImages}
        >
          {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />} 
          Enviar
        </Button>
        <input 
          ref={ref} 
          type="file" 
          accept={ALLOWED_EXTENSIONS.join(',')} 
          multiple 
          onChange={upload} 
          className="hidden" 
          disabled={value.length >= maxImages}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-xs">
          <AlertCircle className="h-3 w-3" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            value={url}
            onChange={e => { setUrl(e.target.value); setError(null); }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }}
            placeholder="Cole o link da imagem (https://...)"
            aria-label="URL da imagem"
            className="pl-9"
            disabled={value.length >= maxImages}
          />
        </div>
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          onClick={addUrl} 
          disabled={!url.trim() || value.length >= maxImages}
        >
          Adicionar link
        </Button>
      </div>

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      {/* GAP-D381: Grid responsivo melhorado */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {value.map((src, i) => (
            <div 
              key={src} 
              className="relative group aspect-square rounded-lg border border-border overflow-hidden bg-muted/20"
            >
              <img 
                src={src} 
                alt="" 
                className="w-full h-full object-cover transition-all group-hover:scale-105" 
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '';
                  (e.target as HTMLImageElement).className = 'hidden';
                }}
              />
              {i === 0 && (
                <span className="absolute bottom-1 left-1 text-[9px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-medium">
                  principal
                </span>
              )}
               <Button
                type="button"
                 variant="destructive"
                 size="icon"
                aria-label="Remover imagem"
                 title="Remover imagem"
                onClick={() => removeImage(src)}
                 className="absolute top-1 right-1 h-7 w-7 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
               </Button>
               <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-all pointer-events-none" />
            </div>
          ))}
        </div>
      )}

      {value.length === 0 && (
        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          <ImagePlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Nenhuma imagem adicionada
        </div>
      )}

      {value.length >= maxImages && (
        <p className="text-xs text-warning">Limite máximo de {maxImages} imagens atingido.</p>
      )}
    </div>
  );
}