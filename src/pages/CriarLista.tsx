import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ListPlus, Loader2, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { createCommunityCuratedList } from '@/lib/curatedListManagement';

export default function CriarLista() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ id: string; title: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const { data: games = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['list-game-selection'],
    queryFn: async () => {
      const all: { id: string; title: string; image_url: string | null }[] = [];
      for (let page = 0; ; page++) {
        const { data, error } = await supabase.from('produtos').select('id, title, image_url').eq('is_active', true)
          .order('title').order('id').range(page * 500, (page + 1) * 500 - 1);
        if (error) throw error;
        all.push(...(data || []));
        if ((data || []).length < 500) return all;
      }
    },
  });
  const visible = useMemo(() => games.filter(game => game.title.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))), [games, search]);
  const toggle = (game: { id: string; title: string }) => setSelected(current => current.some(item => item.id === game.id) ? current.filter(item => item.id !== game.id) : [...current, game]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!title.trim() || !selected.length) { toast.error('Informe o título e selecione pelo menos um jogo.'); return; }
    setSaving(true);
    try {
      const id = await createCommunityCuratedList(title, description, selected.map(game => game.id));
      await queryClient.invalidateQueries({ queryKey: ['curated-lists'] });
      toast.success('Lista criada!');
      navigate(`/lista/${id}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível criar a lista.'); }
    finally { setSaving(false); }
  };

  return <div className="container mx-auto max-w-4xl px-4 py-8">
    <Button asChild variant="ghost" className="mb-5"><Link to="/listas"><ArrowLeft className="h-4 w-4" /> Voltar às listas</Link></Button>
    <h1 className="mb-8 flex items-center gap-3 text-2xl font-bold"><ListPlus className="h-7 w-7 text-primary" /> Criar lista</h1>
    <form onSubmit={submit} className="space-y-6">
      <div className="space-y-2"><Label htmlFor="new-list-title">Título</Label><Input id="new-list-title" value={title} onChange={event => setTitle(event.target.value)} required disabled={saving} /></div>
      <div className="space-y-2"><Label htmlFor="new-list-description">Descrição</Label><Textarea id="new-list-description" value={description} onChange={event => setDescription(event.target.value)} rows={3} disabled={saving} /></div>
      <section className="space-y-4">
        <h2 className="font-semibold">Jogos selecionados ({selected.length})</h2>
        <div className="flex flex-wrap gap-2">{selected.map(game => <Button key={game.id} type="button" variant="secondary" size="sm" disabled={saving} onClick={() => toggle(game)} aria-label={`Remover ${game.title}`} className="max-w-full"><span className="truncate">{game.title}</span><X className="h-3 w-3 shrink-0" /></Button>)}</div>
        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Buscar jogos" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar jogos" className="pl-9" /></div>
        {isLoading ? <Loader2 aria-label="Carregando jogos" className="h-6 w-6 animate-spin text-primary" /> : isError ? <div className="flex items-center gap-3"><p className="text-destructive">Não foi possível carregar os jogos.</p><Button type="button" variant="outline" onClick={() => refetch()}>Tentar novamente</Button></div> : <div className="max-h-96 overflow-y-auto divide-y divide-border border-y border-border">
          {visible.map(game => <label key={game.id} className="flex cursor-pointer items-center gap-3 py-3 pr-2">
            <Checkbox checked={selected.some(item => item.id === game.id)} onCheckedChange={() => toggle(game)} disabled={saving} aria-label={game.title} />
            {game.image_url && <img src={game.image_url} alt="" className="h-12 w-16 shrink-0 rounded object-contain bg-secondary" loading="lazy" />}
            <span className="min-w-0 break-words text-sm">{game.title}</span>
          </label>)}
          {!visible.length && <p className="py-6 text-sm text-muted-foreground">Nenhum jogo encontrado.</p>}
        </div>}
      </section>
      <div className="flex justify-end gap-3"><Button asChild variant="outline" disabled={saving}><Link to="/listas">Cancelar</Link></Button><Button type="submit" disabled={saving || !title.trim() || !selected.length}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Criar lista</Button></div>
    </form>
  </div>;
}