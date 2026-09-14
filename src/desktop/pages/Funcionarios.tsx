import { useState, useEffect } from 'react';
import { 
  UserCog, Plus, Search, Shield, User, MoreHorizontal, Edit, Trash2, 
  ToggleLeft, Loader2, Download, History, AlertCircle, Key,
  Award, Star, Settings
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { POSITION_LABELS, POSITION_PERMISSIONS, type EmployeePosition } from '@/hooks/useDesktopAuth';
import { formatDate } from '@/lib/format';
import { adminLog, exportCsv } from '../lib/adminLog';

interface Employee {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  phone: string | null;
  role: 'admin' | 'atendente';
  position: EmployeePosition | null;
  is_active: boolean;
  created_at: string;
  permissions: string[];
}

const POSITION_OPTIONS: { value: EmployeePosition; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'moderador', label: 'Moderador' },
  { value: 'atendente_marketplace', label: 'Atendente Marketplace' },
  { value: 'estoquista', label: 'Estoquista' },
  { value: 'atendente', label: 'Atendente' },
];

// GAP-D132: Mapeamento de permissões por cargo
const PERMISSION_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  produtos: 'Produtos',
  categorias: 'Categorias',
  estoque: 'Estoque',
  pedidos: 'Pedidos',
  clientes: 'Clientes',
  funcionarios: 'Funcionários',
  fornecedores: 'Fornecedores',
  cupons: 'Cupons',
  promocoes: 'Promoções',
  bundles: 'Bundles',
  jogos: 'Jogos',
  marketplace: 'Marketplace',
  biblioteca_social: 'Biblioteca Social',
  torneios: 'Torneios',
  moderacao: 'Moderação',
  denuncias: 'Denúncias',
  tickets: 'Tickets',
  notificacoes: 'Notificações',
  analytics: 'Analytics',
  logs: 'Logs',
  xp: 'XP e Recompensas',
  certificados: 'Certificados',
  integracoes: 'Integrações',
  configuracoes: 'Configurações',
};

