import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { approveCuratedList, createCommunityCuratedList, deleteCuratedList, saveAdminCuratedList } from '@/lib/curatedListManagement';
import { isTicketClosed, loadMyTickets, sendTicketMessage } from '@/lib/ticketSupport';
import AdminCuratedLists from '@/desktop/pages/AdminCuratedLists';
import MeusTickets from '@/pages/MeusTickets';
import CriarLista from '@/pages/CriarLista';
import Contato from '@/pages/Contato';

const state = vi.hoisted(() => ({
  writes: vi.fn(), reads: vi.fn(), rpc: vi.fn(), success: vi.fn(), fail: false, noRows: false, position: 'admin',
  user: { id: 'owner' },
  lists: [{ id: 'list', title: 'Minha lista', slug: 'minha-lista', is_public: true, is_official: false, is_featured: false, created_by: 'owner', approved_at: null, created_at: '2026-11-11T02:00:00Z', creator: {}, items: [] }],
  tickets: [{ id: 'ticket', user_id: 'owner', subject: 'Pedido de reembolso', body: 'Quero acompanhar este atendimento.', status: 'aberto', channel: 'web', attachments: [], created_at: '2026-11-11T02:00:00Z' }],
  messages: [{ id: 'message', ticket_id: 'ticket', sender_id: 'staff', content: 'Estamos analisando seu pedido.', attachments: [], created_at: '2026-11-11T02:01:00Z' }],
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('@/hooks/useDesktopAuth', () => ({ useDesktopAuth: () => ({ position: state.position }) }));
vi.mock('@/hooks/useSiteSettings', () => ({ useSiteSettings: () => ({ value: { email: 'support@example.com' } }) }));
vi.mock('@/desktop/lib/adminLog', () => ({ adminLog: vi.fn(), exportCsv: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: state.success, error: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
  functions: { invoke: async () => ({ error: null }) },
  rpc: async (name: string, args: unknown) => { state.rpc(name, args); return { data: name === 'curated_list_follow_counts' ? [{ list_id: 'list', follow_count: 8 }] : 'new-list', error: state.fail ? new Error('denied') : null }; },
  from: (table: string) => {
    const filters: Record<string, unknown> = {};
    let payload: any = null; let operation = 'read'; let range: number[] = [];
    const result = (single = false) => {
      state.reads(table, { ...filters }, range);
      if (state.fail) return { data: null, error: new Error('denied'), count: 0 };
      if (operation !== 'read') {
        state.writes(table, operation, payload, { ...filters });
        if (state.noRows) return { data: null, error: null };
        if (table === 'ticket_messages') { const message = { ...payload, id: 'reply', created_at: '2026-11-11T02:02:00Z' }; state.messages.push(message); return { data: message, error: null }; }
        if (table === 'curated_lists') { const list = { ...state.lists[0], ...payload }; if (operation === 'insert') state.lists.push(list); else if (operation === 'update') state.lists[0] = list; return { data: list, error: null }; }
        return { data: { id: 'ticket' }, error: null };
      }
      const rows = table === 'curated_lists' ? state.lists : table === 'tickets' ? state.tickets : table === 'ticket_messages' ? state.messages : table === 'produtos' ? [{ id: 'game', title: 'Jogo existente', image_url: null }] : [];
      return { data: single ? rows[0] : rows, error: null, count: rows.length };
    };
    const query: any = {
      select: () => query, order: () => query, ilike: () => query, not: () => query,
      eq: (key: string, value: unknown) => { filters[key] = value; return query; },
      is: (key: string, value: unknown) => { filters[key] = value; return query; },
      range: (start: number, end: number) => { range = [start, end]; return query; },
      insert: (value: unknown) => { payload = value; operation = 'insert'; return query; },
      update: (value: unknown) => { payload = value; operation = 'update'; return query; },
      delete: () => { operation = 'delete'; return query; },
      single: async () => result(true), then: (resolve: any) => Promise.resolve(result()).then(resolve),
    };
    return query;
  },
} }));

function open(element: React.ReactNode, entry = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[entry]}>{element}</MemoryRouter></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks(); state.fail = false; state.noRows = false; state.position = 'admin';
  state.lists = [{ id: 'list', title: 'Minha lista', slug: 'minha-lista', is_public: true, is_official: false, is_featured: false, created_by: 'owner', approved_at: null, created_at: '2026-11-11T02:00:00Z', creator: {}, items: [] }];
  state.messages = [{ id: 'message', ticket_id: 'ticket', sender_id: 'staff', content: 'Estamos analisando seu pedido.', attachments: [], created_at: '2026-11-11T02:01:00Z' }];
});
afterEach(cleanup);

