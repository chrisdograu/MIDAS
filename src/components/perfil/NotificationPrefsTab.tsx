import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Loader2, Bell, Sparkles, Trophy, Users, MessageSquare, Library, Mail, Eye, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Frequency = 'immediate' | 'digest' | 'off';

type Prefs = {
  social_likes: boolean; social_replies: boolean; social_follows: boolean;
  forum_replies: boolean; forum_mentions: boolean; forum_topics: boolean;
  tournament_signup: boolean; tournament_7d: boolean; tournament_1d: boolean;
  tournament_1h: boolean; tournament_match: boolean; tournament_result: boolean;
  library_review_completa: boolean; library_opinion: boolean;
  library_screenshot: boolean; library_activity: boolean;
  midias_especiais: boolean;
  // GAP-NP02: Frequência
  notification_frequency: Frequency;
  // GAP-NP04: Email
  email_notifications: boolean;
};

const GROUPS: { title: string; icon: any; items: { key: keyof Omit<Prefs, 'notification_frequency' | 'email_notifications'>; label: string; hint?: string }[] }[] = [
  { title: 'Social', icon: Users, items: [
    { key: 'social_likes', label: 'Curtidas em meu conteúdo' },
    { key: 'social_replies', label: 'Respostas em meus posts' },
    { key: 'social_follows', label: 'Novos seguidores' },
  ]},
  { title: 'Fórum', icon: MessageSquare, items: [
    { key: 'forum_replies', label: 'Respostas nos meus tópicos' },
    { key: 'forum_mentions', label: 'Menções (@usuario)' },
    { key: 'forum_topics', label: 'Novos tópicos em jogos seguidos' },
  ]},
  { title: 'Torneios', icon: Trophy, items: [
    { key: 'tournament_signup', label: 'Inscrição confirmada' },
    { key: 'tournament_7d', label: 'Lembrete 7 dias antes' },
    { key: 'tournament_1d', label: 'Lembrete 1 dia antes' },
    { key: 'tournament_1h', label: 'Lembrete 1 hora antes' },
    { key: 'tournament_match', label: 'Sua partida vai começar' },
    { key: 'tournament_result', label: 'Resultado de partidas' },
  ]},
  { title: 'Biblioteca social', icon: Library, items: [
    { key: 'library_review_completa', label: 'Amigo publicou Review Completa' },
    { key: 'library_opinion', label: 'Amigo postou uma opinião' },
    { key: 'library_screenshot', label: 'Amigo postou screenshots' },
    { key: 'library_activity', label: 'Amigo atualizou biblioteca' },
  ]},
  { title: 'MIDIAS Especiais', icon: Sparkles, items: [
    { key: 'midias_especiais', label: 'Promoções, eventos e novidades da plataforma' },
  ]},
];

const DEFAULT: Prefs = {
  social_likes: true, social_replies: true, social_follows: true,
  forum_replies: true, forum_mentions: true, forum_topics: true,
  tournament_signup: true, tournament_7d: true, tournament_1d: true,
  tournament_1h: true, tournament_match: true, tournament_result: true,
  library_review_completa: true, library_opinion: true,
  library_screenshot: true, library_activity: true,
  midias_especiais: true,
  notification_frequency: 'immediate',
  email_notifications: false,
};

// GAP-NP03: Preview de notificação
const NotificationPreview = ({ type }: { type: string }) => {
  const previews: Record<string, { icon: any; title: string; body: string }> = {
    'social_likes': { icon: Users, title: 'João curtiu seu post', body: '"Achei esse jogo incrível!"' },
    'forum_replies': { icon: MessageSquare, title: 'Maria respondeu seu tópico', body: 'Eu também tive essa experiência...' },
    'tournament_match': { icon: Trophy, title: 'Sua partida vai começar', body: 'Você enfrenta Pedro em 15 minutos' },
    'library_review_completa': { icon: Library, title: 'Carlos publicou uma Review Completa', body: 'Sobre Elden Ring' },
    'midias_especiais': { icon: Sparkles, title: '🎉 Nova temporada de torneios!', body: 'Inscreva-se agora' },
  };
  const preview = previews[type] || previews['social_likes'];
  const Icon = preview.icon;
  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-secondary/40 border border-border text-[10px]">
      <Icon className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="font-medium text-foreground">{preview.title}</p>
        <p className="text-muted-foreground">{preview.body}</p>
      </div>
    </div>
  );
};

