export function validOfferAmount(value: string): boolean {
  const amount = Number(value);
  return value.trim().length > 0 && Number.isFinite(amount) && amount > 0;
}

export function canRespondToOffer(message: { sender_id: string; receiver_id: string; message_type: string; payload: { status?: string } | null }, userId: string): boolean {
  return message.receiver_id === userId && message.sender_id !== userId
    && message.message_type === 'counteroffer' && message.payload?.status === 'pending';
}