import { describe, expect, it } from 'vitest';
import { tournamentCreateFields, tournamentStreamHistory, type TournamentDraft } from '@/lib/tournamentFields';

const draft: TournamentDraft = {
  title: 'Copa MIDIAS', description: 'Partidas amistosas', max_participants: 8,
  prize: '', starts_at: '2026-11-07T18:00:00Z', ends_at: '2026-11-07T22:00:00Z',
  type: 'single_elimination', is_paid: false, entry_fee: 25,
};

describe('Tournament persistence', () => {
  it('preserves the selected game and creator', () => {
    const fields = tournamentCreateFields(draft, 'fc25', 'organizer');
    expect(fields.product_id).toBe('fc25');
    expect(fields.created_by).toBe('organizer');
  });
  it('opens registration for a newly created tournament', () => {
    const fields = tournamentCreateFields(draft, 'fc25', 'organizer');
    expect(fields.status).toBe('open');
    expect(fields.event_state).toBe('registration');
  });
  it('does not charge an entry fee when the paid switch is off', () => {
    expect(tournamentCreateFields(draft, 'fc25', 'organizer').entry_price).toBe(0);
  });
  it('persists the configured fee in entry_price', () => {
    expect(tournamentCreateFields({ ...draft, is_paid: true }, 'fc25', 'organizer').entry_price).toBe(25);
  });
  it('maps double elimination to the bracket and default format', () => {
    const fields = tournamentCreateFields({ ...draft, type: 'double_elimination' }, 'fc25', 'organizer');
    expect(fields.bracket_type).toBe('double');
    expect(fields.default_format).toBe('double_elimination');
  });
  it('only returns persisted stream events with URLs', () => {
    const history = tournamentStreamHistory([
      { kind: 'stream_changed', payload: { stream_url: 'https://twitch.tv/midias', platform: 'twitch' }, created_at: '2026-10-29T23:00:00Z' },
      { kind: 'announcement', payload: { text: 'Abertura' }, created_at: '2026-10-29T22:00:00Z' },
      { kind: 'live_started', payload: null, created_at: '2026-10-29T21:00:00Z' },
    ]);
    expect(history).toEqual([{ url: 'https://twitch.tv/midias', platform: 'twitch', used_at: '2026-10-29T23:00:00Z' }]);
  });
});