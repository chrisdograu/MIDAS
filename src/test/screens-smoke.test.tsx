import { Suspense, type ComponentType } from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Banco simulado: qualquer consulta devolve lista vazia, sem erro.
vi.mock('@/integrations/supabase/client', () => {
  const result = { data: [], error: null, count: 0 };
  const chain: any = new Proxy(function () {}, {
    get: (_t, prop) => {
      if (prop === 'then') return (res: any) => Promise.resolve(result).then(res);
      if (prop === 'single' || prop === 'maybeSingle') return () => Promise.resolve({ data: null, error: null });
      return () => chain;
    },
    apply: () => chain,
  });
  const channel: any = { on: () => channel, subscribe: () => channel, send: () => Promise.resolve(), track: () => Promise.resolve(), presenceState: () => ({}) };
  return { supabase: {
    from: () => chain, rpc: () => chain,
    channel: () => channel, removeChannel: vi.fn(),
    storage: { from: () => ({ upload: async () => ({ data: null, error: null }), remove: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
    functions: { invoke: async () => ({ data: null, error: null }) },
    auth: { getSession: async () => ({ data: { session: null } }), getUser: async () => ({ data: { user: { id: 'u1' } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}) },
  } };
});
const user = { id: 'u1', email: 'teste@exemplo.com' };
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user, session: { user }, loading: false, isAdmin: true, profile: null, signOut: vi.fn() }), AuthProvider: ({ children }: any) => children }));
vi.mock('@/hooks/useDesktopAuth', () => ({ useDesktopAuth: () => ({ user, session: { user }, loading: false, isAdmin: true, role: 'admin', position: 'admin', hasPosition: () => true, signOut: vi.fn() }), DesktopAuthProvider: ({ children }: any) => children }));

afterEach(cleanup);

const screens: Record<string, Record<string, () => Promise<{ default: ComponentType<any> }>>> = {
  'Web (compra)': {
    Carrinho: () => import('@/pages/Carrinho'),
    Checkout: () => import('@/pages/Checkout'),
    Pedidos: () => import('@/pages/Pedidos'),
    BundleDetail: () => import('@/pages/BundleDetail'),
    CheckoutSucesso: () => import('@/pages/CheckoutSucesso'),
  },
  'Mobile (social)': {
    MMarketplace: () => import('@/mobile/pages/MMarketplace'),
    MNewAd: () => import('@/mobile/pages/MNewAd'),
    MTrocas: () => import('@/mobile/pages/MTrocas'),
    MGroups: () => import('@/mobile/pages/MGroups'),
    MGroupNew: () => import('@/mobile/pages/MGroupNew'),
    MForum: () => import('@/mobile/pages/MForum'),
  },
  'Desktop (gestão)': {
    PedidosOnline: () => import('@/desktop/pages/PedidosOnline'),
    Cupons: () => import('@/desktop/pages/Cupons'),
    Produtos: () => import('@/desktop/pages/Produtos'),
    Estoque: () => import('@/desktop/pages/Estoque'),
    Denuncias: () => import('@/desktop/pages/Denuncias'),
  },
};

for (const [platform, pages] of Object.entries(screens)) {
  describe(`Telas ${platform} abrem sem quebrar`, () => {
    for (const [name, load] of Object.entries(pages)) {
      it(name, async () => {
        const errors: unknown[] = [];
        const spy = vi.spyOn(console, 'error').mockImplementation((...a) => { errors.push(a); });
        const { default: Page } = await load();
        const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const { container } = render(
          <QueryClientProvider client={qc}><MemoryRouter><Suspense fallback={null}><Page /></Suspense></MemoryRouter></QueryClientProvider>,
        );
        await waitFor(() => expect(container.textContent?.length).toBeGreaterThan(0));
        await new Promise((r) => setTimeout(r, 50));
        spy.mockRestore();
        const crashes = errors.filter((e) => /The above error occurred|Uncaught|is not a function|Cannot read prop/.test(String((e as any[])[0])));
        expect(crashes).toEqual([]);
      }, 15000);
    }
  });
}
