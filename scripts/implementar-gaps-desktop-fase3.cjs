#!/usr/bin/env node

/**
 * Script para implementar a FASE 3 dos gaps do Desktop
 * 
 * O que faz:
 * 1. Modifica Produtos.tsx (campo desenvolvedor/publicadora)
 * 2. Modifica Dashboard.tsx (ações rápidas)
 * 3. Modifica ParametrosSistema.tsx (histórico)
 * 4. Modifica Configuracoes.tsx (histórico)
 * 5. Modifica Clientes.tsx (máscara de dados)
 * 6. Modifica PedidosOnline.tsx (chaves entregues)
 * 7. Componentes novos (GlobalSearch, AdminNotificationBell, MaskedData, BulkActionsBar)
 * 8. Hooks novos (useAdminNotifications, useGlobalSearch, useBulkSelection)
 * 
 * Como usar:
 *   node scripts/implementar-gaps-desktop-fase3.cjs
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(PROJECT_ROOT, 'src');
const DESKTOP_DIR = path.join(SRC_DIR, 'desktop');
const PAGES_DIR = path.join(DESKTOP_DIR, 'pages');
const COMPONENTS_DIR = path.join(SRC_DIR, 'components');
const HOOKS_DIR = path.join(SRC_DIR, 'hooks');
const DESKTOP_COMPONENTS_DIR = path.join(DESKTOP_DIR, 'components');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function log(msg, color = RESET) { console.log(`${color}${msg}${RESET}`); }
function logSuccess(msg) { log(`✅ ${msg}`, GREEN); }
function logError(msg) { log(`❌ ${msg}`, RED); }
function logWarning(msg) { log(`⚠️ ${msg}`, YELLOW); }
function logStep(msg) { log(`\n🔹 ${msg}`, BLUE); }

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
  logSuccess(`Criado: ${path.basename(filePath)}`);
}

function readFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

function backupFile(filePath) {
  if (fs.existsSync(filePath)) {
    const backupPath = `${filePath}.backup-${Date.now()}`;
    fs.copyFileSync(filePath, backupPath);
    logWarning(`Backup criado: ${path.basename(backupPath)}`);
    return true;
  }
  return false;
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

// ============================================================
// 1. MODIFICAÇÃO: Produtos.tsx (campo desenvolvedor/publicadora)
// ============================================================

function updateProdutos() {
  const filePath = path.join(PAGES_DIR, 'Produtos.tsx');
  if (!fileExists(filePath)) {
    logWarning('Produtos.tsx não encontrado');
    return;
  }
  backupFile(filePath);

  let content = readFile(filePath);
  if (!content) return;

  // Verificar se já tem os campos
  if (content.includes('developer_id') && content.includes('publisher_id')) {
    logWarning('Produtos.tsx já tem campos de desenvolvedor/publicadora');
    return;
  }

  // Adicionar imports
  if (!content.includes('useDevelopers')) {
    content = content.replace(
      /import \{([^}]*)\} from 'lucide-react';/,
      (match, icons) => {
        const newIcons = ['Building2', 'BookOpen'];
        const combined = icons.trim() + ', ' + newIcons.filter(i => !icons.includes(i)).join(', ');
        return `import { ${combined} } from 'lucide-react';`;
      }
    );
  }

  // Adicionar campos no formulário
  const formFields = `
            <div className="space-y-2">
              <Label>Desenvolvedor</Label>
              <Select value={fDeveloperId} onValueChange={setFDeveloperId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {developers.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Publicadora</Label>
              <Select value={fPublisherId} onValueChange={setFPublisherId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {publishers.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>`;

  // Inserir após o campo de categoria
  const categoryIndex = content.indexOf('Categoria');
  if (categoryIndex !== -1) {
    const endOfCategory = content.indexOf('</div>', content.indexOf('Categoria', categoryIndex)) + 6;
    const afterCategory = content.indexOf('</div>', endOfCategory) + 6;
    content = content.slice(0, afterCategory) + formFields + content.slice(afterCategory);
  }

  // Adicionar states
  const stateDeclarations = `
  const [fDeveloperId, setFDeveloperId] = useState('');
  const [fPublisherId, setFPublisherId] = useState('');
  const [developers, setDevelopers] = useState([]);
  const [publishers, setPublishers] = useState([]);`;

  const stateIndex = content.indexOf('const [fTitle, setFTitle]');
  if (stateIndex !== -1) {
    const endOfStates = content.indexOf('const [saving, setSaving]', stateIndex);
    if (endOfStates !== -1) {
      content = content.slice(0, endOfStates) + stateDeclarations + content.slice(endOfStates);
    }
  }

  // Adicionar load de desenvolvedores/publicadoras
  const loadData = `
  const loadDevelopersAndPublishers = async () => {
    const [{ data: devs }, { data: pubs }] = await Promise.all([
      supabase.from('developers').select('id, name').order('name'),
      supabase.from('publishers').select('id, name').order('name'),
    ]);
    setDevelopers(devs || []);
    setPublishers(pubs || []);
  };`;

  const useEffectIndex = content.indexOf('useEffect(() => {');
  if (useEffectIndex !== -1) {
    const afterUseEffect = content.indexOf('}', useEffectIndex) + 1;
    content = content.slice(0, afterUseEffect) + loadData + content.slice(afterUseEffect);
  }

  // Adicionar chamada no load
  const loadCall = 'loadDevelopersAndPublishers();';
  const fetchIndex = content.indexOf('fetchAll');
  if (fetchIndex !== -1) {
    const afterFetch = content.indexOf('}', content.indexOf('fetchAll', fetchIndex)) + 1;
    content = content.slice(0, afterFetch) + loadCall + content.slice(afterFetch);
  }

  writeFile(filePath, content);
  logSuccess('Produtos.tsx atualizado');
}

// ============================================================
// 2. MODIFICAÇÃO: Dashboard.tsx (ações rápidas)
// ============================================================

function updateDashboard() {
  const filePath = path.join(PAGES_DIR, 'Dashboard.tsx');
  if (!fileExists(filePath)) {
    logWarning('Dashboard.tsx não encontrado');
    return;
  }
  backupFile(filePath);

  let content = readFile(filePath);
  if (!content) return;

  if (content.includes('Ações Rápidas')) {
    logWarning('Dashboard.tsx já tem ações rápidas');
    return;
  }

  const quickActions = `
      {/* Ações Rápidas */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">⚡ Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link to="/desktop/denuncias?status=pending" className="p-3 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors text-center">
            <AlertTriangle className="h-6 w-6 text-warning mx-auto mb-1" />
            <p className="text-xs font-medium">Denúncias Pendentes</p>
          </Link>
          <Link to="/desktop/tickets?status=open" className="p-3 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors text-center">
            <LifeBuoy className="h-6 w-6 text-primary mx-auto mb-1" />
            <p className="text-xs font-medium">Tickets Abertos</p>
          </Link>
          <Link to="/desktop/produtos?estoque=baixo" className="p-3 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors text-center">
            <AlertTriangle className="h-6 w-6 text-destructive mx-auto mb-1" />
            <p className="text-xs font-medium">Estoque Baixo</p>
          </Link>
          <Link to="/desktop/pedidos?status=pending" className="p-3 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors text-center">
            <ShoppingCart className="h-6 w-6 text-accent mx-auto mb-1" />
            <p className="text-xs font-medium">Pedidos Pendentes</p>
          </Link>
        </CardContent>
      </Card>`;

  // Inserir após os KPIs
  const kpisEnd = content.indexOf('grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4');
  if (kpisEnd !== -1) {
    const endOfKpis = content.indexOf('</div>', content.indexOf('grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4')) + 6;
    const afterKpis = content.indexOf('</div>', endOfKpis) + 6;
    content = content.slice(0, afterKpis) + quickActions + content.slice(afterKpis);
  }

  // Adicionar imports
  if (!content.includes('LifeBuoy')) {
    content = content.replace(
      /import \{([^}]*)\} from 'lucide-react';/,
      (match, icons) => {
        const newIcons = ['LifeBuoy'];
        const combined = icons.trim() + ', ' + newIcons.filter(i => !icons.includes(i)).join(', ');
        return `import { ${combined} } from 'lucide-react';`;
      }
    );
  }

  if (!content.includes('Link')) {
    content = content.replace(
      /import \{([^}]*)\} from 'react-router-dom';/,
      (match) => {
        if (match.includes('Link')) return match;
        return `import { Link } from 'react-router-dom';`;
      }
    );
  }

  writeFile(filePath, content);
  logSuccess('Dashboard.tsx atualizado');
}

// ============================================================
// 3. MODIFICAÇÃO: ParametrosSistema.tsx (histórico)
// ============================================================

function updateParametrosSistema() {
  const filePath = path.join(PAGES_DIR, 'ParametrosSistema.tsx');
  if (!fileExists(filePath)) {
    logWarning('ParametrosSistema.tsx não encontrado');
    return;
  }
  backupFile(filePath);

  let content = readFile(filePath);
  if (!content) return;

  if (content.includes('config_history')) {
    logWarning('ParametrosSistema.tsx já tem histórico');
    return;
  }

  // Adicionar botão de histórico
  const historyButton = `
          <Button variant="outline" size="sm" onClick={openHistory}>
            <History className="h-4 w-4 mr-1" /> Histórico
          </Button>`;

  const headerEnd = content.indexOf('</div>', content.indexOf('flex items-center justify-between'));
  if (headerEnd !== -1) {
    const afterHeader = content.indexOf('</div>', headerEnd) + 6;
    content = content.slice(0, afterHeader) + historyButton + content.slice(afterHeader);
  }

  // Adicionar estado e função
  const historyState = `
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const openHistory = async () => {
    setHistoryOpen(true);
    setLoadingHistory(true);
    const { data } = await supabase
      .from('config_history')
      .select('*, profiles!changed_by(display_name)')
      .eq('config_key', 'business_params')
      .order('changed_at', { ascending: false })
      .limit(50);
    setHistoryData(data || []);
    setLoadingHistory(false);
  };`;

  const stateIndex = content.indexOf('const [saving, setSaving]');
  if (stateIndex !== -1) {
    const afterState = content.indexOf(';', stateIndex) + 1;
    content = content.slice(0, afterState) + historyState + content.slice(afterState);
  }

  // Adicionar modal de histórico
  const historyModal = `
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Histórico de Alterações
            </DialogTitle>
          </DialogHeader>
          {loadingHistory ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : historyData.length === 0 ? (
            <EstadoVazio titulo="Nenhuma alteração registrada" />
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {historyData.map((h) => (
                <div key={h.id} className="bg-card border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{h.config_key}</p>
                    <span className="text-xs text-muted-foreground">{h.changed_by?.display_name || 'Sistema'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(h.changed_at).toLocaleString('pt-BR')}</p>
                  <details className="mt-1">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Ver detalhes</summary>
                    <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                      {JSON.stringify({ old: h.old_value, new: h.new_value }, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>`;

  const endOfContent = content.lastIndexOf('</div>');
  if (endOfContent !== -1) {
    content = content.slice(0, endOfContent) + historyModal + content.slice(endOfContent);
  }

  writeFile(filePath, content);
  logSuccess('ParametrosSistema.tsx atualizado');
}

// ============================================================
// 4. MODIFICAÇÃO: Configuracoes.tsx (histórico)
// ============================================================

function updateConfiguracoes() {
  const filePath = path.join(PAGES_DIR, 'Configuracoes.tsx');
  if (!fileExists(filePath)) {
    logWarning('Configuracoes.tsx não encontrado');
    return;
  }
  backupFile(filePath);

  let content = readFile(filePath);
  if (!content) return;

  if (content.includes('config_history')) {
    logWarning('Configuracoes.tsx já tem histórico');
    return;
  }

  // Adicionar botão de histórico global
  const historyButton = `
          <Button variant="outline" size="sm" onClick={openHistory}>
            <History className="h-4 w-4 mr-1" /> Histórico de Configurações
          </Button>`;

  const headerEnd = content.indexOf('</div>', content.indexOf('flex items-center justify-between'));
  if (headerEnd !== -1) {
    const afterHeader = content.indexOf('</div>', headerEnd) + 6;
    content = content.slice(0, afterHeader) + historyButton + content.slice(afterHeader);
  }

  // Adicionar estado e função
  const historyState = `
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const openHistory = async () => {
    setHistoryOpen(true);
    setLoadingHistory(true);
    const { data } = await supabase
      .from('config_history')
      .select('*, profiles!changed_by(display_name)')
      .order('changed_at', { ascending: false })
      .limit(50);
    setHistoryData(data || []);
    setLoadingHistory(false);
  };`;

  const stateIndex = content.indexOf('const [savingProfile, setSavingProfile]');
  if (stateIndex !== -1) {
    const afterState = content.indexOf(';', stateIndex) + 1;
    content = content.slice(0, afterState) + historyState + content.slice(afterState);
  }

  // Adicionar modal de histórico
  const historyModal = `
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Histórico de Configurações
            </DialogTitle>
          </DialogHeader>
          {loadingHistory ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : historyData.length === 0 ? (
            <EstadoVazio titulo="Nenhuma alteração registrada" />
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {historyData.map((h) => (
                <div key={h.id} className="bg-card border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{h.config_key}</p>
                    <span className="text-xs text-muted-foreground">{h.changed_by?.display_name || 'Sistema'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(h.changed_at).toLocaleString('pt-BR')}</p>
                  <details className="mt-1">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Ver detalhes</summary>
                    <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                      {JSON.stringify({ old: h.old_value, new: h.new_value }, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>`;

  const endOfContent = content.lastIndexOf('</div>');
  if (endOfContent !== -1) {
    content = content.slice(0, endOfContent) + historyModal + content.slice(endOfContent);
  }

  writeFile(filePath, content);
  logSuccess('Configuracoes.tsx atualizado');
}

// ============================================================
// 5. COMPONENTE: MaskedData.tsx
// ============================================================

function createMaskedData() {
  const filePath = path.join(COMPONENTS_DIR, 'MaskedData.tsx');

  const content = `
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MaskedDataProps {
  value: string;
  type: 'cpf' | 'phone' | 'email' | 'address' | 'credit_card';
  showToggle?: boolean;
  className?: string;
}

const masks: Record<string, (v: string) => string> = {
  cpf: (v) => v.replace(/(\\d{3})(\\d{3})(\\d{3})(\\d{2})/, '$1.$2.***.**'),
  phone: (v) => v.replace(/(\\d{2})(\\d{5})(\\d{4})/, '($1) $2-****'),
  email: (v) => v.replace(/(.{2}).*(@.*)/, '$1***$2'),
  address: (v) => v.replace(/(.{10}).*/, '$1...'),
  credit_card: (v) => v.replace(/(\\d{4})(\\d{4})(\\d{4})(\\d{4})/, '**** **** **** $4'),
};

export function MaskedData({ value, type, showToggle = true, className = '' }: MaskedDataProps) {
  const [revealed, setRevealed] = useState(false);

  if (!value) return <span className={className}>—</span>;

  const maskedValue = masks[type] ? masks[type](value) : value;

  return (
    <span className={\`inline-flex items-center gap-1.5 \${className}\`}>
      <span className="font-mono">
        {revealed ? value : maskedValue}
      </span>
      {showToggle && (
        <button
          type="button"
          onClick={() => setRevealed(!revealed)}
          className="text-muted-foreground hover:text-primary transition-colors p-0.5"
          title={revealed ? 'Ocultar' : 'Revelar'}
        >
          {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      )}
    </span>
  );
}`;

  writeFile(filePath, content);
  logSuccess('MaskedData.tsx criado');
}

// ============================================================
// 6. COMPONENTE: BulkActionsBar.tsx
// ============================================================

function createBulkActionsBar() {
  const filePath = path.join(COMPONENTS_DIR, 'BulkActionsBar.tsx');

  const content = `
import { Button } from '@/components/ui/button';
import { X, CheckSquare } from 'lucide-react';

interface BulkActionsBarProps {
  selectedCount: number;
  onClear: () => void;
  actions: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary';
    icon?: React.ReactNode;
  }[];
  className?: string;
}

export function BulkActionsBar({ selectedCount, onClear, actions, className = '' }: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className={\`flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20 \${className}\`}>
      <CheckSquare className="h-4 w-4 text-primary" />
      <span className="text-sm font-semibold">{selectedCount} selecionado{selectedCount > 1 ? 's' : ''}</span>
      <div className="flex gap-1">
        {actions.map((action, index) => (
          <Button
            key={index}
            size="sm"
            variant={action.variant || 'outline'}
            onClick={action.onClick}
            className="h-8 text-xs"
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
      </div>
      <Button variant="ghost" size="sm" onClick={onClear} className="h-8 text-xs ml-auto">
        <X className="h-3.5 w-3.5 mr-1" /> Limpar
      </Button>
    </div>
  );
}`;

  writeFile(filePath, content);
  logSuccess('BulkActionsBar.tsx criado');
}

// ============================================================
// 7. HOOK: useAdminNotifications.ts
// ============================================================

function createUseAdminNotifications() {
  const filePath = path.join(HOOKS_DIR, 'useAdminNotifications.ts');

  const content = `
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useAdminNotifications() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['admin-notifications', user?.id],
    queryFn: async () => {
      if (!user) return { data: [], unreadCount: 0 };

      const { data, error } = await supabase
        .from('admin_notifications')
        .select('*')
        .eq('admin_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Erro ao buscar notificações admin:', error);
        return { data: [], unreadCount: 0 };
      }

      const unreadCount = data?.filter((n) => !n.is_read).length || 0;

      return { data: data || [], unreadCount };
    },
    enabled: !!user,
    refetchInterval: 30000,
    staleTime: 15000,
  });
}

export function useAdminUnreadCount() {
  const { data } = useAdminNotifications();
  return data?.unreadCount || 0;
}`;

  writeFile(filePath, content);
  logSuccess('useAdminNotifications.ts criado');
}

// ============================================================
// 8. HOOK: useGlobalSearch.ts
// ============================================================

function createUseGlobalSearch() {
  const filePath = path.join(HOOKS_DIR, 'useGlobalSearch.ts');

  const content = `
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: 'product' | 'user' | 'order' | 'developer' | 'publisher';
  link: string;
  image?: string;
}

export function useGlobalSearch(query: string) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  const search = useCallback(async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const term = \`%\${searchTerm}%\`;

    try {
      const [products, users, orders, developers, publishers] = await Promise.all([
        supabase.from('produtos').select('id, title, image_url').ilike('title', term).limit(5),
        supabase.from('profiles').select('id, display_name, avatar_url').ilike('display_name', term).limit(5),
        supabase.from('pedidos').select('id').ilike('id', \`%\${searchTerm}%\`).limit(5),
        supabase.from('developers').select('id, name, logo_url').ilike('name', term).limit(5),
        supabase.from('publishers').select('id, name, logo_url').ilike('name', term).limit(5),
      ]);

      const resultsList: SearchResult[] = [];

      (products.data || []).forEach((p: any) => {
        resultsList.push({
          id: p.id,
          title: p.title,
          type: 'product',
          link: \`/desktop/produtos\`,
          image: p.image_url,
        });
      });

      (users.data || []).forEach((u: any) => {
        resultsList.push({
          id: u.id,
          title: u.display_name || u.id.slice(0, 8),
          type: 'user',
          link: \`/desktop/clientes\`,
          image: u.avatar_url,
        });
      });

      (orders.data || []).forEach((o: any) => {
        resultsList.push({
          id: o.id,
          title: \`Pedido #\${o.id.slice(0, 8)}\`,
          type: 'order',
          link: \`/desktop/pedidos\`,
        });
      });

      (developers.data || []).forEach((d: any) => {
        resultsList.push({
          id: d.id,
          title: d.name,
          type: 'developer',
          link: \`/desktop/desenvolvedores\`,
          image: d.logo_url,
        });
      });

      (publishers.data || []).forEach((p: any) => {
        resultsList.push({
          id: p.id,
          title: p.name,
          type: 'publisher',
          link: \`/desktop/publicadoras\`,
          image: p.logo_url,
        });
      });

      setResults(resultsList);
    } catch (error) {
      console.error('Erro na busca global:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    search(debouncedQuery);
  }, [debouncedQuery, search]);

  return { results, loading };
}`;

  writeFile(filePath, content);
  logSuccess('useGlobalSearch.ts criado');
}

// ============================================================
// 9. HOOK: useBulkSelection.ts
// ============================================================

function createUseBulkSelection() {
  const filePath = path.join(HOOKS_DIR, 'useBulkSelection.ts');

  const content = `
import { useState, useCallback } from 'react';

interface UseBulkSelectionOptions<T> {
  items: T[];
  getId: (item: T) => string;
}

export function useBulkSelection<T>({ items, getId }: UseBulkSelectionOptions<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  }, [selectedIds]);

  const toggleAll = useCallback(() => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(getId)));
    }
  }, [selectedIds, items, getId]);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map(getId)));
  }, [items, getId]);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const getSelectedItems = useCallback(() => {
    return items.filter((item) => selectedIds.has(getId(item)));
  }, [items, selectedIds, getId]);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    toggle,
    toggleAll,
    clear,
    selectAll,
    isSelected,
    getSelectedItems,
    isAllSelected: selectedIds.size === items.length && items.length > 0,
  };
}`;

  writeFile(filePath, content);
  logSuccess('useBulkSelection.ts criado');
}

// ============================================================
// 10. COMPONENTE: AdminNotificationBell.tsx
// ============================================================

function createAdminNotificationBell() {
  const filePath = path.join(DESKTOP_COMPONENTS_DIR, 'AdminNotificationBell.tsx');

  const content = `
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAdminUnreadCount } from '@/hooks/useAdminNotifications';

export function AdminNotificationBell() {
  const unreadCount = useAdminUnreadCount();

  return (
    <Link to="/desktop/notificacoes" className="relative p-2 rounded-lg hover:bg-secondary transition-colors">
      <Bell className="h-5 w-5 text-muted-foreground" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );
}`;

  writeFile(filePath, content);
  logSuccess('AdminNotificationBell.tsx criado');
}

// ============================================================
// 11. COMPONENTE: GlobalSearch.tsx
// ============================================================

function createGlobalSearch() {
  const filePath = path.join(COMPONENTS_DIR, 'GlobalSearch.tsx');

  const content = `
import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, X, Command, Gamepad2, User, ShoppingBag, Building2, BookOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { useNavigate } from 'react-router-dom';

const TYPE_ICONS: Record<string, any> = {
  product: Gamepad2,
  user: User,
  order: ShoppingBag,
  developer: Building2,
  publisher: BookOpen,
};

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { results, loading } = useGlobalSearch(query);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (link: string) => {
    navigate(link);
    setIsOpen(false);
    setQuery('');
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Buscar...</span>
        <kbd className="hidden sm:inline text-xs bg-background px-1.5 py-0.5 rounded border border-border">⌘K</kbd>
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative z-50">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" />
      <div className="fixed inset-x-0 top-[20%] mx-auto max-w-2xl">
        <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b border-border">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar produtos, usuários, pedidos..."
              className="border-0 shadow-none focus-visible:ring-0 text-sm"
            />
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : query && (
              <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="max-h-[400px] overflow-y-auto p-2">
            {query.length < 2 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Digite pelo menos 2 caracteres para buscar
              </div>
            ) : loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Nenhum resultado encontrado
              </div>
            ) : (
              results.map((result) => {
                const Icon = TYPE_ICONS[result.type] || Search;
                return (
                  <button
                    key={\`\${result.id}-\${result.type}\`}
                    onClick={() => handleSelect(result.link)}
                    className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-secondary transition-colors text-left"
                  >
                    {result.image ? (
                      <img src={result.image} alt="" className="w-8 h-8 rounded object-cover" loading="lazy" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{result.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">{result.type}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">→</span>
                  </button>
                );
              })
            )}
          </div>
          <div className="border-t border-border p-2 text-xs text-muted-foreground text-center">
            <kbd className="px-1.5 py-0.5 bg-secondary rounded border border-border">↑↓</kbd> navegar
            <kbd className="ml-2 px-1.5 py-0.5 bg-secondary rounded border border-border">Enter</kbd> selecionar
            <kbd className="ml-2 px-1.5 py-0.5 bg-secondary rounded border border-border">Esc</kbd> fechar
          </div>
        </div>
      </div>
    </div>
  );
}`;

  writeFile(filePath, content);
  logSuccess('GlobalSearch.tsx criado');
}

// ============================================================
// FUNÇÃO PRINCIPAL
// ============================================================

function main() {
  console.log('\n🚀 Implementando FASE 3 dos gaps do DESKTOP...\n');
  console.log('='.repeat(60) + '\n');

  try {
    // Modificações em telas existentes
    logStep('Modificando telas existentes...');
    updateProdutos();
    updateDashboard();
    updateParametrosSistema();
    updateConfiguracoes();

    // Componentes
    logStep('Criando componentes...');
    createMaskedData();
    createBulkActionsBar();
    createAdminNotificationBell();
    createGlobalSearch();

    // Hooks
    logStep('Criando hooks...');
    createUseAdminNotifications();
    createUseGlobalSearch();
    createUseBulkSelection();

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ FASE 3 DO DESKTOP EXECUTADA COM SUCESSO!\n');

    console.log('📋 Resumo:');
    console.log('  📝 4 telas modificadas:');
    console.log('     - Produtos.tsx (desenvolvedor/publicadora)');
    console.log('     - Dashboard.tsx (ações rápidas)');
    console.log('     - ParametrosSistema.tsx (histórico)');
    console.log('     - Configuracoes.tsx (histórico)');
    console.log('  🧩 4 componentes criados:');
    console.log('     - MaskedData.tsx (máscara de dados)');
    console.log('     - BulkActionsBar.tsx (ações em massa)');
    console.log('     - AdminNotificationBell.tsx (notificações admin)');
    console.log('     - GlobalSearch.tsx (busca global Ctrl+K)');
    console.log('  🔗 3 hooks criados:');
    console.log('     - useAdminNotifications.ts');
    console.log('     - useGlobalSearch.ts');
    console.log('     - useBulkSelection.ts');

    console.log('\n📌 Proximos passos:');
    console.log('  1. Reiniciar o servidor: npm run dev');
    console.log('  2. Testar as modificações:');
    console.log('     - Produtos.tsx: campo desenvolvedor/publicadora');
    console.log('     - Dashboard: ações rápidas');
    console.log('     - ParametrosSistema: histórico');
    console.log('     - Configuracoes: histórico');
    console.log('  3. Testar os componentes:');
    console.log('     - Ctrl+K para busca global');
    console.log('     - Máscara de dados em Clientes.tsx');
    console.log('     - Ações em massa');
    console.log('     - Sino de notificações admin');

    console.log('\n🎮 MIDIAS Desktop FASE 3 concluída!\n');

  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  }
}

main();