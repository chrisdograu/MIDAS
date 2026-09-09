import { Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';

export function DeveloperCard({ id, name, logo_url, game_count }) {
  return (
    <Link
      to={`/desenvolvedor/${id}`}
      className="bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-all text-center group"
    >
      <div className="w-20 h-20 mx-auto rounded-full bg-secondary overflow-hidden flex items-center justify-center">
        {logo_url ? (
          <img src={logo_url} alt={name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <Building2 className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <h3 className="text-sm font-semibold mt-3 group-hover:text-primary transition-colors">{name}</h3>
      <p className="text-xs text-muted-foreground">{game_count} {game_count === 1 ? 'jogo' : 'jogos'}</p>
    </Link>
  );
}