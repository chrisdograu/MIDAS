import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Award, CheckCircle, XCircle, Clock, Ban, Eye, Loader2, Download, RefreshCw, ShieldOff, AlertTriangle, Bell, History } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import SelectSimples from '@/components/SelectSimples';
import BuscaInput from '@/components/BuscaInput';
import { supabase } from '@/integrations/supabase/client';
import EstadoVazio from '@/components/EstadoVazio';
import { toast } from 'sonner';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { adminLog, exportCsv } from '../lib/adminLog';
import { certStatusLabels, certStatusColors } from '../mockData';
import { formatDate } from '@/lib/format';

interface Cert {
  id: string;
  user_id: string;
  user_name: string;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
  reason: string | null;
  expires_at: string | null;
}

/** Certificado vencido continua com status `ativo` no banco — a UI precisa mostrar isso. */
function estadoEfetivo(c: Cert): string {
  if (c.status === 'ativo' && c.expires_at && new Date(c.expires_at) < new Date()) return 'expirado';
  return c.status;
}

const ABAS = ['pendentes', 'ativos', 'todos'] as const;

export default function Certificados() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') ?? '';
  const aba = (ABAS as readonly string[]).includes(tabParam) ? tabParam : 'pendentes';
  const [certs, setCerts] = useState<Cert[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const [selected, setSelected] = useState<Cert | null>(null);
  const [decision, setDecision] = useState('');
  const [validity, setValidity] = useState('12');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const [revogar, setRevogar] = useState<Cert | null>(null);
  const [motivoRevogar, setMotivoRevogar] = useState('');

  // GAP-D70: Histórico
  const [historyOpen, setHistoryOpen] = useState<Cert | null>(null);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchCerts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('certificados')
      .select('*')
      .order('requested_at', { ascending: false });
    if (error) {
      toast.error(`Erro ao carregar certificados: ${error.message}`);
      setCerts([]);
      setLoading(false);
      return;
    }
    const rows = data || [];
    const userIds = [...new Set(rows.map(c => c.user_id))];
    let profileMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, display_name').in('id', userIds);
      profileMap = new Map<string, string>(profiles?.map(p => [p.id, p.display_name || 'Usuário']) || []);
    }
    setCerts(rows.map(c => ({ ...c, user_name: profileMap.get(c.user_id) || 'Usuário' })));
    setLoading(false);
  };

  useEffect(() => { fetchCerts(); }, []);

  // GAP-D69: Notificar usuário
  const notifyUser = async (userId: string, title: string, body: string) => {
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'certificate',
      title,
      body,
      reference_type: 'certificado',
    });
  };

  const handleDecision = async () => {
    if (!selected || !decision) return;
    if (decision === 'recusado' && !reason.trim()) {
      toast.error('Informe o motivo da recusa.');
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const update: Record<string, any> = {
      status: decision,
      reason: reason.trim() || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id || null,
    };
    let expiraEm: string | null = null;
    if (decision === 'ativo') {
      const months = Number(validity) || 12;
      const exp = new Date();
      exp.setMonth(exp.getMonth() + months);
      expiraEm = exp.toISOString();
      update.expires_at = expiraEm;
    }
    const { error } = await supabase.from('certificados').update(update as any).eq('id', selected.id);
    setSaving(false);
    if (error) {
      toast.error(`Erro na operação: ${error.message}`);
      return;
    }
    await adminLog({
      action: decision === 'ativo' ? 'certificado_aprovado' : 'certificado_recusado',
      entity: 'certificados',
      entity_id: selected.id,
      reason: reason.trim() || null,
      payload: {
        antes: { status: selected.status, expires_at: selected.expires_at },
        depois: { status: decision, expires_at: expiraEm ?? selected.expires_at },
        vendedor: selected.user_name,
        user_id: selected.user_id,
      },
    });

    // GAP-D69: Notificar usuário
    const statusText = decision === 'ativo' ? 'aprovado' : 'recusado';
    await notifyUser(
      selected.user_id,
      `Certificado ${statusText}`,
      `Sua solicitação de certificado foi ${statusText}${reason.trim() ? `: ${reason.trim()}` : ''}`
    );

    toast.success(decision === 'ativo' ? 'Certificado aprovado e usuário notificado!' : 'Certificado recusado');
    setAnalyzeOpen(false);
    setSelected(null);
    setDecision('');
    setReason('');
    fetchCerts();
  };

  const confirmarRevogacao = async () => {
    if (!revogar) return;
    if (!motivoRevogar.trim()) {
      toast.error('O motivo da revogação é obrigatório.');
      return;
    }
    const alvo = revogar;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('certificados')
      .update({
        status: 'revogado',
        reason: motivoRevogar.trim(),
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id || null,
      } as any)
      .eq('id', alvo.id);
    if (error) {
      toast.error(`Erro ao revogar: ${error.message}`);
      return;
    }
    await adminLog({
      action: 'certificado_revogado',
      entity: 'certificados',
      entity_id: alvo.id,
      reason: motivoRevogar.trim(),
      payload: {
        antes: { status: alvo.status, expires_at: alvo.expires_at },
        depois: { status: 'revogado' },
        vendedor: alvo.user_name,
        user_id: alvo.user_id,
      },
    });

    // GAP-D69: Notificar revogação
    await notifyUser(
      alvo.user_id,
      'Certificado revogado',
      `Seu certificado foi revogado. Motivo: ${motivoRevogar.trim()}`
    );

    toast.success('Certificado revogado — o selo sai do perfil do vendedor.');
    setRevogar(null);
    setMotivoRevogar('');
    fetchCerts();
  };

  // GAP-D71: Renovar certificado
  const renovar = async (c: Cert, meses: number) => {
    const base = c.expires_at && new Date(c.expires_at) > new Date() ? new Date(c.expires_at) : new Date();
    base.setMonth(base.getMonth() + meses);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('certificados')
      .update({
        status: 'ativo',
        expires_at: base.toISOString(),
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id || null,
      } as any)
      .eq('id', c.id);
    if (error) {
      toast.error(`Erro ao renovar: ${error.message}`);
      return;
    }
    await adminLog({
      action: 'certificado_renovado',
      entity: 'certificados',
      entity_id: c.id,
      reason: `Renovação de ${meses} meses`,
      payload: {
        antes: { expires_at: c.expires_at },
        depois: { expires_at: base.toISOString() },
        vendedor: c.user_name,
        user_id: c.user_id,
      },
    });

    await notifyUser(
      c.user_id,
      'Certificado renovado',
      `Seu certificado foi renovado por ${meses} meses. Nova validade: ${formatDate(base.toISOString())}`
    );

    toast.success(`Validade estendida até ${formatDate(base.toISOString())}`);
    fetchCerts();
  };

  // GAP-D70: Abrir histórico
  const openHistory = async (c: Cert) => {
    setHistoryOpen(c);
    setLoadingHistory(true);
    const { data } = await supabase
      .from('admin_logs')
      .select('*')
      .eq('entity', 'certificados')
      .eq('entity_id', c.id)
      .order('created_at', { ascending: false })
      .limit(30);
    setHistoryLogs(data || []);
    setLoadingHistory(false);
  };

  const pendentes = useMemo(() => certs.filter(c => c.status === 'pendente'), [certs]);
  const ativos = useMemo(() => certs.filter(c => estadoEfetivo(c) === 'ativo'), [certs]);
  const expirados = useMemo(() => certs.filter(c => estadoEfetivo(c) === 'expirado'), [certs]);

  const counts = {
    pendente: pendentes.length,
    ativo: ativos.length,
    expirado: expirados.length,
    recusado: certs.filter(c => c.status === 'recusado').length,
    revogado: certs.filter(c => c.status === 'revogado').length,
  };

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return certs.filter(c => {
      const efetivo = estadoEfetivo(c);
      if (filtroStatus !== 'todos' && efetivo !== filtroStatus) return false;
      if (!termo) return true;
      return (
        c.user_name.toLowerCase().includes(termo) ||
        (c.reason || '').toLowerCase().includes(termo) ||
        c.user_id.toLowerCase().includes(termo)
      );
    });
  }, [certs, busca, filtroStatus]);

  const exportar = () => {
    if (filtrados.length === 0) {
      toast.error('Nada para exportar com os filtros atuais.');
      return;
    }
    exportCsv('certificados.csv', filtrados.map(c => ({
      vendedor: c.user_name,
      status: certStatusLabels[estadoEfetivo(c)] || estadoEfetivo(c),
      solicitado_em: formatDate(c.requested_at),
      revisado_em: c.reviewed_at ? formatDate(c.reviewed_at) : '',
      expira_em: c.expires_at ? formatDate(c.expires_at) : '',
      justificativa: c.reason || '',
    })));
  };

  if (loading) {
    return <div className="p-6 flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const cards = [
    { label: 'Pendentes', count: counts.pendente, icon: Clock, color: 'text-warning', bg: 'bg-warning/10' },
    { label: 'Ativos', count: counts.ativo, icon: CheckCircle, color: 'text-success', bg: 'bg-success/10' },
    { label: 'Expirados', count: counts.expirado, icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
    { label: 'Recusados', count: counts.recusado, icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
    { label: 'Revogados', count: counts.revogado, icon: Ban, color: 'text-destructive', bg: 'bg-destructive/10' },
  ];

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader
        icon={Award}
        title="Certificados"
        subtitle="Aval da loja para vendedores do marketplace C2C"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchCerts} className="gap-1">
              <RefreshCw className="h-4 w-4" /> Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={exportar} className="gap-1">
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {cards.map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="py-4 px-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.bg}`}><s.icon className={`h-5 w-5 ${s.color}`} /></div>
              <div>
                <p className="text-2xl font-bold">{s.count}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={aba} onValueChange={(v) => setSearchParams({ tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="pendentes">Pendentes ({pendentes.length})</TabsTrigger>
          <TabsTrigger value="ativos">Ativos ({ativos.length})</TabsTrigger>
          <TabsTrigger value="todos">Todos</TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes" className="mt-4">
          {pendentes.length === 0 ? (
            <Card className="border-border/50"><CardContent className="p-0">
              <EstadoVazio titulo="Nenhuma solicitação pendente" descricao="Novos pedidos de certificado aparecem aqui." />
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {pendentes.map(c => (
                <Card key={c.id} className="border-border/50 border-l-4 border-l-warning">
                  <CardContent className="py-4 px-5 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{c.user_name}</p>
                      <p className="text-xs text-muted-foreground">Solicitado em {formatDate(c.requested_at)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openHistory(c)} title="Histórico">
                        <History className="h-4 w-4 mr-1" /> Histórico
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => { setSelected(c); setAnalyzeOpen(true); }}>
                        <Eye className="h-4 w-4 mr-1" />Analisar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ativos" className="mt-4 space-y-3">
          {ativos.length === 0 && expirados.length === 0 ? (
            <Card className="border-border/50"><CardContent className="p-0">
              <EstadoVazio titulo="Nenhum certificado ativo" descricao="Aprove uma solicitação pendente para conceder o selo." />
            </CardContent></Card>
          ) : (
            [...ativos, ...expirados].map(c => {
              const efetivo = estadoEfetivo(c);
              return (
                <Card key={c.id} className={`border-border/50 border-l-4 ${efetivo === 'expirado' ? 'border-l-warning' : 'border-l-success'}`}>
                  <CardContent className="py-4 px-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold flex items-center gap-2">
                        {c.user_name}
                        <Badge className={certStatusColors[efetivo]}>{certStatusLabels[efetivo]}</Badge>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.expires_at
                          ? efetivo === 'expirado'
                            ? `Venceu em ${formatDate(c.expires_at)}`
                            : `Válido até ${formatDate(c.expires_at)}`
                          : 'Sem data de expiração'}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => openHistory(c)} className="gap-1">
                        <History className="h-4 w-4" /> Histórico
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => renovar(c, 12)} className="gap-1">
                        <RefreshCw className="h-4 w-4" /> +12 meses
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => renovar(c, 6)} className="gap-1">
                        <RefreshCw className="h-4 w-4" /> +6 meses
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => { setRevogar(c); setMotivoRevogar(''); }} className="gap-1">
                        <ShieldOff className="h-4 w-4" /> Revogar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="todos" className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <BuscaInput
              value={busca}
              onChange={setBusca}
              placeholder="Buscar por vendedor ou justificativa..."
              className="flex-1 min-w-[240px]"
            />
            <SelectSimples
              value={filtroStatus}
              onChange={setFiltroStatus}
              label="Filtrar por status"
              className="w-[180px]"
              options={[
                { value: 'todos', label: 'Todos os status' },
                { value: 'pendente', label: 'Pendente' },
                { value: 'ativo', label: 'Ativo' },
                { value: 'expirado', label: 'Expirado' },
                { value: 'recusado', label: 'Recusado' },
                { value: 'revogado', label: 'Revogado' },
              ]}
            />
          </div>

          <Card className="border-border/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow className="border-border">
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Solicitado</TableHead>
                  <TableHead>Revisado</TableHead>
                  <TableHead>Justificativa</TableHead>
                  <TableHead>Expira</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtrados.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="p-0">
                      <EstadoVazio
                        titulo={certs.length === 0 ? 'Nenhum certificado registrado' : 'Nenhum resultado'}
                        descricao={certs.length === 0 ? undefined : 'Ajuste a busca ou o filtro de status.'}
                      />
                    </TableCell></TableRow>
                  ) : filtrados.map(c => {
                    const efetivo = estadoEfetivo(c);
                    return (
                      <TableRow key={c.id} className="border-border hover:bg-muted/30">
                        <TableCell className="font-medium text-sm">{c.user_name}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={certStatusColors[efetivo]}>{certStatusLabels[efetivo] || efetivo}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(c.requested_at)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.reviewed_at ? formatDate(c.reviewed_at) : '—'}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{c.reason || '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.expires_at ? formatDate(c.expires_at) : '—'}</TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openHistory(c)} title="Histórico">
                            <History className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* GAP-D68: Dialog de análise com justificativa obrigatória */}
      <Dialog open={analyzeOpen} onOpenChange={o => { setAnalyzeOpen(o); if (!o) { setSelected(null); setDecision(''); setReason(''); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Analisar Solicitação</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Vendedor</p>
                <p className="font-semibold">{selected.user_name}</p>
                <p className="text-xs text-muted-foreground mt-1">Solicitado em {formatDate(selected.requested_at)}</p>
              </div>
              <div className="space-y-2">
                <Label>Decisão</Label>
                <SelectSimples
                  value={decision}
                  onChange={setDecision}
                  label="Decisão"
                  options={[
                    { value: 'ativo', label: 'Aprovar' },
                    { value: 'recusado', label: 'Recusar' },
                  ]}
                />
              </div>
              {decision === 'ativo' && (
                <div className="space-y-2">
                  <Label>Validade</Label>
                  <SelectSimples
                    value={validity}
                    onChange={setValidity}
                    label="Validade do certificado"
                    options={[
                      { value: '6', label: '6 meses' },
                      { value: '12', label: '1 ano' },
                      { value: '24', label: '2 anos' },
                    ]}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>
                  Justificativa {decision === 'recusado' && <span className="text-destructive">*</span>}
                </Label>
                <Textarea
                  placeholder={decision === 'recusado' ? 'Obrigatório: motivo da recusa' : 'Motivo da decisão (opcional)'}
                  rows={2}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                />
                {decision === 'recusado' && reason.trim().length < 3 && (
                  <p className="text-xs text-destructive">Mínimo 3 caracteres</p>
                )}
              </div>
              <Button 
                className="w-full" 
                onClick={handleDecision} 
                disabled={saving || !decision || (decision === 'recusado' && reason.trim().length < 3)}
              >
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Confirmar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* GAP-D70: Histórico Dialog */}
      <Dialog open={!!historyOpen} onOpenChange={o => { if (!o) setHistoryOpen(null); }}>
        <DialogContent className="max-w-xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Histórico — {historyOpen?.user_name}</DialogTitle>
          </DialogHeader>
          {loadingHistory ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : historyLogs.length === 0 ? (
            <EstadoVazio titulo="Nenhuma alteração registrada" />
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {historyLogs.map(log => (
                <div key={log.id} className="bg-card border border-border rounded-lg p-3">
                  <p className="text-sm font-medium">{log.action?.replace(/_/g, ' ') || 'Ação'}</p>
                  <p className="text-xs text-muted-foreground">{log.reason || 'Sem motivo'}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(log.created_at).toLocaleString('pt-BR')}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!revogar} onOpenChange={o => { if (!o) { setRevogar(null); setMotivoRevogar(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar certificado de {revogar?.user_name}</AlertDialogTitle>
            <AlertDialogDescription>
              O selo sai do perfil e o vendedor volta ao limite de anúncios ativos de conta não certificada.
              O motivo é obrigatório e fica registrado na auditoria. O usuário será notificado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Motivo da revogação <span className="text-destructive">*</span></Label>
            <Textarea
              value={motivoRevogar}
              onChange={e => setMotivoRevogar(e.target.value)}
              placeholder="Motivo da revogação (obrigatório)"
              rows={3}
            />
            {motivoRevogar.trim().length < 3 && (
              <p className="text-xs text-destructive">Mínimo 3 caracteres</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={e => { e.preventDefault(); confirmarRevogacao(); }} 
              disabled={motivoRevogar.trim().length < 3}
            >
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}