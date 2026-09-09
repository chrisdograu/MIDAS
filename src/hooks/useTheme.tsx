import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { applyPersonalTheme, type PersonalTheme } from '@/lib/personalTheme';

// GAP-UT01: Tema do sistema
type SystemTheme = 'dark' | 'light';
type Theme = 'dark' | 'light' | 'system';

// GAP-UT03: Tema personalizado
interface CustomTheme {
  primary: string;
  accent: string;
  background: string;
  card: string;
  text: string;
}

// GAP-UT04: Temas nomeados
interface NamedTheme {
  id: string;
  name: string;
  colors: CustomTheme;
}

interface ThemeContextType {
  theme: Theme;
  currentTheme: SystemTheme;
  customTheme: CustomTheme | null;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setCustomTheme: (theme: CustomTheme) => void;
  resetCustomTheme: () => void;
}

const DEFAULT_CUSTOM_THEME: CustomTheme = {
  primary: '#14B8A6',
  accent: '#A855F7',
  background: '#0A0E1A',
  card: '#161B2C',
  text: '#F8FAFC',
};

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  currentTheme: 'dark',
  customTheme: null,
  setTheme: () => {},
  toggleTheme: () => {},
  setCustomTheme: () => {},
  resetCustomTheme: () => {},
});

// GAP-UT04: Temas predefinidos
const PREDEFINED_THEMES: NamedTheme[] = [
  {
    id: 'neon-dark',
    name: 'Neon Dark',
    colors: {
      primary: '#14B8A6',
      accent: '#A855F7',
      background: '#0A0E1A',
      card: '#161B2C',
      text: '#F8FAFC',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean Blue',
    colors: {
      primary: '#3B82F6',
      accent: '#06B6D4',
      background: '#0F172A',
      card: '#1E293B',
      text: '#F1F5F9',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    colors: {
      primary: '#EC4899',
      accent: '#F59E0B',
      background: '#1E1B2E',
      card: '#2D2A3E',
      text: '#FDF2F8',
    },
  },
];

export function ThemeProvider({ children }: { children: ReactNode }) {
  // GAP-UT01: Detectar tema do sistema
  const getSystemTheme = useCallback((): SystemTheme => {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, []);

  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('midias-theme') as Theme | null;
    return saved || 'system';
  });

  const [systemTheme, setSystemTheme] = useState<SystemTheme>(getSystemTheme);
  const [customTheme, setCustomTheme] = useState<CustomTheme | null>(null);

  // GAP-UT01: Detectar mudanças no tema do sistema
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };
    
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // GAP-UT01: Tema atual (resolvido)
  const currentTheme = useMemo((): SystemTheme => {
    return theme === 'system' ? systemTheme : theme;
  }, [theme, systemTheme]);

  // GAP-UT02: Transição suave
  useEffect(() => {
    if (typeof document === 'undefined') return;
    
    // Adicionar classe de transição
    document.documentElement.classList.add('theme-transition');
    
    const timer = setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 300);
    
    return () => clearTimeout(timer);
  }, [currentTheme]);

  // GAP-UT03: Aplicar tema
  useEffect(() => {
    const root = document.documentElement;
    
    // GAP-UT01: Aplicar tema claro/escuro
    if (currentTheme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
    
    // GAP-UT03: Aplicar tema personalizado
    const themeToApply = customTheme || DEFAULT_CUSTOM_THEME;
    root.style.setProperty('--custom-primary', themeToApply.primary);
    root.style.setProperty('--custom-accent', themeToApply.accent);
    root.style.setProperty('--custom-background', themeToApply.background);
    root.style.setProperty('--custom-card', themeToApply.card);
    root.style.setProperty('--custom-text', themeToApply.text);
    
    localStorage.setItem('midias-theme', theme);
    if (customTheme) {
      localStorage.setItem('midias-custom-theme', JSON.stringify(customTheme));
    }
  }, [theme, currentTheme, customTheme]);

  // GAP-UT04: Carregar tema personalizado salvo
  useEffect(() => {
    try {
      const saved = localStorage.getItem('midias-custom-theme');
      if (saved) {
        setCustomTheme(JSON.parse(saved));
      }
    } catch {
      // Ignorar
    }
  }, []);

  // Rodada 18 — "ambiente pessoal": aplica a cor de destaque salva no perfil
  useEffect(() => {
    let cancelado = false;
    const carregar = async (userId: string | undefined) => {
      if (!userId) { applyPersonalTheme(null); return; }
      const { data } = await supabase.from('profiles').select('personal_theme').eq('id', userId).maybeSingle();
      if (!cancelado) applyPersonalTheme(((data as any)?.personal_theme || null) as PersonalTheme | null);
    };
    supabase.auth.getSession().then(({ data }) => carregar(data.session?.user?.id));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      void carregar(session?.user?.id);
    });
    return () => { cancelado = true; sub.subscription.unsubscribe(); };
  }, []);

  const setThemeWrapper = useCallback((newTheme: Theme) => {
    setTheme(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      if (prev === 'system') {
        const system = getSystemTheme();
        return system === 'dark' ? 'light' : 'dark';
      }
      return prev === 'dark' ? 'light' : 'dark';
    });
  }, [getSystemTheme]);

  // GAP-UT03: Setar tema personalizado
  const setCustomThemeWrapper = useCallback((newTheme: CustomTheme) => {
    setCustomTheme(newTheme);
  }, []);

  // GAP-UT03: Resetar tema personalizado
  const resetCustomTheme = useCallback(() => {
    setCustomTheme(null);
    localStorage.removeItem('midias-custom-theme');
  }, []);

  return (
    <ThemeContext.Provider value={{
      theme,
      currentTheme,
      customTheme,
      setTheme: setThemeWrapper,
      toggleTheme,
      setCustomTheme: setCustomThemeWrapper,
      resetCustomTheme,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

// GAP-UT04: Hook para usar temas predefinidos
export function usePredefinedThemes() {
  return PREDEFINED_THEMES;
}

// GAP-UT04: Hook para aplicar tema predefinido
export function useApplyTheme() {
  const { setCustomTheme } = useTheme();
  
  const applyTheme = useCallback((themeId: string) => {
    const theme = PREDEFINED_THEMES.find(t => t.id === themeId);
    if (theme) {
      setCustomTheme(theme.colors);
    }
  }, [setCustomTheme]);
  
  return { applyTheme, themes: PREDEFINED_THEMES };
}