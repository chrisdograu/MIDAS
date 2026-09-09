import { useEffect, useState } from 'react';
import { Plug, Loader2, Plus, Send, Trash2, Download, Search, Pencil, Activity, CheckCircle2, XCircle, Clock, Zap, Settings } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { adminLog, exportCsv } from '../lib/adminLog';
import { useAdminTable, useFilteredSorted } from '../hooks/useAdminTable';
import EntityTimelineDrawer from '../components/EntityTimelineDrawer';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDateTime } from '@/lib/format';
import SelectSimples from '@/components/SelectSimples';

const EVENT_OPTIONS = [
  { value: 'order.created', label: '🛒 Pedido criado' },
  { value: 'order.confirmed', label: '✅ Pedido confirmado' },
  { value: 'order.shipped', label: '📦 Pedido enviado' },
  { value: 'order.delivered', label: '🚚 Pedido entregue' },
  { value: 'order.refunded', label: '💸 Pedido reembolsado' },
  { value: 'user.registered', label: '👤 Usuário registrado' },
  { value: 'user.verified', label: '✅ Usuário verificado' },
  { value: 'review.created', label: '⭐ Review criada' },
  { value: 'review.flagged', label: '🚩 Review sinalizada' },
  { value: 'denuncia.created', label: '⚠️ Denúncia criada' },
  { value: 'tournament.created', label: '🏆 Torneio criado' },
  { value: 'tournament.started', label: '🏆 Torneio iniciado' },
  { value: 'tournament.finished', label: '🏆 Torneio finalizado' },
  { value: 'certificate.requested', label: '📜 Certificado solicitado' },
  { value: 'certificate.approved', label: '✅ Certificado aprovado' },
  { value: 'custom', label: '🎯 Custom (payload livre)' },
];

const PAYLOAD_TEMPLATES: Record<string, string> = {
  'order.created': `{
  "event": "order.created",
  "timestamp": "{{timestamp}}",
  "data": {
    "order_id": "{{order.id}}",
    "total": "{{order.total}}",
    "user_id": "{{order.user_id}}",
    "items": "{{order.items}}"
  }
}`,
  'user.registered': `{
  "event": "user.registered",
  "timestamp": "{{timestamp}}",
  "data": {
    "user_id": "{{user.id}}",
    "display_name": "{{user.display_name}}",
    "email": "{{user.email}}"
  }
}`,
  'custom': `{
  "event": "{{event}}",
  "timestamp": "{{timestamp}}",
  "data": {}
}`,
};

