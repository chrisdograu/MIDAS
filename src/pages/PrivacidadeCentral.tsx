// Central de Privacidade — inclui itens 91/92/93 (motivo de banimento, contestação, exclusão de conta).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Bell, UserX, ArrowLeft, Eye, EyeOff, UserCheck, Lock, Download, Loader2, AlertTriangle, Trash2, PauseCircle, History as HistoryIcon, Mail, CheckCircle2, Clock, FileJson, FileSpreadsheet, Eraser } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import PrivacyTab from '@/components/perfil/PrivacyTab';
import NotificationPrefsTab from '@/components/perfil/NotificationPrefsTab';
import BlockedUsersTab from '@/components/perfil/BlockedUsersTab';
import GuardianLinkSection from '@/components/perfil/GuardianLinkSection';
import LoginHistoryList from '@/components/perfil/LoginHistoryList';
import { formatDateTime } from '@/lib/format';
import { dbWrite } from '@/lib/dbWrite';

// GAP-572: Calcular tempo restante de pausa
function getPauseRemaining(pausedAt: string | null): string | null {
  if (!pausedAt) return null;
  const paused = new Date(pausedAt);
  const now = new Date();
  // Pausa máxima de 30 dias (configurável)
  const maxPauseDays = 30;
  const expiry = new Date(paused.getTime() + maxPauseDays * 24 * 60 * 60 * 1000);
  
  if (expiry <= now) return 'Expirado';
  
  const diff = expiry.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) return `${days}d ${hours}h restantes`;
  return `${hours}h restantes`;
}

// GAP-573: Exportar CSV
function exportAsCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    toast.info('Nenhum dado para exportar');
    return;
  }
  
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row => headers.map(h => {
      const val = row[h] ?? '';
      return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
    }).join(','))
  ];
  
  const csv = csvRows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('CSV exportado!');
}

