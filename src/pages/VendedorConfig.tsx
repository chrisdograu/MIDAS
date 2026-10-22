// Configuração do perfil de vendedor + onboarding para quem ainda não criou.
// Rótulos: prosa em PT-BR; o sigilo `$` só aparece via <SellerSigil />.
import { useEffect, useState } from 'react';
import { SellerSigil, UserSigil } from '@/components/HandleSigil';
import { Link, useNavigate } from 'react-router-dom';
import { Store, Loader2, Save, ExternalLink, ShieldCheck, Plus, ArrowLeft, Eye, EyeOff, Trash2, Clock, CheckCircle2, XCircle, AlertCircle, History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { dbWrite } from '@/lib/dbWrite';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// GAP-630: Validação de CPF
function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i);
  let firstDigit = 11 - (sum % 11);
  if (firstDigit >= 10) firstDigit = 0;
  if (firstDigit !== parseInt(cleaned[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i);
  let secondDigit = 11 - (sum % 11);
  if (secondDigit >= 10) secondDigit = 0;
  return secondDigit === parseInt(cleaned[10]);
}

// GAP-630: Formatar CPF
function formatCPF(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
  if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
}

// GAP-631: Validação de telefone
function validatePhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 11;
}

// GAP-631: Formatar telefone
function formatPhone(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  if (cleaned.length <= 11) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  return cleaned;
}

