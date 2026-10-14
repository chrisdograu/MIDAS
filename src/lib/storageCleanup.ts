import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'product-images';
const MARKER = `/storage/v1/object/public/${BUCKET}/`;

/** Caminho no bucket de uma URL pública enviada por nós; links externos retornam null. */
export function storedImagePath(url: string | null | undefined): string | null {
  if (!url) return null;
  const index = url.indexOf(MARKER);
  if (index === -1) return null;
  const path = decodeURIComponent(url.slice(index + MARKER.length).split('?')[0]);
  return path && !path.includes('..') ? path : null;
}

/** Imagens que existiam antes e não estão mais em uso. */
export function unusedImages(before: Array<string | null | undefined>, after: Array<string | null | undefined>): string[] {
  const kept = new Set(after.filter(Boolean));
  return before.filter((url): url is string => !!url && !kept.has(url));
}

/** Remove do armazenamento apenas arquivos do nosso bucket. Falhas não interrompem a tela. */
export async function removeStoredImages(urls: Array<string | null | undefined>): Promise<boolean> {
  const paths = Array.from(new Set(urls.map(storedImagePath).filter((p): p is string => !!p)));
  if (!paths.length) return true;
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) {
    console.warn('Não foi possível remover imagens antigas', error.message);
    return false;
  }
  return true;
}
