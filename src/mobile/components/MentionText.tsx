import { Link } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseMentionParts } from '@/mobile/lib/mentions';
import { escapeIlikeTerm } from '@/lib/escapeIlike';

// GAP-M007: Cache simples para evitar requisições repetidas
const mentionCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minuto

/**
 * Renderiza texto convertendo @usuario (pessoal) e $vendedor (seller) em chips clicáveis.
 * Cada tipo resolve de uma tabela distinta e leva a rotas diferentes.
 */
export function MentionText({ text, className }: { text: string; className?: string }) {
  const parts = useMemo(() => parseMentionParts(text), [text]);
  
  const personalHandles = parts
    .filter(p => p.kind === 'mention' && p.mentionKind === 'personal')
    .map(p => (p as any).handle.toLowerCase());
  
  const sellerHandles = parts
    .filter(p => p.kind === 'mention' && p.mentionKind === 'seller')
    .map(p => (p as any).handle.toLowerCase());

  const [pmap, setPmap] = useState<Record<string, { id: string; display_name: string | null; avatar_url: string | null }>>({});
  const [smap, setSmap] = useState<Record<string, { handle: string; display_name: string | null; avatar_url: string | null }>>({});

  // GAP-M007: Buscar com cache
  const fetchWithCache = async (key: string, fetcher: () => Promise<any>) => {
    const cached = mentionCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    const data = await fetcher();
    mentionCache.set(key, { data, timestamp: Date.now() });
    return data;
  };

  useEffect(() => {
    let cancel = false;

    (async () => {
      // GAP-M006: Buscar todos os mentions de uma vez
      if (personalHandles.length) {
        const key = `personal_${personalHandles.join(',')}`;
        const data = await fetchWithCache(key, async () => {
          const { data } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .or(personalHandles.map(h => `display_name.ilike.${escapeIlikeTerm(h)}`).join(','))
            .limit(50);
          return data || [];
        });

        if (!cancel && data) {
          const m: any = {};
          data.forEach((p: any) => {
            m[(p.display_name || '').toLowerCase()] = p;
          });
          setPmap(m);
        }
      }

      if (sellerHandles.length) {
        const key = `seller_${sellerHandles.join(',')}`;
        const data = await fetchWithCache(key, async () => {
          const { data } = await supabase
            .from('seller_profiles' as any)
            .select('handle, display_name, avatar_url')
            .in('handle', sellerHandles)
            .limit(50);
          return data || [];
        });

        if (!cancel && data) {
          const m: any = {};
          (data as any[]).forEach((p: any) => {
            m[(p.handle || '').toLowerCase()] = p;
          });
          setSmap(m);
        }
      }
    })();

    return () => { cancel = true; };
  }, [personalHandles.join(','), sellerHandles.join(',')]);

  // GAP-M008: Escapar caracteres especiais no texto
  const escapeText = (text: string) => {
    return text.replace(/[&<>"]/g, (char) => {
      const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
      };
      return map[char] || char;
    });
  };

  return (
    <span className={className}>
      {parts.map((p, i) => {
        if (p.kind === 'text') {
          // GAP-M008: Texto escapado
          return <span key={i} dangerouslySetInnerHTML={{ __html: escapeText(p.value) }} />;
        }

        if (p.mentionKind === 'seller') {
          const s = smap[p.handle.toLowerCase()];
          // GAP-M005: Fallback para menção não encontrada
          if (!s) {
            return (
              <span key={i} className="text-accent/60 line-through decoration-accent/30">
                ${p.handle}
              </span>
            );
          }
          return (
            <Link
              key={i}
              to={`/m/vendedor/${s.handle}`}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded bg-accent/15 text-accent text-[12px] font-semibold hover:bg-accent/25 transition-colors"
            >
              {s.avatar_url && (
                <img
                  src={s.avatar_url}
                  alt=""
                  className="w-3.5 h-3.5 rounded-full object-cover"
                  loading="lazy"
                />
              )}
              ${s.display_name || s.handle}
            </Link>
          );
        }

        // Personal mention
        const prof = pmap[p.handle.toLowerCase()];
        // GAP-M005: Fallback para menção não encontrada
        if (!prof) {
          return (
            <span key={i} className="text-primary/60 line-through decoration-primary/30">
              @{p.handle}
            </span>
          );
        }
        return (
          <Link
            key={i}
            to={`/m/perfil/${prof.id}`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded bg-primary/15 text-primary text-[12px] font-semibold hover:bg-primary/25 transition-colors"
          >
            {prof.avatar_url && (
              <img
                src={prof.avatar_url}
                alt=""
                className="w-3.5 h-3.5 rounded-full object-cover"
                loading="lazy"
              />
            )}
            @{prof.display_name || prof.id.slice(0, 8)}
          </Link>
        );
      })}
    </span>
  );
}