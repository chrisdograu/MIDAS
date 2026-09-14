// Rodada 24 · item 5 — Realtime no backoffice.
// Antes, nenhuma das 46 páginas do desktop se atualizava sozinha (dependia de F5).
// Este hook inscreve a página nas mudanças das tabelas críticas e chama o refetch.
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * @param tables tabelas do schema public a observar
 * @param onChange callback de refetch (não precisa ser estável — usamos ref)
 * @param channelName nome único do canal (uma inscrição por tela)
 */
export function useRealtimeRefresh(tables: string[], onChange: () => void, channelName: string) {
  const cb = useRef(onChange);
  cb.current = onChange;
  const key = tables.join(",");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    // debounce: uma rajada de eventos vira um único refetch
    const trigger = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cb.current(), 400);
    };

    const channel = supabase.channel(channelName);
    key.split(",").filter(Boolean).forEach(table => {
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table },
        trigger,
      );
    });
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [key, channelName]);
}
