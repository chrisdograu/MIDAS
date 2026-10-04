import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CupomValido {
  code: string;
  discount_percent: number;
}

export function useCupom() {
  const [cupom, setCupom] = useState<CupomValido | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validarCupom = async (code: string) => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('cupons')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .maybeSingle();

    setLoading(false);
    if (err || !data) {
      setError('Cupom inválido ou expirado');
      setCupom(null);
      return null;
    }
    if (data.max_uses && data.uses_count >= data.max_uses) {
      setError('Cupom esgotado');
      setCupom(null);
      return null;
    }
    const now = new Date();
    if (data.valid_until && new Date(data.valid_until) < now) {
      setError('Cupom expirado');
      setCupom(null);
      return null;
    }
    const validCupom = { code: data.code, discount_percent: data.discount_percent };
    setCupom(validCupom);
    return validCupom;
  };

  const removerCupom = () => { setCupom(null); setError(null); };

  return { cupom, loading, error, validarCupom, removerCupom };
}
