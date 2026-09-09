// Hooks para o sistema de recompensas cosméticas (Parte 2 do plano).
// - useMyCosmeticInventory: cosméticos desbloqueados pelo usuário atual
// - useUserLoadout: loadout global (perfil) de qualquer usuário
// - useGamePageLoadout: loadout da página de um jogo específico
// - useGameRewards: catálogo de recompensas de um jogo (para Admin/preview)
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type RewardKind =
  | 'avatar_frame' | 'profile_banner' | 'profile_accent'
  | 'game_card_skin' | 'game_page_theme' | 'character_icon' | 'sticker';
export type RewardRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface GameReward {
  id: string;
  product_id: string;
  kind: RewardKind;
  name: string;
  description: string | null;
  asset_url: string | null;
  payload: Record<string, any>;
  unlock_criteria: Record<string, any>;
  rarity: RewardRarity;
  is_active: boolean;
}

export interface InventoryRow {
  reward: GameReward;
  product_title?: string | null;
  unlocked_at: string;
}

export interface LoadoutRow { slot: string; reward_id: string | null; reward?: GameReward | null; }

// --- Inventory ---
export function useMyCosmeticInventory() {
  const { user } = useAuth();
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('user_game_rewards' as any)
      .select('unlocked_at, reward:game_rewards(*, produtos!inner(title))')
      .eq('user_id', user.id)
      .order('unlocked_at', { ascending: false });
    const list = (data || []).map((r: any) => ({
      reward: r.reward as GameReward,
      product_title: r.reward?.produtos?.title ?? null,
      unlocked_at: r.unlocked_at,
    }));
    setRows(list);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { reload(); }, [reload]);
  return { rows, loading, reload };
}

// --- Global profile loadout (any user) ---
export function useUserLoadout(userId: string | null | undefined) {
  const [rows, setRows] = useState<LoadoutRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('user_cosmetic_loadout' as any)
      .select('slot, reward_id, reward:game_rewards(*)')
      .eq('user_id', userId);
    setRows((data as any) || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);
  return { rows, loading, reload };
}

export async function equipGlobalSlot(userId: string, slot: string, rewardId: string | null) {
  if (rewardId === null) {
    return supabase.from('user_cosmetic_loadout' as any).delete().eq('user_id', userId).eq('slot', slot);
  }
  return supabase.from('user_cosmetic_loadout' as any).upsert(
    { user_id: userId, slot, reward_id: rewardId, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,slot' }
  );
}

// --- Per game page loadout ---
export function useGamePageLoadout(userId: string | null | undefined, productId: string | null | undefined) {
  const [rows, setRows] = useState<LoadoutRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId || !productId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('user_game_page_loadout' as any)
      .select('slot, reward_id, reward:game_rewards(*)')
      .eq('user_id', userId)
      .eq('product_id', productId);
    setRows((data as any) || []);
    setLoading(false);
  }, [userId, productId]);

  useEffect(() => { reload(); }, [reload]);
  return { rows, loading, reload };
}

export async function equipGamePageSlot(userId: string, productId: string, slot: string, rewardId: string | null) {
  if (rewardId === null) {
    return supabase.from('user_game_page_loadout' as any).delete()
      .eq('user_id', userId).eq('product_id', productId).eq('slot', slot);
  }
  return supabase.from('user_game_page_loadout' as any).upsert(
    { user_id: userId, product_id: productId, slot, reward_id: rewardId, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,product_id,slot' }
  );
}

// --- Game rewards catalog (admin / preview) ---
export function useGameRewards(productId: string | null | undefined) {
  const [rows, setRows] = useState<GameReward[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!productId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('game_rewards' as any)
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });
    setRows((data as any) || []);
    setLoading(false);
  }, [productId]);

  useEffect(() => { reload(); }, [reload]);
  return { rows, loading, reload };
}

// --- Library helper for "Customizar" gate ---
// Posse real: `quero_jogar` (lista de desejos) NÃO conta, mesma regra do trigger de avaliações.
export const OWNERSHIP_STATUSES = ['ja_joguei','zerado','jogando','pausado','abandonado','platinado'] as const;

export async function userOwnsGame(userId: string, productId: string): Promise<boolean> {
  const { data } = await supabase
    .from('biblioteca_usuario' as any)
    .select('id, status')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .in('status', OWNERSHIP_STATUSES as unknown as string[])
    .maybeSingle();
  return !!data;
}

export const RARITY_COLOR: Record<RewardRarity, string> = {
  common: 'border-zinc-400 text-zinc-300',
  rare: 'border-sky-400 text-sky-300',
  epic: 'border-purple-400 text-purple-300',
  legendary: 'border-amber-400 text-amber-300',
  mythic: 'border-pink-500 text-pink-300',
};

export const KIND_LABEL: Record<RewardKind, string> = {
  avatar_frame: 'Moldura de avatar',
  profile_banner: 'Banner de perfil',
  profile_accent: 'Cor de destaque',
  game_card_skin: 'Skin de card',
  game_page_theme: 'Tema da página',
  character_icon: 'Ícone de personagem',
  sticker: 'Adesivo',
};

export const KIND_EMOJI: Record<RewardKind, string> = {
  avatar_frame: '🖼️', profile_banner: '🌅', profile_accent: '🎨',
  game_card_skin: '🃏', game_page_theme: '✨', character_icon: '👤', sticker: '🏷️',
};
