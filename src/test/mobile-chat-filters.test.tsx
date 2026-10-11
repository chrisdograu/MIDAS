import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MChatFilters from '@/mobile/components/MChatFilters';

afterEach(cleanup);
const props = {
  tab: 'amigos' as const, filter: 'all' as const,
  onTabChange: vi.fn(), onFilterChange: vi.fn(), unread: { amigos: 3, vendedores: 0, torneios: 1 },
  hasUnread: true, markingAll: false, onMarkAllRead: vi.fn(), selectMode: false,
  selectedCount: 0, onToggleSelect: vi.fn(), onArchiveSelected: vi.fn(),
};
function setup(overrides = {}) {
  render(<MemoryRouter><MChatFilters {...props} {...overrides} /></MemoryRouter>);
}

describe('Controles do chat móvel', () => {
  it('preserva as três abas e deixa filtros recolhidos inicialmente', () => {
    setup();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /Filtros/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Favoritos' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Grupos' })).toHaveAttribute('href', '/m/grupos');
  });
  it('abre todas as opções e recolhe após escolher', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    for (const name of ['Todos', 'Favoritos', 'Não lidos', 'Arquivados']) expect(screen.getByRole('button', { name })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Favoritos' }));
    expect(props.onFilterChange).toHaveBeenCalledWith('favorites');
    expect(screen.getByRole('button', { name: /Filtros/ })).toHaveAttribute('aria-expanded', 'false');
  });
  it('permite limpar o filtro mesmo recolhido', () => {
    setup({ filter: 'unread' });
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtro Não lidos' }));
    expect(props.onFilterChange).toHaveBeenCalledWith('all');
  });
  it('preserva seleção, cancelamento e arquivo em lote', () => {
    setup({ selectMode: true, selectedCount: 2 });
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar' }));
    expect(props.onArchiveSelected).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar seleção' }));
    expect(props.onToggleSelect).toHaveBeenCalled();
  });
});