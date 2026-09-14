import { toast } from 'sonner';

/**
 * Envolve uma escrita no banco (insert/update/delete/upsert) garantindo que
 * falhas nunca passem em silêncio: mostra um aviso em PT-BR e devolve `false`.
 */
interface DbError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

export async function dbWrite(
  query: PromiseLike<{ error: DbError | null }>,
  mensagem = 'Não foi possível salvar a alteração',
): Promise<boolean> {
  const { error } = await query;
  if (error) {
    // Log técnico (dev) — mensagem amigável pro usuário
    console.warn('[dbWrite]', error.message);
    toast.error(mensagem);
    return false;
  }
  return true;
}
