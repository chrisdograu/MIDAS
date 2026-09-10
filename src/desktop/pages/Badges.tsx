import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2, Trash2, Award, UserPlus, Crown, Upload, Edit, Users, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDate } from '@/lib/format';
import { adminLog } from '../lib/adminLog';

// GAP-D28: Categorias com cores
const CATEGORIES = [
  { value: 'store', label: '🛒 Loja & Compras', color: 'text-blue-400' },
  { value: 'community', label: '💬 Comunidade', color: 'text-green-400' },
  { value: 'level', label: '📈 Nível & XP', color: 'text-purple-400' },
  { value: 'tournament', label: '🏆 Torneios', color: 'text-yellow-400' },
  { value: 'special', label: '⭐ Especiais', color: 'text-red-400' },
  { value: 'custom', label: '🎨 Personalizados', color: 'text-pink-400' },
];

// GAP-D30: Regras de desbloqueio
const UNLOCK_RULES = [
  { value: 'xp', label: 'XP mínimo' },
  { value: 'achievement', label: 'Conquista específica' },
  { value: 'playtime', label: 'Horas jogadas' },
  { value: 'purchase', label: 'Compra na loja' },
  { value: 'tournament_win', label: 'Vitória em torneio' },
  { value: 'manual', label: 'Atribuição manual (admin)' },
];

interface Badge {
  id: string; name: string; description: string; icon: string; category: string;
  image_url?: string | null; is_custom?: boolean | null;
  unlock_rule?: string | null; unlock_value?: number | null;
  assigned_count?: number;
}

interface UserTitle {
  id: string; user_id: string; name: string; source: string; awarded_at: string;
  unlock_rule?: string | null; unlock_value?: number | null;
  display_name?: string | null;
}

interface UserBadge {
  id: string; user_id: string; badge_id: string;
  assigned_by?: string | null; assigned_at: string;
  user_name?: string;
}

