import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Mail, Lock, User as UserIcon, Loader2, ArrowLeft, Calendar, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { toast } from 'sonner';

// GAP-1004: Função para calcular força da senha
function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: 'bg-muted' };
  
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  
  if (score <= 1) return { score, label: 'Fraca', color: 'bg-destructive' };
  if (score <= 3) return { score, label: 'Média', color: 'bg-warning' };
  return { score, label: 'Forte', color: 'bg-success' };
}

// GAP-1003: Verificar banimento
async function checkBanStatus(email: string): Promise<{ banned: boolean; until: string | null; reason: string | null }> {
  const { data } = await supabase
    .from('profiles')
    .select('banned_until, ban_reason_public')
    .eq('email', email)
    .maybeSingle();
  
  if (!data) return { banned: false, until: null, reason: null };
  const bannedUntil = (data as any)?.banned_until;
  if (!bannedUntil) return { banned: false, until: null, reason: null };
  return {
    banned: new Date(bannedUntil) > new Date(),
    until: bannedUntil,
    reason: (data as any)?.ban_reason_public || null,
  };
}

const signUpSchema = z.object({
  displayName: z.string().trim().min(2, 'Nome muito curto').max(60),
  email: z.string().trim().email('E-mail inválido').max(255),
  password: z.string().min(6, 'Mínimo 6 caracteres').max(72),
  birthDate: z.string().min(10, 'Informe sua data de nascimento'),
});
const signInSchema = z.object({
  email: z.string().trim().email('E-mail inválido').max(255),
  password: z.string().min(1).max(72),
});
const forgotSchema = z.object({ email: z.string().trim().email('E-mail inválido').max(255) });

type Mode = 'in' | 'up' | 'forgot';

export default function MAuth() {
  const { user, signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('in');
  const [form, setForm] = useState({ displayName: '', email: '', password: '', birthDate: '' });
  const [emailConfirm, setEmailConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // GAP-1005: Login com Google
  const [googleLoading, setGoogleLoading] = useState(false);

  // GAP-1004: Força da senha
  const passwordStrength = getPasswordStrength(form.password);

  // GAP-1003: Verificar banimento antes do login
  const handleSignIn = async (email: string, password: string) => {
    // Verificar banimento
    const banStatus = await checkBanStatus(email);
    if (banStatus.banned) {
      toast.error(`Conta suspensa até ${new Date(banStatus.until!).toLocaleDateString('pt-BR')}`);
      return;
    }
    return await signIn(email, password);
  };

  // GAP-1005: Login com Google
  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/m/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || 'Erro ao fazer login com Google');
      setGoogleLoading(false);
    }
  };

  if (user) return <Navigate to="/m" replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (mode === 'forgot') {
      const parsed = forgotSchema.safeParse({ email: form.email });
      if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
      setLoading(true);
      const { error } = await resetPassword(form.email);
      setLoading(false);
      if (error) { toast.error(error); return; }
      toast.success('📧 Link de recuperação enviado! Verifique seu e-mail.');
      setMode('in');
      return;
    }

    const schema = mode === 'in' ? signInSchema : signUpSchema;
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    if (mode === 'up' && emailConfirm.trim().toLowerCase() !== form.email.trim().toLowerCase()) {
      toast.error('Os e-mails não coincidem. Digite novamente para confirmar.');
      return;
    }
    setLoading(true);
    
    let error;
    if (mode === 'in') {
      const result = await handleSignIn(form.email, form.password);
      error = result?.error;
    } else {
      const result = await signUp(form.email, form.password, form.displayName);
      error = result?.error;
    }
    
    if (!error && mode === 'up') {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (uid) await supabase.from('profiles').update({ birth_date: form.birthDate } as any).eq('id', uid);
    }
    setLoading(false);
    if (error) { toast.error(error); return; }
    toast.success(mode === 'in' ? '✨ Bem-vindo de volta!' : '🎮 Conta criada! Verifique seu e-mail.');
    if (mode === 'in') navigate('/m');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
      <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, hsl(var(--glow-primary) / 0.18) 0%, transparent 50%), radial-gradient(circle at 80% 70%, hsl(var(--glow-accent) / 0.18) 0%, transparent 50%)' }} />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-bold gradient-text tracking-widest mb-1">MIDIAS</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">comunidade gamer mobile</p>
        </div>

        <div className="glass rounded-2xl p-6 space-y-4 shadow-2xl">
          {mode !== 'forgot' ? (
            <div className="flex gap-2 p-1 bg-secondary/50 rounded-lg">
              <button type="button" onClick={() => setMode('in')}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${mode === 'in' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>🎮 Entrar</button>
              <button type="button" onClick={() => setMode('up')}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${mode === 'up' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>✨ Criar conta</button>
            </div>
          ) : (
            <button type="button" onClick={() => setMode('in')} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3" /> Voltar para o login
            </button>
          )}

          {/* GAP-1005: Login com Google */}
          {mode === 'in' && (
            <button
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              className="w-full py-2.5 bg-white dark:bg-gray-800 border border-border rounded-lg flex items-center justify-center gap-2 text-sm font-medium text-foreground hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {googleLoading ? 'Aguarde...' : 'Entrar com Google'}
            </button>
          )}

          <form onSubmit={onSubmit} className="space-y-3">
            {mode === 'up' && (
              <>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })}
                    placeholder="Seu nome de exibição"
                    className="w-full pl-10 pr-3 py-2.5 bg-background/60 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input type="date" value={form.birthDate} onChange={e => setForm({ ...form, birthDate: e.target.value })}
                      max={new Date().toISOString().slice(0, 10)}
                      aria-label="Data de nascimento"
                      className="w-full pl-10 pr-3 py-2.5 bg-background/60 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 px-1">Obrigatório (Lei 15.211/2025 — ECA Digital). Define quais jogos aparecem para você.</p>
                </div>
              </>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="seu@email.com"
                className="w-full pl-10 pr-3 py-2.5 bg-background/60 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            {mode === 'up' && (
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="email" value={emailConfirm} onChange={e => setEmailConfirm(e.target.value)}
                  onPaste={e => e.preventDefault()}
                  autoComplete="off"
                  aria-label="Confirme seu e-mail"
                  placeholder="Confirme seu e-mail"
                  className="w-full pl-10 pr-3 py-2.5 bg-background/60 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
            )}

            {mode !== 'forgot' && (
              <div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    value={form.password} 
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder="Sua senha"
                    className="w-full pl-10 pr-10 py-2.5 bg-background/60 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
                {/* GAP-1004: Indicador de força da senha */}
                {mode === 'up' && form.password && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                          style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-medium ${
                        passwordStrength.score <= 1 ? 'text-destructive' :
                        passwordStrength.score <= 3 ? 'text-warning' : 'text-success'
                      }`}>
                        {passwordStrength.label}
                      </span>
                    </div>
                    {passwordStrength.score <= 1 && (
                      <p className="text-[10px] text-muted-foreground">Use maiúsculas, números e caracteres especiais.</p>
                    )}
                    {passwordStrength.score >= 4 && (
                      <p className="text-[10px] text-success flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Senha forte!
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold rounded-lg flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all glow-primary">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'in' ? 'Entrar' : mode === 'up' ? 'Criar conta' : 'Enviar link de recuperação'}
            </button>

            {mode === 'in' && (
              <button type="button" onClick={() => setMode('forgot')} className="w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors">
                Esqueceu sua senha?
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Ao continuar você concorda com os termos da plataforma.
        </p>
      </motion.div>
    </div>
  );
}