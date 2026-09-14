import { useState, useEffect } from 'react';
import { Ticket, Plus, Search, Edit, Trash2, MoreHorizontal, Loader2, Download, Users, Calendar, Percent } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDate } from '@/lib/format';
import { adminLog } from '../lib/adminLog';

type Cupom = Tables<'cupons'> & { max_uses_per_user?: number | null; used_by?: string[] };

export default function Cupons() {
  const [search, setSearch] = useState('');
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Cupom | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const [fCode, setFCode] = useState('');
  const [fDiscount, setFDiscount] = useState('');
  const [fMaxUses, setFMaxUses] = useState('');
  const [fMaxUsesPerUser, setFMaxUsesPerUser] = useState('');
  const [fActive, setFActive] = useState(true);
  const [fValidUntil, setFValidUntil] = useState('');

  const fetchCupons = async () => {
    setLoading(true);
    const { data } = await supabase.from('cupons').select('*').order('created_at', { ascending: false });
    
    // GAP-D85: Buscar contagem de usos por usuário
    const cupomIds = (data || []).map(c => c.id);
    let usedByMap = new Map<string, string[]>();
    if (cupomIds.length > 0) {
      const { data: usages } = await supabase
        .from('cupom_usages')
        .select('cupom_id, user_id')
        .in('cupom_id', cupomIds);
      
      usages?.forEach(u => {
        const list = usedByMap.get(u.cupom_id) || [];
        list.push(u.user_id);
        usedByMap.set(u.cupom_id, list);
      });
    }
    
    setCupons((data || []).map(c => ({
      ...c,
      max_uses_per_user: c.max_uses_per_user || null,
      used_by: usedByMap.get(c.id) || [],
    })));
    setLoading(false);
  };

  useEffect(() => { fetchCupons(); }, []);

  const resetForm = () => {
    setFCode(''); setFDiscount(''); setFMaxUses(''); setFMaxUsesPerUser('');
    setFActive(true); setFValidUntil('');
    setSelected(null);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };
  const openEdit = (c: Cupom) => {
    setSelected(c);
    setFCode(c.code); setFDiscount(String(c.discount_percent)); 
    setFMaxUses(c.max_uses ? String(c.max_uses) : '');
    setFMaxUsesPerUser(c.max_uses_per_user ? String(c.max_uses_per_user) : '');
    setFActive(c.is_active); 
    setFValidUntil(c.valid_until ? c.valid_until.split('T')[0] : '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!fCode.trim() || !fDiscount) { toast({ title: 'Código e desconto obrigatórios', variant: 'destructive' }); return; }
    if (Number(fDiscount) < 1 || Number(fDiscount) > 100) { toast({ title: 'Desconto deve ser entre 1 e 100%', variant: 'destructive' }); return; }
    
    setSaving(true);
    const payload = {
      code: fCode.toUpperCase().trim(),
      discount_percent: Number(fDiscount),
      max_uses: fMaxUses ? Number(fMaxUses) : null,
      max_uses_per_user: fMaxUsesPerUser ? Number(fMaxUsesPerUser) : null,
      is_active: fActive,
      valid_until: fValidUntil ? new Date(fValidUntil).toISOString() : null,
    };
    
    if (selected) {
      const { error } = await supabase.from('cupons').update(payload).eq('id', selected.id);
      if (error) {
        setSaving(false);
        toast({ title: 'Erro ao atualizar cupom', description: error.message, variant: 'destructive' });
        return;
      }
      await adminLog({ 
        action: 'update_coupon', 
        entity: 'cupons', 
        entity_id: selected.id, 
        reason: `Cupom ${payload.code} atualizado`, 
        payload: { 
          antes: { code: selected.code, discount_percent: selected.discount_percent, max_uses: selected.max_uses, max_uses_per_user: selected.max_uses_per_user, is_active: selected.is_active, valid_until: selected.valid_until }, 
          depois: payload 
        } 
      });
      toast({ title: 'Cupom atualizado!' });
    } else {
      // GAP-D84: Verificar se código já existe
      const { data: existing } = await supabase.from('cupons').select('id').eq('code', payload.code);
      if (existing && existing.length > 0) {
        setSaving(false);
        toast({ title: 'Código já existe', description: 'Escolha um código diferente', variant: 'destructive' });
        return;
      }
      
      const { data: created, error } = await supabase.from('cupons').insert(payload).select('id').single();
      if (error) {
        setSaving(false);
        toast({ title: 'Erro ao criar cupom', description: error.message, variant: 'destructive' });
        return;
      }
      await adminLog({ 
        action: 'create_coupon', 
        entity: 'cupons', 
        entity_id: created?.id ?? null, 
        reason: `Cupom ${payload.code} criado`, 
        payload 
      });
      toast({ title: 'Cupom criado!' });
    }
    setSaving(false); setDialogOpen(false); resetForm(); fetchCupons();
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase.from('cupons').delete().eq('id', selected.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao excluir cupom', description: error.message, variant: 'destructive' });
      return;
    }
    await adminLog({ 
      action: 'delete_coupon', 
      entity: 'cupons', 
      entity_id: selected.id, 
      reason: `Cupom ${selected.code} excluído`, 
      payload: { code: selected.code, discount_percent: selected.discount_percent, uses_count: selected.uses_count } 
    });
    toast({ title: 'Cupom excluído' });
    setDeleteOpen(false); setSelected(null); fetchCupons();
  };

  const handleToggle = async (c: Cupom) => {
    const { error } = await supabase.from('cupons').update({ is_active: !c.is_active }).eq('id', c.id);
    if (error) {
      toast({ title: 'Erro ao alterar status', description: error.message, variant: 'destructive' });
      return;
    }
    await adminLog({ 
      action: c.is_active ? 'deactivate_coupon' : 'activate_coupon', 
      entity: 'cupons', 
      entity_id: c.id, 
      reason: `Cupom ${c.code} ${c.is_active ? 'desativado' : 'ativado'}`, 
      payload: { antes: { is_active: c.is_active }, depois: { is_active: !c.is_active } } 
    });
    toast({ title: c.is_active ? 'Cupom desativado' : 'Cupom ativado' });
    fetchCupons();
  };

  // GAP-D90: Exportar CSV
  const exportCSV = () => {
    setExporting(true);
    const headers = ['Código', 'Desconto', 'Usos', 'Máx. Usos', 'Por Usuário', 'Ativo', 'Validade', 'Criado em'];
    const rows = cupons.map(c => [
      c.code,
      `${c.discount_percent}%`,
      String(c.uses_count),
      c.max_uses ? String(c.max_uses) : '∞',
      c.max_uses_per_user ? String(c.max_uses_per_user) : '∞',
      c.is_active ? 'Sim' : 'Não',
      c.valid_until ? formatDate(c.valid_until) : 'Sem prazo',
      formatDate(c.created_at),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cupons_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
    toast({ title: 'CSV exportado com sucesso' });
  };

  const filtered = cupons.filter(c => c.code.toLowerCase().includes(search.toLowerCase()));

  // GAP-D86: Verificar validade
  const isExpired = (c: Cupom) => {
    if (!c.valid_until) return false;
    return new Date(c.valid_until) < new Date();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Ticket className="h-6 w-6 text-primary" /> Cupons de Desconto</h1>
          <p className="text-muted-foreground text-sm">{cupons.length} cupons cadastrados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} disabled={exporting}>
            <Download className="h-4 w-4 mr-2" />
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Exportar'}
          </Button>
          <Button className="bg-primary text-primary-foreground" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />Novo Cupom
          </Button>
        </div>
      </div>

      <Card className="border-border/50">
        <CardContent className="py-3 px-4 flex gap-3 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar cupom..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-0">
          {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead>Código</TableHead>
                  <TableHead className="text-center">Desconto</TableHead>
                  <TableHead className="text-center">Usos</TableHead>
                  <TableHead className="text-center">Máx.</TableHead>
                  <TableHead className="text-center">Por Usuário</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center w-16">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="p-0"><EstadoVazio titulo="Nenhum cupom encontrado" /></TableCell></TableRow>
                ) : filtered.map(c => {
                  const expired = isExpired(c);
                  return (
                    <TableRow key={c.id} className="border-border hover:bg-muted/30">
                      <TableCell className="font-mono font-bold text-primary">{c.code}</TableCell>
                      <TableCell className="text-center"><Badge variant="outline">{c.discount_percent}%</Badge></TableCell>
                      <TableCell className="text-center text-sm">{c.uses_count}</TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">{c.max_uses ?? '∞'}</TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">{c.max_uses_per_user ?? '∞'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.valid_until ? (
                          <span className={expired ? 'text-destructive' : ''}>
                            {formatDate(c.valid_until)}
                            {expired && <Badge className="ml-1 bg-destructive/15 text-destructive text-[10px]">Expirado</Badge>}
                          </span>
                        ) : 'Sem prazo'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={c.is_active && !expired ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}>
                          {c.is_active && !expired ? 'Ativo' : expired ? 'Expirado' : 'Inativo'}
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
                            <DropdownMenuItem onClick={() => openEdit(c)}><Edit className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggle(c)}>
                              {c.is_active ? 'Desativar' : 'Ativar'}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => { setSelected(c); setDeleteOpen(true); }}>
                              <Trash2 className="h-4 w-4 mr-2" />Excluir
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

      {/* Dialog de criação/edição */}
      <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{selected ? 'Editar Cupom' : 'Novo Cupom'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Código <span className="text-destructive">*</span></Label>
              <Input 
                placeholder="EX: GAMER20" 
                value={fCode} 
                onChange={e => setFCode(e.target.value.toUpperCase())} 
                className="uppercase" 
              />
            </div>
            <div className="space-y-2">
              <Label>Desconto (%) <span className="text-destructive">*</span></Label>
              <Input 
                type="number" 
                placeholder="10" 
                min={1} 
                max={100} 
                value={fDiscount} 
                onChange={e => setFDiscount(e.target.value)} 
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Limite de usos (total)</Label>
                <Input 
                  type="number" 
                  placeholder="100" 
                  value={fMaxUses} 
                  onChange={e => setFMaxUses(e.target.value)} 
                />
                <p className="text-[10px] text-muted-foreground">Vazio = ilimitado</p>
              </div>
              <div className="space-y-2">
                <Label>Limite por usuário</Label>
                <Input 
                  type="number" 
                  placeholder="1" 
                  value={fMaxUsesPerUser} 
                  onChange={e => setFMaxUsesPerUser(e.target.value)} 
                />
                <p className="text-[10px] text-muted-foreground">Vazio = ilimitado</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Válido até</Label>
              <Input 
                type="date" 
                value={fValidUntil} 
                onChange={e => setFValidUntil(e.target.value)} 
              />
              <p className="text-[10px] text-muted-foreground">Vazio = sem prazo de validade</p>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={fActive} onCheckedChange={setFActive} />
              <Label>Ativo</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
              <Button className="bg-primary text-primary-foreground" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cupom?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cupom "<b>{selected?.code}</b>"?
              {selected && selected.uses_count > 0 && (
                <span className="block mt-2 text-warning">
                  ⚠️ Este cupom já foi usado {selected.uses_count} vez(es). A exclusão será registrada no log.
                </span>
              )}
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