// ECA Digital: menor solicita vínculo do responsável. Aparece só para contas de menor sem vínculo aprovado.
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ageBracket } from '@/lib/podeAcessarConteudo';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldCheck, Loader2, BadgeCheck, AlertCircle, Eye, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// GAP-GL01: Validações em tempo real
const validateCPF = (cpf: string): boolean => {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  // Verificação básica de CPF
  const first = digits[0];
  if (digits.split('').every(d => d === first)) return false;
  return true;
};

const validatePhone = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 11;
};

type StatusType = 'pending' | 'approved' | 'rejected';

export default function GuardianLinkSection() {
  const { user } = useAuth();
  const [birth, setBirth] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [status, setStatus] = useState<StatusType | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [full, setFull] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);

  const cpfValid = validateCPF(cpf);
  const phoneValid = validatePhone(phone);
  const nameValid = full.trim().length >= 3;
  const urlValid = url.trim().length >= 8;
  const formValid = cpfValid && phoneValid && nameValid && urlValid;

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('birth_date, is_verified_account').eq('id', user.id).maybeSingle().then(({ data }) => {
      const d = data as any;
      if (d) { setBirth(d.birth_date || null); setVerified(!!d.is_verified_account); }
    });
    
    // GAP-GL03: Buscar status do pedido
    (supabase as any).from('guardian_link_requests').select('id, status, created_at, admin_notes')
      .eq('minor_id', user.id).order('created_at', { ascending: false }).limit(1)
      .then(({ data }: any) => {
        const req = data?.[0];
        if (req) {
          setStatus(req.status);
          setStatusMessage(req.admin_notes || null);
          setSubmittedAt(req.created_at);
        }
      });
  }, [user?.id]);

  const bracket = ageBracket(birth);
  const isMinor = bracket === 'crianca' || bracket === 'adolescente';
  if (!isMinor && !verified) return null;

  const submit = async () => {
    if (!formValid) return;
    setSaving(true);
    const { error } = await (supabase as any).rpc('submit_guardian_link', {
      _cpf: cpf, _phone: phone, _full_name: full, _atestado_url: url,
    });
    setSaving(false);
    if (error) {
      toast.error('Erro: ' + error.message);
      return;
    }
    setStatus('pending');
    setSubmittedAt(new Date().toISOString());
    toast.success('Pedido enviado — nossa equipe vai validar em breve.');
    setCpf(''); setPhone(''); setFull(''); setUrl('');
  };

  // GAP-GL02: Preview do link
  const showPreview = url && url.startsWith('http');

  const StatusBadge = () => {
    if (!status) return null;
    const configs = {
      pending: { icon: Clock, label: 'Em análise', cls: 'bg-warning/20 text-warning border-warning/30' },
      approved: { icon: CheckCircle2, label: 'Aprovado ✓', cls: 'bg-success/20 text-success border-success/30' },
      rejected: { icon: XCircle, label: 'Rejeitado', cls: 'bg-destructive/20 text-destructive border-destructive/30' },
    };
    const config = configs[status];
    const Icon = config.icon;
    return (
      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border", config.cls)}>
        <Icon className="h-3 w-3" /> {config.label}
      </span>
    );
  };

  return (
    <section className="bg-card border border-border rounded-xl p-5 mb-6 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {verified ? <BadgeCheck className="h-5 w-5 text-primary" /> : <ShieldCheck className="h-5 w-5 text-primary" />}
          <p className="text-sm font-semibold">
            {verified ? 'Conta Verificada' : 'Vínculo do responsável (ECA Digital)'}
          </p>
        </div>
        <StatusBadge />
      </div>

      {verified ? (
        <p className="text-xs text-muted-foreground">Seu responsável foi verificado. Você ganhou o badge "Conta Verificada".</p>
      ) : status === 'pending' ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" />
            Pedido em análise desde {submittedAt ? new Date(submittedAt).toLocaleDateString('pt-BR') : 'recentemente'}.
          </p>
          {statusMessage && (
            <p className="text-xs text-muted-foreground border-l-2 border-border pl-2">
              {statusMessage}
            </p>
          )}
        </div>
      ) : status === 'rejected' ? (
        <div className="space-y-2">
          <p className="text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Pedido rejeitado. Verifique os dados e tente novamente.
          </p>
          {statusMessage && (
            <p className="text-xs text-muted-foreground border-l-2 border-destructive/30 pl-2">
              Motivo: {statusMessage}
            </p>
          )}
          <Button size="sm" variant="outline" onClick={() => setStatus(null)}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Como você tem menos de 18 anos, precisamos verificar seu responsável. Envie os dados abaixo — a análise é feita por uma pessoa da nossa equipe.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Input 
                placeholder="Nome completo do responsável" 
                value={full} 
                onChange={e => setFull(e.target.value)}
                onBlur={() => setTouched(prev => ({ ...prev, full: true }))}
                className={cn(
                  touched.full && !nameValid && "border-destructive focus-visible:ring-destructive"
                )}
              />
              {touched.full && !nameValid && (
                <p className="text-[10px] text-destructive mt-0.5">Nome obrigatório</p>
              )}
            </div>
            <div>
              <Input 
                placeholder="CPF do responsável" 
                value={cpf} 
                onChange={e => setCpf(e.target.value)}
                onBlur={() => setTouched(prev => ({ ...prev, cpf: true }))}
                className={cn(
                  touched.cpf && !cpfValid && "border-destructive focus-visible:ring-destructive"
                )}
              />
              {touched.cpf && !cpfValid && (
                <p className="text-[10px] text-destructive mt-0.5">CPF inválido</p>
              )}
            </div>
            <div>
              <Input 
                placeholder="Telefone do responsável" 
                value={phone} 
                onChange={e => setPhone(e.target.value)}
                onBlur={() => setTouched(prev => ({ ...prev, phone: true }))}
                className={cn(
                  touched.phone && !phoneValid && "border-destructive focus-visible:ring-destructive"
                )}
              />
              {touched.phone && !phoneValid && (
                <p className="text-[10px] text-destructive mt-0.5">Telefone inválido</p>
              )}
            </div>
            <div>
              <Input 
                placeholder="Link do atestado (upload em nuvem)" 
                value={url} 
                onChange={e => setUrl(e.target.value)}
                onBlur={() => setTouched(prev => ({ ...prev, url: true }))}
                className={cn(
                  touched.url && !urlValid && "border-destructive focus-visible:ring-destructive"
                )}
              />
              {touched.url && !urlValid && (
                <p className="text-[10px] text-destructive mt-0.5">Link obrigatório</p>
              )}
            </div>
          </div>

          {/* GAP-GL02: Preview do link */}
          {showPreview && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/40 border border-border">
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate">
                {url}
              </a>
            </div>
          )}

          <Button size="sm" onClick={submit} disabled={saving || !formValid}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} 
            Enviar para verificação
          </Button>
        </>
      )}
    </section>
  );
}