// Renderiza um preview visual de uma recompensa cosmética.
// Usa asset_url quando existir; senão renderiza um placeholder CSS/SVG
// baseado no `kind`, `payload.color` e `payload.emoji`.
import { useState } from 'react';
import { GameReward, RARITY_COLOR, KIND_EMOJI } from '@/hooks/useCosmetics';
import { cn } from '@/lib/utils';

interface CosmeticPreviewProps {
  reward: GameReward;
  size?: number;
  /** Mostra animação de brilho/shimmer */
  animated?: boolean;
  className?: string;
}

export function CosmeticPreview({ 
  reward, 
  size = 64, 
  animated = true,
  className,
}: CosmeticPreviewProps) {
  const color = reward.payload?.color || '#14B8A6';
  const emoji = reward.payload?.emoji || KIND_EMOJI[reward.kind];
  const rarityRing = RARITY_COLOR[reward.rarity].split(' ')[0];
  const [hasError, setHasError] = useState(false);
  // GAP-M038: imagem quebrada cai no placeholder visual abaixo.
  // Overlays decorativos são sempre pointer-events-none e presos ao preview
  // (relative + overflow-hidden), para nunca cobrirem a tela e bloquearem toques.

  // GAP-M037: Animação de brilho
  const shimmerClass = animated ? 'animate-pulse' : '';

  if (reward.asset_url && !hasError) {
    return (
      <div
        className={cn(
          `rounded-xl overflow-hidden border-2 ${rarityRing} bg-card relative`,
          shimmerClass,
          className
        )}
        style={{ width: size, height: size }}
      >
        <img 
          src={reward.asset_url} 
          alt={reward.name} 
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setHasError(true)}
        />
        {/* GAP-M037: Overlay de brilho */}
        {animated && (
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-primary/5 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
        )}
      </div>
    );
  }

  // GAP-M038: Fallback visual
  if (reward.kind === 'profile_banner' || reward.kind === 'game_page_theme') {
    return (
      <div
        className={cn(
          `rounded-xl border-2 ${rarityRing} relative overflow-hidden`,
          shimmerClass,
          className
        )}
        style={{ width: size * 2, height: size, background: `linear-gradient(135deg, ${color}, ${color}40)` }}
      >
        <div className="absolute inset-0 opacity-50 mix-blend-overlay"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(255,255,255,.4), transparent 40%)' }} />
        <span className="absolute bottom-1 right-2 text-lg">{emoji}</span>
        {/* GAP-M037: Brilho animado */}
        {animated && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
        )}
      </div>
    );
  }

  if (reward.kind === 'profile_accent') {
    return (
      <div className={cn(
        `rounded-full border-2 ${rarityRing} flex items-center justify-center`,
        shimmerClass,
        className
      )} style={{ width: size, height: size, background: color }}>
        <span className="text-2xl">{emoji}</span>
        {animated && (
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        )}
      </div>
    );
  }

  // avatar_frame, character_icon, sticker, game_card_skin (default)
  return (
    <div
      className={cn(
        `rounded-xl border-2 ${rarityRing} flex items-center justify-center bg-card relative`,
        shimmerClass,
        className
      )}
      style={{ width: size, height: size, boxShadow: `0 0 20px ${color}55 inset` }}
    >
      <span className="text-3xl">{emoji}</span>
      {animated && (
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
      )}
    </div>
  );
}