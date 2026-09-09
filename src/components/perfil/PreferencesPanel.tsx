import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Copy, Sparkles, Gamepad2, Gift, Loader2, Check, Info, MessageSquare, Users, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const MIN_GENRES = 3;

export default function PreferencesPanel() {
  const { user } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [savedPicked, setSavedPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referredBy, setReferredBy] = useState<string | null>(null);
  const [redeemInput, setRedeemInput] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  // GAP-PP01: XP de indicação
  const [referralXP, setReferralXP] = useState(0);
  // GAP-PP02: Histórico de indicações
  const [referralHistory, setReferralHistory] = useState<{ referred_id: string; display_name: string; created_at: string }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  // GAP-PP03: Validação em tempo real
  const [codeValid, setCodeValid] = useState<boolean | null>(null);

  type ChatMode = 'friends_direct' | 'followers_direct' | 'request_only';
  const [chatMode, setChatMode] = useState<ChatMode>('request_only');
  const [savedChatMode, setSavedChatMode] = useState<ChatMode>('request_only');
  const [savingChat, setSavingChat] = useState(false);
  const [bracket, setBracket] = useState<'crianca' | 'adolescente' | 'adulto' | 'desconhecido'>('desconhecido');
  const [approvalMode, setApprovalMode] = useState<'notify' | 'approve'>('approve');
  const isMinor = bracket === 'crianca' || bracket === 'adolescente';
  const isChild = bracket === 'crianca';

  const [steamOpen, setSteamOpen] = useState(false);

  const refresh = async () => {
    const [{ data: prof }, { data: cats }] = await Promise.all([
      (supabase as any).rpc('get_my_profile'),
      supabase.from('categorias').select('name').order('name'),
    ]);
    const row = Array.isArray(prof) ? prof[0] : prof;
    setCategories((cats || []).map((c: { name: string }) => c.name));
    if (row) {
      const genres = row.favorite_genres || [];
      setPicked(genres);
      setSavedPicked(genres);
      setReferralCode(row.referral_code || null);
      setReferredBy(row.referred_by || null);
      // GAP-PP01: XP de indicação
      setReferralXP(row.referral_xp || 0);
      const mode: ChatMode = (row.chat_privacy_mode as ChatMode) || 'request_only';
      setChatMode(mode);
      setSavedChatMode(mode);
      setApprovalMode(((row as any).minor_chat_approval_mode as any) || 'approve');
      const bd = (row as any).birth_date;
      if (bd) {
        const d = new Date(bd); const now = new Date();
        let age = now.getFullYear() - d.getFullYear();
        const m = now.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
        setBracket(age < 12 ? 'crianca' : age < 18 ? 'adolescente' : 'adulto');
      }
      // GAP-PP02: Histórico de indicações
      const { data: referrals } = await supabase
        .from('profiles')
        .select('id, display_name, created_at')
        .eq('referred_by', row.referral_code);
      setReferralHistory((referrals || []).map((r: any) => ({
        referred_id: r.id,
        display_name: r.display_name || 'Usuário',
        created_at: r.created_at,
      })));
    }
  };

  useEffect(() => {
    if (!user || loaded) return;
    (async () => { await refresh(); setLoaded(true); })();
  }, [user, loaded]);

  const toggle = (name: string) => {
    setPicked(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);
  };

  const dirty = JSON.stringify([...picked].sort()) !== JSON.stringify([...savedPicked].sort());
  const canSave = picked.length >= MIN_GENRES && dirty;

  const savePrefs = async () => {
    if (!user) return;
    if (picked.length < MIN_GENRES) {
      toast.error(`Escolha pelo menos ${MIN_GENRES} gêneros.`);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ favorite_genres: picked }).eq('id', user.id);
    if (error) { setSaving(false); toast.error('Erro ao salvar preferências'); return; }
    await refresh();
    setSaving(false);
    toast.success('Preferências salvas');
  };

  const copyCode = async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      toast.success('Código copiado!');
    } catch {
      toast.error('Não deu pra copiar automaticamente.');
    }
  };

  // GAP-PP03: Validar código em tempo real
  const validateCode = async (code: string) => {
    if (code.length < 4) { setCodeValid(null); return; }
    const { data } = await (supabase as any).rpc('validate_referral_code', { _code: code });
    setCodeValid(data?.valid || false);
  };

  const redeem = async () => {
    const code = redeemInput.trim().toUpperCase();
    if (!code) return;
    setRedeeming(true);
    const { data, error } = await (supabase as any).rpc('redeem_referral', { _code: code });
    if (error) { setRedeeming(false); toast.error('Erro ao resgatar código'); return; }
    if (!data?.ok) {
      setRedeeming(false);
      const err = data?.error;
      if (err === 'already_redeemed') toast.error('Você já resgatou um código de indicação.');
      else if (err === 'invalid_code') toast.error('Código inválido.');
      else if (err === 'self_referral') toast.error('Você não pode usar seu próprio código.');
      else toast.error('Não foi possível resgatar agora.');
      return;
    }
    await refresh();
    setRedeeming(false);
    toast.success('Código resgatado! +100 XP pra você, +200 pra quem te indicou.');
    setRedeemInput('');
    setCodeValid(null);
  };

  const saveChatMode = async (mode: ChatMode) => {
    if (!user) return;
    setSavingChat(true);
    const { error } = await supabase.from('profiles').update({ chat_privacy_mode: mode } as any).eq('id', user.id);
    setSavingChat(false);
    if (error) { toast.error('Erro ao salvar privacidade do chat'); return; }
    setChatMode(mode); setSavedChatMode(mode);
    toast.success('Privacidade do chat atualizada');
  };

  if (!user) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-6 mb-4 space-y-6">
      {/* Gêneros */}
      <div>
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-primary" /> Preferências
        </h2>
        <p className="text-xs text-muted-foreground mb-3">
          Mínimo <strong>{MIN_GENRES}</strong> gêneros, sem limite máximo — usados nas recomendações e no radar.
        </p>
        <div className="flex flex-wrap gap-2">
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem categorias cadastradas ainda.</p>
          ) : categories.map(name => {
            const active = picked.includes(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggle(name)}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm border transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary text-foreground border-border hover:border-primary/60'
                }`}
              >
                {active && <Check className="h-3.5 w-3.5" />} {name}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-3 gap-2">
          <p className={`text-xs ${picked.length >= MIN_GENRES ? 'text-muted-foreground' : 'text-warning'}`}>
            {picked.length} selecionados {picked.length >= MIN_GENRES
              ? (dirty ? '· alterações não salvas' : '✓ salvos')
              : `— faltam ${MIN_GENRES - picked.length} pra atingir o mínimo`}
          </p>
          <Button size="sm" onClick={savePrefs} disabled={saving || !canSave}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            Salvar preferências
          </Button>
        </div>
      </div>

      {/* Chat Privacy */}
      <div className="border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
          <MessageSquare className="h-4 w-4 text-primary" /> Quem pode me mandar mensagem
        </h3>
        {isMinor ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
              <p className="text-sm font-semibold text-warning mb-1">Conta de menor de idade — trava do ECA Digital</p>
              <p className="text-xs text-muted-foreground">
                Todo pedido de chat de estranho é bloqueado automaticamente. Amigos precisam mandar pedido antes de conversar.
                O nível de aprovação é definido pelo seu responsável.
              </p>
            </div>
            <div className="grid gap-2">
              {([
                { v: 'notify',  t: 'Nível A — Amigo fala direto', d: 'Amigo abre a conversa; responsável recebe apenas notificação.' },
                { v: 'approve', t: 'Nível B — Responsável aprova cada pedido', d: 'Nenhuma conversa entra sem aprovação explícita.' },
              ] as { v: 'notify' | 'approve'; t: string; d: string }[]).map(opt => {
                const active = approvalMode === opt.v;
                const disabled = isChild && opt.v === 'notify';
                return (
                  <div key={opt.v}
                    className={`rounded-lg border p-3 ${active ? 'border-primary bg-primary/10' : 'border-border bg-secondary'} ${disabled ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {active && <Check className="h-3.5 w-3.5 text-primary" />} {opt.t}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{opt.d}</p>
                  </div>
                );
              })}
            </div>
            {isChild && <p className="text-[11px] text-muted-foreground">Criança (até 12 anos) fica sempre no Nível B, sem exceção.</p>}
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3">
              Define o comportamento padrão de novas conversas. Você sempre pode aprovar depois em cada pedido.
            </p>
            <div className="grid gap-2">
              {([
                { v: 'friends_direct',   t: 'Só amigos abrem direto',   d: 'Chat aberto na hora quando os dois se seguem. Estranho vira pedido.' },
                { v: 'followers_direct', t: 'Quem me segue abre direto', d: 'Qualquer pessoa que te segue já entra na conversa. Resto vira pedido.' },
                { v: 'request_only',     t: 'Sempre exigir pedido',      d: 'Toda nova conversa fica pendente até você aceitar. Mais restritivo.' },
              ] as { v: ChatMode; t: string; d: string }[]).map(opt => {
                const active = chatMode === opt.v;
                return (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => saveChatMode(opt.v)}
                    disabled={savingChat}
                    className={`text-left rounded-lg border p-3 transition-colors ${
                      active ? 'border-primary bg-primary/10' : 'border-border bg-secondary hover:border-primary/60'
                    } disabled:opacity-60`}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {active && <Check className="h-3.5 w-3.5 text-primary" />} {opt.t}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{opt.d}</p>
                  </button>
                );
              })}
            </div>
            {savedChatMode !== chatMode && <p className="text-[11px] text-warning mt-2">Salvando…</p>}
          </>
        )}
      </div>

      {/* Steam Integration */}
      <div className="border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
          <Gamepad2 className="h-4 w-4 text-primary" /> Plataformas conectadas
        </h3>
        <p className="text-xs text-muted-foreground mb-3">Puxe sua biblioteca de outras plataformas.</p>
        <button
          type="button"
          onClick={() => setSteamOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm border border-border bg-secondary text-foreground hover:border-primary/60 transition-colors"
        >
          <Gamepad2 className="h-4 w-4" /> Conectar Steam
          <span className="ml-1 text-[10px] uppercase tracking-wide bg-muted px-1.5 py-0.5 rounded">em breve</span>
        </button>
      </div>

      {/* Referral System */}
      <div className="border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
          <Gift className="h-4 w-4 text-primary" /> Indicação
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Compartilhe seu código. Quem entrar e resgatar ganha <strong>100 XP</strong>; você ganha <strong>200 XP</strong> por indicação — sem limite diário.
        </p>

        {/* GAP-PP01: XP de indicação */}
        <div className="flex items-center gap-4 mb-3 text-xs">
          <span className="text-muted-foreground">XP ganho com indicações:</span>
          <span className="font-bold text-primary">{referralXP} XP</span>
          {referralHistory.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-primary hover:underline flex items-center gap-1"
            >
              <Users className="h-3 w-3" />
              {showHistory ? 'Ocultar' : 'Ver'} indicações ({referralHistory.length})
            </button>
          )}
        </div>

        {/* GAP-PP02: Histórico de indicações */}
        {showHistory && referralHistory.length > 0 && (
          <div className="mb-3 p-3 rounded-lg bg-secondary/40 border border-border max-h-32 overflow-y-auto">
            <p className="text-[10px] font-semibold text-muted-foreground mb-2">Pessoas que você indicou:</p>
            <ul className="space-y-1">
              {referralHistory.map(r => (
                <li key={r.referred_id} className="flex items-center justify-between text-xs">
                  <span>{r.display_name}</span>
                  <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 px-3 py-2 bg-secondary border border-border rounded-lg font-mono text-sm">
            {referralCode ?? '—'}
          </div>
          <Button variant="outline" size="sm" onClick={copyCode} disabled={!referralCode}>
            <Copy className="h-4 w-4 mr-1" /> Copiar
          </Button>
        </div>

        {referredBy ? (
          <p className="text-xs text-muted-foreground">Você já resgatou um código de indicação — obrigado por vir com convite!</p>
        ) : (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Tem um código de amigo? Cole aqui:</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  value={redeemInput}
                  onChange={e => {
                    const val = e.target.value.toUpperCase();
                    setRedeemInput(val);
                    // GAP-PP03: Validar em tempo real
                    validateCode(val);
                  }}
                  placeholder="EX.: A1B2C3D4"
                  maxLength={12}
                  className={cn(
                    "w-full px-3 py-2 bg-secondary border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50",
                    codeValid === true ? "border-success" : codeValid === false ? "border-destructive" : "border-border"
                  )}
                />
                {/* GAP-PP03: Indicador de validação */}
                {codeValid === true && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-success" />
                )}
                {codeValid === false && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-destructive">inválido</span>
                )}
              </div>
              <Button size="sm" onClick={redeem} disabled={redeeming || !redeemInput.trim() || codeValid === false}>
                {redeeming && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                Resgatar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Steam Dialog */}
      <Dialog open={steamOpen} onOpenChange={setSteamOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5 text-primary" /> Integração Steam — em breve
            </DialogTitle>
            <DialogDescription>
              Vamos permitir que você conecte sua conta Steam e importe automaticamente sua biblioteca, tempo de jogo e conquistas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="flex gap-2 items-start rounded-lg border border-warning/40 bg-warning/10 p-3">
              <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-warning mb-1">Modo AFK</p>
                <p className="text-xs text-muted-foreground">
                  Por enquanto o botão está <strong>desligado</strong> por padrão. Ele existe pra reservar o lugar
                  na interface — assim, quando ativarmos a integração de verdade, você já sabe onde encontrar.
                  Nenhum dado seu é enviado à Steam agora.
                </p>
              </div>
            </div>

            <div>
              <p className="font-semibold mb-1">O que virá depois:</p>
              <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1">
                <li>Você informa seu <span className="font-mono">SteamID</span> ou faz login via OpenID.</li>
                <li>Puxamos a biblioteca pública e o tempo de jogo.</li>
                <li>Os jogos aparecem na sua Biblioteca com o selo <em>via Steam</em>.</li>
                <li>Você pode desconectar a qualquer momento.</li>
              </ol>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSteamOpen(false)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}