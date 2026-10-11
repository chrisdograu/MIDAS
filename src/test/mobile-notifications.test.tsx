import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MNotificacoes from '@/mobile/pages/MNotificacoes';
import { CosmeticUnlocksCenter } from '@/components/cosmetics/CosmeticUnlocksCenter';

const mocks = vi.hoisted(() => ({ update: vi.fn(), fail: false, user: { id: 'user-1' } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: (table: string) => {
    const result = () => ({ error: mocks.fail ? { message: 'offline' } : null, data: table === 'notifications' ? [{ id: 'n1', type: 'novo_seguidor', title: 'Novo seguidor', body: null, link: null, is_read: false, created_at: new Date().toISOString() }] : [{ unlocked_at: new Date().toISOString(), reward: null }, { unlocked_at: new Date().toISOString(), reward: { id: 'r1', kind: 'game_card_skin', name: 'Visual de Colecionador', rarity: 'common', payload: {}, asset_url: null } }] });
    const query: any = { select: () => query, eq: () => query, order: () => query, limit: () => query, then: (resolve: any) => Promise.resolve(result()).then(resolve), update: (payload: any) => { mocks.update(payload); return query; } };
    return query;
  },
  channel: () => { const channel: any = { on: () => channel, subscribe: () => channel }; return channel; },
  removeChannel: vi.fn(),
} }));
afterEach(() => { cleanup(); mocks.fail = false; mocks.update.mockClear(); });

describe('Notificações e cosméticos móveis', () => {
  it('mantém não lidas até ação explícita e atualiza apenas is_read', async () => {
    render(<MemoryRouter><MNotificacoes /></MemoryRouter>);
    await screen.findByText('Novo seguidor');
    expect(mocks.update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Marcar lidas' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ is_read: true }));
    await waitFor(() => expect(screen.queryByText('1 não lidas')).not.toBeInTheDocument());
  });
  it('mostra falha de carregamento sem fingir uma lista vazia', async () => {
    mocks.fail = true;
    render(<MemoryRouter><MNotificacoes /></MemoryRouter>);
    await screen.findByText('Não foi possível carregar');
    expect(screen.queryByText('Nenhuma notificação ainda')).not.toBeInTheDocument();
  });
  it('abre cosméticos, ignora vínculos indisponíveis e inclui visuais de cards', async () => {
    render(<MemoryRouter><CosmeticUnlocksCenter customizationHref="/m/perfil?tab=customizacao" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Central de cosméticos desbloqueados' }));
    await screen.findByText('Visual de Colecionador');
    fireEvent.click(screen.getByRole('button', { name: 'Skin de card' }));
    expect(screen.getByText('Visual de Colecionador')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ir para customização/ })).toHaveAttribute('href', '/m/perfil?tab=customizacao');
  });
});