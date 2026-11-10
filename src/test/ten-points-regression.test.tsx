import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ListaDetalhe from '@/pages/ListaDetalhe';
import ReviewCompletaCard from '@/components/social/ReviewCompletaCard';
import OrderDetailModal from '@/components/OrderDetailModal';
import { claimPriceAlerts } from '@/lib/priceAlerts';
import { requestMyDataDeletion } from '@/lib/dataDeletion';
import { loadPrivacyHistory } from '@/lib/privacyAudit';
import { requestOrderRefund } from '@/lib/orderSupport';

const state = vi.hoisted(() => ({
  user: { id: 'user' },
  saved: true, following: true, fail: false,
  root: { id: 'root', user_id: 'user', review_id: null, review_completa_id: 'full-review', parent_id: null, content: 'Comentário raiz', created_at: '2026-11-10T12:00:00Z', profile: { display_name: 'Pessoa' } },
  replies: [] as any[], alerts: [{ product_id: 'game', current_price: 0, target_price: 20 }],
  writes: vi.fn(), reads: vi.fn(), rpc: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('@/components/GameCard', () => ({ default: () => null }));
vi.mock('@/components/spoiler/SpoilerGuard', () => ({ default: ({ children }: any) => children }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: 'user' } }, error: null }) },
  rpc: async (name: string) => {
    state.rpc(name);
    if (state.fail) return { data: null, error: new Error('Falha') };
    if (name === 'claim_price_alerts') { const alerts = state.alerts; state.alerts = []; return { data: alerts, error: null }; }
    return { data: { id: 'request', status: 'solicitado', scheduled_for: '2026-12-10T12:00:00Z' }, error: null };
  },
  from: (table: string) => {
    let payload: any; let deleting = false; const filters: Record<string, any> = {};
    const result = () => {
      state.reads(table, filters);
      if (state.fail) return { data: null, error: new Error('Falha') };
      if (payload) {
        state.writes(table, payload);
        if (table === 'review_comments') state.replies.push({ ...payload, id: 'reply', created_at: '2026-11-10T13:00:00Z' });
      }
      if (table === 'saved_lists') { if (deleting) state.saved = false; if (payload) state.saved = true; return { data: state.saved ? { id: 'saved' } : null, error: null }; }
      if (table === 'curated_list_follows') { if (deleting) state.following = false; if (payload) state.following = true; return { data: state.following ? { id: 'follow' } : null, error: null }; }
      if (table === 'curated_lists') return { data: { id: 'list', title: 'Lista', is_public: true, created_at: '2026-11-10T12:00:00Z', creator: {}, items: [] }, error: null };
      if (table === 'pedidos') return { data: { id: 'order', status: 'confirmed' }, error: null };
      if (table === 'tickets') return { data: { id: 'ticket' }, error: null };
      if (table === 'pedido_status_history') return { data: [{ status: 'confirmed', note: 'Registro real', created_at: '2026-11-10T12:00:00Z' }], error: null };
      if (table === 'audit_log') return { data: [{ id: 'audit', created_at: '2026-11-10T12:00:00Z', metadata: { field: 'library_visibility', old_value: 'friends', new_value: 'nobody' } }], error: null };
      if (table === 'review_comments') return { data: filters.parent_id === 'root' ? state.replies : filters.parent_id ? [] : [state.root], error: null };
      return { data: [], error: null };
    };
    const query: any = {
      select: () => query, order: () => query, limit: () => query,
      eq: (key: string, value: any) => { filters[key] = value; return query; },
      is: (key: string, value: any) => { filters[key] = value; return query; },
      insert: (value: any) => { payload = value; return query; },
      delete: () => { deleting = true; return query; },
      single: async () => result(), maybeSingle: async () => result(), then: (resolve: any) => Promise.resolve(result()).then(resolve),
    };
    return query;
  },
} }));

