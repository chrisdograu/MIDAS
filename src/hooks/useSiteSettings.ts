import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type SettingsKey = 'store_info' | 'sale_policies' | 'email_notifications' | 'marketplace' | 'security';

export function useSiteSettings<T extends Record<string, any>>(key: SettingsKey) {
  const [value, setValue] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('site_settings').select('value').eq('key', key).maybeSingle();
    setValue((data?.value as T) || null);
    setLoading(false);
  }, [key]);

  useEffect(() => { load(); }, [load]);

  const save = async (newValue: T) => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('site_settings')
      .update({ value: newValue as any, updated_by: user?.id })
      .eq('key', key);
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar configurações');
      return false;
    }
    setValue(newValue);
    toast.success('Configurações salvas!');
    return true;
  };

  return { value, loading, saving, save, reload: load };
}
