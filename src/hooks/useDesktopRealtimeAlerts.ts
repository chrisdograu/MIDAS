import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Bell, Flag, ShoppingBag, Award, ArrowLeftRight } from 'lucide-react';
import { createElement } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDesktopAuth } from './useDesktopAuth';
import { formatCurrency } from '@/lib/format';

/**
 * Listens to INSERTs on key tables and dispatches toast alerts.
 * Filters by staff role and ignores rows older than mount time (avoids replay spam).
 */
export function useDesktopRealtimeAlerts(enabled: boolean) {
  const { canAccess, position } = useDesktopAuth();
  const navigate = useNavigate();
  const mountedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!enabled || !position) return;
    mountedAtRef.current = Date.now();

    // Margem de 5s (em vez de 2s) para absorver skew de relógio
    const isFresh = (createdAt?: string | null) => {
      if (!createdAt) return true;
      return new Date(createdAt).getTime() >= mountedAtRef.current - 5000;
    };

    const showAlert = (
      icon: typeof Bell,
      title: string,
      description: string,
      route: string,
    ) => {
      toast(title, {
        description,
        icon: createElement(icon, { className: 'h-4 w-4 text-primary' }),
        action: { label: 'Ver', onClick: () => navigate(route) },
        duration: 8000,
      });
    };

    const channel = supabase.channel('desktop-realtime-alerts');

    if (canAccess('moderacao')) {
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'denuncias' },
        (payload) => {
          const row = payload.new as { created_at?: string; reason?: string; target_type?: string };
          if (!isFresh(row.created_at)) return;
          showAlert(
            Flag,
            'Nova denúncia recebida',
            `${row.target_type ?? 'item'} • ${row.reason ?? 'sem motivo'}`,
            '/desktop/moderacao',
          );
        },
      );
    }

    if (canAccess('pedidos')) {
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pedidos' },
        (payload) => {
          const row = payload.new as { created_at?: string; total?: number };
          if (!isFresh(row.created_at)) return;
          const total = typeof row.total === 'number' ? row.total : 0;
          showAlert(
            ShoppingBag,
            'Novo pedido recebido',
            `Total: ${formatCurrency(total)}`,
            '/desktop/pedidos',
          );
        },
      );
    }

    if (canAccess('certificados')) {
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'certificados' },
        (payload) => {
          const row = payload.new as { created_at?: string };
          if (!isFresh(row.created_at)) return;
          showAlert(
            Award,
            'Nova solicitação de certificado',
            'Um usuário pediu certificado de proteção',
            '/desktop/certificados',
          );
        },
      );
    }

    if (canAccess('propostas')) {
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trade_proposals' },
        (payload) => {
          const row = payload.new as { created_at?: string };
          if (!isFresh(row.created_at)) return;
          showAlert(
            ArrowLeftRight,
            'Nova proposta de troca',
            'Uma proposta acaba de ser enviada',
            '/desktop/propostas',
          );
        },
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, position, canAccess, navigate]);
}