beforeEach(() => { state.saved = true; state.following = true; state.fail = false; state.replies = []; state.alerts = [{ product_id: 'game', current_price: 0, target_price: 20 }]; state.writes.mockClear(); state.reads.mockClear(); state.rpc.mockClear(); });
afterEach(cleanup);

describe('persistent list preferences', () => {
  const open = () => render(<MemoryRouter initialEntries={['/lista/list']}><Routes><Route path="/lista/:id" element={<ListaDetalhe />} /></Routes></MemoryRouter>);
  it('restores saved and followed states after reopening', async () => {
    open();
    await screen.findByRole('button', { name: 'Salva' });
    expect(screen.getByRole('button', { name: 'Seguindo' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    await screen.findByRole('button', { name: 'Salvar' });
    cleanup(); open();
    await screen.findByRole('button', { name: 'Salvar' });
    expect(state.saved).toBe(false);
  });
});

describe('complete-review reply targets', () => {
  const review: any = { id: 'full-review', user_id: 'user', product_id: 'game', analise: 'Análise', visibility: 'friends', created_at: '2026-11-10T12:00:00Z' };
  it('writes replies to the complete review and reloads the nested reply', async () => {
    render(<MemoryRouter><ReviewCompletaCard review={review} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /comentários/ }));
    await screen.findByText('Comentário raiz');
    fireEvent.click(screen.getByRole('button', { name: 'Responder' }));
    fireEvent.change(screen.getByPlaceholderText('Escreva uma resposta...'), { target: { value: 'Resposta persistida' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar resposta' }));
    await screen.findByText('Resposta persistida');
    expect(state.writes).toHaveBeenCalledWith('review_comments', { review_completa_id: 'full-review', user_id: 'user', content: 'Resposta persistida', parent_id: 'root' });
  });
});

describe('price alerts', () => {
  it('claims an alert once and includes a zero-priced product', async () => {
    expect(await claimPriceAlerts()).toEqual([{ product_id: 'game', current_price: 0, target_price: 20 }]);
    expect(await claimPriceAlerts()).toEqual([]);
    expect(state.rpc).toHaveBeenCalledWith('claim_price_alerts');
  });
  it('does not report a successful claim when the database refuses it', async () => {
    state.fail = true;
    await expect(claimPriceAlerts()).rejects.toThrow('Falha');
  });
});

describe('order history and safe refund request', () => {
  it('reads recorded transitions instead of synthesizing delivery events', async () => {
    render(<OrderDetailModal pedido={{ id: 'order', status: 'confirmed', total: 10, created_at: '2026-11-10T12:00:00Z' }} onClose={() => {}} />);
    await screen.findByText('Registro real');
    expect(state.reads).toHaveBeenCalledWith('pedido_status_history', { order_id: 'order' });
  });
  it('creates an attendance ticket without writing order status', async () => {
    expect(await requestOrderRefund('order', 'Motivo do pedido')).toBe('ticket');
    expect(state.writes).toHaveBeenCalledWith('tickets', expect.objectContaining({ user_id: 'user', channel: 'web', body: 'Motivo do pedido' }));
    expect(state.writes.mock.calls.some(([table]) => table === 'pedidos')).toBe(false);
  });
});

describe('privacy and deletion', () => {
  it('reads immutable privacy history from the generic audit log', async () => {
    expect(await loadPrivacyHistory('user')).toEqual([{ id: 'audit', changed_at: '2026-11-10T12:00:00Z', field: 'library_visibility', old_value: 'friends', new_value: 'nobody' }]);
    expect(state.reads).toHaveBeenCalledWith('audit_log', { user_id: 'user', action: 'privacy_change' });
  });
  it('uses the authenticated deletion workflow and returns its server deadline', async () => {
    expect((await requestMyDataDeletion()).scheduled_for).toBe('2026-12-10T12:00:00Z');
    expect(state.rpc).toHaveBeenCalledWith('request_my_data_deletion');
    expect(state.writes).not.toHaveBeenCalled();
  });
});