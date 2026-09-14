import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Store, Loader2, Save, ShieldCheck, Clock, AlertCircle, CheckCircle2, XCircle, Eye, EyeOff, ExternalLink, ShoppingBag, User, Users, Star, Calendar, Edit2, X, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { SellerSigil } from '@/components/HandleSigil';
import { HalfStarDisplay } from '@/components/HalfStarRating';
import { formatCurrency, formatDateTime } from '@/lib/format';
import EstadoVazio from '@/components/EstadoVazio';

interface SellerProfile {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  is_private: boolean;
  rating: number;
  total_sales: number;
  total_trades: number;
  vacation_mode: boolean;
  vacation_message: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CertStatus {
  status: 'none' | 'pending' | 'active' | 'revoked';
  created_at?: string;
  reviewed_at?: string;
}

export default function MVendedor() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [certStatus, setCertStatus] = useState<CertStatus>({ status: 'none' });
  const [activeAds, setActiveAds] = useState(0);
  const [vacationMode, setVacationMode] = useState(false);
  const [vacationMessage, setVacationMessage] = useState('');
  const [bio, setBio] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    const [{ data: sp }, { data: cert }, { count }] = await Promise.all([
      supabase
        .from('seller_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('certificados')
        .select('status, created_at, reviewed_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('anuncios')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', user.id)
        .eq('status', 'active'),
    ]);

    if (sp) {
      setSeller(sp);
      setDisplayName(sp.display_name || '');
      setBio(sp.bio || '');
      setVacationMode(!!sp.vacation_mode);
      setVacationMessage(sp.vacation_message || '');
      setIsPrivate(!!sp.is_private);
    }

    if (cert) {
      setCertStatus({
        status: cert.status as any,
        created_at: cert.created_at,
        reviewed_at: cert.reviewed_at,
      });
    }

    setActiveAds(count || 0);
    setLoading(false);
  };

  const save = async () => {
    if (!user || !seller) return;
    setSaving(true);
    const { error } = await supabase
      .from('seller_profiles')
      .update({
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        vacation_mode: vacationMode,
        vacation_message: vacationMessage.trim() || null,
        is_private: isPrivate,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('user_id', user.id);
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar');
      return;
    }
    toast.success('Perfil atualizado!');
    loadData();
  };

  const requestCert = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('certificados')
      .insert({ user_id: user.id, status: 'pendente' });
    if (error) {
      toast.error('Erro ao solicitar certificação');
      return;
    }
    toast.success('Solicitação enviada para análise');
    loadData();
  };

  const toggleVacation = () => {
    const newVal = !vacationMode;
    setVacationMode(newVal);
    if (!newVal) {
      setVacationMessage('');
    }
    setTimeout(() => save(), 100);
  };

  const deactivateSeller = async () => {
    if (!user || !seller) return;
    setDeactivating(true);
    const { error } = await supabase
      .from('seller_profiles')
      .update({ is_active: false, deactivated_at: new Date().toISOString() } as any)
      .eq('user_id', user.id);
    setDeactivating(false);
    setShowDeleteDialog(false);
    if (error) {
      toast.error('Erro ao desativar');
      return;
    }
    toast.success('Perfil de vendedor desativado');
    setSeller(null);
  };