export default function IntegracoesAdmin() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ open: boolean; edit?: any }>({ open: false });
  const [form, setForm] = useState({ 
    name: '', 
    url: '', 
    event: 'order.created', 
    secret: '', 
    active: true,
    payload_template: '',
    retry_count: 3,
  });
  const [timeline, setTimeline] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { status: string; time: string }>>({});
  const { state, setSearch, setPage, setExtra } = useAdminTable('integracoes');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('integration_webhooks').select('*').order('created_at', { ascending: false });
    setRows(data || []); 
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r => state.extras.active === 'true' ? r.active : state.extras.active === 'false' ? !r.active : true);
  const { items, total, totalPages, page } = useFilteredSorted(filtered, state, ['name', 'url', 'event']);

  const openCreate = () => { 
    setForm({ 
      name: '', 
      url: '', 
      event: 'order.created', 
      secret: '', 
      active: true,
      payload_template: PAYLOAD_TEMPLATES['order.created'],
      retry_count: 3,
    }); 
    setDialog({ open: true }); 
  };

  const openEdit = (r: any) => { 
    setForm({ 
      name: r.name, 
      url: r.url, 
      event: r.event, 
      secret: r.secret || '', 
      active: r.active,
      payload_template: r.payload_template || PAYLOAD_TEMPLATES[r.event] || PAYLOAD_TEMPLATES['custom'],
      retry_count: r.retry_count || 3,
    }); 
    setDialog({ open: true, edit: r }); 
  };

  // GAP-D136: Validação de URL
  const validateUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    if (!form.url.trim()) { toast.error('URL é obrigatória'); return; }
    if (!validateUrl(form.url)) { toast.error('URL inválida. Use http:// ou https://'); return; }
    
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      name: form.name.trim(),
      url: form.url.trim(),
      event: form.event,
      secret: form.secret || null,
      active: form.active,
      payload_template: form.payload_template || PAYLOAD_TEMPLATES[form.event] || PAYLOAD_TEMPLATES['custom'],
      retry_count: form.retry_count || 3,
    };

    if (dialog.edit) {
      const { error } = await supabase.from('integration_webhooks').update(payload).eq('id', dialog.edit.id);
      if (error) return toast.error(error.message);
      await adminLog({ 
        action: 'webhook_update', 
        entity: 'integration_webhook', 
        entity_id: dialog.edit.id, 
        reason: `Webhook "${form.name}" atualizado`,
        payload: { antes: dialog.edit, depois: payload } 
      });
    } else {
      const { data, error } = await supabase.from('integration_webhooks').insert({ 
        ...payload, 
        created_by: user?.id 
      }).select('id').single();
      if (error) return toast.error(error.message);
      await adminLog({ 
        action: 'webhook_create', 
        entity: 'integration_webhook', 
        entity_id: data.id, 
        reason: `Webhook "${form.name}" criado`,
        payload 
      });
    }
    setDialog({ open: false }); 
    load(); 
    toast.success('Webhook salvo com sucesso!');
  };

  // GAP-D137: Teste de conexão com validação
  const testWebhook = async (r: any) => {
    setTesting(r.id);
    const startTime = Date.now();
    let status = 'failed';
    let statusMessage = '';
    
    try {
      const payload = JSON.parse(r.payload_template || PAYLOAD_TEMPLATES[r.event] || '{"event":"test"}');
      const res = await fetch(r.url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          ...(r.secret ? { 'X-Webhook-Secret': r.secret } : {}),
          'X-Webhook-Event': r.event,
          'X-Webhook-Test': 'true',
        },
        body: JSON.stringify({ 
          ...payload,
          test: true, 
          timestamp: new Date().toISOString(),
          webhook_id: r.id,
        }),
      });
      
      const responseTime = Date.now() - startTime;
      status = res.ok ? 'success' : 'failed';
      statusMessage = res.ok ? `OK (${res.status}) - ${responseTime}ms` : `HTTP ${res.status} - ${responseTime}ms`;
      
      // Tentar ler resposta
      let responseBody = '';
      try {
        const text = await res.text();
        responseBody = text.slice(0, 200);
      } catch {}
      
      await adminLog({
        action: 'webhook_test',
        entity: 'integration_webhook',
        entity_id: r.id,
        reason: `Teste ${status}`,
        payload: { 
          status, 
          status_code: res.status,
          response_time: responseTime,
          response_body: responseBody,
        },
      });
      
    } catch (e: any) {
      status = 'error';
      statusMessage = `Erro: ${String(e?.message || e).slice(0, 100)}`;
    }
    
    setTestResult(prev => ({ ...prev, [r.id]: { status, time: new Date().toISOString() } }));
    
    const { error } = await supabase
      .from('integration_webhooks')
      .update({ 
        last_test_status: status === 'success' ? 'ok' : statusMessage,
        last_test_at: new Date().toISOString(),
        last_test_code: status === 'success' ? 200 : 0,
      })
      .eq('id', r.id);
    
    setTesting(null);
    if (error) return toast.error(error.message);
    
    if (status === 'success') {
      toast.success(`✅ Webhook testado com sucesso! ${statusMessage}`);
    } else {
      toast.error(`❌ Falha no teste: ${statusMessage}`);
    }
    load();
  };

  const remove = async (r: any) => {
    if (!confirm(`Excluir webhook "${r.name}"?`)) return;
    const { error } = await supabase.from('integration_webhooks').delete().eq('id', r.id);
    if (error) return toast.error(error.message);
    await adminLog({ 
      action: 'webhook_delete', 
      entity: 'integration_webhook', 
      entity_id: r.id, 
      reason: `Webhook "${r.name}" excluído`,
      payload: { name: r.name } 
    });
    toast.success('Webhook excluído');
    load();
  };

  // GAP-D139: Paginação
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader 
        icon={Plug} 
        title="Integrações" 
        subtitle="Webhooks e chaves externas para integração com serviços de terceiros"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => exportCsv('webhooks.csv', items)}>
              <Download className="h-4 w-4 mr-1" /> Exportar
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Novo webhook
            </Button>
          </>
        } 
      />

      <div className="rounded-lg border border-success/40 bg-success/5 p-3 text-sm text-success flex items-start gap-2">
        <Zap className="h-5 w-5 shrink-0 mt-0.5" />
        <div>
          <b>Ativo:</b> webhooks marcados como <i>Ativo</i> são disparados automaticamente pelo servidor nos eventos suportados.
          <ul className="text-xs mt-1 space-y-0.5">
            <li>• O segredo cadastrado é enviado no header <code className="bg-success/10 px-1 rounded">X-Webhook-Secret</code></li>
            <li>• O payload segue o template configurado para cada evento</li>
            <li>• <span className="text-muted-foreground">Nunca disparamos do navegador — é 100% server-side via Edge Functions</span></li>
          </ul>
        </div>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-4 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="nome, url ou evento" value={state.search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <SelectSimples
              label="Status"
              className="w-36"
              value={(state.extras.active as string) || 'all'}
              onChange={(v) => setExtra('active', v === 'all' ? '' : v)}
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'true', label: 'Ativos' },
                { value: 'false', label: 'Inativos' },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : items.length === 0 ? (
            <EstadoVazio titulo="Nenhum webhook cadastrado" descricao="Crie webhooks para integrar com serviços externos." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Último teste</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(r => {
                  const testInfo = testResult[r.id];
                  const isTesting = testing === r.id;
                  const lastTestOk = r.last_test_status === 'ok' || r.last_test_status?.startsWith('OK');
                  
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {r.event}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-[280px] truncate">{r.url}</TableCell>
                      <TableCell className="text-center">
                        {r.active ? (
                          <Badge className="bg-success/15 text-success">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {isTesting ? (
                          <Loader2 className="h-4 w-4 animate-spin mx-auto text-primary" />
                        ) : r.last_test_at ? (
                          <div>
                            <Badge className={lastTestOk ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}>
                              {lastTestOk ? <CheckCircle2 className="h-3 w-3 mr-0.5" /> : <XCircle className="h-3 w-3 mr-0.5" />}
                              {lastTestOk ? 'OK' : 'Falha'}
                            </Badge>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {formatDateTime(r.last_test_at)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => testWebhook(r)} 
                          disabled={isTesting}
                        >
                          {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                          Testar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setTimeline({ open: true, id: r.id })}>
                          <Activity className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(r)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* GAP-D139: Paginação */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} registros</span>
        <div className="flex gap-2 items-center">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => handlePageChange(page - 1)}>
            Anterior
          </Button>
          <span>Página {page} / {totalPages || 1}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => handlePageChange(page + 1)}>
            Próxima
          </Button>
        </div>
      </div>

      {/* GAP-D142: Dialog com payload customizado */}
      <Dialog open={dialog.open} onOpenChange={(o) => setDialog({ open: o })}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog.edit ? 'Editar webhook' : 'Novo webhook'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Discord Orders" />
            </div>
            <div>
              <Label>URL *</Label>
              <Input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
              <p className="text-xs text-muted-foreground mt-1">Use HTTPS em produção. HTTP apenas para testes locais.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Evento</Label>
                <Select value={form.event} onValueChange={(v) => {
                  setForm({ 
                    ...form, 
                    event: v, 
                    payload_template: PAYLOAD_TEMPLATES[v] || PAYLOAD_TEMPLATES['custom'] 
                  });
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_OPTIONS.map(e => (
                      <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tentativas em caso de falha</Label>
                <Select value={String(form.retry_count)} onValueChange={(v) => setForm({ ...form, retry_count: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 5, 10].map(n => (
                      <SelectItem key={n} value={String(n)}>{n === 0 ? 'Sem retry' : `${n}x`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Secret (opcional)</Label>
              <Input 
                value={form.secret} 
                onChange={e => setForm({ ...form, secret: e.target.value })} 
                placeholder="Token de autenticação" 
                type="password"
              />
              <p className="text-xs text-muted-foreground mt-1">Enviado no header <code className="bg-muted px-1 rounded">X-Webhook-Secret</code></p>
            </div>
            <div>
              <Label>Payload Template (JSON)</Label>
              <Textarea 
                value={form.payload_template} 
                onChange={e => setForm({ ...form, payload_template: e.target.value })} 
                rows={6}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use <code className="bg-muted px-1 rounded">{"{{timestamp}}"}</code>, <code className="bg-muted px-1 rounded">{"{{event}}"}</code> e variáveis do evento.
              </p>
            </div>
            <div className="flex items-center justify-between bg-secondary/40 rounded-lg p-3">
              <div>
                <Label className="cursor-pointer">Ativo</Label>
                <p className="text-xs text-muted-foreground">Webhooks inativos não são disparados</p>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
            <Button className="w-full" onClick={save}>
              {dialog.edit ? 'Atualizar webhook' : 'Criar webhook'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* GAP-D141: Timeline */}
      <EntityTimelineDrawer 
        open={timeline.open} 
        onOpenChange={(o) => setTimeline({ open: o, id: o ? timeline.id : null })}
        entity="integration_webhook" 
        entityId={timeline.id} 
        title="Timeline do webhook" 
      />
    </div>
  );
}