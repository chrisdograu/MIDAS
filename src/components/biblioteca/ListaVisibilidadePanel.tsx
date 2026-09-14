// Rodada 17, item 8: visibilidade individual por lista/etiqueta da biblioteca.
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Eye, Loader2, Users, Lock, User, Star } from 'lucide-react';
import { toast } from 'sonner';

type Vis = 'publico' | 'amigos' | 'close_friends' | 'privado';

const OPTIONS: { id: Vis; label: string; icon: typeof Eye }[] = [
  { id: 'publico', label: 'Pública', icon: Eye },
  { id: 'amigos', label: 'Amigos', icon: Users },
  { id: 'close_friends', label: 'Amigos próximos', icon: Star },
  { id: 'privado', label: 'Privada', icon: Lock },
];

// GAP-M025: Badges visuais
const VIS_BADGES: Record<Vis, { label: string; className: string }> = {
  publico: { label: '🌐 Pública', className: 'bg-success/20 text-success border-success/30' },
  amigos: { label: '👥 Amigos', className: 'bg-primary/20 text-primary border-primary/30' },
  close_friends: { label: '⭐ Amigos próximos', className: 'bg-warning/20 text-warning border-warning/30' },
  privado: { label: '🔒 Privada', className: 'bg-muted text-muted-foreground border-border' },
};

export default function ListaVisibilidadePanel({ listas }: { listas: string[] }) {
  const { user } = useAuth();
  const [map, setMap] = useState<Record<string, Vis>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from('lista_visibilidade')
        .select('lista_custom, visibility')
        .eq('user_id', user.id);
      const next: Record<string, Vis> = {};
      (data || []).forEach(r => { next[r.lista_custom] = r.visibility as Vis; });
      setMap(next);
      setLoading(false);
    })();
  }, [user?.id]);

  const save = async (lista: string, visibility: Vis) => {
    if (!user) return;
    const prev = map[lista] || 'publico';
    setMap(m => ({ ...m, [lista]: visibility }));
    setSaving(lista);
    const { error } = await supabase
      .from('lista_visibilidade')
      .upsert({ user_id: user.id, lista_custom: lista, visibility }, { onConflict: 'user_id,lista_custom' });
    setSaving(null);
    if (error) {
      setMap(m => ({ ...m, [lista]: prev }));
      toast.error('Não foi possível salvar a visibilidade');
    } else {
      toast.success('Visibilidade da lista atualizada');
    }
  };

  if (!user || listas.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-3 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Eye className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Privacidade das etiquetas</h2>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      <div className="space-y-2">
        {listas.map(l => {
          const current = map[l] || 'publico';
          const badge = VIS_BADGES[current];
          return (
            <div key={l} className="flex flex-wrap items-center gap-2 py-1 border-b border-border last:border-0">
              <span className="text-xs text-foreground truncate flex-1 min-w-[80px]">{l}</span>
              
              {/* GAP-M025: Badge visual da visibilidade atual */}
              <span className={cn(
                "text-[10px] px-2 py-0.5 rounded border",
                badge.className
              )}>
                {badge.label}
              </span>
              
              <div className="flex flex-wrap gap-1">
                {OPTIONS.map(o => {
                  const isActive = current === o.id;
                  const Icon = o.icon;
                  return (
                    <button
                      key={o.id}
                      disabled={saving === l}
                      onClick={() => save(l, o.id)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1",
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {o.label}
                    </button>
                  );
                })}
              </div>
              {saving === l && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">
        Cada etiqueta pode ter uma visibilidade própria, independente da regra geral da biblioteca.
        "Amigos próximos" é uma camada intermediária entre amigos e privado.
      </p>
    </div>
  );
}

const cn = (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' ');