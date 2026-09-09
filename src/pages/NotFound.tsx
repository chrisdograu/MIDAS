import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Smartphone, Search, ArrowRight, Gamepad2, Store, Users, Trophy, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// GAP-526: Registrar tentativa de acesso (para análise)
async function logNotFoundAttempt(path: string) {
  try {
    // Em produção, enviaria para um endpoint de analytics
    // Aqui apenas registramos no console e, se possível, no banco
    console.log(`[404] Tentativa de acesso: ${path} em ${new Date().toISOString()}`);
    
    // Opção: salvar no banco para análise posterior
    // Descomente se quiser salvar no banco
    /*
    await supabase
      .from('page_not_found_logs')
      .insert({ 
        path, 
        user_agent: navigator.userAgent,
        created_at: new Date().toISOString()
      });
    */
  } catch {
    // Silencioso — não quebrar a página por causa do log
  }
}

// GAP-525: Sugestões de páginas populares
const POPULAR_PAGES = [
  { path: '/catalogo', label: 'Catálogo', icon: Gamepad2 },
  { path: '/ofertas', label: 'Ofertas', icon: Sparkles },
  { path: '/torneios', label: 'Torneios', icon: Trophy },
  { path: '/social', label: 'Biblioteca Social', icon: Users },
  { path: '/m/marketplace', label: 'Marketplace', icon: Store },
];

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  // GAP-526: Registrar tentativa de acesso
  useEffect(() => {
    logNotFoundAttempt(location.pathname);
  }, [location.pathname]);

  // GAP-524: Busca na página 404
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/busca?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // GAP-525: Sugestão baseada no caminho atual
  const getPathSuggestions = () => {
    const path = location.pathname.toLowerCase();
    const suggestions = POPULAR_PAGES.filter(p => 
      !path.includes(p.path.replace('/', '')) || 
      path.split('/').length > 2
    );
    return suggestions.slice(0, 4);
  };

  const suggestions = getPathSuggestions();

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="text-center space-y-6 max-w-md w-full">
        <h1 className="text-6xl font-display font-bold gradient-text">404</h1>
        <p className="text-lg text-muted-foreground">
          Não encontramos <code className="text-foreground bg-secondary px-2 py-0.5 rounded">{location.pathname}</code>.
        </p>

        {/* GAP-524: Campo de busca */}
        <form onSubmit={handleSearch} className="relative max-w-sm mx-auto">
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

        {/* GAP-525: Sugestões de páginas */}
        {suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Talvez você esteja procurando por:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestions.map((page) => {
                const Icon = page.icon;
                return (
                  <Link
                    key={page.path}
                    to={page.path}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs font-medium hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  >
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    {page.label}
                    <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold glow-primary hover:opacity-90 transition-opacity"
          >
            <Home className="h-4 w-4" /> Página inicial
          </Link>
          <Link
            to="/m"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-accent/30 bg-accent/10 text-accent font-semibold hover:bg-accent/20 transition-colors"
          >
            <Smartphone className="h-4 w-4" /> Versão mobile
          </Link>
        </div>

        {/* GAP-526: Feedback de registro (apenas para debug - opcional) */}
        {process.env.NODE_ENV === 'development' && (
          <p className="text-[10px] text-muted-foreground/50">
            🔍 Acesso registrado para análise
          </p>
        )}
      </div>
    </div>
  );
};

export default NotFound;