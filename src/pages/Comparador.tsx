import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProdutos } from '@/hooks/useProdutos';
import { Loader2, X, Plus, ArrowLeft, Scale } from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import { toast } from 'sonner';
import { GameComparisonTable } from '@/components/comparador/GameComparisonTable';

const MAX_COMPARE = 4;

export default function Comparador() {
  const { data: allGames = [], isLoading } = useProdutos();
  const [selectedIds, setSelectedIds] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedGames = allGames.filter(g => selectedIds.includes(g.id));
  const availableGames = allGames.filter(g => !selectedIds.includes(g.id));

  const addGame = (id) => {
    if (selectedIds.length >= MAX_COMPARE) {
      toast.error(`Máximo de ${MAX_COMPARE} jogos para comparar`);
      return;
    }
    setSelectedIds([...selectedIds, id]);
    setShowSearch(false);
    setSearchQuery('');
  };

  const removeGame = (id) => {
    setSelectedIds(selectedIds.filter(sid => sid !== id));
  };

  const clearAll = () => {
    setSelectedIds([]);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-20 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const filteredAvailable = availableGames.filter(g => 
    g.title.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 8);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Link to="/catalogo" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Scale className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Comparador de Jogos</h1>
          <span className="text-sm text-muted-foreground">({selectedIds.length}/{MAX_COMPARE})</span>
        </div>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <button
              onClick={clearAll}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
            >
              Limpar todos
            </button>
          )}
          <button
            onClick={() => setShowSearch(!showSearch)}
            disabled={selectedIds.length >= MAX_COMPARE}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-colors"
          >
            <Plus className="h-4 w-4" /> Adicionar jogo
          </button>
        </div>
      </div>

      {showSearch && (
        <div className="mb-6 p-4 bg-card border border-border rounded-xl">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar jogos para adicionar..."
            className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <div className="mt-3 max-h-48 overflow-y-auto space-y-1">
            {filteredAvailable.length > 0 ? (
              filteredAvailable.map(game => (
                <button
                  key={game.id}
                  onClick={() => addGame(game.id)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary transition-colors text-left"
                >
                  <img src={game.image} alt={game.title} className="w-10 h-10 rounded object-cover" loading="lazy" />
                  <span className="text-sm font-medium">{game.title}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{game.price}</span>
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                {searchQuery ? 'Nenhum jogo encontrado' : 'Digite para buscar jogos'}
              </p>
            )}
          </div>
        </div>
      )}

      {selectedIds.length === 0 ? (
        <EstadoVazio
          icone={Scale}
          titulo="Nenhum jogo selecionado"
          descricao="Adicione 2 a 4 jogos para comparar lado a lado."
          acao={{ label: 'Adicionar jogos', onClick: () => setShowSearch(true) }}
        />
      ) : (
        <GameComparisonTable games={selectedGames} onRemove={removeGame} />
      )}
    </div>
  );
}