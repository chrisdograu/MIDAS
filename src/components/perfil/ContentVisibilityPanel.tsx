// Rodada 18 — visibilidade uniforme de conteúdo social.
// Opiniões, prints e linha do tempo passam a ter o mesmo controle de 3 níveis
// que a biblioteca já tinha. A escolha é RETROATIVA: vale para o que já foi
// publicado, não só para o próximo post.
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Eye, Loader2, History, Sparkles, Users, UserX, AlertCircle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type Vis = 'friends' | 'nobody' | 'private';

// GAP-CV03: Sugestões de privacidade baseadas no tipo de conteúdo
const PRIVACY_SUGGESTIONS: Record<string, { suggested: Vis; reason: string }> = {
  opinions_visibility: {
    suggested: 'friends',
    reason: 'Opiniões são melhores quando compartilhadas com amigos',
  },
  screenshots_visibility: {
    suggested: 'friends',
    reason: 'Prints são momentos que valem a pena mostrar para a galera',
  },
  timeline_visibility: {
    suggested: 'friends',
    reason: 'Sua jornada gamer é mais divertida compartilhada',
  },
};

// GAP-CV02: Registrar mudança de visibilidade
const logVisibilityChange = async (userId: string, field: string, oldValue: string, newValue: string) => {
  await supabase.from('visibility_logs').insert({
    user_id: userId,
    field,
    old_value: oldValue,
    new_value: newValue,
    changed_at: new Date().toISOString(),
  });
};

const LEVELS: { id: Vis; label: string; description: string; icon: any }[] = [
  { id: 'friends', label: 'Amigos', description: 'Visível apenas para amigos mútuos', icon: Users },
  { id: 'nobody', label: 'Ninguém', description: 'Visível apenas para você', icon: UserX },
  { id: 'private', label: 'Exceções', description: 'Visível para você + exceções permitidas', icon: Sparkles },
];

const FIELDS = [
  { col: 'opinions_visibility', label: 'Opiniões e comentários', hint: 'O que você escreve nas páginas de jogos.', emoji: '💬' },
  { col: 'screenshots_visibility', label: 'Prints e clipes', hint: 'Capturas que você envia na comunidade.', emoji: '📸' },
  { col: 'timeline_visibility', label: 'Linha do tempo gamer', hint: 'Conquistas, zeradas e marcos do seu histórico.', emoji: '🏆' },
] as const;

