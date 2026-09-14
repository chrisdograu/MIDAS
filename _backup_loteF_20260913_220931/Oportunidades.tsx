import { useState, useEffect } from 'react';
import OrbitRadar from '@/components/radar/OrbitRadar';
import OpportunityCenter from '@/components/opportunity/OpportunityCenter';
import { Share2, Filter, Sparkles, Users, ShoppingBag, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

type ViewType = 'all' | 'commercial' | 'social';

// GAP-557: Gerenciar itens já vistos
const SEEN_KEY = 'oportunidades_vistos';

function getSeenItems(): Set<string> {
  try {
    const data = localStorage.getItem(SEEN_KEY);
    return new Set(data ? JSON.parse(data) : []);
  } catch {
    return new Set();
  }
}

function markAsSeen(itemId: string) {
  try {
    const seen = getSeenItems();
    seen.add(itemId);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    // Silencioso
  }
}

export default function Oportunidades() {
  const [view, setView] = useState<ViewType>('all');
  const [sharing, setSharing] = useState(false);
  // GAP-558: Contagem de novas oportunidades
  const [newCount, setNewCount] = useState(0);

  // GAP-557: Marcar itens como vistos ao rolar
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = (entry.target as HTMLElement).dataset.opportunityId;
          if (id) {
            markAsSeen(id);
          }
        }
      });
    }, { threshold: 0.5 });

    document.querySelectorAll('[data-opportunity-id]').forEach(el => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // GAP-558: Simular contagem de novas oportunidades
  useEffect(() => {
    // Em produção, isso viria de uma query
    const seen = getSeenItems();
    // Simular 3 novas oportunidades
    const mockNewItems = ['op-1', 'op-2', 'op-3'];
    const newItems = mockNewItems.filter(id => !seen.has(id));
    setNewCount(newItems.length);
  }, []);

  // GAP-559: Compartilhar
  const handleShare = async () => {
    setSharing(true);
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Centro de Oportunidades - MIDIAS',
          text: 'Confira as melhores oportunidades no MIDIAS!',
          url: url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copiado!');
      }
    } catch {
      // Usuário cancelou
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-8 space-y-10">
      <header className="container mx-auto px-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold gradient-text">Centro de Oportunidades</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sinais explicáveis — você sempre vê <em>por que</em> algo apareceu aqui.
            </p>
          </div>
          {/* GAP-559: Botão de compartilhar */}
          <button
            onClick={handleShare}
            disabled={sharing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card text-sm font-medium hover:border-primary/40 transition-colors disabled:opacity-50"
          >
            <Share2 className="h-4 w-4" />
            Compartilhar
          </button>
        </div>

        {/* GAP-556: Tabs de separação */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">Ver:</span>
          {[
            { id: 'all', label: 'Todas', icon: Sparkles },
            { id: 'commercial', label: 'Comerciais', icon: ShoppingBag },
            { id: 'social', label: 'Sociais', icon: Users },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = view === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setView(tab.id as ViewType)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {/* GAP-558: Badge de novidades */}
                {tab.id === 'all' && newCount > 0 && (
                  <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground animate-pulse">
                    {newCount} novas
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* GAP-557: Flag de "já visto" invisível — os itens são marcados via IntersectionObserver */}
      <OrbitRadar limit={8} data-opportunity-id="radar" />

      <OpportunityCenter filter={view} />
    </div>
  );
}