import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Grava uma ação administrativa em `admin_logs`.
 * IMPORTANTE: nunca engolir o erro — histórico de auditoria vazio já causou
 * confusão antes (permissão faltando na tabela). Falha vira toast visível.
 */
export async function adminLog(opts: {
  action: string;
  entity: string;
  entity_id?: string | null;
  reason?: string | null;
  payload?: Record<string, any> | null;
}): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    toast.error('Sessão expirada: ação não registrada na auditoria');
    return false;
  }
  const { error } = await supabase.from('admin_logs').insert({
    admin_id: user.id,
    action: opts.action,
    entity: opts.entity,
    entity_id: opts.entity_id ?? null,
    reason: opts.reason ?? null,
    payload: (opts.payload ?? null) as any,
  } as any);
  if (error) {
    console.error('[adminLog] falha ao registrar auditoria', error);
    toast.error(`Ação executada, mas não registrada na auditoria: ${error.message}`);
    return false;
  }
  return true;
}

export function exportCsv(filename: string, rows: Record<string, any>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => {
      const v = r[h];
      if (v == null) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
