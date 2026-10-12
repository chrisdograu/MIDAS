import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CosmeticPreview } from '@/components/cosmetics/CosmeticPreview';
import type { GameReward } from '@/hooks/useCosmetics';

const kinds = ['avatar_frame', 'profile_banner', 'profile_accent', 'game_card_skin', 'game_page_theme', 'character_icon', 'sticker'] as const;

describe('CosmeticPreview', () => {
  it.each(kinds)('mantém o brilho de %s preso à miniatura e sem bloquear toques', (kind) => {
    const reward = { id: 'r', kind, rarity: 'epic', name: 'Teste', payload: {}, asset_url: null } as unknown as GameReward;
    const { container } = render(<CosmeticPreview reward={reward} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('relative');
    expect(root.className).toContain('overflow-hidden');
    root.querySelectorAll('.absolute').forEach((el) => {
      expect(el.className).toContain('pointer-events-none');
    });
  });
});