  if (!user) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground mb-4">Entre para gerenciar seu perfil de vendedor.</p>
        <Link to="/m/auth" className="inline-block px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">Entrar</Link>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  // ONBOARDING - Sem perfil de vendedor
  if (!seller) {
    return (
      <div className="px-4 py-8">
        <Link to="/m/config" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Configurações
        </Link>
        <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-accent/15 flex items-center justify-center">
            <Store className="h-8 w-8 text-accent" />
          </div>
          <h1 className="text-2xl font-bold">Vire um vendedor</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Para vender no marketplace você precisa de um <b>perfil de vendedor</b> separado do seu perfil pessoal.
          </p>
          <button
            onClick={() => navigate('/m/marketplace/novo?onboard=true')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent text-accent-foreground font-semibold"
          >
            <Store className="h-4 w-4" /> Criar perfil de vendedor
          </button>
          <p className="text-xs text-muted-foreground">
            Você será redirecionado para criar seu primeiro anúncio.
          </p>
        </div>
      </div>
    );
  }

  // PERFIL DE VENDEDOR
  const isCertActive = certStatus.status === 'active';
  const isCertPending = certStatus.status === 'pending';
  const isCertRevoked = certStatus.status === 'revoked';
  const hasCert = isCertActive || isCertPending;

  const certIcon = isCertActive
    ? <CheckCircle2 className="h-4 w-4 text-success" />
    : isCertPending
    ? <Clock className="h-4 w-4 text-warning" />
    : <AlertCircle className="h-4 w-4 text-muted-foreground" />;

  const certLabel = isCertActive
    ? 'Verificado'
    : isCertPending
    ? 'Em análise'
    : 'Não verificado';

  const certColor = isCertActive
    ? 'text-success bg-success/10'
    : isCertPending
    ? 'text-warning bg-warning/10'
    : 'text-muted-foreground bg-muted/30';

  return (
    <div className="px-4 py-5 space-y-5 pb-24">
      <Link to="/m/config" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Configurações
      </Link>

      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-full bg-accent/15 overflow-hidden flex items-center justify-center">
          {seller.avatar_url ? (
            <img src={seller.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <Store className="h-7 w-7 text-accent" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold flex items-center gap-2">
            {seller.display_name || 'Vendedor'}
            <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">
              <SellerSigil /> Vendedor
            </span>
          </h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <span className="font-mono">${seller.handle}</span>
            <span className="text-xs">·</span>
            <span className="text-xs">{activeAds} anúncio(s) ativo(s)</span>
          </p>
          <div className="flex items-center gap-2 mt-1">
            <HalfStarDisplay rating={seller.rating || 0} size={12} />
            <span className="text-xs text-muted-foreground">
              {seller.rating > 0 ? seller.rating.toFixed(1) : 'sem avaliações'}
            </span>
          </div>
        </div>
        <Link
          to={"/vendedor/" + seller.handle}
          className="px-3 py-2 rounded-lg bg-secondary text-xs font-semibold flex items-center gap-1 shrink-0"
        >
          <ExternalLink className="h-3 w-3" /> Ver
        </Link>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase">Anúncios</p>
          <p className="text-xl font-bold">{activeAds}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase">Vendas</p>
          <p className="text-xl font-bold">{seller.total_sales || 0}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase">Trocas</p>
          <p className="text-xl font-bold">{seller.total_trades || 0}</p>
        </div>
      </div>

      {/* Certificação */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-success" />
            <span className="font-semibold text-sm">Certificação</span>
          </div>
          <span className={"text-xs px-2 py-0.5 rounded-full " + certColor + " flex items-center gap-1"}>
            {certIcon} {certLabel}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {isCertActive
            ? '✅ Você é um vendedor verificado. Anúncios protegidos são permitidos.'
            : isCertPending
            ? '⏳ Sua solicitação está em análise pela moderação.'
            : '🔒 Solicite verificação para poder criar anúncios protegidos.'}
        </p>
        {isCertPending && certStatus.created_at && (
          <p className="text-[10px] text-muted-foreground">
            Solicitado em {new Date(certStatus.created_at).toLocaleDateString('pt-BR')}
          </p>
        )}
        {!hasCert && (
          <button
            onClick={requestCert}
            className="w-full py-2 rounded-lg bg-success/10 text-success text-sm font-semibold"
          >
            Solicitar certificação
          </button>
        )}
      </div>

      {/* Modo Férias */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <span className="text-xl">🏖️</span> Modo Férias
            </h3>
            <p className="text-xs text-muted-foreground">
              Oculta todos os seus anúncios temporariamente.
            </p>
          </div>
          <button
            onClick={toggleVacation}
            className={"relative w-10 h-5 rounded-full transition-colors " + (vacationMode ? 'bg-warning' : 'bg-secondary')}
          >
            <span className={"absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-background transition-transform " + (vacationMode ? 'translate-x-5' : '')} />
          </button>
        </div>
        {vacationMode && (
          <div>
            <textarea
              value={vacationMessage}
              onChange={(e) => setVacationMessage(e.target.value)}
              rows={2}
              maxLength={200}
              placeholder="Mensagem opcional (ex: Volto em 10/01)"
              className="w-full px-3 py-2 bg-background border border-warning/40 rounded-lg text-sm resize-none"
            />
            <button onClick={save} className="mt-2 text-xs text-primary hover:underline">
              Salvar mensagem
            </button>
          </div>
        )}
      </div>

      {/* Edição */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Editar perfil</h3>
          <button onClick={() => setEditing(!editing)} className="text-xs text-primary flex items-center gap-1">
            <Edit2 className="h-3 w-3" /> {editing ? 'Fechar' : 'Editar'}
          </button>
        </div>
        {editing && (
          <>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Nome de exibição</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={60}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Bio comercial</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                maxLength={500}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none"
              />
            </div>
            <label className="flex items-center justify-between p-3 bg-muted/40 rounded-lg cursor-pointer">
              <span className="text-sm">Perfil privado</span>
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
            </label>
            <button
              onClick={save}
              disabled={saving}
              className="w-full py-2 rounded-lg bg-accent text-accent-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar alterações
            </button>
          </>
        )}
      </div>

      {/* Desativar */}
      <div className="bg-card border border-destructive/30 rounded-xl p-4">
        <button
          onClick={() => setShowDeleteDialog(true)}
          className="flex items-center gap-2 text-sm font-semibold text-destructive hover:text-destructive/80"
        >
          <XCircle className="h-4 w-4" />
          Desativar perfil de vendedor
        </button>
        <p className="text-xs text-muted-foreground mt-1">
          Seus anúncios serão ocultados e você não poderá criar novos.
        </p>
      </div>

      {/* Atalhos */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          to="/m/marketplace/novo"
          className="flex items-center gap-2 p-3 bg-card border border-border rounded-xl text-sm font-semibold hover:border-primary/40 transition-colors"
        >
          <ShoppingBag className="h-4 w-4 text-primary" /> Novo anúncio
        </Link>
        <Link
          to="/m/trocas"
          className="flex items-center gap-2 p-3 bg-card border border-border rounded-xl text-sm font-semibold hover:border-primary/40 transition-colors"
        >
          <Users className="h-4 w-4 text-accent" /> Negociações
        </Link>
      </div>

      {/* Dialog de desativação */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 overlay-scrim flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-bold text-center">Desativar perfil?</h3>
            <p className="text-sm text-muted-foreground text-center">
              Seus anúncios serão ocultados e você não poderá criar novos. Você pode reativar a qualquer momento.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="flex-1 py-2 rounded-lg bg-secondary text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={deactivateSeller}
                disabled={deactivating}
                className="flex-1 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold disabled:opacity-50"
              >
                {deactivating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Desativar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}