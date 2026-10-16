import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import ImageGalleryField from '@/desktop/components/ImageGalleryField';
import { MessageSquare, Pin, Pencil, Trash2, Lock, Unlock, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';
import { removeStoredImages, unusedImages } from '@/lib/storageCleanup';

type Update = Tables<'developer_updates'>;
type Comment = Tables<'developer_update_comments'>;
const dateLabel = (value: string) => new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

function Comments({ post, manager }: { post: Update; manager: boolean }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [limit, setLimit] = useState(20);
  const [body, setBody] = useState('');
  const [editing, setEditing] = useState<Comment | null>(null);
  const [busy, setBusy] = useState(false);
  const key = ['developer-comments', post.id];
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: [...key, limit], queryFn: async () => {
    const { data, error, count } = await supabase.from('developer_update_comments').select('*', { count: 'exact' }).eq('update_id', post.id).order('created_at').range(0, limit - 1);
    if (error) throw error;
    const ids = [...new Set((data ?? []).map(c => c.author_id))];
    const names = new Map<string, string>();
    await Promise.all(ids.map(async id => {
      const { data: profile } = await supabase.rpc('get_public_profile', { _uid: id });
      const person = profile?.[0];
      names.set(id, person?.display_name || person?.username || 'Usuário');
    }));
    return { comments: data ?? [], count: count ?? 0, names };
  }});
  const save = async () => {
    if (!user || !body.trim()) return;
    setBusy(true);
    const result = editing
      ? await supabase.from('developer_update_comments').update({ body: body.trim() }).eq('id', editing.id)
      : await supabase.from('developer_update_comments').insert({ update_id: post.id, author_id: user.id, body: body.trim() });
    setBusy(false);
    if (result.error) { toast.error(result.error.message); return; }
    setBody(''); setEditing(null);
    await client.invalidateQueries({ queryKey: key });
  };
  const remove = async (comment: Comment) => {
    if (!window.confirm('Excluir este comentário?')) return;
    const { error } = await supabase.from('developer_update_comments').delete().eq('id', comment.id);
    if (error) { toast.error(error.message); return; }
    await client.invalidateQueries({ queryKey: key });
  };
  return <div className="mt-4 border-t border-border pt-4 space-y-4">
    {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
    {isError && <Button variant="outline" onClick={() => refetch()}>Tentar carregar comentários novamente</Button>}
    {data?.comments.map(comment => <div key={comment.id} className="border-b border-border/50 pb-3">
      <div className="flex justify-between gap-2 items-center">
        <Link to={`/perfil/${comment.author_id}`} className="text-sm font-semibold hover:text-primary">{data.names.get(comment.author_id)}</Link>
        <div className="flex items-center gap-1">
          <time className="text-xs text-muted-foreground">{dateLabel(comment.created_at)}</time>
          {user?.id === comment.author_id && <Button size="icon" variant="ghost" aria-label="Editar comentário" title="Editar comentário" onClick={() => { setEditing(comment); setBody(comment.body); }}><Pencil className="h-3.5 w-3.5" /></Button>}
          {(manager || user?.id === comment.author_id) && <Button size="icon" variant="ghost" aria-label="Excluir comentário" title="Excluir comentário" onClick={() => remove(comment)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
        </div>
      </div>
      <p className="text-sm whitespace-pre-wrap break-words">{comment.body}</p>
    </div>)}
    {data && data.count > limit && <Button variant="outline" onClick={() => setLimit(value => value + 20)}>Mais comentários</Button>}
    {user && (post.comments_open || editing) ? <div className="space-y-2">
      <Textarea aria-label={editing ? 'Editar comentário' : 'Seu comentário'} placeholder="Escreva um comentário…" maxLength={2000} value={body} onChange={e => setBody(e.target.value)} />
      <div className="flex justify-end gap-2">
        {editing && <Button variant="ghost" onClick={() => { setEditing(null); setBody(''); }}>Cancelar</Button>}
        <Button disabled={busy || !body.trim()} onClick={save}><Send className="h-4 w-4 mr-2" />{editing ? 'Salvar' : 'Comentar'}</Button>
      </div>
    </div> : <p className="text-sm text-muted-foreground">{!post.comments_open ? 'Comentários encerrados.' : <Link className="text-primary hover:underline" to="/auth">Entrar para comentar</Link>}</p>}
  </div>;
}

export default function DeveloperUpdates({ developerId, name, logo }: { developerId: string; name: string; logo: string | null }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [limit, setLimit] = useState(10);
  const [body, setBody] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [editing, setEditing] = useState<Update | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const key = ['developer-updates', developerId];
  const { data: manager = false } = useQuery({ queryKey: ['developer-channel-permission', developerId, user?.id], enabled: !!user, queryFn: async () => {
    const { data, error } = await supabase.rpc('can_manage_developer_channel', { _developer_id: developerId });
    if (error) throw error;
    return data === true;
  }});
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: [...key, limit], queryFn: async () => {
    const { data, error, count } = await supabase.from('developer_updates').select('*', { count: 'exact' }).eq('developer_id', developerId).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).range(0, limit - 1);
    if (error) throw error;
    return { posts: data ?? [], count: count ?? 0 };
  }});
  const save = async () => {
    if (!user || !manager || !body.trim()) return;
    setBusy(true);
    const result = editing ? await supabase.from('developer_updates').update({ body: body.trim(), images }).eq('id', editing.id)
      : await supabase.from('developer_updates').insert({ developer_id: developerId, author_id: user.id, body: body.trim(), images });
    setBusy(false);
    if (result.error) { toast.error(result.error.message); return; }
    setBody(''); setImages([]); setEditing(null);
    await client.invalidateQueries({ queryKey: key });
    toast.success(editing ? 'Publicação atualizada' : 'Publicação criada');
  };
  const change = async (post: Update, payload: { is_pinned?: boolean; comments_open?: boolean }) => {
    const { error } = await supabase.from('developer_updates').update(payload).eq('id', post.id);
    if (error) { toast.error(error.message); return; }
    await client.invalidateQueries({ queryKey: key });
  };
  const remove = async (post: Update) => {
    if (!window.confirm('Excluir a publicação e seus comentários?')) return;
    const { error } = await supabase.from('developer_updates').delete().eq('id', post.id);
    if (error) { toast.error(error.message); return; }
    await removeStoredImages(post.images);
    await client.invalidateQueries({ queryKey: key });
  };
  const cancelDraft = () => {
    void removeStoredImages(unusedImages(images, editing?.images ?? []));
    setEditing(null);
    setBody('');
    setImages([]);
  };
  return <section className="mt-10 border-t border-border pt-6 max-w-3xl">
    <h2 className="text-xl font-bold mb-4">Publicações oficiais</h2>
    {manager && <div className="space-y-3 mb-6 border-b border-border pb-6">
      <Textarea aria-label="Texto da publicação oficial" placeholder={`Novidades de ${name}…`} maxLength={10000} rows={4} value={body} onChange={e => setBody(e.target.value)} />
      <ImageGalleryField label="Fotos da publicação" value={images} onChange={setImages} maxImages={4} folder={`developer-updates/${developerId}`} />
      <div className="flex justify-end gap-2">
        {(editing || body || images.length > 0) && <Button variant="ghost" onClick={cancelDraft}>{editing ? 'Cancelar edição' : 'Descartar'}</Button>}
        <Button onClick={save} disabled={busy || !body.trim()}><Send className="h-4 w-4 mr-2" />{editing ? 'Salvar publicação' : 'Publicar'}</Button>
      </div>
    </div>}
    {isLoading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
    {isError && <Button variant="outline" onClick={() => refetch()}>Tentar carregar publicações novamente</Button>}
    {!isLoading && !isError && !data?.posts.length && <p className="text-sm text-muted-foreground py-4">Nenhuma publicação oficial por enquanto.</p>}
    <div className="space-y-4">
      {data?.posts.map(post => <article key={post.id} className="border border-border rounded-lg p-4 bg-card">
        <div className="flex gap-3 items-start mb-3">
          {logo && <img src={logo} alt="" className="w-10 h-10 object-cover rounded-md shrink-0" />}
          <div className="flex-1 min-w-0"><p className="font-semibold break-words">{name} <Badge variant="secondary">Oficial</Badge></p><time className="text-xs text-muted-foreground">{dateLabel(post.created_at)}{post.updated_at !== post.created_at && ' · editado'}</time></div>
          {post.is_pinned && <Pin className="h-4 w-4 text-primary shrink-0" aria-label="Publicação fixada" />}
        </div>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{post.body}</p>
        {!!post.images.length && <div className="grid grid-cols-2 gap-2 mt-3">{post.images.map(src => <a key={src} href={src} target="_blank" rel="noopener noreferrer"><img src={src} alt={`Imagem publicada por ${name}`} loading="lazy" className="w-full aspect-video object-contain rounded-md bg-muted" /></a>)}</div>}
        <div className="flex flex-wrap items-center justify-between mt-3 gap-2">
          <Button variant="ghost" size="sm" aria-expanded={expanded === post.id} onClick={() => setExpanded(expanded === post.id ? null : post.id)}><MessageSquare className="h-4 w-4 mr-2" />Comentários</Button>
          {manager && <div className="flex gap-1">
            <Button variant="ghost" size="icon" aria-label="Editar publicação" title="Editar publicação" onClick={() => { setEditing(post); setBody(post.body); setImages(post.images); }}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" aria-label={post.is_pinned ? 'Desafixar publicação' : 'Fixar publicação'} title={post.is_pinned ? 'Desafixar publicação' : 'Fixar publicação'} onClick={() => change(post, { is_pinned: !post.is_pinned })}><Pin className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" aria-label={post.comments_open ? 'Encerrar comentários' : 'Reabrir comentários'} title={post.comments_open ? 'Encerrar comentários' : 'Reabrir comentários'} onClick={() => change(post, { comments_open: !post.comments_open })}>{post.comments_open ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}</Button>
            <Button variant="ghost" size="icon" aria-label="Excluir publicação" title="Excluir publicação" onClick={() => remove(post)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>}
        </div>
        {expanded === post.id && <Comments post={post} manager={manager} />}
      </article>)}
    </div>
    {data && data.count > limit && <Button variant="outline" className="mt-4" onClick={() => setLimit(value => value + 10)}>Mais publicações</Button>}
  </section>;
}