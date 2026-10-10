import { supabase } from '@/integrations/supabase/client';
import { escapeIlikeTerm } from '@/lib/escapeIlike';

export interface DeveloperSearchRow {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
}

export function developerSearchLink(developer: DeveloperSearchRow, desktop = false) {
  return desktop
    ? `/desktop/desenvolvedores?q=${encodeURIComponent(developer.name)}`
    : `/desenvolvedor/${encodeURIComponent(developer.slug || developer.id)}`;
}

export async function searchDevelopers(term: string, offset = 0, limit = 8): Promise<DeveloperSearchRow[]> {
  if (term.trim().length < 2) return [];
  const { data, error } = await supabase.from('developers')
    .select('id,name,slug,logo_url')
    .ilike('name', `%${escapeIlikeTerm(term.trim())}%`)
    .order('name').order('id')
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data || [];
}