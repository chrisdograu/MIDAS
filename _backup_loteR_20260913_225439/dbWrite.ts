import { toast } from 'sonner';

/**
 * Envolve uma escrita no banco (insert/update/delete/upsert) garantindo que
 * falhas nunca passem em silêncio: mostra um aviso em PT-BR e devolve `false`.
 */
export async function dbWrite(
  query: PromiseLike<{ error: { message: string } | null }>,
  mensagem = 'Não foi possível salvar a alteração',
): Promise<boolean> {
  const { error } = await query;
  if (error) {
    toast.error(`${mensagem}: ${error.message}`);
    return false;
  }
  return true;
}
