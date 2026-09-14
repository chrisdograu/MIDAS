import { useEffect, useState, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Share2, Download, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface LightboxItem {
  url: string;
  caption?: string;
  author?: string;
  /** GAP-ML01: Tipo de mídia */
  type?: 'image' | 'video';
  /** GAP-ML04: ID para compartilhamento */
  shareId?: string;
}

interface Props {
  items: LightboxItem[];
  startIndex: number;
  onClose: () => void;
  /** GAP-ML04: Callback de compartilhamento */
  onShare?: (item: LightboxItem) => void;
}

export default function MediaLightbox({ items, startIndex, onClose, onShare }: Props) {
  const [idx, setIdx] = useState(startIndex);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  // GAP-ML05: Zoom
  const [zoom, setZoom] = useState(1);
  const [isZoomed, setIsZoomed] = useState(false);
  // GAP-ML03: Toque
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // GAP-ML02: Progresso de carregamento
  useEffect(() => {
    setLoading(true);
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, 100);
    return () => clearInterval(interval);
  }, [idx]);

  const handleImageLoad = () => {
    setLoading(false);
    setProgress(100);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIdx(i => Math.min(i + 1, items.length - 1));
      if (e.key === 'ArrowLeft') setIdx(i => Math.max(i - 1, 0));
      if (e.key === 'r' || e.key === 'R') handleShare();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items.length, onClose, idx]);

  // GAP-ML03: Touch events para swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const endX = e.changedTouches[0].clientX;
    const diffX = touchStart.x - endX;
    const diffY = touchStart.y - e.changedTouches[0].clientY;
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
      if (diffX > 0 && idx < items.length - 1) setIdx(idx + 1);
      else if (diffX < 0 && idx > 0) setIdx(idx - 1);
    }
    setTouchStart(null);
  };

  // GAP-ML05: Zoom com scroll
  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY < 0) {
      setZoom(prev => Math.min(prev + 0.1, 3));
      setIsZoomed(true);
    } else {
      setZoom(prev => Math.max(prev - 0.1, 0.5));
      if (zoom <= 0.6) setIsZoomed(false);
    }
  };

  // GAP-ML04: Compartilhar
  const handleShare = () => {
    const current = items[idx];
    if (onShare) {
      onShare(current);
      return;
    }
    const text = current.caption
      ? `${current.caption}${current.author ? ` — ${current.author}` : ''}`
      : '📸 Confira esta mídia no MIDIAS!';
    if (navigator.share) {
      navigator.share({ title: 'MIDIAS', text, url: current.url });
    } else {
      navigator.clipboard.writeText(`${text}\n${current.url}`);
      toast.success('Link copiado!');
    }
  };

  // GAP-ML01: Download
  const handleDownload = async () => {
    const current = items[idx];
    try {
      const response = await fetch(current.url);
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `midias-${Date.now()}.jpg`;
      a.click();
      toast.success('Download iniciado');
    } catch {
      toast.error('Erro ao baixar');
    }
  };

  if (!items.length) return null;
  const current = items[idx];
  const isVideo = current.type === 'video' || current.url.match(/\.(mp4|webm|mov)$/i) || current.url.includes('youtube.com') || current.url.includes('vimeo.com');

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center select-none"
        onClick={onClose}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
            <span className="text-sm text-white/70">
              {idx + 1} / {items.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* GAP-ML04: Compartilhar */}
            <button
              onClick={handleShare}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
              title="Compartilhar"
            >
              <Share2 className="h-4 w-4" />
            </button>
            {/* GAP-ML01: Download */}
            <button
              onClick={handleDownload}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
              title="Baixar"
            >
              <Download className="h-4 w-4" />
            </button>
            {/* GAP-ML05: Zoom toggle */}
            <button
              onClick={() => { setIsZoomed(!isZoomed); setZoom(isZoomed ? 1 : 2); }}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
              title={isZoomed ? 'Reduzir' : 'Ampliar'}
            >
              {isZoomed ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* GAP-ML02: Barra de progresso */}
        {loading && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 w-64 h-1 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Navegação */}
        {idx > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setIdx(idx - 1); }}
            className="absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition z-10"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {idx < items.length - 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); setIdx(idx + 1); }}
            className="absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition z-10"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        {/* Conteúdo */}
        <motion.div
          key={idx}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-[92vw] max-h-[92vh] flex flex-col items-center gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          {loading && (
            <div className="flex items-center justify-center w-32 h-32">
              <Loader2 className="h-8 w-8 text-white/40 animate-spin" />
            </div>
          )}

          {isVideo ? (
            // GAP-ML01: Suporte a vídeos
            <video
              src={current.url}
              controls
              autoPlay
              className="max-w-full max-h-[80vh] rounded-lg"
              poster={current.url.replace(/\.(mp4|webm|mov)$/i, '.jpg')}
            />
          ) : (
            <img
              ref={imgRef}
              src={current.url}
              alt={current.caption || ''}
              className={cn(
                "max-w-full max-h-[80vh] rounded-lg object-contain transition-transform duration-200",
                isZoomed ? "cursor-zoom-out" : "cursor-zoom-in"
              )}
              style={{ transform: `scale(${zoom})` }}
              onLoad={handleImageLoad}
              onError={() => setLoading(false)}
              loading="lazy"
              onClick={() => { setIsZoomed(!isZoomed); setZoom(isZoomed ? 1 : 2); }}
            />
          )}

          {/* Legendas */}
          {(current.author || current.caption) && (
            <div className="text-center text-sm text-white/90 bg-black/50 backdrop-blur px-4 py-2 rounded-lg">
              {current.author && <span className="font-semibold">{current.author}</span>}
              {current.caption && <span className="text-white/70"> · {current.caption}</span>}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}