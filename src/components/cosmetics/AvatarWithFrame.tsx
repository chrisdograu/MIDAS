// Avatar com moldura cosmética opcional (avatar_frame equipado no loadout global).
import { useState } from 'react';
import { useUserLoadout } from '@/hooks/useCosmetics';
import { cn } from '@/lib/utils';

interface AvatarWithFrameProps {
  userId?: string | null;
  src?: string | null;
  fallback?: string;
  size?: number;
  /** Mostra indicador de online (apenas se userId for fornecido) */
  showOnline?: boolean;
  /** Animação de hover (zoom/glow) */
  animated?: boolean;
  className?: string;
}

export function AvatarWithFrame({ 
  userId, 
  src, 
  fallback, 
  size = 48,
  showOnline = false,
  animated = true,
  className,
}: AvatarWithFrameProps) {
  const { rows } = useUserLoadout(userId || null);
  const [isHovered, setIsHovered] = useState(false);
  
  const frame = rows.find(r => r.slot === 'avatar_frame')?.reward;
  const color = frame?.payload?.color || 'hsl(var(--primary))';
  
  // GAP-M031: Animação de hover
  const hoverScale = animated && isHovered ? 1.08 : 1;
  const hoverGlow = animated && isHovered ? `0 0 30px ${color}66` : `0 0 14px ${color}44`;

  // GAP-M030: Frame sem asset — usar CSS puro
  const hasAsset = frame?.asset_url;
  const frameSize = size + 6;

  return (
    <div 
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: frameSize, height: frameSize }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Moldura */}
      {frame && (
        <div
          className={cn(
            "absolute inset-0 rounded-full pointer-events-none transition-all duration-300",
            animated && "hover:scale-105"
          )}
          style={{
            boxShadow: hoverGlow,
            background: hasAsset 
              ? `center/cover url(${frame.asset_url})` 
              : `radial-gradient(circle at 30% 30%, ${color}88, ${color}22)`,
            border: `2px solid ${color}66`,
            transform: `scale(${hoverScale})`,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      )}

      {/* Avatar */}
      <div
        className="rounded-full overflow-hidden bg-secondary flex items-center justify-center text-xs font-bold transition-all duration-300 relative"
        style={{ 
          width: size - (frame ? 4 : 0), 
          height: size - (frame ? 4 : 0),
          transform: `scale(${hoverScale})`,
          boxShadow: frame ? 'inset 0 2px 8px rgba(0,0,0,0.3)' : undefined,
        }}
      >
        {src ? (
          <img 
            src={src} 
            alt="" 
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-muted-foreground font-bold text-lg">
            {fallback || '?'}
          </span>
        )}

        {/* GAP-M032: Indicador de online */}
        {showOnline && userId && (
          <span 
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background bg-success animate-pulse"
            title="Online agora"
          />
        )}
      </div>
    </div>
  );
}