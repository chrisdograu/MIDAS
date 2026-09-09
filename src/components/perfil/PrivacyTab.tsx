import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Shield, Plus, X, Loader2, Search, Eye, History, Users, Import } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { escapeIlikeTerm } from '@/lib/escapeIlike';
import ContentVisibilityPanel from '@/components/perfil/ContentVisibilityPanel';
import PersonalThemePanel from '@/components/perfil/PersonalThemePanel';
import { dbWrite } from '@/lib/dbWrite';
import { cn } from '@/lib/utils';

// Rodada 23 · item 2 — sem opção pública; 'nobody' é bloqueio total.
type Visibility = 'friends' | 'nobody' | 'private';
type Scope = 'reviews_completas' | 'screenshots' | 'opinions' | 'stats' | 'achievements' | 'library_items' | 'full';

const SCOPES: { id: Scope; label: string }[] = [
  { id: 'full', label: 'Acesso total (tudo)' },
  { id: 'library_items', label: 'Itens da biblioteca' },
  { id: 'reviews_completas', label: 'Reviews completas' },
  { id: 'opinions', label: 'Opiniões' },
  { id: 'screenshots', label: 'Screenshots' },
  { id: 'stats', label: 'Estatísticas' },
  { id: 'achievements', label: 'Conquistas' },
];

const STAT_TYPES: { id: string; label: string }[] = [
  { id: 'tempo_jogo', label: 'Tempo de jogo' },
  { id: 'platina', label: 'Platinas / conquistas 100%' },
  { id: 'zerados', label: 'Jogos zerados' },
  { id: 'total_jogos', label: 'Total de jogos na biblioteca' },
  { id: 'reviews', label: 'Quantidade de reviews' },
  { id: 'gasto', label: 'Valor investido em jogos' },
];

interface Profile { id: string; display_name: string | null; avatar_url: string | null }

