import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  ShoppingCart, Search, User, Menu, X, Gamepad2, LogOut, Heart, 
  Package, Library, Sparkles, Ban, AtSign, MessageSquare, 
  Mic, Command, ChevronRight 
} from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import NotificationBell from './NotificationBell';
import { supabase } from '@/integrations/supabase/client';
import { usePrefetchRoute } from '@/hooks/usePrefetchRoute';
import { escapeIlikeTerm } from '@/lib/escapeIlike';
import { formatDate } from '@/lib/format';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ListChecks } from 'lucide-react';

// GAP-HE04: Atalhos globais
const SHORTCUTS = [
  { key: '⌘K', description: 'Buscar' },
  { key: '⌘P', description: 'Perfil' },
  { key: '⌘B', description: 'Biblioteca' },
  { key: '⌘C', description: 'Carrinho' },
  { key: '⌘O', description: 'Ofertas' },
];

export default function Header() {
  const { itemCount } = useCart();
  const { user, profile, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [userResults, setUserResults] = useState<{ id: string; display_name: string | null; username: string | null; avatar_url: string | null }[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const prefetch = usePrefetchRoute();

  const isBanned = profile?.banned_until && new Date(profile.banned_until) > new Date();

  // GAP-HE01: Notificações em tempo real
  useEffect(() => {
    if (!user) return;
    
    const channel = supabase
      .channel('header-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          // Atualiza o badge de notificações
          // O NotificationBell já lida com o badge
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // GAP-HE04: Shortcuts globais
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘K para buscar
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
      }
      // ⌘P para perfil
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        if (user) navigate('/perfil');
      }
      // ⌘B para biblioteca
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        if (user) navigate('/biblioteca');
      }
      // ⌘C para carrinho
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        e.preventDefault();
        navigate('/carrinho');
      }
      // ⌘O para ofertas
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault();
        navigate('/ofertas');
      }
      // ⌘? para mostrar atalhos
      if ((e.metaKey || e.ctrlKey) && e.key === '?') {
        e.preventDefault();
        setShowShortcuts(true);
        setTimeout(() => setShowShortcuts(false), 5000);
      }
      // Escape para fechar menus
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setUserMenuOpen(false);
        setSearchOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [user, navigate]);

  // GAP-HE03: Pesquisa por voz
  const handleVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Pesquisa por voz não disponível neste navegador');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
      setIsListening(false);
      // Executa busca automática
      if (transcript.trim()) {
        navigate(`/busca?q=${encodeURIComponent(transcript.trim())}`);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      toast.error('Não foi possível capturar áudio');
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const navLinks = [
    { to: '/catalogo', label: 'Catálogo' },
    { to: '/ofertas', label: 'Ofertas' },
    { to: '/em-alta', label: 'Em Alta' },
    { to: '/pra-voce', label: 'Pra Você' },
    { to: '/torneios', label: 'Torneios' },
    { to: '/social', label: 'Social' },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    if (q.startsWith('@') && userResults[0]) {
      navigate(`/perfil/${userResults[0].id}`);
    } else {
      navigate(`/busca?q=${encodeURIComponent(q)}`);
    }
    setSearchOpen(false);
  };

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q.startsWith('@') || q.length < 2) { setUserResults([]); return; }
    const term = escapeIlikeTerm(q.slice(1));
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles').select('id, display_name, username, avatar_url')
        .or(`display_name.ilike.%${term}%,username.ilike.%${term}%`).limit(8);
      setUserResults(data || []);
    }, 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setUserMenuOpen(false);
    navigate('/');
  };

  // GAP-HE02: Breadcrumbs
  const getBreadcrumbs = () => {
    const path = location.pathname;
    const segments = path.split('/').filter(Boolean);
    
    if (segments.length === 0) return [{ label: 'Início', path: '/' }];
    
    const crumbs = [{ label: 'Início', path: '/' }];
    let currentPath = '';
    
    for (const segment of segments) {
      currentPath += `/${segment}`;
      const labelMap: Record<string, string> = {
        'jogo': 'Jogo',
        'catalogo': 'Catálogo',
        'ofertas': 'Ofertas',
        'em-alta': 'Em Alta',
        'pra-voce': 'Pra Você',
        'torneios': 'Torneios',
        'social': 'Social',
        'perfil': 'Perfil',
        'biblioteca': 'Biblioteca',
        'carrinho': 'Carrinho',
        'pedidos': 'Pedidos',
        'favoritos': 'Favoritos',
        'busca': 'Busca',
      };
      
      const label = labelMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
      crumbs.push({ label, path: currentPath });
    }
    
    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <>
      {isBanned && (
        <div className="bg-destructive/90 text-destructive-foreground text-center text-xs py-1.5 px-4 flex items-center justify-center gap-2">
          <Ban className="h-3.5 w-3.5" />
          <span>Sua conta está suspensa até {formatDate(profile!.banned_until!)}. Funcionalidades limitadas.</span>
        </div>
      )}
      
      {/* GAP-HE04: Shortcuts overlay */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg shadow-xl p-4 z-50 min-w-[280px]"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold">Atalhos do Teclado</h4>
              <button onClick={() => setShowShortcuts(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1.5">
              {SHORTCUTS.map((shortcut) => (
                <div key={shortcut.key} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{shortcut.description}</span>
                  <kbd className="px-2 py-0.5 bg-secondary/50 rounded text-xs font-mono border border-border">
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Pressione ⌘? para ver novamente</p>
          </motion.div>
        )}
      </AnimatePresence>

      <header aria-label="Cabeçalho da plataforma" className="sticky top-0 z-50 glass">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 gap-4">
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <Gamepad2 className="h-7 w-7 text-primary" />
              <span className="font-display text-xl font-bold gradient-text tracking-wider">MIDIAS</span>
            </Link>

            {/* GAP-HE02: Breadcrumbs (desktop) */}
            <nav className="hidden lg:flex items-center gap-1 text-sm text-muted-foreground">
              {breadcrumbs.map((crumb, index) => (
                <div key={crumb.path} className="flex items-center">
                  {index > 0 && <ChevronRight className="h-3 w-3 mx-1" />}
                  {index === breadcrumbs.length - 1 ? (
                    <span className="text-foreground font-medium">{crumb.label}</span>
                  ) : (
                    <Link to={crumb.path} className="hover:text-foreground transition-colors">
                      {crumb.label}
                    </Link>
                  )}
                </div>
              ))}
            </nav>

            <form onSubmit={handleSearch} role="search" aria-label="Busca global" className="hidden md:flex flex-1 max-w-md">
              <div ref={searchRef} className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Buscar em todo MIDIAS — jogos, @usuário, vendedores..."
                  className="w-full pl-10 pr-12 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" 
                />
                {/* GAP-HE03: Botão de pesquisa por voz */}
                <button
                  type="button"
                  onClick={handleVoiceSearch}
                  className={cn(
                    "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors",
                    isListening 
                      ? "text-primary animate-pulse" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label="Pesquisar por voz"
                >
                  <Mic className="h-4 w-4" />
                </button>
                
                {searchOpen && searchQuery.startsWith('@') && userResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-xl overflow-hidden z-50 max-h-80 overflow-y-auto">
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border flex items-center gap-1">
                      <AtSign className="h-3 w-3" /> Usuários
                    </div>
                    {userResults.map(u => (
                      <Link key={u.id} to={`/perfil/${u.id}`} onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-secondary transition-colors">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent overflow-hidden flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
                          {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" /> : (u.display_name?.[0]?.toUpperCase() || '?')}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{u.display_name || 'Usuário'}</p>
                          {u.username && <p className="text-xs text-muted-foreground truncate">@{u.username}</p>}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </form>

            <div className="flex items-center gap-2">
              <NotificationBell />

              <Link to="/carrinho" aria-label={`Carrinho${itemCount > 0 ? ` (${itemCount} ite${itemCount === 1 ? 'm' : 'ns'})` : ''}`} className="relative p-2 rounded-lg hover:bg-secondary transition-colors">
                <ShoppingCart className="h-5 w-5 text-foreground" />
                {itemCount > 0 && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                    {itemCount}
                  </motion.span>
                )}
              </Link>

              {user ? (
                <div className="relative">
                  <button onClick={() => setUserMenuOpen(!userMenuOpen)} aria-label="Menu do usuário" aria-expanded={userMenuOpen}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary transition-colors">
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">{(profile?.display_name || user.email || '?')[0].toUpperCase()}</span>
                    </div>
                    <span className="hidden md:block text-sm text-foreground truncate max-w-[100px]">
                      {profile?.display_name || user.email?.split('@')[0]}
                    </span>
                  </button>
                  <AnimatePresence>
                    {userMenuOpen && (
                      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className="absolute right-0 top-full mt-1 w-52 bg-card border border-border rounded-lg shadow-xl overflow-hidden z-50">
                        <div className="p-3 border-b border-border">
                          <p className="text-sm font-medium text-foreground truncate">{profile?.display_name || 'Usuário'}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                        <div className="py-1">
                          <Link to="/perfil" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors">
                            <User className="h-4 w-4" /> Meu Perfil
                          </Link>
                          <Link to="/biblioteca" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors">
                            <Library className="h-4 w-4" /> Minha Biblioteca
                          </Link>
                          <Link to="/pedidos" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors">
                            <Package className="h-4 w-4" /> Meus Pedidos
                          </Link>
                          <Link to="/favoritos" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors">
                            <Heart className="h-4 w-4" /> Favoritos
                          </Link>
                          <Link to="/conversas-opinioes" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors">
                            <MessageSquare className="h-4 w-4" /> Conversas de Opiniões
                          </Link>
                          <Link to="/tutoriais" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors">
                            <span className="text-base leading-none">🎓</span> Tutoriais
                          </Link>
                        </div>
                        <div className="border-t border-border">
                          <button onClick={handleSignOut}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-secondary transition-colors">
                            <LogOut className="h-4 w-4" /> Sair
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Link to="/auth" aria-label="Entrar" className="p-2 rounded-lg hover:bg-secondary transition-colors">
                  <User className="h-5 w-5 text-foreground" />
                </Link>
              )}

              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={mobileMenuOpen}
                className="lg:hidden p-2 rounded-lg hover:bg-secondary transition-colors">
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="lg:hidden overflow-hidden border-t border-border">
                <form onSubmit={handleSearch} className="py-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Buscar jogos..."
                      className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                </form>
                <nav className="flex flex-col pb-3 gap-1">
                  {navLinks.map(link => (
                    <Link key={link.to} to={link.to} onClick={() => setMobileMenuOpen(false)}
                      className={`nav-item px-4 py-2 rounded-md text-sm font-medium ${
                        location.pathname === link.to || (link.to !== '/' && location.pathname.startsWith(link.to))
                          ? 'nav-item-active' : 'nav-item-idle hover:bg-secondary'}`}>
                      {link.label}
                    </Link>
                  ))}
                </nav>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>
    </>
  );
}