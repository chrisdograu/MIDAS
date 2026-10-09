import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

export default function DeveloperChannelAccess({ developerId }: { developerId: string }) {
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  const key = ['developer-channel-access', developerId];
  const { data = [], isError } = useQuery({ queryKey: key, queryFn: async () => {
    const { data, error } = await supabase.from('developer_channel_managers')
      .select('user_id, profiles!developer_channel_managers_user_id_fkey(username, display_name)').eq('developer_id', developerId);
    if (error) throw error;
    return data ?? [];
  }});
  const assign = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('admin_assign_developer_channel', { _developer_id: developerId, _username: username });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setUsername('');
    await client.invalidateQueries({ queryKey: key });
    toast.success('Gestão do canal concedida');
  };
  const revoke = async (userId: string) => {
    if (!window.confirm('Revogar a gestão deste canal?')) return;
    const { error } = await supabase.from('developer_channel_managers').delete().eq('developer_id', developerId).eq('user_id', userId);
    if (error) { toast.error(error.message); return; }
    await client.invalidateQueries({ queryKey: key });
    toast.success('Acesso revogado');
  };
  return <section className="space-y-3 border-t border-border pt-4 md:col-span-2">
    <Label htmlFor="channel-username">Gestores das publicações oficiais</Label>
    <div className="flex gap-2">
      <Input id="channel-username" placeholder="Nome de usuário (@usuario)" value={username} onChange={e => setUsername(e.target.value)} />
      <Button type="button" onClick={assign} disabled={busy || !username.trim()}><UserPlus className="h-4 w-4 mr-2" />Conceder</Button>
    </div>
    {isError && <p className="text-sm text-destructive">Não foi possível carregar os gestores.</p>}
    {data.map(item => <div key={item.user_id} className="flex items-center justify-between gap-2 text-sm">
      <span>{item.profiles?.display_name || item.profiles?.username || 'Conta cadastrada'} {item.profiles?.username && `(@${item.profiles.username})`}</span>
      <Button type="button" variant="ghost" size="icon" aria-label="Revogar acesso ao canal" title="Revogar acesso ao canal" onClick={() => revoke(item.user_id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
    </div>)}
  </section>;
}