import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GamePageCosmeticOverlay } from '@/components/cosmetics/GamePageCosmeticOverlay';
import { ProfileCosmeticOverlay } from '@/components/cosmetics/ProfileCosmeticOverlay';

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });

vi.mock('@/hooks/useCosmetics', () => ({
  useUserLoadout: () => ({ loading: false, rows: [{ slot: 'profile_accent', reward: { payload: { color: '#3B82F6' } } }] }),
  useGamePageLoadout: () => ({ loading: false, rows: [{ slot: 'theme', reward: { payload: { color: '#3B82F6' } } }] }),
}));
afterEach(() => { cleanup(); localStorage.clear(); });
describe('Visibilidade dos cosméticos', () => {
  it('respeita preferências separadas ao mudar o perfil e força o padrão', async () => {
    localStorage.setItem('profile-cosmetic-a', 'false');
    const { rerender } = render(<ProfileCosmeticOverlay ownerId="a" />);
    expect(screen.getByRole('button', { name: 'Customização' })).toBeInTheDocument();
    rerender(<ProfileCosmeticOverlay ownerId="b" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Versão padrão' })).toBeInTheDocument());
    rerender(<ProfileCosmeticOverlay ownerId="b" forceDefault />);
    await waitFor(() => expect(screen.queryByRole('button')).not.toBeInTheDocument());
  });
  it('respeita a preferência de cada jogo sem controles de temas inexistentes', async () => {
    localStorage.setItem('cosmetic-overlay-a-u', 'false');
    const { rerender } = render(<GamePageCosmeticOverlay ownerId="u" productId="a" />);
    expect(screen.getByRole('button', { name: 'Customização' })).toBeInTheDocument();
    rerender(<GamePageCosmeticOverlay ownerId="u" productId="b" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Versão padrão' })).toBeInTheDocument());
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});