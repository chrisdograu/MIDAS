import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PersonalThemePanel from '@/components/perfil/PersonalThemePanel';
import { applyPersonalTheme } from '@/lib/personalTheme';

const mock = vi.hoisted(() => ({ fail: false, update: vi.fn(), success: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'test' } }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: mock.success } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => {
  let writing = false;
  const q: any = { select: () => q, eq: () => q,
    update: (value: unknown) => { writing = true; mock.update(value); return q; },
    maybeSingle: async () => ({ data: writing ? { id: 'test' } : { personal_theme: { accent: '#14B8A6' } }, error: writing && mock.fail ? { message: 'denied' } : null }),
  };
  return q;
} } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); mock.fail = false; localStorage.clear(); applyPersonalTheme(null); });

describe('Painel de tema pessoal', () => {
  it('mantém a cor anterior e não registra histórico nem sucesso ao falhar', async () => {
    mock.fail = true;
    render(<PersonalThemePanel />);
    const button = await screen.findByRole('button', { name: 'Azul cyber' });
    await waitFor(() => expect(button).toBeEnabled());
    const previous = document.documentElement.style.getPropertyValue('--primary');
    fireEvent.click(button);
    await waitFor(() => expect(mock.update).toHaveBeenCalled());
    expect(mock.success).not.toHaveBeenCalled();
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe(previous);
    expect(localStorage.getItem('midias-theme-history')).toBeNull();
  });
  it('salva uma sugestão complementar válida e restaura todos os tokens', async () => {
    render(<PersonalThemePanel />);
    const button = await screen.findByRole('button', { name: 'Usar cor #eb4759' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(mock.success).toHaveBeenCalled());
    expect(mock.update).toHaveBeenCalledWith({ personal_theme: { accent: '#eb4759' } });
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao padrão' }));
    await waitFor(() => expect(document.documentElement.style.getPropertyValue('--primary-foreground')).toBe(''));
  });
});