export default function BadgesAdmin() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [titles, setTitles] = useState<(UserTitle & { display_name?: string | null })[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null);
  const [assignOpen, setAssignOpen] = useState<Badge | null>(null);
  const [titleOpen, setTitleOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState<UserTitle | null>(null);
  const [form, setForm] = useState<any>({
    id: '', name: '', description: '', icon: '🏆', category: 'special',
    is_custom: true, image_url: '', unlock_rule: 'manual', unlock_value: 0
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [titleForm, setTitleForm] = useState({
    name: '', user_email: '', unlock_rule: 'manual', unlock_value: 0
  });
  const [assignEmail, setAssignEmail] = useState('');
  const [assignUsers, setAssignUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [previewBadge, setPreviewBadge] = useState<Badge | null>(null);
  const [searchUser, setSearchUser] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('badges');

  const load = async () => {
    setLoading(true);
    const [
      { data: bs },
      { data: ts },
      { data: ub }
    ] = await Promise.all([
      supabase.from('badge_catalog').select('*').order('category').order('id'),
      supabase.from('user_titles').select('*').order('awarded_at', { ascending: false }).limit(100),
      supabase.from('user_badges').select('*, assigned_by').order('assigned_at', { ascending: false }).limit(200),
    ]);

    // GAP-D28: Contar atribuições por badge
    const badgeCounts = new Map<string, number>();
    (ub || []).forEach((b: any) => {
      badgeCounts.set(b.badge_id, (badgeCounts.get(b.badge_id) || 0) + 1);
    });

    const badgesWithCount = ((bs || []) as any[]).map((b: any) => ({
      ...b,
      assigned_count: badgeCounts.get(b.id) || 0,
    }));
    setBadges(badgesWithCount);

    const list = ((ts || []) as any[]) || [];
    const uids = [...new Set(list.map(t => t.user_id).filter(Boolean))];
    let nameMap = new Map<string, string>();
    if (uids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, display_name').in('id', uids);
      nameMap = new Map((profs || []).map((p: any) => [p.id, p.display_name || 'Usuário']));
    }
    setTitles(list.map(t => ({ ...t, display_name: nameMap.get(t.user_id) })));
    setUserBadges((ub || []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // GAP-D35: Editar badge
  const startEdit = (badge: Badge) => {
    setEditingBadge(badge);
    setForm({
      id: badge.id,
      name: badge.name,
      description: badge.description || '',
      icon: badge.icon || '🏆',
      category: badge.category || 'special',
      is_custom: badge.is_custom ?? true,
      image_url: badge.image_url || '',
      unlock_rule: badge.unlock_rule || 'manual',
      unlock_value: badge.unlock_value || 0,
    });
    setOpen(true);
  };

  const saveBadge = async (isEdit: boolean) => {
    if (!form.id || !form.name) return toast.error('ID e Nome obrigatórios');
    
    let image_url = form.image_url || null;
    if (imageFile) {
      const path = `badges/${form.id}-${Date.now()}.${imageFile.name.split('.').pop()}`;
      const { error: upErr } = await supabase.storage.from('product-images').upload(path, imageFile);
      if (upErr) return toast.error('Erro ao subir imagem');
      const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path);
      image_url = pub.publicUrl;
    }

    const payload = {
      ...form,
      image_url,
      is_custom: true,
      unlock_rule: form.unlock_rule || 'manual',
      unlock_value: form.unlock_value || 0,
    };

    let error;
    if (isEdit) {
      const { error: e } = await supabase
        .from('badge_catalog')
        .update(payload)
        .eq('id', form.id);
      error = e;
    } else {
      const { error: e } = await supabase.from('badge_catalog').insert(payload);
      error = e;
    }

    if (error) return toast.error(error.message);
    
    await adminLog({
      action: isEdit ? 'editar_badge' : 'criar_badge',
      entity: 'badge_catalog',
      entity_id: form.id,
      payload: { nome: form.name, categoria: form.category },
    });

    toast.success(isEdit ? 'Badge atualizado!' : 'Badge criado!');
    setOpen(false);
    setImageFile(null);
    setEditingBadge(null);
    setForm({ id: '', name: '', description: '', icon: '🏆', category: 'special', is_custom: true, image_url: '', unlock_rule: 'manual', unlock_value: 0 });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Remover este badge? Isso também removerá de todos os usuários.')) return;
    const { error } = await supabase.from('badge_catalog').delete().eq('id', id);
    if (error) return toast.error(error.message);
    await adminLog({ action: 'remover_badge', entity: 'badge_catalog', entity_id: id });
    toast.success('Badge removido');
    load();
  };

  // GAP-D31: Atribuição em massa
  const searchUsers = async () => {
    if (!searchUser.trim()) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, username')
      .ilike('display_name', `%${searchUser}%`)
      .limit(20);
    setAssignUsers(data || []);
  };

  const toggleUserSelect = (id: string) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedUsers(newSet);
  };

  const assignBadgeBulk = async () => {
    if (!assignOpen || selectedUsers.size === 0) return;
    const userIds = Array.from(selectedUsers);
    const currentUserId = (await supabase.auth.getUser()).data.user?.id;
    const inserts = userIds.map(user_id => ({
      user_id,
      badge_id: assignOpen.id,
      assigned_by: currentUserId,
    }));
    
    
    const { error } = await supabase.from('user_badges').insert(inserts);
    if (error) return toast.error(error.message);
    
    await adminLog({
      action: 'atribuir_badge_em_massa',
      entity: 'user_badges',
      entity_id: assignOpen.id,
      payload: { usuarios: userIds.length, badge: assignOpen.name },
    });
    
    toast.success(`Badge atribuído a ${userIds.length} usuários`);
    setAssignOpen(null);
    setSelectedUsers(new Set());
    setAssignUsers([]);
    setSearchUser('');
    load();
  };

  // GAP-D34: Histórico de atribuições
  const getAssignHistory = async (badgeId: string) => {
    const { data } = await supabase
      .from('user_badges')
      .select('*, profiles:user_id(display_name)')
      .eq('badge_id', badgeId)
      .order('assigned_at', { ascending: false })
      .limit(50);
    return data || [];
  };

  const removeUserBadge = async (userBadgeId: string) => {
    if (!confirm('Remover este badge do usuário?')) return;
    const { error } = await supabase.from('user_badges').delete().eq('id', userBadgeId);
    if (error) return toast.error(error.message);
    toast.success('Badge removido do usuário');
    load();
  };

  // Títulos
  const createTitle = async () => {
    if (!titleForm.name || !titleForm.user_email) return toast.error('Nome e usuário obrigatórios');
    const { data: prof } = await supabase
      .from('profiles')
      .select('id')
      .or(`username.eq.${titleForm.user_email.trim()},display_name.eq.${titleForm.user_email.trim()}`)
      .limit(1)
      .maybeSingle();
    if (!prof) return toast.error('Usuário não encontrado');
    
    const { error } = await supabase.from('user_titles').insert({
      user_id: prof.id,
      name: titleForm.name,
      source: 'achievement',
      unlock_rule: titleForm.unlock_rule || 'manual',
      unlock_value: titleForm.unlock_value || 0,
    });
    if (error) return toast.error(error.message);
    
    await adminLog({
      action: 'criar_titulo',
      entity: 'user_titles',
      entity_id: prof.id,
      payload: { titulo: titleForm.name, usuario: titleForm.user_email },
    });
    
    toast.success('Título atribuído!');
    setTitleOpen(false);
    setTitleForm({ name: '', user_email: '', unlock_rule: 'manual', unlock_value: 0 });
    load();
  };

  const removeTitle = async (id: string) => {
    if (!confirm('Remover este título?')) return;
    await supabase.from('user_titles').delete().eq('id', id);
    await adminLog({ action: 'remover_titulo', entity: 'user_titles', entity_id: id });
    load();
  };

  // GAP-D33: Editar título
  const startEditTitle = (title: UserTitle) => {
    setEditingTitle(title);
    setTitleForm({
      name: title.name,
      user_email: title.display_name || '',
      unlock_rule: title.unlock_rule || 'manual',
      unlock_value: title.unlock_value || 0,
    });
    setTitleOpen(true);
  };

  const updateTitle = async () => {
    if (!editingTitle) return;
    const { error } = await supabase
      .from('user_titles')
      .update({
        name: titleForm.name,
        unlock_rule: titleForm.unlock_rule,
        unlock_value: titleForm.unlock_value,
      })
      .eq('id', editingTitle.id);
    if (error) return toast.error(error.message);
    await adminLog({
      action: 'editar_titulo',
      entity: 'user_titles',
      entity_id: editingTitle.id,
      payload: { nome: titleForm.name },
    });
    toast.success('Título atualizado');
    setEditingTitle(null);
    setTitleOpen(false);
    load();
  };

  // GAP-D32: Preview
  const showPreview = (badge: Badge) => {
    setPreviewBadge(badge);
  };

  const grouped = badges.reduce<Record<string, Badge[]>>((acc, b) => {
    const cat = b.category || 'general';
    (acc[cat] ||= []).push(b);
    return acc;
  }, {});

  const filteredCategories = categoryFilter === 'all' 
    ? Object.keys(grouped) 
    : [categoryFilter];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Award className="h-6 w-6 text-primary" /> Badges & Títulos</h1>
          <p className="text-sm text-muted-foreground">Gerencie conquistas, badges personalizados e títulos.</p>
        </div>
        <div className="flex gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Filtrar categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="badges">Badges ({badges.length})</TabsTrigger>
          <TabsTrigger value="titles">Títulos ({titles.length})</TabsTrigger>
          <TabsTrigger value="assignments">Atribuições ({userBadges.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="badges" className="space-y-4 mt-4">
          <div className="flex justify-end gap-2">
            <Dialog open={open} onOpenChange={(o) => { if (!o) { setEditingBadge(null); setOpen(false); } }}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingBadge(null); setForm({ id: '', name: '', description: '', icon: '🏆', category: 'special', is_custom: true, image_url: '', unlock_rule: 'manual', unlock_value: 0 }); }}>
                  <Plus className="h-4 w-4 mr-1" /> Novo Badge
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingBadge ? 'Editar Badge' : 'Criar Badge Personalizado'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>ID (slug)</Label>
                      <Input 
                        value={form.id} 
                        onChange={e => setForm({ ...form, id: e.target.value.replace(/\s+/g, '_').toLowerCase() })} 
                        disabled={!!editingBadge}
                      />
                    </div>
                    <div>
                      <Label>Nome</Label>
                      <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Ícone (emoji)</Label>
                      <Input className="w-24" value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} maxLength={4} />
                    </div>
                    <div>
                      <Label>Categoria</Label>
                      <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(c => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Regra de desbloqueio</Label>
                    <div className="flex gap-2">
                      <Select value={form.unlock_rule} onValueChange={(v) => setForm({ ...form, unlock_rule: v })}>
                        <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {UNLOCK_RULES.map(r => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form.unlock_rule !== 'manual' && (
                        <Input 
                          type="number" 
                          className="w-32" 
                          value={form.unlock_value} 
                          onChange={e => setForm({ ...form, unlock_value: Number(e.target.value) })} 
                          placeholder="Valor"
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <Label>Imagem (opcional)</Label>
                    <div className="flex gap-2 items-center">
                      <label className="flex-1 flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-md cursor-pointer text-sm text-muted-foreground hover:border-primary">
                        <Upload className="h-4 w-4" />
                        {imageFile ? imageFile.name.slice(0, 20) : (form.image_url ? 'Imagem existente' : 'Upload de imagem')}
                        <input type="file" accept="image/*" hidden onChange={e => setImageFile(e.target.files?.[0] || null)} />
                      </label>
                      {form.image_url && !imageFile && (
                        <img src={form.image_url} alt="Preview" className="w-10 h-10 object-cover rounded" loading="lazy" />
                      )}
                    </div>
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} />
                  </div>

                  {/* GAP-D32: Preview */}
                  <div className="border border-border rounded-lg p-4">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Prévia</Label>
                    <div className="flex items-center gap-3 mt-2">
                      {form.image_url ? (
                        <img src={form.image_url} alt="" className="w-12 h-12 rounded object-cover" loading="lazy" />
                      ) : (
                        <div className="text-3xl">{form.icon || '🏆'}</div>
                      )}
                      <div>
                        <p className="font-semibold">{form.name || 'Nome do badge'}</p>
                        <p className="text-xs text-muted-foreground">{form.description || 'Descrição...'}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {UNLOCK_RULES.find(r => r.value === form.unlock_rule)?.label || 'Manual'}
                          {form.unlock_rule !== 'manual' && `: ${form.unlock_value}`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={() => saveBadge(!!editingBadge)}>
                    {editingBadge ? 'Atualizar' : 'Criar'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="space-y-4">
              {filteredCategories.map(c => (
                <div key={c}>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    {CATEGORIES.find(cat => cat.value === c)?.label || c}
                    <span className="text-xs text-muted-foreground">({grouped[c]?.length || 0})</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(grouped[c] || []).map(b => (
                      <div key={b.id} className={`bg-card border ${b.is_custom ? 'border-warning/40 shadow-[0_0_8px_rgba(234,179,8,0.15)]' : 'border-border'} rounded-lg p-4 flex gap-3 items-start`}>
                        {b.image_url ? (
                          <img src={b.image_url} alt="" className="w-12 h-12 rounded object-cover" loading="lazy" />
                        ) : (
                          <div className="text-3xl">{b.icon}</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm flex items-center gap-1">
                            {b.name}
                            {b.is_custom && <span className="text-[10px] text-warning">★ CUSTOM</span>}
                          </h3>
                          <p className="text-xs text-muted-foreground">{b.id}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{b.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-muted-foreground">👤 {b.assigned_count || 0}</span>
                            {b.unlock_rule && b.unlock_rule !== 'manual' && (
                              <span className="text-[10px] text-primary">
                                🔓 {UNLOCK_RULES.find(r => r.value === b.unlock_rule)?.label}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => showPreview(b)}>
                              👁️ Preview
                            </Button>
                            <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => setAssignOpen(b)}>
                              <UserPlus className="h-3 w-3 mr-0.5" /> Atribuir
                            </Button>
                            {b.is_custom && (
                              <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => startEdit(b)}>
                                <Edit className="h-3 w-3 mr-0.5" /> Editar
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] text-destructive" onClick={() => remove(b.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="titles" className="space-y-4 mt-4">
          <div className="flex justify-end gap-2">
            <Button onClick={() => { setEditingTitle(null); setTitleForm({ name: '', user_email: '', unlock_rule: 'manual', unlock_value: 0 }); setTitleOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Criar Título
            </Button>
          </div>

          {titles.length === 0 ? (
            <EstadoVazio titulo="Nenhum título atribuído ainda" />
          ) : (
            <div className="space-y-2">
              {titles.map(t => (
                <div key={t.id} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
                  <Crown className="h-5 w-5 text-warning" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.display_name || t.user_id.slice(0, 8)} · {formatDate(t.awarded_at)}
                      {t.unlock_rule && t.unlock_rule !== 'manual' && (
                        <span className="ml-2 text-primary">
                          🔓 {UNLOCK_RULES.find(r => r.value === t.unlock_rule)?.label}
                        </span>
                      )}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => startEditTitle(t)}>
                    <Edit className="h-3 w-3 mr-1" /> Editar
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Excluir" onClick={() => removeTitle(t.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4 mt-4">
          <div className="flex gap-2 items-center">
            <Input 
              placeholder="Buscar atribuições por usuário ou badge" 
              value={searchUser} 
              onChange={e => setSearchUser(e.target.value)} 
              className="max-w-sm"
            />
            <Button variant="outline" onClick={load}>
              <Loader2 className="h-4 w-4 mr-1" /> Atualizar
            </Button>
          </div>

          {userBadges.length === 0 ? (
            <EstadoVazio titulo="Nenhuma atribuição registrada" />
          ) : (
            <div className="space-y-2">
              {userBadges.slice(0, 50).map(ub => {
                const badge = badges.find(b => b.id === ub.badge_id);
                return (
                  <div key={ub.id} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
                    {badge?.image_url ? (
                      <img src={badge.image_url} alt="" className="w-8 h-8 rounded object-cover" loading="lazy" />
                    ) : (
                      <div className="text-xl">{badge?.icon || '🏆'}</div>
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{badge?.name || ub.badge_id}</p>
                      <p className="text-xs text-muted-foreground">
                        Usuário: {ub.user_id.slice(0, 8)} · {formatDate(ub.assigned_at)}
                        {ub.assigned_by && <span className="ml-2">Atribuído por admin</span>}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeUserBadge(ub.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* GAP-D32: Preview Dialog */}
      <Dialog open={!!previewBadge} onOpenChange={() => setPreviewBadge(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader><DialogTitle>Prévia do Badge</DialogTitle></DialogHeader>
          <div className="py-6 flex flex-col items-center">
            {previewBadge?.image_url ? (
              <img src={previewBadge.image_url} alt="" className="w-24 h-24 rounded object-cover" loading="lazy" />
            ) : (
              <div className="text-6xl">{previewBadge?.icon || '🏆'}</div>
            )}
            <h3 className="text-xl font-bold mt-4">{previewBadge?.name}</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs">{previewBadge?.description}</p>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="px-2 py-1 bg-secondary rounded">
                {CATEGORIES.find(c => c.value === previewBadge?.category)?.label || previewBadge?.category}
              </span>
              {previewBadge?.unlock_rule && previewBadge.unlock_rule !== 'manual' && (
                <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                  🔓 {UNLOCK_RULES.find(r => r.value === previewBadge?.unlock_rule)?.label}
                </span>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* GAP-D31: Atribuição em massa */}
      <Dialog open={!!assignOpen} onOpenChange={(o) => { if (!o) { setAssignOpen(null); setAssignUsers([]); setSelectedUsers(new Set()); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Atribuir "{assignOpen?.name}"</DialogTitle>
            <p className="text-sm text-muted-foreground">Busque usuários e selecione para atribuição em massa</p>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input 
                value={searchUser} 
                onChange={e => setSearchUser(e.target.value)} 
                placeholder="Buscar por nome de usuário..." 
                className="flex-1"
              />
              <Button onClick={searchUsers}><Search className="h-4 w-4 mr-1" /> Buscar</Button>
            </div>
            
            {assignUsers.length > 0 && (
              <div className="border border-border rounded-lg max-h-48 overflow-y-auto">
                {assignUsers.map(u => (
                  <div key={u.id} className="flex items-center gap-2 p-2 border-b border-border hover:bg-muted/30">
                    <input 
                      type="checkbox" 
                      checked={selectedUsers.has(u.id)}
                      onChange={() => toggleUserSelect(u.id)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">{u.display_name}</span>
                    <span className="text-xs text-muted-foreground">@{u.username}</span>
                  </div>
                ))}
              </div>
            )}
            
            {selectedUsers.size > 0 && (
              <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg">
                <span className="text-sm font-semibold">{selectedUsers.size} usuários selecionados</span>
                <Button size="sm" onClick={() => setSelectedUsers(new Set())}>Limpar</Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAssignOpen(null); setAssignUsers([]); }}>Cancelar</Button>
            <Button onClick={assignBadgeBulk} disabled={selectedUsers.size === 0}>
              Atribuir para {selectedUsers.size} usuário{selectedUsers.size !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Título Dialog */}
      <Dialog open={titleOpen} onOpenChange={(o) => { if (!o) { setEditingTitle(null); setTitleOpen(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTitle ? 'Editar Título' : 'Novo Título de Conquista'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome do título</Label>
              <Input 
                value={titleForm.name} 
                onChange={e => setTitleForm({ ...titleForm, name: e.target.value })} 
                placeholder="ex: Mestre do Marketplace" 
              />
            </div>
            <div>
              <Label>Usuário (username ou display_name)</Label>
              <Input 
                value={titleForm.user_email} 
                onChange={e => setTitleForm({ ...titleForm, user_email: e.target.value })} 
                placeholder="joaogamer" 
                disabled={!!editingTitle}
              />
            </div>
            <div>
              <Label>Regra de desbloqueio</Label>
              <div className="flex gap-2">
                <Select value={titleForm.unlock_rule} onValueChange={(v) => setTitleForm({ ...titleForm, unlock_rule: v })}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNLOCK_RULES.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {titleForm.unlock_rule !== 'manual' && (
                  <Input 
                    type="number" 
                    className="w-32" 
                    value={titleForm.unlock_value} 
                    onChange={e => setTitleForm({ ...titleForm, unlock_value: Number(e.target.value) })} 
                    placeholder="Valor"
                  />
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTitleOpen(false); setEditingTitle(null); }}>Cancelar</Button>
            <Button onClick={editingTitle ? updateTitle : createTitle}>
              {editingTitle ? 'Atualizar' : 'Criar e atribuir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}