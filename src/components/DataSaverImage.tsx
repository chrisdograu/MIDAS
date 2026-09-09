// Rodada 23 · item 7 — economia de dados de verdade.
// Usa a API de transformação de imagem do Supabase Storage (confirmada ativa
// neste projeto): serve um arquivo menor pelo servidor, não só redimensionado
// no HTML. Se a transformação falhar, cai de volta na URL original.
import { useMemo, useState, useEffect, useRef } from "react";
import { useDataSaver } from "@/hooks/useDataSaver";

const OBJECT_PUBLIC = "/storage/v1/object/public/";
const RENDER_PUBLIC = "/storage/v1/render/image/public/";

// GAP-DS04: Suporte a formatos de imagem
type ImageFormat = "webp" | "avif" | "jpeg" | "png";

export function dataSaverUrl(
  src: string, 
  width = 320, 
  quality = 60,
  format: ImageFormat = "webp"
) {
  if (!src || !src.includes(OBJECT_PUBLIC)) return src;
  const base = src.replace(OBJECT_PUBLIC, RENDER_PUBLIC);
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}width=${width}&quality=${quality}&resize=contain&format=${format}`;
}

interface Props extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src?: string | null;
  /** Largura servida quando a economia de dados está ligada. */
  saverWidth?: number;
  saverQuality?: number;
  /** GAP-DS04: Formato da imagem */
  format?: ImageFormat;
  /** GAP-DS01: Fallback quando imagem falha */
  fallback?: React.ReactNode;
  /** GAP-DS02: Habilitar lazy loading com IntersectionObserver */
  enableLazyLoad?: boolean;
  /** GAP-DS03: Mostrar blur placeholder */
  blurPlaceholder?: boolean;
  /** GAP-DS03: Cor do placeholder */
  placeholderColor?: string;
  /** GAP-DS01: Componente de placeholder customizado */
  placeholderComponent?: React.ReactNode;
}

export default function DataSaverImage({ 
  src, 
  saverWidth = 320, 
  saverQuality = 60,
  format = "webp",
  fallback,
  enableLazyLoad = true,
  blurPlaceholder = true,
  placeholderColor = "bg-muted",
  placeholderComponent,
  className,
  style,
  ...rest 
}: Props) {
  const dataSaver = useDataSaver();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(!enableLazyLoad);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // GAP-DS02: IntersectionObserver para lazy loading
  useEffect(() => {
    if (!enableLazyLoad || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [enableLazyLoad]);

  const finalSrc = useMemo(() => {
    if (!src) return undefined;
    if (!dataSaver || failed) return src;
    return dataSaverUrl(src, saverWidth, saverQuality, format);
  }, [src, dataSaver, failed, saverWidth, saverQuality, format]);

  if (!finalSrc) {
    return fallback ? <>{fallback}</> : null;
  }

  // GAP-DS03: Placeholder com blur
  const placeholderStyle = blurPlaceholder && !loaded ? {
    filter: "blur(10px)",
    transform: "scale(1.1)",
  } : {};

  // GAP-DS01: Fallback para erro
  if (failed && fallback) {
    return <>{fallback}</>;
  }

  // GAP-DS01: Fallback como componente
  if (failed && placeholderComponent) {
    return <>{placeholderComponent}</>;
  }

  const imageElement = (
    <img
      ref={imgRef}
      {...rest}
      src={inView ? finalSrc : undefined}
      data-src={inView ? undefined : finalSrc}
      loading={enableLazyLoad ? "lazy" : "eager"}
      decoding="async"
      className={cn(
        className,
        blurPlaceholder && !loaded && "transition-all duration-500",
        blurPlaceholder && loaded && "blur-0 scale-100"
      )}
      style={{
        ...style,
        ...placeholderStyle,
        ...(blurPlaceholder && !loaded ? { backgroundColor: placeholderColor } : {}),
      }}
      onLoad={(e) => {
        setLoaded(true);
        rest.onLoad?.(e);
      }}
      onError={(e) => {
        if (!failed && dataSaver) setFailed(true);
        rest.onError?.(e);
      }}
    />
  );

  // GAP-DS02: Container com observer
  if (enableLazyLoad) {
    return (
      <div ref={containerRef} className="relative w-full h-full">
        {!loaded && blurPlaceholder && (
          <div className={cn(
            "absolute inset-0 animate-pulse rounded-md",
            placeholderColor
          )} />
        )}
        {imageElement}
      </div>
    );
  }

  return imageElement;
}