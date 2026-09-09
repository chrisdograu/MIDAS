import { useEffect, useState, useRef } from 'react';
import { Loader2, Search, X, Star, Upload, Heart, TrendingUp, Smile, Gamepad2, Music } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Giphy public beta key — funciona para uso leve sem registro.
const GIPHY_KEY = 'dc6zaTOxFJmzC';
// Tenor v1 anonymous key (compatível com a base usada pelo Instagram/iOS).
const TENOR_KEY = 'LIVDSRZULELA';

type Source = 'giphy' | 'tenor';

// GAP-GP01: Categorias de GIFs
type Category = 'trending' | 'reactions' | 'gaming' | 'music' | 'favorites';

const categoryMap: Record<Category, { label: string; icon: typeof TrendingUp; query?: string }> = {
  trending: { label: 'Trending', icon: TrendingUp },
  reactions: { label: 'Reações', icon: Smile, query: 'reaction' },
  gaming: { label: 'Gaming', icon: Gamepad2, query: 'gaming' },
  music: { label: 'Música', icon: Music, query: 'music' },
  favorites: { label: 'Favoritos', icon: Heart },
};

interface GifItem {
  id: string;
  url: string;
  preview: string;
  title?: string;
}

export function GifPicker({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [src, setSrc] = useState<Source>('giphy');
  const [category, setCategory] = useState<Category>('trending');
  const [items, setItems] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<{ url: string; preview: string } | null>(null);
  const [favorites, setFavorites] = useState<GifItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // GAP-GP02: Carregar favoritos do localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gif_favorites');
      if (saved) setFavorites(JSON.parse(saved));
    } catch {
      // ignore
    }
  }, []);

  // GAP-GP02: Salvar favoritos
  const saveFavorites = (newFavorites: GifItem[]) => {
    setFavorites(newFavorites);
    localStorage.setItem('gif_favorites', JSON.stringify(newFavorites));
  };

  // GAP-GP02: Toggle favorito
  const toggleFavorite = (gif: GifItem) => {
    const exists = favorites.some(f => f.id === gif.id);
    if (exists) {
      saveFavorites(favorites.filter(f => f.id !== gif.id));
      toast.info('Removido dos favoritos');
    } else {
      saveFavorites([...favorites, gif]);
      toast.success('Adicionado aos favoritos');
    }
  };

  // GAP-GP01: Buscar GIFs por categoria
  const fetchGifs = async (query: string, categoryType: Category) => {
    setLoading(true);
    try {
      const searchTerm = categoryMap[categoryType].query || query;
      const isFavorites = categoryType === 'favorites';
      
      if (isFavorites) {
        setItems(favorites);
        setLoading(false);
        return;
      }

      if (src === 'giphy') {
        const endpoint = searchTerm.trim()
          ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(searchTerm)}&limit=24&rating=pg-13`
          : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=24&rating=pg-13`;
        const r = await fetch(endpoint);
        const j = await r.json();
        setItems((j.data || []).map((g: any) => ({
          id: g.id,
          url: g.images?.original?.url || g.images?.downsized?.url,
          preview: g.images?.fixed_width_small?.url || g.images?.preview_gif?.url,
          title: g.title,
        })));
      } else {
        const endpoint = searchTerm.trim()
          ? `https://g.tenor.com/v1/search?key=${TENOR_KEY}&q=${encodeURIComponent(searchTerm)}&limit=24&contentfilter=medium`
          : `https://g.tenor.com/v1/trending?key=${TENOR_KEY}&limit=24&contentfilter=medium`;
        const r = await fetch(endpoint);
        const j = await r.json();
        setItems((j.results || []).map((g: any) => ({
          id: g.id,
          url: g.media?.[0]?.gif?.url || g.media?.[0]?.mediumgif?.url,
          preview: g.media?.[0]?.tinygif?.url || g.media?.[0]?.nanogif?.url,
          title: g.title,
        })).filter((x: any) => x.url));
      }
    } catch {
      setItems([]);
    }
    setLoading(false);
  };

  // Busca inicial
  useEffect(() => {
    fetchGifs(q, category);
  }, [q, src, category]);

  // Debounce da busca
  useEffect(() => {
    const id = setTimeout(() => {
      if (q || category !== 'trending') {
        fetchGifs(q, category);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [q, src, category]);

  // GAP-GP03: Upload de GIF
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.includes('gif')) {
      toast.error('Por favor, selecione um arquivo GIF');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('O arquivo deve ter menos de 10MB');
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const url = reader.result as string;
        const newGif: GifItem = {
          id: `upload_${Date.now()}`,
          url,
          preview: url,
          title: file.name,
        };
        // Adiciona aos itens e favoritos automaticamente
        setItems([newGif, ...items]);
        saveFavorites([newGif, ...favorites]);
        toast.success('GIF enviado com sucesso!');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error('Erro ao enviar GIF');
      setUploading(false);
    }
    e.target.value = '';
  };

  const confirm = () => {
    if (!picked) return;
    onSelect(picked.url);
  };

  const displayItems = category === 'favorites' ? favorites : items;

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-end" onClick={onClose}>
      <div className="w-full bg-card rounded-t-2xl p-3 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              autoFocus 
              value={q} 
              onChange={e => setQ(e.target.value)} 
              placeholder="Buscar GIFs..."
              className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" 
            />
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-secondary hover:bg-secondary/70 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* GAP-GP01: Categorias */}
        <div className="flex gap-1 overflow-x-auto py-1.5 mb-2 scrollbar-thin">
          {Object.entries(categoryMap).map(([key, { label, icon: Icon }]) => (
            <button
              key={key}
              onClick={() => setCategory(key as Category)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                category === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 p-1 bg-secondary/40 rounded-lg mb-2">
          {(['giphy', 'tenor'] as Source[]).map(s => (
            <button key={s} onClick={() => setSrc(s)}
              className={cn(
                "flex-1 py-1 rounded-md text-[11px] font-semibold transition-colors",
                src === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}>
              {s === 'giphy' ? 'GIPHY' : 'Tenor'}
            </button>
          ))}
        </div>

        {picked ? (
          <div className="flex-1 overflow-y-auto flex flex-col items-center gap-3 py-3">
            <p className="text-xs text-muted-foreground">Pré-visualização</p>
            <img src={picked.url} alt="" className="max-h-72 rounded-xl object-contain bg-muted" loading="lazy" />
            <div className="flex gap-2 w-full max-w-xs">
              <button onClick={() => setPicked(null)} className="flex-1 py-2.5 rounded-lg bg-secondary text-sm font-semibold hover:bg-secondary/70 transition-colors">
                Escolher outro
              </button>
              <button onClick={confirm} className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
                Enviar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto relative">
            {/* GAP-GP03: Upload button */}
            <div className="sticky top-0 z-10 bg-card pb-2 flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs font-medium hover:bg-secondary/70 transition-colors"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {uploading ? 'Enviando...' : 'Enviar GIF'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/gif"
                onChange={handleUpload}
                className="hidden"
              />
            </div>

            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : displayItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Search className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">Nenhum GIF encontrado</p>
                <p className="text-xs">Tente buscar por outro termo</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {displayItems.map(g => {
                  const isFavorite = favorites.some(f => f.id === g.id);
                  return (
                    <button 
                      key={g.id} 
                      onClick={() => setPicked({ url: g.url, preview: g.preview })}
                      className="aspect-square overflow-hidden rounded-md bg-muted hover:ring-2 hover:ring-primary transition-all group relative"
                    >
                      <img src={g.preview} alt={g.title || ''} className="w-full h-full object-cover" loading="lazy" />
                      {/* GAP-GP02: Botão de favorito */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(g);
                        }}
                        className="absolute top-1 right-1 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                      >
                        <Star className={cn("h-3.5 w-3.5", isFavorite ? "fill-yellow-400 text-yellow-400" : "text-white")} />
                      </button>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-[10px] text-center text-muted-foreground py-2">
              {src === 'giphy' ? 'Powered by GIPHY' : 'Powered by Tenor (compatível com Instagram)'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}