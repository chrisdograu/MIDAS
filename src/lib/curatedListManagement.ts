import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type CuratedList = Tables<'curated_lists'>;
export type CuratedListForm = Pick<TablesInsert<'curated_lists'>, 'title' | 'slug' | 'description' | 'long_description' | 'category' | 'is_official' | 'is_featured' | 'is_public' | 'cover_image' | 'banner_image'>;

export function generateListSlug(title: string) {
  return title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function currentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error('Entre na sua conta para continuar.');
  return user;
}

export async function saveAdminCuratedList(form: CuratedListForm, id?: string) {
  const user = await currentUser();
  const title = form.title.trim();
  const slug = generateListSlug(form.slug || title);
  if (!title || !slug) throw new Error('Informe um título e um endereço válido para a lista.');
  const payload = { ...form, title, slug, updated_at: new Date().toISOString() };
  const query = id
    ? supabase.from('curated_lists').update(payload).eq('id', id)
    : supabase.from('curated_lists').insert({ ...payload, created_by: user.id });
  const { data, error } = await query.select('*').single();
  if (error) throw error;
  if (!data) throw new Error('A lista não foi salva. Verifique sua permissão.');
  return data;
}

export async function approveCuratedList(id: string) {
  const user = await currentUser();
  const now = new Date().toISOString();
  const { data, error } = await supabase.from('curated_lists')
    .update({ approved_at: now, approved_by: user.id, updated_at: now }).eq('id', id).select('id').single();
  if (error) throw error;
  if (!data) throw new Error('A lista não foi aprovada. Verifique sua permissão.');
  return data.id;
}

export async function deleteCuratedList(id: string) {
  const { data, error } = await supabase.from('curated_lists').delete().eq('id', id).select('id').single();
  if (error) throw error;
  if (!data) throw new Error('A lista não foi excluída. Verifique sua permissão.');
}

export async function createCommunityCuratedList(title: string, description: string, productIds: string[]) {
  await currentUser();
  const { data, error } = await supabase.rpc('create_community_curated_list', {
    _title: title.trim(), _description: description.trim(), _product_ids: [...new Set(productIds)],
  });
  if (error) throw error;
  if (!data) throw new Error('Não foi possível criar a lista.');
  return data;
}