export default function ContentVisibilityPanel({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const [values, setValues] = useState<Record<string, Vis>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  // GAP-CV01: Preview
  const [previewMode, setPreviewMode] = useState(false);
  // GAP-CV02: Histórico
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('opinions_visibility, screenshots_visibility, timeline_visibility')
        .eq('id', user.id)
        .maybeSingle();
      const row = (data || {}) as Record<string, string | null>;
      const next: Record<string, Vis> = {};
      FIELDS.forEach(f => {
        const raw = row[f.col];
        next[f.col] = (raw === 'private' || raw === 'nobody' ? raw : 'friends') as Vis;
      });
      setValues(next);
      setLoading(false);
    })();
  }, [user?.id]);

  // GAP-CV02: Carregar histórico
  useEffect(() => {
    if (!user || !showHistory) return;
    supabase
      .from('visibility_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('changed_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setHistory(data || []));
  }, [user, showHistory]);

  const save = async (col: string, value: Vis) => {
    if (!user) return;
    const prev = values[col];
    setValues(v => ({ ...v, [col]: value }));
    setSaving(col);
    
    // GAP-CV02: Registrar mudança
    await logVisibilityChange(user.id, col, prev, value);
    
    const { error } = await supabase.from('profiles').update({ [col]: value } as any).eq('id', user.id);
    setSaving(null);
    if (error) {
      setValues(v => ({ ...v, [col]: prev }));
      toast.error('Não foi possível salvar a visibilidade');
    } else {
      toast.success('Aplicado também ao conteúdo que você já publicou');
      // GAP-CV04: Sincronizar com mobile via trigger (já existe)
    }
  };

  // GAP-CV01: Preview de visibilidade
  const getPreviewText = (vis: Vis): string => {
    switch (vis) {
      case 'friends': return '✅ Amigos podem ver este conteúdo';
      case 'nobody': return '🔒 Apenas você pode ver este conteúdo';
      case 'private': return '🔑 Você + exceções podem ver este conteúdo';
      default: return '';
    }
  };

  if (!user) return null;

  // GAP-CV03: Sugestões
  const getSuggestion = (col: string): { suggested: Vis; reason: string } | null => {
    const current = values[col] || 'friends';
    const suggestion = PRIVACY_SUGGESTIONS[col];
    if (!suggestion) return null;
    if (current === suggestion.suggested) return null;
    return suggestion;
  };

  return (
    <section className={compact ? '' : 'bg-card border border-border rounded-lg p-4'}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Quem vê o que você publica</h3>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        
        {/* GAP-CV01: Botão preview */}
        <button
          onClick={() => setPreviewMode(!previewMode)}
          className={cn(
            "text-xs px-2 py-1 rounded transition",
            previewMode ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-muted"
          )}
        >
          {previewMode ? 'Ocultar' : 'Preview'}
        </button>
      </div>
      
      <p className="text-[11px] text-muted-foreground mb-3">
        Mudar aqui vale para tudo — inclusive o que já está publicado.
      </p>

      {/* GAP-CV02: Botão histórico */}
      <button
        onClick={() => setShowHistory(!showHistory)}
        className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 mb-3 transition"
      >
        <History className="h-3 w-3" />
        {showHistory ? 'Ocultar histórico' : 'Ver histórico de mudanças'}
      </button>

      {showHistory && history.length > 0 && (
        <div className="mb-3 p-2 rounded-lg bg-secondary/40 text-[10px] space-y-1 max-h-32 overflow-y-auto">
          {history.map((h, i) => (
            <div key={i} className="flex items-center gap-2 text-muted-foreground">
              <span>{new Date(h.changed_at).toLocaleDateString('pt-BR')}</span>
              <span className="font-medium">{h.field.replace('_visibility', '')}</span>
              <span className="text-[8px]">{h.old_value} → {h.new_value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {FIELDS.map(f => {
          const current = values[f.col] || 'friends';
          const suggestion = getSuggestion(f.col);
          
          return (
            <div key={f.col} className={cn(
              "p-3 rounded-lg border transition-all",
              previewMode ? "border-primary/20 bg-primary/5" : "border-transparent bg-secondary/40"
            )}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <span>{f.emoji}</span> {f.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{f.hint}</p>
                  
                  {/* GAP-CV03: Sugestão */}
                  {suggestion && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-accent">
                      <Sparkles className="h-3 w-3" />
                      <span>Sugestão: {suggestion.reason}</span>
                      <button
                        onClick={() => save(f.col, suggestion.suggested)}
                        className="text-primary hover:underline ml-1"
                      >
                        aplicar
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap justify-end gap-1 sm:shrink-0">
                  {LEVELS.map(l => {
                    const isActive = current === l.id;
                    const Icon = l.icon;
                    return (
                      <TooltipProvider key={l.id} delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              disabled={saving === f.col}
                              onClick={() => save(f.col, l.id)}
                              className={cn(
                                "px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap font-medium transition-colors flex items-center gap-1",
                                isActive
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-secondary text-muted-foreground hover:text-foreground'
                              )}
                            >
                              <Icon className="h-3 w-3" />
                              {l.label}
                              {isActive && <Check className="h-2.5 w-2.5" />}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">{l.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              </div>
              
              {/* GAP-CV01: Preview */}
              {previewMode && (
                <div className="mt-2 text-[10px] text-muted-foreground border-t border-border pt-2">
                  <AlertCircle className="h-3 w-3 inline mr-1 text-primary" />
                  {getPreviewText(current)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}