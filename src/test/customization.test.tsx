import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CustomizacaoTab from '@/components/perfil/CustomizacaoTab';
import { CosmeticInventoryGrid } from '@/components/cosmetics/CosmeticInventoryGrid';

const mocks = vi.hoisted(() => ({ update: vi.fn(), fail: false, equip: vi.fn(), loadout: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'test-user' } }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/hooks/useCosmetics', () => ({
  useMyCosmeticInventory: () => ({ rows: [{ reward: { id: 'r1', name: 'Moldura teste', kind: 'avatar_frame', rarity: 'common', payload: {} } }], loading: false, reload: vi.fn() }),
  useUserLoadout: () => ({ rows: [], reload: mocks.loadout }),
  equipGlobalSlot: mocks.equip,
  RARITY_COLOR: { common: '' }, KIND_LABEL: { avatar_frame: 'Moldura de avatar' }, RARITY_ORDER: { common: 1 },
}));
vi.mock('@/components/cosmetics/CosmeticPreview', () => ({ CosmeticPreview: () => <span>Imagem</span> }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (table: string) => {
  const result = () => ({ data: table === 'profiles' ? { id: 'test-user', theme_color: '#14B8A6' } : [], error: mocks.fail ? { message: 'denied' } : null });
  const q: any = { select: () => q, eq: () => q, maybeSingle: async () => result(), then: (resolve: any) => Promise.resolve(result()).then(resolve), update: (value: any) => { mocks.update(value); return q; } };
  return q;
} } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.fail = false; });

describe('Customização do perfil', () => {
  it('salva diretamente sem depender de confirmação nativa', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    render(<CustomizacaoTab />);
    fireEvent.click(await screen.findByRole('button', { name: '#3B82F6' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar personalização' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ theme_color: '#3B82F6' })));
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
  it('não grava códigos de cor inválidos', async () => {
    render(<CustomizacaoTab />);
    fireEvent.change(await screen.findByLabelText('Código da cor de destaque'), { target: { value: 'hsl(30, 50%, 40%)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar personalização' }));
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('não anuncia sucesso nem recarrega após falha ao equipar', async () => {
    mocks.equip.mockResolvedValue({ error: { message: 'denied' } });
    render(<CosmeticInventoryGrid />);
    fireEvent.click(screen.getByRole('button', { name: 'Equipar' }));
    await waitFor(() => expect(mocks.equip).toHaveBeenCalledWith('test-user', 'avatar_frame', 'r1'));
    expect(mocks.loadout).not.toHaveBeenCalled();
  });
});