import { Suspense, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/lib/cartStore";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { TutorialProvider } from "@/components/tutorial/TutorialContext";
import { Loader2 } from "lucide-react";
import { mobileRoutes } from "@/routes/MobileRoutes";
import { desktopRoutes } from "@/routes/DesktopRoutes";
import { webRoutes } from "@/routes/WebRoutes";
import { QueryErrorBoundary } from "@/components/QueryErrorBoundary";
import OfflineBanner from "@/components/OfflineBanner";
import { persistQueryCache, restoreQueryCache } from "@/lib/queryPersist";
import { isNativeShell } from "@/lib/appUrl";
import { useNavigate } from "react-router-dom";
import { startOfflineQueueWatcher } from "@/lib/offlineQueue";
import { ErrorBoundary } from "react-error-boundary";
import DeveloperProfile from '@/pages/DeveloperProfile';
import DevelopersList from '@/pages/DevelopersList';
import GenrePage from '@/pages/GenrePage';
import PublisherProfile from '@/pages/PublisherProfile';
import ListasCuradas from '@/pages/ListasCuradas';
import ListaDetalhe from '@/pages/ListaDetalhe';
import Comparador from '@/pages/Comparador';
import Backlog from '@/pages/Backlog';
import PoliticaPrivacidade from '@/pages/PoliticaPrivacidade';
import Equipe from '@/pages/Equipe';

// GAP-AP02: Analytics tracking
function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    // GAP-AP02: Track page view
    const page = location.pathname + location.search;
    console.debug('[Analytics] Page view:', page);
    
    // Exemplo: enviar para Google Analytics
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('config', 'G-MEASUREMENT_ID', {
        page_path: page,
      });
    }

    // GAP-AP02: Performance timing
    if (window.performance) {
      const perfData = window.performance.timing;
      const loadTime = perfData.loadEventEnd - perfData.navigationStart;
      console.debug('[Analytics] Page load time:', loadTime, 'ms');
    }
  }, [location]);

  return null;
}

// GAP-AP03: PWA Update handler
function PWAUpdateHandler() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // GAP-AP03: Service worker update detection
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
              }
            });
          }
        });
      });

      // Check for updates periodically
      const interval = setInterval(() => {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then((registration) => {
            registration.update();
          });
        }
      }, 60 * 60 * 1000); // Check every hour

      return () => clearInterval(interval);
    }
  }, []);

  // GAP-AP03: Show update notification
  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-card border border-primary/30 rounded-lg shadow-xl p-4 max-w-sm w-full mx-4">
      <p className="text-sm font-medium text-foreground">
        Nova versão disponível!
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Atualize para a versão mais recente do MIDIAS.
      </p>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => {
            setUpdateAvailable(false);
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready.then((registration) => {
                registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
              });
            }
            window.location.reload();
          }}
          className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
        >
          Atualizar agora
        </button>
        <button
          onClick={() => setUpdateAvailable(false)}
          className="flex-1 py-1.5 rounded-lg bg-secondary text-sm font-semibold hover:bg-secondary/70"
        >
          Depois
        </button>
      </div>
    </div>
  );
}

// GAP-AP04: Theme persistence
const themeQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 1000 * 60 * 60 * 24,
      networkMode: "offlineFirst",
      retry: 1,
    },
    mutations: { networkMode: "offlineFirst" },
  },
});

// Restore cache
restoreQueryCache(themeQueryClient);

const OfflineSupport = () => {
  useEffect(() => {
    const unsubscribe = persistQueryCache(themeQueryClient);
    startOfflineQueueWatcher();
    return unsubscribe;
  }, []);
  return <OfflineBanner />;
};

// GAP-AP01: Global Error Fallback
function GlobalErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="max-w-md text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
          <span className="text-3xl">⚠️</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Algo deu errado</h1>
        <p className="text-sm text-muted-foreground">
          Ocorreu um erro inesperado. Por favor, tente recarregar a página.
        </p>
        {import.meta.env.DEV && (
          <pre className="text-xs text-left bg-secondary/50 p-4 rounded-lg overflow-auto max-h-40">
            {error.message}
          </pre>
        )}
        <button
          onClick={resetErrorBoundary}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

// Native entry redirect
const NativeEntryRedirect = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    if (!isNativeShell()) return;
    if (pathname === "/" || pathname === "/index.html") navigate("/m", { replace: true });
  }, [pathname, navigate]);
  return null;
};

const PageFallback = () => (
  <div className="min-h-[40vh] flex items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

const App = () => (
  <ErrorBoundary
    FallbackComponent={GlobalErrorFallback}
    onReset={() => {
      // Reset app state if needed
      window.location.reload();
    }}
  >
    <QueryClientProvider client={themeQueryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <TutorialProvider>
              <CartProvider>
                <Toaster />
                <Sonner />
                <OfflineSupport />
                <BrowserRouter>
                  <NativeEntryRedirect />
                  <AnalyticsTracker />
                  <PWAUpdateHandler />
                  <Suspense fallback={<PageFallback />}>
                    <QueryErrorBoundary>
                      <Routes>
                        {mobileRoutes}
                        {desktopRoutes}
                        {webRoutes}
                      </Routes>
                    </QueryErrorBoundary>
                  </Suspense>
                </BrowserRouter>
              </CartProvider>
            </TutorialProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;