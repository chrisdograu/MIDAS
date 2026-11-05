import { describe, expect, it } from 'vitest';
import { validOfferAmount, canRespondToOffer } from '@/lib/counteroffer';

describe('Contraoferta no chat', () => {
  it('exige valor positivo e finito', () => {
    expect(validOfferAmount('70')).toBe(true);
    for (const value of ['', '0', '-1', 'Infinity', 'NaN']) expect(validOfferAmount(value)).toBe(false);
  });
  it('permite resposta apenas do destinatário e somente enquanto pendente', () => {
    const offer = { sender_id: 'bruno', receiver_id: 'ana', message_type: 'counteroffer', payload: { status: 'pending' } };
    expect(canRespondToOffer(offer, 'ana')).toBe(true);
    expect(canRespondToOffer(offer, 'bruno')).toBe(false);
    expect(canRespondToOffer(offer, 'chris')).toBe(false);
    expect(canRespondToOffer({ ...offer, payload: { status: 'accepted' } }, 'ana')).toBe(false);
  });
});