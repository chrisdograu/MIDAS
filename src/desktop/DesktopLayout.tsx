import { Outlet, useLocation, useNavigate, Navigate, Link } from 'react-router-dom';
import {
  LayoutDashboard, Package, Users, UserCog, Truck, Tags,
  Warehouse, ClipboardList, Shield, BarChart3,
  Award, LogOut, Gamepad2, ChevronLeft, ChevronRight, ChevronDown,
  Megaphone, ArrowLeftRight, MessageSquare, Star, Bell, MessageCircle, Gavel,
  Sun, Moon, Settings, Loader2, Ticket, Lightbulb, Trophy, Zap,
  Library, FileText, AlertTriangle, LifeBuoy, Plug, Sparkles, Boxes, Store,
  Search, Command, Wifi, WifiOff,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useDesktopAuth, POSITION_LABELS } from '@/hooks/useDesktopAuth';
import { useDesktopPending, type PendingCounts } from '@/hooks/useDesktopPending';
import { useDesktopRealtimeAlerts } from '@/hooks/useDesktopRealtimeAlerts';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

type PendingKey = keyof PendingCounts;

const activeNavClass = 'nav-item-active nav-item-active-bar';

function splitNavUrl(url: string) {
  const [pathname, query = ''] = url.split('?');
  return { pathname, search: query ? `?${query}` : '' };
}

function isDesktopNavItemActive(
  location: ReturnType<typeof useLocation>,
  url: string,
  isDefaultTab = false,
) {
  const target = splitNavUrl(url);
  if (location.pathname !== target.pathname) return false;
  if (target.search) {
    if (location.search === target.search) return true;
    return isDefaultTab && location.search === '';
  }
  return location.search === '';
}

