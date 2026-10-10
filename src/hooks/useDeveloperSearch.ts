import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { searchDevelopers } from '@/lib/developerSearch';

export function useDeveloperSearch(query: string, enabled = true) {
  const term = useDebounce(query.trim(), 250);
  return useQuery({
    queryKey: ['developer-search', term],
    queryFn: () => searchDevelopers(term),
    enabled: enabled && term.length >= 2 && !term.startsWith('@'),
    staleTime: 60_000,
  });
}