export default function Funcionarios() {
  const [search, setSearch] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'admin' | 'atendente'>('atendente');
  const [formPosition, setFormPosition] = useState<EmployeePosition>('atendente');
  const [formReason, setFormReason] = useState('');

  const fetchEmployees = async () => {
    setLoading(true);
    const { data: roles } = await supabase
      .from('user_roles')
      .select('id, user_id, role, position')
      .in('role', ['admin', 'atendente']);

    if (!roles) { setLoading(false); return; }

    const userIds = roles.map(r => r.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, phone, created_at')
      .in('id', userIds);
    
    // TODO: SEGURANÇA — supabase.auth.admin.listUsers() exige service_role key e NÃO
    // deve ser chamado no client. Mover para Edge Function `list-employees` que
    // roda com service_role no servidor. Por ora, mantido só pra não quebrar a demo.
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const emailMap = new Map<string, string>();
    (authUsers as any)?.users?.forEach((u: any) => { emailMap.set(u.id, u.email || ''); });

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // GAP-D132: Calcular permissões baseadas no cargo
    const getPermissions = (position: EmployeePosition | null, role: string): string[] => {
      if (role === 'admin') return ['*'];
      if (position && POSITION_PERMISSIONS[position]) return POSITION_PERMISSIONS[position];
      return [];
    };

    const emps: Employee[] = roles.map(r => {
      const profile = profileMap.get(r.user_id);
      const perms = getPermissions(r.position, r.role);
      return {
        id: r.id,
        user_id: r.user_id,
        display_name: profile?.display_name || 'Sem nome',
        email: emailMap.get(r.user_id) || '',
        phone: profile?.phone || null,
        role: r.role as 'admin' | 'atendente',
        position: r.position as EmployeePosition | null,
        is_active: true,
        created_at: profile?.created_at || new Date().toISOString(),
        permissions: perms,
      };
    });

    setEmployees(emps);
    setLoading(false);
  };

  useEffect(() => { fetchEmployees(); }, []);

  const resetForm = () => {
    setFormName(''); setFormEmail(''); setFormPhone('');
    setFormPassword(''); setFormRole('atendente');
    setFormPosition('atendente'); setFormReason('');
    setSelectedEmployee(null);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (emp: Employee) => {
    setSelectedEmployee(emp);
    setFormName(emp.display_name);
    setFormEmail(emp.email);
    setFormPhone(emp.phone || '');
    setFormPassword('');
    setFormRole(emp.role);
    setFormPosition(emp.position || 'atendente');
    setFormReason('');
    setDialogOpen(true);
  };

  // GAP-D135: adminLog com justificativa
  const handleSave = async () => {
    if (!selectedEmployee && (!formEmail || !formPassword || formPassword.length < 6)) {
      toast({ title: 'Preencha email e senha (mín. 6 caracteres)', variant: 'destructive' });
      return;
    }
    if (selectedEmployee && !formReason.trim()) {
      toast({ title: 'Justificativa obrigatória para edição', variant: 'destructive' });
      return;
    }

    setSaving(true);

    if (selectedEmployee) {
      // Editar
      const { error: profErr } = await supabase
        .from('profiles')
        .update({ display_name: formName, phone: formPhone || null })
        .eq('id', selectedEmployee.user_id);
      if (profErr) {
        setSaving(false);
        toast({ title: 'Erro ao atualizar dados', description: profErr.message, variant: 'destructive' });
        return;
      }

      const roleValue = formPosition === 'admin' ? 'admin' : 'atendente';
      const { data, error } = await supabase.functions.invoke('manage-employee', {
        body: { action: 'update', user_id: selectedEmployee.user_id, role: roleValue, position: formPosition },
      });

      if (error || data?.error) {
        toast({ title: data?.error || error?.message || 'Erro ao atualizar', variant: 'destructive' });
      } else {
        await adminLog({
          action: 'update_employee',
          entity: 'user_roles',
          entity_id: selectedEmployee.user_id,
          reason: formReason,
          payload: {
            antes: { display_name: selectedEmployee.display_name, position: selectedEmployee.position, role: selectedEmployee.role },
            depois: { display_name: formName, position: formPosition, role: roleValue },
          },
        });
        toast({ title: 'Funcionário atualizado. Sessão revogada por segurança.' });
        setDialogOpen(false);
        fetchEmployees();
      }
      setSaving(false);
    } else {
      // Criar
      const { data, error } = await supabase.functions.invoke('manage-employee', {
        body: {
          action: 'create',
          email: formEmail,
          password: formPassword,
          display_name: formName,
          phone: formPhone || null,
          role: formPosition === 'admin' ? 'admin' : 'atendente',
          position: formPosition,
        },
      });

      if (error || data?.error) {
        toast({ title: data?.error || error?.message || 'Erro ao criar funcionário', variant: 'destructive' });
      } else {
        await adminLog({
          action: 'create_employee',
          entity: 'user_roles',
          entity_id: data?.user_id ?? null,
          reason: `Funcionário ${formName || formEmail} criado`,
          payload: { display_name: formName, email: formEmail, position: formPosition },
        });
        toast({ title: 'Funcionário criado com sucesso!' });
        setDialogOpen(false);
        fetchEmployees();
      }
      setSaving(false);
    }
  };

  // GAP-D134: Desativar com justificativa
  const handleDeactivate = async () => {
    if (!selectedEmployee) return;
    if (!deactivateReason.trim()) {
      toast({ title: 'Justificativa obrigatória', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const { error: err } = await supabase
      .from('user_roles')
      .update({ role: 'user' as any, position: null })
      .eq('id', selectedEmployee.id);
    
    if (err) {
      setSaving(false);
      toast({ title: 'Erro na operação', description: err.message, variant: 'destructive' });
      return;
    }

    await adminLog({
      action: 'deactivate_employee',
      entity: 'user_roles',
      entity_id: selectedEmployee.user_id,
      reason: deactivateReason,
      payload: {
        antes: { role: selectedEmployee.role, position: selectedEmployee.position },
        depois: { role: 'user', position: null },
        funcionario: selectedEmployee.display_name,
      },
    });

    toast({ title: `${selectedEmployee.display_name} desativado` });
    setDeactivateDialogOpen(false);
    setDeactivateReason('');
    setSelectedEmployee(null);
    fetchEmployees();
    setSaving(false);
  };

  // Reativar
  const handleReactivate = async (emp: Employee) => {
    if (!confirm(`Reativar ${emp.display_name} como atendente?`)) return;

    const { error: err } = await supabase
      .from('user_roles')
      .update({ role: 'atendente' as any, position: emp.position as any })
      .eq('id', emp.id);
    
    if (err) {
      toast({ title: 'Erro na operação', description: err.message, variant: 'destructive' });
      return;
    }

    await adminLog({
      action: 'activate_employee',
      entity: 'user_roles',
      entity_id: emp.user_id,
      reason: `Reativação de ${emp.display_name}`,
      payload: { antes: { role: emp.role }, depois: { role: 'atendente', position: emp.position } },
    });

    toast({ title: `${emp.display_name} reativado` });
    fetchEmployees();
  };

  const handleDelete = async () => {
    if (!selectedEmployee) return;
    setSaving(true);

    const { error } = await supabase.functions.invoke('manage-employee', {
      body: { action: 'delete', user_id: selectedEmployee.user_id },
    });

    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } else {
      await adminLog({
        action: 'delete_employee',
        entity: 'user_roles',
        entity_id: selectedEmployee.user_id,
        reason: `Funcionário ${selectedEmployee.display_name} excluído`,
        payload: { display_name: selectedEmployee.display_name, position: selectedEmployee.position, role: selectedEmployee.role },
      });
      toast({ title: 'Funcionário excluído' });
      fetchEmployees();
    }
    setSaving(false);
    setDeleteDialogOpen(false);
    setSelectedEmployee(null);
  };

  // Exportar
  const exportData = () => {
    setExporting(true);
    const data = employees.map(e => ({
      Nome: e.display_name,
      Email: e.email,
      Telefone: e.phone || '',
      Cargo: POSITION_LABELS[e.position as EmployeePosition] || e.position || e.role,
      Permissoes: e.permissions.includes('*') ? 'Todas' : e.permissions.map(p => PERMISSION_LABELS[p] || p).join(', '),
      Status: e.is_active ? 'Ativo' : 'Inativo',
      Criado_em: formatDate(e.created_at),
    }));
    exportCsv('funcionarios.csv', data);
    setExporting(false);
    toast({ title: 'Exportado com sucesso' });
  };

  const filtered = employees.filter(f =>
    f.display_name.toLowerCase().includes(search.toLowerCase()) ||
    f.email.toLowerCase().includes(search.toLowerCase())
  );

  const getPositionLabel = (pos: EmployeePosition | null, role: string) => {
    if (pos) return POSITION_LABELS[pos] || pos;
    return role === 'admin' ? 'Administrador' : 'Atendente';
  };

  const isActive = (emp: Employee) => emp.role === 'admin' || emp.role === 'atendente';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCog className="h-6 w-6 text-primary" /> Funcionários
          </h1>
          <p className="text-muted-foreground text-sm">{employees.length} funcionários cadastrados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportData} disabled={exporting}>
            <Download className="h-4 w-4 mr-1" />
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Exportar'}
          </Button>
          <Button className="bg-primary text-primary-foreground" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />Novo Funcionário
          </Button>
        </div>
      </div>

      <Card className="border-border/50">
        <CardContent className="py-3 px-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar funcionário..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Permissões</TableHead>
                  <TableHead>Desde</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center w-16">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum funcionário encontrado
                    </TableCell>
                  </TableRow>
                ) : filtered.map((f) => {
                  const active = isActive(f);
                  const perms = f.permissions.includes('*') 
                    ? ['🔓 Todas'] 
                    : f.permissions.map(p => PERMISSION_LABELS[p] || p);
                  return (
                    <TableRow key={f.id} className="border-border hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                              {f.display_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="font-medium text-sm">{f.display_name}</span>
                            <p className="text-xs text-muted-foreground">{f.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={f.role === 'admin' ? 'bg-accent/20 text-accent' : 'bg-primary/20 text-primary'}>
                          {f.role === 'admin' ? <Shield className="h-3 w-3 mr-1" /> : <User className="h-3 w-3 mr-1" />}
                          {getPositionLabel(f.position, f.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-0.5 max-w-[200px]">
                          {perms.slice(0, 3).map(p => (
                            <Badge key={p} variant="outline" className="text-[8px] py-0 h-4">{p}</Badge>
                          ))}
                          {perms.length > 3 && (
                            <Badge variant="outline" className="text-[8px] py-0 h-4">+{perms.length - 3}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(f.created_at)}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={active ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}>
                          {active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Mais ações">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(f)}>
                              <Edit className="h-4 w-4 mr-2" />Editar
                            </DropdownMenuItem>
                            {active ? (
                              <DropdownMenuItem onClick={() => { setSelectedEmployee(f); setDeactivateReason(''); setDeactivateDialogOpen(true); }}>
                                <ToggleLeft className="h-4 w-4 mr-2" />Desativar
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleReactivate(f)}>
                                <ToggleLeft className="h-4 w-4 mr-2" />Reativar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-destructive" onClick={() => { setSelectedEmployee(f); setDeleteDialogOpen(true); }}>
                              <Trash2 className="h-4 w-4 mr-2" />Excluir conta
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedEmployee ? 'Editar Funcionário' : 'Cadastrar Funcionário'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input placeholder="Nome" value={formName} onChange={e => setFormName(e.target.value)} />
            </div>
            {!selectedEmployee && (
              <>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" placeholder="email@midias.com" value={formEmail} onChange={e => setFormEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Senha Inicial</Label>
                  <Input type="password" placeholder="••••••••" value={formPassword} onChange={e => setFormPassword(e.target.value)} />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input placeholder="(11) 99999-0000" value={formPhone} onChange={e => setFormPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Select value={formPosition} onValueChange={(v) => setFormPosition(v as EmployeePosition)}>
                <SelectTrigger><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
                <SelectContent>
                  {POSITION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedEmployee && (
              <div className="space-y-2">
                <Label>Justificativa da alteração <span className="text-destructive">*</span></Label>
                <Textarea 
                  placeholder="Motivo da edição..." 
                  value={formReason} 
                  onChange={e => setFormReason(e.target.value)} 
                  rows={2} 
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
              <Button className="bg-primary text-primary-foreground" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* GAP-D134: Desativar com justificativa */}
      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar funcionário?</AlertDialogTitle>
            <AlertDialogDescription>
              O funcionário <b>{selectedEmployee?.display_name}</b> perderá acesso ao backoffice. A ação será registrada nos logs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Motivo da desativação <span className="text-destructive">*</span></Label>
            <Textarea 
              value={deactivateReason} 
              onChange={e => setDeactivateReason(e.target.value)} 
              placeholder="Descreva o motivo..." 
              rows={3} 
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate} className="bg-warning text-warning-foreground" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funcionário?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selectedEmployee?.display_name}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}