export default function PrivacyTab() {
  const { user } = useAuth();
  const [visibility, setVisibility] = useState<Visibility>('friends');
  const [exceptions, setExceptions] = useState<Profile[]>([]);
  const [grants, setGrants] = useState<Record<string, Set<Scope>>>({});
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [alwaysHide, setAlwaysHide] = useState(false);
  const [hiddenStats, setHiddenStats] = useState<string[]>([]);
  // GAP-PR01: Preview
  const [previewMode, setPreviewMode] = useState(false);
  // GAP-PR02: Histórico
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  // GAP-PR03: Importação em massa
  const [importMode, setImportMode] = useState(false);
  const [friendList, setFriendList] = useState<Profile[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());

  const toggleStatType = async (id: string, hide: boolean) => {
    if (!user) return;
    const prev = hiddenStats;
    const next = hide ? Array.from(new Set([...prev, id])) : prev.filter(s => s !== id);
    setHiddenStats(next);
    const { error } = await supabase
      .from('profiles')
      .update({ stats_hidden_types: next } as any)
      .eq('id', user.id);
    if (error) { setHiddenStats(prev); toast.error('Erro ao salvar estatísticas'); }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: prof } = await supabase
        .from('profiles')
        .select('library_visibility, privacy_exceptions, always_hide_spoilers, stats_hidden_types')
        .eq('id', user.id)
        .maybeSingle();
      const v = (prof as any)?.library_visibility as string | null;
      setVisibility(v === 'private' || v === 'nobody' ? v : 'friends');
      setAlwaysHide(!!(prof as any)?.always_hide_spoilers);
      setHiddenStats(((prof as any)?.stats_hidden_types as string[]) || []);
      const ids: string[] = (prof as any)?.privacy_exceptions || [];
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', ids);
        setExceptions((profs as any) || []);
      }
      const { data: g } = await supabase
        .from('privacy_grants' as any)
        .select('viewer_id, scope')
        .eq('owner_id', user.id);
      const map: Record<string, Set<Scope>> = {};
      ((g as any[]) || []).forEach(r => {
        if (!map[r.viewer_id]) map[r.viewer_id] = new Set();
        map[r.viewer_id].add(r.scope);
      });
      setGrants(map);
      
      // GAP-PR02: Carregar histórico
      const { data: logs } = await supabase
        .from('privacy_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('changed_at', { ascending: false })
        .limit(10);
      setHistory(logs || []);
      
      setLoading(false);
    })();
  }, [user?.id]);

  // GAP-PR03: Carregar lista de amigos para importação
  const loadFriendsForImport = async () => {
    if (!user) return;
    const { data: friends } = await supabase
      .from('v_friendships')
      .select('friend_id')
      .eq('user_id', user.id);
    if (!friends || friends.length === 0) {
      toast.info('Você não tem amigos para importar');
      return;
    }
    const ids = friends.map((f: any) => f.friend_id);
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', ids);
    setFriendList((profs as any) || []);
    setImportMode(true);
  };

  const importSelectedFriends = async () => {
    if (selectedFriends.size === 0) return;
    const toAdd = friendList.filter(f => selectedFriends.has(f.id));
    const currentIds = new Set(exceptions.map(e => e.id));
    const newExceptions = [...exceptions, ...toAdd.filter(f => !currentIds.has(f.id))];
    await persistExceptions(newExceptions);
    setImportMode(false);
    setSelectedFriends(new Set());
    toast.success(`${toAdd.length} amigos adicionados como exceções`);
  };

  const persistVisibility = async (v: Visibility) => {
    setVisibility(v);
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ library_visibility: v, is_private: true } as any)
      .eq('id', user.id);
    if (error) toast.error('Erro ao salvar'); else toast.success('Visibilidade atualizada');
  };

  const persistAlwaysHide = async (v: boolean) => {
    setAlwaysHide(v);
    if (!user) return;
    const { error } = await supabase.from('profiles').update({ always_hide_spoilers: v } as any).eq('id', user.id);
    if (error) toast.error('Erro ao salvar'); else toast.success(v ? 'Spoilers sempre ocultos' : 'Preferência atualizada');
  };

  const persistExceptions = async (next: Profile[]) => {
    if (!user) return;
    const ids = next.map(p => p.id);
    const { error } = await supabase.from('profiles').update({ privacy_exceptions: ids } as any).eq('id', user.id);
    if (error) { toast.error('Erro ao salvar exceções'); return; }
    setExceptions(next);
  };

  const search = async () => {
    if (!query.trim()) { setResults([]); return; }
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .ilike('display_name', `%${escapeIlikeTerm(query)}%`)
      .neq('id', user!.id)
      .limit(8);
    setResults((data as any) || []);
  };

  const addException = (p: Profile) => {
    if (exceptions.some(e => e.id === p.id)) return;
    persistExceptions([...exceptions, p]);
    setResults([]); setQuery('');
  };
  const removeException = (id: string) => persistExceptions(exceptions.filter(e => e.id !== id));

  const toggleGrant = async (viewerId: string, scope: Scope, on: boolean) => {
    if (!user) return;
    if (on) {
      await dbWrite(supabase.from('privacy_grants' as any).insert({ owner_id: user.id, viewer_id: viewerId, scope }));
    } else {
      await dbWrite(supabase.from('privacy_grants' as any).delete().match({ owner_id: user.id, viewer_id: viewerId, scope }));
    }
    setGrants(prev => {
      const next = { ...prev };
      const s = new Set(next[viewerId] || []);
      if (on) s.add(scope); else s.delete(scope);
      next[viewerId] = s;
      return next;
    });
  };

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  // GAP-PR01: Preview
  const previewVisibility = visibility === 'friends' ? 'Amigos veem todo seu conteúdo' :
    visibility === 'nobody' ? 'Ninguém vê seu conteúdo' :
    'Apenas exceções veem seu conteúdo';

  return (
    <div className="space-y-6">
      {/* GAP-PR01: Preview */}
      <button
        onClick={() => setPreviewMode(!previewMode)}
        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition"
      >
        <Eye className="h-3 w-3" />
        {previewMode ? 'Ocultar preview' : 'Ver como seu perfil aparece para outros'}
      </button>

      {previewMode && (
        <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
          <p className="text-sm font-medium">🔍 Visão de terceiros</p>
          <p className="text-xs text-muted-foreground mt-1">{previewVisibility}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-[10px] bg-secondary px-2 py-0.5 rounded-full">
              {exceptions.length} exceções
            </span>
            <span className="text-[10px] bg-secondary px-2 py-0.5 rounded-full">
              {Object.keys(grants).length} permissões especiais
            </span>
          </div>
        </div>
      )}

      <section className="border border-border rounded-lg p-3 bg-card">
        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox checked={alwaysHide} onCheckedChange={(v) => persistAlwaysHide(!!v)} className="mt-0.5" />
          <span className="flex-1">
            <span className="text-sm font-semibold text-foreground block">Sempre ocultar spoilers</span>
            <span className="text-[11px] text-muted-foreground block mt-0.5">
              Conteúdo marcado como spoiler (manual ou de conquista) sempre exigirá um clique para revelar — mesmo se você já tiver a conquista vinculada.
            </span>
          </span>
        </label>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-primary" /> Visibilidade da biblioteca
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(['friends', 'nobody', 'private'] as Visibility[]).map(v => (
            <button
              key={v}
              onClick={() => persistVisibility(v)}
              className={`px-3 py-3 rounded-lg border text-xs font-medium transition ${visibility === v ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground hover:text-foreground'}`}
            >
              {v === 'friends' ? 'Amigos' : v === 'nobody' ? 'Ninguém' : 'Ninguém, exceto exceções'}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          {visibility === 'friends' && 'Apenas amigos mútuos têm acesso ao conteúdo social.'}
          {visibility === 'nobody' && 'Bloqueio total: ninguém vê, nem amigos próximos, nem exceções autorizadas.'}
          {visibility === 'private' && 'Apenas amigos próximos e exceções autorizadas têm acesso.'}
        </p>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-foreground mb-1">Estatísticas exibidas no perfil</h3>
        <p className="text-[11px] text-muted-foreground mb-3">
          Desmarque o que você não quer que apareça para outras pessoas. Você continua vendo tudo no seu próprio perfil.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {STAT_TYPES.map(s => {
            const hidden = hiddenStats.includes(s.id);
            return (
              <label key={s.id} className="flex items-start gap-2 border border-border rounded-lg p-2.5 bg-card cursor-pointer">
                <Checkbox checked={!hidden} onCheckedChange={(v) => toggleStatType(s.id, !v)} className="mt-0.5" />
                <span className="text-xs text-foreground">{s.label}</span>
              </label>
            );
          })}
        </div>
      </section>

      <ContentVisibilityPanel />
      <PersonalThemePanel />

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Exceções (acesso especial)</h3>
          {/* GAP-PR03: Importação em massa */}
          <button
            onClick={loadFriendsForImport}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Import className="h-3 w-3" /> Importar amigos
          </button>
        </div>

        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="Buscar usuário pelo nome"
              className="w-full pl-9 pr-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <button onClick={search} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">Buscar</button>
        </div>

        {/* GAP-PR03: Modal de importação */}
        {importMode && (
          <div className="mb-3 border border-border rounded-lg p-3 bg-secondary/40">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Selecione amigos para adicionar como exceções</p>
              <button onClick={() => { setImportMode(false); setSelectedFriends(new Set()); }} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {friendList.map(f => (
                <label key={f.id} className="flex items-center gap-2 p-2 rounded hover:bg-secondary cursor-pointer">
                  <Checkbox
                    checked={selectedFriends.has(f.id)}
                    onCheckedChange={(v) => {
                      const next = new Set(selectedFriends);
                      if (v) next.add(f.id);
                      else next.delete(f.id);
                      setSelectedFriends(next);
                    }}
                  />
                  <span className="text-sm">{f.display_name || 'Usuário'}</span>
                </label>
              ))}
            </div>
            <Button size="sm" onClick={importSelectedFriends} disabled={selectedFriends.size === 0} className="mt-2">
              Adicionar {selectedFriends.size} amigos
            </Button>
          </div>
        )}

        {results.length > 0 && (
          <div className="mb-3 border border-border rounded-lg overflow-hidden">
            {results.map(r => (
              <button key={r.id} onClick={() => addException(r)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-secondary text-left">
                <div className="w-7 h-7 rounded-full bg-primary/20 overflow-hidden">
                  {r.avatar_url && <img src={r.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />}
                </div>
                <span className="text-sm flex-1 truncate">{r.display_name}</span>
                <Plus className="h-4 w-4 text-primary" />
              </button>
            ))}
          </div>
        )}

        {exceptions.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma exceção definida.</p>
        ) : (
          <div className="space-y-3">
            {exceptions.map(p => {
              const hasGrants = grants[p.id] && grants[p.id].size > 0;
              return (
                <div key={p.id} className="border border-border rounded-lg p-3 bg-card">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 overflow-hidden">
                      {p.avatar_url && <img src={p.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />}
                    </div>
                    <span className="text-sm font-medium flex-1 truncate">{p.display_name}</span>
                    {/* GAP-PR04: Indicador de herança */}
                    {hasGrants && (
                      <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                        ✦ personalizado
                      </span>
                    )}
                    <button onClick={() => removeException(p.id)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {SCOPES.map(s => {
                      const checked = grants[p.id]?.has(s.id) || false;
                      return (
                        <label key={s.id} className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                          <Checkbox checked={checked} onCheckedChange={(v) => toggleGrant(p.id, s.id, !!v)} />
                          {s.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* GAP-PR02: Histórico */}
      <section>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition"
        >
          <History className="h-3 w-3" />
          {showHistory ? 'Ocultar' : 'Ver'} histórico de privacidade
        </button>
        {showHistory && (
          <div className="mt-2 p-3 rounded-lg bg-secondary/40 border border-border max-h-32 overflow-y-auto">
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma alteração registrada</p>
            ) : (
              history.map((h, i) => (
                <div key={i} className="flex items-center justify-between text-[10px] text-muted-foreground border-b border-border last:border-0 py-1">
                  <span>{new Date(h.changed_at).toLocaleDateString('pt-BR')}</span>
                  <span>{h.field.replace('_visibility', '')}: {h.old_value} → {h.new_value}</span>
                </div>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}