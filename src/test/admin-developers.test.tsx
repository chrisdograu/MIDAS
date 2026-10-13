import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminDevelopers from '@/desktop/pages/AdminDevelopers';

const mock = vi.hoisted(() => ({ insert: vi.fn(), fail: false, success: vi.fn(), position: 'admin' }));
vi.mock('@/hooks/useDesktopAuth', () => ({ useDesktopAuth: () => ({ position: mock.position }) }));
vi.mock('sonner', () => ({ toast: { success: mock.success, error: vi.fn() } }));
vi.mock('@/desktop/lib/adminLog', () => ({ adminLog: vi.fn(), exportCsv: vi.fn() }));
vi.mock('@/desktop/components/ImageGalleryField', () => ({ default: () => <span>Fotos</span> }));
vi.mock('@/components/developer/DeveloperChannelAccess', () => ({ default: () => <span>Acesso ao canal</span> }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => {
  let writing = false;
  const q: any = { select: () => q, order: () => q, ilike: () => q, in: () => q,
    insert: (value: unknown) => { writing = true; mock.insert(value); return q; },
    range: async () => ({ data: [], error: null, count: 0 }),
    single: async () => ({ data: { id: 'new' }, error: writing && mock.fail ? { message: 'denied' } : null }),
  };
  return q;
} } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); mock.fail = false; mock.position = 'admin'; });

async function fill() {
  render(<MemoryRouter><AdminDevelopers /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Novo Desenvolvedor' }));
  fireEvent.change(screen.getByLabelText('Nome do desenvolvedor'), { target: { value: 'Estúdio teste' } });
  fireEvent.click(screen.getByRole('button', { name: 'Criar', exact: true }));
}
describe('Cadastro de desenvolvedores', () => {
  it('salva na tabela protegida sem depender de funções inexistentes', async () => {
    await fill();
    await waitFor(() => expect(mock.success).toHaveBeenCalledWith('Desenvolvedor criado!'));
    expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({ name: 'Estúdio teste', slug: 'estudio-teste' }));
  });
  it('mantém o formulário aberto e não confirma sucesso após falha', async () => {
    mock.fail = true;
    await fill();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Criar', exact: true })).toBeEnabled());
    expect(mock.success).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Nome do desenvolvedor')).toHaveValue('Estúdio teste');
  });
  it('não disponibiliza o cadastro para gestores sem acesso administrativo', () => {
    mock.position = 'moderador';
    render(<MemoryRouter><AdminDevelopers /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: 'Novo Desenvolvedor' })).not.toBeInTheDocument();
  });
});