// GAP-632: Buscar histórico de certificações
async function getCertificationHistory(userId: string) {
  const { data } = await supabase
    .from('certificados')
    .select('status, created_at, reviewed_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return data || [];
}

export default function VendedorConfig() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState<any>(null);
  const [cert, setCert] = useState<'none'|'pending'|'active'>('none');
  const [activeAds, setActiveAds] = useState(0);
  const [bio, setBio] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);

  const [profileCpf, setProfileCpf] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [certifying, setCertifying] = useState(false);
  const [sellerBio, setSellerBio] = useState('');
  const [vacationMode, setVacationMode] = useState(false);
  const [vacationMessage, setVacationMessage] = useState('');

  // GAP-630: Erros de validação
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // GAP-632: Histórico de certificações
  const [certHistory, setCertHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // GAP-633: Última atualização
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // GAP-634: Dialog de desativação
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  // GAP-630: Validar CPF em tempo real
  const handleCpfChange = (value: string) => {
    const formatted = formatCPF(value);
    setProfileCpf(formatted);
    if (formatted.replace(/\D/g, '').length === 11) {
      if (!validateCPF(formatted)) {
        setCpfError('CPF inválido');
      } else {
        setCpfError(null);
      }
    } else if (formatted.replace(/\D/g, '').length > 0) {
      setCpfError('CPF deve ter 11 dígitos');
    } else {
      setCpfError(null);
    }
  };

  // GAP-631: Validar telefone em tempo real
  const handlePhoneChange = (value: string) => {
    const formatted = formatPhone(value);
    setProfilePhone(formatted);
    if (formatted.replace(/\D/g, '').length >= 10) {
      if (!validatePhone(formatted)) {
        setPhoneError('Telefone inválido');
      } else {
        setPhoneError(null);
      }
    } else if (formatted.replace(/\D/g, '').length > 0) {
      setPhoneError('Telefone deve ter 10 ou 11 dígitos');
    } else {
      setPhoneError(null);
    }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: sp }, { data: c }, { count }, { data: prof }] = await Promise.all([
        supabase.from('seller_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('certificados').select('status').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('anuncios').select('id', { count: 'exact', head: true }).eq('seller_id', user.id).eq('status', 'active'),
        (supabase as any).rpc('get_my_profile').then((r: any) => ({ data: Array.isArray(r.data) ? r.data[0] : r.data })),
      ]);
      setSeller(sp);
      if (sp) {
        setBio(sp.bio || ''); 
        setDisplayName(sp.display_name); 
        setAvatarUrl(sp.avatar_url || '');
        setIsPrivate(sp.is_private);
        setVacationMode(!!(sp as any).vacation_mode);
        setVacationMessage((sp as any).vacation_message || '');
        setLastUpdated((sp as any).updated_at || null);
      }
      if (prof) {
        const cpfVal = (prof as any).cpf || '';
        const phoneVal = (prof as any).phone || '';
        setProfileCpf(cpfVal ? formatCPF(cpfVal) : '');
        setProfilePhone(phoneVal ? formatPhone(phoneVal) : '');
        setSellerBio((prof as any).seller_bio || '');
      }
      const last = c?.[0]?.status;
      setCert(last === 'ativo' ? 'active' : last === 'pendente' ? 'pending' : 'none');
      setActiveAds(count || 0);

      // GAP-632: Buscar histórico de certificações
      const history = await getCertificationHistory(user.id);
      setCertHistory(history);

      setLoading(false);
    })();
  }, [user?.id]);

  const requestCert = async () => {
    if (!user) return;
    if (!profileCpf || !profilePhone) { toast.error('Preencha CPF e telefone abaixo primeiro'); return; }
    // GAP-630: Validar CPF antes de solicitar
    if (cpfError) { toast.error('Corrija o CPF antes de solicitar'); return; }
    // GAP-631: Validar telefone antes de solicitar
    if (phoneError) { toast.error('Corrija o telefone antes de solicitar'); return; }
    setCertifying(true);
    await dbWrite(supabase.from('profiles').update({ 
      cpf: profileCpf.replace(/\D/g, ''), 
      phone: profilePhone.replace(/\D/g, '') 
    }).eq('id', user.id));
    const { error } = await supabase.from('certificados').insert({ user_id: user.id, status: 'pendente' });
    if (error) toast.error('Erro ao solicitar'); else { 
      toast.success('Solicitação enviada para análise'); 
      setCert('pending');
      // GAP-632: Recarregar histórico
      const history = await getCertificationHistory(user.id);
      setCertHistory(history);
    }
    setCertifying(false);
  };

  // GAP-634: Desativar perfil vendedor
  const deactivateSeller = async () => {
    if (!user || !seller) return;
    setDeactivating(true);
    const { error } = await supabase
      .from('seller_profiles')
      .update({ is_active: false, deactivated_at: new Date().toISOString() } as any)
      .eq('user_id', user.id);
    setDeactivating(false);
    setShowDeactivateDialog(false);
    if (error) {
      toast.error('Erro ao desativar perfil');
      return;
    }
    toast.success('Perfil de vendedor desativado');
    // Recarregar a página para mostrar onboarding
    setSeller(null);
  };

  const save = async () => {
    if (!user || !seller) return;
    
    // GAP-630: Validar CPF antes de salvar
    if (profileCpf && cpfError) {
      toast.error('Corrija o CPF antes de salvar');
      return;
    }
    // GAP-631: Validar telefone antes de salvar
    if (profilePhone && phoneError) {
      toast.error('Corrija o telefone antes de salvar');
      return;
    }
    
    setSaving(true);
    const [{ error }, { error: pErr }] = await Promise.all([
      supabase.from('seller_profiles').update({
        display_name: displayName.trim(), bio: bio.trim() || null,
        avatar_url: avatarUrl || null, is_private: isPrivate,
        vacation_mode: vacationMode,
        vacation_message: vacationMessage.trim() || null,
        updated_at: new Date().toISOString(),
      } as any).eq('user_id', user.id),
      supabase.from('profiles').update({
        seller_bio: sellerBio.trim() || null,
        cpf: profileCpf.replace(/\D/g, '') || null, 
        phone: profilePhone.replace(/\D/g, '') || null,
      } as any).eq('id', user.id),
    ]);
    setSaving(false);
    if (error || pErr) return toast.error('Erro ao salvar');
    setLastUpdated(new Date().toISOString());
    toast.success('Perfil de vendedor atualizado');
  };

  if (!user) return <div className="p-6 text-center text-muted-foreground">Entre para gerenciar seu perfil de vendedor.</div>;
  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  // Onboarding
  if (!seller) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Link to="/perfil" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4"><ArrowLeft className="h-4 w-4" /> Perfil</Link>
        <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-accent/15 flex items-center justify-center">
            <Store className="h-8 w-8 text-accent" />
          </div>
          <h1 className="text-2xl font-display font-bold">Vire um vendedor</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Para vender no marketplace você precisa de um <b>perfil de vendedor</b> (<SellerSigil />) separado do seu perfil pessoal (<UserSigil />).
          </p>
          <button onClick={() => navigate('/vendedor/criar')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent text-accent-foreground font-semibold">
            <Plus className="h-4 w-4" /> Criar meu perfil de vendedor
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/perfil" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Perfil</Link>
        {/* GAP-633: Última atualização */}
        {lastUpdated && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> Atualizado: {new Date(lastUpdated).toLocaleString('pt-BR')}
          </span>
        )}
      </div>

      <header className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center overflow-hidden">
          {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" loading="lazy" /> : <Store className="h-7 w-7 text-accent" />}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-bold">Config de vendedor</h1>
          <p className="text-sm text-muted-foreground">
            <Link to={`/vendedor/${seller.handle}`} className="text-accent hover:underline">${seller.handle}</Link> · {activeAds} anúncio(s) ativo(s)
          </p>
        </div>
        <Link to={`/vendedor/${seller.handle}`} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-secondary text-xs font-semibold">
          <ExternalLink className="h-3 w-3" /> Ver pública
        </Link>
      </header>

      {/* Status */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-card border border-border">
          <p className="text-[10px] uppercase text-muted-foreground">Anúncios ativos</p>
          <p className="text-2xl font-bold mt-1">{activeAds}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <p className="text-[10px] uppercase text-muted-foreground">Certificado</p>
          <p className="text-sm font-semibold mt-2 flex items-center gap-1.5">
            {cert === 'active' ? <><ShieldCheck className="h-4 w-4 text-success" /> Ativo</>
              : cert === 'pending' ? <span className="text-warning">⏳ Em análise</span>
              : <span className="text-muted-foreground">— Sem certificado</span>}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <p className="text-[10px] uppercase text-muted-foreground">Visibilidade</p>
          <p className="text-sm font-semibold mt-2 flex items-center gap-1.5">
            {isPrivate ? <><EyeOff className="h-4 w-4" /> Privado</> : <><Eye className="h-4 w-4" /> Público</>}
          </p>
        </div>
      </section>

      {/* GAP-632: Histórico de certificações */}
      {certHistory.length > 0 && (
        <section className="bg-card border border-border rounded-2xl p-5">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors"
          >
            <History className="h-4 w-4" />
            Histórico de certificações ({certHistory.length})
            <span className="text-muted-foreground">{showHistory ? '▲' : '▼'}</span>
          </button>
          {showHistory && (
            <div className="mt-3 space-y-2">
              {certHistory.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm p-2 rounded-lg bg-secondary/40">
                  <div className="flex items-center gap-2">
                    {item.status === 'ativo' && <CheckCircle2 className="h-4 w-4 text-success" />}
                    {item.status === 'pendente' && <Clock className="h-4 w-4 text-warning" />}
                    {item.status === 'recusado' && <XCircle className="h-4 w-4 text-destructive" />}
                    <span className="capitalize">{item.status}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString('pt-BR')}
                    {item.reviewed_at && ` · revisado em ${new Date(item.reviewed_at).toLocaleDateString('pt-BR')}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Modo Férias */}
      <section className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold flex items-center gap-2">🏖️ Modo Férias</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Oculta todos os seus anúncios do marketplace sem precisar pausar um por um.
            </p>
          </div>
          <button
            onClick={() => setVacationMode(v => !v)}
            aria-pressed={vacationMode}
            className={`relative w-12 h-6 rounded-full transition-colors ${vacationMode ? 'bg-warning' : 'bg-secondary'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-background transition-transform ${vacationMode ? 'translate-x-6' : ''}`} />
          </button>
        </div>
        {vacationMode && (
          <textarea
            value={vacationMessage}
            onChange={e => setVacationMessage(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="Mensagem opcional (ex: Volto em 10/01)"
            className="w-full px-3 py-2 bg-background border border-warning/40 rounded-lg text-sm resize-none"
          />
        )}
      </section>

      {/* Edição */}
      <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <h2 className="font-bold">Dados do vendedor</h2>
        <div>
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Handle</label>
          <p className="mt-1 text-sm font-mono">${seller.handle} <span className="text-muted-foreground text-xs">(não editável)</span></p>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Nome de exibição</label>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={60}
            className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Bio comercial</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} maxLength={500}
            className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Bio de vendedor</label>
          <textarea value={sellerBio} onChange={e => setSellerBio(e.target.value)} rows={3} maxLength={500}
            placeholder="Descreva sua loja, formas de troca, garantias etc."
            className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none" />
        </div>
        <label className="flex items-center justify-between p-3 bg-muted/40 rounded-lg cursor-pointer">
          <span className="text-sm">Perfil de vendedor privado <span className="text-[11px] text-muted-foreground">(quem chega via anúncio ainda vê)</span></span>
          <input type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} className="h-4 w-4 accent-accent" />
        </label>
      </section>

      {/* Certificação */}
      <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <h2 className="font-bold flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-success" /> Vendedor protegido (certificação)</h2>
        <p className="text-xs text-muted-foreground">
          Anúncios "protegidos pela loja" exigem verificação de identidade.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">CPF</label>
            <input 
              value={profileCpf} 
              onChange={e => handleCpfChange(e.target.value)} 
              maxLength={14}
              placeholder="000.000.000-00"
              className={`w-full mt-1 px-3 py-2 bg-background border rounded-lg text-sm ${cpfError ? 'border-destructive' : 'border-border'}`} 
            />
            {cpfError && <p className="text-[11px] text-destructive mt-1">{cpfError}</p>}
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Telefone</label>
            <input 
              value={profilePhone} 
              onChange={e => handlePhoneChange(e.target.value)} 
              maxLength={15}
              placeholder="(11) 99999-9999"
              className={`w-full mt-1 px-3 py-2 bg-background border rounded-lg text-sm ${phoneError ? 'border-destructive' : 'border-border'}`} 
            />
            {phoneError && <p className="text-[11px] text-destructive mt-1">{phoneError}</p>}
          </div>
        </div>
        {cert === 'active' ? (
          <div className="flex items-center gap-2 text-success text-sm font-semibold"><ShieldCheck className="h-4 w-4" /> Você é vendedor verificado</div>
        ) : cert === 'pending' ? (
          <div className="text-sm text-warning">⏳ Solicitação em análise pelos moderadores</div>
        ) : (
          <button onClick={requestCert} disabled={certifying || !!cpfError || !!phoneError}
            className="w-full py-2.5 rounded-lg bg-success text-success-foreground text-sm font-semibold disabled:opacity-50">
            {certifying ? 'Enviando...' : 'Solicitar certificação'}
          </button>
        )}

        <button onClick={save} disabled={saving}
          className="w-full py-3 rounded-xl bg-accent text-accent-foreground font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar tudo
        </button>
      </section>

      {/* GAP-634: Desativar perfil vendedor */}
      <section className="bg-card border border-destructive/30 rounded-2xl p-5">
        <button
          onClick={() => setShowDeactivateDialog(true)}
          className="flex items-center gap-2 text-sm font-semibold text-destructive hover:text-destructive/80 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          Desativar perfil de vendedor
        </button>
        <p className="text-xs text-muted-foreground mt-1">
          Seus anúncios serão ocultados e você não poderá criar novos. Seus dados permanecem salvos por 30 dias.
        </p>
      </section>

      {/* Atalhos */}
      <section className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <h2 className="font-bold">Atalhos</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Link to="/vendedor/editar" className="p-3 rounded-lg bg-secondary text-sm font-semibold text-center">Editar avatar/handle</Link>
          <Link to="/m/marketplace/novo" className="p-3 rounded-lg bg-secondary text-sm font-semibold text-center">+ Novo anúncio</Link>
          <Link to={`/vendedor/${seller.handle}`} className="p-3 rounded-lg bg-secondary text-sm font-semibold text-center">Minha página pública</Link>
        </div>
      </section>

      {/* GAP-634: Dialog de confirmação */}
      <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" /> Desativar perfil de vendedor?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ao desativar:
              <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                <li>Seus anúncios ativos serão ocultados</li>
                <li>Você não poderá criar novos anúncios</li>
                <li>Seu histórico de vendas permanece salvo</li>
                <li>Você pode reativar a qualquer momento entrando novamente aqui</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deactivateSeller} disabled={deactivating} className="bg-destructive hover:bg-destructive/90">
              {deactivating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}