import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminChaves from '@/desktop/pages/AdminChaves';
import AdminPublishers from '@/desktop/pages/AdminPublishers';
import MSalvos from '@/mobile/pages/MSalvos';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' },
  insert: vi.fn(),
  adminLog: vi.fn(),
  exportCsv: vi.fn(),
  failInsert: false,
  keys: [
    { id: 'key-1', key_code: 'STEAM-ABC-123', product_id: 'product-1', status: 'available', imported_at: '2026-11-09T12:00:00Z' },
    { id: 'key-2', key_code: 'XBOX-DEF-456', product_id: 'product-1', status: 'sold', imported_at: '2026-11-09T12:00:00Z' },
  ],
  publishers: Array.from({ length: 21 }, (_, id) => ({ id: String(id), name: `Studio ${id + 1}`, slug: `studio-${id + 1}`, created_at: '2026-11-09T12:00:00Z' })),
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/desktop/lib/adminLog', () => ({ adminLog: mocks.adminLog, exportCsv: mocks.exportCsv }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
  from: (table: string) => {
    let inserted: unknown;
    const rows = () => {
      if (table === 'product_keys') return mocks.keys;
      if (table === 'publishers') return mocks.publishers;
      if (table === 'produtos') return [{ id: 'product-1', title: 'Minecraft' }];
      if (table === 'saved_posts') return [{ id: 'saved-1', post_id: 'post-1' }];
      if (table === 'forum_posts') return [{ id: 'post-1', product_id: null, content: 'Discussão geral', user_id: 'user-1', created_at: '2026-11-09T12:00:00Z' }];
      if (table === 'profiles') return [{ id: 'user-1', display_name: 'Autor' }];
      return [];
    };
    const query: any = {
      select: () => query, eq: () => query, in: () => query, order: () => query,
      insert: (payload: unknown) => { inserted = payload; mocks.insert(table, payload); return query; },
      then: (resolve: any) => Promise.resolve({ data: inserted ? [{ id: 'imported-1' }] : rows(), error: inserted && mocks.failInsert ? { message: 'Importação recusada' } : null }).then(resolve),
    };
    return query;
  },
} }));

beforeEach(() => { mocks.insert.mockClear(); mocks.adminLog.mockClear(); mocks.exportCsv.mockClear(); mocks.failInsert = false; });
afterEach(cleanup);

describe('Key management regressions', () => {
  it('filters the displayed keys and exports only the matches', async () => {
    render(<AdminChaves />);
    await screen.findByText('STEAM-ABC-123');
    fireEvent.change(screen.getByPlaceholderText('Buscar chave...'), { target: { value: ' abc ' } });
    expect(screen.queryByText('XBOX-DEF-456')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    expect(mocks.exportCsv.mock.calls[0][1].map((row: any) => row.Codigo)).toEqual(['STEAM-ABC-123']);
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(screen.getByText('XBOX-DEF-456')).toBeInTheDocument();
  });

  it('opens the import dialog and keeps it open when product selection is missing', async () => {
    render(<AdminChaves />);
    fireEvent.click(await screen.findByRole('button', { name: 'Importar Chaves' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'ACTUAL-KEY' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Importar' }));
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('Publisher pagination regressions', () => {
  it('allows reaching records after the first page and resets the page on search', async () => {
    render(<AdminPublishers />);
    await screen.findByText('Studio 1');
    expect(screen.queryByText('Studio 21')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(screen.getByText('Studio 21')).toBeInTheDocument();
    expect(screen.queryByText('Studio 1')).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Buscar publicadora...'), { target: { value: 'Studio 1' } });
    expect(screen.getByText('Studio 1')).toBeInTheDocument();
    expect(screen.queryByText('Studio 21')).not.toBeInTheDocument();
  });
});

describe('Saved posts regressions', () => {
  it('opens a general saved discussion using its post ID, not a missing product ID', async () => {
    render(<MemoryRouter><MSalvos /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('link', { name: /Discussão geral/ })).toHaveAttribute('href', '/m/forum/post/post-1'));
  });
});