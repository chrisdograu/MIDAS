
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: 'product' | 'user' | 'order' | 'developer' | 'publisher';
  link: string;
  image?: string;
}

export function useGlobalSearch(query: string) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  const search = useCallback(async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const term = `%${searchTerm}%`;

    try {
      const [products, users, orders, developers, publishers] = await Promise.all([
        supabase.from('produtos').select('id, title, image_url').ilike('title', term).limit(5),
        supabase.from('profiles').select('id, display_name, avatar_url').ilike('display_name', term).limit(5),
        supabase.from('pedidos').select('id').ilike('id', `%${searchTerm}%`).limit(5),
        supabase.from('developers').select('id, name, logo_url').ilike('name', term).limit(5),
        supabase.from('publishers').select('id, name, logo_url').ilike('name', term).limit(5),
      ]);

      const resultsList: SearchResult[] = [];

      (products.data || []).forEach((p: any) => {
        resultsList.push({
          id: p.id,
          title: p.title,
          type: 'product',
          link: `/desktop/produtos`,
          image: p.image_url,
        });
      });

      (users.data || []).forEach((u: any) => {
        resultsList.push({
          id: u.id,
          title: u.display_name || u.id.slice(0, 8),
          type: 'user',
          link: `/desktop/clientes`,
          image: u.avatar_url,
        });
      });

      (orders.data || []).forEach((o: any) => {
        resultsList.push({
          id: o.id,
          title: `Pedido #${o.id.slice(0, 8)}`,
          type: 'order',
          link: `/desktop/pedidos`,
        });
      });

      (developers.data || []).forEach((d: any) => {
        resultsList.push({
          id: d.id,
          title: d.name,
          type: 'developer',
          link: `/desktop/desenvolvedores`,
          image: d.logo_url,
        });
      });

      (publishers.data || []).forEach((p: any) => {
        resultsList.push({
          id: p.id,
          title: p.name,
          type: 'publisher',
          link: `/desktop/publicadoras`,
          image: p.logo_url,
        });
      });

      setResults(resultsList);
    } catch (error) {
      console.error('Erro na busca global:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    search(debouncedQuery);
  }, [debouncedQuery, search]);

  return { results, loading };
}