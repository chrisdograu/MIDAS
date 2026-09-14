import { useEffect, useMemo, useState } from 'react';
import { Users2, Loader2, Search, Ban, CheckCircle2, Download, User, Users, Shield, Calendar, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { adminLog, exportCsv } from '../lib/adminLog';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDate } from '@/lib/format';

interface Grupo {
  id: string;
  name: string;
  description: string | null;
  owner_id: string | null;
  created_at: string;
  is_disabled: boolean;
  disabled_reason: string | null;
  owner_name: string;
  members: number;
  denuncias: number;
}

interface Member {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  role: 'admin' | 'member' | 'observer';
  joined_at: string;
}

export default function GruposAdmin() {
  const [rows, setRows] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [target, setTarget] = useState<Grupo | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  
  // GAP-D151: Visualização de membros
  const [membersDialog, setMembersDialog] = useState<Grupo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: groups, error } = await supabase
      .from('groups')
      .select('id, name, description, owner_id, created_at, is_disabled, disabled_reason')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const ownerIds = [...new Set((groups || []).map(g => g.owner_id).filter(Boolean))] as string[];
    const { data: profiles } = ownerIds.length
      ? await supabase.from('profiles').select('id, display_name').in('id', ownerIds)
      : { data: [] as any[] };
    const ownerMap = new Map<string, string>((profiles || []).map(p => [p.id, p.display_name || 'Usuário'] as [string, string]));

    const { data: members } = await supabase.from('group_members').select('group_id');
    const count = new Map<string, number>();
    (members || []).forEach(m => count.set(m.group_id, (count.get(m.group_id) || 0) + 1));

    const { data: denuncias } = await supabase
      .from('denuncias').select('target_id').eq('target_type', 'grupo').eq('status', 'pending');
    const denCount = new Map<string, number>();
    (denuncias || []).forEach(d => denCount.set(d.target_id, (denCount.get(d.target_id) || 0) + 1));

    setRows((groups || []).map(g => ({
      ...g,
      owner_name: (g.owner_id ? (ownerMap.get(g.owner_id) || 'Usuário') : '—') as string,
      members: count.get(g.id) || 0,
      denuncias: denCount.get(g.id) || 0,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // GAP-D151: Carregar membros do grupo
  const loadMembers = async (grupo: Grupo) => {
    setMembersDialog(grupo);
    setLoadingMembers(true);
    
    const { data, error } = await supabase
      .from('group_members')
      .select('user_id, role, joined_at, profiles:user_id(display_name, avatar_url)')
      .eq('group_id', grupo.id)
      .order('joined_at', { ascending: false });
    
    setLoadingMembers(false);
    if (error) { toast.error('Erro ao carregar membros'); return; }
    
    setMembers((data || []).map((m: any) => ({
      id: m.user_id,
      user_id: m.user_id,
      display_name: m.profiles?.display_name || 'Usuário',
      avatar_url: m.profiles?.avatar_url || null,
      role: m.role as 'admin' | 'member' | 'observer',
      joined_at: m.joined_at,
    })));
  };

  const filtered = useMemo(() => rows.filter(g => {
    if (statusFilter === 'ativos' && g.is_disabled) return false;
    if (statusFilter === 'desativados' && !g.is_disabled) return false;
    if (statusFilter === 'denunciados' && g.denuncias === 0) return false;
    if (search) {
      const s = search.toLowerCase();
      if (![g.name, g.description, g.owner_name].some(v => (v || '').toLowerCase().includes(s))) return false;
    }
    return true;
  }), [rows, search, statusFilter]);

  // GAP-D152: adminLog
  const confirmAction = async () => {
    if (!target || reason.trim().length < 5) return;
    setSaving(true);
    const { error } = await supabase.rpc('admin_set_group_disabled', {
      _group_id: target.id,
      _disabled: !target.is_disabled,
      _reason: reason.trim(),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    
    await adminLog({
      action: target.is_disabled ? 'reativar_grupo' : 'desativar_grupo',
      entity: 'groups',
      entity_id: target.id,
      reason: reason.trim(),
      payload: {
        grupo: target.name,
        membros: target.members,
        acao: target.is_disabled ? 'Reativado' : 'Desativado',
      },
    });
    
    toast.success(target.is_disabled ? 'Grupo reativado' : 'Grupo desativado');
    setTarget(null); setReason('');
    load();
  };

  // GAP-D151: Remover membro do grupo
  const removeMember = async (groupId: string, userId: string, displayName: string) => {
    // TODO: trocar confirm() nativo por AlertDialog.
    if (!confirm(`Remover ${displayName} do grupo?`)) return;
    
    const { error } = await supabase
      .from('group_members')
      .delete()
      .match({ group_id: groupId, user_id: userId });
    
    if (error) { toast.error('Erro ao remover membro'); return; }
    
    await adminLog({
      action: 'remover_membro_grupo',
      entity: 'group_members',
      reason: `Membro ${displayName} removido do grupo`,
      payload: { group_id: groupId, user_id: userId, display_name: displayName },
    });
    
    toast.success('Membro removido');
    if (membersDialog) loadMembers(membersDialog);
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader
        icon={Users2}
        title="Grupos da Comunidade"
        subtitle={`${rows.length} grupos · ${rows.filter(g => g.is_disabled).length} desativados · ${rows.filter(g => g.denuncias > 0).length} com denúncia`}
        actions={
          <Button variant="outline" size="sm" onClick={() => exportCsv('grupos.csv', filtered)}>
            <Download className="h-4 w-4 mr-1" /> Exportar
          </Button>
        }
      />

      <Card className="border-border/50">
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <Label className="text-xs">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="nome, descrição, dono..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Situação</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ativos">Ativos</SelectItem>
                <SelectItem value="desativados">Desativados</SelectItem>
                <SelectItem value="denunciados">Com denúncia pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <EstadoVazio titulo="Nenhum grupo encontrado" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead>Grupo</TableHead>
                  <TableHead>Dono</TableHead>
                  <TableHead className="text-center">Membros</TableHead>
                  <TableHead className="text-center">Denúncias</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-center">Situação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(g => (
                  <TableRow key={g.id} className="border-border hover:bg-muted/30">
                    <TableCell className="max-w-[260px]">
                      <p className="font-medium truncate">{g.name}</p>
                      {g.description && <p className="text-xs text-muted-foreground truncate">{g.description}</p>}
                      {g.is_disabled && g.disabled_reason && (
                        <p className="text-xs text-destructive mt-0.5 truncate">Motivo: {g.disabled_reason}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{g.owner_name}</TableCell>
                    <TableCell className="text-center">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2 text-xs"
                        onClick={() => loadMembers(g)}
                      >
                        <Users className="h-3 w-3 mr-1" />
                        {g.members}
                      </Button>
                    </TableCell>
                    <TableCell className="text-center">
                      {g.denuncias > 0
                        ? <Badge className="border-destructive/50 text-destructive bg-destructive/10">{g.denuncias} pendente(s)</Badge>
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(g.created_at)}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={g.is_disabled ? 'border-destructive/50 text-destructive bg-destructive/10' : 'border-success/50 text-success bg-success/10'}>
                        {g.is_disabled ? 'Desativado' : 'Ativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => { setTarget(g); setReason(''); }}>
                        {g.is_disabled
                          ? <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Reativar</>
                          : <><Ban className="h-3.5 w-3.5 mr-1" />Desativar</>}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* GAP-D151: Dialog de membros */}
      <Dialog open={!!membersDialog} onOpenChange={(o) => { if (!o) setMembersDialog(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users2 className="h-5 w-5 text-primary" /> Membros — {membersDialog?.name}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{members.length} membros no total</p>
          </DialogHeader>
          {loadingMembers ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : members.length === 0 ? (
            <EstadoVazio titulo="Nenhum membro" />
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {members.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                        {m.display_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{m.display_name}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {m.role === 'admin' && <Shield className="h-3 w-3 mr-0.5 text-warning" />}
                          {m.role === 'admin' ? 'Admin' : m.role === 'observer' ? 'Observador' : 'Membro'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{formatDate(m.joined_at)}</span>
                      </div>
                    </div>
                  </div>
                  {m.role !== 'admin' && (
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-destructive h-7 text-xs"
                      onClick={() => removeMember(membersDialog!.id, m.user_id, m.display_name)}
                    >
                      <Ban className="h-3 w-3 mr-1" /> Remover
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!target} onOpenChange={o => { if (!o) { setTarget(null); setReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{target?.is_disabled ? 'Reativar grupo' : 'Desativar grupo'}</AlertDialogTitle>
            <AlertDialogDescription>
              {target?.is_disabled
                ? `O grupo "${target?.name}" voltará a funcionar para os membros.`
                : `O grupo "${target?.name}" deixará de funcionar para os membros. A ação fica registrada na auditoria.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <Label>Justificativa (mínimo 5 caracteres) <span className="text-destructive">*</span></Label>
            <Textarea 
              rows={3} 
              value={reason} 
              onChange={e => setReason(e.target.value)} 
              placeholder="Ex: nome ofensivo e spam recorrente..." 
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              disabled={saving || reason.trim().length < 5} 
              onClick={e => { e.preventDefault(); confirmAction(); }}
            >
              {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Salvando…</> : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}