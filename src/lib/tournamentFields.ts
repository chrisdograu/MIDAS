export interface TournamentDraft {
  title: string;
  description: string;
  max_participants: number;
  prize: string;
  starts_at: string;
  ends_at: string;
  type: string;
  is_paid: boolean;
  entry_fee: number;
}

export function tournamentCreateFields(draft: TournamentDraft, productId: string, creatorId: string) {
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    max_participants: Number(draft.max_participants),
    prize: draft.prize.trim() || null,
    starts_at: draft.starts_at ? new Date(draft.starts_at).toISOString() : null,
    ends_at: draft.ends_at ? new Date(draft.ends_at).toISOString() : null,
    type: 'semanal',
    default_format: draft.type,
    bracket_type: draft.type === 'double_elimination' ? 'double' : 'single',
    entry_price: draft.is_paid ? Number(draft.entry_fee) : 0,
    created_by: creatorId,
    product_id: productId,
    status: 'open',
    event_state: 'registration',
    is_community: false,
    unlisted: false,
  };
}

export interface StreamEvent {
  kind: string;
  payload: unknown;
  created_at: string;
}

export function tournamentStreamHistory(events: StreamEvent[]) {
  return events.flatMap(event => {
    if (!['stream_changed', 'live_started'].includes(event.kind)) return [];
    if (!event.payload || typeof event.payload !== 'object') return [];
    const payload = event.payload as Record<string, unknown>;
    const url = payload.stream_url ?? payload.url;
    if (typeof url !== 'string' || !url.trim()) return [];
    return [{ url, platform: typeof payload.platform === 'string' ? payload.platform : '', used_at: event.created_at }];
  }).slice(0, 5);
}