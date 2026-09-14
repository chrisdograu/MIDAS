import { Component, ReactNode, useState, useEffect } from "react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, WifiOff, FileQuestion, ServerCrash, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// GAP-QE04: Tipos de erro
type ErrorType = 'network' | 'not_found' | 'server' | 'unknown';

// GAP-QE03: Logging de erros
const logError = (error: Error, context?: string) => {
  console.error("[QueryErrorBoundary]", context || 'unknown', error);
  // Em produção, enviar para serviço de logging
  if (typeof window !== 'undefined' && import.meta.env.PROD) {
    // Exemplo: enviar para Sentry ou similar
    // Sentry.captureException(error, { extra: { context } });
  }
};

// GAP-QE04: Determinar tipo de erro
const getErrorType = (error: Error): ErrorType => {
  const message = error.message?.toLowerCase() || '';
  if (message.includes('network') || message.includes('fetch') || message.includes('offline')) {
    return 'network';
  }
  if (message.includes('404') || message.includes('not found')) {
    return 'not_found';
  }
  if (message.includes('500') || message.includes('server') || message.includes('internal')) {
    return 'server';
  }
  return 'unknown';
};

// GAP-QE04: Configurações por tipo de erro
const errorConfigs: Record<ErrorType, { icon: any; title: string; description: string }> = {
  network: {
    icon: WifiOff,
    title: 'Sem conexão com o servidor',
    description: 'Verifique sua conexão com a internet e tente novamente.',
  },
  not_found: {
    icon: FileQuestion,
    title: 'Conteúdo não encontrado',
    description: 'O recurso que você está tentando acessar não existe ou foi removido.',
  },
  server: {
    icon: ServerCrash,
    title: 'Erro no servidor',
    description: 'O servidor encontrou um problema ao processar sua solicitação. Tente novamente mais tarde.',
  },
  unknown: {
    icon: AlertTriangle,
    title: 'Algo deu errado',
    description: 'Não conseguimos buscar os dados desta tela. Tente novamente em instantes.',
  },
};

interface ErrorBoundaryInnerProps {
  children: ReactNode;
  onReset?: () => void;
  /** GAP-QE01: Número máximo de retries */
  maxRetries?: number;
  /** GAP-QE02: Fallback UI customizada */
  fallback?: (error: Error, reset: () => void, retryCount: number) => ReactNode;
  /** GAP-QE03: Contexto para logging */
  context?: string;
}

interface ErrorBoundaryInnerState {
  error: Error | null;
  retryCount: number;
}

class ErrorBoundaryInner extends Component<ErrorBoundaryInnerProps, ErrorBoundaryInnerState> {
  state: ErrorBoundaryInnerState = { error: null, retryCount: 0 };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryInnerState> {
    return { error };
  }

  componentDidCatch(error: Error) {
    // GAP-QE03: Logging
    logError(error, this.props.context);
  }

  reset = () => {
    this.setState({ error: null, retryCount: 0 });
    this.props.onReset?.();
  };

  retry = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;
    
    if (retryCount >= maxRetries) {
      // GAP-QE01: Excedeu número máximo de tentativas
      return;
    }
    
    this.setState(prev => ({ 
      error: null, 
      retryCount: prev.retryCount + 1 
    }));
    this.props.onReset?.();
  };

  render() {
    const { error, retryCount } = this.state;
    const { children, fallback, maxRetries = 3 } = this.props;

    if (error) {
      // GAP-QE02: Fallback customizado
      if (fallback) {
        return <>{fallback(error, this.reset, retryCount)}</>;
      }

      const errorType = getErrorType(error);
      const config = errorConfigs[errorType] || errorConfigs.unknown;
      const Icon = config.icon;
      const isMaxRetries = retryCount >= maxRetries;

      return (
        <div className="min-h-[40vh] flex items-center justify-center p-6">
          <div className="max-w-md text-center space-y-4 rounded-lg border border-destructive/40 bg-destructive/5 p-6">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <Icon className="h-6 w-6 text-destructive" />
              </div>
            </div>
            
            <div>
              <h2 className="text-lg font-semibold text-foreground">{config.title}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {config.description}
                {error.message && (
                  <span className="block mt-1 text-xs text-muted-foreground/70">
                    {error.message}
                  </span>
                )}
              </p>
            </div>

            {/* GAP-QE01: Contador de retries */}
            {retryCount > 0 && (
              <p className="text-xs text-muted-foreground">
                Tentativa {retryCount} de {maxRetries}
              </p>
            )}

            {isMaxRetries ? (
              <Button 
                onClick={this.reset} 
                variant="default" 
                size="sm"
                className="w-full"
              >
                Recarregar página
              </Button>
            ) : (
              <Button 
                onClick={this.retry} 
                variant="outline" 
                size="sm"
                className="w-full"
                disabled={retryCount >= maxRetries}
              >
                {retryCount > 0 && retryCount < maxRetries ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Tentando novamente...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Tentar novamente
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      );
    }

    return children;
  }
}

interface QueryErrorBoundaryProps {
  children: ReactNode;
  /** GAP-QE01: Número máximo de retries */
  maxRetries?: number;
  /** GAP-QE02: Fallback UI customizada */
  fallback?: (error: Error, reset: () => void, retryCount: number) => ReactNode;
  /** GAP-QE03: Contexto para logging */
  context?: string;
}

export function QueryErrorBoundary({ 
  children, 
  maxRetries = 3,
  fallback,
  context,
}: QueryErrorBoundaryProps) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundaryInner 
          onReset={reset} 
          maxRetries={maxRetries}
          fallback={fallback}
          context={context}
        >
          {children}
        </ErrorBoundaryInner>
      )}
    </QueryErrorResetBoundary>
  );
}

// GAP-QE04: Conveniência para erros de rede
export function NetworkErrorBoundary(props: Omit<QueryErrorBoundaryProps, 'fallback'>) {
  return (
    <QueryErrorBoundary
      {...props}
      fallback={(error, reset) => {
        const fallbackConfig = errorConfigs.network;
        return (
          <div className="min-h-[40vh] flex items-center justify-center p-6">
            <div className="max-w-md text-center space-y-4">
              <WifiOff className="h-12 w-12 text-muted-foreground mx-auto" />
              <h3 className="text-lg font-semibold">{fallbackConfig.title}</h3>
              <p className="text-sm text-muted-foreground">{fallbackConfig.description}</p>
              <Button onClick={reset}>Tentar novamente</Button>
            </div>
          </div>
        );
      }}
    />
  );
}

export default QueryErrorBoundary;