import { Link } from 'react-router-dom';
import { formatCurrency } from '@/lib/format';
import { HalfStarDisplay } from '@/components/HalfStarRating';
import { X } from 'lucide-react';

export function GameComparisonTable({ games, onRemove }) {
  if (games.length < 2) return null;

  const attributes = [
    { key: 'price', label: 'Preço', render: (g) => (
      <span className="font-bold text-price">{formatCurrency(g.price)}</span>
    )},
    { key: 'rating', label: 'Avaliação', render: (g) => (
      <div className="flex flex-col items-center">
        <HalfStarDisplay rating={g.rating || 0} size={16} />
        <span className="text-xs text-muted-foreground mt-1">{g.rating?.toFixed(1)}</span>
      </div>
    )},
    { key: 'category', label: 'Categoria', render: (g) => g.category },
    { key: 'platform', label: 'Plataformas', render: (g) => g.platform.join(', ') },
    { key: 'publisher', label: 'Publicadora', render: (g) => g.publisher },
    { key: 'tags', label: 'Tags', render: (g) => (
      <div className="flex flex-wrap gap-1 justify-center">
        {g.tags?.slice(0, 4).map(tag => (
          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary">{tag}</span>
        ))}
      </div>
    )},
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="p-3 text-left text-muted-foreground font-medium w-32">Atributo</th>
            {games.map(game => (
              <th key={game.id} className="p-3 text-center min-w-[160px] relative">
                {onRemove && (
                  <button
                    onClick={() => onRemove(game.id)}
                    className="absolute -top-1 -right-1 p-1 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <img src={game.image} alt={game.title} className="w-16 h-20 mx-auto rounded object-cover mb-2" loading="lazy" />
                <Link to={`/jogo/${game.id}`} className="font-semibold hover:text-primary transition-colors">
                  {game.title}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {attributes.map((attr) => (
            <tr key={attr.key} className="border-t border-border">
              <td className="p-3 text-muted-foreground font-medium">{attr.label}</td>
              {games.map(game => (
                <td key={game.id} className="p-3 text-center">
                  {attr.render(game)}
                </td>
              ))}
            </tr>
          ))}
          {games.some(g => g.stock !== undefined) && (
            <tr className="border-t border-border">
              <td className="p-3 text-muted-foreground font-medium">Estoque</td>
              {games.map(game => (
                <td key={game.id} className={`p-3 text-center ${game.stock > 0 ? 'text-success' : 'text-destructive'}`}>
                  {game.stock > 0 ? `${game.stock} un.` : 'Esgotado'}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}