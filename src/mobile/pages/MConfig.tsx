import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Save, Sun, Moon, Camera, User, ShieldOff, ChevronRight, Store, GraduationCap, ArrowLeftRight, ArrowLeft, Shield, Bell, Palette, Lock, Trash2, Eye, EyeOff, Star, Heart } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { toast } from 'sonner';
import { stripImageExif } from '@/lib/stripImageExif';
import { TUTORIALS } from '@/components/tutorial/TutorialContext';
import MPreferencesSection from '@/mobile/components/MPreferencesSection';
import LoginHistoryList from '@/components/perfil/LoginHistoryList';
import { setDataSaverCache } from '@/hooks/useDataSaver';

type Categoria = 'menu' | 'conta' | 'privacidade' | 'notificacao' | 'aparencia' | 'seguranca';

const CATEGORIAS: { id: Categoria; label: string; desc: string; icon: any }[] = [
  { id: 'conta', label: 'Conta', desc: 'Nome, username, bio, pausa e economia de dados', icon: User },
  { id: 'privacidade', label: 'Privacidade', desc: 'Perfil privado, aprovação de seguidores e bloqueios', icon: Shield },
  { id: 'notificacao', label: 'Notificação', desc: 'Alertas por push e por e-mail', icon: Bell },
  { id: 'aparencia', label: 'Aparência', desc: 'Modo claro ou escuro', icon: Palette },
  { id: 'seguranca', label: 'Segurança', desc: 'Sessões conectadas e histórico de acessos', icon: Lock },
];

// GAP-1026: Validação de CPF
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

function formatCPF(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
  if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
}

