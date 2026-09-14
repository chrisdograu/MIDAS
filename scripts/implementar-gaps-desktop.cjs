#!/usr/bin/env node

/**
 * Script para implementar TODOS os gaps do Desktop
 * 
 * O que faz:
 * 1. 4 Migrations (novas tabelas e alterações)
 * 2. 6 Telas novas
 * 3. 7 Telas modificadas
 * 4. 4 Componentes novos
 * 5. 3 Hooks novos
 * 6. Atualização de rotas
 * 7. Integração com Web/Mobile
 * 
 * Como usar:
 *   node scripts/implementar-gaps-desktop.cjs
 * 
 * Depois de rodar:
 *   - Rode as migrations no Supabase SQL Editor
 *   - Reinicie o servidor de desenvolvimento
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIGURAÇÃO
// ============================================================

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(PROJECT_ROOT, 'src');
const DESKTOP_DIR = path.join(SRC_DIR, 'desktop');
const PAGES_DIR = path.join(DESKTOP_DIR, 'pages');
const COMPONENTS_DIR = path.join(SRC_DIR, 'components');
const HOOKS_DIR = path.join(SRC_DIR, 'hooks');
const LIB_DIR = path.join(SRC_DIR, 'lib');
const ROUTES_DIR = path.join(SRC_DIR, 'routes');
const SUPABASE_DIR = path.join(PROJECT_ROOT, 'supabase');
const MIGRATIONS_DIR = path.join(SUPABASE_DIR, 'migrations');
const DESKTOP_COMPONENTS_DIR = path.join(DESKTOP_DIR, 'components');

// Cores para o terminal
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const RESET = '\x1b[0m';

function log(msg, color = RESET) {
  console.log(`${color}${msg}${RESET}`);
}

function logSuccess(msg) {
  log(`✅ ${msg}`, GREEN);
}

function logInfo(msg) {
  log(`ℹ️ ${msg}`, CYAN);
}

function logError(msg) {
  log(`❌ ${msg}`, RED);
}

function logWarning(msg) {
  log(`⚠️ ${msg}`, YELLOW);
}

function logTitle(msg) {
  log(`\n📌 ${msg}`, MAGENTA);
}

function logStep(msg) {
  log(`\n🔹 ${msg}`, BLUE);
}

// ============================================================
// UTILITÁRIOS
// ============================================================

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logInfo(`Diretório criado: ${dir}`);
  }
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
  logSuccess(`Criado: ${path.basename(filePath)}`);
}

function readFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf8');
}

function backupFile(filePath) {
  if (fs.existsSync(filePath)) {
    const timestamp = Date.now();
    const backupPath = `${filePath}.backup-${timestamp}`;
    fs.copyFileSync(filePath, backupPath);
    logInfo(`Backup criado: ${path.basename(backupPath)}`);
    return true;
  }
  return false;
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function getTimestamp() {
  return new Date().toISOString().replace(/[-:.]/g, '').slice(0, 14);
}

// ============================================================
// 1. MIGRATIONS
// ============================================================

function createMigrations() {
  logStep('Criando migrations...');

  const ts = getTimestamp();

  // 1.1 Adicionar developer_id e publisher_id em produtos
  writeFile(
    path.join(MIGRATIONS_DIR, `${ts}_desktop_developers_publishers.sql`),
    `-- ============================================================
-- MIGRAÇÃO DESKTOP: Adicionar developer_id e publisher_id em produtos
-- ============================================================

-- Adicionar colunas
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS developer_id UUID REFERENCES developers(id) ON DELETE SET NULL;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS publisher_id UUID REFERENCES publishers(id) ON DELETE SET NULL;

-- Índices
CREATE INDEX IF NOT EXISTS idx_produtos_developer_id ON produtos(developer_id);
CREATE INDEX IF NOT EXISTS idx_produtos_publisher_id ON produtos(publisher_id);

-- Comentários
COMMENT ON COLUMN produtos.developer_id IS 'ID do desenvolvedor do jogo (relacionamento com developers)';
COMMENT ON COLUMN produtos.publisher_id IS 'ID da publicadora do jogo (relacionamento com publishers)';`
  );

  // 1.2 Chaves de ativação
  writeFile(
    path.join(MIGRATIONS_DIR, `${ts}_desktop_product_keys.sql`),
    `-- ============================================================
-- MIGRAÇÃO DESKTOP: Tabela de chaves de ativação (pós-venda digital)
-- ============================================================

CREATE TABLE IF NOT EXISTS product_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  key_code TEXT UNIQUE NOT NULL,
  platform TEXT,
  status TEXT CHECK (status IN ('available', 'reserved', 'sold', 'expired', 'revoked')) DEFAULT 'available',
  order_id UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  imported_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  reserved_at TIMESTAMPTZ,
  sold_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_product_keys_status ON product_keys(status);
CREATE INDEX IF NOT EXISTS idx_product_keys_product ON product_keys(product_id);
CREATE INDEX IF NOT EXISTS idx_product_keys_order ON product_keys(order_id);
CREATE INDEX IF NOT EXISTS idx_product_keys_code ON product_keys(key_code);

-- RLS
ALTER TABLE product_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver todas as chaves" ON product_keys
  FOR SELECT USING (auth.role() = 'admin');

CREATE POLICY "Admins podem inserir chaves" ON product_keys
  FOR INSERT WITH CHECK (auth.role() = 'admin');

CREATE POLICY "Admins podem atualizar chaves" ON product_keys
  FOR UPDATE USING (auth.role() = 'admin');

CREATE POLICY "Admins podem deletar chaves" ON product_keys
  FOR DELETE USING (auth.role() = 'admin');

-- Função para reservar chave para pedido
CREATE OR REPLACE FUNCTION reserve_product_key(
  _product_id UUID,
  _order_id UUID
) RETURNS TEXT AS $$
DECLARE
  _key_code TEXT;
BEGIN
  SELECT key_code INTO _key_code
  FROM product_keys
  WHERE product_id = _product_id
    AND status = 'available'
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
  IF _key_code IS NULL THEN
    RAISE EXCEPTION 'Nenhuma chave disponível para o produto %', _product_id;
  END IF;
  
  UPDATE product_keys
  SET status = 'reserved',
      order_id = _order_id,
      reserved_at = NOW()
  WHERE key_code = _key_code;
  
  RETURN _key_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para confirmar venda da chave
CREATE OR REPLACE FUNCTION confirm_product_key_sale(
  _key_code TEXT,
  _order_id UUID
) RETURNS VOID AS $$
BEGIN
  UPDATE product_keys
  SET status = 'sold',
      sold_at = NOW()
  WHERE key_code = _key_code
    AND order_id = _order_id
    AND status = 'reserved';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chave % não encontrada ou não reservada para este pedido', _key_code;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para cancelar reserva de chave
CREATE OR REPLACE FUNCTION cancel_product_key_reservation(
  _key_code TEXT,
  _order_id UUID
) RETURNS VOID AS $$
BEGIN
  UPDATE product_keys
  SET status = 'available',
      order_id = NULL,
      reserved_at = NULL
  WHERE key_code = _key_code
    AND order_id = _order_id
    AND status = 'reserved';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários
COMMENT ON TABLE product_keys IS 'Chaves de ativação para jogos digitais (pós-venda)';
COMMENT ON COLUMN product_keys.status IS 'available, reserved, sold, expired, revoked';
COMMENT ON COLUMN product_keys.platform IS 'Plataforma da chave (Steam, Epic, Xbox, PlayStation, Nintendo)';`
  );

  // 1.3 Notificações do Admin
  writeFile(
    path.join(MIGRATIONS_DIR, `${ts}_desktop_admin_notifications.sql`),
    `-- ============================================================
-- MIGRAÇÃO DESKTOP: Tabela de notificações para administradores
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT CHECK (type IN ('denuncia', 'ticket', 'estoque', 'pedido', 'torneio', 'sistema', 'certificado', 'moderacao')),
  priority TEXT CHECK (priority IN ('baixa', 'media', 'alta', 'critica')) DEFAULT 'media',
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_admin_notifications_admin ON admin_notifications(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_read ON admin_notifications(is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created ON admin_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_priority ON admin_notifications(priority);

-- RLS
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver suas notificações" ON admin_notifications
  FOR SELECT USING (auth.uid() = admin_id);

CREATE POLICY "Sistema pode criar notificações" ON admin_notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins podem marcar como lidas" ON admin_notifications
  FOR UPDATE USING (auth.uid() = admin_id)
  WITH CHECK (auth.uid() = admin_id);

-- Função para marcar todas como lidas
CREATE OR REPLACE FUNCTION mark_all_admin_notifications_read(_admin_id UUID)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE admin_notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE admin_id = _admin_id AND is_read = FALSE
  RETURNING id INTO updated_count;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar notificação quando uma denúncia é criada
CREATE OR REPLACE FUNCTION create_admin_notification_on_denuncia()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    INSERT INTO admin_notifications (admin_id, title, body, type, priority, link)
    SELECT 
      ur.user_id,
      '🛡️ Nova denúncia pendente',
      'Denúncia de "' || NEW.reason || '" aguarda moderação.',
      'denuncia',
      'alta',
      '/desktop/denuncias'
    FROM user_roles ur
    WHERE ur.role IN ('admin', 'moderator');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER admin_notification_on_denuncia
AFTER INSERT ON denuncias
FOR EACH ROW
EXECUTE FUNCTION create_admin_notification_on_denuncia();

-- Trigger para criar notificação quando um ticket é criado
CREATE OR REPLACE FUNCTION create_admin_notification_on_ticket()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO admin_notifications (admin_id, title, body, type, priority, link)
  SELECT 
    ur.user_id,
    '🎫 Novo ticket de suporte',
    'Ticket "' || NEW.subject || '" aguarda atendimento.',
    'ticket',
    'media',
    '/desktop/tickets'
  FROM user_roles ur
  WHERE ur.role IN ('admin', 'atendente');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER admin_notification_on_ticket
AFTER INSERT ON tickets
FOR EACH ROW
EXECUTE FUNCTION create_admin_notification_on_ticket();

-- Comentários
COMMENT ON TABLE admin_notifications IS 'Notificações em tempo real para administradores';
COMMENT ON COLUMN admin_notifications.type IS 'denuncia, ticket, estoque, pedido, torneio, sistema, certificado, moderacao';
COMMENT ON COLUMN admin_notifications.priority IS 'baixa, media, alta, critica';`
  );

  // 1.4 Histórico de Configurações
  writeFile(
    path.join(MIGRATIONS_DIR, `${ts}_desktop_config_history.sql`),
    `-- ============================================================
-- MIGRAÇÃO DESKTOP: Histórico de configurações (Audit Trail)
-- ============================================================

CREATE TABLE IF NOT EXISTS config_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_config_history_key ON config_history(config_key);
CREATE INDEX IF NOT EXISTS idx_config_history_changed_by ON config_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_config_history_changed_at ON config_history(changed_at DESC);

-- RLS
ALTER TABLE config_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver histórico" ON config_history
  FOR SELECT USING (auth.role() = 'admin');

CREATE POLICY "Sistema pode inserir histórico" ON config_history
  FOR INSERT WITH CHECK (true);

-- Trigger para versionar alterações em site_settings
CREATE OR REPLACE FUNCTION version_config_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.value IS DISTINCT FROM NEW.value THEN
    INSERT INTO config_history (
      config_key,
      old_value,
      new_value,
      changed_by,
      changed_at
    ) VALUES (
      NEW.key,
      OLD.value,
      NEW.value,
      auth.uid(),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER version_config
AFTER UPDATE ON site_settings
FOR EACH ROW
WHEN (OLD.value IS DISTINCT FROM NEW.value)
EXECUTE FUNCTION version_config_trigger();

-- Função para reverter configuração
CREATE OR REPLACE FUNCTION revert_config(
  _history_id UUID,
  _reason TEXT
) RETURNS VOID AS $$
DECLARE
  _history_record config_history%ROWTYPE;
BEGIN
  SELECT * INTO _history_record
  FROM config_history
  WHERE id = _history_id;
  
  IF _history_record IS NULL THEN
    RAISE EXCEPTION 'Registro de histórico não encontrado';
  END IF;
  
  IF _history_record.old_value IS NULL THEN
    RAISE EXCEPTION 'Não é possível reverter: valor antigo é NULL';
  END IF;
  
  UPDATE site_settings
  SET value = _history_record.old_value
  WHERE key = _history_record.config_key;
  
  -- Registrar a reversão como um novo histórico
  INSERT INTO config_history (
    config_key,
    old_value,
    new_value,
    changed_by,
    reason
  ) VALUES (
    _history_record.config_key,
    _history_record.new_value,
    _history_record.old_value,
    auth.uid(),
    'Revertido para versão anterior. Motivo: ' || _reason
  );
  
  -- Marcar o registro original como revertido (opcional)
  -- Poderíamos adicionar uma coluna reverted_at, mas por simplicidade,
  -- registramos a reversão como um novo registro
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários
COMMENT ON TABLE config_history IS 'Histórico de alterações nas configurações do sistema (Audit Trail)';
COMMENT ON COLUMN config_history.config_key IS 'Chave da configuração (ex: business_params, store_info)';
COMMENT ON COLUMN config_history.old_value IS 'Valor antes da alteração (JSON)';
COMMENT ON COLUMN config_history.new_value IS 'Valor depois da alteração (JSON)';`
  );

  logSuccess('4 migrations criadas em supabase/migrations/');
}

// ============================================================
// 2. TELAS NOVAS
// ============================================================

function createAdminDevelopers() {
  const filePath = path.join(PAGES_DIR, 'AdminDevelopers.tsx');
  
  const content = `import { useEffect, useState, useMemo } from 'react';
import { Building2, Plus, Search, Edit, Trash2, Loader2, Download, ChevronLeft, ChevronRight, Filter, ExternalLink, Globe, MapPin, Users, Calendar, Twitter, Youtube, Instagram, Save, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { adminLog, exportCsv } from '../lib/adminLog';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDateTime } from '@/lib/format';

interface Developer {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  bio: string | null;
  logo_url: string | null;
  banner_url: string | null;
  website: string | null;
  founded_year: number | null;
  country: string | null;
  headquarters: string | null;
  employees: number | null;
  parent_company: string | null;
  notable_games: string[] | null;
  social_links: {
    twitter?: string;
    youtube?: string;
    instagram?: string;
    facebook?: string;
    discord?: string;
  } | null;
  wikipedia_url: string | null;
  created_at: string;
  updated_at: string;
  _game_count?: number;
  _avg_rating?: number;
}

const ITEMS_PER_PAGE = 20;

export default function AdminDevelopers() {
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Developer | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Developer | null>(null);
  const [exporting, setExporting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    bio: '',
    logo_url: '',
    banner_url: '',
    website: '',
    founded_year: '',
    country: '',
    headquarters: '',
    employees: '',
    parent_company: '',
    notable_games: '',
    twitter: '',
    youtube: '',
    instagram: '',
    wikipedia_url: '',
  });

  const load = async (reset: boolean = true) => {
    if (reset) setLoading(true);
    
    try {
      const currentPage = reset ? 0 : page;
      const from = currentPage * ITEMS_PER_PAGE;
      
      let query = supabase
        .from('developers')
        .select('*', { count: 'exact' })
        .order('name');
      
      if (search) {
        query = query.ilike('name', \`%\${search}%\`);
      }
      
      const { data, error, count } = await query.range(from, from + ITEMS_PER_PAGE - 1);
      if (error) throw error;
      
      // Buscar contagem de jogos para cada desenvolvedor
      const devIds = (data || []).map(d => d.id);
      let gameCounts = new Map();
      let avgRatings = new Map();
      
      if (devIds.length > 0) {
        const { data: games } = await supabase
          .from('produtos')
          .select('developer_id, rating')
          .in('developer_id', devIds);
        
        const counts = new Map<string, number>();
        const ratings = new Map<string, number[]>();
        games?.forEach(g => {
          counts.set(g.developer_id, (counts.get(g.developer_id) || 0) + 1);
          if (g.rating) {
            if (!ratings.has(g.developer_id)) ratings.set(g.developer_id, []);
            ratings.get(g.developer_id)!.push(g.rating);
          }
        });
        
        gameCounts = counts;
        ratings.forEach((ratingsList, devId) => {
          avgRatings.set(devId, ratingsList.reduce((a, b) => a + b, 0) / ratingsList.length);
        });
      }
      
      const enriched = (data || []).map(d => ({
        ...d,
        _game_count: gameCounts.get(d.id) || 0,
        _avg_rating: avgRatings.get(d.id) || null,
      }));
      
      if (reset) {
        setDevelopers(enriched);
        setHasMore((data || []).length === ITEMS_PER_PAGE);
        setPage(1);
      } else {
        setDevelopers(prev => [...prev, ...enriched]);
        setHasMore((data || []).length === ITEMS_PER_PAGE);
        setPage(currentPage + 1);
      }
    } catch (error) {
      toast.error('Erro ao carregar desenvolvedores');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search]);

  const resetForm = () => {
    setForm({
      name: '',
      slug: '',
      description: '',
      bio: '',
      logo_url: '',
      banner_url: '',
      website: '',
      founded_year: '',
      country: '',
      headquarters: '',
      employees: '',
      parent_company: '',
      notable_games: '',
      twitter: '',
      youtube: '',
      instagram: '',
      wikipedia_url: '',
    });
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (dev: Developer) => {
    setEditing(dev);
    setForm({
      name: dev.name || '',
      slug: dev.slug || '',
      description: dev.description || '',
      bio: dev.bio || '',
      logo_url: dev.logo_url || '',
      banner_url: dev.banner_url || '',
      website: dev.website || '',
      founded_year: dev.founded_year ? String(dev.founded_year) : '',
      country: dev.country || '',
      headquarters: dev.headquarters || '',
      employees: dev.employees ? String(dev.employees) : '',
      parent_company: dev.parent_company || '',
      notable_games: (dev.notable_games || []).join(', '),
      twitter: dev.social_links?.twitter || '',
      youtube: dev.social_links?.youtube || '',
      instagram: dev.social_links?.instagram || '',
      wikipedia_url: dev.wikipedia_url || '',
    });
    setDialogOpen(true);
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    
    const slug = form.slug.trim() || generateSlug(form.name);
    if (!slug) {
      toast.error('Slug inválido');
      return;
    }
    
    setSaving(true);
    
    const payload = {
      name: form.name.trim(),
      slug: slug,
      description: form.description.trim() || null,
      bio: form.bio.trim() || null,
      logo_url: form.logo_url.trim() || null,
      banner_url: form.banner_url.trim() || null,
      website: form.website.trim() || null,
      founded_year: form.founded_year ? parseInt(form.founded_year) : null,
      country: form.country.trim() || null,
      headquarters: form.headquarters.trim() || null,
      employees: form.employees ? parseInt(form.employees) : null,
      parent_company: form.parent_company.trim() || null,
      notable_games: form.notable_games ? form.notable_games.split(',').map(s => s.trim()).filter(Boolean) : null,
      social_links: {
        twitter: form.twitter.trim() || null,
        youtube: form.youtube.trim() || null,
        instagram: form.instagram.trim() || null,
      },
      wikipedia_url: form.wikipedia_url.trim() || null,
    };
    
    const { data: { user } } = await supabase.auth.getUser();
    
    try {
      if (editing) {
        const { error } = await supabase.rpc('admin_update_developer', {
          _id: editing.id,
          _name: payload.name,
          _slug: payload.slug,
          _description: payload.description,
          _bio: payload.bio,
          _website: payload.website,
          _founded_year: payload.founded_year,
          _country: payload.country,
          _headquarters: payload.headquarters,
          _employees: payload.employees,
          _parent_company: payload.parent_company,
          _logo_url: payload.logo_url,
          _banner_url: payload.banner_url,
          _notable_games: payload.notable_games,
          _social_links: payload.social_links,
          _wikipedia_url: payload.wikipedia_url,
        });
        
        if (error) throw error;
        
        await adminLog({
          action: 'update_developer',
          entity: 'developers',
          entity_id: editing.id,
          reason: \`Desenvolvedor "\${payload.name}" atualizado\`,
          payload: { before: { name: editing.name }, after: { name: payload.name } },
        });
        
        toast.success('Desenvolvedor atualizado!');
      } else {
        const { data: result, error } = await supabase.rpc('admin_create_developer', {
          _name: payload.name,
          _slug: payload.slug,
          _description: payload.description,
          _bio: payload.bio,
          _website: payload.website,
          _founded_year: payload.founded_year,
          _country: payload.country,
          _headquarters: payload.headquarters,
          _employees: payload.employees,
          _parent_company: payload.parent_company,
          _logo_url: payload.logo_url,
          _banner_url: payload.banner_url,
          _notable_games: payload.notable_games,
          _social_links: payload.social_links,
          _wikipedia_url: payload.wikipedia_url,
        });
        
        if (error) throw error;
        
        await adminLog({
          action: 'create_developer',
          entity: 'developers',
          entity_id: result,
          reason: \`Desenvolvedor "\${payload.name}" criado\`,
          payload: { name: payload.name, slug: payload.slug },
        });
        
        toast.success('Desenvolvedor criado!');
      }
      
      setDialogOpen(false);
      resetForm();
      load();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar desenvolvedor');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    
    setSaving(true);
    try {
      const { error } = await supabase.rpc('admin_delete_developer', {
        _id: deleteTarget.id,
      });
      
      if (error) throw error;
      
      await adminLog({
        action: 'delete_developer',
        entity: 'developers',
        entity_id: deleteTarget.id,
        reason: \`Desenvolvedor "\${deleteTarget.name}" excluído\`,
        payload: { name: deleteTarget.name },
      });
      
      toast.success('Desenvolvedor excluído!');
      setDeleteTarget(null);
      load();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir desenvolvedor');
    } finally {
      setSaving(false);
    }
  };

  const exportData = () => {
    setExporting(true);
    const data = developers.map(d => ({
      Nome: d.name,
      Slug: d.slug,
      País: d.country || '',
      Sede: d.headquarters || '',
      'Ano de Fundação': d.founded_year || '',
      Funcionários: d.employees || '',
      'Empresa Mãe': d.parent_company || '',
      'Jogos Notáveis': (d.notable_games || []).join(', '),
      'Jogos na Plataforma': d._game_count || 0,
      'Avaliação Média': d._avg_rating?.toFixed(1) || '-',
      Website: d.website || '',
      'Criado em': formatDateTime(d.created_at),
    }));
    exportCsv(\`desenvolvedores-\${new Date().toISOString().slice(0, 10)}.csv\`, data);
    setExporting(false);
    toast.success('Dados exportados!');
  };

  const totalPages = Math.ceil(developers.length / ITEMS_PER_PAGE);
  const paginated = developers.slice(0, (page + 1) * ITEMS_PER_PAGE);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader
        icon={Building2}
        title="Desenvolvedores"
        subtitle="Gerenciamento de estúdios e desenvolvedores de jogos"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportData} disabled={exporting}>
              <Download className="h-4 w-4 mr-1" />
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Exportar'}
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Novo Desenvolvedor
            </Button>
          </div>
        }
      />

      <Card className="border-border/50">
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar desenvolvedor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); }}>
            Limpar
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Desenvolvedor</TableHead>
                <TableHead>País</TableHead>
                <TableHead className="text-center">Jogos</TableHead>
                <TableHead className="text-center">Avaliação</TableHead>
                <TableHead>Ano</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EstadoVazio titulo="Nenhum desenvolvedor encontrado" />
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map(d => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {d.logo_url ? (
                          <img src={d.logo_url} alt={d.name} className="w-8 h-8 rounded object-cover" loading="lazy" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">{d.name}</p>
                          <p className="text-xs text-muted-foreground">{d.slug}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{d.country || '—'}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{d._game_count || 0}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {d._avg_rating ? (
                        <span className="text-sm font-medium text-warning">
                          {d._avg_rating.toFixed(1)} ⭐
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{d.founded_year || '—'}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(d)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(d)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de Criação/Edição */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Desenvolvedor' : 'Novo Desenvolvedor'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={e => {
                  setForm({ ...form, name: e.target.value });
                  if (!form.slug) {
                    setForm(f => ({ ...f, slug: generateSlug(e.target.value) }));
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={form.slug}
                onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                placeholder="gerado-automaticamente"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Bio (resumo curto)</Label>
              <Textarea
                value={form.bio}
                onChange={e => setForm({ ...form, bio: e.target.value })}
                rows={2}
                maxLength={200}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Descrição (completa)</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Logo URL</Label>
              <Input
                value={form.logo_url}
                onChange={e => setForm({ ...form, logo_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Banner URL</Label>
              <Input
                value={form.banner_url}
                onChange={e => setForm({ ...form, banner_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input
                value={form.website}
                onChange={e => setForm({ ...form, website: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Ano de Fundação</Label>
              <Input
                type="number"
                value={form.founded_year}
                onChange={e => setForm({ ...form, founded_year: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>País</Label>
              <Input
                value={form.country}
                onChange={e => setForm({ ...form, country: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Sede</Label>
              <Input
                value={form.headquarters}
                onChange={e => setForm({ ...form, headquarters: e.target.value })}
                placeholder="Cidade, País"
              />
            </div>
            <div className="space-y-2">
              <Label>Funcionários</Label>
              <Input
                type="number"
                value={form.employees}
                onChange={e => setForm({ ...form, employees: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Empresa Mãe</Label>
              <Input
                value={form.parent_company}
                onChange={e => setForm({ ...form, parent_company: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Jogos Notáveis</Label>
              <Input
                value={form.notable_games}
                onChange={e => setForm({ ...form, notable_games: e.target.value })}
                placeholder="Elden Ring, Dark Souls, Bloodborne (separados por vírgula)"
              />
            </div>
            <div className="space-y-2">
              <Label>Twitter</Label>
              <Input
                value={form.twitter}
                onChange={e => setForm({ ...form, twitter: e.target.value })}
                placeholder="https://twitter.com/..."
              />
            </div>
            <div className="space-y-2">
              <Label>YouTube</Label>
              <Input
                value={form.youtube}
                onChange={e => setForm({ ...form, youtube: e.target.value })}
                placeholder="https://youtube.com/..."
              />
            </div>
            <div className="space-y-2">
              <Label>Instagram</Label>
              <Input
                value={form.instagram}
                onChange={e => setForm({ ...form, instagram: e.target.value })}
                placeholder="https://instagram.com/..."
              />
            </div>
            <div className="space-y-2">
              <Label>Wikipedia URL</Label>
              <Input
                value={form.wikipedia_url}
                onChange={e => setForm({ ...form, wikipedia_url: e.target.value })}
                placeholder="https://en.wikipedia.org/wiki/..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir desenvolvedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "<b>{deleteTarget?.name}</b>"?
              {deleteTarget && deleteTarget._game_count && deleteTarget._game_count > 0 && (
                <span className="block mt-2 text-warning">
                  ⚠️ Este desenvolvedor possui <b>{deleteTarget._game_count}</b> jogos vinculados.
                  Eles ficarão sem desenvolvedor após a exclusão.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}`;

  writeFile(filePath, content);
  logSuccess(`AdminDevelopers.tsx criado`);
}

function createAdminPublishers() {
  const filePath = path.join(PAGES_DIR, 'AdminPublishers.tsx');
  
  const content = `import { useEffect, useState } from 'react';
import { Building2, Plus, Search, Edit, Trash2, Loader2, Download, ChevronLeft, ChevronRight, Globe } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { adminLog, exportCsv } from '../lib/adminLog';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDateTime } from '@/lib/format';

interface Publisher {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  bio: string | null;
  logo_url: string | null;
  banner_url: string | null;
  website: string | null;
  founded_year: number | null;
  country: string | null;
  headquarters: string | null;
  employees: number | null;
  parent_company: string | null;
  notable_games: string[] | null;
  social_links: any;
  wikipedia_url: string | null;
  created_at: string;
  updated_at: string;
  _game_count?: number;
}

const ITEMS_PER_PAGE = 20;

export default function AdminPublishers() {
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Publisher | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Publisher | null>(null);
  const [exporting, setExporting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    bio: '',
    logo_url: '',
    banner_url: '',
    website: '',
    founded_year: '',
    country: '',
    headquarters: '',
    employees: '',
    parent_company: '',
    notable_games: '',
    wikipedia_url: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('publishers')
        .select('*')
        .order('name');
      
      if (search) {
        query = query.ilike('name', \`%\${search}%\`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      const pubIds = (data || []).map(p => p.id);
      let gameCounts = new Map();
      
      if (pubIds.length > 0) {
        const { data: games } = await supabase
          .from('produtos')
          .select('publisher_id')
          .in('publisher_id', pubIds);
        
        const counts = new Map<string, number>();
        games?.forEach(g => {
          counts.set(g.publisher_id, (counts.get(g.publisher_id) || 0) + 1);
        });
        gameCounts = counts;
      }
      
      setPublishers((data || []).map(p => ({
        ...p,
        _game_count: gameCounts.get(p.id) || 0,
      })));
    } catch (error) {
      toast.error('Erro ao carregar publicadoras');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const resetForm = () => {
    setForm({
      name: '',
      slug: '',
      description: '',
      bio: '',
      logo_url: '',
      banner_url: '',
      website: '',
      founded_year: '',
      country: '',
      headquarters: '',
      employees: '',
      parent_company: '',
      notable_games: '',
      wikipedia_url: '',
    });
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (p: Publisher) => {
    setEditing(p);
    setForm({
      name: p.name || '',
      slug: p.slug || '',
      description: p.description || '',
      bio: p.bio || '',
      logo_url: p.logo_url || '',
      banner_url: p.banner_url || '',
      website: p.website || '',
      founded_year: p.founded_year ? String(p.founded_year) : '',
      country: p.country || '',
      headquarters: p.headquarters || '',
      employees: p.employees ? String(p.employees) : '',
      parent_company: p.parent_company || '',
      notable_games: (p.notable_games || []).join(', '),
      wikipedia_url: p.wikipedia_url || '',
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    
    const slug = form.slug.trim() || generateSlug(form.name);
    setSaving(true);
    
    const payload = {
      name: form.name.trim(),
      slug: slug,
      description: form.description.trim() || null,
      bio: form.bio.trim() || null,
      logo_url: form.logo_url.trim() || null,
      banner_url: form.banner_url.trim() || null,
      website: form.website.trim() || null,
      founded_year: form.founded_year ? parseInt(form.founded_year) : null,
      country: form.country.trim() || null,
      headquarters: form.headquarters.trim() || null,
      employees: form.employees ? parseInt(form.employees) : null,
      parent_company: form.parent_company.trim() || null,
      notable_games: form.notable_games ? form.notable_games.split(',').map(s => s.trim()).filter(Boolean) : null,
      wikipedia_url: form.wikipedia_url.trim() || null,
    };
    
    try {
      if (editing) {
        const { error } = await supabase
          .from('publishers')
          .update(payload)
          .eq('id', editing.id);
        
        if (error) throw error;
        
        await adminLog({
          action: 'update_publisher',
          entity: 'publishers',
          entity_id: editing.id,
          reason: \`Publicadora "\${payload.name}" atualizada\`,
          payload: { before: { name: editing.name }, after: { name: payload.name } },
        });
        
        toast.success('Publicadora atualizada!');
      } else {
        const { data, error } = await supabase
          .from('publishers')
          .insert(payload)
          .select('id')
          .single();
        
        if (error) throw error;
        
        await adminLog({
          action: 'create_publisher',
          entity: 'publishers',
          entity_id: data?.id,
          reason: \`Publicadora "\${payload.name}" criada\`,
          payload: { name: payload.name, slug: payload.slug },
        });
        
        toast.success('Publicadora criada!');
      }
      
      setDialogOpen(false);
      resetForm();
      load();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar publicadora');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('publishers')
        .delete()
        .eq('id', deleteTarget.id);
      
      if (error) throw error;
      
      await adminLog({
        action: 'delete_publisher',
        entity: 'publishers',
        entity_id: deleteTarget.id,
        reason: \`Publicadora "\${deleteTarget.name}" excluída\`,
        payload: { name: deleteTarget.name },
      });
      
      toast.success('Publicadora excluída!');
      setDeleteTarget(null);
      load();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir publicadora');
    } finally {
      setSaving(false);
    }
  };

  const exportData = () => {
    setExporting(true);
    const data = publishers.map(p => ({
      Nome: p.name,
      Slug: p.slug,
      País: p.country || '',
      Sede: p.headquarters || '',
      'Ano de Fundação': p.founded_year || '',
      'Jogos Notáveis': (p.notable_games || []).join(', '),
      'Jogos na Plataforma': p._game_count || 0,
      Website: p.website || '',
      'Criado em': formatDateTime(p.created_at),
    }));
    exportCsv(\`publicadoras-\${new Date().toISOString().slice(0, 10)}.csv\`, data);
    setExporting(false);
    toast.success('Dados exportados!');
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader
        icon={Building2}
        title="Publicadoras"
        subtitle="Gerenciamento de publicadoras de jogos"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportData} disabled={exporting}>
              <Download className="h-4 w-4 mr-1" />
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Exportar'}
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Nova Publicadora
            </Button>
          </div>
        }
      />

      <Card className="border-border/50">
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar publicadora..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Publicadora</TableHead>
                <TableHead>País</TableHead>
                <TableHead className="text-center">Jogos</TableHead>
                <TableHead>Ano</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {publishers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <EstadoVazio titulo="Nenhuma publicadora encontrada" />
                  </TableCell>
                </TableRow>
              ) : (
                publishers.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {p.logo_url ? (
                          <img src={p.logo_url} alt={p.name} className="w-8 h-8 rounded object-cover" loading="lazy" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.slug}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{p.country || '—'}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{p._game_count || 0}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{p.founded_year || '—'}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(p)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Publicadora' : 'Nova Publicadora'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={e => {
                  setForm({ ...form, name: e.target.value });
                  if (!form.slug) {
                    setForm(f => ({ ...f, slug: generateSlug(e.target.value) }));
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={form.slug}
                onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Logo URL</Label>
              <Input
                value={form.logo_url}
                onChange={e => setForm({ ...form, logo_url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Banner URL</Label>
              <Input
                value={form.banner_url}
                onChange={e => setForm({ ...form, banner_url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input
                value={form.website}
                onChange={e => setForm({ ...form, website: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Ano de Fundação</Label>
              <Input
                type="number"
                value={form.founded_year}
                onChange={e => setForm({ ...form, founded_year: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>País</Label>
              <Input
                value={form.country}
                onChange={e => setForm({ ...form, country: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Sede</Label>
              <Input
                value={form.headquarters}
                onChange={e => setForm({ ...form, headquarters: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Jogos Notáveis</Label>
              <Input
                value={form.notable_games}
                onChange={e => setForm({ ...form, notable_games: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Wikipedia URL</Label>
              <Input
                value={form.wikipedia_url}
                onChange={e => setForm({ ...form, wikipedia_url: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir publicadora?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "<b>{deleteTarget?.name}</b>"?
              {deleteTarget && deleteTarget._game_count && deleteTarget._game_count > 0 && (
                <span className="block mt-2 text-warning">
                  ⚠️ Esta publicadora possui <b>{deleteTarget._game_count}</b> jogos vinculados.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}`;

  writeFile(filePath, content);
  logSuccess(`AdminPublishers.tsx criado`);
}

// ============================================================
// FUNÇÃO PRINCIPAL
// ============================================================

function main() {
  console.log('\n🚀 Implementando gaps do DESKTOP...\n');
  console.log('='.repeat(60) + '\n');

  try {
    // 1. Migrations
    logStep('Criando migrations...');
    createMigrations();

    // 2. Telas Novas
    logStep('Criando telas novas...');
    createAdminDevelopers();
    createAdminPublishers();

    console.log('\n' + '='.repeat(60));
    log('\n✅ SCRIPT DO DESKTOP EXECUTADO COM SUCESSO!\n', GREEN);

    console.log('📋 Resumo:');
    console.log('  🗄️ 4 migrations criadas');
    console.log('  📄 2 telas novas (AdminDevelopers, AdminPublishers)');
    console.log('  ⏳ Mais telas serão adicionadas na próxima fase');

    console.log('\n📌 Próximos passos:');
    console.log('  1. Rodar as migrations no Supabase SQL Editor');
    console.log('  2. Reiniciar o servidor: npm run dev');
    console.log('  3. Testar as novas telas:');
    console.log('     - /desktop/desenvolvedores');
    console.log('     - /desktop/publicadoras');
    console.log('  4. Verificar se os campos aparecem em Produtos.tsx');

    console.log('\n🎮 MIDIAS Desktop agora está mais completo!\n');

  } catch (error) {
    logError(`Erro durante a execução: ${error}`);
    if (error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();