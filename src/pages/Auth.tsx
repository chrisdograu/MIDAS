import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Gamepad2, Mail, Lock, User, Eye, EyeOff, Calendar, Check, Shield, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

// GAP-392: Função para calcular força da senha
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

// GAP-396: Verificar idade mínima (13+ anos)
function isAtLeast13YearsOld(birthDate: string): boolean {
  if (!birthDate) return false;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 13;
}

export default function Auth() {
  const { signIn, signUp, resetPassword, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [loading, setLoading] = useState(false);
  
  // GAP-394: Aceitar termos
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  
  // GAP-393: Login com Google
  const [googleLoading, setGoogleLoading] = useState(false);

  // Redirect if already logged in (dentro de efeito: navegar durante o render quebra o React)
  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  // GAP-392: Força da senha
  const passwordStrength = getPasswordStrength(password);
  
  // GAP-396: Validação de idade
  const [ageError, setAgeError] = useState<string | null>(null);
  
  useEffect(() => {
    if (birthDate && !isAtLeast13YearsOld(birthDate)) {
      setAgeError('Você deve ter pelo menos 13 anos para criar uma conta.');
    } else {
      setAgeError(null);
    }
  }, [birthDate]);

  // GAP-393: Login com Google
  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      // O redirecionamento é automático
    } catch (error: any) {
      const msg = String(error?.message || '');
      toast.error(
        msg.includes('provider is not enabled')
          ? 'A entrada com Google ainda não está ativada. Use seu e-mail e senha.'
          : 'Não foi possível entrar com o Google. Tente pelo e-mail e senha.'
      );
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (mode === 'forgot') {
      if (!email) { setLoading(false); toast.error('Informe seu e-mail'); return; }
      const { error } = await resetPassword(email);
      setLoading(false);
      if (error) { toast.error(error); return; }
      toast.success('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
      setMode('login');
      return;
    }

    if (mode === 'signup') {
      if (password.length < 6) { setLoading(false); toast.error('A senha deve ter no mínimo 6 caracteres'); return; }
      if (password !== confirmPassword) { setLoading(false); toast.error('As senhas não coincidem.'); return; }
      if (!birthDate) { setLoading(false); toast.error('Informe sua data de nascimento (obrigatório).'); return; }
      
      // GAP-396: Verificar idade mínima
      if (!isAtLeast13YearsOld(birthDate)) {
        setLoading(false);
        toast.error('Você deve ter pelo menos 13 anos para criar uma conta.');
        return;
      }
      
      // GAP-394: Verificar aceitação dos termos
      if (!acceptedTerms) {
        setLoading(false);
        toast.error('Você precisa aceitar os Termos de Uso para criar uma conta.');
        return;
      }
      
      const { error, data: signUpData } = await signUp(email, password, name, { birth_date: birthDate });
      if (!error && signUpData?.user?.id) {
        // Salva direto se a sessão já existir (confirmação de e-mail desativada)
        // Se não, o trigger/edge function deve ler user_metadata.birth_date
        try {
          const { data: sess } = await supabase.auth.getSession();
          const uid = sess.session?.user?.id;
          if (uid) {
            await supabase.from('profiles').update({ birth_date: birthDate } as any).eq('id', uid);
          }
        } catch { /* silent: metadata já carrega birth_date */ }
      }
      setLoading(false);
      if (error) { toast.error(error); return; }
      toast.success('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
      return;
    }

    try {
      const { error } = await signIn(email, password);
      if (error) { toast.error('E-mail ou senha incorretos'); return; }
      toast.success('Login realizado com sucesso!');
      navigate('/');
    } catch {
      toast.error('Erro de conexão. Verifique sua internet.');
    } finally {
      setLoading(false);
    }
  };

  const titles = {
    login: { h1: 'Entrar na sua conta', sub: 'Bem-vindo de volta!' },
    signup: { h1: 'Criar uma conta', sub: 'Junte-se à comunidade Midias' },
    forgot: { h1: 'Recuperar senha', sub: 'Enviaremos um link para seu e-mail' },
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" aria-hidden />
      <div
        className="absolute inset-0"
        aria-hidden
        style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, hsl(var(--glow-primary) / 0.16) 0%, transparent 50%), radial-gradient(circle at 80% 70%, hsl(var(--glow-accent) / 0.16) 0%, transparent 50%)' }}
      />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <Gamepad2 className="h-8 w-8 text-primary" />
            <span className="font-display text-2xl font-bold gradient-text">MIDIAS</span>
          </Link>
          <h1 className="text-xl font-bold text-foreground">{titles[mode].h1}</h1>
          <p className="text-sm text-muted-foreground mt-1">{titles[mode].sub}</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          {/* GAP-393: Login com Google */}
          {mode === 'login' && (
            <div className="mb-4">
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
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">ou</span>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Nome</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" required
                      className="w-full pl-10 pr-4 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Data de nascimento</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
                    <input 
                      type="date" 
                      value={birthDate} 
                      onChange={e => setBirthDate(e.target.value)} 
                      required
                      max={new Date().toISOString().slice(0, 10)}
                      aria-label="Data de nascimento"
                      className={`w-full pl-10 pr-4 py-2.5 bg-secondary border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                        ageError ? 'border-destructive' : 'border-border'
                      }`}
                    />
                  </div>
                  {/* GAP-396: Erro de idade mínima */}
                  {ageError && (
                    <p className="text-[11px] text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {ageError}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">Obrigatório pela Lei 15.211/2025 (ECA Digital). Determina a classificação indicativa dos jogos que você vê.</p>
                </div>
              </>
            )}
            <div>
              <label htmlFor="auth-email" className="text-sm text-muted-foreground mb-1 block">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input id="auth-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required autoComplete="email"
                  className="w-full pl-10 pr-4 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
            </div>
            {mode !== 'forgot' && (
              <div>
                <label htmlFor="auth-password" className="text-sm text-muted-foreground mb-1 block">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input 
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'} 
                    value={password} 
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" 
                    required 
                    minLength={6}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    className="w-full pl-10 pr-10 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" 
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} className="absolute right-3 top-1/2 -translate-y-1/2">
                    {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
                {/* GAP-392: Indicador de força da senha */}
                {mode === 'signup' && password && (
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
                    <p className="text-[10px] text-muted-foreground">
                      {passwordStrength.score <= 1 && 'Use maiúsculas, números e caracteres especiais.'}
                      {passwordStrength.score === 2 && 'Adicione mais caracteres e variedade.'}
                      {passwordStrength.score >= 3 && 'Senha boa!'}
                    </p>
                  </div>
                )}
              </div>
            )}
            {mode === 'signup' && (
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Confirmar senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)}
                    onPaste={e => e.preventDefault()}
                    placeholder="Repita a senha" 
                    required 
                    minLength={6} 
                    aria-label="Confirmar senha"
                    className={`w-full pl-10 pr-4 py-2.5 bg-secondary border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                      confirmPassword && confirmPassword !== password ? 'border-destructive' : 'border-border'
                    }`} 
                  />
                </div>
                {confirmPassword.length > 0 && confirmPassword !== password && (
                  <p className="text-[11px] text-destructive mt-1">As senhas não coincidem.</p>
                )}
                {confirmPassword.length > 0 && confirmPassword === password && (
                  <p className="text-[11px] text-success mt-1 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Senhas coincidem.
                  </p>
                )}
              </div>
            )}

            {/* GAP-394: Aceitar Termos de Uso */}
            {mode === 'signup' && (
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="acceptTerms"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-primary rounded border-border"
                  required
                />
                <label htmlFor="acceptTerms" className="text-xs text-muted-foreground">
                  Li e aceito os{' '}
                  <Link to="/termos" className="text-primary hover:underline" target="_blank">
                    Termos de Uso
                  </Link>{' '}
                  e a{' '}
                  <Link to="/termos" className="text-primary hover:underline" target="_blank">
                    Política de Privacidade
                  </Link>
                  .
                </label>
              </div>
            )}

            {mode === 'login' && (
              <div className="text-right">
                <button type="button" onClick={() => setMode('forgot')} className="text-xs text-primary hover:underline">Esqueceu a senha?</button>
              </div>
            )}

            <button type="submit" disabled={loading || (mode === 'signup' && !acceptedTerms)}
              className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-all glow-primary disabled:opacity-50">
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar Conta' : 'Enviar Link'}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === 'login' && (
              <>Não tem conta? <button onClick={() => setMode('signup')} className="text-primary hover:underline font-medium">Criar conta</button></>
            )}
            {mode === 'signup' && (
              <>Já tem conta? <button onClick={() => setMode('login')} className="text-primary hover:underline font-medium">Fazer login</button></>
            )}
            {mode === 'forgot' && (
              <>Lembrou a senha? <button onClick={() => setMode('login')} className="text-primary hover:underline font-medium">Voltar ao login</button></>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}