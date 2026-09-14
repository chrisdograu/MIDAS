import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, Check, Loader2, Copy, Gamepad2, Gift, Info, X, MessageSquare, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import PersonalThemePanel from '@/components/perfil/PersonalThemePanel';

const MIN_GENRES = 3;

/**
 * Espelho mobile do PreferencesPanel (web).
 * Mesmas regras: mínimo 3 gêneros / sem máximo, Steam AFK, código de indicação.
 */
export default function MPreferencesSection() {
  const { user } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [savedPicked, setSavedPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referredBy, setReferredBy] = useState<string | null>(null);
  const [redeemInput, setRedeemInput] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  type ChatMode = 'friends_direct' | 'followers_direct' | 'request_only';
  const [chatMode, setChatMode] = useState<ChatMode>('request_only');
  const [savingChat, setSavingChat] = useState(false);
  const [bracket, setBracket] = useState<'crianca' | 'adolescente' | 'adulto' | 'desconhecido'>('desconhecido');
  const [approvalMode, setApprovalMode] = useState<'notify' | 'approve'>('approve');
  const isMinor = bracket === 'crianca' || bracket === 'adolescente';
  const isChild = bracket === 'crianca';

  const [steamOpen, setSteamOpen] = useState(false);

  // GAP-M016: Sincronizar com web
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
      setChatMode(((row as any).chat_privacy_mode as ChatMode) || 'request_only');
      setApprovalMode(((row as any).minor_chat_approval_mode as any) || 'approve');
      const bd = (row as any).birth_date;
      if (bd) {
        const d = new Date(bd); const now = new Date();
        let age = now.getFullYear() - d.getFullYear();
        const m = now.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
        setBracket(age < 12 ? 'crianca' : age < 18 ? 'adolescente' : 'adulto');
      }
    }
  };

  useEffect(() => {
    if (!user || loaded) return;
    (async () => { await refresh(); setLoaded(true); })();
  }, [user, loaded]);

  const toggle = (name: string) =>
    setPicked(p => p.includes(name) ? p.filter(x => x !== name) : [...p, name]);

  const dirty = JSON.stringify([...picked].sort()) !== JSON.stringify([...savedPicked].sort());
  const canSave = picked.length >= MIN_GENRES && dirty;

  // GAP-M013: Feedback visual de salvamento
  const savePrefs = async () => {
    if (!user) return;
    if (picked.length < MIN_GENRES) { toast.error(`Escolha pelo menos ${MIN_GENRES} gêneros.`); return; }
    setSaving(true);
    setSaveSuccess(false);
    try {
      const { error } = await supabase.from('profiles').update({ favorite_genres: picked }).eq('id', user.id);
      if (error) throw error;
      await refresh();
      setSaveSuccess(true);
      toast.success('Preferências salvas');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      toast.error('Erro ao salvar preferências');
    } finally {
      setSaving(false);
    }
  };

  const copyCode = async () => {
    if (!referralCode) return;
    try { await navigator.clipboard.writeText(referralCode); toast.success('Código copiado!'); }
    catch { toast.error('Não deu pra copiar automaticamente.'); }
  };

  // GAP-M014: Validar formato do código
  const redeem = async () => {
    const code = redeemInput.trim().toUpperCase();
    setRedeemError(null);
    
    // GAP-M014: Validação de formato
    if (!code) {
      setRedeemError('Digite um código');
      return;
    }
    if (code.length < 8 || code.length > 12) {
      setRedeemError('Código deve ter entre 8 e 12 caracteres');
      return;
    }
    if (!/^[A-Z0-9]+$/.test(code)) {
      setRedeemError('Código deve conter apenas letras e números');
      return;
    }

    setRedeeming(true);
    try {
      const { data, error } = await (supabase as any).rpc('redeem_referral', { _code: code });
      if (error) throw error;
      
      if (!data?.ok) {
        const err = data?.error;
        if (err === 'already_redeemed') setRedeemError('Você já resgatou um código.');
        else if (err === 'invalid_code') setRedeemError('Código inválido.');
        else if (err === 'self_referral') setRedeemError('Não pode usar seu próprio código.');
        else setRedeemError('Não foi possível resgatar agora.');
        return;
      }
      
      await refresh();
      toast.success('Código resgatado! +100 XP pra você, +200 pra quem te indicou.');
      setRedeemInput('');
      setRedeemError(null);
    } catch (err: any) {
      setRedeemError(err.message || 'Erro ao resgatar código');
    } finally {
      setRedeeming(false);
    }
  };

  // GAP-M015: Confirmar alterações de chat
  const saveChatMode = async (mode: ChatMode) => {
    if (!user) return;
    if (mode === chatMode) return;
    
    // GAP-M015: Modal de confirmação para mudanças importantes
    if (mode === 'request_only' && chatMode !== 'request_only') {
      const confirmed = window.confirm(
        'Ao mudar para "Sempre exigir pedido", todas as novas conversas precisarão da sua aprovação. Isso não afeta conversas já existentes. Confirmar?'
      );
      if (!confirmed) return;
    }

    setSavingChat(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ chat_privacy_mode: mode } as any)
        .eq('id', user.id);
      if (error) throw error;
      setChatMode(mode);
      toast.success('Privacidade do chat atualizada');
    } catch (err) {
      toast.error('Erro ao salvar');
    } finally {
      setSavingChat(false);
    }
  };

  if (!user) return null;

  return (
    <div className="glass rounded-2xl p-4 space-y-4">
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-primary" /> Preferências
      </h2>

      {/* Gêneros */}
      <div>
        <p className="text-[11px] text-muted-foreground mb-2">
          Mínimo <strong className="text-foreground">{MIN_GENRES}</strong> gêneros, sem limite máximo — usados nas recomendações.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {categories.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem categorias cadastradas ainda.</p>
          ) : categories.map(name => {
            const active = picked.includes(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggle(name)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] border transition-all ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary scale-95'
                    : 'bg-secondary text-foreground border-border hover:border-primary/50'
                }`}
              >
                {active && <Check className="h-3 w-3" />} {name}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-2 gap-2">
          <p className={`text-[10px] ${picked.length >= MIN_GENRES ? 'text-muted-foreground' : 'text-warning'}`}>
            {picked.length} selecionados {picked.length >= MIN_GENRES
              ? (dirty ? '· não salvos' : '✓ salvos')
              : `— faltam ${MIN_GENRES - picked.length}`}
          </p>
          <button
            onClick={savePrefs}
            disabled={saving || !canSave}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1 disabled:opacity-50 transition-all"
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : saveSuccess ? (
              <Check className="h-3 w-3" />
            ) : null}
            {saving ? 'Salvando...' : saveSuccess ? 'Salvo!' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Chat Privacy */}
      <div className="border-t border-border pt-3">
        <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
          <MessageSquare className="h-3.5 w-3.5 text-primary" /> Quem pode me mandar mensagem
        </h3>
        {isMinor ? (
          <div className="space-y-2">
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-2.5">
              <p className="text-[11px] text-warning font-semibold mb-0.5">Conta de menor de idade — trava do ECA Digital</p>
              <p className="text-[10px] text-muted-foreground">
                Todo pedido de chat de estranho é bloqueado. Amigos precisam mandar pedido antes de conversar.
              </p>
            </div>
            <div className="grid gap-2">
              {([
                { v: 'notify',  t: 'Nível A — Amigo fala direto', d: 'Responsável só é notificado.' },
                { v: 'approve', t: 'Nível B — Responsável aprova cada pedido', d: 'Nada entra sem OK do responsável.' },
              ] as { v: 'notify' | 'approve'; t: string; d: string }[]).map(opt => {
                const active = approvalMode === opt.v;
                const disabled = isChild && opt.v === 'notify';
                return (
                  <div key={opt.v}
                    className={`rounded-lg border p-2.5 ${active ? 'border-primary bg-primary/10' : 'border-border bg-secondary'} ${disabled ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      {active && <Check className="h-3 w-3 text-primary" />} {opt.t}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{opt.d}</p>
                  </div>
                );
              })}
            </div>
            {isChild && <p className="text-[10px] text-muted-foreground">Criança (até 12) fica sempre no Nível B.</p>}
          </div>
        ) : (
          <>
            <p className="text-[10px] text-muted-foreground mb-2">
              Comportamento padrão pra novas conversas — você ainda vê os pedidos pendentes.
            </p>
            <div className="grid gap-2">
              {([
                { v: 'friends_direct',   t: 'Só amigos abrem direto',    d: 'Follow mútuo entra; resto vira pedido.' },
                { v: 'followers_direct', t: 'Quem me segue abre direto', d: 'Seguidores entram; resto vira pedido.' },
                { v: 'request_only',     t: 'Sempre exigir pedido',      d: 'Toda conversa fica pendente.' },
              ] as { v: ChatMode; t: string; d: string }[]).map(opt => {
                const active = chatMode === opt.v;
                return (
                  <button key={opt.v} type="button" onClick={() => saveChatMode(opt.v)} disabled={savingChat}
                    className={`text-left rounded-lg border p-2.5 transition-all ${active ? 'border-primary bg-primary/10' : 'border-border bg-secondary hover:border-primary/30'} disabled:opacity-60`}>
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      {active && <Check className="h-3 w-3 text-primary" />} {opt.t}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{opt.d}</p>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Personal Theme */}
      <div className="border-t border-border pt-3">
        <PersonalThemePanel />
      </div>

      {/* Steam */}
      <div className="border-t border-border pt-3">
        <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
          <Gamepad2 className="h-3.5 w-3.5 text-primary" /> Plataformas conectadas
        </h3>
        <button
          type="button"
          onClick={() => setSteamOpen(true)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs border border-border bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
        >
          <Gamepad2 className="h-3.5 w-3.5" /> Conectar Steam
          <span className="ml-1 text-[9px] uppercase tracking-wide bg-muted px-1.5 py-0.5 rounded">em breve</span>
        </button>
      </div>

      {/* Indicação */}
      <div className="border-t border-border pt-3">
        <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
          <Gift className="h-3.5 w-3.5 text-primary" /> Indicação
        </h3>
        <p className="text-[10px] text-muted-foreground mb-2">
          Compartilhe seu código. Quem resgatar ganha <strong>100 XP</strong>; você ganha <strong>200 XP</strong> por indicação.
        </p>
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 px-2.5 py-1.5 bg-secondary border border-border rounded-lg font-mono text-xs">
            {referralCode ?? '—'}
          </div>
          <button
            onClick={copyCode}
            disabled={!referralCode}
            className="px-2.5 py-1.5 rounded-lg border border-border text-xs flex items-center gap-1 hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <Copy className="h-3 w-3" /> Copiar
          </button>
        </div>
        {referredBy ? (
          <p className="text-[10px] text-muted-foreground">Você já resgatou um código de indicação.</p>
        ) : (
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">Tem um código de amigo?</label>
            <div className="flex items-center gap-2">
              <input
                value={redeemInput}
                onChange={e => {
                  setRedeemInput(e.target.value.toUpperCase());
                  setRedeemError(null);
                }}
                placeholder="EX.: A1B2C3D4"
                maxLength={12}
                className="flex-1 px-2.5 py-1.5 bg-secondary border border-border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                onClick={redeem}
                disabled={redeeming || !redeemInput.trim() || !!redeemError}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
              >
                {redeeming && <Loader2 className="h-3 w-3 animate-spin" />} Resgatar
              </button>
            </div>
            {redeemError && (
              <p className="text-[10px] text-destructive mt-1">{redeemError}</p>
            )}
          </div>
        )}
      </div>

      {/* Steam Modal */}
      {steamOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overlay-scrim backdrop-blur-sm" onClick={() => setSteamOpen(false)}>
          <div className="w-full max-w-md bg-background border-t border-border rounded-t-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Gamepad2 className="h-4 w-4 text-primary" /> Steam — em breve
              </h3>
              <button onClick={() => setSteamOpen(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <div className="flex gap-2 items-start rounded-lg border border-warning/40 bg-warning/10 p-2.5">
              <Info className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-warning mb-0.5">Modo AFK</p>
                <p className="text-[10px] text-muted-foreground">
                  Botão desligado por padrão — reserva o lugar na interface. Nenhum dado seu é enviado à Steam agora.
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold mb-1">O que virá:</p>
              <ol className="list-decimal list-inside text-[10px] text-muted-foreground space-y-0.5">
                <li>Login via SteamID / OpenID.</li>
                <li>Import da biblioteca pública + tempo de jogo.</li>
                <li>Jogos aparecem com selo <em>via Steam</em>.</li>
                <li>Desconectar a qualquer momento.</li>
              </ol>
            </div>
            <button onClick={() => setSteamOpen(false)} className="w-full py-2 rounded-lg border border-border text-xs font-semibold hover:bg-secondary transition-colors">Entendi</button>
          </div>
        </div>
      )}
    </div>
  );
}