// Item 5 (rodada 22) — economia de dados (preferência salva no perfil, sincroniza entre dispositivos).
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

let cache: boolean | null = null;
const listeners = new Set<(v: boolean) => void>();

export function setDataSaverCache(v: boolean) {
  cache = v;
  // Rodada 26 · item 5 — marca o documento para o CSS reduzir o glow
  // (ver `html[data-data-saver='on']` em index.css).
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-data-saver', v ? 'on' : 'off');
  }
  listeners.forEach(l => l(v));
}

export function useDataSaver() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState<boolean>(cache ?? false);

  useEffect(() => {
    const l = (v: boolean) => setEnabled(v);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  useEffect(() => {
    if (!user || cache !== null) return;
    let cancel = false;
    supabase.from('profiles').select('data_saver_mode').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (cancel) return;
        setDataSaverCache(!!(data as any)?.data_saver_mode);
      });
    return () => { cancel = true; };
  }, [user?.id]);

  return enabled;
}