// Estrutura conforme PROMPT UNIFICADO MIDIAS — Painel Admin Desktop
const navSections: {
  label: string;
  items: { title: string; url: string; icon: typeof LayoutDashboard; route: string; pendingKey?: PendingKey; defaultTab?: boolean }[];
}[] = [
  {
    label: 'Geral',
    items: [
      { title: 'Dashboard', url: '/desktop', icon: LayoutDashboard, route: '' },
    ],
  },
  {
    label: 'Cadastros',
    items: [
      { title: 'Produtos', url: '/desktop/produtos', icon: Package, route: 'produtos' },
      { title: 'Funcionários', url: '/desktop/funcionarios', icon: UserCog, route: 'funcionarios' },
      { title: 'Clientes', url: '/desktop/clientes', icon: Users, route: 'clientes' },
      { title: 'Fornecedores', url: '/desktop/fornecedores', icon: Truck, route: 'fornecedores' },
      { title: 'Categorias', url: '/desktop/categorias', icon: Tags, route: 'categorias' },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { title: 'Cupons', url: '/desktop/cupons', icon: Ticket, route: 'cupons' },
      { title: 'Promoções', url: '/desktop/promocoes', icon: Zap, route: 'promocoes' },
      { title: 'Bundles', url: '/desktop/bundles', icon: Boxes, route: 'bundles' },
    ],
  },
  {
    label: 'Jogos',
    items: [
      { title: 'Jogos', url: '/desktop/jogos', icon: Gamepad2, route: 'jogos' },
      { title: 'Solicitações', url: '/desktop/sugestoes', icon: Lightbulb, route: 'sugestoes', pendingKey: 'sugestoes' },
      { title: 'Criar Jogo', url: '/desktop/jogos/novo', icon: Sparkles, route: 'jogos' },
      { title: 'Catálogo de Tags', url: '/desktop/jogos/catalogo-tags', icon: Gamepad2, route: 'jogos' },
      { title: 'Avaliações de Jogos', url: '/desktop/avaliacoes-jogos', icon: Star, route: 'avaliacoes-jogos' },
    ],
  },
  {
    label: 'Marketplace',
    items: [
      { title: 'Anúncios', url: '/desktop/anuncios', icon: Megaphone, route: 'anuncios' },
      { title: 'Vendedores', url: '/desktop/vendedores', icon: Store, route: 'vendedores' },
      { title: 'Trocas', url: '/desktop/propostas', icon: ArrowLeftRight, route: 'propostas', pendingKey: 'propostas' },
      { title: 'Trocas Arquivadas', url: '/desktop/trocas-arquivadas', icon: Library, route: 'trocas-arquivadas' },
      { title: 'Avaliações entre Usuários', url: '/desktop/avaliacoes-usuario', icon: Star, route: 'avaliacoes-usuario' },
    ],
  },
  {
    label: 'Biblioteca Social',
    items: [
      { title: 'Biblioteca Social', url: '/desktop/biblioteca-social', icon: Library, route: 'biblioteca-social' },
    ],
  },
  {
    label: 'Torneios',
    items: [
      { title: 'Eventos', url: '/desktop/torneios/eventos', icon: Trophy, route: 'torneios' },
      { title: 'Disputas de Partida', url: '/desktop/disputas-partidas', icon: Gavel, route: 'disputas-partidas' },
      { title: 'Atuais', url: '/desktop/torneios', icon: Trophy, route: 'torneios' },
      { title: 'Criar Torneio', url: '/desktop/torneios/novo', icon: Sparkles, route: 'torneios' },
    ],
  },
  {
    label: 'Moderação',
    items: [
      { title: 'Moderação', url: '/desktop/moderacao', icon: Shield, route: 'moderacao' },
      { title: 'Denúncias', url: '/desktop/denuncias', icon: AlertTriangle, route: 'denuncias', pendingKey: 'denuncias' },
      { title: 'Grupos', url: '/desktop/grupos', icon: Users, route: 'moderacao' },
      { title: 'ECA · Responsáveis', url: '/desktop/eca/responsaveis', icon: Shield, route: 'eca' },
      { title: 'ECA · Alertas de Chat', url: '/desktop/eca/chat-alerts', icon: AlertTriangle, route: 'eca' },
    ],
  },
  {
    label: 'Suporte',
    items: [
      { title: 'Tickets Mobile', url: '/desktop/tickets/mobile', icon: LifeBuoy, route: 'tickets' },
      { title: 'Tickets Web', url: '/desktop/tickets/web', icon: LifeBuoy, route: 'tickets' },
    ],
  },
  {
    label: 'Comunicação',
    items: [
      { title: 'Notificações', url: '/desktop/notificacoes', icon: Bell, route: 'notificacoes' },
      { title: 'Notificações Especiais', url: '/desktop/notificacoes/especiais', icon: Megaphone, route: 'notificacoes' },
      { title: 'Mensagens', url: '/desktop/mensagens', icon: MessageSquare, route: 'mensagens' },
      { title: 'Fórum', url: '/desktop/forum', icon: MessageCircle, route: 'forum' },
    ],
  },
  {
    label: 'Análises e Auditoria',
    items: [
      { title: 'Analytics', url: '/desktop/analytics', icon: BarChart3, route: 'analytics' },
      { title: 'Métricas da Plataforma', url: '/desktop/metricas', icon: BarChart3, route: 'analytics' },
      { title: 'Relatórios', url: '/desktop/relatorios', icon: FileText, route: 'relatorios' },
      { title: 'Logs Administrativos', url: '/desktop/logs', icon: Shield, route: 'logs' },
    ],
  },
  {
    label: 'XP e Recompensas',
    items: [
      { title: 'XP Mobile', url: '/desktop/xp/mobile', icon: Zap, route: 'xp' },
      { title: 'XP Web', url: '/desktop/xp/web', icon: Zap, route: 'xp' },
      { title: 'Badges', url: '/desktop/badges', icon: Trophy, route: 'badges' },
      { title: 'Títulos', url: '/desktop/titulos', icon: Award, route: 'badges' },
      { title: 'Recompensas', url: '/desktop/recompensas', icon: Sparkles, route: 'badges' },
      { title: 'Recompensas por Jogo', url: '/desktop/recompensas/jogos', icon: Gamepad2, route: 'badges' },
    ],
  },
  {
    label: 'Certificados',
    items: [
      { title: 'Solicitações', url: '/desktop/certificados?tab=pendentes', icon: Award, route: 'certificados', pendingKey: 'certificados', defaultTab: true },
      { title: 'Ativos', url: '/desktop/certificados?tab=ativos', icon: Award, route: 'certificados' },
      { title: 'Todos', url: '/desktop/certificados?tab=todos', icon: Award, route: 'certificados' },
    ],
  },
  {
    label: 'Operacional',
    items: [
      { title: 'Estoque', url: '/desktop/estoque', icon: Warehouse, route: 'estoque' },
      { title: 'Pedidos Online', url: '/desktop/pedidos', icon: ClipboardList, route: 'pedidos', pendingKey: 'pedidos' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { title: 'Integrações', url: '/desktop/integracoes', icon: Plug, route: 'integracoes' },
      { title: 'Configurações', url: '/desktop/configuracoes', icon: Settings, route: 'configuracoes' },
      { title: 'Parâmetros do sistema', url: '/desktop/parametros', icon: Settings, route: 'parametros' },
    ],
  },
];

// GAP-D363: Mapeamento para busca rápida
const searchableItems = navSections.flatMap(section => 
  section.items.map(item => ({
    ...item,
    section: section.label,
    keywords: item.title.toLowerCase().split(' '),
  }))
);

export default function DesktopLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [closedSections, setClosedSections] = useState<string[]>([]);
  const [commandOpen, setCommandOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const toggleSection = (label: string) =>
    setClosedSections((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));
  const { theme, toggleTheme } = useTheme();
  const { user, profile, position, isStaff, loading, signOut, canAccess } = useDesktopAuth();
  const pending = useDesktopPending(!!user && isStaff);
  useDesktopRealtimeAlerts(!!user && isStaff);
  const location = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // GAP-D364: Monitorar conectividade
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // GAP-D361: Atalhos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K ou Cmd+K para abrir busca
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen(true);
      }
      // Esc para fechar
      if (e.key === 'Escape' && commandOpen) {
        setCommandOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandOpen]);

  // GAP-D362: Breadcrumb
  const getBreadcrumb = () => {
    const path = location.pathname;
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return [{ label: 'Dashboard', path: '/desktop' }];
    
    const items = [{ label: 'Dashboard', path: '/desktop' }];
    let currentPath = '/desktop';
    for (let i = 1; i < segments.length; i++) {
      currentPath += '/' + segments[i];
      // Encontrar o título do item
      let label = segments[i].charAt(0).toUpperCase() + segments[i].slice(1);
      for (const section of navSections) {
        for (const item of section.items) {
          if (item.url === currentPath || item.url.startsWith(currentPath + '?')) {
            label = item.title;
            break;
          }
        }
      }
      items.push({ label, path: currentPath });
    }
    return items;
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isStaff) {
    return <Navigate to="/desktop/login" replace />;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/desktop/login');
  };

  const displayName = profile?.display_name || user.email?.split('@')[0] || 'Usuário';
  const positionLabel = position ? POSITION_LABELS[position] : 'Funcionário';

  // Filter sections based on permissions
  const filteredSections = navSections.map(section => ({
    ...section,
    items: section.items.filter(item => canAccess(item.route || item.url)),
  })).filter(section => section.items.length > 0);

  // GAP-D363: Comando de busca
  const handleCommandSelect = (url: string) => {
    setCommandOpen(false);
    navigate(url);
  };

  const breadcrumbItems = getBreadcrumb();

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* GAP-D364: Indicador de conectividade */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 z-50">
        {!isOnline && (
          <div className="flex items-center gap-2 px-4 py-1.5 bg-destructive/90 text-destructive-foreground text-xs rounded-b-lg shadow-lg">
            <WifiOff className="h-3.5 w-3.5" />
            <span>Sem conexão com a internet — alterações podem não ser salvas</span>
          </div>
        )}
      </div>

      <aside
        className={cn(
          'flex flex-col border-r border-border bg-sidebar transition-all duration-300',
          collapsed ? 'w-[68px]' : 'w-[250px]'
        )}
      >
        <div className="flex items-center gap-2 px-4 h-16 border-b border-border shrink-0">
          <Gamepad2 className="h-7 w-7 text-primary shrink-0" />
          {!collapsed && (
            <span className="font-bold text-lg tracking-tight">
              <span className="text-primary">MIDIAS</span>
              <span className="text-accent ml-1 text-sm font-medium">Backoffice</span>
            </span>
          )}
        </div>

        {/* GAP-D363: Busca rápida */}
        {!collapsed && (
          <div className="px-3 py-2">
            <button
              onClick={() => setCommandOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-muted/30 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="flex-1 text-left">Buscar telas...</span>
              <kbd className="text-[10px] px-1.5 py-0.5 bg-muted rounded border border-border font-mono">
                ⌘K
              </kbd>
            </button>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-3 scrollbar-thin">
          {filteredSections.map((section) => {
            const hasActive = section.items.some((i) => isDesktopNavItemActive(location, i.url, i.defaultTab));
            const open = collapsed || !closedSections.includes(section.label) || hasActive;
            return (
            <div key={section.label}>
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => toggleSection(section.label)}
                  className="w-full flex items-center gap-1 px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground focus-ring rounded"
                  aria-expanded={open}
                >
                  <ChevronDown className={cn('h-3 w-3 transition-transform', !open && '-rotate-90')} />
                  <span className="flex-1 text-left">{section.label}</span>
                </button>
              )}
              {open && (
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const count = item.pendingKey ? pending[item.pendingKey] : 0;
                  const showBadge = count > 0;
                  const active = isDesktopNavItemActive(location, item.url, item.defaultTab);
                  const link = (
                    <Link
                      key={item.title}
                      to={item.url}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-ring',
                        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        collapsed && 'justify-center px-2',
                        active && activeNavClass,
                      )}
                    >
                      <span className="relative shrink-0">
                        <item.icon className="h-4.5 w-4.5" />
                        {showBadge && collapsed && (
                          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center leading-none">
                            {count > 99 ? '99+' : count}
                          </span>
                        )}
                      </span>
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{item.title}</span>
                          {showBadge && (
                            <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-[10px] font-bold">
                              {count > 99 ? '99+' : count}
                            </Badge>
                          )}
                        </>
                      )}
                    </Link>
                  );

                  if (collapsed) {
                    return (
                      <Tooltip key={item.title} delayDuration={0}>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right" className="font-medium">
                          {item.title}{showBadge && <span className="ml-1 text-destructive">({count})</span>}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return link;
                })}
              </div>
              )}
            </div>
            );
          })}
        </nav>

        <div className="border-t border-border p-2 shrink-0 space-y-1">
          {!collapsed && (
            <div className="px-3 py-2 mb-1">
              <p className="text-xs font-semibold text-foreground">{displayName}</p>
              <p className="text-[10px] text-muted-foreground">{positionLabel}</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={cn('w-full text-muted-foreground', collapsed ? 'justify-center' : 'justify-start')}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
            {!collapsed && (theme === 'dark' ? 'Modo Claro' : 'Modo Escuro')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn('w-full text-muted-foreground hover:text-destructive', collapsed ? 'justify-center' : 'justify-start')}
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            {!collapsed && 'Sair'}
          </Button>
          <Separator className="my-1" />
          <Button
            variant="ghost"
            size="icon"
            className="w-full h-8"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {/* GAP-D362: Breadcrumb */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-2">
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbItems.map((item, index) => (
                <BreadcrumbItem key={item.path}>
                  {index === breadcrumbItems.length - 1 ? (
                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                  ) : (
                    <>
                      <BreadcrumbLink onClick={() => navigate(item.path)} className="cursor-pointer">
                        {item.label}
                      </BreadcrumbLink>
                      <BreadcrumbSeparator />
                    </>
                  )}
                </BreadcrumbItem>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {canAccess(location.pathname) ? (
          <Outlet />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <Shield className="h-10 w-10 text-destructive" />
            <h1 className="text-xl font-bold">Acesso restrito</h1>
            <p className="max-w-md text-sm text-muted-foreground">
              O cargo <strong>{positionLabel}</strong> não tem permissão para esta tela.
              Fale com um Administrador se precisar desse acesso.
            </p>
            <Button variant="outline" size="sm" onClick={() => navigate('/desktop')}>
              Voltar ao Dashboard
            </Button>
          </div>
        )}
      </main>

      {/* GAP-D363: Command Dialog */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Buscar tela..." />
        <CommandList>
          <CommandEmpty>Nenhuma tela encontrada.</CommandEmpty>
          {filteredSections.map((section) => (
            <CommandGroup key={section.label} heading={section.label}>
              {section.items.map((item) => (
                <CommandItem
                  key={item.url}
                  onSelect={() => handleCommandSelect(item.url)}
                  className="flex items-center gap-2"
                >
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  <span>{item.title}</span>
                  {item.pendingKey && pending[item.pendingKey] > 0 && (
                    <Badge variant="destructive" className="ml-auto text-[10px]">
                      {pending[item.pendingKey]}
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </div>
  );
}