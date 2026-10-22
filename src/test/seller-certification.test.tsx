import { cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';

const { queries } = vi.hoisted(() => ({ queries: [] as string[] }));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'seller-1' } }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from(table: string) {
      const result = table === 'seller_profiles'
        ? { data: null, error: null }
        : { data: [], error: null, count: 0 };
      const chain = {
        select(columns: string) {
          if (table === 'certificados') queries.push(columns);
          return chain;
        },
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: () => Promise.resolve(result),
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      };
      return chain;
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
  },
}));

import VendedorConfig from '@/pages/VendedorConfig';

afterEach(() => { cleanup(); queries.length = 0; });

it('loads seller certification history using only existing certificate columns', async () => {
  render(<MemoryRouter><VendedorConfig /></MemoryRouter>);
  await waitFor(() => expect(queries).toContain('status, created_at, reviewed_at'));
  const columns = queries.flatMap(query => query.split(',').map(column => column.trim()));
  expect(columns).not.toContain('review_notes');
  expect(columns.every(column => ['status', 'created_at', 'reviewed_at'].includes(column))).toBe(true);
});