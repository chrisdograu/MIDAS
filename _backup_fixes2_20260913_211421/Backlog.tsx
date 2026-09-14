import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, ArrowLeft, BookOpen, CheckCircle2, Clock, TrendingUp, ListChecks } from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import GameCard from '@/components/GameCard';
import { toast } from 'sonner';

export default function Backlog() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, completed: 0, playing: 0, completionRate: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      
      const { data } = await supabase
        .from('biblioteca_usuario')
        .select(`
          id,
          product_id,
          status,
          acquired_at,
          game:produtos(*)
        `)
        .eq('user_id', user.id)
        .in('status', ['quero_jogar', 'jogando', 'pausado', 'zerado', 'platinado', 'abandonado'])
        .order('acquired_at', { ascending: false });
      
      const backlogItems = (data || []).map((item) => ({
        ...item,
        game: item.game,
      }));
      
      setItems(backlogItems);
      
      const total = backlogItems.length;
      const completed = backlogItems.filter(i => i.status === 'zerado' || i.status === 'platinado').length;
      const playing = backlogItems.filter(i => i.status === 'jogando').length;
      
      setStats({
        total,
        completed,
        playing,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      });
      
      setLoading(false);
    })();
  }, [user]);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <BookOpen className="h-12 w-12 text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Meu Backlog</h1>
        <p className="text-muted-foreground mb-4">Entre para gerenciar seus jogos pendentes.</p>
        <Link to="/auth" className="text-primary hover:underline">Entrar</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pending = items.filter(i => i.status === 'quero_jogar' || i.status === 'pausado');
  const inProgress = items.filter(i => i.status === 'jogando');
  const completed = items.filter(i => i.status === 'zerado' || i.status === 'platinado');

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Link to="/biblioteca" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Voltar à biblioteca
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <ListChecks className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Meu Backlog</h1>
        <span className="text-sm text-muted-foreground">({stats.total} jogos)</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <BookOpen className="h-5 w-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <Clock className="h-5 w-5 text-warning mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{inProgress.length}</p>
          <p className="text-xs text-muted-foreground">Jogando</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <CheckCircle2 className="h-5 w-5 text-success mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{stats.completed}</p>
          <p className="text-xs text-muted-foreground">Completados</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <TrendingUp className="h-5 w-5 text-accent mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{stats.completionRate}%</p>
          <p className="text-xs text-muted-foreground">Progresso</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 mb-8">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">Progresso do backlog</span>
          <span className="font-semibold">{stats.completionRate}%</span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
            style={{ width: `${stats.completionRate}%` }}
          />
        </div>
      </div>

      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" /> Pendentes ({pending.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {pending.map((item) => (
              <div key={item.id} className="relative">
                <GameCard game={item.game} />
                <span className="absolute top-2 left-2 text-[10px] font-bold bg-warning/90 text-warning-foreground px-1.5 py-0.5 rounded">
                  {item.status === 'quero_jogar' ? 'Quero jogar' : 'Pausado'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {inProgress.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> Em andamento ({inProgress.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {inProgress.map((item) => (
              <div key={item.id} className="relative">
                <GameCard game={item.game} />
                <span className="absolute top-2 left-2 text-[10px] font-bold bg-primary/90 text-primary-foreground px-1.5 py-0.5 rounded">
                  Jogando
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" /> Completados ({completed.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {completed.map((item) => (
              <div key={item.id} className="relative">
                <GameCard game={item.game} />
                <span className="absolute top-2 left-2 text-[10px] font-bold bg-success/90 text-success-foreground px-1.5 py-0.5 rounded">
                  {item.status === 'platinado' ? '💎 PLAT' : '✓ Zerado'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {items.length === 0 && (
        <EstadoVazio
          icone={BookOpen}
          titulo="Seu backlog está vazio"
          descricao="Adicione jogos à sua biblioteca e marque-os como 'Quero jogar' para começar."
          acao={{ label: 'Explorar catálogo', to: '/catalogo' }}
        />
      )}
    </div>
  );
}