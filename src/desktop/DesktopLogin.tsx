import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gamepad2, Eye, EyeOff, Lock, Mail, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDesktopAuth } from '@/hooks/useDesktopAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function DesktopLogin() {
  const navigate = useNavigate();
  const { signIn, user, isStaff } = useDesktopAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState('');

  // If already authenticated as staff, redirect
  if (user && isStaff) {
    navigate('/desktop', { replace: true });
    return null;
  }

  // GAP-D365: Recuperação de senha
  const handlePasswordReset = async () => {
    if (!email) {
      toast.error('Digite seu e-mail para recuperar a senha');
      return;
    }
    if (!email.includes('@')) {
      toast.error('Digite um e-mail válido');
      return;
    }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/desktop/reset-password',
      });
      if (error) throw error;
      toast.success('Link de recuperação enviado para seu e-mail!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar link de recuperação');
    } finally {
      setResetLoading(false);
    }
  };

  // GAP-D366: Feedback de erro específico
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Preencha e-mail e senha');
      return;
    }
    if (!email.includes('@')) {
      setError('Digite um e-mail válido');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        // GAP-D366: Mensagens específicas
        if (error.includes('Invalid login credentials')) {
          setError('E-mail ou senha incorretos. Verifique suas credenciais.');
        } else if (error.includes('Email not confirmed')) {
          setError('E-mail não confirmado. Verifique sua caixa de entrada.');
        } else if (error.includes('Too many requests')) {
          setError('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
        } else {
          setError(error);
        }
        setLoading(false);
        return;
      }
      toast.success('Login realizado com sucesso!');
      navigate('/desktop');
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao fazer login');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <Card className="w-full max-w-md mx-4 border-border/50 bg-card/80 backdrop-blur-sm relative z-10">
        <CardContent className="pt-8 pb-8 px-8">
          <div className="flex flex-col items-center mb-8">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Gamepad2 className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-primary">MIDIAS</span>
              <span className="text-accent ml-2">Backoffice</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Sistema de Gestão Interna</p>
          </div>

          {/* GAP-D366: Mensagem de erro */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="seu@email.com" 
                  className="pl-10"
                  value={email} 
                  onChange={(e) => { setEmail(e.target.value); setError(''); }} 
                  disabled={loading || resetLoading} 
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
                {/* GAP-D365: Link de recuperação */}
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={resetLoading}
                  className="text-xs text-primary hover:underline focus-ring"
                >
                  {resetLoading ? <Loader2 className="h-3 w-3 animate-spin inline mr-1" /> : 'Esqueceu?'}
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="password" 
                  type={showPassword ? 'text' : 'password'} 
                  placeholder="••••••••"
                  className="pl-10 pr-10" 
                  value={password} 
                  onChange={(e) => { setPassword(e.target.value); setError(''); }} 
                  disabled={loading || resetLoading}
                  autoComplete="current-password"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold" 
              disabled={loading || resetLoading}
            >
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Entrando...</> : 'Entrar'}
            </Button>

            <p className="text-center text-xs text-muted-foreground mt-4">
              Acesso restrito a funcionários autorizados
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}