import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, Search } from 'lucide-react';

export default function MNotFound() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-recover: se a rota está sob /m mas não bateu em nada, manda pra home mobile depois de 1.5s
  useEffect(() => {
    if (location.pathname.startsWith('/m')) {
      const t = setTimeout(() => navigate('/m', { replace: true }), 1500);
      return () => clearTimeout(t);
    }
  }, [location.pathname, navigate]);

  // GAP-1097: Busca na página 404
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/busca?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="px-6 py-12 flex flex-col items-center text-center space-y-5 min-h-[70vh] justify-center">
      <div className="text-6xl">🎮</div>
      <h1 className="font-display text-3xl font-bold gradient-text">Redirecionando…</h1>
      <p className="text-sm text-muted-foreground max-w-xs">
        Não encontramos <code className="text-foreground">{location.pathname}</code>. Voltando ao início mobile.
      </p>

      {/* GAP-1097: Campo de busca */}
      <form onSubmit={handleSearch} className="relative w-full max-w-xs">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar no MIDIAS..."
          className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          Buscar
        </button>
      </form>

      <div className="flex flex-col gap-2 w-full max-w-xs">
        <button
          onClick={() => navigate(-1)}
          className="w-full py-2.5 rounded-xl border border-border bg-card text-sm font-semibold flex items-center justify-center gap-2 hover:border-primary/40"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <Link
          to="/m"
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 glow-primary"
        >
          <Home className="h-4 w-4" /> Início mobile
        </Link>
      </div>
    </div>
  );
}