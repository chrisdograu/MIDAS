import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Store, Loader2, Camera, Save, ArrowLeft, Trash2, AlertTriangle, Instagram, Twitter, Globe, Clock, Image, X } from 'lucide-react';
import { toast } from 'sonner';
import { stripImageExif } from '@/lib/stripImageExif';
import { motion } from 'framer-motion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { dbWrite } from '@/lib/dbWrite';

/**
 * Página de criação/edição do perfil vendedor ($).
 * Acessada via /vendedor/criar (criar) ou /vendedor/editar (editar próprio).
 */
export default function CriarVendedor({ mode = 'create' }: { mode?: 'create' | 'edit' }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [existing, setExisting] = useState<any>(null);

  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  
  // GAP-463: Banner
  const [bannerUrl, setBannerUrl] = useState('');
  
  // GAP-464: Horário de atendimento
  const [businessHours, setBusinessHours] = useState({
    monday: { open: '09:00', close: '18:00', enabled: true },
    tuesday: { open: '09:00', close: '18:00', enabled: true },
    wednesday: { open: '09:00', close: '18:00', enabled: true },
    thursday: { open: '09:00', close: '18:00', enabled: true },
    friday: { open: '09:00', close: '18:00', enabled: true },
    saturday: { open: '10:00', close: '14:00', enabled: false },
    sunday: { open: '', close: '', enabled: false },
  });
  const [showHours, setShowHours] = useState(false);
  
  // GAP-465: Redes sociais
  const [socialLinks, setSocialLinks] = useState({
    instagram: '',
    twitter: '',
    website: '',
    youtube: '',
  });

  // GAP-462: Exclusão
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // GAP-461: Validação de handle em tempo real
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [checkingHandle, setCheckingHandle] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('seller_profiles').select('*').eq('user_id', user.id).maybeSingle();
      if (data) {
        setExisting(data);
        setHandle(data.handle);
        setDisplayName(data.display_name);
        setBio(data.bio || '');
        setAvatarUrl(data.avatar_url || '');
        setIsPrivate(data.is_private);
        // GAP-463: Banner
        setBannerUrl(data.banner_url || '');
        // GAP-464: Horário
        if (data.business_hours) {
          try {
            setBusinessHours(JSON.parse(data.business_hours));
          } catch { /* ignore */ }
        }
        // GAP-465: Redes sociais
        if (data.social_links) {
          try {
            setSocialLinks(JSON.parse(data.social_links));
          } catch { /* ignore */ }
        }
        if (mode === 'create') {
          navigate(`/vendedor/${data.handle}`, { replace: true });
          return;
        }
      }
      setLoading(false);
    })();
  }, [user?.id, mode]);

  // GAP-461: Verificar disponibilidade do handle
  useEffect(() => {
    if (!handle || handle.length < 2) {
      setHandleAvailable(null);
      return;
    }
    
    const checkHandle = async () => {
      setCheckingHandle(true);
      // Se for edição e o handle não mudou, considera disponível
      if (existing && existing.handle === handle) {
        setHandleAvailable(true);
        setCheckingHandle(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('seller_profiles')
        .select('handle')
        .ilike('handle', handle)
        .maybeSingle();
      
      setCheckingHandle(false);
      setHandleAvailable(!data);
    };
    
    const timeout = setTimeout(checkHandle, 300);
    return () => clearTimeout(timeout);
  }, [handle, existing]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (!raw || !user) return;
    if (raw.size > 2 * 1024 * 1024) { toast.error('Imagem deve ter no máximo 2MB'); return; }
    setUploading(true);
    const file = await stripImageExif(raw);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/seller.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) { toast.error('Erro ao enviar imagem'); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    setAvatarUrl(publicUrl + `?t=${Date.now()}`);
    setUploading(false);
  };

  // GAP-463: Upload de banner
  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (!raw || !user) return;
    if (raw.size > 5 * 1024 * 1024) { toast.error('Banner deve ter no máximo 5MB'); return; }
    setUploadingBanner(true);
    const file = await stripImageExif(raw);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/banner.${ext}`;
    const { error } = await supabase.storage.from('banners').upload(path, file, { upsert: true });
    if (error) { toast.error('Erro ao enviar banner'); setUploadingBanner(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('banners').getPublicUrl(path);
    setBannerUrl(publicUrl + `?t=${Date.now()}`);
    setUploadingBanner(false);
  };

  // GAP-462: Excluir perfil vendedor
  const handleDelete = async () => {
    if (!user || !existing) return;
    setDeleting(true);
    
    // Desativar anúncios ativos
    await supabase
      .from('anuncios')
      .update({ status: 'inactive' })
      .eq('seller_id', user.id);
    
    // Remover perfil vendedor
    const { error } = await supabase
      .from('seller_profiles')
      .delete()
      .eq('user_id', user.id);
    
    setDeleting(false);
    setShowDeleteDialog(false);
    
    if (error) {
      toast.error('Erro ao excluir perfil vendedor');
      return;
    }
    
    toast.success('Perfil vendedor excluído');
    navigate('/perfil');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(handle)) {
      toast.error('Handle inválido (2-32 caracteres, letras/números/._-)'); 
      return;
    }
    
    // GAP-461: Verificar disponibilidade do handle
    if (handleAvailable === false) {
      toast.error('Este handle já está em uso');
      return;
    }
    
    if (!displayName.trim()) { toast.error('Informe um nome de vendedor'); return; }
    setSaving(true);
    
    const payload = {
      user_id: user.id,
      handle: handle.toLowerCase(),
      display_name: displayName.trim(),
      bio: bio.trim() || null,
      avatar_url: avatarUrl || null,
      is_private: isPrivate,
      // GAP-463: Banner
      banner_url: bannerUrl || null,
      // GAP-464: Horário
      business_hours: JSON.stringify(businessHours),
      // GAP-465: Redes sociais
      social_links: JSON.stringify(socialLinks),
    };
    
    const { error } = existing
      ? await supabase.from('seller_profiles').update(payload).eq('user_id', user.id)
      : await supabase.from('seller_profiles').insert(payload);
    
    setSaving(false);
    if (error) {
      if (error.code === '23505') toast.error('Este $handle já está em uso');
      else toast.error('Erro ao salvar perfil vendedor');
      return;
    }
    toast.success(existing ? 'Perfil vendedor atualizado!' : 'Perfil vendedor criado! 🎉');
    navigate(`/vendedor/${payload.handle}`);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  // GAP-461: Status do handle
  const getHandleStatus = () => {
    if (checkingHandle) return { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, color: 'text-muted-foreground' };
    if (handleAvailable === true) return { icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: 'text-success' };
    if (handleAvailable === false) return { icon: <AlertTriangle className="h-3.5 w-3.5" />, color: 'text-destructive' };
    return null;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-xl">
      <button onClick={() => navigate(-1)} className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center">
            <Store className="h-6 w-6 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">
              {existing ? 'Editar perfil de vendedor' : 'Criar perfil de vendedor'}
            </h1>
            <p className="text-sm text-muted-foreground">Perfil exclusivo para o marketplace, separado do seu perfil pessoal.</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-5 bg-card border border-border rounded-xl p-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center overflow-hidden border-2 border-border">
                {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" loading="lazy" /> : <Store className="h-9 w-9 text-accent" />}
              </div>
              <label className="absolute inset-0 rounded-full bg-overlay/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin text-primary-foreground" /> : <Camera className="h-5 w-5 text-primary-foreground" />}
                <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
              </label>
            </div>
            <div className="text-xs text-muted-foreground">
              Pode ser uma foto totalmente diferente do seu @perfil pessoal.
            </div>
          </div>

          {/* GAP-463: Banner */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Banner da loja</label>
            <div className="relative group">
              <div className="w-full h-32 bg-secondary rounded-lg overflow-hidden border border-border">
                {bannerUrl ? (
                  <img src={bannerUrl} alt="Banner da loja" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <Image className="h-8 w-8" />
                  </div>
                )}
                <label className="absolute inset-0 bg-overlay/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition">
                  {uploadingBanner ? <Loader2 className="h-5 w-5 animate-spin text-primary-foreground" /> : <Camera className="h-5 w-5 text-primary-foreground" />}
                  <input type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" />
                </label>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Recomendado: 1200x300px, max 5MB</p>
          </div>

          {/* Handle com validação em tempo real */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Handle do vendedor</label>
            <div className={`flex items-center bg-secondary border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-accent/50 ${existing ? 'border-border' : handleAvailable === false ? 'border-destructive' : handleAvailable === true ? 'border-success' : 'border-border'}`}>
              <span className="px-3 text-accent font-bold">$</span>
              <input
                value={handle}
                onChange={e => setHandle(e.target.value.replace(/[^a-zA-Z0-9_.-]/g, ''))}
                placeholder="suaLoja"
                disabled={!!existing}
                className="flex-1 py-2.5 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
              />
              {!existing && (
                <div className="px-3">
                  {getHandleStatus()?.icon}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              2-32 caracteres. 
              {!existing && handleAvailable === true && <span className="text-success"> ✅ Disponível</span>}
              {!existing && handleAvailable === false && <span className="text-destructive"> ❌ Indisponível</span>}
            </p>
          </div>

          {/* Nome */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Nome de exibição</label>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Ex: Loja do João"
              className="w-full px-4 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Bio / descrição</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Conte sobre sua loja..."
              rows={3}
              className="w-full px-4 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
            />
          </div>

          {/* GAP-464: Horário de atendimento */}
          <div>
            <button
              type="button"
              onClick={() => setShowHours(!showHours)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Clock className="h-4 w-4" />
              {showHours ? 'Ocultar horário de atendimento' : 'Adicionar horário de atendimento'}
            </button>
            {showHours && (
              <div className="mt-3 space-y-2 p-3 bg-secondary/40 rounded-lg">
                {Object.entries(businessHours).map(([day, hours]) => (
                  <div key={day} className="flex items-center gap-2 text-sm">
                    <span className="w-20 capitalize">{day}</span>
                    <input
                      type="checkbox"
                      checked={hours.enabled}
                      onChange={(e) => setBusinessHours(prev => ({
                        ...prev,
                        [day]: { ...prev[day as keyof typeof prev], enabled: e.target.checked }
                      }))}
                      className="h-3.5 w-3.5 accent-accent"
                    />
                    <input
                      type="time"
                      value={hours.open}
                      disabled={!hours.enabled}
                      onChange={(e) => setBusinessHours(prev => ({
                        ...prev,
                        [day]: { ...prev[day as keyof typeof prev], open: e.target.value }
                      }))}
                      className="px-2 py-1 bg-background border border-border rounded text-xs disabled:opacity-50"
                    />
                    <span>—</span>
                    <input
                      type="time"
                      value={hours.close}
                      disabled={!hours.enabled}
                      onChange={(e) => setBusinessHours(prev => ({
                        ...prev,
                        [day]: { ...prev[day as keyof typeof prev], close: e.target.value }
                      }))}
                      className="px-2 py-1 bg-background border border-border rounded text-xs disabled:opacity-50"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* GAP-465: Redes sociais */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Redes sociais</label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Instagram className="h-4 w-4 text-muted-foreground" />
                <input
                  value={socialLinks.instagram}
                  onChange={e => setSocialLinks(prev => ({ ...prev, instagram: e.target.value }))}
                  placeholder="@seuinstagram"
                  className="flex-1 px-3 py-1.5 bg-secondary border border-border rounded-lg text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Twitter className="h-4 w-4 text-muted-foreground" />
                <input
                  value={socialLinks.twitter}
                  onChange={e => setSocialLinks(prev => ({ ...prev, twitter: e.target.value }))}
                  placeholder="@seutwitter"
                  className="flex-1 px-3 py-1.5 bg-secondary border border-border rounded-lg text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <input
                  value={socialLinks.website}
                  onChange={e => setSocialLinks(prev => ({ ...prev, website: e.target.value }))}
                  placeholder="https://seusite.com"
                  className="flex-1 px-3 py-1.5 bg-secondary border border-border rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          {/* Privacidade */}
          <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
            <div>
              <p className="text-sm font-medium text-foreground">Perfil vendedor privado</p>
              <p className="text-xs text-muted-foreground">Quem chegar via anúncio ainda consegue ver.</p>
            </div>
            <input type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} className="h-4 w-4 accent-accent" />
          </div>

          <button
            type="submit"
            disabled={saving || handleAvailable === false}
            className="w-full py-3 bg-accent text-accent-foreground font-semibold rounded-lg flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {existing ? 'Salvar alterações' : 'Criar perfil vendedor'}
          </button>

          {/* GAP-462: Excluir perfil vendedor */}
          {existing && (
            <button
              type="button"
              onClick={() => setShowDeleteDialog(true)}
              className="w-full py-2 text-sm text-destructive hover:text-destructive/80 flex items-center justify-center gap-2 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Excluir perfil vendedor
            </button>
          )}
        </form>

        {/* GAP-462: Dialog de confirmação */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" /> Excluir perfil vendedor?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Ao excluir seu perfil de vendedor:
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Seus anúncios ativos serão desativados</li>
                  <li>Seu histórico de vendas será removido</li>
                  <li>Você não poderá criar novos anúncios</li>
                  <li>Esta ação não pode ser desfeita</li>
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Sim, excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </div>
  );
}