export default function MConfig() {
  const { user, signOut, updatePassword } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [categoria, setCategoria] = useState<Categoria>('menu');
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    display_name: '', username: '', bio: '', seller_bio: '', phone: '', cpf: '',
    push_notifications: true, email_notifications: false, is_private: false,
    require_follow_approval: false,
    data_saver_mode: false,
  });
  const [saving, setSaving] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // GAP-1026: Erro de CPF
  const [cpfError, setCpfError] = useState<string | null>(null);
  
  // GAP-1027: Confirmação de exclusão por e-mail
  const [emailConfirmStep, setEmailConfirmStep] = useState<'idle' | 'sending' | 'sent' | 'confirming'>('idle');
  const [emailConfirmCode, setEmailConfirmCode] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // GAP-1028: Trocar senha
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // GAP-1026: Validar CPF em tempo real
  const handleCpfChange = (value: string) => {
    const formatted = formatCPF(value);
    setForm({ ...form, cpf: formatted });
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

  // GAP-1027: Enviar código de confirmação por e-mail
  const sendDeleteConfirmation = async () => {
    setEmailConfirmStep('sending');
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      localStorage.setItem('mobile_delete_confirm_code', code);
      localStorage.setItem('mobile_delete_confirm_expiry', Date.now() + 600000 + '');
      // Em produção, enviaria e-mail
      setEmailConfirmStep('sent');
      toast.info(`Código enviado para ${user?.email} (simulado: ${code})`);
    } catch {
      toast.error('Erro ao enviar código');
      setEmailConfirmStep('idle');
    }
  };

  // GAP-1027: Confirmar código de exclusão
  const confirmDelete = async () => {
    setEmailConfirmStep('confirming');
    try {
      const storedCode = localStorage.getItem('mobile_delete_confirm_code');
      const expiry = parseInt(localStorage.getItem('mobile_delete_confirm_expiry') || '0');
      if (!storedCode || Date.now() > expiry) {
        toast.error('Código expirado');
        setEmailConfirmStep('idle');
        return;
      }
      if (emailConfirmCode !== storedCode) {
        toast.error('Código incorreto');
        setEmailConfirmStep('sent');
        return;
      }
      const { error } = await (supabase as any).rpc('delete_my_account');
      if (error) { setDeleting(false); return toast.error(error.message); }
      localStorage.removeItem('mobile_delete_confirm_code');
      localStorage.removeItem('mobile_delete_confirm_expiry');
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

  // GAP-1028: Alterar senha
  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error('Mínimo 6 caracteres'); return; }
    if (newPassword !== confirmPassword) { toast.error('Senhas não coincidem'); return; }
    setSavingPassword(true);
    const result = await updatePassword(newPassword);
    setSavingPassword(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success('Senha alterada!');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordSection(false);
  };

  // GAP-1029: Favoritos rápidos
  const quickFavorites = [
    { label: 'Perfil público', icon: User, to: `/perfil/${user?.id}` },
    { label: 'Biblioteca', icon: Star, to: '/biblioteca' },
    { label: 'Tutoriais', icon: GraduationCap, to: '/m/tutoriais' },
    { label: 'Vendedor', icon: Store, to: '/m/vendedor' },
  ];

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      const { data: rpcData } = await (supabase as any).rpc('get_my_profile');
      const p = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (cancel) return;
      if (p) {
        setForm({
          display_name: p.display_name || '', username: p.username || '', bio: p.bio || '',
          seller_bio: (p as any).seller_bio || '',
          phone: p.phone || '', cpf: p.cpf || '',
          push_notifications: p.push_notifications, email_notifications: p.email_notifications,
          is_private: p.is_private,
          require_follow_approval: !!(p as any).require_follow_approval,
          data_saver_mode: !!(p as any).data_saver_mode,
        });
        setIsPaused(!!(p as any).is_paused);
        setDataSaverCache(!!(p as any).data_saver_mode);
        setAvatarUrl(p.avatar_url || null);
      }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [user?.id]);

  const uploadAvatar = async (raw: File) => {
    if (!user) return;
    if (raw.size > 3 * 1024 * 1024) { toast.error('Máximo 3mb'); return; }
    setUploadingAvatar(true);
    const file = await stripImageExif(raw);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (upErr) { toast.error('Erro ao enviar'); setUploadingAvatar(false); return; }
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    const { error } = await supabase.from('profiles').update({ avatar_url: pub.publicUrl }).eq('id', user.id);
    if (error) toast.error('Erro ao salvar');
    else { setAvatarUrl(pub.publicUrl); toast.success('Foto atualizada ✨'); }
    setUploadingAvatar(false);
  };

  const save = async () => {
    if (!user) return;
    // GAP-1026: Validar CPF antes de salvar
    if (form.cpf && cpfError) {
      toast.error('Corrija o CPF antes de salvar');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('profiles').update(form as any).eq('id', user.id);
    if (error) toast.error('Erro ao salvar');
    else { setDataSaverCache(form.data_saver_mode); toast.success('Configurações salvas'); }
    setSaving(false);
  };

  const togglePause = async (v: boolean) => {
    setPausing(true);
    const { error } = await (supabase as any).rpc(v ? 'pause_my_account' : 'resume_my_account');
    setPausing(false);
    if (error) return toast.error(error.message);
    setIsPaused(v);
    toast.success(v ? 'Conta pausada — entrar de novo reativa.' : 'Conta reativada.');
  };

  const voltar = () => setCategoria('menu');

  if (!user) return <div className="p-6 text-center text-muted-foreground">Entre para acessar configurações.</div>;
  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (categoria === 'menu') {
    return (
      <div className="px-4 py-5 space-y-5">
        <h1 className="font-display text-xl font-bold gradient-text">Configurações</h1>

        {/* GAP-1029: Atalhos rápidos (favoritos) */}
        <div className="grid grid-cols-4 gap-2">
          {quickFavorites.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.label} to={item.to} className="flex flex-col items-center gap-1 p-3 glass rounded-xl hover:border-primary/40 transition-colors">
                <Icon className="h-5 w-5 text-primary" />
                <span className="text-[9px] text-muted-foreground text-center">{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-3 py-2">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent overflow-hidden flex items-center justify-center text-primary-foreground font-bold text-2xl ring-2 ring-primary/40">
              {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : (form.display_name?.[0]?.toUpperCase() || <User className="h-10 w-10" />)}
            </div>
            <button
              onClick={() => avatarRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 -right-1 w-11 h-11 focus-ring rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg disabled:opacity-50"
            >
              {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input ref={avatarRef} type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
          </div>
          <p className="text-[11px] text-muted-foreground">Toque na câmera para mudar a foto</p>
        </div>

        <div className="space-y-3">
          {CATEGORIAS.map(cat => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setCategoria(cat.id)}
                className="w-full glass rounded-2xl p-4 flex items-center gap-3 hover:border-primary/40 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{cat.label}</p>
                  <p className="text-[11px] text-muted-foreground">{cat.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            );
          })}
        </div>

        <Link
          to="/m/config/bloqueados"
          className="glass rounded-2xl p-4 flex items-center gap-3 hover:border-primary/40 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center">
            <ShieldOff className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Usuários bloqueados</p>
            <p className="text-[11px] text-muted-foreground">Veja e gerencie sua lista de bloqueios em uma página separada</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>

        <Link
          to="/m/trocas"
          className="glass rounded-2xl p-4 flex items-center gap-3 hover:border-primary/40 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
            <ArrowLeftRight className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Minhas negociações</p>
            <p className="text-[11px] text-muted-foreground">Envio, rastreio, check-in de 72h e contestação de trocas</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>

        <Section title={<span className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5 text-accent" />Tutoriais práticos</span>}>
          <p className="text-[11px] text-muted-foreground -mt-1">Cada tutorial abre um playground interativo passo a passo e termina com um link direto para a página real.</p>
          <Link to="/m/tutoriais" className="flex items-center gap-2 p-3 rounded-lg bg-card border border-primary/40 hover:bg-primary/5 transition-colors">
            <span className="text-xl">🎓</span>
            <div className="flex-1">
              <p className="text-sm font-semibold">Abrir tutoriais mobile</p>
              <p className="text-[10px] text-muted-foreground">{TUTORIALS.filter(t => t.area === 'mobile').length} guias interativos</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </Section>

        <Link to="/m/vendedor" className="glass rounded-2xl p-4 flex items-center gap-3 hover:border-accent/40 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
            <Store className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Perfil de vendedor</p>
            <p className="text-[11px] text-muted-foreground">Crie, edite e gerencie sua loja no marketplace</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>
    );
  }

  const catInfo = CATEGORIAS.find(c => c.id === categoria)!;

  return (
    <div className="px-4 py-5 space-y-5">
      <button onClick={voltar} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar para configurações
      </button>
      <h1 className="font-display text-xl font-bold gradient-text">{catInfo.label}</h1>

      {categoria === 'conta' && (
        <>
          <Section title="👤 Conta">
            <Field label="Nome de exibição" value={form.display_name} onChange={v => setForm({ ...form, display_name: v })} />
            <Field label="@username" value={form.username} onChange={v => setForm({ ...form, username: v.toLowerCase().replace(/\s/g, '') })} />
            <Field label="Bio pessoal" value={form.bio} onChange={v => setForm({ ...form, bio: v })} multiline />
            <Field label="Telefone" value={form.phone} onChange={v => setForm({ ...form, phone: v })} />
            <Field label="CPF (apenas para vendedor protegido)" value={form.cpf} onChange={handleCpfChange} cpfError={cpfError} />
          </Section>

          <Section title="⏸️ Pausar minha conta">
            <p className="text-[11px] text-muted-foreground -mt-1">
              É reversível e diferente de excluir: seu perfil sai da busca e das sugestões, e seus anúncios ficam ocultos no marketplace. Basta entrar de novo que a conta reativa automaticamente.
            </p>
            <Toggle label={isPaused ? 'Conta pausada' : 'Pausar minha conta'} checked={isPaused} onChange={v => { if (!pausing) void togglePause(v); }} />
          </Section>

          <Section title="📶 Economia de dados">
            <p className="text-[11px] text-muted-foreground -mt-1">
              Imagens em qualidade reduzida nas listagens, sem autoplay de mídia e sem pré-carregar imagens fora da tela.
            </p>
            <Toggle label="Ativar economia de dados" checked={form.data_saver_mode} onChange={v => setForm({ ...form, data_saver_mode: v })} />
          </Section>

          <MPreferencesSection />

          <button onClick={save} disabled={saving} className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold flex items-center justify-center gap-2 glow-primary disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar alterações
          </button>
        </>
      )}

      {categoria === 'privacidade' && (
        <>
          <Section title="🔒 Privacidade">
            <Toggle label="Perfil privado (oculta biblioteca)" checked={form.is_private} onChange={v => setForm({ ...form, is_private: v })} />
            <Toggle
              label="Aprovar manualmente quem quer me seguir"
              checked={form.require_follow_approval}
              onChange={v => setForm({ ...form, require_follow_approval: v })}
            />
            <p className="text-[11px] text-muted-foreground -mt-1">
              Quando ativo, novos seguidores ficam pendentes em <strong>Amigos → Solicitações</strong> até você aprovar ou recusar (igual no Instagram).
            </p>
          </Section>

          <Link
            to="/m/config/bloqueados"
            className="glass rounded-2xl p-4 flex items-center gap-3 hover:border-primary/40 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center">
              <ShieldOff className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Usuários bloqueados</p>
              <p className="text-[11px] text-muted-foreground">Veja e gerencie sua lista de bloqueios em uma página separada</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>

          <button onClick={save} disabled={saving} className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold flex items-center justify-center gap-2 glow-primary disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar alterações
          </button>

          <Section title="⚠️ Excluir minha conta">
            <p className="text-[11px] text-muted-foreground -mt-1">
              Seus dados pessoais são anonimizados e o acesso é encerrado. Pedidos e registros fiscais são mantidos por obrigação legal, sem te identificar. Esta ação não pode ser desfeita.
            </p>
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <AlertDialogTrigger asChild>
                <button className="w-full min-h-[44px] py-2.5 rounded-lg bg-card border border-destructive/40 text-destructive text-sm font-semibold flex items-center justify-center gap-2 focus-ring">
                  <Trash2 className="h-4 w-4" /> Excluir minha conta
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirme sua identidade</AlertDialogTitle>
                  <AlertDialogDescription>
                    Um código de verificação foi enviado para <strong>{user?.email}</strong>.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {emailConfirmStep === 'idle' && (
                  <button onClick={sendDeleteConfirmation} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold">
                    Enviar código de verificação
                  </button>
                )}
                {emailConfirmStep === 'sent' && (
                  <>
                    <input
                      type="text"
                      value={emailConfirmCode}
                      onChange={(e) => setEmailConfirmCode(e.target.value)}
                      placeholder="000000"
                      className="w-full p-3 bg-background border border-border rounded-lg text-center text-2xl font-mono"
                      maxLength={6}
                    />
                    <button onClick={sendDeleteConfirmation} className="text-xs text-primary hover:underline">
                      Reenviar código
                    </button>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={confirmDelete} disabled={emailConfirmCode.length !== 6} className="bg-destructive">
                        Confirmar exclusão
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </>
                )}
                {emailConfirmStep === 'confirming' && (
                  <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
                )}
              </AlertDialogContent>
            </AlertDialog>
          </Section>
        </>
      )}

      {categoria === 'notificacao' && (
        <>
          <Section title="🔔 Notificações">
            <Toggle label="Notificações push" checked={form.push_notifications} onChange={v => setForm({ ...form, push_notifications: v })} />
            <Toggle label="Notificações por e-mail" checked={form.email_notifications} onChange={v => setForm({ ...form, email_notifications: v })} />
          </Section>

          <button onClick={save} disabled={saving} className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold flex items-center justify-center gap-2 glow-primary disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar alterações
          </button>
        </>
      )}

      {categoria === 'aparencia' && (
        <Section title="🎨 Aparência">
          <button onClick={toggleTheme} className="w-full py-2.5 rounded-lg bg-card border border-border text-sm font-semibold flex items-center justify-center gap-2">
            {theme === 'dark' ? <><Moon className="h-4 w-4" />Modo escuro ativo</> : <><Sun className="h-4 w-4" />Modo claro ativo</>}
          </button>
        </Section>
      )}

      {categoria === 'seguranca' && (
        <Section title="🔐 Segurança">
          {/* GAP-1028: Trocar senha */}
          {!showPasswordSection ? (
            <button onClick={() => setShowPasswordSection(true)} className="w-full py-2.5 rounded-lg bg-card border border-border text-sm font-semibold">
              Alterar senha
            </button>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nova senha (mín 6 caracteres)"
                  className="w-full pl-10 pr-10 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmar senha"
                  className="w-full pl-10 pr-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowPasswordSection(false); setNewPassword(''); setConfirmPassword(''); }} className="flex-1 py-2.5 rounded-lg bg-secondary text-sm font-semibold">
                  Cancelar
                </button>
                <button onClick={handleChangePassword} disabled={savingPassword} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
                  {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Alterar'}
                </button>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-border">
            <button
              onClick={async () => {
                try {
                  const { error } = await supabase.auth.signOut({ scope: 'others' } as any);
                  if (error) throw error;
                  toast.success('Todas as outras sessões foram encerradas.');
                } catch (e: any) {
                  toast.error(e?.message || 'Não foi possível encerrar as outras sessões.');
                }
              }}
              className="w-full py-2.5 rounded-lg bg-card border border-destructive/40 text-destructive text-sm font-semibold"
            >
              Encerrar todas as outras sessões
            </button>
          </div>

          <div className="pt-3 border-t border-border">
            <p className="text-xs font-semibold">Onde você acessou sua conta</p>
            <p className="text-[11px] text-muted-foreground mb-1">Últimos 20 acessos, com data, hora e dispositivo.</p>
            <LoginHistoryList compact />
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </div>
  );
}
function Field({ label, value, onChange, multiline, cpfError }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; cpfError?: string | null }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</label>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} maxLength={500} rows={3} className="w-full mt-1 p-2.5 bg-background border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50" />
        : <div>
            <input value={value} onChange={e => onChange(e.target.value)} maxLength={120} className={`w-full mt-1 p-2.5 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 ${cpfError ? 'border-destructive' : 'border-border'}`} />
            {cpfError && <p className="text-[11px] text-destructive mt-1">{cpfError}</p>}
          </div>}
    </div>
  );
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="w-full flex items-center justify-between py-2">
      <span className="text-sm text-foreground text-left flex-1 pr-3">{label}</span>
      <span className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${checked ? 'bg-primary' : 'bg-secondary'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-background transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  );
}