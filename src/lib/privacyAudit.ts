import { supabase } from '@/integrations/supabase/client';

export interface PrivacyAuditEntry {
  id: string;
  changed_at: string;
  field: string;
  old_value: string;
  new_value: string;
}

export async function loadPrivacyHistory(userId: string, fields?: readonly string[]): Promise<PrivacyAuditEntry[]> {
  const { data, error } = await supabase.from('audit_log').select('id, metadata, created_at')
    .eq('user_id', userId).eq('action', 'privacy_change').order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return (data || []).flatMap(row => {
    const metadata = row.metadata as Record<string, unknown>;
    if (typeof metadata.field !== 'string' || (fields && !fields.includes(metadata.field))) return [];
    const display = (value: unknown) => typeof value === 'string' ? value : JSON.stringify(value) ?? '—';
    return [{ id: row.id, changed_at: row.created_at, field: metadata.field,
      old_value: display(metadata.old_value), new_value: display(metadata.new_value) }];
  }).slice(0, 10);
}