import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { User, Save, Loader2, Camera, Lock, Bell, Eye, EyeOff, Shield, Ban, Star, Heart, Sparkles, Clock, Palette, ChevronRight, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { stripImageExif } from '@/lib/stripImageExif';
import { motion, AnimatePresence } from 'framer-motion';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import MyReviewsTab from '@/components/perfil/MyReviewsTab';
import FriendFavoritesTab from '@/components/perfil/FriendFavoritesTab';
import HighlightsEditor from '@/components/perfil/HighlightsEditor';
import CustomizacaoTab from '@/components/perfil/CustomizacaoTab';
import { CosmeticUnlocksCenter } from '@/components/cosmetics/CosmeticUnlocksCenter';
import { useTheme } from '@/hooks/useTheme';
import { Moon, Sun } from 'lucide-react';
import LevelTitleBadge from '@/components/LevelTitleBadge';
import ActiveTitleSelector from '@/components/ActiveTitleSelector';
import SellerProfileSwitcher from '@/components/seller/SellerProfileSwitcher';
import PreferencesPanel from '@/components/perfil/PreferencesPanel';
import { formatDateTime } from '@/lib/format';
import { dbWrite } from '@/lib/dbWrite';

type Categoria = 'menu' | 'conta' | 'privacidade' | 'notificacao' | 'aparencia' | 'seguranca';

const CATEGORIAS: { id: Categoria; label: string; desc: string; icon: any }[] = [
  { id: 'conta', label: 'Conta', desc: 'Dados pessoais, destaques, amigos favoritos e reviews', icon: User },
  { id: 'privacidade', label: 'Privacidade', desc: 'Visibilidade do perfil, bloqueios e exceções', icon: Shield },
  { id: 'notificacao', label: 'Notificação', desc: 'Alertas por push e por e-mail', icon: Bell },
  { id: 'aparencia', label: 'Aparência', desc: 'Banner, cor de destaque e vitrine de troféus', icon: Palette },
  { id: 'seguranca', label: 'Segurança', desc: 'Senha e sessões ativas', icon: Lock },
];

// GAP-037, GAP-150, GAP-563: Validação de CPF
function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return false;
  // Verificar se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cleaned)) return false;
  // Validar primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i);
  let firstDigit = 11 - (sum % 11);
  if (firstDigit >= 10) firstDigit = 0;
  if (firstDigit !== parseInt(cleaned[9])) return false;
  // Validar segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i);
  let secondDigit = 11 - (sum % 11);
  if (secondDigit >= 10) secondDigit = 0;
  return secondDigit === parseInt(cleaned[10]);
}

// GAP-151, GAP-564: Validação de telefone
function validatePhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  // Aceita (11) 99999-9999 ou 11999999999
  return cleaned.length >= 10 && cleaned.length <= 11;
}

// GAP-038: Componente de progresso do perfil
function ProfileProgress({ percentage }: { percentage: number }) {
  const isComplete = percentage === 100;
  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isComplete ? (
            <CheckCircle2 className="h-4 w-4 text-success" />
          ) : (
            <AlertCircle className="h-4 w-4 text-warning" />
          )}
          <span className="text-sm font-medium text-foreground">
            {isComplete ? 'Perfil completo!' : `Perfil ${percentage}% completo`}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{percentage}%</span>
      </div>
      <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 rounded-full ${isComplete ? 'bg-success' : 'bg-primary'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {!isComplete && (
        <p className="text-xs text-muted-foreground mt-2">
          Complete seu perfil adicionando: {percentage < 30 ? 'avatar, nome, bio' : percentage < 60 ? 'telefone, CPF' : 'últimos detalhes'}
        </p>
      )}
    </div>
  );
}

// GAP-035: Verificar se pode alterar o nome
function canChangeName(lastNameChange: string | null): { can: boolean; daysLeft: number } {
  if (!lastNameChange) return { can: true, daysLeft: 0 };
  const lastChange = new Date(lastNameChange);
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff >= 30) return { can: true, daysLeft: 0 };
  return { can: false, daysLeft: 30 - daysDiff };
}

