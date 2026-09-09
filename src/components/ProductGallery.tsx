import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Play, Pause, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// GAP-PG03: Tipos de arrasto
type DragState = { isDragging: boolean; startX: number; offset: number };

interface Props {
  productId: string;
  mainImage: string;
  title: string;
  /** GAP-PG02: Autoplay em ms */
  autoplay?: number;
  /** GAP-PG01: Habilitar zoom */
  enableZoom?: boolean;
}

export default function ProductGallery({ 
  productId, 
  mainImage, 
  title,
  autoplay = 0,
  enableZoom = true,
}: Props) {
  const [images, setImages] = useState<string[]>([mainImage]);
  const [active, setActive] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(autoplay > 0);
  const [drag, setDrag] = useState<DragState>({ isDragging: false, startX: 0, offset: 0 });
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // GAP-PG02: Autoplay
  useEffect(() => {
    if (autoplay <= 0 || !isPlaying || images.length <= 1) return;
    
    timerRef.current = setInterval(() => {
      setActive((prev) => (prev + 1) % images.length);
    }, autoplay);
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoplay, isPlaying, images.length]);

  useEffect(() => {
    setActive(0);
    setImages([mainImage]);
    (async () => {
      const { data } = await supabase
        .from('produto_imagens' as any)
        .select('image_url, position')
        .eq('product_id', productId)
        .order('position', { ascending: true });
      const extra = ((data as any) || []).map((r: any) => r.image_url as string);
      const all = [mainImage, ...extra.filter((u: string) => u && u !== mainImage)];
      setImages(all);
    })();
  }, [productId, mainImage]);

  // GAP-PG03: Drag para navegação
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setDrag({ isDragging: true, startX: clientX, offset: 0 });
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drag.isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const offset = clientX - drag.startX;
    setDrag(prev => ({ ...prev, offset }));
  };

  const handleDragEnd = () => {
    if (!drag.isDragging) return;
    const threshold = 50;
    if (drag.offset > threshold && active > 0) {
      setActive(active - 1);
    } else if (drag.offset < -threshold && active < images.length - 1) {
      setActive(active + 1);
    }
    setDrag({ isDragging: false, startX: 0, offset: 0 });
  };

  // Navegação
  const goToPrevious = () => {
    if (active > 0) setActive(active - 1);
    else setActive(images.length - 1);
    if (isPlaying) setIsPlaying(false);
  };

  const goToNext = () => {
    if (active < images.length - 1) setActive(active + 1);
    else setActive(0);
    if (isPlaying) setIsPlaying(false);
  };

  // GAP-PG01: Lightbox
  const openLightbox = () => setIsLightboxOpen(true);
  const closeLightbox = () => setIsLightboxOpen(false);

  return (
    <div className="space-y-3">
      {/* Imagem principal com drag */}
      <div 
        className="relative rounded-xl overflow-hidden aspect-video bg-secondary/30 cursor-zoom-in group"
        onMouseDown={handleDragStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
        onClick={enableZoom ? openLightbox : undefined}
      >
        <motion.div
          animate={{ x: drag.offset }}
          transition={{ type: 'spring', damping: 30 }}
          className="w-full h-full"
        >
          <img 
            src={images[active]} 
            alt={title} 
            className="w-full h-full object-cover"
            loading="lazy" 
          />
        </motion.div>
        
        <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent pointer-events-none" />
        
        {/* GAP-PG01: Botão de zoom */}
        {enableZoom && images.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); openLightbox(); }}
            className="absolute bottom-3 right-3 p-2 bg-black/50 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}

        {/* GAP-PG02: Controles de autoplay */}
        {images.length > 1 && autoplay > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }}
            className="absolute bottom-3 left-3 p-2 bg-black/50 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
        )}

        {/* Navegação */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); goToNext(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Indicador */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setActive(i); }}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === active ? "w-6 bg-white" : "w-3 bg-white/50"
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
          {images.slice(0, 12).map((src, i) => (
            <button
              key={src + i}
              onClick={() => setActive(i)}
              className={cn(
                "relative aspect-video rounded-md overflow-hidden border-2 transition-all",
                i === active ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'
              )}
              aria-label={`Imagem ${i + 1}`}
            >
              <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {/* GAP-PG01: Lightbox */}
      <AnimatePresence>
        {isLightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
            onClick={closeLightbox}
          >
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
            
            <div className="relative max-w-5xl w-full max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              <img 
                src={images[active]} 
                alt={title} 
                className="w-full h-full object-contain max-h-[85vh]"
              />
              
              {images.length > 1 && (
                <>
                  <button
                    onClick={goToPrevious}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    onClick={goToNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActive(i)}
                        className={cn(
                          "h-2 rounded-full transition-all",
                          i === active ? "w-8 bg-white" : "w-2 bg-white/50"
                        )}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}