describe('curated list management', () => {
  it('saves a list under the authenticated creator without missing admin RPCs', async () => {
    const result = await saveAdminCuratedList({ title: ' Jogos clássicos ', slug: '', is_official: false });
    expect(result.slug).toBe('jogos-classicos');
    expect(state.writes).toHaveBeenCalledWith('curated_lists', 'insert', expect.objectContaining({ created_by: 'owner', title: 'Jogos clássicos', slug: 'jogos-classicos' }), {});
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it('approves the exact list with its authenticated reviewer', async () => {
    await approveCuratedList('list');
    expect(state.writes).toHaveBeenCalledWith('curated_lists', 'update', expect.objectContaining({ approved_by: 'owner', approved_at: expect.any(String) }), { id: 'list' });
  });
  it('rejects a silent zero-row edit instead of reporting success', async () => {
    state.noRows = true;
    await expect(saveAdminCuratedList({ title: 'Nova', slug: 'nova' }, 'list')).rejects.toThrow('não foi salva');
  });
  it('rejects a silent zero-row deletion instead of reporting success', async () => {
    state.noRows = true;
    await expect(deleteCuratedList('list')).rejects.toThrow('não foi excluída');
  });
  it('edits a list through the management screen and persists the updated title', async () => {
    open(<AdminCuratedLists />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Minha lista' }));
    fireEvent.change(screen.getByLabelText('Título *'), { target: { value: 'Lista atualizada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    await waitFor(() => expect(state.success).toHaveBeenCalledWith('Lista atualizada!'));
    expect(state.lists[0].title).toBe('Lista atualizada');
  });
  it('does not offer administrator writes to a non-administrator', async () => {
    state.position = 'moderador'; open(<AdminCuratedLists />);
    await screen.findByText('Minha lista');
    expect(screen.queryByRole('button', { name: 'Nova Lista' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar Minha lista' })).not.toBeInTheDocument();
  });
  it('creates the community list and its games in one transaction without privileged flags', async () => {
    await createCommunityCuratedList(' Comunidade ', ' Descrição ', ['game', 'game']);
    expect(state.rpc).toHaveBeenCalledWith('create_community_curated_list', { _title: 'Comunidade', _description: 'Descrição', _product_ids: ['game'] });
    expect(state.writes).not.toHaveBeenCalled();
  });
  it('selects a real catalog entry and navigates to the persisted list', async () => {
    open(<Routes><Route path="/lista/novo" element={<CriarLista />} /><Route path="/lista/:id" element={<p>Destino da lista</p>} /></Routes>, '/lista/novo');
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Meus jogos' } });
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Jogo existente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Criar lista' }));
    await screen.findByText('Destino da lista');
    expect(state.rpc).toHaveBeenCalledWith('create_community_curated_list', { _title: 'Meus jogos', _description: '', _product_ids: ['game'] });
  });
});

describe('support ticket history', () => {
  it('paginates only the requesting owner records', async () => {
    await loadMyTickets('owner', 1, 15, 'aguardando_usuario');
    expect(state.reads).toHaveBeenCalledWith('tickets', { user_id: 'owner', status: 'aguardando_usuario' }, [15, 29]);
  });
  it('writes a reply as the authenticated sender and never updates ticket status', async () => {
    await sendTicketMessage('ticket', ' Resposta ');
    expect(state.writes).toHaveBeenCalledWith('ticket_messages', 'insert', { ticket_id: 'ticket', sender_id: 'owner', content: 'Resposta', attachments: [] }, {});
    expect(state.writes.mock.calls.some(([table]) => table === 'tickets')).toBe(false);
  });
  it('recognizes the live closed and resolved states', () => {
    expect(isTicketClosed('fechado')).toBe(true);
    expect(isTicketClosed('resolvido')).toBe(true);
    expect(isTicketClosed('aguardando_usuario')).toBe(false);
  });
  it('reads the conversation, sends a reply, and reloads the saved message', async () => {
    open(<MeusTickets />, '/meus-tickets?ticket=ticket');
    await screen.findByText('Estamos analisando seu pedido.');
    fireEvent.change(screen.getByLabelText('Sua resposta'), { target: { value: 'Mensagem persistida' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar resposta' }));
    await screen.findByText('Mensagem persistida');
    expect(state.messages[1].sender_id).toBe('owner');
  });
  it('keeps the reply when saving fails and does not claim success', async () => {
    open(<MeusTickets />, '/meus-tickets?ticket=ticket');
    await screen.findByText('Estamos analisando seu pedido.');
    state.fail = true;
    fireEvent.change(screen.getByLabelText('Sua resposta'), { target: { value: 'Não perder este texto' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar resposta' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar resposta' })).toBeEnabled());
    expect(screen.getByLabelText('Sua resposta')).toHaveValue('Não perder este texto');
    expect(state.success).not.toHaveBeenCalled();
  });
  it('opens a contact ticket using existing columns and a non-null attachment array', async () => {
    open(<Contato />);
    fireEvent.change(screen.getByLabelText('Nome *'), { target: { value: 'Nome real' } });
    fireEvent.change(screen.getByLabelText('E-mail *'), { target: { value: 'person@example.com' } });
    fireEvent.change(screen.getByLabelText('Mensagem *'), { target: { value: 'Preciso acompanhar uma solicitação de suporte.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }));
    await waitFor(() => expect(state.writes).toHaveBeenCalledWith('ticket_messages', 'insert', expect.objectContaining({ attachments: [] }), {}));
    const ticketWrite = state.writes.mock.calls.find(([table]) => table === 'tickets');
    expect(ticketWrite?.[2]).not.toHaveProperty('priority');
  });
});