export default function Perfil() {
  const { theme, toggleTheme } = useTheme();
  const { user, profile, updatePassword } = useAuth();
  const [categoria, setCategoria] = useState<Categoria>('menu');
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [bannedUntil, setBannedUntil] = useState<string | null>(null);
  const [sellerHandle, setSellerHandle] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // GAP-035: Última alteração de nome
  const [lastNameChange, setLastNameChange] = useState<string | null>(null);
  const [nameChangeError, setNameChangeError] = useState<string | null>(null);

  // GAP-038: Progresso do perfil
  const [profileProgress, setProfileProgress] = useState(0);

  // GAP-037, GAP-150, GAP-563: Erros de validação
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // GAP-154, GAP-567: Link para perfil público
  const [publicProfileUrl, setPublicProfileUrl] = useState<string | null>(null);

  // Alteração de senha
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // GAP-154, GAP-567: Buscar handle para perfil público
  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.username) {
            setPublicProfileUrl(`/perfil/${data.username}`);
          } else {
            setPublicProfileUrl(`/perfil/${user.id}`);
          }
        });
    }
  }, [user]);

  useEffect(() => {
    if (!user || loaded) return;
    (supabase as any).rpc('get_my_profile').then(({ data }: any) => {
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setDisplayName(row.display_name || '');
        setUsername(row.username || '');
        setPhone(row.phone || '');
        setCpf(row.cpf || '');
        setAvatarUrl(row.avatar_url || '');
        setIsPrivate(row.is_private || false);
        setPushNotifications(row.push_notifications ?? true);
        setEmailNotifications(row.email_notifications ?? false);
        setBannedUntil(row.banned_until || null);
        setLastNameChange(row.last_name_change || null);

        let progress = 0;
        if (row.avatar_url) progress += 20;
        if (row.display_name && row.display_name.length > 0) progress += 20;
        if (row.username && row.username.length > 0) progress += 20;
        if (row.phone && row.phone.length > 0) progress += 20;
        if (row.cpf && row.cpf.length > 0) progress += 20;
        setProfileProgress(progress);
      }
      setLoaded(true);
    });
    supabase.from('seller_profiles').select('handle').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      setSellerHandle(data?.handle || null);
    });
  }, [user, loaded]);

  // GAP-037, GAP-150, GAP-563: Validar CPF
  const handleCpfChange = (value: string) => {
    setCpf(value);
    if (value && !validateCPF(value)) {
      setCpfError('CPF inválido');
    } else {
      setCpfError(null);
    }
  };

  // GAP-151, GAP-564: Validar telefone
  const handlePhoneChange = (value: string) => {
    setPhone(value);
    if (value && !validatePhone(value)) {
      setPhoneError('Telefone inválido (ex: 11999999999)');
    } else {
      setPhoneError(null);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (!raw || !user) return;
    if (raw.size > 2 * 1024 * 1024) { toast.error('Imagem deve ter no máximo 2mb'); return; }
    setUploading(true);
    const file = await stripImageExif(raw);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadError) { toast.error('Erro ao enviar imagem'); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    setAvatarUrl(publicUrl);
    await dbWrite(supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id));
    toast.success('Avatar atualizado!');
    setUploading(false);
  };

  const handleSave = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault?.();
    e.preventDefault();
    if (!user) return;

    // GAP-037, GAP-150, GAP-563: Validar CPF antes de salvar
    if (cpf && !validateCPF(cpf)) {
      toast.error('CPF inválido');
      return;
    }

    // GAP-151, GAP-564: Validar telefone antes de salvar
    if (phone && !validatePhone(phone)) {
      toast.error('Telefone inválido');
      return;
    }

    // GAP-035: Validar bloqueio de alteração de nome
    const nameChangeStatus = canChangeName(lastNameChange);
    if (!nameChangeStatus.can && displayName !== profile?.display_name) {
      toast.error(`Você pode alterar seu nome novamente em ${nameChangeStatus.daysLeft} dias`);
      return;
    }

    setSaving(true);

    const updateData: any = {
      display_name: displayName,
      username: username || null,
      phone: phone || null,
      cpf: cpf || null,
      is_private: isPrivate,
      push_notifications: pushNotifications,
      email_notifications: emailNotifications,
    };

    // GAP-035: Se o nome mudou, registrar a data
    if (displayName !== profile?.display_name) {
      updateData.last_name_change = new Date().toISOString();
    }

    const { error } = await supabase.from('profiles').update(updateData).eq('id', user.id);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar perfil'); return; }
    toast.success('Perfil atualizado!');

    // Atualizar estado local
    if (displayName !== profile?.display_name) {
      setLastNameChange(new Date().toISOString());
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error('A senha deve ter no mínimo 6 caracteres'); return; }
    if (newPassword !== confirmPassword) { toast.error('As senhas não coincidem'); return; }
    setSavingPassword(true);
    const result = await updatePassword(newPassword);
    setSavingPassword(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success('Senha alterada com sucesso!');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordSection(false);
  };

  const voltar = () => setCategoria('menu');

  // GAP-035: Verificar se pode alterar nome
  const nameChangeStatus = canChangeName(lastNameChange);
  const isNameLocked = !nameChangeStatus.can && displayName === profile?.display_name;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {categoria === 'menu' ? (
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-foreground">Minha conta</h1>
            {/* GAP-154, GAP-567: Botão "Ver perfil público" */}
            {publicProfileUrl && (
              <Link
                to={publicProfileUrl}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <User className="h-4 w-4" /> Ver perfil público
              </Link>
            )}
          </div>
        ) : (
          <button onClick={voltar} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-4 w-4" /> Voltar para configurações
          </button>
        )}

        {bannedUntil && new Date(bannedUntil) > new Date() && (
          <div className="mb-6 p-4 rounded-xl border border-destructive/40 bg-destructive/10 flex items-start gap-3">
            <Ban className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">Sua conta está suspensa</p>
              <p className="text-xs text-muted-foreground mt-1">
                Você não pode criar anúncios, postar no fórum ou enviar mensagens até{' '}
                <span className="font-medium text-foreground">
                  {formatDateTime(bannedUntil)}
                </span>.
              </p>
            </div>
          </div>
        )}

        {/* GAP-038: Barra de progresso do perfil */}
        {loaded && categoria === 'menu' && (
          <ProfileProgress percentage={profileProgress} />
        )}

        <AnimatePresence mode="wait">
          {categoria === 'menu' && (
            <motion.div key="menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SellerProfileSwitcher
                userId={user?.id}
                personalHandle={username || displayName}
                sellerHandle={sellerHandle}
                hasSeller={!!sellerHandle}
                isOwn
              />

              <div className="space-y-3 mt-4">
                {CATEGORIAS.map(cat => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setCategoria(cat.id)}
                      className="w-full flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:border-primary/40 transition-colors text-left"
                    >
                      <Icon className="h-5 w-5 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{cat.label}</p>
                        <p className="text-xs text-muted-foreground">{cat.desc}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>

              <Link to="/privacidade" className="mt-3 flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:border-primary/40 transition-colors">
                <Shield className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">Central de privacidade e segurança</p>
                  <p className="text-xs text-muted-foreground">Visibilidade, notificações, bloqueios e exceções num só lugar</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </motion.div>
          )}

          {categoria === 'conta' && (
            <motion.div key="conta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative group">
                    <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden border-2 border-border">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <User className="h-10 w-10 text-primary" />
                      )}
                    </div>
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                      className="absolute inset-0 rounded-full bg-overlay/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      {uploading ? <Loader2 className="h-5 w-5 animate-spin text-primary-foreground" /> : <Camera className="h-5 w-5 text-primary-foreground" />}
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{displayName || 'Usuário'}</p>
                    <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                    {user && <div className="mt-2"><LevelTitleBadge userId={user.id} variant="card" /></div>}
                  </div>
                </div>

                <form onSubmit={handleSave} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Nome de exibição</label>
                      <input
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        className={`w-full px-4 py-2.5 bg-secondary border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${isNameLocked ? 'border-warning/50 bg-warning/5' : 'border-border'}`}
                      />
                      {/* GAP-035: Aviso de bloqueio de alteração de nome */}
                      {isNameLocked && (
                        <p className="text-xs text-warning mt-1">
                          ⚠️ Você pode alterar seu nome novamente em {nameChangeStatus.daysLeft} dias
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Username</label>
                      <input
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        placeholder="@seuusuario"
                        className="w-full px-4 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Telefone</label>
                      <input
                        value={phone}
                        onChange={e => handlePhoneChange(e.target.value)}
                        placeholder="(11) 99999-9999"
                        className={`w-full px-4 py-2.5 bg-secondary border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${phoneError ? 'border-destructive' : 'border-border'}`}
                      />
                      {phoneError && <p className="text-xs text-destructive mt-1">{phoneError}</p>}
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">CPF</label>
                      <input
                        value={cpf}
                        onChange={e => handleCpfChange(e.target.value)}
                        placeholder="000.000.000-00"
                        className={`w-full px-4 py-2.5 bg-secondary border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${cpfError ? 'border-destructive' : 'border-border'}`}
                      />
                      {cpfError && <p className="text-xs text-destructive mt-1">{cpfError}</p>}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">E-mail</label>
                    <input value={user?.email || ''} disabled
                      className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm text-muted-foreground" />
                  </div>
                  <button type="submit" disabled={saving || isNameLocked}
                    className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar alterações
                  </button>
                </form>
              </div>

              {user && (
                <div className="bg-card border border-border rounded-xl p-6">
                  <ActiveTitleSelector userId={user.id} />
                </div>
              )}

              <PreferencesPanel />

              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" /> Destaques do perfil
                  </h2>
                  <Link to="/perfil/timeline" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Ver minha timeline
                  </Link>
                </div>
                <div className="mt-4"><HighlightsEditor /></div>
              </div>

              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Star className="h-4 w-4 text-warning" /> Amigos favoritos
                </h2>
                <FriendFavoritesTab />
              </div>

              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-base font-semibold text-foreground mb-4">Minhas avaliações</h2>
                <MyReviewsTab />
              </div>
            </motion.div>
          )}

          {categoria === 'privacidade' && (
            <motion.div key="privacidade" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
                  <Shield className="h-4 w-4 text-primary" /> Privacidade
                </h2>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Perfil privado</p>
                    <p className="text-xs text-muted-foreground">Sua biblioteca e perfil não ficam visíveis para outros usuários</p>
                  </div>
                  <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
                </div>
              </div>

              <Link to="/privacidade" className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:border-primary/40 transition-colors">
                <Shield className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">Visibilidade avançada, bloqueios e exceções</p>
                  <p className="text-xs text-muted-foreground">Controle detalhado de quem vê cada parte do seu perfil</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>

              <button onClick={handleSave} disabled={saving}
                className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar alterações
              </button>
            </motion.div>
          )}

          {categoria === 'notificacao' && (
            <motion.div key="notificacao" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
                  <Bell className="h-4 w-4 text-primary" /> Notificações
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Notificações push</p>
                      <p className="text-xs text-muted-foreground">Receber alertas no navegador/app</p>
                    </div>
                    <Switch checked={pushNotifications} onCheckedChange={setPushNotifications} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Notificações por e-mail</p>
                      <p className="text-xs text-muted-foreground">Receber resumos e alertas por e-mail</p>
                    </div>
                    <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
                  </div>
                </div>
              </div>

              <Link to="/privacidade" className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:border-primary/40 transition-colors">
                <Bell className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">Preferências detalhadas por tipo de notificação</p>
                  <p className="text-xs text-muted-foreground">Social, fórum, torneios e biblioteca social</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>

              <button onClick={handleSave} disabled={saving}
                className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar alterações
              </button>
            </motion.div>
          )}

          {categoria === 'aparencia' && (
            <motion.div key="aparencia" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Palette className="h-4 w-4 text-primary" /> Personalização visual
                  </h2>
                  <CosmeticUnlocksCenter variant="full" customizationHref="/perfil" />
                </div>
                <p className="text-xs text-muted-foreground mb-4">Banner, cor de destaque e vitrine de troféus do seu perfil público.</p>
                <div className="flex items-center justify-between gap-3 mb-4 p-3 rounded-lg bg-secondary/40 border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground flex items-center gap-2">
                      {theme === 'dark' ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
                      Modo {theme === 'dark' ? 'escuro' : 'claro'}
                    </p>
                    <p className="text-xs text-muted-foreground">O modo claro mantém a estética neon com vidro branco e contraste acessível.</p>
                  </div>
                  <Switch
                    checked={theme === 'light'}
                    onCheckedChange={() => toggleTheme()}
                    aria-label="Alternar entre modo claro e escuro"
                  />
                </div>
                <CustomizacaoTab />
              </div>
            </motion.div>
          )}

          {categoria === 'seguranca' && (
            <motion.div key="seguranca" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
                  <Lock className="h-4 w-4 text-primary" /> Segurança
                </h2>
                {!showPasswordSection ? (
                  <button onClick={() => setShowPasswordSection(true)}
                    className="text-sm text-primary hover:underline">
                    Alterar senha
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="relative">
                      <label className="text-sm text-muted-foreground mb-1 block">Nova senha</label>
                      <input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full px-4 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 pr-10" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-8 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Confirmar nova senha</label>
                      <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Repita a senha"
                        className="w-full px-4 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleChangePassword} disabled={savingPassword || !newPassword}
                        className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                        {savingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
                        Alterar senha
                      </button>
                      <button onClick={() => { setShowPasswordSection(false); setNewPassword(''); setConfirmPassword(''); }}
                        className="px-4 py-2 bg-secondary text-foreground text-sm rounded-lg hover:bg-muted">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">
                    Se você acha que sua conta pode estar sendo usada em outro dispositivo, encerre todas as outras sessões.
                  </p>
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
                    className="text-sm text-destructive hover:underline"
                  >
                    Encerrar todas as outras sessões
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}