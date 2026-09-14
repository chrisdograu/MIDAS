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

  /**
   * Resgate atômico do cupom no fechamento do pedido.
   * Usa `validate_and_use_coupon` RPC (com `SELECT ... FOR UPDATE`) para
   * impedir corrida onde 2 pedidos simultâneos estourariam `max_uses`.
   * Retorna o coupon_id em sucesso, ou joga o erro em falha.
   */
  const redeemCupom = async (orderId: string): Promise<string | null> => {
    if (!cupom) return null;
    const { data, error: err } = await (supabase as any).rpc('validate_and_use_coupon', {
      _code: cupom.code,
      _order_id: orderId,
    });
    if (err) {
      const msg = err.message || '';
      if (msg.includes('rate_limit_exceeded')) setError('Muitas tentativas. Aguarde alguns minutos e tente de novo.');
      else if (msg.includes('coupon_exhausted')) setError('Cupom esgotado');
      else if (msg.includes('coupon_expired')) setError('Cupom expirado');
      else if (msg.includes('coupon_not_found')) setError('Cupom inválido');
      else setError(msg || 'Falha ao resgatar cupom');
      return null;
    }
    return data as string;
  };

  return { cupom, loading, error, validarCupom, removerCupom, redeemCupom };
}