// GAP-574: Esquecimento de dados (GDPR)
async function requestDataForget(userId: string): Promise<void> {
  // Marca a conta para esquecimento em 30 dias (período de carência)
  const { error } = await dbWrite(
    supabase
      .from('profiles')
      .update({ 
        forget_requested_at: new Date().toISOString(),
        forget_scheduled_for: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('id', userId)
  );
  if (error) throw error;
}

export default function PrivacidadeCentral() {
  const { user, signOut } = useAuth();
  const [isPrivate, setIsPrivate] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [banReason, setBanReason] = useState<string | null>(null);
  const [bannedUntil, setBannedUntil] = useState<string | null>(null);
  const [appealReason, setAppealReason] = useState<'nao_concordo' | 'conta_invadida'>('nao_concordo');
  const [appealText, setAppealText] = useState('');
  const [submittingAppeal, setSubmittingAppeal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [hideAdult, setHideAdult] = useState(false);
  
  // GAP-570: Confirmação por e-mail para exclusão
  const [emailConfirmStep, setEmailConfirmStep] = useState<'idle' | 'sending' | 'sent' | 'confirming'>('idle');
  const [emailConfirmCode, setEmailConfirmCode] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // GAP-572: Tempo restante de pausa
  const [pausedAt, setPausedAt] = useState<string | null>(null);
  const [pauseRemaining, setPauseRemaining] = useState<string | null>(null);
  
  // GAP-574: Esquecimento de dados
  const [forgetRequested, setForgetRequested] = useState(false);
  const [forgetScheduledFor, setForgetScheduledFor] = useState<string | null>(null);

  // GAP-571: Histórico de contestação
  const [appealHistory, setAppealHistory] = useState<{ reviewed_by?: string; reviewed_at?: string; status: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles')
      .select('is_private, require_follow_approval, ban_reason_public, banned_until, is_paused, hide_adult_content, paused_at, forget_requested_at, forget_scheduled_for')
      .eq('id', user.id).maybeSingle().then(({ data }) => {
        const d = data as any;
        if (d) {
          setIsPrivate(!!d.is_private);
          setRequireApproval(!!d.require_follow_approval);
          setBanReason(d.ban_reason_public || null);
          setBannedUntil(d.banned_until || null);
          setIsPaused(!!d.is_paused);
          setHideAdult(!!d.hide_adult_content);
          setPausedAt(d.paused_at || null);
          setForgetRequested(!!d.forget_requested_at);
          setForgetScheduledFor(d.forget_scheduled_for || null);
        }
        setLoaded(true);
      });
    
    // GAP-571: Buscar histórico de contestação
    supabase
      .from('ban_appeals' as any)
      .select('reviewed_by, reviewed_at, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setAppealHistory(data as any);
      });
  }, [user?.id]);

  // GAP-572: Atualizar tempo restante de pausa
  useEffect(() => {
    if (!pausedAt || !isPaused) {
      setPauseRemaining(null);
      return;
    }
    const updateRemaining = () => {
      const remaining = getPauseRemaining(pausedAt);
      setPauseRemaining(remaining);
    };
    updateRemaining();
    const interval = setInterval(updateRemaining, 60000);
    return () => clearInterval(interval);
  }, [pausedAt, isPaused]);

  const saveToggle = async (field: 'is_private' | 'require_follow_approval' | 'hide_adult_content', value: boolean) => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({ [field]: value } as any).eq('id', user.id);
    if (error) toast.error('Erro ao salvar'); else toast.success('Atualizado');
  };

  const togglePause = async (v: boolean) => {
    setPausing(true);
    const { data, error } = await supabase.rpc((v ? 'pause_my_account' : 'resume_my_account') as any);
    setPausing(false);
    if (error) return toast.error(error.message);
    setIsPaused(v);
    if (v) {
      // Salvar o momento em que a pausa começou
      await supabase.from('profiles').update({ paused_at: new Date().toISOString() }).eq('id', user!.id);
      setPausedAt(new Date().toISOString());
    } else {
      setPausedAt(null);
    }
    toast.success(v ? 'Conta pausada — entre de novo quando quiser reativar.' : 'Conta reativada.');
  };

  // GAP-573: Exportar dados (JSON ou CSV)
  const exportData = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const [prof, lib, aval, ped, msg] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('biblioteca_usuario').select('*').eq('user_id', user.id),
        supabase.from('avaliacoes').select('*').eq('user_id', user.id),
        supabase.from('pedidos').select('*, itens_pedido(*)').eq('user_id', user.id),
        supabase.from('mensagens').select('*').eq('sender_id', user.id),
      ]);
      
      const data = {
        exported_at: new Date().toISOString(),
        user_id: user.id,
        profile: prof.data, library: lib.data, reviews: aval.data,
        orders: ped.data, messages_sent: msg.data,
      };
      
      if (exportFormat === 'json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `midias-meus-dados-${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // GAP-573: Exportar CSV (versão simplificada com dados principais)
        const flatData = [
          ...(lib.data || []).map((item: any) => ({
            type: 'biblioteca',
            product_id: item.product_id,
            status: item.status,
            hours_played: item.hours_played || 0,
            acquired_at: item.acquired_at,
          })),
          ...(aval.data || []).map((item: any) => ({
            type: 'review',
            product_id: item.product_id,
            rating: item.rating,
            comment: item.comment || '',
            created_at: item.created_at,
          })),
        ];
        exportAsCSV(flatData, 'midias-dados');
      }
      toast.success('Arquivo gerado — verifique seus downloads.');
    } catch {
      toast.error('Não foi possível gerar o arquivo agora.');
    } finally { setExporting(false); }
  };

  // GAP-570: Enviar código de confirmação por e-mail
  const sendDeleteConfirmation = async () => {
    setEmailConfirmStep('sending');
    try {
      // Simular envio de código (em produção, seria um e-mail real)
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      localStorage.setItem('delete_confirm_code', code);
      localStorage.setItem('delete_confirm_expiry', Date.now() + 600000 + '');
      
      // Em produção, enviar e-mail com o código
      // await supabase.functions.invoke('send-delete-code', { body: { email: user?.email, code } });
      
      setEmailConfirmStep('sent');
      toast.info(`Código enviado para ${user?.email} (simulado: ${code})`);
    } catch {
      toast.error('Erro ao enviar código de confirmação');
      setEmailConfirmStep('idle');
    }
  };

  // GAP-570: Confirmar código de exclusão
  const confirmDelete = async () => {
    setEmailConfirmStep('confirming');
    try {
      const storedCode = localStorage.getItem('delete_confirm_code');
      const expiry = parseInt(localStorage.getItem('delete_confirm_expiry') || '0');
      
      if (!storedCode || Date.now() > expiry) {
        toast.error('Código expirado. Solicite um novo.');
        setEmailConfirmStep('idle');
        return;
      }
      
      if (emailConfirmCode !== storedCode) {
        toast.error('Código incorreto.');
        setEmailConfirmStep('sent');
        return;
      }
      
      // Código correto → proceder com exclusão
      setDeleting(true);
      const { error } = await supabase.rpc('delete_my_account' as any);
      if (error) { setDeleting(false); return toast.error(error.message); }
      
      localStorage.removeItem('delete_confirm_code');
      localStorage.removeItem('delete_confirm_expiry');
      
      toast.success('Conta anonimizada. Sentimos sua saída.');
      setShowDeleteDialog(false);
      await signOut();
    } catch {
      toast.error('Erro ao confirmar exclusão');
    } finally {
      setDeleting(false);
      setEmailConfirmStep('idle');
    }
  };

  // GAP-574: Solicitar esquecimento de dados
  const handleForgetRequest = async () => {
    if (!user) return;
    try {
      await requestDataForget(user.id);
      setForgetRequested(true);
      setForgetScheduledFor(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
      toast.success('Solicitação de esquecimento registrada. Seus dados serão removidos em 30 dias.');
    } catch {
      toast.error('Erro ao solicitar esquecimento de dados');
    }
  };

  const submitAppeal = async () => {
    if (appealText.trim().length < 10) return toast.error('Descreva com pelo menos 10 caracteres.');
    setSubmittingAppeal(true);
    const { error } = await supabase.rpc('submit_ban_appeal' as any, {
      _reason: appealReason, _description: appealText,
    });
    setSubmittingAppeal(false);
    if (error) return toast.error(error.message);
    setAppealText('');
    toast.success('Contestação enviada — vamos analisar em breve.');
  };

  const deleteAccount = async () => {
    // GAP-570: Agora usa o fluxo de confirmação por e-mail
    setShowDeleteDialog(true);
    setEmailConfirmStep('idle');
    setEmailConfirmCode('');
  };

  const isBanned = bannedUntil && new Date(bannedUntil) > new Date();

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Link to="/perfil" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="h-4 w-4" /> Voltar ao perfil</Link>
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-2"><Shield className="h-6 w-6 text-primary" /> Privacidade e segurança</h1>
      <p className="text-sm text-muted-foreground mb-6">Tudo num só lugar: visibilidade do seu perfil, quem pode te seguir/mensagem, exceções e bloqueios.</p>

      {/* 91: motivo de banimento + 93: contestação */}
      {isBanned && (
        <section className="border border-destructive/50 bg-destructive/5 rounded-xl p-5 mb-6 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-destructive">Sua conta está suspensa até {formatDateTime(bannedUntil!)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="font-medium">Motivo:</span> {banReason || 'Não informado — entre em contato com o suporte.'}
              </p>
              {/* GAP-571: Histórico de contestação */}
              {appealHistory && (
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-medium">Última contestação:</span> {appealHistory.status === 'pending' ? 'Em análise' : 
                    appealHistory.status === 'approved' ? 'Aprovada ✅' : 'Recusada ❌'}
                  {appealHistory.reviewed_by && ` • Revisado por: ${appealHistory.reviewed_by}`}
                </p>
              )}
            </div>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">Contestar penalidade</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Contestar suspensão</DialogTitle></DialogHeader>
              <RadioGroup value={appealReason} onValueChange={(v: any) => setAppealReason(v)} className="space-y-2">
                <div className="flex items-start gap-2 border border-border rounded-lg p-3">
                  <RadioGroupItem value="nao_concordo" id="r1" />
                  <div className="flex-1">
                    <Label htmlFor="r1" className="font-medium">Não concordo com a penalidade</Label>
                    <p className="text-xs text-muted-foreground">Você reconhece a ação, mas discorda da decisão da moderação.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 border border-border rounded-lg p-3">
                  <RadioGroupItem value="conta_invadida" id="r2" />
                  <div className="flex-1">
                    <Label htmlFor="r2" className="font-medium">Minha conta foi acessada por outra pessoa</Label>
                    <p className="text-xs text-muted-foreground">A ação penalizada não foi feita por você.</p>
                  </div>
                </div>
              </RadioGroup>
              <Textarea rows={5} value={appealText} onChange={e => setAppealText(e.target.value)} placeholder="Explique com o máximo de detalhe possível (mínimo 10 caracteres)." />
              <DialogFooter>
                <Button onClick={submitAppeal} disabled={submittingAppeal}>
                  {submittingAppeal && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Enviar contestação
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </section>
      )}

      <GuardianLinkSection />

      {/* Toggles rápidos */}
      <section className="bg-card border border-border rounded-xl p-5 mb-6 space-y-4">
        <Row icon={<Lock className="h-4 w-4 text-primary" />} title="Perfil privado" desc="Oculta sua biblioteca e atividade para quem não é amigo mútuo.">
          <Switch checked={isPrivate} disabled={!loaded} onCheckedChange={v => { setIsPrivate(v); saveToggle('is_private', v); }} />
        </Row>
        <Row icon={<UserCheck className="h-4 w-4 text-accent" />} title="Aprovar novos seguidores" desc="Cada pedido para te seguir fica pendente até você aprovar (estilo Instagram).">
          <Switch checked={requireApproval} disabled={!loaded} onCheckedChange={v => { setRequireApproval(v); saveToggle('require_follow_approval', v); }} />
        </Row>
      </section>

      {/* Exportação com formato */}
      <section className="bg-card border border-border rounded-xl p-5 mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold flex items-center gap-1.5"><Download className="h-4 w-4 text-primary" /> Baixar meus dados</p>
          <p className="text-xs text-muted-foreground">Escolha o formato de exportação.</p>
          <div className="flex items-center gap-3 mt-1.5">
            <label className="flex items-center gap-1 text-xs">
              <input type="radio" checked={exportFormat === 'json'} onChange={() => setExportFormat('json')} />
              <FileJson className="h-3.5 w-3.5" /> JSON
            </label>
            <label className="flex items-center gap-1 text-xs">
              <input type="radio" checked={exportFormat === 'csv'} onChange={() => setExportFormat('csv')} />
              <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
            </label>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={exportData} disabled={exporting || !user}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Download className="h-4 w-4 mr-1" /> Exportar</>}
        </Button>
      </section>

      {/* GAP-574: Esquecimento de dados */}
      <section className="bg-card border border-border rounded-xl p-5 mb-6">
        <Row icon={<Eraser className="h-4 w-4 text-warning" />} title="Direito ao esquecimento (GDPR)" desc="Solicite a remoção completa de seus dados. Seus dados serão anonimizados em até 30 dias.">
          {forgetRequested ? (
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs">Solicitado {forgetScheduledFor ? `(até ${formatDateTime(forgetScheduledFor)})` : ''}</span>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={handleForgetRequest} disabled={!user}>
              Solicitar
            </Button>
          )}
        </Row>
      </section>

      {/* Pausar conta + Modo restrito + GAP-572: tempo restante */}
      <section className="bg-card border border-border rounded-xl p-5 mb-6 space-y-4">
        <Row icon={<PauseCircle className="h-4 w-4 text-accent" />} title="Pausar minha conta" desc="Reversível: seu perfil sai da busca e das sugestões, e seus anúncios ficam ocultos no marketplace. Basta entrar de novo que a conta reativa automaticamente.">
          <div className="flex items-center gap-3">
            {isPaused && pauseRemaining && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> {pauseRemaining}
              </span>
            )}
            <Switch checked={isPaused} disabled={!loaded || pausing} onCheckedChange={togglePause} />
          </div>
        </Row>
        <Row icon={<EyeOff className="h-4 w-4 text-primary" />} title="Modo restrito" desc="Oculta jogos com classificação 18 anos no catálogo, por sua escolha. É diferente da trava obrigatória por idade, que continua valendo para menores independentemente disso.">
          <Switch checked={hideAdult} disabled={!loaded} onCheckedChange={v => { setHideAdult(v); saveToggle('hide_adult_content', v); }} />
        </Row>
      </section>

      {/* Histórico de acessos */}
      <section className="bg-card border border-border rounded-xl p-5 mb-6">
        <p className="text-sm font-semibold flex items-center gap-1.5 mb-1"><HistoryIcon className="h-4 w-4 text-primary" /> Onde você acessou sua conta</p>
        <p className="text-xs text-muted-foreground mb-2">Últimos 20 acessos registrados, com data, hora e dispositivo.</p>
        <LoginHistoryList />
      </section>

      {/* GAP-570: Exclusão com confirmação por e-mail */}
      <section className="bg-card border border-destructive/40 rounded-xl p-5 mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold flex items-center gap-1.5 text-destructive"><Trash2 className="h-4 w-4" /> Excluir minha conta</p>
          <p className="text-xs text-muted-foreground">Seu perfil (nome, e-mail, CPF, telefone) é anonimizado. Reviews e posts ficam com identificação "usuário removido".</p>
        </div>
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="destructive" disabled={!user}>Excluir</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirme sua identidade</AlertDialogTitle>
              <AlertDialogDescription>
                Para excluir sua conta, precisamos confirmar que é você. 
                Um código de verificação foi enviado para <strong>{user?.email}</strong>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            {emailConfirmStep === 'idle' && (
              <Button onClick={sendDeleteConfirmation} className="w-full">
                <Mail className="h-4 w-4 mr-2" /> Enviar código de verificação
              </Button>
            )}
            
            {emailConfirmStep === 'sending' && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">Enviando código...</span>
              </div>
            )}
            
            {emailConfirmStep === 'sent' && (
              <>
                <div className="space-y-2">
                  <Label>Digite o código recebido por e-mail</Label>
                  <input
                    type="text"
                    value={emailConfirmCode}
                    onChange={(e) => setEmailConfirmCode(e.target.value)}
                    placeholder="000000"
                    className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/50"
                    maxLength={6}
                  />
                  <button 
                    onClick={sendDeleteConfirmation}
                    className="text-xs text-primary hover:underline"
                    disabled={emailConfirmStep === 'sending'}
                  >
                    Reenviar código
                  </button>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={confirmDelete} 
                    disabled={emailConfirmCode.length !== 6 || deleting}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Confirmar exclusão
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            )}
            
            {emailConfirmStep === 'confirming' && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">Confirmando...</span>
              </div>
            )}
          </AlertDialogContent>
        </AlertDialog>
      </section>

      <Tabs defaultValue="visibilidade">
        <TabsList className="grid w-full grid-cols-3 gap-1 h-auto p-1">
          <TabsTrigger value="visibilidade" className="flex-col gap-1 px-1 py-2 text-[11px] sm:flex-row sm:gap-1.5 sm:text-sm"><Eye className="h-4 w-4" />Visibilidade</TabsTrigger>
          <TabsTrigger value="notif" className="flex-col gap-1 px-1 py-2 text-[11px] sm:flex-row sm:gap-1.5 sm:text-sm"><Bell className="h-4 w-4" />Notificações</TabsTrigger>
          <TabsTrigger value="bloq" className="flex-col gap-1 px-1 py-2 text-[11px] sm:flex-row sm:gap-1.5 sm:text-sm"><UserX className="h-4 w-4" />Bloqueios</TabsTrigger>
        </TabsList>

        <TabsContent value="visibilidade" className="mt-4">
          <div className="bg-card border border-border rounded-xl p-5"><PrivacyTab /></div>
        </TabsContent>
        <TabsContent value="notif" className="mt-4">
          <div className="bg-card border border-border rounded-xl p-5"><NotificationPrefsTab /></div>
        </TabsContent>
        <TabsContent value="bloq" className="mt-4">
          <div className="bg-card border border-border rounded-xl p-5"><BlockedUsersTab /></div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        <div className="mt-0.5">{icon}</div>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}