export default function NotificationPrefsTab() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // GAP-NP03: Preview
  const [previewType, setPreviewType] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('notification_preferences').select('*').eq('user_id', user.id).maybeSingle();
      if (data) {
        const { user_id: _u, created_at: _c, updated_at: _up, ...rest } = data as any;
        setPrefs({ ...DEFAULT, ...rest });
      }
      setLoading(false);
    })();
  }, [user?.id]);

  const update = async (key: keyof Prefs, value: boolean | Frequency) => {
    if (!user) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSaving(true);
    const { error } = await supabase.from('notification_preferences').upsert({ user_id: user.id, ...next });
    setSaving(false);
    if (error) { toast.error('Erro ao salvar preferência'); return; }
  };

  // GAP-NP01: Desativar todas
  const disableAll = async () => {
    const next = { ...DEFAULT };
    Object.keys(next).forEach(key => {
      if (key !== 'notification_frequency' && key !== 'email_notifications') {
        (next as any)[key] = false;
      }
    });
    next.notification_frequency = 'off';
    setPrefs(next);
    setSaving(true);
    const { error } = await supabase.from('notification_preferences').upsert({ user_id: user.id, ...next });
    setSaving(false);
    if (error) { toast.error('Erro ao desativar'); return; }
    toast.success('Todas as notificações desativadas');
  };

  // GAP-NP02: Frequência
  const frequencies: { value: Frequency; label: string; icon: any }[] = [
    { value: 'immediate', label: 'Imediato', icon: Bell },
    { value: 'digest', label: 'Resumo diário', icon: Clock },
    { value: 'off', label: 'Desligado', icon: Bell },
  ];

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" /> Notificações
        </h2>
        <div className="flex items-center gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Button variant="outline" size="sm" onClick={disableAll} className="text-xs h-7">
            Desativar todas
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground -mt-3">Escolha o que você quer ser avisado.</p>

      {/* GAP-NP02: Frequência */}
      <div className="border border-border rounded-lg p-3 bg-secondary/30">
        <p className="text-xs font-semibold text-foreground mb-2">Frequência das notificações</p>
        <div className="flex gap-2">
          {frequencies.map(f => {
            const Icon = f.icon;
            const active = prefs.notification_frequency === f.value;
            return (
              <button
                key={f.value}
                onClick={() => update('notification_frequency', f.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition",
                  active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground border border-border"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {f.label}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          {prefs.notification_frequency === 'immediate' && 'Receba notificações em tempo real'}
          {prefs.notification_frequency === 'digest' && 'Receba um resumo diário de todas as notificações'}
          {prefs.notification_frequency === 'off' && 'Nenhuma notificação será enviada'}
        </p>
      </div>

      {/* GAP-NP04: Email */}
      <div className="flex items-center justify-between border border-border rounded-lg p-3 bg-secondary/30">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">Notificações por e-mail</p>
            <p className="text-[10px] text-muted-foreground">Receba notificações importantes também no seu e-mail</p>
          </div>
        </div>
        <Switch checked={prefs.email_notifications} onCheckedChange={v => update('email_notifications', v)} />
      </div>

      {/* GAP-NP03: Preview */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Preview:</span>
        <select
          value={previewType || ''}
          onChange={e => setPreviewType(e.target.value || null)}
          className="text-xs bg-secondary border border-border rounded px-2 py-1"
        >
          <option value="">Selecione um tipo</option>
          {Object.keys(DEFAULT).filter(k => k !== 'notification_frequency' && k !== 'email_notifications').map(k => (
            <option key={k} value={k}>{k.replace('_', ' ')}</option>
          ))}
        </select>
      </div>
      {previewType && <NotificationPreview type={previewType} />}

      {GROUPS.map((g, gi) => {
        const Icon = g.icon;
        return (
          <div key={g.title} className="space-y-3">
            {gi > 0 && <Separator />}
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 pt-2">
              <Icon className="h-4 w-4 text-primary" /> {g.title}
            </h3>
            <div className="space-y-3 pl-1">
              {g.items.map(it => {
                const isActive = prefs[it.key as keyof Prefs] as boolean;
                return (
                  <div key={it.key} className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">{it.label}</p>
                      {it.hint && <p className="text-xs text-muted-foreground">{it.hint}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPreviewType(it.key)}
                        className="text-muted-foreground hover:text-primary transition"
                        title="Ver preview"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <Switch checked={isActive} onCheckedChange={v => update(it.key as keyof Prefs, v)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}