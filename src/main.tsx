import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// GAP-MA03: Tema inicial antes do render
const initTheme = () => {
  const savedTheme = localStorage.getItem('midias-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

// GAP-MA04: Detecção de dispositivo
const initDeviceDetection = () => {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent);
  const isDesktop = !isMobile && !isTablet;

  document.documentElement.dataset.device = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';
  
  // Adicionar classe para CSS
  if (isMobile) document.documentElement.classList.add('is-mobile');
  if (isTablet) document.documentElement.classList.add('is-tablet');
  if (isDesktop) document.documentElement.classList.add('is-desktop');
};

// GAP-MA01: Registro do Service Worker
const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
      });
      
      // GAP-MA01: Log do registro
      console.debug('[SW] Registered:', registration);

      // GAP-MA01: Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              console.debug('[SW] Update available');
            }
          });
        }
      });
    } catch (error) {
      console.debug('[SW] Registration failed:', error);
    }
  }
};

// GAP-MA02: Core Web Vitals
const reportWebVitals = () => {
  if (import.meta.env.PROD && 'webVitals' in window) {
    // Carregar dinamicamente web-vitals
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(console.debug);
      getFID(console.debug);
      getFCP(console.debug);
      getLCP(console.debug);
      getTTFB(console.debug);
    });
  }
};

// GAP-MA02: Performance marks
const markPerformance = () => {
  if (window.performance) {
    performance.mark('midias-app-start');
  }
};

// GAP-MA03: Aplicar tema
initTheme();

// GAP-MA04: Detectar dispositivo
initDeviceDetection();

// GAP-MA02: Marcar performance
markPerformance();

// GAP-MA01: Registrar SW
registerServiceWorker();

// GAP-MA02: Reportar Web Vitals
reportWebVitals();

// GAP-MA01: Chunk reload para erro de importação
let chunkReloaded = false;

// Renderizar app
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(<App />);

// GAP-MA01: Vite chunk reload
window.addEventListener("vite:preloadError", () => {
  if (chunkReloaded) return;
  chunkReloaded = true;
  console.debug('[Vite] Chunk preload error, reloading...');
  window.location.reload();
});

// GAP-MA01: Global error handler for chunks
window.addEventListener("error", (event) => {
  const message = event.error?.message || event.message || "";
  if (!chunkReloaded && /Failed to fetch dynamically imported module|Importing a module script failed/i.test(message)) {
    chunkReloaded = true;
    console.debug('[Vite] Dynamic import failed, reloading...');
    window.location.reload();
  }
});

// GAP-MA03: Listen for theme changes
window.addEventListener('storage', (event) => {
  if (event.key === 'midias-theme') {
    if (event.newValue === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
});

// GAP-MA04: Listen for device changes (orientation)
window.addEventListener('resize', () => {
  const isMobile = window.innerWidth < 768;
  document.documentElement.dataset.width = isMobile ? 'mobile' : 'desktop';
});

// GAP-MA01: Service worker update check
if ('serviceWorker' in navigator) {
  // Check for updates every 5 minutes when tab is visible
  let swUpdateInterval: NodeJS.Timeout | null = null;
  
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (swUpdateInterval) clearInterval(swUpdateInterval);
      swUpdateInterval = setInterval(() => {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then((registration) => {
            registration.update();
          });
        }
      }, 5 * 60 * 1000);
    } else if (swUpdateInterval) {
      clearInterval(swUpdateInterval);
      swUpdateInterval = null;
    }
  });

  // Initial check
  if (document.visibilityState === 'visible') {
    swUpdateInterval = setInterval(() => {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.update();
        });
      }
    }, 5 * 60 * 1000);
  }
}

// GAP-MA02: Report performance on page load
if (window.performance) {
  window.addEventListener('load', () => {
    const perfData = window.performance.timing;
    const loadTime = perfData.loadEventEnd - perfData.navigationStart;
    console.debug('[Performance] Page load:', loadTime, 'ms');
    
    // Report to analytics
    if (window.gtag) {
      window.gtag('event', 'performance', {
        event_category: 'loading',
        event_label: 'page_load',
        value: loadTime,
      });
    }
  });
}