import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Gamepad2, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, Mail, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

// GAP-584: Função para calcular força da senha
function getPasswordStrength(password: string): { score: number; label: string; color: string; tips: string[] } {
  if (!password) return { score: 0, label: '', color: 'bg-muted', tips: [] };
  
  let score = 0;
  const tips: string[] = [];
  
  if (password.length >= 8) {
    score++;
  } else {
    tips.push('Use pelo menos 8 caracteres');
  }
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
    score++;
  } else {
    tips.push('Use letras maiúsculas e minúsculas');
  }
  if (/\d/.test(password)) {
    score++;
  } else {
    tips.push('Inclua pelo menos um número');
  }
  if (/[^a-zA-Z0-9]/.test(password)) {
    score++;
  } else {
    tips.push('Inclua pelo menos um caractere especial (!@#$%)');
  }
  
  if (score <= 1) return { score, label: 'Fraca', color: 'bg-destructive', tips };
  if (score <= 3) return { score, label: 'Média', color: 'bg-warning', tips };
  return { score, label: 'Forte', color: 'bg-success', tips };
}

export default function ResetPassword() {
  const { updatePassword, session } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // GAP-585: Estado do link
  const [linkValid, setLinkValid] = useState<boolean | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  
  // GAP-586: Reenviar link
  const [resending, setResending] = useState(false);
  const [email, setEmail] = useState('');

  // GAP-584: Força da senha
  const passwordStrength = getPasswordStrength(password);

  // GAP-585: Verificar validade do link
  useEffect(() => {
    const hash = window.location.hash;
    const hasRecovery = hash.includes('type=recovery');
    const hasAccessToken = hash.includes('access_token=');
    
    if (!hasRecovery || !hasAccessToken) {
      setLinkValid(false);
      setLinkError('Link de recuperação inválido ou incompleto.');
      return;
    }
    
    // Verificar se o token ainda é válido (não expirado)
    // O Supabase já faz essa verificação no backend, mas podemos verificar
    // se há um session ou se o hash contém um token
    if (session) {
      setLinkValid(true);
      return;
    }
    
    // O e-mail virá do link de recuperação (query param) ou será digitado pelo usuário
    // Não usar localStorage para evitar vazamento
    
    // Se não temos session mas temos token no hash, consideramos válido
    // pois o Supabase vai validar no backend
    if (hasAccessToken) {
      setLinkValid(true);
    } else {
      setLinkValid(false);
      setLinkError('O link de recuperação pode ter expirado. Solicite um novo.');
    }
  }, [session]);

  // GAP-586: Reenviar link de recuperação
  const handleResendLink = async () => {
    if (!email) {
      toast.error('Digite seu e-mail para reenviar o link');
      return;
    }
    
    setResending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResending(false);
    
    if (error) {
      toast.error(error.message || 'Erro ao reenviar link');
      return;
    }
    
    toast.success('Novo link de recuperação enviado para seu e-mail!');
    // localStorage.setItem removido por segurança
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // GAP-584: Validar força da senha
    if (password.length < 6 || getPasswordStrength(password).score < 2) { 
      toast.error('A senha deve ter no mínimo 6 caracteres'); 
      return; 
    }
    if (password !== confirm) { 
      toast.error('As senhas não coincidem'); 
      return; 
    }
    
    // GAP-585: Verificar se o link é válido antes de tentar
    if (!linkValid) {
      toast.error('Link de recuperação inválido ou expirado. Solicite um novo.');
      return;
    }
    
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) { 
      // GAP-585: Tratar erro específico de link expirado
      if (error.includes('expired') || error.includes('invalid')) {
        setLinkValid(false);
        setLinkError('O link de recuperação expirou. Solicite um novo.');
        toast.error('Link expirado. Solicite um novo.');
        return;
      }
      toast.error(error); 
      return; 
    }
    toast.success('Senha atualizada com sucesso!');
    // localStorage.removeItem removido por segurança
    navigate('/');
  };

  // GAP-585: Tela de link inválido/expirado
  if (linkValid === false) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-4">
              <Gamepad2 className="h-8 w-8 text-primary" />
              <span className="font-display text-2xl font-bold gradient-text">MIDIAS</span>
            </Link>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <h1 className="text-xl font-bold text-foreground">Link inválido ou expirado</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {linkError || 'O link de recuperação de senha não é mais válido.'}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            {/* GAP-586: Formulário para reenviar link */}
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">E-mail para reenviar</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
            <button
              onClick={handleResendLink}
              disabled={resending}
              className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {resending ? (
                <span className="animate-pulse">Enviando...</span>
              ) : (
                <><RefreshCw className="h-4 w-4" /> Reenviar link de recuperação</>
              )}
            </button>
            <div className="text-center">
              <Link to="/auth" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Voltar para o login
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <Gamepad2 className="h-8 w-8 text-primary" />
            <span className="font-display text-2xl font-bold gradient-text">MIDIAS</span>
          </Link>
          <h1 className="text-xl font-bold text-foreground">Nova Senha</h1>
          <p className="text-sm text-muted-foreground mt-1">Defina sua nova senha abaixo</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Nova Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  value={password} 
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" 
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                  {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </button>
              </div>
              {/* GAP-584: Indicador de força da senha */}
              {password && (
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
                  {passwordStrength.tips.length > 0 && (
                    <div className="space-y-0.5">
                      {passwordStrength.tips.slice(0, 2).map((tip, i) => (
                        <p key={i} className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <span className="text-primary">•</span> {tip}
                        </p>
                      ))}
                    </div>
                  )}
                  {passwordStrength.score >= 4 && (
                    <p className="text-[10px] text-success flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Senha forte!
                    </p>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Confirmar Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  value={confirm} 
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full pl-10 pr-4 py-2.5 bg-secondary border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                    confirm && confirm !== password ? 'border-destructive' : 'border-border'
                  }`} 
                />
              </div>
              {confirm && confirm !== password && (
                <p className="text-[11px] text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> As senhas não coincidem
                </p>
              )}
              {confirm && confirm === password && password.length >= 6 && (
                <p className="text-[11px] text-success mt-1 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Senhas coincidem
                </p>
              )}
            </div>

            {/* GAP-586: Link para reenviar (caso tenha mudado de ideia) */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setLinkValid(false);
                  setLinkError('Solicite um novo link para redefinir sua senha.');
                }}
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                Não recebeu o link? Solicite um novo
              </button>
            </div>

            <button 
              type="submit" 
              disabled={loading || !linkValid}
              className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-all glow-primary disabled:opacity-50"
            >
              {loading ? 'Atualizando...' : 'Atualizar Senha'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}