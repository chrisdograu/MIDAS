// Sistema de menções compartilhado — suporta @usuario (pessoal) e $vendedor (seller)
import { supabase } from '@/integrations/supabase/client';
import { escapeIlikeTerm } from '@/lib/escapeIlike';
import { toast } from 'sonner';

const MENTION_RE = /([@$])([a-zA-Z0-9_.-]{2,32})/g;

export type MentionKind = 'personal' | 'seller';

export function extractMentionHandles(text: string): { handle: string; kind: MentionKind }[] {
  const seen = new Set<string>();
  const out: { handle: string; kind: MentionKind }[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(MENTION_RE.source, 'g');
  while ((m = re.exec(text)) !== null) {
    const kind: MentionKind = m[1] === '$' ? 'seller' : 'personal';
    const key = `${kind}:${m[2].toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ handle: m[2].toLowerCase(), kind });
  }
  return out;
}

/**
 * Resolve handles em ids consultando tabelas certas.
 * - personal: profiles.display_name
 * - seller: seller_profiles.handle (devolve user_id como id)
 */
export async function resolveMentions(items: { handle: string; kind: MentionKind }[]) {
  if (!items.length) return [] as { id: string; handle: string; kind: MentionKind }[];
  const personal = items.filter(i => i.kind === 'personal').map(i => i.handle);
  const sellers = items.filter(i => i.kind === 'seller').map(i => i.handle);
  const results: { id: string; handle: string; kind: MentionKind }[] = [];
  if (personal.length) {
    const { data } = await supabase
      .from('profiles').select('id, display_name')
      .or(personal.map(h => `display_name.ilike.${escapeIlikeTerm(h)}`).join(','))
      .limit(50);
    (data || []).forEach(p => results.push({ id: p.id as string, handle: (p.display_name || '').toLowerCase(), kind: 'personal' }));
  }
  if (sellers.length) {
    const { data } = await supabase
      .from('seller_profiles' as any).select('user_id, handle')
      .in('handle', sellers).limit(50);
    ((data as any[]) || []).forEach(p => results.push({ id: p.user_id, handle: (p.handle || '').toLowerCase(), kind: 'seller' }));
  }
  return results;
}

/**
 * Registra menções para um conteúdo. As menções disparam trigger de notificação no banco.
 * Namespace separa interações pessoais (@) das comerciais ($).
 */
export async function recordMentions(opts: {
  text: string;
  mentionedBy: string;
  sourceType: 'forum_post' | 'forum_reply' | 'review' | 'message' | 'review_comment' | 'group_message';
  sourceId: string;
}) {
  const handles = extractMentionHandles(opts.text);
  if (!handles.length) return;
  const resolved = await resolveMentions(handles);
  if (!resolved.length) return;
  const rows = resolved
    .filter(r => r.id !== opts.mentionedBy)
    .map(r => ({
      mentioned_user_id: r.id,
      mentioned_by: opts.mentionedBy,
      source_type: opts.sourceType,
      source_id: opts.sourceId,
      context_preview: opts.text.slice(0, 140),
      namespace: r.kind,
    }));
  if (!rows.length) return;
  const { error } = await supabase.from('mentions').insert(rows as any);
  if (error) {
    console.error('[recordMentions] falha ao registrar menções', error);
    toast.error('Conteúdo salvo, mas não foi possível notificar as menções');
  }
}

export type MentionPart =
  | { kind: 'text'; value: string }
  | { kind: 'mention'; handle: string; mentionKind: MentionKind };

export function parseMentionParts(text: string): MentionPart[] {
  const parts: MentionPart[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(MENTION_RE.source, 'g');
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ kind: 'text', value: text.slice(last, m.index) });
    parts.push({ kind: 'mention', handle: m[2], mentionKind: m[1] === '$' ? 'seller' : 'personal' });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) });
  return parts;
}
